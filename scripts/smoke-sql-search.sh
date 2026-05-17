#!/usr/bin/env bash
# scripts/smoke-sql-search.sh — end-to-end smoke for the Phase 5 SQL-search API.
#
# Asserts (6 total):
#   1. GET  /api/v4/sql-search/config           exposes the example "reconSummary" SQL tab.
#   2. POST /api/v4/sql-search/ssrm/reconSummary returns AG-Grid SSRM body shape
#      ({"rows": [...], "lastRow": <number>}).
#   3. Response body contains the hyphenated seed value RECON-XYZ-42
#      (Phase 0.1 seed scenario 4; see ../rectrace-local-dev/data/scenarios.md).
#   4. rows[0] keys are all lowercase (config-driven contract — AG-Grid column field
#      names match Oracle column names verbatim and Oracle returns uppercase by default;
#      SqlQueryServiceV4 lowercases keys before serialization).
#   5. POST /api/v4/sql-search/ssrm/nope-not-a-tab          → 400 + error_type=UNKNOWN_TAB.
#   6. POST /api/v4/sql-search/ssrm/reconSummary with a
#      malicious sortModel colId ("DROP TABLE x")           → 400 + error_type=INVALID_REQUEST.
#
# Prerequisites:
#   - Docker stack up (Oracle + Elasticsearch healthy):
#       cd ../rectrace-local-dev && docker compose up -d
#   - Seed applied (idempotent; ensures GRANT SELECT on rectrace.rectrace_core to
#     rectrace_readonly and re-loads the 5 seed rows):
#       cd ../rectrace-local-dev && .venv/bin/python apply.py
#   - Backend running with the local profile:
#       ./ops/rectrace-ops.sh start backend
#
# Override the target with BASE_URL; defaults to the local backend on port 6088.
# Exits non-zero with a descriptive "FAIL:" line if any assertion misses.
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:6088/rectrace}"

# Assertion 1) /config must expose the example reconSummary tab.
# Whitespace-tolerant grep — Jackson may serialize as either
# `"key":"reconSummary"` or `"key": "reconSummary"` depending on
# ObjectMapper config; the Plan 05 controller uses default which omits
# the space, but this regex handles both for forward-compat.
curl -fsS "${BASE_URL}/api/v4/sql-search/config" \
  | grep -Eq '"key"[[:space:]]*:[[:space:]]*"reconSummary"' \
  || { echo "FAIL: reconSummary not in /config"; exit 1; }

# Assertion 2) /ssrm/reconSummary returns SSRM-shaped body — capture once, then grep separately.
RESP=$(curl -fsS -X POST "${BASE_URL}/api/v4/sql-search/ssrm/reconSummary" \
  -H 'Content-Type: application/json' \
  -d '{"startRow":0,"endRow":100,"sortModel":[],"filterModel":{}}')

# Shape asserts — two independent grep -q invocations so a missing key is
# reported precisely.
echo "$RESP" | grep -q '"rows"' \
  || { echo "FAIL: shape missing rows"; exit 1; }
echo "$RESP" | grep -q '"lastRow"' \
  || { echo "FAIL: shape missing lastRow"; exit 1; }

# Assertion 3) Seed-data assert — Phase 0.1 seed scenario 4 includes the
# hyphenated `RECON-XYZ-42` value (lives in `job_name`, which is one of the
# six columns selected by sql-search-config-v4.json#reconSummary).
echo "$RESP" | grep -q 'RECON-XYZ-42' \
  || { echo "FAIL: hyphenated RECON-XYZ-42 value missing"; exit 1; }

# Assertion 4) rows[0] keys must all be lowercase. Oracle returns column names
# uppercase by default; SqlQueryServiceV4 lowercases them for the SSRM payload
# so AG-Grid colDef `field` values (lowercase in sql-search-config-v4.json)
# bind correctly. A regression here breaks every config-driven SQL tab silently.
echo "$RESP" | python3 -c "
import json, sys
d = json.load(sys.stdin)
rows = d.get('rows') or []
assert rows, 'no rows returned'
bad = [k for k in rows[0].keys() if k != k.lower()]
assert not bad, 'uppercase keys present in rows[0]: ' + ','.join(bad)
" >/dev/null 2>&1 \
  || { echo "FAIL: row keys not all lowercase"; exit 1; }

# Assertion 5) Negative — unknown tabKey returns 400 with error_type=UNKNOWN_TAB.
# Capture body + status in one curl to keep the assertion compact and avoid race-y
# back-to-back probes.
HTTP_CODE=$(curl -s -o /tmp/sql-smoke-resp.json -w '%{http_code}' \
  -X POST "${BASE_URL}/api/v4/sql-search/ssrm/nope-not-a-tab" \
  -H 'Content-Type: application/json' \
  -d '{"startRow":0,"endRow":10,"sortModel":[],"filterModel":{}}')
if [ "$HTTP_CODE" != "400" ]; then
  echo "FAIL: unknown tabKey expected HTTP 400, got $HTTP_CODE"
  exit 1
fi
grep -q '"error_type"[[:space:]]*:[[:space:]]*"UNKNOWN_TAB"' /tmp/sql-smoke-resp.json \
  || { echo "FAIL: unknown tabKey response missing error_type=UNKNOWN_TAB"; exit 1; }

# Assertion 6) Negative — malicious sortModel colId returns 400 with
# error_type=INVALID_REQUEST. The Plan 05 SqlQueryServiceV4 whitelists sort
# columns against the configured `columns[].field` list; anything else is
# rejected with an IllegalArgumentException the controller maps to 400.
HTTP_CODE=$(curl -s -o /tmp/sql-smoke-resp.json -w '%{http_code}' \
  -X POST "${BASE_URL}/api/v4/sql-search/ssrm/reconSummary" \
  -H 'Content-Type: application/json' \
  -d '{"startRow":0,"endRow":10,"sortModel":[{"colId":"DROP TABLE x","sort":"asc"}],"filterModel":{}}')
if [ "$HTTP_CODE" != "400" ]; then
  echo "FAIL: malicious colId expected HTTP 400, got $HTTP_CODE"
  exit 1
fi
grep -q '"error_type"[[:space:]]*:[[:space:]]*"INVALID_REQUEST"' /tmp/sql-smoke-resp.json \
  || { echo "FAIL: malicious colId response missing error_type=INVALID_REQUEST"; exit 1; }

echo "OK: SQL search smoke green"
