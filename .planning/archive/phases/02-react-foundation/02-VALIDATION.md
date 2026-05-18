---
phase: 2
slug: react-foundation
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-13
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (frontend-react/) + JUnit 5 (backend modules) |
| **Config file** | `frontend-react/vitest.config.ts` (Plan 02-01 Task 1 creates) + existing backend `pom.xml` Surefire |
| **Quick run command** | `pnpm --dir frontend-react test --run` |
| **Full suite command** | `pnpm --dir frontend-react test --run && mvn -pl backend/rectrace,rectrace-tlm-stats test` |
| **Estimated runtime** | ~30s (frontend) + ~90s (backend) |

---

## Sampling Rate

- **After every task commit:** Run quick command for files touched (frontend OR backend slice)
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green plus manual SSRM smoke + correlation-ID round-trip
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

> Wave column reflects the plan's wave number per ROADMAP (Wave 1 = Plans 01+02, Wave 2 = Plan 03, Wave 3 = Plans 04+05).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Created By | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-----------------|--------|
| 02-01-T1 | 01 | 1 | REACT-01 | — | Scaffold boots; package.json + vitest + test-setup.ts present | unit | `grep -c '"packageManager": "pnpm@9' frontend-react/package.json && grep -c "@testing-library/jest-dom" frontend-react/src/test-setup.ts` | Plan 02-01 Task 1 | ⬜ pending |
| 02-01-T2 | 01 | 1 | REACT-04 | — | ESLint rejects raw hex in component sources | unit | `cd frontend-react && pnpm lint -- tests/fixtures/raw-hex.tsx 2>&1 \| grep -c "raw hex literals"` | Plan 02-01 Task 2 | ⬜ pending |
| 02-01-idx | 01 | 1 | REACT-01 | — | tokens.css has RECTRACE EXTENSIONS block, no chart-1..5 tokens | unit | `grep -c "RECTRACE EXTENSIONS" frontend-react/src/index.css && grep -c "chart-1" frontend-react/src/index.css` (second must be 0) | Plan 02-01 Task 1 | ⬜ pending |
| 02-02-T1 | 02 | 1 | REACT-07 | T-2-02 | CorrelationIdPropagationConfig.java has HEX32 regex in both modules | unit | `grep -c "HEX32" backend/rectrace/src/main/java/com/citi/gru/rectrace/config/CorrelationIdPropagationConfig.java` | Plan 02-02 Task 1 | ⬜ pending |
| 02-02-T2 | 02 | 1 | REACT-07 | T-2-02 | logback-spring.xml has %X{traceId} only; no baggage config in application-local.properties | unit | `grep -c "%X{traceId" backend/rectrace/src/main/resources/logback-spring.xml && grep -c "management.tracing.baggage" backend/rectrace/src/main/resources/application-local.properties` (second must be 0) | Plan 02-02 Task 2 | ⬜ pending |
| 02-03-T1 | 03 | 2 | REACT-05 | — | Footer renders __BUILD_SHA__ and theme toggle works | unit | `grep -c "__BUILD_SHA__" frontend-react/src/components/app-shell/footer.tsx && pnpm --dir frontend-react test --run 2>&1 \| grep -E "passed"` | Plan 02-03 Task 1 | ⬜ pending |
| 02-03-T2 | 03 | 2 | REACT-07 | — | apiFetch attaches X-Correlation-Id; BASE_URL is '' (no hardcoded host) | unit | `pnpm --dir frontend-react test --run && grep -c "localhost:6088" frontend-react/src/lib/queryClient.ts` (second must be 0) | Plan 02-03 Task 2 | ⬜ pending |
| 02-03-ssrm | 03 | 2 | REACT-03 | — | SmokeGrid has rowModelType serverSide and posts to /rectrace/api/v4/search/ssrm/fileName | unit | `grep -c "serverSide" frontend-react/src/grid/SmokeGrid.tsx` | Plan 02-03 Task 2 | ⬜ pending |
| 02-04-T1 | 04 | 3 | REACT-08 | — | ops/rectrace-ops.sh status shows 3 components, no angular row | smoke | `grep -c "react" ops/rectrace-ops.sh && bash ops/rectrace-ops.sh status 2>&1 \| grep -cv "angular"` | Plan 02-04 Task 1 | ⬜ pending |
| 02-04-T2-ssrm | 04 | 3 | REACT-01 (SSRM) | — | SSRM POST returns ≥1 row against Phase 0.1 seed | integration | `bash scripts/smoke-ssrm.sh` | Plan 02-04 Task 2 | ⬜ pending |
| 02-04-T2-corr | 04 | 3 | REACT-06 | T-2-02 | X-Correlation-Id appears in backend log as traceId (Option B round-trip) | integration | `bash scripts/smoke-correlation-id.sh` | Plan 02-04 Task 2 | ⬜ pending |
| 02-05-T1 | 05 | 3 | REACT-08 | — | ROADMAP.md Phase 2 SC#5 has no "angular"; Phase 3 SC#1 has no "/v6/" | unit | `grep -c "no angular component" .planning/REQUIREMENTS.md && grep -c "/v6/" .planning/ROADMAP.md` (second must be 0) | Plan 02-05 Task 1 | ⬜ pending |
| 02-05-T2 | 05 | 3 | REACT-01 | — | STATE.md has chart/series/ramp deferred row; parity-matrix.md has D-2.18 note | unit | `grep -c "chart/series/ramp tokens" .planning/STATE.md && grep -c "D-2.18" .planning/parity-matrix.md` | Plan 02-05 Task 2 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements (All satisfied by plans — wave_0_complete: true)

- [x] `frontend-react/vitest.config.ts` — vitest harness (Plan 02-01 Task 1)
- [x] `frontend-react/src/test-setup.ts` — DOM matchers via `@testing-library/jest-dom` (Plan 02-01 Task 1 — co-located with vitest config so the setupFiles reference resolves immediately)
- [x] `frontend-react/eslint.config.js` — flat config with `no-restricted-syntax` hex rule (Plan 02-01 Task 2)
- [x] `frontend-react/tests/fixtures/raw-hex.tsx` — ESLint hex-rejection fixture (Plan 02-01 Task 2)
- [x] `scripts/smoke-ssrm.sh` — curl SSRM endpoint, assert JSON contains `rows[]` with ≥1 entry (Plan 02-04 Task 2)
- [x] `scripts/smoke-correlation-id.sh` — curl with `X-Correlation-Id: <hex>`, grep backend log for same hex as traceId (Plan 02-04 Task 2)
- [x] `ops/rectrace-ops.sh` — start/stop/status/restart/logs for backend, tlm-stats, react (NO angular row) (Plan 02-04 Task 1)
- [x] `ops/build.sh` — `react` verb cleans + populates `backend/rectrace/src/main/resources/static/` (Plan 02-04 Task 1)
- [x] `backend/rectrace/pom.xml` + `rectrace-tlm-stats/pom.xml` — add `micrometer-tracing-bridge-brave` (Plan 02-02 Task 1)
- [x] `logback-spring.xml` (both modules) — pattern includes `%X{traceId}` only (no baggage MDC key) (Plan 02-02 Task 2)
- [x] `CorrelationIdPropagationConfig.java` (both modules) — custom Brave `Propagation.Factory` per D-2.10 Option B; HEX32 regex validation (Plan 02-02 Task 1)

Note: The smoke scripts (smoke-ssrm.sh, smoke-correlation-id.sh) are created in Plan 02-04 (Wave 3). Tasks in Wave 2 (Plan 03) that reference SSRM and correlation-ID behavior are verified via unit tests in that wave; the integration smoke tests run in Wave 3 once the ops scripts and smoke scripts exist.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dark/light toggle visually reaches parity with Angular app | REACT-03 | Visual regression (Playwright + Percy) deferred to Phase 8 DESIGN-02 | Toggle theme in React shell at `/rectrace/` and in Angular at `/rectrace/` (split tab) — confirm color tokens, contrast, and icon-fill match across primary, secondary, muted, accent, destructive, sidebar surfaces |
| AG-Grid Enterprise license renders without watermark | REACT-01 | License-bound visual; cannot assert in CI without enterprise key | Load `/rectrace/`, inspect grid header — no "Trial Version" watermark; console clean of license warnings |
| Build SHA in footer matches `git rev-parse --short HEAD` | REACT-05 | Build-time injection; verify by hand after `ops/build.sh react` | Run build, deploy to `static/`, load `/rectrace/`, compare footer SHA to `git rev-parse --short HEAD` |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or are covered by Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (test-setup.ts in Plan 01 Task 1; smoke scripts in Plan 04 Task 2)
- [x] No watch-mode flags
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending (set to approved after all plan tasks execute green)
