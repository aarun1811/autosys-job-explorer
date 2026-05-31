# A1a — Remove dashboard-configuration concept from search config

**Date:** 2026-05-31
**Status:** Approved (config-only change, no code)
**Predecessor:** Empty-state regression introduced 2026-05-27 by commit `081b19e` (`feat(search): keep dashboard-bearing categories as tabs regardless of hit count`)
**Successor:** A1b — Contextual dashboards inline (separate brainstorm later; design space intentionally kept open by limiting A1a to config)

## Problem

Searching a term that matches nothing anywhere (e.g. `?q=hi`) shows the `jobName` + `Overview` dashboard tabs with an empty placeholder iframe instead of the friendly `NoResultsState`. Two real defects in one symptom:

1. **Functional**: users hit a dead-end UX (placeholder iframe instead of "try another search" examples).
2. **Conceptual**: the `overview` synthetic dashboard-only category and the `jobName.dashboard` block are placeholder scaffolding from a 2026-05-27 experiment. They commit the UI to a dashboard-rendering shape that A1b will revisit from scratch.

Per `frontend-react/src/search/lib/deriveSearchResults.ts:13`, the derivation filter is:

```ts
.filter((c) => c.count > 0 || c.dashboard != null)
```

When all categories return `count=0` but two of them carry `dashboard` config, the filter keeps them — `results.length > 0` — `SearchPage.tsx:168` renders the tab bar instead of `NoResultsState`. The bug is in the **data** (config asserts dashboards that aren't real yet), not the code.

## Approach — config-only deletion

Delete the two `dashboard`-bearing pieces from `backend/rectrace/src/main/resources/search-config-v4.json`:

1. **`jobName.dashboard` block** (~6 lines, after the columns array close).
2. **`overview` category entry** (~11 lines, the whole dashboard-only category).

Plus the trailing comma on the prior category to keep JSON valid.

**No code changes anywhere.** Frontend TS, backend Java, types, schemas, cell renderers, derivation logic, comments — all untouched. The `deriveSearchResults` filter (`count > 0 || dashboard != null`) is correct code once no live category carries dashboard config: with `c.dashboard == null` for every category, the filter reduces to `c.count > 0`, and zero-total-hits produces `[]` → NoResultsState renders.

## Why config-only

A1b will redesign how dashboards surface in the search flow end-to-end (inline per-row, side panel, hybrid, etc.). Touching code in A1a means undoing A1a's code in A1b. Keeping A1a to a data-shape change leaves the implementation untouched for A1b to redesign without churn. The change is also trivially reversible if we re-introduce dashboard-bearing categories later — just put the config back.

## Out of scope (deliberately)

- **TLM / QuickRec cell-renderer dashboards** (`tlmStatsButtonRenderer`, `quickRecStatsButtonRenderer`, `RecvizDashboardModal`, `buildEmbedUrl`, `TlmStatsCellRenderer`, `QuickRecStatsCellRenderer`). These are per-cell action buttons that open the RecViz modal — completely separate from the category-level `dashboard` config and core to the demo. They stay.
- **`recviz-placeholder.html`** file in `frontend-react/public/`. Dead after the config edit but harmless. Leave it; A1b decides whether to delete or repurpose.
- **Stale comment in `deriveSearchResults.ts`** that mentions the "overview" tab. It's a code comment that A1b will rewrite anyway. Leave it.
- **Type changes** — `CategoryResultV4Schema.dashboard?` stays optional. No schema deletion.
- **Test changes** — three test files reference dashboard configs via synthetic fixtures (`DashboardConfigBindingTest.java`, `SearchServiceV4DashboardTest.java`, `types.dashboard.test.ts`). None reads the live `search-config-v4.json`. All pass as-is.

## Verification

1. Restart `backend/rectrace` (config is read at boot, no rebuild needed for JSON-only change beyond classpath refresh).
2. Open `http://localhost:5173/`.
3. **No-match search**: enter `hi`, submit → page renders `NoResultsState` with TRY_EXAMPLES, NOT a tab bar with placeholder iframes.
4. **Real-match search**: enter `tlm`, submit → tab bar renders with categories that have hits. **No "Overview" tab as the default-open landing tab.** First active tab = highest-count grid category.
5. **Cell-click flow intact**: in `tlmInstance` category, click any sparkles-icon cell → RecViz modal opens with the dashboard. (Confirms the cell-renderer surface is untouched.)
6. Existing tests stay green: `cd backend/rectrace && mvn test` (no surefire failures), `cd frontend-react && pnpm test && pnpm typecheck && pnpm lint`.

## Rollback

Revert the single commit. The deleted JSON blocks are restored, behavior returns to the pre-A1a (regressed) state. Safe because no code references depend on the deletion.

## Effort

~30 minutes including verification + commit + push. Single file change in `backend/rectrace/src/main/resources/search-config-v4.json`.
