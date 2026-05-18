---
phase: 02-react-foundation
plan: "04"
subsystem: ops
tags: [ops, bash, smoke-test, ssrm, correlation-id, build-pipeline]
dependency_graph:
  requires: [02-02, 02-03]
  provides: [ops/rectrace-ops.sh v1, ops/build.sh react verb, scripts/smoke-ssrm.sh, scripts/smoke-correlation-id.sh]
  affects: [backend/rectrace, rectrace-tlm-stats, frontend-react]
tech_stack:
  added: []
  patterns:
    - "pnpm-with-npm-fallback: command -v pnpm; fallback to npm run"
    - "REPO_ROOT from BASH_SOURCE[0]: robust against symlinks and different working directories"
    - "wait_ready(): poll HTTP 200 with 30s timeout, 2s interval"
    - "PID-based process lifecycle: run/<component>.pid; logs/<component>.log"
    - "T-2-05 guard: [ -z STATIC_DIR ] check before rm -rf in build.sh"
    - "CORR_ID log grep: tail -n +PRE_COUNT to only check new log lines"
key_files:
  created:
    - "ops/rectrace-ops.sh — runtime ops: start/stop/status/restart/logs for backend, tlm-stats, react (no angular)"
    - "ops/build.sh — build pipeline: react verb builds frontend-react/ and copies dist/ to backend static/"
    - "scripts/smoke-ssrm.sh — SSRM POST smoke: /rectrace/api/v4/search/ssrm/fileName, exit 0 on rows present"
    - "scripts/smoke-correlation-id.sh — Correlation ID round-trip smoke: greps backend log for CORR_ID as traceId"
  modified:
    - ".gitignore — added run/ and logs/ entries"
decisions:
  - "D-2.15 enforced: ops/rectrace-ops.sh registers exactly 3 components (backend, tlm-stats, react) — NO angular row"
  - "T-2-05 mitigated: build.sh guards STATIC_DIR non-empty before rm -rf; STATIC_DIR computed from BASH_SOURCE[0] (not $PWD)"
  - "CORR_ID values are distinct 32-char lowercase hex (Brave HEX32 compliant): 0000000000000000000000000001cafe (smoke-correlation-id.sh) and 0000000000000000000000000002cafe (smoke-ssrm.sh)"
  - "smoke-correlation-id.sh greps log for bare hex as traceId (Option B from Plan 02-02 — no separate x-correlation-id MDC key)"
metrics:
  duration: "~3 minutes"
  completed: "2026-05-13T02:55:00Z"
  tasks_completed: 2
  files_changed: 5
requirements_closed: [REACT-08]
---

# Phase 2 Plan 04: Ops Scripts and Smoke Tests Summary

**ops/rectrace-ops.sh v1 (3 components: backend, tlm-stats, react — no angular), ops/build.sh (react verb with T-2-05 guard), smoke-ssrm.sh and smoke-correlation-id.sh — all 4 scripts executable, all end-of-plan verifications pass.**

## Files Created

| File | Description |
|------|-------------|
| `ops/rectrace-ops.sh` | Runtime ops script: start/stop/status/restart/logs for backend, tlm-stats, react |
| `ops/build.sh` | Build pipeline: react verb builds frontend-react/ → copies dist/ to backend static/ |
| `scripts/smoke-ssrm.sh` | SSRM smoke: POST /rectrace/api/v4/search/ssrm/fileName; exits 0 on rows present |
| `scripts/smoke-correlation-id.sh` | Correlation ID round-trip: sends CORR_ID; greps backend log for hex value as traceId |

## Files Modified

| File | Change |
|------|--------|
| `.gitignore` | Added `run/` and `logs/` entries (runtime PID files and log files) |

## Ops Script Component Registry Confirmed (No Angular)

`ops/rectrace-ops.sh` registers exactly **3 components** as required by D-2.15:

| Component | Port | PID File | Log File | Ready URL |
|-----------|------|----------|----------|-----------|
| `backend` | 6088 | `run/backend.pid` | `logs/backend.log` | `http://localhost:6088/rectrace/actuator/health` |
| `tlm-stats` | 8080 | `run/tlmstats.pid` | `logs/tlmstats.log` | `http://localhost:8080/actuator/health` |
| `react` | 5173 | `run/react.pid` | `logs/react.log` | `http://localhost:5173/` |

**No angular component.** D-2.15 enforced: Angular is decommissioned at React go-live; there is no ops scenario requiring it.

The `grep -i "angular" ops/rectrace-ops.sh | grep -v "^#"` output is empty — 0 lines.

## T-2-05 Guard Implementation

`ops/build.sh` implements the T-2-05 guard before `rm -rf`:

```bash
# T-2-05 guard: only rm -rf the literal static/ path, not a variable that could be empty.
if [ -z "$STATIC_DIR" ]; then
  echo "ERROR: STATIC_DIR is empty. Aborting to prevent accidental deletion."
  exit 1
fi
rm -rf "$STATIC_DIR"
```

`STATIC_DIR` is computed as:
```bash
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATIC_DIR="$REPO_ROOT/backend/rectrace/src/main/resources/static"
```

`REPO_ROOT` is derived from `${BASH_SOURCE[0]}` (the script's location), not `$PWD`, preventing ambient variable injection. The guard verifies `STATIC_DIR` is non-empty before any destructive operation. The literal sub-path means `STATIC_DIR` can only ever be `$REPO_ROOT/backend/rectrace/src/main/resources/static`.

## Smoke Script Details

### smoke-ssrm.sh

- Endpoint: `POST /rectrace/api/v4/search/ssrm/fileName`
- X-Correlation-Id: `0000000000000000000000000002cafe` (32 hex chars — Brave HEX32 compliant)
- Body: `{"category":"fileName","initialFilter":null,"rowGroupCols":[],"groupKeys":[],"sortModel":[],"filterModel":{},"startRow":0,"endRow":20,"visibleColumns":[]}`
- Exit 0: response contains `"rows":` and rows array is non-empty
- Exit 1: curl fails (backend down), no `"rows":` key, or `"rows":[]` empty array

### smoke-correlation-id.sh

- CORR_ID: `0000000000000000000000000001cafe` (32 hex chars — Brave HEX32 compliant; different from SSRM script)
- Endpoint: `POST /rectrace/api/v4/search/ssrm/fileName` (same endpoint; endRow=1 for minimal data)
- Log file: `logs/backend.log` (override via `RECTRACE_LOG` env var)
- Technique: captures `PRE_COUNT=$(wc -l < $LOG_FILE)` before the request; after request + 1s sleep, greps only new log lines with `tail -n +$PRE_COUNT`
- Pattern B (Plan 02-02): Option B custom Brave Propagation.Factory adopts X-Correlation-Id as traceId. The grep pattern `(^|[^a-fA-F0-9])${CORR_ID}([^a-fA-F0-9]|$)` finds the bare hex value in the MDC `[traceId=...]` field — no separate `x-correlation-id` MDC key exists under Option B.
- Exit 0: CORR_ID hex found in new log lines
- Exit 1: HTTP ≠ 200, no log file found, or hex not found in log (with diagnostic messages)

## Smoke Script Manual Test Results

Backend not started during this plan execution (Phase 0.1 seed not running). Both scripts were **not run against a live backend** in this plan — their exit logic and argument handling are verified by inspection and automated checks only.

Automated checks that did run:
- `test -x` — both scripts are executable (PASS)
- `grep -c "ssrm/fileName"` → 3 (PASS)
- `grep -c "X-Correlation-Id"` → 7 (PASS)
- CORR_ID length: 32 chars (PASS)
- CORR_ID hex-only: matches `^[a-fA-F0-9]{32}$` (PASS)

Manual verification (when Phase 0.1 seed is running): `bash scripts/smoke-ssrm.sh` → expected "PASS: SSRM returned rows from /rectrace/api/v4/search/ssrm/fileName"

## run/ and logs/ .gitignore Status

Both directories added to root `.gitignore`:
```
run/
logs/
```
Status: **PASS** — verified by `grep -q "^run/$" .gitignore && grep -q "^logs/$"`.

## Commits

| Task | Commit | Files |
|------|--------|-------|
| Task 1: ops/rectrace-ops.sh + ops/build.sh + .gitignore | 4a36633 | 3 files (2 new scripts + .gitignore) |
| Task 2: smoke-ssrm.sh + smoke-correlation-id.sh | 0545ec1 | 2 files (2 new scripts) |

## Deviations from Plan

None — plan executed exactly as written. The plan's `<action>` blocks provided complete code for both tasks; no Rule 1/2/3/4 deviations were required.

## Known Stubs

None. The ops scripts invoke real processes; the smoke scripts hit real endpoints. If the backend or Phase 0.1 seed is not running, the scripts exit 1 with diagnostic messages — this is intended behavior, not a stub.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes introduced beyond the plan's threat model.

- T-2-05 (Tampering — `rm -rf $STATIC_DIR`): **mitigated** — guard verified present in build.sh (see above).
- T-2-02 (Injection — smoke script CORR_IDs): **accepted** — hardcoded 32-char lowercase hex values, no user input.

## Self-Check: PASSED

Files exist:
- `ops/rectrace-ops.sh` — FOUND (executable)
- `ops/build.sh` — FOUND (executable)
- `scripts/smoke-ssrm.sh` — FOUND (executable)
- `scripts/smoke-correlation-id.sh` — FOUND (executable)
- `.gitignore` — contains `run/` and `logs/`

Commits exist:
- Task 1: `4a36633` — feat(02-04): ops/rectrace-ops.sh v1 + ops/build.sh
- Task 2: `0545ec1` — feat(02-04): smoke-ssrm.sh and smoke-correlation-id.sh

End-of-plan verifications: 8/8 PASS
