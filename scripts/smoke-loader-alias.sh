#!/usr/bin/env bash
# scripts/smoke-loader-alias.sh — LOADER-03 boot-fail smoke.
#
# Asserts: when the loader is configured against a missing Elasticsearch alias, the JVM
# refuses to boot (LoaderConfigService Pattern 5). A "successful" boot keeps running forever,
# so a non-zero exit within the 60-second budget IS the success condition.
#
# Prerequisites:
#   - Docker stack up (Elasticsearch healthy on http://localhost:9200):
#       cd ../rectrace-local-dev && docker compose up -d
#   - Loader NOT running on :6089 (this smoke boots its own JVM with a bad config).
#
# Exit codes:
#   0 — boot failed with the expected diagnostic banner; LOADER-03 contract intact.
#   1 — any assertion missed; see "FAIL:" line for the failing check.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ES_URL="${ES_URL:-http://localhost:9200}"
SUFFIX="$$"
BAD_ALIAS="this_alias_does_not_exist_${SUFFIX}"
CONFIG_PATH="/tmp/loader-config-bad-alias-${SUFFIX}.json"
BOOT_LOG="/tmp/loader-boot-${SUFFIX}.log"

cleanup() {
  rm -f "$CONFIG_PATH" "$BOOT_LOG"
}
trap cleanup EXIT

# 1) Write a minimal loader config referencing a guaranteed-absent alias.
cat > "$CONFIG_PATH" <<JSON
{
  "jobs": [
    {
      "key": "smoke_alias_boot_fail",
      "source": {
        "datasource": "primary",
        "query": "SELECT job_name FROM rectrace.rectrace_core",
        "primaryKey": ["job_name"]
      },
      "target": {
        "alias": "${BAD_ALIAS}",
        "batch": {"rows": 100, "bytes": 1048576, "flushMs": 5000}
      },
      "schedule": "0 */5 * * * *",
      "timezone": "UTC"
    }
  ]
}
JSON

# 2) Verify the alias really is absent — guards against a freak collision.
ALIAS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${ES_URL}/_alias/${BAD_ALIAS}")
if [ "$ALIAS_CODE" != "404" ]; then
  echo "FAIL: test alias ${BAD_ALIAS} unexpectedly exists (HTTP $ALIAS_CODE)"
  exit 1
fi

# 3) Boot the loader with the bad config and the local profile. A successful boot keeps
#    running forever — we bound that with a shell-native timeout (macOS lacks `timeout`).
#    Strategy: spawn maven in background, poll for exit up to 90s; if still alive, SIGTERM.
#
#    DevTools quirk: when rectrace-loader's spring-boot-devtools is on the classpath, a
#    bean-creation failure during refresh is caught by RestartLauncher and `mvn
#    spring-boot:run` exits 0 even though the app never started. We disable the restarter
#    so the IllegalStateException from LoaderConfigService propagates and mvn returns
#    non-zero — the assertion this smoke is built on.
BOOT_DEADLINE_SEC="${BOOT_DEADLINE_SEC:-90}"
set +e
( cd "$REPO_ROOT/rectrace-loader" && mvn -q spring-boot:run \
    -Dspring-boot.run.profiles=local \
    -Dspring-boot.run.jvmArguments="-Dspring.devtools.restart.enabled=false" \
    -Dspring-boot.run.arguments="--loader-config.location=file:${CONFIG_PATH}" \
    >"$BOOT_LOG" 2>&1 ) &
MVN_PID=$!
ELAPSED=0
BOOT_EXIT=""
while [ "$ELAPSED" -lt "$BOOT_DEADLINE_SEC" ]; do
  if ! kill -0 "$MVN_PID" 2>/dev/null; then
    wait "$MVN_PID"
    BOOT_EXIT=$?
    break
  fi
  sleep 2
  ELAPSED=$((ELAPSED + 2))
done
if [ -z "$BOOT_EXIT" ]; then
  # JVM still alive past deadline — kill the whole process group of the maven wrapper
  # (mvn forks a child JVM) and treat as a deadline failure.
  pkill -TERM -P "$MVN_PID" 2>/dev/null || true
  kill -TERM "$MVN_PID" 2>/dev/null || true
  sleep 3
  pkill -KILL -P "$MVN_PID" 2>/dev/null || true
  kill -KILL "$MVN_PID" 2>/dev/null || true
  echo "FAIL: loader did not exit within ${BOOT_DEADLINE_SEC}s — boot did not fail fast"
  tail -60 "$BOOT_LOG"
  exit 1
fi
set -e

if [ "$BOOT_EXIT" -eq 0 ]; then
  echo "FAIL: loader boot returned 0 — expected JVM failure"
  tail -60 "$BOOT_LOG"
  exit 1
fi

# 4) Diagnostic banner must reference the missing-alias refusal and the bad alias name.
if ! grep -q "does not exist in Elasticsearch. Refusing to boot" "$BOOT_LOG"; then
  echo "FAIL: boot log does not contain the LoaderConfigService refusal banner"
  tail -40 "$BOOT_LOG"
  exit 1
fi
if ! grep -q "${BAD_ALIAS}" "$BOOT_LOG"; then
  echo "FAIL: boot log does not mention the bad alias name ${BAD_ALIAS}"
  tail -40 "$BOOT_LOG"
  exit 1
fi

echo "PASS: alias boot-fail smoke green (BOOT_EXIT=$BOOT_EXIT, alias=${BAD_ALIAS})"
