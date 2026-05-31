#!/usr/bin/env bash
# scripts/smoke-loader-admin.sh — LOADER-08 admin endpoint shape smoke.
#
# Asserts the three admin endpoints return the expected JSON shapes against the live
# local-dev stack:
#   1. GET  /api/v4/loader-admin/jobs                          → 200 + [{key, alias, ...}]
#   2. POST /api/v4/loader-admin/jobs/rectrace_core_loader/run-now → 200 + SUCCESS|FAILED record
#   3. GET  /api/v4/loader-admin/jobs/rectrace_core_loader/runs    → 200 + non-empty array
#   4. POST /api/v4/loader-admin/jobs/unknown-job/run-now       → 404 + error_type=UNKNOWN_JOB
#   5. GET  /api/v4/loader-admin/jobs/unknown-job/runs          → 404 + error_type=UNKNOWN_JOB
#   6. GET  ${ES_URL}/_alias/rectrace_core_alias               → alias maps to a backing index
#
# Prerequisites:
#   - Docker stack up: cd ../rectrace-local-dev && docker compose up -d
#   - Seed applied:   cd ../rectrace-local-dev && .venv/bin/python apply.py
#   - Loader running on :6089 (ops script): ./ops/rectrace-ops.sh start loader
#
# Exit codes:
#   0 — all 6 assertions green.
#   1 — any assertion missed; see "FAIL:" line for the failing endpoint.
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:6089}"
ES_URL="${ES_URL:-http://localhost:9200}"
JOB_KEY="rectrace_core_loader"
ALIAS="rectrace_core_alias"
RESP_TMP="/tmp/loader-admin-smoke-$$.json"

cleanup() { rm -f "$RESP_TMP"; }
trap cleanup EXIT

# Assertion 1) GET /jobs lists the configured rectrace_core_loader with its alias.
RESP=$(curl -fsS "${BASE_URL}/api/v4/loader-admin/jobs")
echo "$RESP" | grep -Eq "\"key\"[[:space:]]*:[[:space:]]*\"${JOB_KEY}\"" \
  || { echo "FAIL: GET /jobs missing key=${JOB_KEY}"; echo "$RESP"; exit 1; }
echo "$RESP" | grep -Eq "\"alias\"[[:space:]]*:[[:space:]]*\"${ALIAS}\"" \
  || { echo "FAIL: GET /jobs missing alias=${ALIAS}"; echo "$RESP"; exit 1; }

# Assertion 2) POST run-now returns 200 + a SUCCESS|FAILED record.
RESP=$(curl -fsS -X POST "${BASE_URL}/api/v4/loader-admin/jobs/${JOB_KEY}/run-now" --max-time 60)
echo "$RESP" | grep -Eq '"status"[[:space:]]*:[[:space:]]*"(SUCCESS|FAILED)"' \
  || { echo "FAIL: POST run-now did not return a terminal status"; echo "$RESP"; exit 1; }

# Assertion 3) GET /runs returns a non-empty array with the expected jobKey/startedAt fields.
RESP=$(curl -fsS "${BASE_URL}/api/v4/loader-admin/jobs/${JOB_KEY}/runs")
echo "$RESP" | grep -Eq "\"jobKey\"[[:space:]]*:[[:space:]]*\"${JOB_KEY}\"" \
  || { echo "FAIL: GET /runs missing jobKey field"; echo "$RESP"; exit 1; }
echo "$RESP" | grep -q '"startedAt"' \
  || { echo "FAIL: GET /runs missing startedAt field"; echo "$RESP"; exit 1; }

# Assertion 4) POST run-now for unknown job returns 404 + UNKNOWN_JOB.
HTTP_CODE=$(curl -s -o "$RESP_TMP" -w '%{http_code}' \
  -X POST "${BASE_URL}/api/v4/loader-admin/jobs/unknown-job/run-now")
if [ "$HTTP_CODE" != "404" ]; then
  echo "FAIL: unknown-job run-now expected 404, got $HTTP_CODE"
  cat "$RESP_TMP"
  exit 1
fi
grep -q '"error_type"[[:space:]]*:[[:space:]]*"UNKNOWN_JOB"' "$RESP_TMP" \
  || { echo "FAIL: unknown-job run-now missing error_type=UNKNOWN_JOB"; cat "$RESP_TMP"; exit 1; }

# Assertion 5) GET /runs for unknown job returns 404 + UNKNOWN_JOB.
HTTP_CODE=$(curl -s -o "$RESP_TMP" -w '%{http_code}' \
  "${BASE_URL}/api/v4/loader-admin/jobs/unknown-job/runs")
if [ "$HTTP_CODE" != "404" ]; then
  echo "FAIL: unknown-job GET /runs expected 404, got $HTTP_CODE"
  cat "$RESP_TMP"
  exit 1
fi
grep -q '"error_type"[[:space:]]*:[[:space:]]*"UNKNOWN_JOB"' "$RESP_TMP" \
  || { echo "FAIL: unknown-job GET /runs missing error_type=UNKNOWN_JOB"; cat "$RESP_TMP"; exit 1; }

# Assertion 6) ES alias is live (independent confirmation of LOADER-03 alias bootstrap).
curl -fsS "${ES_URL}/_alias/${ALIAS}" | grep -q "${ALIAS}" \
  || { echo "FAIL: ES alias ${ALIAS} not present"; exit 1; }

echo "PASS: loader admin smoke green"
