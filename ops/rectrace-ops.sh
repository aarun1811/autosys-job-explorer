#!/usr/bin/env bash
# ops/rectrace-ops.sh v1 — runtime ops for rectrace services
# Usage: ops/rectrace-ops.sh <start|stop|status|restart|logs> <backend|tlm-stats|react|all>
# Phase 2 scope: v1 — no set -euo pipefail, no shellcheck; Phase 8 OPS-01..04 hardens this.
# D-2.15: three components only — backend, tlm-stats, react. NO angular row.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$REPO_ROOT/run"
LOG_DIR="$REPO_ROOT/logs"

mkdir -p "$RUN_DIR" "$LOG_DIR"

# Component: backend
BACKEND_CMD="mvn spring-boot:run -f $REPO_ROOT/backend/rectrace/pom.xml -Dspring.profiles.active=local"
BACKEND_PID="$RUN_DIR/backend.pid"
BACKEND_LOG="$LOG_DIR/backend.log"
BACKEND_READY_URL="http://localhost:6088/rectrace/actuator/health"

# Component: tlm-stats
TLMSTATS_CMD="mvn spring-boot:run -f $REPO_ROOT/rectrace-tlm-stats/pom.xml -Dspring.profiles.active=local"
TLMSTATS_PID="$RUN_DIR/tlmstats.pid"
TLMSTATS_LOG="$LOG_DIR/tlmstats.log"
TLMSTATS_READY_URL="http://localhost:8080/actuator/health"

# Component: react — pnpm-with-npm-fallback canonical pattern (D-2.15)
if command -v pnpm >/dev/null 2>&1; then
  REACT_CMD="pnpm dev"
else
  REACT_CMD="npm run dev"
fi
REACT_DIR="$REPO_ROOT/frontend-react"
REACT_PID="$RUN_DIR/react.pid"
REACT_LOG="$LOG_DIR/react.log"
REACT_READY_URL="http://localhost:5173/"

# --- Functions ---

# wait_ready: poll HTTP 200 with 30s timeout, 2s interval
wait_ready() {
  local url="$1" label="$2"
  local timeout=30 elapsed=0
  echo "Waiting for $label at $url ..."
  while [ "$elapsed" -lt "$timeout" ]; do
    if curl -s -o /dev/null -w '%{http_code}' "$url" | grep -q "200"; then
      echo "$label is ready."
      return 0
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done
  echo "Timeout: $label did not become ready in ${timeout}s"
  return 1
}

# start_component: label pid_file log_file cmd [dir]
start_component() {
  local label="$1" pid_file="$2" log_file="$3" cmd="$4" dir="${5:-}"
  if [ -f "$pid_file" ]; then
    local pid
    pid=$(cat "$pid_file")
    if kill -0 "$pid" 2>/dev/null; then
      echo "$label: already running (pid $pid)"
      return 0
    fi
  fi
  echo "Starting $label ..."
  if [ -n "$dir" ]; then
    cd "$dir" || { echo "ERROR: cannot cd to $dir"; return 1; }
    $cmd >> "$log_file" 2>&1 &
    cd - > /dev/null || true
  else
    $cmd >> "$log_file" 2>&1 &
  fi
  local pid=$!
  echo "$pid" > "$pid_file"
  echo "$label started (pid $pid). Log: $log_file"
}

# stop_component: label pid_file
stop_component() {
  local label="$1" pid_file="$2"
  [ -f "$pid_file" ] || { echo "$label: not running (no pid file)"; return 0; }
  local pid
  pid=$(cat "$pid_file")
  if kill -0 "$pid" 2>/dev/null; then
    echo "Stopping $label (pid $pid) ..."
    kill "$pid"
    local waited=0
    while kill -0 "$pid" 2>/dev/null && [ "$waited" -lt 30 ]; do
      sleep 1
      waited=$((waited + 1))
    done
    if kill -0 "$pid" 2>/dev/null; then
      echo "WARN: $label (pid $pid) did not stop in 30s — sending SIGKILL"
      kill -9 "$pid" 2>/dev/null || true
    fi
    rm -f "$pid_file"
    echo "$label stopped."
  else
    echo "$label: process $pid not found (stale pid file removed)"
    rm -f "$pid_file"
  fi
}

# status_component: label pid_file
status_component() {
  local label="$1" pid_file="$2"
  if [ -f "$pid_file" ]; then
    local pid
    pid=$(cat "$pid_file")
    if kill -0 "$pid" 2>/dev/null; then
      echo "$label: up (pid $pid)"
    else
      echo "$label: down (stale pid file)"
    fi
  else
    echo "$label: down"
  fi
}

# logs_component: label log_file
logs_component() {
  local label="$1" log_file="$2"
  if [ -f "$log_file" ]; then
    tail -f "$log_file"
  else
    echo "$label: no log file found at $log_file"
  fi
}

# --- Main dispatcher ---

cmd="${1:-}"
component="${2:-all}"

case "$cmd" in
  start)
    case "$component" in
      backend)
        start_component "backend" "$BACKEND_PID" "$BACKEND_LOG" "$BACKEND_CMD"
        wait_ready "$BACKEND_READY_URL" "backend"
        ;;
      tlm-stats)
        start_component "tlm-stats" "$TLMSTATS_PID" "$TLMSTATS_LOG" "$TLMSTATS_CMD"
        wait_ready "$TLMSTATS_READY_URL" "tlm-stats"
        ;;
      react)
        start_component "react" "$REACT_PID" "$REACT_LOG" "$REACT_CMD" "$REACT_DIR"
        wait_ready "$REACT_READY_URL" "react"
        ;;
      all)
        start_component "backend" "$BACKEND_PID" "$BACKEND_LOG" "$BACKEND_CMD"
        start_component "tlm-stats" "$TLMSTATS_PID" "$TLMSTATS_LOG" "$TLMSTATS_CMD"
        start_component "react" "$REACT_PID" "$REACT_LOG" "$REACT_CMD" "$REACT_DIR"
        wait_ready "$BACKEND_READY_URL" "backend"
        wait_ready "$TLMSTATS_READY_URL" "tlm-stats"
        wait_ready "$REACT_READY_URL" "react"
        ;;
      *)
        echo "Unknown component: $component. Use: backend | tlm-stats | react | all"
        exit 1
        ;;
    esac
    ;;
  stop)
    case "$component" in
      backend)
        stop_component "backend" "$BACKEND_PID"
        ;;
      tlm-stats)
        stop_component "tlm-stats" "$TLMSTATS_PID"
        ;;
      react)
        stop_component "react" "$REACT_PID"
        ;;
      all)
        stop_component "backend" "$BACKEND_PID"
        stop_component "tlm-stats" "$TLMSTATS_PID"
        stop_component "react" "$REACT_PID"
        ;;
      *)
        echo "Unknown component: $component. Use: backend | tlm-stats | react | all"
        exit 1
        ;;
    esac
    ;;
  status)
    case "$component" in
      backend)
        status_component "backend" "$BACKEND_PID"
        ;;
      tlm-stats)
        status_component "tlm-stats" "$TLMSTATS_PID"
        ;;
      react)
        status_component "react" "$REACT_PID"
        ;;
      all)
        status_component "backend" "$BACKEND_PID"
        status_component "tlm-stats" "$TLMSTATS_PID"
        status_component "react" "$REACT_PID"
        ;;
      *)
        echo "Unknown component: $component. Use: backend | tlm-stats | react | all"
        exit 1
        ;;
    esac
    ;;
  restart)
    case "$component" in
      backend)
        stop_component "backend" "$BACKEND_PID"
        start_component "backend" "$BACKEND_PID" "$BACKEND_LOG" "$BACKEND_CMD"
        wait_ready "$BACKEND_READY_URL" "backend"
        ;;
      tlm-stats)
        stop_component "tlm-stats" "$TLMSTATS_PID"
        start_component "tlm-stats" "$TLMSTATS_PID" "$TLMSTATS_LOG" "$TLMSTATS_CMD"
        wait_ready "$TLMSTATS_READY_URL" "tlm-stats"
        ;;
      react)
        stop_component "react" "$REACT_PID"
        start_component "react" "$REACT_PID" "$REACT_LOG" "$REACT_CMD" "$REACT_DIR"
        wait_ready "$REACT_READY_URL" "react"
        ;;
      all)
        stop_component "backend" "$BACKEND_PID"
        stop_component "tlm-stats" "$TLMSTATS_PID"
        stop_component "react" "$REACT_PID"
        start_component "backend" "$BACKEND_PID" "$BACKEND_LOG" "$BACKEND_CMD"
        start_component "tlm-stats" "$TLMSTATS_PID" "$TLMSTATS_LOG" "$TLMSTATS_CMD"
        start_component "react" "$REACT_PID" "$REACT_LOG" "$REACT_CMD" "$REACT_DIR"
        wait_ready "$BACKEND_READY_URL" "backend"
        wait_ready "$TLMSTATS_READY_URL" "tlm-stats"
        wait_ready "$REACT_READY_URL" "react"
        ;;
      *)
        echo "Unknown component: $component. Use: backend | tlm-stats | react | all"
        exit 1
        ;;
    esac
    ;;
  logs)
    case "$component" in
      backend)
        logs_component "backend" "$BACKEND_LOG"
        ;;
      tlm-stats)
        logs_component "tlm-stats" "$TLMSTATS_LOG"
        ;;
      react)
        logs_component "react" "$REACT_LOG"
        ;;
      *)
        echo "Unknown component: $component. Use: backend | tlm-stats | react"
        exit 1
        ;;
    esac
    ;;
  *)
    echo "Usage: $0 <start|stop|status|restart|logs> <backend|tlm-stats|react|all>"
    echo ""
    echo "Components: backend (port 6088), tlm-stats (port 8080), react (port 5173)"
    echo "Note: 'logs' does not support 'all' — specify a component."
    exit 1
    ;;
esac
