#!/usr/bin/env bash
# scripts/smoke-suggest.sh — typeahead (completion-suggester) smoke.
#
# Asserts the Option-1 fix: the ES index carries *_suggest completion fields and
# GET /api/search/suggest returns real suggestions (previously every request
# failed with search_phase_execution_exception "no mapping found for field
# [recon_suggest]").
#
# Checks:
#   1. rectrace_core_index mapping contains >=1 `completion` field.
#   2. A prefix taken from a real indexed box_name yields a non-empty,
#      well-formed JSON array of strings from the backend suggest endpoint.
#
# Prerequisites:
#   - Docker stack up (Elasticsearch on http://localhost:9200), index seeded:
#       cd ../rectrace-local-dev && .venv/bin/python apply.py --es-only
#   - Backend running on :6088.
#
# Exit codes:
#   0 — both checks passed.
#   1 — an assertion failed (see the "FAIL:" line).
set -euo pipefail

ES_URL="${ES_URL:-http://localhost:9200}"
APP_URL="${APP_URL:-http://localhost:6088/rectrace}"
INDEX="${ES_INDEX:-rectrace_core_index}"
PY="${RECTRACE_PYTHON:-python3}"

fail() { echo "FAIL: $1" >&2; exit 1; }

# --- Check 1: completion fields exist in the mapping ----------------------------
echo "[1/2] checking ${INDEX} mapping for completion fields ..."
mapping_json="$(curl -fsS "${ES_URL}/${INDEX}/_mapping" 2>/dev/null)" \
  || fail "could not read mapping from ${ES_URL}/${INDEX} (is ES up + seeded?)"

completion_count="$(printf '%s' "$mapping_json" | "$PY" -c '
import sys, json
d = json.load(sys.stdin)
props = list(d.values())[0]["mappings"]["properties"]
print(sum(1 for v in props.values() if v.get("type") == "completion"))
')"
[ "${completion_count:-0}" -ge 1 ] \
  || fail "no completion fields in ${INDEX} mapping — typeahead cannot work"
echo "      OK: ${completion_count} completion field(s) present"

# --- Check 2: live suggestions for a real prefix --------------------------------
echo "[2/2] requesting suggestions from ${APP_URL}/api/search/suggest ..."
prefix="$(curl -fsS "${ES_URL}/${INDEX}/_search?size=1&_source=box_name" \
  -H 'Content-Type: application/json' 2>/dev/null | "$PY" -c '
import sys, json
d = json.load(sys.stdin)
hits = d.get("hits", {}).get("hits", [])
src = (hits[0]["_source"].get("box_name") if hits else "") or ""
# First 3 chars make a safe completion prefix; fall back to a known seed token.
print(src[:3] if len(src) >= 3 else "BOX")
')"
[ -n "$prefix" ] || fail "could not derive a test prefix from indexed data"

resp="$(curl -fsS "${APP_URL}/api/search/suggest?prefix=${prefix}" 2>/dev/null)" \
  || fail "suggest endpoint did not return 200 (is the backend up on :6088?)"

count="$(printf '%s' "$resp" | "$PY" -c '
import sys, json
d = json.load(sys.stdin)
assert isinstance(d, list), "response is not a JSON array"
assert all(isinstance(x, str) for x in d), "array contains non-string entries"
print(len(d))
')" || fail "suggest response was not a JSON array of strings: ${resp}"

[ "${count:-0}" -ge 1 ] \
  || fail "suggest returned an empty list for prefix '${prefix}' — typeahead is not producing results"

echo "      OK: prefix '${prefix}' -> ${count} suggestion(s)"
echo "PASS: typeahead completion-suggester smoke"
