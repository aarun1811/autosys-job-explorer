---
phase: 3
slug: react-search-vertical-slice
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-17
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Populated from RESEARCH.md `## Validation Architecture`. Planner fills the Per-Task Verification Map during plan generation.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (unit) + Playwright (e2e/visual) — established in Phase 2 |
| **Config file** | `frontend-react/vitest.config.ts`, `frontend-react/playwright.config.ts` |
| **Quick run command** | `cd frontend-react && npm run test:unit -- --run` |
| **Full suite command** | `cd frontend-react && npm run test:unit -- --run && npm run test:e2e` |
| **Estimated runtime** | ~60 seconds (unit) + ~90 seconds (e2e) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:unit -- --run` (scoped to changed files)
- **After every plan wave:** Run full unit suite + relevant Playwright spec
- **Before `/gsd-verify-work`:** Full suite must be green; parity-matrix walkthrough complete
- **Max feedback latency:** 60 seconds (unit), 90 seconds (e2e)

---

## Per-Task Verification Map

> Planner populates this section while writing PLAN.md files. Each task with `<automated>` block maps to a row here.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _planner-fills_ | — | — | SEARCH-01..07 | — | — | unit / e2e / visual | — | ⬜ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Wave 0 dependencies the planner must place before any test-bearing tasks:

- [ ] `frontend-react/src/lib/__tests__/configToColDefs.test.ts` — column-def adapter (kebab→camelCase, renderer key lookup)
- [ ] `frontend-react/src/lib/__tests__/urlState.test.ts` — URL roundtrip serialize/deserialize
- [ ] `frontend-react/src/lib/__tests__/recentSearches.test.ts` — localStorage LRU (10-item cap, dedupe)
- [ ] `frontend-react/src/components/search/__tests__/renderer-registry.test.tsx` — renderer key → component mapping
- [ ] `frontend-react/playwright/search-parity.spec.ts` — search → SSRM render → cell renderer click → modal/handler smoke
- [ ] `frontend-react/playwright/search-deep-link.spec.ts` — URL roundtrip e2e (paste URL → state restored)
- [ ] `frontend-react/playwright/search-correlation-id.spec.ts` — stub 500 → assert `Error — reference: <ID>` rendered
- [ ] Backend `/api/v4/search/initial?keyword=...` smoke (curl in `scripts/smoke.sh`) — confirm `InitialFilter` shape matches Zod schema

*If none of the above already exist in Phase 2 scaffolding, planner must add them as Wave 0 tasks.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual parity of SSRM grid vs Angular reference | SEARCH-01..05 | Cross-framework visual diff is brittle without screenshots from running Angular instance | Run both Angular (`localhost:4200`) and React (`localhost:6088/rectrace/`) with same search term; side-by-side compare row count, column order, expanded-group rendering, cell styling, sort/filter behavior. Capture screenshots for parity-matrix artifact. |
| Excel export "looks right" in Excel | SEARCH-04 | XLSX file rendering depends on Excel version; client-side `exportDataAsExcel()` output diverges from Angular's server-generated XLSX (D-3.10) — known acceptable divergence | Run export from React grid, open in Excel; confirm headers, column order, row data match what is on screen. Document divergence from Angular server XLSX in parity matrix. |
| shadcn theme / AG-Grid CSS variable bridge | UI-SPEC | Hard to automate cross-tool theming assertion | Toggle theme; visually confirm AG-Grid colors track shadcn tokens (`--ag-background-color`, `--ag-foreground-color`, etc.) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter
- [ ] Parity matrix artifact produced and reviewed

**Approval:** pending
