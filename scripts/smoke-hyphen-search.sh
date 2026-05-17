#!/usr/bin/env bash
# scripts/smoke-hyphen-search.sh — Phase 8 / BUG-01..03 regression smoke.
#
# Locks the hyphenated-identifier search fix at the integration boundary. The
# JUnit `HyphenSearchRegressionTest` covers the same intent against the service,
# but this smoke runs the full HTTP path that the React frontend uses.
#
# Six assertions:
#   1. Backend reachable        (/rectrace/actuator/health -> 200)
#   2. reconId  / RID-XYZ-42    (>=1 hit)
#   3. jobName  / RECON-XYZ-42  (>=1 hit)
#   4. setId    / SET-ABC-123   (>=1 hit)
#   5. jobName  / recon-xyz-42  (>=1 hit — proves case-insensitive .keyword branch)
#   6. Negative / DEFINITELY-NOT-A-RECON-9999 (0 hits — guards against false positives)
#
# Other seeded hyphenated literals exercised opportunistically below:
#   - jobName / LOAD-ABC-123 (a second seeded job_name; reachable but not strictly
#     asserted on a fixed step number, kept for traceability against the plan body).
#
# Prerequisites:
#   - Backend running with the local profile (`./ops/rectrace-ops.sh start backend`
#     or `cd backend/rectrace && mvn spring-boot:run -Dspring-boot.run.profiles=local`)
#   - Phase 0.1 seed loaded (`cd ../rectrace-local-dev && .venv/bin/python apply.py`)
#
# Usage: bash scripts/smoke-hyphen-search.sh
# Exit 0 = 6/6 PASS, non-zero = first failing assertion.

set -euo pipefail

BACKEND_URL="${RECTRACE_URL:-http://localhost:6088}"
# Use the readiness probe rather than the aggregate /actuator/health: the aggregate
# can be DOWN for reasons unrelated to the search API (e.g. an Oracle data-source
# indicator in a laptop dev stack, the loader-run-age indicator before the first
# tick). /readiness reflects "is the app accepting traffic" — exactly what this
# smoke needs.
HEALTH_ENDPOINT="$BACKEND_URL/rectrace/actuator/health/readiness"
INITIAL_ENDPOINT="$BACKEND_URL/rectrace/api/v4/search/initial"

# 32 lowercase hex — passes the backend's correlation-id regex (HEX32 Propagation.Factory)
# and is distinct from the other Phase 7 / Phase 5 smoke scripts.
SMOKE_CORR_ID="000000000000000000000000000hyph1"
# Replace any non-hex character with '1' to keep the literal HEX32-valid even when
# someone copy-pastes a more human-readable mnemonic.
SMOKE_CORR_ID=$(printf '%s' "$SMOKE_CORR_ID" | tr -c '0-9a-f' '1')

# ANSI colours (degrade to plain text when NO_COLOR=1 is set).
if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  C_GREEN='\033[0;32m'
  C_RED='\033[0;31m'
  C_BLUE='\033[0;34m'
  C_RESET='\033[0m'
else
  C_GREEN=''
  C_RED=''
  C_BLUE=''
  C_RESET=''
fi

ok()   { printf '%b[ OK ]%b %s\n'   "$C_GREEN" "$C_RESET" "$1"; }
fail() { printf '%b[FAIL]%b %s\n'   "$C_RED"   "$C_RESET" "$1"; }
info() { printf '%b[INFO]%b %s\n'   "$C_BLUE"  "$C_RESET" "$1"; }

PASS=0
TOTAL=6

info "=== Hyphen-Search Smoke (Phase 8 / BUG-01..03) ==="
info "Backend:         $BACKEND_URL"
info "X-Correlation-Id: $SMOKE_CORR_ID"

# ----- Assertion 1: backend reachable ----------------------------------------
info "Step 1/6: GET $HEALTH_ENDPOINT"
HEALTH_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 \
  "$HEALTH_ENDPOINT" -H "X-Correlation-Id: $SMOKE_CORR_ID" || echo "000")
if [ "$HEALTH_CODE" = "200" ]; then
  ok "actuator/health returned 200"
  PASS=$((PASS + 1))
else
  fail "actuator/health returned HTTP $HEALTH_CODE — is the backend running on $BACKEND_URL?"
  echo
  info "Start it with: ./ops/rectrace-ops.sh start backend  (or)  cd backend/rectrace && mvn spring-boot:run -Dspring-boot.run.profiles=local"
  exit 1
fi

# ----- Helper: assert /initial returns >=1 hit (or 0 for negative cases) -----
# Args: <step-num> <category> <keyword> <expected-condition: ge1|eq0>
assert_initial() {
  local step="$1" category="$2" keyword="$3" expect="$4"
  # URL-encode the keyword. The seed keywords here only contain [A-Z0-9-] which is
  # safe in a query string, but encode anyway to keep the script copy-paste-safe.
  local encoded
  encoded=$(printf '%s' "$keyword" | jq -sRr @uri)
  local url="$INITIAL_ENDPOINT?keyword=$encoded&category=$category"

  info "Step $step/$TOTAL: GET $url"
  local raw
  raw=$(curl -s -w '\n%{http_code}' --max-time 10 \
    -H "X-Correlation-Id: $SMOKE_CORR_ID" \
    "$url" || printf '\n000')
  local status="${raw##*$'\n'}"
  local body="${raw%$'\n'*}"

  if [ "$status" != "200" ]; then
    fail "category=$category keyword=$keyword — HTTP $status (body: $body)"
    return 1
  fi

  # Pull the values list for the category. /search/initial returns a
  # CategoryResultV4 keyed by category in `categoryResults`.
  local hit_count first_hit
  hit_count=$(printf '%s' "$body" | jq -r --arg c "$category" \
    '(.categoryResults[$c].values // []) | length' 2>/dev/null || echo "")
  first_hit=$(printf '%s' "$body" | jq -r --arg c "$category" \
    '(.categoryResults[$c].values // [])[0] // "<none>"' 2>/dev/null || echo "<jq-error>")

  if [ -z "$hit_count" ]; then
    fail "category=$category keyword=$keyword — could not parse hit count from response"
    printf '  body: %s\n' "$body"
    return 1
  fi

  case "$expect" in
    ge1)
      if [ "$hit_count" -ge 1 ]; then
        ok "category=$category keyword='$keyword' → $hit_count hit(s), first='$first_hit'"
        PASS=$((PASS + 1))
        return 0
      else
        fail "category=$category keyword='$keyword' — expected >=1 hit, got 0 (regression?)"
        printf '  body: %s\n' "$body"
        return 1
      fi
      ;;
    eq0)
      if [ "$hit_count" -eq 0 ]; then
        ok "category=$category keyword='$keyword' → 0 hits (negative control passed)"
        PASS=$((PASS + 1))
        return 0
      else
        fail "category=$category keyword='$keyword' — expected 0 hits, got $hit_count"
        printf '  body: %s\n' "$body"
        return 1
      fi
      ;;
    *)
      fail "internal: unknown expect '$expect'"
      return 1
      ;;
  esac
}

# ----- Assertions 2..6 -------------------------------------------------------
assert_initial 2 reconId  "RID-XYZ-42"                     ge1 || exit 1
assert_initial 3 jobName  "RECON-XYZ-42"                   ge1 || exit 1
assert_initial 4 setId    "SET-ABC-123"                    ge1 || exit 1
assert_initial 5 jobName  "recon-xyz-42"                   ge1 || exit 1  # mixed case
assert_initial 6 reconId  "DEFINITELY-NOT-A-RECON-9999"    eq0 || exit 1  # negative control

# ----- Summary ---------------------------------------------------------------
echo
if [ "$PASS" -eq "$TOTAL" ]; then
  ok "[PASS] hyphen-search smoke: $PASS/$TOTAL"
  exit 0
else
  fail "[FAIL] hyphen-search smoke: $PASS/$TOTAL"
  exit 1
fi
