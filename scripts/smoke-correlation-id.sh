#!/usr/bin/env bash
# scripts/smoke-correlation-id.sh — smoke test: X-Correlation-Id round-trip
# Sends a known X-Correlation-Id to the backend and verifies it appears in the log output.
# Prerequisites: backend running with local profile (log file at logs/backend.log)
# Usage: bash scripts/smoke-correlation-id.sh
# Exit 0 = PASS, Exit 1 = FAIL

BACKEND_URL="${RECTRACE_URL:-http://localhost:6088}"

# Exactly 32 lowercase hex chars — passes Brave Propagation.Factory HEX32 regex.
# Under Option B (Plan 02-02), the custom factory adopts this value as the backend
# 128-bit traceId, so it appears verbatim in the [traceId=...] MDC field written by
# logback-spring.xml.
#
# IMPORTANT: the high 64 bits MUST be non-zero. Brave's TraceContext.traceIdString()
# omits leading-zero high bits and renders the ID as only the low 16 chars when
# traceIdHigh == 0. Real `crypto.randomUUID()` IDs from the React fetch wrapper have
# non-zero high bits, so this test value is shaped to exercise the realistic path.
# Different from smoke-ssrm.sh value (0000000000000000000000000002cafe) so log lines
# from the two smoke scripts are distinguishable.
CORR_ID="ca570f1deadbeef000000000000001cafe"
# Trim to exactly 32 chars (in case of typo above):
CORR_ID="${CORR_ID:0:32}"
ENDPOINT="$BACKEND_URL/rectrace/api/v4/search/initial?keyword=trade"
LOG_FILE="${RECTRACE_LOG:-logs/backend.log}"

echo "=== Correlation ID Smoke Test ==="
echo "Sending X-Correlation-Id: $CORR_ID"
echo "Log file: $LOG_FILE"

# Capture log line count before the request.
# Add 1 so tail -n +N starts at the first line AFTER all existing content.
# Without +1, tail -n +PRE_COUNT re-reads the final pre-existing line, which
# could contain a prior run's CORR_ID and cause a false PASS.
if [ -f "$LOG_FILE" ]; then
  PRE_COUNT=$(( $(wc -l < "$LOG_FILE") + 1 ))
else
  echo "WARN: $LOG_FILE not found. Start backend with: ops/rectrace-ops.sh start backend"
  PRE_COUNT=1
fi

# Send GET request to /initial (the controller's log statement is at INFO level,
# so a log line is guaranteed to emit; the SSRM endpoint logs at DEBUG which
# default INFO log level suppresses).
HTTP_STATUS=$(curl -s -o /dev/null -w '%{http_code}' "$ENDPOINT" \
  -H "X-Correlation-Id: $CORR_ID")

if [ "$HTTP_STATUS" != "200" ]; then
  echo "FAIL: HTTP $HTTP_STATUS from backend. Is the backend running?"
  echo "  Start with: ops/rectrace-ops.sh start backend"
  exit 1
fi

# Wait briefly for log to flush
sleep 1

# Grep log for the literal CORR_ID hex value in the traceId MDC field.
# Under Option B (Plan 02-02), the custom Brave Propagation.Factory adopts the
# X-Correlation-Id header as the 128-bit traceId; logback-spring.xml writes it
# as [traceId=<hex>]. No separate x-correlation-id MDC key is written.
if [ -f "$LOG_FILE" ]; then
  MATCHES=$(tail -n +"$PRE_COUNT" "$LOG_FILE" 2>/dev/null | grep -cE "(^|[^a-fA-F0-9])${CORR_ID}([^a-fA-F0-9]|$)" || true)
  if [ "$MATCHES" -gt 0 ]; then
    echo "PASS: Found X-Correlation-Id '$CORR_ID' in backend log as traceId ($MATCHES occurrence(s))"
    exit 0
  else
    echo "FAIL: '$CORR_ID' not found in backend log after request."
    echo "Check that CorrelationIdPropagationConfig is loaded:"
    echo "  management.tracing.sampling.probability=1.0 in application-local.properties"
    echo "Check that logback-spring.xml pattern includes %X{traceId:-}"
    echo "  (Option B — traceId IS the X-Correlation-Id hex)"
    exit 1
  fi
else
  echo "WARN: No log file found at $LOG_FILE. Cannot verify log correlation."
  echo "If backend is running via mvn directly (not ops/rectrace-ops.sh), logs go to stdout."
  echo "Consider running: ops/rectrace-ops.sh start backend && bash scripts/smoke-correlation-id.sh"
  exit 1
fi
