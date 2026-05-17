#!/usr/bin/env bash
# scripts/smoke-ssrm.sh — end-to-end smoke test for the search API.
#
# Exercises the canonical two-step search flow:
#   1) GET  /rectrace/api/v4/search/initial?keyword=<term>
#        → returns the set of `initialFilter.values` for each category that match
#          the keyword in Elasticsearch.
#   2) POST /rectrace/api/v4/search/ssrm/fileName
#        → with the values from step 1 as `initialFilter.values`, returns the
#          actual Oracle rows for those file-name patterns.
#
# Prerequisites:
#   - Backend running with the local profile (`./ops/rectrace-ops.sh start backend`)
#   - Phase 0.1 seed loaded (`cd ../rectrace-local-dev && .venv/bin/python apply.py`)
#
# Usage: bash scripts/smoke-ssrm.sh
# Exit 0 = PASS, Exit 1 = FAIL

BACKEND_URL="${RECTRACE_URL:-http://localhost:6088}"
CONFIG_ENDPOINT="$BACKEND_URL/rectrace/api/v4/search/config"
INITIAL_ENDPOINT="$BACKEND_URL/rectrace/api/v4/search/initial"
SSRM_ENDPOINT="$BACKEND_URL/rectrace/api/v4/search/ssrm/fileName"

# 32 lowercase hex — passes the backend's HEX32 regex on the Brave
# Propagation.Factory and is distinct from smoke-correlation-id.sh.
SMOKE_CORR_ID="0000000000000000000000000002cafe"

# Keyword that the Phase 0.1 seed guarantees matches at least one file-name pattern.
# The seed loads docs whose `file_name_pattern` includes ".csv", so "csv" returns
# all three file-name-pattern values in the seed.
KEYWORD="${SMOKE_KEYWORD:-csv}"

echo "=== SSRM Smoke Test ==="
echo "Backend: $BACKEND_URL"
echo "Keyword: $KEYWORD"
echo "X-Correlation-Id: $SMOKE_CORR_ID"

# ---- Step 0: config endpoint shape (Phase 3 — config-driven principle) ---------
# Verify /api/v4/search/config returns a fileName category whose `columns`
# reference the three Phase 3 renderer string keys. If a future
# search-config-v4.json edit removes any of these keys, the React renderer
# registry will silently fall back to the default text renderer for that
# column — this smoke catches that regression at the ops gate.

echo ""
echo "Step 0: GET $CONFIG_ENDPOINT"
CONFIG_RAW=$(curl -s -w '\n%{http_code}' "$CONFIG_ENDPOINT" \
  -H "X-Correlation-Id: $SMOKE_CORR_ID" 2>&1)
CONFIG_CURL_EXIT=$?

# Portable split (BSD/macOS-compatible — same idiom as Step 1).
CONFIG_CODE="${CONFIG_RAW##*$'\n'}"
CONFIG_BODY="${CONFIG_RAW%$'\n'*}"

if [ "$CONFIG_CURL_EXIT" -ne 0 ]; then
  echo "FAIL: /config curl failed (exit $CONFIG_CURL_EXIT). Is the backend running?"
  exit 1
fi
if [ "$CONFIG_CODE" != "200" ]; then
  echo "FAIL: /config returned HTTP $CONFIG_CODE. Body: $CONFIG_BODY"
  exit 1
fi

# Assert fileName category exists in the config response.
if ! printf '%s' "$CONFIG_BODY" | grep -q '"key"[[:space:]]*:[[:space:]]*"fileName"'; then
  echo "FAIL: /config response missing fileName category"
  exit 1
fi

# Assert the three Phase 3 renderer string keys appear in the config response.
# A grep across the whole response is sufficient — search-config-v4.json only
# references each renderer key inside category column definitions.
for KEY in appIDCellRenderer supportEmailCellRenderer executionOrderButtonRenderer; do
  if ! printf '%s' "$CONFIG_BODY" | grep -q "\"cellRenderer\"[[:space:]]*:[[:space:]]*\"$KEY\""; then
    echo "FAIL: /config response missing cellRenderer \"$KEY\" — Phase 3 React registry expects this string key"
    exit 1
  fi
done

echo "Step 0 PASS — /config exposes fileName with the 3 Phase 3 renderer keys"

# ---- Step 1: keyword search → harvest fileName values --------------------------

RAW=$(curl -s -w '\n%{http_code}' "$INITIAL_ENDPOINT?keyword=$KEYWORD" \
  -H "X-Correlation-Id: $SMOKE_CORR_ID" 2>&1)
CURL_EXIT=$?

# BSD/macOS `head` does not support negative line counts (GNU-only).
# Split RAW at the final newline using parameter expansion: text after the last
# newline = status, before = body.
HTTP_STATUS="${RAW##*$'\n'}"
RESPONSE="${RAW%$'\n'*}"

if [ "$CURL_EXIT" -ne 0 ]; then
  echo "FAIL: /initial curl failed (exit $CURL_EXIT). Is the backend running?"
  exit 1
fi
if [ "$HTTP_STATUS" != "200" ]; then
  echo "FAIL: /initial returned HTTP $HTTP_STATUS. Body: $RESPONSE"
  exit 1
fi

# Extract the fileName.values array as a JSON-shaped list.
# Avoid a hard dep on jq — use a portable inline python invocation.
VALUES_JSON=$(printf '%s' "$RESPONSE" | python3 -c "
import json, sys
d = json.load(sys.stdin)
vals = (d.get('categoryResults') or {}).get('fileName', {}).get('values') or []
print(json.dumps(vals))
" 2>/dev/null)

if [ -z "$VALUES_JSON" ] || [ "$VALUES_JSON" = "[]" ]; then
  echo "FAIL: /initial?keyword=$KEYWORD returned no fileName values."
  echo "  Likely the seed isn't loaded. Run:"
  echo "    cd ../rectrace-local-dev && .venv/bin/python apply.py --reset"
  exit 1
fi

echo "Step 1 OK: fileName.values = $VALUES_JSON"

# ---- Step 2: SSRM POST with the harvested values ---------------------------------

REQUEST_BODY=$(printf '{"category":"fileName","initialFilter":{"values":%s},"rowGroupCols":[],"groupKeys":[],"sortModel":[],"filterModel":{},"startRow":0,"endRow":20,"visibleColumns":[]}' "$VALUES_JSON")

RAW=$(curl -s -w '\n%{http_code}' -X POST "$SSRM_ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "X-Correlation-Id: $SMOKE_CORR_ID" \
  -d "$REQUEST_BODY" 2>&1)
CURL_EXIT=$?

HTTP_STATUS="${RAW##*$'\n'}"
RESPONSE="${RAW%$'\n'*}"

if [ "$CURL_EXIT" -ne 0 ]; then
  echo "FAIL: SSRM curl failed (exit $CURL_EXIT)."
  exit 1
fi
if [ "$HTTP_STATUS" != "200" ]; then
  echo "FAIL: SSRM returned HTTP $HTTP_STATUS. Body: $RESPONSE"
  exit 1
fi

# Confirm a non-empty rows array via portable JSON parsing.
ROW_COUNT=$(printf '%s' "$RESPONSE" | python3 -c "
import json, sys
d = json.load(sys.stdin)
print(len(d.get('rows') or []))
" 2>/dev/null)

if [ -z "$ROW_COUNT" ] || [ "$ROW_COUNT" -eq 0 ] 2>/dev/null; then
  echo "FAIL: SSRM rows array is empty. Body: $RESPONSE"
  exit 1
fi

echo "PASS: SSRM returned $ROW_COUNT row(s) from /rectrace/api/v4/search/ssrm/fileName"
exit 0
