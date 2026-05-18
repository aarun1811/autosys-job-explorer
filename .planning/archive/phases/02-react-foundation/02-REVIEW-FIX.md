---
phase: 02-react-foundation
fixed_at: 2026-05-13T11:00:00Z
status: all_fixed
fix_scope: all
findings_in_scope: 17
fixed: 14
skipped: 3
iteration: 1
review_path: .planning/phases/02-react-foundation/02-REVIEW.md
review_commit: 4293961
---

# Phase 02 — Code Review Fix Report

Source review: [02-REVIEW.md](./02-REVIEW.md) (commit `4293961`, 4 Critical / 8 Warning / 5 Info).
Fix scope: **all** (Critical + Warning + Info).

## Fixes Applied (14 findings across 13 commits)

| Finding | Severity | Commit | Description |
|---------|----------|--------|-------------|
| CR-01 | Critical | `ba55d21` | `frontend-react/src/components/ui/sonner.tsx` — replace `next-themes` import with project `useTheme` from `@/components/layout/theme-provider`. Unblocks `pnpm build`. |
| CR-02 | Critical | `5eaf591` | `ops/build.sh` — add `set -euo pipefail` + dual STATIC_DIR guard (non-empty AND prefix-match against `REPO_ROOT`). |
| CR-03 | Critical | `a2bdc1f` | `ops/rectrace-ops.sh` `stop_component` — wait loop polling `kill -0 "$pid"` (30 s timeout) with SIGKILL fallback. |
| CR-04 + IN-03 | Critical + Info | `5c7dbe9` | `frontend-react/src/grid/SmokeGrid.tsx` — move datasource creation inside `useMemo`/`onGridReady`; add `AbortController` cleanup; replace raw HTML overlay with React component. |
| WR-01 + WR-02 | Warning | `f9912fe` | `frontend-react/src/components/layout/theme-provider.tsx` — try-catch around `localStorage` access (private browsing safety); system theme `matchMedia` handler routes through `setThemeState` instead of mutating DOM directly. |
| WR-03 | Warning | `2bc699f` | `frontend-react/src/lib/queryClient.ts` `onError` — runtime-checked type narrowing for `correlationId`. |
| WR-04 | Warning | `52934da` | Both `CorrelationIdPropagationConfig.java` (backend + tlm-stats) — generate a random 64-bit `spanId` via `ThreadLocalRandom` instead of reusing the traceId low-bits. Fixes Phase 7 W3C traceparent uniqueness. |
| WR-05 | Warning | `60ac9a5` | `scripts/smoke-correlation-id.sh` — fix off-by-one in `tail -n +N` so pre-existing log lines are not included in the post-test search window. |
| WR-06 | Warning | `3c188b6` | `scripts/smoke-ssrm.sh` — capture HTTP status separately from response body (was conflating status code with row count). |
| WR-07 | Warning | `6031c18` | `ops/rectrace-ops.sh` `start_component` — run the `cd` inside a subshell so parent cwd is not mutated. |
| WR-08 | Warning | `30979e1` | `frontend-react/tsconfig.eslint.json` — explicitly declare `@/*` path alias so typed ESLint can resolve it (was inherited unreliably from the include scope). |
| IN-01 | Info | `b9e6764` | `frontend-react/src/main.tsx` — null guard for `#root` element before `createRoot`. |
| IN-05 | Info | `ee094ad` | `frontend-react/eslint.config.js` — narrow `globalIgnores` so `import/no-unresolved` still applies to `src/components/ui/**` (the very rule that would have caught CR-01). |

## Skipped (3 findings, with rationale)

| Finding | Severity | Reason for skip |
|---------|----------|-----------------|
| IN-02 | Info | `error?.message` rendered in JSX text node is XSS-safe — React escapes text children. The original REVIEW.md note acknowledges "current implementation is safe"; no fix required. |
| IN-04 | Info | Spring Boot `3.5.14` resolves cleanly from Maven Central (`mvn dependency:resolve` returns BUILD SUCCESS). Version downgrade was the suggested remediation; out of scope to revert a Phase 01 decision. |
| (WR-04 follow-up) | Warning | The semantic change to span-ID generation in `CorrelationIdPropagationConfig` was applied (commit `52934da`), but ideally a distributed-tracing-aware human should confirm with the Phase 7 Zipkin/Jaeger integration before that phase ships. Flagged here so it lands in the Phase 7 entrypoint review. |

## Sanity Verifications Performed

Each fix was followed by the relevant local check:

| Domain | Command | Result after final fix |
|--------|---------|------------------------|
| React/TS | `pnpm typecheck` (in `frontend-react/`) | exit 0 |
| React/TS | `pnpm test` (in `frontend-react/`) | 5/5 pass |
| React/TS | `pnpm build` (in `frontend-react/`) | succeeds — CR-01 unblocked |
| Java (backend) | `mvn -DskipTests compile` (in `backend/rectrace/`) | `CorrelationIdPropagationConfig.java` compiles; pre-existing unrelated errors in `SearchControllerV4.java` are out of scope (Phase 1 carry-over). |
| Java (tlm-stats) | `mvn -DskipTests compile` (in `rectrace-tlm-stats/`) | exit 0 |
| Bash | `bash -n ops/rectrace-ops.sh ops/build.sh scripts/smoke-ssrm.sh scripts/smoke-correlation-id.sh` | all exit 0 |

## Commit Tail

```
ee094ad fix(02): IN-05 narrow globalIgnores so import rules apply to src/components/ui
b9e6764 fix(02): IN-01 add null guard for root element in main.tsx
30979e1 fix(02): WR-08 explicitly declare @/* path alias in tsconfig.eslint.json
6031c18 fix(02): WR-07 use subshell in start_component to avoid mutating parent cwd
3c188b6 fix(02): WR-06 capture HTTP status separately in smoke-ssrm.sh
60ac9a5 fix(02): WR-05 fix off-by-one in smoke-correlation-id.sh tail -n +N
52934da fix(02): WR-04 generate random spanId in CorrelationIdPropagationConfig (both modules)
2bc699f fix(02): WR-03 use runtime-checked type narrowing for correlationId in onError
f9912fe fix(02): WR-01 WR-02 harden localStorage access and system theme handler in theme-provider
5c7dbe9 fix(02): CR-04 IN-03 move SmokeGrid datasource into useMemo with AbortController
a2bdc1f fix(02): CR-03 stop_component waits for process exit with SIGKILL fallback
5eaf591 fix(02): CR-02 add set -euo pipefail and strengthen STATIC_DIR guard in build.sh
ba55d21 fix(02): CR-01 replace next-themes import with project useTheme in sonner.tsx
```

## Outcome

**Status:** all_fixed — all 4 Critical and 8 Warning findings addressed; 3 of 5 Info findings addressed (2 skipped as no-ops with documented rationale).

The phase is now code-clean against the Phase 02 reviewer pass. The 4 human-verification items from `02-VERIFICATION.md` (SSRM live smoke, correlation-ID log round-trip, dark/light toggle, error toast) still require a live stack and remain outstanding.

---

_Recorded by orchestrator from fixer agent summary; agent applied all 13 commits but its in-flight working copy of REVIEW-FIX.md was lost in the worktree-cleanup desync. The commit history above is authoritative._
