#!/usr/bin/env bash
# ops/ci-smoke.sh — Linux portability smoke for ops/rectrace-ops.sh + ops/components.sh.
# Does NOT boot the real stack. Stands up a stub HTTP server and a stub component entry,
# then exercises start/status/stop/restart/logs dispatch + readiness probe + idempotency.
#
# Phase 8 OPS-04 / D-8.11: gate that catches macOS-isms (mapfile, declare -A,
# `sed -i ''`) before they land on the Linux deploy targets. Designed to run
# identically on macOS bash 3.2 and Linux bash 4/5. Invoked locally and by
# .github/workflows/ops-script.yml on every push.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# --- Constants ---
STUB_PORT=7799
STUB_HTTP_LOG="/tmp/rectrace-stub-http.log"
STUB_HTTP_PID_FILE="/tmp/rectrace-stub-http.pid"
STUB_REGISTRY="/tmp/rectrace-components-with-stub.sh"
STUB_COMPONENT_NAME="stub"
STUB_PID_FILE="$REPO_ROOT/run/stub.pid"
STUB_LOG_FILE="$REPO_ROOT/logs/stub.log"

ASSERT_COUNT=0
ASSERT_TOTAL=0

# --- Cleanup trap ---
cleanup() {
  local rc=$?
  if [ -f "$STUB_HTTP_PID_FILE" ]; then
    local hpid
    hpid="$(cat "$STUB_HTTP_PID_FILE" 2>/dev/null || true)"
    if [ -n "$hpid" ] && kill -0 "$hpid" 2>/dev/null; then
      kill "$hpid" 2>/dev/null || true
      # Best-effort wait for stub HTTP to exit cleanly.
      local waited=0
      while kill -0 "$hpid" 2>/dev/null && [ "$waited" -lt 5 ]; do
        sleep 1
        waited=$((waited + 1))
      done
      if kill -0 "$hpid" 2>/dev/null; then
        kill -9 "$hpid" 2>/dev/null || true
      fi
    fi
    rm -f "$STUB_HTTP_PID_FILE"
  fi
  # Clean up the stub component pid if start/stop tests left it behind.
  if [ -f "$STUB_PID_FILE" ]; then
    local spid
    spid="$(cat "$STUB_PID_FILE" 2>/dev/null || true)"
    if [ -n "$spid" ] && kill -0 "$spid" 2>/dev/null; then
      kill "$spid" 2>/dev/null || true
      sleep 1
      kill -9 "$spid" 2>/dev/null || true
    fi
    rm -f "$STUB_PID_FILE"
  fi
  rm -f "$STUB_REGISTRY"
  return "$rc"
}
trap cleanup EXIT INT TERM

# --- Helpers ---
fail() {
  echo "[FAIL] $1" >&2
  exit 1
}

assert() {
  # assert <description> <expected-exit:0|nonzero> <command-string>
  local desc="$1"
  local expect="$2"
  local cmd="$3"
  ASSERT_TOTAL=$((ASSERT_TOTAL + 1))
  local out rc
  set +e
  out="$(bash -c "$cmd" 2>&1)"
  rc=$?
  set -e
  case "$expect" in
    0)
      if [ "$rc" -eq 0 ]; then
        ASSERT_COUNT=$((ASSERT_COUNT + 1))
        echo "[PASS] (#$ASSERT_TOTAL) $desc"
      else
        echo "----- output -----"
        echo "$out"
        echo "----- /output -----"
        fail "(#$ASSERT_TOTAL) $desc — expected exit 0, got $rc"
      fi
      ;;
    nonzero)
      if [ "$rc" -ne 0 ]; then
        ASSERT_COUNT=$((ASSERT_COUNT + 1))
        echo "[PASS] (#$ASSERT_TOTAL) $desc"
      else
        echo "----- output -----"
        echo "$out"
        echo "----- /output -----"
        fail "(#$ASSERT_TOTAL) $desc — expected nonzero exit, got 0"
      fi
      ;;
    *)
      fail "internal: assert expect must be 0 or nonzero, got '$expect'"
      ;;
  esac
}

assert_grep() {
  # assert_grep <description> <pattern> <command-string>
  local desc="$1"
  local pat="$2"
  local cmd="$3"
  ASSERT_TOTAL=$((ASSERT_TOTAL + 1))
  local out
  set +e
  out="$(bash -c "$cmd" 2>&1)"
  set -e
  if printf '%s' "$out" | grep -q -- "$pat"; then
    ASSERT_COUNT=$((ASSERT_COUNT + 1))
    echo "[PASS] (#$ASSERT_TOTAL) $desc"
  else
    echo "----- output -----"
    echo "$out"
    echo "----- /output -----"
    fail "(#$ASSERT_TOTAL) $desc — pattern '$pat' not found in output"
  fi
}

# wait_http_ready <url> <timeout-seconds>
wait_http_ready() {
  local url="$1"
  local timeout="$2"
  local elapsed=0
  local code
  while [ "$elapsed" -lt "$timeout" ]; do
    code="$(curl -fsS -o /dev/null -w '%{http_code}' "$url" 2>/dev/null || true)"
    case "$code" in
      2*) return 0 ;;
    esac
    sleep 1
    elapsed=$((elapsed + 1))
  done
  echo "ERROR: stub HTTP did not become ready at $url within ${timeout}s" >&2
  return 1
}

# --- 1. Pre-flight ---
echo "=== ops/ci-smoke.sh — Linux portability smoke ==="
echo "--- toolchain ---"
bash --version | head -1
if ! command -v shellcheck >/dev/null 2>&1; then
  fail "shellcheck not on PATH (required by OPS-04 gate)"
fi
shellcheck --version | sed -n '2p'
if ! command -v python3 >/dev/null 2>&1; then
  fail "python3 not on PATH (required to host stub HTTP server)"
fi
python3 --version
if ! command -v curl >/dev/null 2>&1; then
  fail "curl not on PATH (required for readiness probe)"
fi

# --- 2. shellcheck gate ---
echo "--- shellcheck gate ---"
shellcheck -x ops/rectrace-ops.sh ops/components.sh

# --- 3. Static sanity ---
echo "--- static parse ---"
bash -n ops/rectrace-ops.sh
bash -n ops/components.sh

# --- 4. Stub HTTP server ---
echo "--- stub HTTP server on 127.0.0.1:$STUB_PORT ---"
# Bind explicitly to loopback (T-08-08): never reachable off the CI runner.
python3 -m http.server "$STUB_PORT" --bind 127.0.0.1 >"$STUB_HTTP_LOG" 2>&1 &
echo $! > "$STUB_HTTP_PID_FILE"
wait_http_ready "http://127.0.0.1:$STUB_PORT/" 5

# --- 5. Stub registry override ---
echo "--- stub registry ---"
# Clone the real registry, then append a stub component. The stub's start_cmd
# is `sleep 600` — runs indefinitely under start_one, gets killed by stop_one.
# ready_url points at the python http.server we just started — proves wait_ready
# works without booting Java or Node.
cp ops/components.sh "$STUB_REGISTRY"
{
  echo ""
  echo "# OPS-04 ci-smoke stub component (appended by ops/ci-smoke.sh):"
  echo "REGISTRY+=(\"$STUB_COMPONENT_NAME|$STUB_PORT|run/stub.pid|logs/stub.log|http://127.0.0.1:$STUB_PORT/|-|sleep 600\")"
} >> "$STUB_REGISTRY"
export RECTRACE_COMPONENTS_FILE="$STUB_REGISTRY"

# Shrink readiness probe to CI-friendly timing.
export RECTRACE_READY_TIMEOUT=5
export RECTRACE_READY_INTERVAL=1

# --- 6. Dispatch assertions ---
echo "--- dispatch assertions ---"

# 6a. No-args prints usage and exits non-zero.
assert "no-args exits non-zero (usage)" nonzero \
  "bash ops/rectrace-ops.sh"

# 6b. status all lists stub (proves override loaded).
assert_grep "status all sees stub (override loaded)" "$STUB_COMPONENT_NAME" \
  "bash ops/rectrace-ops.sh status all"

# 6c. Unknown component exits non-zero with diagnostic.
assert "status bogus exits non-zero" nonzero \
  "bash ops/rectrace-ops.sh status bogus"
assert_grep "status bogus prints 'Unknown component'" "Unknown component" \
  "bash ops/rectrace-ops.sh status bogus 2>&1"

# 6d. First start succeeds; pid file appears; readiness probe hits stub HTTP.
assert "start stub exits 0 (readiness probe passes)" 0 \
  "bash ops/rectrace-ops.sh start $STUB_COMPONENT_NAME"
if [ ! -f "$STUB_PID_FILE" ]; then
  fail "start stub did not create $STUB_PID_FILE"
fi
ASSERT_TOTAL=$((ASSERT_TOTAL + 1))
ASSERT_COUNT=$((ASSERT_COUNT + 1))
echo "[PASS] (#$ASSERT_TOTAL) start stub created pid file at run/stub.pid"

# 6e. Second start is idempotent ('already running').
assert_grep "second start is idempotent (already running)" "already running" \
  "bash ops/rectrace-ops.sh start $STUB_COMPONENT_NAME 2>&1"

# 6f. status stub reports up.
assert_grep "status stub reports 'up'" "up (pid" \
  "bash ops/rectrace-ops.sh status $STUB_COMPONENT_NAME"

# 6g. stop stub exits 0 and removes pid file.
assert "stop stub exits 0" 0 \
  "bash ops/rectrace-ops.sh stop $STUB_COMPONENT_NAME"
if [ -f "$STUB_PID_FILE" ]; then
  fail "stop stub did not remove $STUB_PID_FILE"
fi
ASSERT_TOTAL=$((ASSERT_TOTAL + 1))
ASSERT_COUNT=$((ASSERT_COUNT + 1))
echo "[PASS] (#$ASSERT_TOTAL) stop stub removed pid file"

# 6h. logs all is not supported (OPS-02 explicit decision).
assert "logs all exits non-zero (not supported)" nonzero \
  "bash ops/rectrace-ops.sh logs all"

# --- 7. Result ---
echo ""
echo "[PASS] ci-smoke: $ASSERT_COUNT/$ASSERT_TOTAL assertions"

# Best-effort post-test log scrub (also covered by EXIT trap).
rm -f "$STUB_LOG_FILE"
