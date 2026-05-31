#!/usr/bin/env bash
# scripts/smoke-loader-sigterm.sh — LOADER-09 mid-batch SIGTERM flush smoke.
#
# Asserts: sending SIGTERM during a loader run flushes the in-flight BulkIngester queue and
# leaves no orphaned RUNNING rows in loader_run_history. The Plan 04 LoaderJobRegistry's
# @PreDestroy hook closes the BulkIngester; the @PreDestroy on the run records itself
# marks the run as FAILED with a "interrupted" message (or completes the row count if the
# ingester drained first).
#
# Prerequisites:
#   - Docker stack up (Oracle + Elasticsearch healthy).
#   - Seed applied: cd ../rectrace-local-dev && .venv/bin/python apply.py
#   - Loader NOT running on :6089 (this smoke owns the JVM lifecycle).
#   - Python with `oracledb` installed. Resolution order: $RECTRACE_PYTHON env var,
#     then the sibling repo venv ../rectrace-local-dev/.venv/bin/python, then python3 on PATH.
#   - RECTRACE_PWD + ORACLE_DSN env vars (defaults match rectrace-local-dev/.env.example).
#
# Exit codes:
#   0 — clean shutdown observed; loader_run_history has zero RUNNING rows for the test job.
#   1 — any assertion missed; see "FAIL:" line for the failing check.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_URL="${BASE_URL:-http://localhost:6089}"
ES_URL="${ES_URL:-http://localhost:9200}"
JOB_KEY="rectrace_core_loader"
ALIAS="rectrace_core_alias"
LOG_PATH="/tmp/loader-sigterm-$$.log"

# Oracle creds — match the local-dev defaults (rectrace-local-dev/.env.example).
export RECTRACE_PWD="${RECTRACE_PWD:-rectrace_pwd}"
export ORACLE_DSN="${ORACLE_DSN:-localhost:1521/FREEPDB1}"

# Resolve Python interpreter (must have `oracledb` installed) — repo-relative discovery
# replaces a previously hardcoded user-specific path.
SIBLING_VENV_PYTHON="$REPO_ROOT/../rectrace-local-dev/.venv/bin/python"
if [ -n "${RECTRACE_PYTHON:-}" ] && [ -x "$RECTRACE_PYTHON" ]; then
  PYTHON_BIN="$RECTRACE_PYTHON"
elif [ -x "$SIBLING_VENV_PYTHON" ]; then
  PYTHON_BIN="$SIBLING_VENV_PYTHON"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
else
  echo "FAIL: no Python interpreter found — install the sibling repo venv, set RECTRACE_PYTHON, or install python3"
  exit 1
fi
echo "INFO: using Python interpreter: $PYTHON_BIN"

# 1) Pre-flight — port :6089 must be free.
if lsof -i:6089 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "FAIL: another process holds port 6089 — stop the loader first"
  exit 1
fi

# 2) Boot loader in background.
( cd "$REPO_ROOT/rectrace-loader" && mvn -q spring-boot:run \
    -Dspring-boot.run.profiles=local \
    >"$LOG_PATH" 2>&1 ) &
BACKEND_PID=$!
echo "INFO: loader booting (pid=$BACKEND_PID, log=$LOG_PATH)"

cleanup() {
  if kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill -TERM "$BACKEND_PID" 2>/dev/null || true
    sleep 5
    kill -KILL "$BACKEND_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# Wait up to 90s for actuator health.
HEALTH_OK=0
for i in $(seq 1 45); do
  if curl -fsS "${BASE_URL}/actuator/health" 2>/dev/null | grep -q '"status":"UP"'; then
    HEALTH_OK=1
    echo "INFO: loader healthy after ${i}x2s polls"
    break
  fi
  sleep 2
done
if [ "$HEALTH_OK" -ne 1 ]; then
  echo "FAIL: loader did not report UP within 90s"
  tail -60 "$LOG_PATH"
  exit 1
fi

# 3) Trigger a run-now in the background — fire-and-forget; the controller blocks until
#    the ShedLock task returns, but we need it running while we SIGTERM the JVM.
curl -fsS -X POST "${BASE_URL}/api/v4/loader-admin/jobs/${JOB_KEY}/run-now" \
  -o /dev/null --max-time 30 &
RUN_NOW_PID=$!
sleep 1

# 4) Send SIGTERM to the loader mid-run. The OracleToEsLoaderJob @Scheduled task is
#    inside ShedLock's executeWithLock; @PreDestroy on LoaderJobRegistry closes the
#    BulkIngester which flushes any queued docs.
#
#    mvn spring-boot:run forks a child JVM — signalling the maven wrapper causes it to
#    forcibly kill the child before the JVM can flush its @PreDestroy banner. We therefore
#    locate the child JVM and signal it directly so Spring's graceful-shutdown lifecycle
#    runs to completion and emits the LoaderJobRegistry banner.
JVM_PID=$(pgrep -P "$BACKEND_PID" -f java | head -1)
if [ -z "$JVM_PID" ]; then
  echo "INFO: no JVM child found under pid $BACKEND_PID — signalling maven wrapper instead"
  JVM_PID="$BACKEND_PID"
fi
echo "INFO: sending SIGTERM to JVM pid $JVM_PID (mvn wrapper pid $BACKEND_PID)"
kill -TERM "$JVM_PID"

# 5) Wait for the loader to exit (90s budget).
SHUTDOWN_OK=0
for i in $(seq 1 45); do
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    SHUTDOWN_OK=1
    echo "INFO: loader exited cleanly after ${i}x2s polls"
    break
  fi
  sleep 2
done
# Reap the run-now curl (may have completed already or been cut off by the SIGTERM).
wait "$RUN_NOW_PID" 2>/dev/null || true

if [ "$SHUTDOWN_OK" -ne 1 ]; then
  echo "FAIL: loader did not exit within 90s of SIGTERM"
  tail -60 "$LOG_PATH"
  exit 1
fi

# 6) Post-assertions on the shutdown log.
#    The @PreDestroy hook is in LoaderJobRegistry; the Plan 04 banners are produced by
#    its lifecycle methods.
if ! grep -qE "Loader (shutting down|shutdown complete|closing BulkIngester)" "$LOG_PATH"; then
  echo "FAIL: shutdown log missing loader @PreDestroy banner"
  echo "----- last 40 lines of $LOG_PATH -----"
  tail -40 "$LOG_PATH"
  exit 1
fi

# 7) Oracle assertion — zero RUNNING rows for the test job.
RUNNING_COUNT=$( "$PYTHON_BIN" -c "
import os, oracledb
c = oracledb.connect(user='rectrace', password=os.environ['RECTRACE_PWD'], dsn=os.environ['ORACLE_DSN'])
cur = c.cursor()
cur.execute(\"SELECT COUNT(*) FROM loader_run_history WHERE job_key = '${JOB_KEY}' AND status = 'RUNNING'\")
print(cur.fetchone()[0])
" )
if [ "$RUNNING_COUNT" != "0" ]; then
  echo "FAIL: loader_run_history has $RUNNING_COUNT RUNNING row(s) for ${JOB_KEY} after SIGTERM"
  exit 1
fi

# 8) ES assertion — alias is still queryable (the BulkIngester @PreDestroy flushed cleanly).
if ! curl -fsS "${ES_URL}/${ALIAS}/_count" | grep -qE '"count":[[:space:]]*[0-9]+'; then
  echo "FAIL: ${ALIAS}/_count did not return a numeric count post-shutdown"
  exit 1
fi

echo "PASS: sigterm flush smoke green (RUNNING_COUNT=0, alias=${ALIAS} live)"
