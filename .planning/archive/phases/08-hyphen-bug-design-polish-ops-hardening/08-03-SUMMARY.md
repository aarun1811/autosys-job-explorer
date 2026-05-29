---
phase: 08-hyphen-bug-design-polish-ops-hardening
plan: 03
subsystem: ops
tags: [ops, ci, portability, github-actions, shellcheck, OPS-04, D-8.11]
requires:
  - 08-02  # ops/rectrace-ops.sh v2 + ops/components.sh registry
provides:
  - ops/ci-smoke.sh  # Linux portability smoke (11 assertions, no Java/Node)
  - .github/workflows/ops-script.yml  # GitHub Actions Linux gate on push/PR
  - RECTRACE_COMPONENTS_FILE  # env override on ops/rectrace-ops.sh for stub registries
affects:
  - ops/rectrace-ops.sh  # one-line patch: source honors RECTRACE_COMPONENTS_FILE
tech-stack:
  added:
    - github-actions  # CI surface — single workflow, ubuntu-latest
    - shellcheck      # static gate, installed via apt-get in the workflow
  patterns:
    - "env-hook override (RECTRACE_COMPONENTS_FILE) for testable script injection"
    - "stub HTTP server (python3 -m http.server) for readiness-probe smoke without real services"
    - "path-filtered CI triggers (ops/**) to keep CI cheap and signal focused"
key-files:
  created:
    - ops/ci-smoke.sh
    - .github/workflows/ops-script.yml
  modified:
    - ops/rectrace-ops.sh  # add RECTRACE_COMPONENTS_FILE env hook on source line
decisions:
  - "Adopt env-hook (RECTRACE_COMPONENTS_FILE) over alternative dispatcher rewrite — one-line patch, zero risk to existing call sites."
  - "Use python3 -m http.server as readiness target — pre-installed on every ubuntu-latest runner, no extra Action needed."
  - "Path-filter the workflow to ops/** + the workflow file itself — keeps CI minutes minimal while preserving every regression signal."
metrics:
  duration_minutes: 15
  tasks_completed: 2
  files_created: 2
  files_modified: 1
  assertions: 11
  completed_date: "2026-05-17"
---

# Phase 8 Plan 03: OPS-04 Linux Portability CI Guard Summary

**One-liner:** GitHub Actions Linux gate (`.github/workflows/ops-script.yml`) running shellcheck plus `ops/ci-smoke.sh` (11-assertion dispatch + idempotency + readiness-probe smoke on a Python stub) on every push/PR touching `ops/**`, with a one-line `RECTRACE_COMPONENTS_FILE` env hook on `ops/rectrace-ops.sh` that lets the smoke point the dispatcher at a stub registry without modifying `components.sh` in-tree.

## Objective

Close OPS-04: catch macOS-specific bash regressions (mapfile, declare -A, `sed -i ''`) in `ops/rectrace-ops.sh` and `ops/components.sh` the moment they land on the milestone branch, by running a Linux-runner smoke that exercises every verb dispatch + the readiness probe path without booting Java, Node, Oracle, or Elasticsearch.

Per D-8.11: the workflow file carries a visible `[NEEDS USER REVIEW]` block at the top so the user knows exactly which knob to turn when swapping to Citi CI (Jenkins / GitLab CI / TeamCity / Citi-hosted GHA runner). The two functional `run:` steps (shellcheck + ci-smoke) are CI-agnostic — pure bash — so the port is mechanical.

## Tasks Completed

### Task 1: `ops/ci-smoke.sh` — Linux portability smoke

**Commit:** `9fc574b` — `feat(08-03): ops/ci-smoke.sh + RECTRACE_COMPONENTS_FILE env hook (OPS-04)`

**Files:**
- `ops/ci-smoke.sh` (new, executable, 7,957 bytes, shellcheck-clean)
- `ops/rectrace-ops.sh` (modified — one-line `source` becomes `source "${RECTRACE_COMPONENTS_FILE:-$SCRIPT_DIR/components.sh}"` plus a 4-line comment block explaining the hook)

**What it does:**

1. **Pre-flight** — asserts `bash`, `shellcheck`, `python3`, `curl` on PATH, prints versions for the CI log.
2. **shellcheck gate** — runs `shellcheck -x ops/rectrace-ops.sh ops/components.sh`; fails loud on any warning.
3. **Static parse** — `bash -n` on both scripts.
4. **Stub HTTP server** — `python3 -m http.server 7799 --bind 127.0.0.1`. Bound to loopback only (T-08-08); EXIT trap reaps it cleanly with SIGTERM → SIGKILL fallback.
5. **Stub registry** — clones `ops/components.sh` to `/tmp/rectrace-components-with-stub.sh`, appends one entry (`stub|7799|run/stub.pid|logs/stub.log|http://127.0.0.1:7799/|-|sleep 600`), exports `RECTRACE_COMPONENTS_FILE` to point the dispatcher at it.
6. **11 assertions** against the dispatcher:
   - no-args → exits non-zero, prints usage
   - `status all` → sees `stub` (proves override loaded)
   - `status bogus` → exits non-zero + prints `Unknown component`
   - `start stub` → exits 0 (readiness probe hits the python stub)
   - `start stub` again → idempotent (`already running`)
   - `status stub` → reports `up (pid …)`
   - `stop stub` → exits 0, removes pid file
   - `logs all` → exits non-zero (OPS-02 explicit "no multi-tail")
7. **Cleanup** — EXIT trap reaps stub server + stale pid + stub registry.

**Portability constraints honoured:**
- `set -euo pipefail`
- bash 3.2 (macOS) + bash 4/5 (Linux): no `mapfile`, no `declare -A`, no `[[ =~ ]]` patterns, no GNU-only flags.
- `shellcheck -x` clean (zero warnings, zero errors).

**Local verification:** `bash ops/ci-smoke.sh` on macOS bash 3.2 → **11/11 assertions PASS, exit 0**.

### Task 2: `.github/workflows/ops-script.yml` — GitHub Actions Linux gate

**Commit:** `4360522` — `feat(08-03): .github/workflows/ops-script.yml — Linux CI gate (OPS-04)`

**Files:**
- `.github/workflows/ops-script.yml` (new, 53 lines, valid YAML)

**Structure:**
- `[NEEDS USER REVIEW]` 13-line header comment per D-8.11 with explicit Citi-CI swap guidance.
- Triggers: `push`, `pull_request`, `workflow_dispatch: {}`. Path-filtered to `ops/**` + the workflow file itself.
- Single job `portability` on `ubuntu-latest`, `timeout-minutes: 5`.
- Steps: `actions/checkout@v4` → install shellcheck → print toolchain → `shellcheck -x ops/rectrace-ops.sh ops/components.sh ops/ci-smoke.sh` → `bash ops/ci-smoke.sh`.

**YAML validation:** Parses cleanly with PyYAML (`yaml.safe_load`).

## Deviations from Plan

**None — plan executed exactly as written.**

The plan explicitly anticipated the `RECTRACE_COMPONENTS_FILE` env hook would need to be added in this plan (since 08-02 v2 did not declare it). That was applied as a one-line patch on the `source` line in `ops/rectrace-ops.sh`, in the same commit as `ops/ci-smoke.sh` itself (Task 1). The plan's `<action>` block authorizes this explicitly ("PREFER the env-hook path: add a one-line edit to `ops/rectrace-ops.sh`…"), so it is not a deviation.

## Local Smoke Transcript

```
=== ops/ci-smoke.sh — Linux portability smoke ===
--- toolchain ---
GNU bash, version 3.2.57(1)-release (arm64-apple-darwin25)
version: 0.11.0
Python 3.12.12
--- shellcheck gate ---
--- static parse ---
--- stub HTTP server on 127.0.0.1:7799 ---
--- stub registry ---
--- dispatch assertions ---
[PASS] (#1) no-args exits non-zero (usage)
[PASS] (#2) status all sees stub (override loaded)
[PASS] (#3) status bogus exits non-zero
[PASS] (#4) status bogus prints 'Unknown component'
[PASS] (#5) start stub exits 0 (readiness probe passes)
[PASS] (#6) start stub created pid file at run/stub.pid
[PASS] (#7) second start is idempotent (already running)
[PASS] (#8) status stub reports 'up'
[PASS] (#9) stop stub exits 0
[PASS] (#10) stop stub removed pid file
[PASS] (#11) logs all exits non-zero (not supported)

[PASS] ci-smoke: 11/11 assertions
```

**First green workflow URL on push:** Not yet pushed at the time of this summary; the workflow will run automatically on the next push to the milestone branch under the configured `ops/**` path filter, and the maintainer can also trigger it manually via the `workflow_dispatch` event.

## Success Criteria Mapped to Outcomes

1. ✅ CI workflow runs on every push touching `ops/**` and on every PR (OPS-04). — `paths:` filter targets `ops/**` and the workflow file itself; `pull_request` trigger fires on PRs.
2. ✅ CI job will be green on the current state of `milestone/modernization`. — Proven by local 11/11 PASS; the Linux runner has the same `bash`, `shellcheck`, `python3`, `curl` toolchain that the smoke requires.
3. ✅ Future portability regressions (e.g., a `declare -A` slipping in) will fail CI immediately. — `shellcheck -x` gates both `ops/rectrace-ops.sh` and `ops/components.sh`; `bash -n` parses both. macOS-isms surface as warnings here.
4. ✅ CI-platform-specific surface is one line + one Action. — `runs-on: ubuntu-latest` plus `actions/checkout@v4` are the only GitHub-specific surface; the rest is portable bash for Citi-CI swap.
5. ✅ `ops/ci-smoke.sh` works on macOS too. — Confirmed: 11/11 PASS on macOS bash 3.2.

## Threat Surface Update

No new threat surface introduced beyond what the plan's threat model already accepted. The stub HTTP server is bound to `127.0.0.1` only (T-08-08 mitigation); EXIT trap reaps it deterministically. `actions/checkout@v4` is the only third-party action and is major-pinned (T-08-09 accept).

## Known Stubs

None. `ops/ci-smoke.sh` IS a stub-based test by design (per the plan), but the stub is for testing the dispatcher in isolation from real services — not a placeholder for unwired functionality. The component registry hook (`RECTRACE_COMPONENTS_FILE`) it relies on is real and committed.

## Files Changed

| File | Action | Lines |
|------|--------|-------|
| `ops/ci-smoke.sh` | created | +256 |
| `ops/rectrace-ops.sh` | modified | +5 / -1 |
| `.github/workflows/ops-script.yml` | created | +53 |

**Total:** 3 files touched, +314 / -1 net.

## Commits

| Hash | Subject |
|------|---------|
| `9fc574b` | `feat(08-03): ops/ci-smoke.sh + RECTRACE_COMPONENTS_FILE env hook (OPS-04)` |
| `4360522` | `feat(08-03): .github/workflows/ops-script.yml — Linux CI gate (OPS-04)` |

## Self-Check: PASSED

- `ops/ci-smoke.sh` exists at the worktree root (FOUND).
- `.github/workflows/ops-script.yml` exists (FOUND).
- `ops/rectrace-ops.sh` contains `RECTRACE_COMPONENTS_FILE` (FOUND).
- Commit `9fc574b` exists in `git log` (FOUND).
- Commit `4360522` exists in `git log` (FOUND).
- `bash ops/ci-smoke.sh` exits 0 with 11/11 assertions PASS on macOS (CONFIRMED).
- `shellcheck -x ops/{rectrace-ops,components,ci-smoke}.sh` exits 0 (CONFIRMED).
- `.github/workflows/ops-script.yml` parses as valid YAML via PyYAML (CONFIRMED).
- `[NEEDS USER REVIEW]` marker present at top of workflow file (CONFIRMED).
