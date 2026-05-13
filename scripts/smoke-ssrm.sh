#!/usr/bin/env bash
# scripts/smoke-ssrm.sh — smoke test: SSRM POST /rectrace/api/v4/search/ssrm/fileName
# Prerequisites: backend running with local profile + Phase 0.1 seed loaded
# Usage: bash scripts/smoke-ssrm.sh
# Exit 0 = PASS, Exit 1 = FAIL

BACKEND_URL="${RECTRACE_URL:-http://localhost:6088}"
ENDPOINT="$BACKEND_URL/rectrace/api/v4/search/ssrm/fileName"

# 32 lowercase hex chars — passes Brave HEX32 regex.
# Distinct from smoke-correlation-id.sh value (0000000000000000000000000001cafe)
# so log lines from the two smoke scripts are distinguishable.
SMOKE_CORR_ID="0000000000000000000000000002cafe"

REQUEST_BODY='{"category":"fileName","initialFilter":null,"rowGroupCols":[],"groupKeys":[],"sortModel":[],"filterModel":{},"startRow":0,"endRow":20,"visibleColumns":[]}'

echo "=== SSRM Smoke Test ==="
echo "Endpoint: $ENDPOINT"
echo "X-Correlation-Id: $SMOKE_CORR_ID"

RESPONSE=$(curl -sf -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "X-Correlation-Id: $SMOKE_CORR_ID" \
  -d "$REQUEST_BODY" 2>&1)

if [ $? -ne 0 ]; then
  echo "FAIL: curl request failed. Is the backend running? (ops/rectrace-ops.sh start backend)"
  exit 1
fi

ROW_COUNT=$(echo "$RESPONSE" | grep -o '"rows":\[' | wc -l | tr -d ' ')
if [ "$ROW_COUNT" -eq 0 ]; then
  echo "FAIL: Response does not contain 'rows' array. Response: $RESPONSE"
  exit 1
fi

# Verify at least 1 row returned (the Phase 0.1 seed has 5 rows)
ROWS_EMPTY=$(echo "$RESPONSE" | grep -c '"rows":\[\]' || true)
if [ "$ROWS_EMPTY" -gt 0 ]; then
  echo "FAIL: rows array is empty. Ensure Phase 0.1 seed is loaded:"
  echo "  cd ../rectrace-local-dev && python apply.py --reset"
  exit 1
fi

echo "PASS: SSRM returned rows from /rectrace/api/v4/search/ssrm/fileName"
exit 0
