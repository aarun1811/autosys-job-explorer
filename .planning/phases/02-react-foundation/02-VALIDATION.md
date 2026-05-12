---
phase: 2
slug: react-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-13
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 2.x (frontend-react/) + JUnit 5 (backend modules) |
| **Config file** | `frontend-react/vitest.config.ts` (Wave 0 creates) + existing backend `pom.xml` Surefire |
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

> Populated by planner during plan-phase. Skeleton rows below are placeholders the planner will replace.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 0 | REACT-01 | — | Scaffold boots; `pnpm dev` returns HTTP 200 | smoke | `curl -sf http://localhost:5173/ -o /dev/null` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | REACT-02 | — | tokens.css + theme.ts contain shadcn baseline keys | unit | `pnpm --dir frontend-react test --run tokens` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | REACT-04 | — | ESLint rejects raw hex in component sources | unit | `pnpm --dir frontend-react lint -- --max-warnings=0` (against hex fixture) | ❌ W0 | ⬜ pending |
| 02-01-04 | 01 | 2 | REACT-03 | — | Dark/light toggle persists across reload | manual | playwright smoke (deferred to Phase 8) — manual sign-off | ❌ W0 | ⬜ pending |
| 02-01-05 | 01 | 2 | REACT-05 | — | Footer renders non-empty `__BUILD_SHA__` | unit | `pnpm --dir frontend-react test --run footer-sha` | ❌ W0 | ⬜ pending |
| 02-01-06 | 01 | 2 | REACT-06 | — | Backend MDC log line contains client-supplied X-Correlation-Id hex | integration | `bash scripts/smoke-correlation-id.sh` | ❌ W0 | ⬜ pending |
| 02-01-07 | 01 | 2 | REACT-07 | — | Fetch wrapper attaches `X-Correlation-Id` header on every request | unit | `pnpm --dir frontend-react test --run fetch-wrapper` | ❌ W0 | ⬜ pending |
| 02-01-08 | 01 | 3 | REACT-08 | — | `ops/rectrace-ops.sh start react && status` reports up; no `angular` row | smoke | `bash ops/rectrace-ops.sh start react && bash ops/rectrace-ops.sh status \| grep -E "react.*up"` | ❌ W0 | ⬜ pending |
| 02-01-09 | 01 | 3 | REACT-01 (SSRM) | — | SSRM POST returns ≥1 row against Phase 0.1 seed | integration | `bash scripts/smoke-ssrm.sh` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend-react/` — scaffold (`pnpm create vite`, install shadcn + Tailwind v4 + ag-grid-react + TanStack stack + next-themes/custom theme provider)
- [ ] `frontend-react/vitest.config.ts` — vitest harness
- [ ] `frontend-react/src/test-setup.ts` — DOM matchers, fetch polyfill
- [ ] `frontend-react/eslint.config.js` — flat config with `no-restricted-syntax` hex rule
- [ ] `frontend-react/tests/fixtures/raw-hex.tsx` — ESLint hex-rejection fixture (intentionally fails lint)
- [ ] `scripts/smoke-ssrm.sh` — curl SSRM endpoint, assert JSON contains `rows[]` with ≥1 entry
- [ ] `scripts/smoke-correlation-id.sh` — curl with `X-Correlation-Id: <hex>`, grep backend log for same hex in MDC
- [ ] `ops/rectrace-ops.sh` — start/stop/status/restart/logs for backend, tlm-stats, react (NO angular row)
- [ ] `ops/build.sh` — `react` verb cleans + populates `backend/rectrace/src/main/resources/static/`
- [ ] `backend/rectrace/pom.xml` + `rectrace-tlm-stats/pom.xml` — add `micrometer-tracing-bridge-brave`
- [ ] `logback-spring.xml` (both modules) — pattern includes `%X{traceId}`
- [ ] Brave `Propagation` (Option B) OR baggage properties (Option A) — planner picks per RESEARCH.md open question 1

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dark/light toggle visually reaches parity with Angular app | REACT-03 | Visual regression (Playwright + Percy) deferred to Phase 8 DESIGN-02 | Toggle theme in React shell at `/rectrace/` and in Angular at `/rectrace/` (split tab) — confirm color tokens, contrast, and icon-fill match across primary, secondary, muted, accent, destructive, sidebar surfaces |
| AG-Grid Enterprise license renders without watermark | REACT-01 | License-bound visual; cannot assert in CI without enterprise key | Load `/rectrace/`, inspect grid header — no "Trial Version" watermark; console clean of license warnings |
| Build SHA in footer matches `git rev-parse --short HEAD` | REACT-05 | Build-time injection; verify by hand after `ops/build.sh react` | Run build, deploy to `static/`, load `/rectrace/`, compare footer SHA to `git rev-parse --short HEAD` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
