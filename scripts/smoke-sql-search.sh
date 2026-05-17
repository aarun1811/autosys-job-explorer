#!/usr/bin/env bash
# scripts/smoke-sql-search.sh — end-to-end smoke for the Phase 5 SQL-search API.
#
# Asserts:
#   - GET  /api/v4/sql-search/config         exposes the example "reconSummary" SQL tab
#   - POST /api/v4/sql-search/ssrm/reconSummary returns AG-Grid SSRM body shape
#     ({"rows": [...], "lastRow": <number>}) including the hyphenated seed row
#     RECON-XYZ-42 (Phase 0.1 seed; see 05-RESEARCH.md §Example 1).
#
# Override the target with BASE_URL; defaults to the local backend on port 6088.
# Exits non-zero with a descriptive "FAIL:" line if any assertion misses.
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:6088/rectrace}"

# 1) /config must expose the example reconSummary tab.
curl -fsS "${BASE_URL}/api/v4/sql-search/config" \
  | grep -q '"key":"reconSummary"' \
  || { echo "FAIL: reconSummary not in /config"; exit 1; }

# 2) /ssrm/reconSummary returns SSRM-shaped body — capture once, then grep separately.
RESP=$(curl -fsS -X POST "${BASE_URL}/api/v4/sql-search/ssrm/reconSummary" \
  -H 'Content-Type: application/json' \
  -d '{"startRow":0,"endRow":100,"sortModel":[],"filterModel":{}}')

# 3) Shape asserts — two independent grep -q invocations so a missing key is
#    reported precisely.
echo "$RESP" | grep -q '"rows"' \
  || { echo "FAIL: shape missing rows/lastRow"; exit 1; }
echo "$RESP" | grep -q '"lastRow"' \
  || { echo "FAIL: shape missing rows/lastRow"; exit 1; }

# 4) Seed-data assert — Phase 0.1 seed includes the hyphenated row scenario.
echo "$RESP" | grep -q 'RECON-XYZ-42' \
  || { echo "FAIL: hyphenated recon value missing"; exit 1; }

echo "OK: SQL search smoke green"
