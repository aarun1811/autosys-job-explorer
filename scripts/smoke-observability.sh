#!/usr/bin/env bash
# scripts/smoke-observability.sh — Phase 7 observability smoke test.
#
# Exercises the live Phase 7 observability surface end-to-end against a
# running backend (default http://localhost:6088, configurable via
# RECTRACE_URL) and, when reachable, the rectrace-tlm-stats sibling
# service (default http://localhost:8080, configurable via TLM_URL).
#
# Phase-7 requirement coverage:
#   OBS-01 — JSON log shape: indirect, via correlation-id round-trip
#            asserting the literal X-Correlation-Id appears in
#            logs/backend.log as the traceId MDC value.
#   OBS-02 — HealthIndicator beans: asserts /actuator/health returns
#            200 and {"status":"UP"} anonymously; loader health group
#            (if exposed) returns components.loaderRunAge.
#   OBS-03 — Actuator exposure lockdown: asserts /actuator/ links list
#            does NOT include env, heapdump, shutdown, beans,
#            configprops, threaddump, scheduledtasks.
#   OBS-05 — Prometheus metrics: asserts /actuator/prometheus returns
#            text/plain and the body includes http_server_requests
#            and jvm_memory_used metrics.
#   OBS-06 — Correlation-ID propagation: a 32-hex X-Correlation-Id
#            sent to /api/v4/search/initial appears verbatim in the
#            most recent backend log line.
#   OBS-08 — Maven enforcer Micrometer pin: --enforcer mode runs
#            `mvn validate` on backend/rectrace and asserts all three
#            enforce-micrometer-* executions appear in the log.
#
# Prerequisites:
#   - Backend running with local profile:
#       ops/rectrace-ops.sh start backend
#   - (optional) rectrace-tlm-stats running:
#       ops/rectrace-ops.sh start tlm-stats
#   - openssl available (for 32-hex correlation-id generation)
#   - jq available (for JSON assertions)
#
# Usage:
#   bash scripts/smoke-observability.sh                # live-endpoint smoke
#   bash scripts/smoke-observability.sh --enforcer     # also exercise mvn enforcer
#
# Exit 0 = PASS, exit 1 = FAIL. WARN-level gaps (loader group not
# exposed in local profile, no logs/ directory present) print a
# WARN line but do not fail.
#
# Bash 3.2-compatible: no associative arrays, no mapfile, no ${var,,}
# lowercasing, no `local -n` namerefs. Passes shellcheck.

set -euo pipefail

# ------------------------------------------------------------------
# Configuration
# ------------------------------------------------------------------

BASE="${RECTRACE_URL:-http://localhost:6088}/rectrace"
TLM_BASE="${TLM_URL:-http://localhost:8080}"
LOG_FILE="${RECTRACE_LOG:-logs/backend.log}"

FAILED=0
WARNED=0

# Banned exposure keys per OBS-03 lockdown contract.
BANNED_EXPOSURE_KEYS="env heapdump shutdown beans configprops threaddump scheduledtasks"

# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

print_header() {
    echo ""
    echo "=== $1 ==="
}

fail() {
    echo "FAIL: $*"
    FAILED=$((FAILED + 1))
}

pass() {
    echo "PASS: $*"
}

warn() {
    echo "WARN: $*"
    WARNED=$((WARNED + 1))
}

require_tool() {
    if ! command -v "$1" >/dev/null 2>&1; then
        echo "FATAL: required tool not on PATH: $1"
        exit 1
    fi
}

# ------------------------------------------------------------------
# Section 1 — Actuator exposure (OBS-03)
# ------------------------------------------------------------------

check_actuator_exposure() {
    print_header "Section 1 — Actuator exposure lockdown (OBS-03)"

    local body
    if ! body=$(curl -fsS -m 5 "$BASE/actuator" 2>&1); then
        fail "GET $BASE/actuator failed (is the backend running?)"
        echo "  curl output: $body"
        return
    fi

    # Allowed keys per application.properties exposure include list
    # (health,info,prometheus,loggers,metrics) plus the self link.
    # /actuator/health/{group} sub-links also show when groups are
    # configured. The contract is: NONE of the banned keys may be
    # present in the _links map.
    local k
    for k in $BANNED_EXPOSURE_KEYS; do
        if printf '%s' "$body" | jq -e --arg k "$k" '._links | has($k)' >/dev/null 2>&1; then
            fail "/actuator exposes banned key '$k' — OBS-03 lockdown violated"
            return
        fi
    done

    # Sanity check: the five intended endpoints are present.
    local expected
    for expected in health prometheus loggers metrics; do
        if ! printf '%s' "$body" | jq -e --arg k "$expected" '._links | has($k)' >/dev/null 2>&1; then
            fail "/actuator missing expected key '$expected'"
            return
        fi
    done

    pass "Section 1 — /actuator exposes only the OBS-03 allowed endpoints"
}

# ------------------------------------------------------------------
# Section 2 — Default /actuator/health (OBS-02)
# ------------------------------------------------------------------

check_health_default() {
    print_header "Section 2 — Default /actuator/health (OBS-02)"

    local http_code
    http_code=$(curl -sS -m 5 -o /tmp/p7-health.json -w '%{http_code}' "$BASE/actuator/health" || echo "000")
    if [ "$http_code" != "200" ]; then
        fail "/actuator/health returned HTTP $http_code (expected 200)"
        return
    fi

    if ! jq -e '.status == "UP"' /tmp/p7-health.json >/dev/null 2>&1; then
        local status
        status=$(jq -r '.status // "<missing>"' /tmp/p7-health.json 2>/dev/null || echo "<unparsable>")
        fail "/actuator/health status is '$status' (expected 'UP')"
        return
    fi

    # show-details=when-authorized means anonymous requests get just
    # {"status":"UP"} — no components, no groups. If components leaks,
    # the lockdown is broken.
    if jq -e '.components | length > 0' /tmp/p7-health.json >/dev/null 2>&1; then
        fail "/actuator/health leaks components anonymously — show-details lockdown violated"
        return
    fi

    pass "Section 2 — /actuator/health returns 200 UP, components hidden anonymously"
}

# ------------------------------------------------------------------
# Section 3 — Loader health group (OBS-02)
# ------------------------------------------------------------------

check_health_loader_group() {
    print_header "Section 3 — Loader health group (OBS-02)"

    local http_code
    http_code=$(curl -sS -m 5 -o /tmp/p7-loader.json -w '%{http_code}' "$BASE/actuator/health/loader" || echo "000")

    case "$http_code" in
        200)
            if jq -e '.components.loaderRunAge.status' /tmp/p7-loader.json >/dev/null 2>&1; then
                local s
                s=$(jq -r '.components.loaderRunAge.status' /tmp/p7-loader.json)
                pass "Section 3 — /actuator/health/loader returns 200, loaderRunAge.status=$s"
            else
                fail "/actuator/health/loader 200 but components.loaderRunAge.status missing"
            fi
            ;;
        404)
            # Loader group declared in test profile only — local profile
            # inherits the base exposure list which does not configure
            # the group. Treat as a deferred-feature WARN per env-gap policy.
            warn "Section 3 — /actuator/health/loader returns 404 (loader group not exposed in this profile — see application-test.properties for the wiring; gap documented in 07-05-SUMMARY.md)"
            ;;
        *)
            fail "/actuator/health/loader returned HTTP $http_code (expected 200 or 404)"
            ;;
    esac
}

# ------------------------------------------------------------------
# Section 4 — Prometheus endpoint (OBS-05)
# ------------------------------------------------------------------

check_prometheus() {
    print_header "Section 4 — Prometheus endpoint (OBS-05)"

    local http_code
    http_code=$(curl -sS -m 5 -D /tmp/p7-prom.headers -o /tmp/p7-prom.body -w '%{http_code}' "$BASE/actuator/prometheus" || echo "000")

    if [ "$http_code" != "200" ]; then
        fail "/actuator/prometheus returned HTTP $http_code (expected 200)"
        return
    fi

    # Content-Type must start with text/plain (the OpenMetrics
    # text format MIME). grep -i for header-name case insensitivity.
    if ! grep -i '^content-type:' /tmp/p7-prom.headers | grep -q 'text/plain'; then
        local ct
        ct=$(grep -i '^content-type:' /tmp/p7-prom.headers | head -1 | tr -d '\r')
        fail "/actuator/prometheus Content-Type is '$ct' (expected text/plain)"
        return
    fi

    # Two required metric families: HTTP server request timing
    # (proves Micrometer is collecting the WebMvc instrumentation)
    # AND JVM memory (proves the JVM auto-instrumentation is wired).
    local missing=""
    if ! grep -qE '^http_server_requests_seconds_count' /tmp/p7-prom.body; then
        missing="$missing http_server_requests_seconds_count"
    fi
    if ! grep -qE '^jvm_memory_used_bytes' /tmp/p7-prom.body; then
        missing="$missing jvm_memory_used_bytes"
    fi

    if [ -n "$missing" ]; then
        fail "/actuator/prometheus body missing required metric family/families:$missing"
        return
    fi

    pass "Section 4 — /actuator/prometheus returns text/plain with http_server_requests + jvm_memory metrics"
}

# ------------------------------------------------------------------
# Section 5 — Correlation-ID propagation (OBS-06)
# ------------------------------------------------------------------

check_correlation_id_propagation() {
    print_header "Section 5 — Correlation-ID propagation (OBS-06)"

    if ! command -v openssl >/dev/null 2>&1; then
        warn "openssl not on PATH — skipping correlation-id propagation check"
        return
    fi

    local tid
    tid=$(openssl rand -hex 16)  # 32 lowercase hex chars
    local endpoint="$BASE/api/v4/search/initial?keyword=smoke"

    local pre_count
    if [ -f "$LOG_FILE" ]; then
        pre_count=$(( $(wc -l < "$LOG_FILE") + 1 ))
    else
        warn "Log file '$LOG_FILE' not found — backend may be running via stdout instead of ops/rectrace-ops.sh; skipping log assertion"
        # Still send the request so we don't silently mask total breakage.
        local hc
        hc=$(curl -sS -m 5 -o /dev/null -w '%{http_code}' -H "X-Correlation-Id: $tid" "$endpoint" || echo "000")
        if [ "$hc" != "200" ]; then
            fail "Correlation-id request to $endpoint returned HTTP $hc (expected 200)"
            return
        fi
        echo "  (request to $endpoint succeeded but log file not available to verify MDC propagation)"
        return
    fi

    local hc
    hc=$(curl -sS -m 5 -o /dev/null -w '%{http_code}' -H "X-Correlation-Id: $tid" "$endpoint" || echo "000")
    if [ "$hc" != "200" ]; then
        fail "Correlation-id request returned HTTP $hc (expected 200)"
        return
    fi

    # Brief settle for log flush.
    sleep 1

    local matches
    matches=$(tail -n +"$pre_count" "$LOG_FILE" 2>/dev/null | grep -cE "(^|[^a-fA-F0-9])${tid}([^a-fA-F0-9]|$)" || true)
    if [ "$matches" -gt 0 ] 2>/dev/null; then
        pass "Section 5 — X-Correlation-Id '$tid' propagated to MDC (found $matches log line(s))"
    else
        fail "X-Correlation-Id '$tid' NOT found in $LOG_FILE — Brave Propagation.Factory may be misconfigured"
    fi
}

# ------------------------------------------------------------------
# Section 6 — TLM-stats parity (OBS-02/03/05 sibling service)
# ------------------------------------------------------------------

check_tlm_stats() {
    print_header "Section 6 — rectrace-tlm-stats parity"

    local actuator_body
    if ! actuator_body=$(curl -fsS -m 3 "$TLM_BASE/actuator" 2>/dev/null); then
        echo "SKIP: rectrace-tlm-stats not reachable at $TLM_BASE/actuator (start with: ops/rectrace-ops.sh start tlm-stats)"
        return
    fi

    # Exposure lockdown
    local k
    for k in $BANNED_EXPOSURE_KEYS; do
        if printf '%s' "$actuator_body" | jq -e --arg k "$k" '._links | has($k)' >/dev/null 2>&1; then
            fail "tlm-stats /actuator exposes banned key '$k'"
            return
        fi
    done

    # Health default
    local hc
    hc=$(curl -sS -m 5 -o /tmp/p7-tlm-health.json -w '%{http_code}' "$TLM_BASE/actuator/health" || echo "000")
    if [ "$hc" != "200" ]; then
        fail "tlm-stats /actuator/health returned HTTP $hc"
        return
    fi
    if ! jq -e '.status == "UP"' /tmp/p7-tlm-health.json >/dev/null 2>&1; then
        fail "tlm-stats /actuator/health not UP"
        return
    fi

    # Prometheus presence + content-type
    local phc
    phc=$(curl -sS -m 5 -D /tmp/p7-tlm-prom.headers -o /tmp/p7-tlm-prom.body -w '%{http_code}' "$TLM_BASE/actuator/prometheus" || echo "000")
    if [ "$phc" != "200" ]; then
        fail "tlm-stats /actuator/prometheus returned HTTP $phc"
        return
    fi
    if ! grep -i '^content-type:' /tmp/p7-tlm-prom.headers | grep -q 'text/plain'; then
        fail "tlm-stats /actuator/prometheus wrong Content-Type"
        return
    fi
    if ! grep -qE '^jvm_memory_used_bytes' /tmp/p7-tlm-prom.body; then
        fail "tlm-stats /actuator/prometheus missing jvm_memory_used_bytes"
        return
    fi

    pass "Section 6 — tlm-stats actuator surface (exposure + health + prometheus) matches contract"
}

# ------------------------------------------------------------------
# Section 7 — --enforcer mode (OBS-08)
# ------------------------------------------------------------------

check_enforcer() {
    print_header "Section 7 — Maven enforcer Micrometer pin (OBS-08)"

    if ! command -v mvn >/dev/null 2>&1; then
        warn "mvn not on PATH — skipping enforcer check"
        return
    fi

    local repo_root
    repo_root=$(cd "$(dirname "$0")/.." && pwd)
    if [ ! -d "$repo_root/backend/rectrace" ]; then
        fail "Cannot locate backend/rectrace from script directory"
        return
    fi

    local log=/tmp/p7-05-enforcer-smoke.log
    (cd "$repo_root/backend/rectrace" && mvn -B validate > "$log" 2>&1) || {
        fail "mvn validate failed unexpectedly — see $log"
        return
    }

    # All three executions must appear in the log.
    local missing=""
    local exec_id
    for exec_id in enforce-micrometer-ceiling enforce-micrometer-core-convergence enforce-micrometer-tracing-convergence; do
        if ! grep -q "$exec_id" "$log"; then
            missing="$missing $exec_id"
        fi
    done
    if [ -n "$missing" ]; then
        fail "mvn validate log missing enforcer execution(s):$missing"
        return
    fi

    pass "Section 7 — All three enforce-micrometer-* executions fired during mvn validate"
}

# ------------------------------------------------------------------
# Entry point
# ------------------------------------------------------------------

main() {
    require_tool curl
    require_tool jq

    echo "=== Phase 7 Observability Smoke ==="
    echo "Backend base : $BASE"
    echo "TLM-stats    : $TLM_BASE"
    echo "Log file     : $LOG_FILE"

    check_actuator_exposure
    check_health_default
    check_health_loader_group
    check_prometheus
    check_correlation_id_propagation
    check_tlm_stats

    if [ "${1:-}" = "--enforcer" ]; then
        check_enforcer
    fi

    echo ""
    echo "=== Summary ==="
    echo "Failures : $FAILED"
    echo "Warnings : $WARNED"

    if [ "$FAILED" -gt 0 ]; then
        echo "RESULT: FAIL"
        exit 1
    fi
    echo "RESULT: PASS"
    exit 0
}

main "$@"
