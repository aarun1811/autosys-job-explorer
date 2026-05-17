#!/usr/bin/env bash
# ops/rectrace-ops.sh v2 — runtime ops driven by ops/components.sh registry.
#
# Phase 8 OPS-01..03:
#   - shellcheck-clean (-x): zero warnings, zero errors.
#   - bash 3.2 (macOS) + bash 4/5 (Linux) portable: no associative arrays,
#     no mapfile, no GNU `sed -i` without backup extension.
#   - start blocks on actuator-readiness probe (not just kill -0).
#   - Component registry lives in ops/components.sh — adding one is a one-liner.
#
# Usage: rectrace-ops.sh <start|stop|restart|status|logs> <name|all>
#
# Environment overrides:
#   RECTRACE_READY_TIMEOUT   default 30  (seconds; total wait per component)
#   RECTRACE_READY_INTERVAL  default 2   (seconds; poll interval)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
# shellcheck source=ops/components.sh
source "$SCRIPT_DIR/components.sh"

RUN_DIR="$REPO_ROOT/run"
LOG_DIR="$REPO_ROOT/logs"
mkdir -p "$RUN_DIR" "$LOG_DIR"

READY_TIMEOUT="${RECTRACE_READY_TIMEOUT:-30}"
READY_INTERVAL="${RECTRACE_READY_INTERVAL:-2}"

# Globals set by parse_entry. Documented for shellcheck:
# shellcheck disable=SC2034  # consumed by callers after parse_entry runs
C_NAME=""
# shellcheck disable=SC2034
C_PORT=""
# shellcheck disable=SC2034
C_PID=""
# shellcheck disable=SC2034
C_LOG=""
# shellcheck disable=SC2034
C_READY=""
# shellcheck disable=SC2034
C_DIR=""
# shellcheck disable=SC2034
C_CMD=""

# parse_entry <entry> — split a '|'-delimited registry entry into globals.
# Resolves pid_file / log_file / dir against $REPO_ROOT so the rest of the
# script uses absolute paths.
parse_entry() {
  local entry="$1"
  IFS='|' read -r C_NAME C_PORT C_PID C_LOG C_READY C_DIR C_CMD <<< "$entry"
  C_PID="$REPO_ROOT/$C_PID"
  C_LOG="$REPO_ROOT/$C_LOG"
  if [ "$C_DIR" != "-" ]; then
    C_DIR="$REPO_ROOT/$C_DIR"
  fi
}

# wait_ready <url> <label> — poll URL until HTTP 2xx, bounded by $READY_TIMEOUT.
# Returns 0 on 2xx, 1 on timeout. Uses curl -fsS for clean exit codes.
wait_ready() {
  local url="$1"
  local label="$2"
  local elapsed=0
  local code
  echo "Waiting for $label at $url (timeout ${READY_TIMEOUT}s) ..."
  while [ "$elapsed" -lt "$READY_TIMEOUT" ]; do
    code="$(curl -fsS -o /dev/null -w '%{http_code}' "$url" 2>/dev/null || true)"
    case "$code" in
      2*)
        echo "$label: ready (HTTP $code)"
        return 0
        ;;
    esac
    sleep "$READY_INTERVAL"
    elapsed=$((elapsed + READY_INTERVAL))
  done
  echo "ERROR: $label did not become ready in ${READY_TIMEOUT}s (last code: ${code:-none})" >&2
  return 1
}

# start_one <entry> — spawn the component if not already running.
# Does NOT block on readiness — do_start handles probing so `start all` can
# parallelize the wait wall-clock.
start_one() {
  parse_entry "$1"
  if [ -f "$C_PID" ]; then
    local existing
    existing="$(cat "$C_PID")"
    if [ -n "$existing" ] && kill -0 "$existing" 2>/dev/null; then
      echo "$C_NAME: already running (pid $existing)"
      return 0
    fi
    # Stale pid file — remove and continue to spawn.
    rm -f "$C_PID"
  fi
  echo "Starting $C_NAME ..."
  if [ "$C_DIR" != "-" ]; then
    # Subshell isolates cwd change; $! captures subshell pid.
    # shellcheck disable=SC2086  # $C_CMD is from version-controlled registry
    # (T-08-05): never user-input. Word-splitting is required so flags reach
    # the child. Switching to read -ra breaks `-Dspring-boot.run.profiles=local`
    # which carries an `=` token.
    ( cd "$C_DIR" || exit 1; exec >>"$C_LOG" 2>&1; eval "$C_CMD" ) &
  else
    # shellcheck disable=SC2086  # see T-08-05 above
    ( exec >>"$C_LOG" 2>&1; eval "$C_CMD" ) &
  fi
  local pid=$!
  printf '%s\n' "$pid" > "$C_PID"
  echo "$C_NAME: started (pid $pid). Log: $C_LOG"
}

# stop_one <entry> — kill the component, wait up to 30s, SIGKILL fallback.
stop_one() {
  parse_entry "$1"
  if [ ! -f "$C_PID" ]; then
    echo "$C_NAME: not running (no pid file)"
    return 0
  fi
  local pid
  pid="$(cat "$C_PID")"
  if [ -z "$pid" ] || ! kill -0 "$pid" 2>/dev/null; then
    echo "$C_NAME: process not found (stale pid file removed)"
    rm -f "$C_PID"
    return 0
  fi
  echo "Stopping $C_NAME (pid $pid) ..."
  kill "$pid" 2>/dev/null || true
  local waited=0
  while kill -0 "$pid" 2>/dev/null && [ "$waited" -lt 30 ]; do
    sleep 1
    waited=$((waited + 1))
  done
  if kill -0 "$pid" 2>/dev/null; then
    echo "WARN: $C_NAME (pid $pid) did not stop in 30s — sending SIGKILL" >&2
    kill -9 "$pid" 2>/dev/null || true
  fi
  rm -f "$C_PID"
  echo "$C_NAME: stopped"
}

# status_one <entry> — one-line status report.
status_one() {
  parse_entry "$1"
  if [ -f "$C_PID" ]; then
    local pid
    pid="$(cat "$C_PID")"
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      echo "$C_NAME: up (pid $pid, port $C_PORT)"
      return 0
    fi
    echo "$C_NAME: down (stale pid file)"
    return 0
  fi
  echo "$C_NAME: down"
}

# logs_one <entry> — tail -f the component's log.
logs_one() {
  parse_entry "$1"
  if [ ! -f "$C_LOG" ]; then
    echo "$C_NAME: no log file at $C_LOG" >&2
    return 1
  fi
  exec tail -f "$C_LOG"
}

# usage — print help and exit 1.
usage() {
  local names
  names="$(registry_names | tr '\n' ' ')"
  cat >&2 <<USAGE
Usage: $0 <start|stop|restart|status|logs> <component|all>

Registered components: ${names}all

Verbs:
  start <c>     start <c> and block on actuator-readiness probe
  start all     start every registered component, then probe all
  stop <c>      stop <c> (SIGTERM, SIGKILL after 30s)
  stop all      stop every component
  restart <c>   stop then start <c>
  restart all   stop all then start all
  status <c>    report up/down for <c>
  status all    report up/down for every component
  logs <c>      tail -f the log file for <c> (no 'all' form)

Environment:
  RECTRACE_READY_TIMEOUT   readiness wait seconds (default 30)
  RECTRACE_READY_INTERVAL  poll interval seconds (default 2)
USAGE
  exit 1
}

# resolve_entry <name> — echo entry on stdout, exit 1 with diagnostic on miss.
resolve_entry() {
  local name="$1"
  local entry
  if ! entry="$(registry_lookup "$name")"; then
    local valid
    valid="$(registry_names | tr '\n' ' ')"
    echo "ERROR: Unknown component: $name. Valid: ${valid}all" >&2
    exit 1
  fi
  printf '%s\n' "$entry"
}

# do_start <name|all> — start + probe with parallelized wait on 'all'.
do_start() {
  local target="$1"
  if [ "$target" = "all" ]; then
    local entry
    for entry in "${REGISTRY[@]}"; do
      start_one "$entry"
    done
    local rc=0
    for entry in "${REGISTRY[@]}"; do
      parse_entry "$entry"
      wait_ready "$C_READY" "$C_NAME" || rc=1
    done
    return "$rc"
  fi
  local entry
  entry="$(resolve_entry "$target")"
  start_one "$entry"
  parse_entry "$entry"
  wait_ready "$C_READY" "$C_NAME"
}

# do_stop <name|all>
do_stop() {
  local target="$1"
  if [ "$target" = "all" ]; then
    local entry
    for entry in "${REGISTRY[@]}"; do
      stop_one "$entry"
    done
    return 0
  fi
  local entry
  entry="$(resolve_entry "$target")"
  stop_one "$entry"
}

# do_status <name|all>
do_status() {
  local target="$1"
  if [ "$target" = "all" ]; then
    local entry
    for entry in "${REGISTRY[@]}"; do
      status_one "$entry"
    done
    return 0
  fi
  local entry
  entry="$(resolve_entry "$target")"
  status_one "$entry"
}

# do_restart <name|all> — stop then start, with parallelized probe on 'all'.
do_restart() {
  local target="$1"
  if [ "$target" = "all" ]; then
    local entry
    for entry in "${REGISTRY[@]}"; do
      stop_one "$entry"
    done
    for entry in "${REGISTRY[@]}"; do
      start_one "$entry"
    done
    local rc=0
    for entry in "${REGISTRY[@]}"; do
      parse_entry "$entry"
      wait_ready "$C_READY" "$C_NAME" || rc=1
    done
    return "$rc"
  fi
  local entry
  entry="$(resolve_entry "$target")"
  stop_one "$entry"
  start_one "$entry"
  parse_entry "$entry"
  wait_ready "$C_READY" "$C_NAME"
}

# do_logs <name> — 'all' is not supported (no multi-tail).
do_logs() {
  local target="$1"
  if [ "$target" = "all" ]; then
    echo "ERROR: 'logs all' is not supported — specify a single component." >&2
    exit 1
  fi
  local entry
  entry="$(resolve_entry "$target")"
  logs_one "$entry"
}

# --- Main dispatcher ---

cmd="${1:-}"
arg="${2:-all}"

case "$cmd" in
  start)   do_start   "$arg" ;;
  stop)    do_stop    "$arg" ;;
  status)  do_status  "$arg" ;;
  restart) do_restart "$arg" ;;
  logs)    do_logs    "$arg" ;;
  ""|-h|--help|help) usage ;;
  *)
    echo "ERROR: unknown verb: $cmd" >&2
    usage
    ;;
esac
