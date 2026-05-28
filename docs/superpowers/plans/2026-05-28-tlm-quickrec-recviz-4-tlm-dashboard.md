# TLM Dashboard Implementation Plan (Plan 4 of 4) — v2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **v2 note (2026-05-28):** Plan v1 failed a two-pass live-source review with 15+ defects (wrong KPI helper signature, wrong dashboard schema, wrong renderer shape, wrong connection routing, missing FE wiring for `coalesce_zero`, Playwright not installed, wrong route Zod key, wrong category, schema column mismatch). v2 was rewritten from scratch against verified live-source facts.

**Goal:** Replace the legacy Angular `tlm-stats-modal-v2` with a React modal that embeds a native RecViz TLM dashboard. The dashboard cross-DB-merges per-TLM-instance automatch data (from `conn-tcosprd`) with reconmgmt manual-match data on `(tlm_instance, agent_code, set_id, stmt_date, bran_code, corr_acc_no)`, fills missing numeric cells with `0`, and shows separate panels for breaks and reconciliation gated on KPI values (matching the legacy modal's only conditional logic).

**Architecture:** Three small RecViz capability additions land first — (1) `visibleWhen` on `KpiConfig`/`DashboardChartConfig` (currently grid-only), (2) `coalesce_zero` flag wired end-to-end (backend `MergeRequest` + frontend `MergeConfig`/`GridConfig`), (3) `FilterMapping.options` passing `exclude_today` to a parameterized `_build_date_range_clause`. Then `conn-reconmgmt` registers in `seed-oracle.py`. Then three datasets register — `ds-tlm-automatch` (dynamic-routed to `conn-tcosprd` via `tlm_instance` filter), `ds-tlm-breaks` (same routing), `ds-tlm-manual-match` (static-routed to `conn-reconmgmt`, UNION ALL of `mr_csum_man_match_details` and `mr_csum_netting_hist` with column-alias normalization). The TLM dashboard config wires four KPIs, the breaks grid (`visibleWhen: total_breaks > 0`), and the reconciliation grid backed by a cross-DB merge of `ds-tlm-automatch + ds-tlm-manual-match` with `coalesceZero: true` (`visibleWhen: total_items > 0`). React-side adds `TlmStatsCellRenderer` (mirrors `QuickRecStatsCellRenderer` exactly: self-contained component owning its modal/theme/URL) wired on `tlm_instance`/`set_id`/`recon` columns in `search-config-v4.json`. Final task adds Playwright (not currently installed) + a minimal e2e smoke verifying the modal opens with KPIs visible.

**Tech Stack:** RecViz backend (FastAPI + SQLAlchemy 2 + oracledb), RecViz frontend (Vite 7 + React 19 + shadcn + AG-Grid 35 + TanStack), rectrace frontend (Vite 7 + React 19 + AG-Grid 35), Oracle 23c, Playwright.

**Prerequisite:** Plans 1, 2, 3 done. `conn-tcosprd` registered. `tcosprd` schema seeded via `apply.py --volume 10`. RecViz uvicorn on `:8000`, rectrace backend on `:6088`, rectrace React on `:5173`. The recviz user is persisted in `rectrace-local-dev/init/01-create-schema-users.sql` (`c075f08`).

**Repos & branches:**
- Tasks 1–5 (RecViz capabilities + datasets + dashboard): RecViz repo at `/Users/aarun/Workspace/Projects/RecViz`, on `feature/tlm-dashboard` (created at Plan 3 Task 4 from `feature/embed-foundation@14e8890`; HEAD `ca0d546`).
- Tasks 6–7 (rectrace cell renderer + search-config wiring): `/Users/aarun/Workspace/Projects/autosys-job-explorer`, on `milestone/modernization`.
- Task 8 (Playwright bootstrap + e2e smoke): same rectrace repo + branch.

**Spec:** `docs/superpowers/specs/2026-05-28-tlm-quickrec-recviz-modals-design.md` — §6.5, §7, §12.1, §12.2, §12.5-§12.8.

**Source-of-truth for SQL:** `rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/service/TlmStatsV2Service.java` — `buildAutomatchQuery` (451-491), `buildBreaksQuery` (388-448), `buildManualMatchQuery` (547-622), `getDateRangeClause` (624-633), `TLM_INSTANCE_MAP` (38-50).

**Reference precedents in RecViz seed-oracle.py:**
- `dash-executive-summary` (lines 2794-2873) — canonical multi-KPI multi-grid dashboard shape on `feature/tlm-dashboard`.
- `dash-quickrec-stats` (on `feature/quickrec-dashboard` — NOT on the current branch, but quoted here verbatim because its inline KPI cards with `trend.referenceKpi` and `accentColor` are the closest precedent for what TLM needs):

  ```python
  # Inline KPI card shape used by dash-quickrec-stats — mirror this for TLM:
  {"id": "kpi-qr-left-records", "label": "Left Records", "format": "number",
   "sources": [{"dataSourceId": "ds-qr-automatch", "metric": "left_record_count"}],
   "aggregation": "SUM",
   "accentColor": "--chart-1"},
  {"id": "kpi-qr-left-breaks", "label": "Left Breaks", "format": "number",
   "sources": [{"dataSourceId": "ds-qr-automatch", "metric": "left_break_count"}],
   "aggregation": "SUM",
   "trend": {"type": "percentage_of", "referenceKpi": "kpi-qr-left-records", "display": "ratio"},
   "accentColor": "--chart-warning"},
  ```

  Plan 4 mirrors this inline pattern (NOT `_kpi_card()`) because `_kpi_card()` doesn't carry `trend` or `accentColor`. The QuickRec inline pattern is the precedent.

**Reference precedents in rectrace `frontend-react`:**
- `QuickRecStatsCellRenderer.tsx` — verbatim shape Task 6 mirrors (self-contained, `params: ICellRendererParams`, internal `useState` for modal, builds embed URL inline). v1 misread this; v2 is correct.

**Spike outcomes locked in (from AskUserQuestion earlier today):**
- §12.1 → A. Extend `visibleWhen` to KPIs + charts. No filter-value mechanism — legacy doesn't need it.
- §12.6 → B. Add `coalesce_zero: bool = false` to backend `MergeRequest`. Wire it end-to-end through `MergeConfig`/`useDataSourceMerge`/`GridConfig`/`MergedSourceGrid`. TLM merge sets it `true`.
- §12.7 → B. Add `options: dict | None = None` to `FilterMapping`. Parameterize `_build_date_range_clause(*, exclude_today=False)`. JSON column on `RecvizDataset.filter_mappings` absorbs the new field — no Alembic migration.
- §12.8 → A. One row-level dataset per query family. KPIs aggregate via `aggregation: "SUM"` server-side.

---

## File Structure

**RecViz repo (`/Users/aarun/Workspace/Projects/RecViz`):**

- Create `frontend/src/lib/visibility.ts` — shared `isVisible(visibleWhen, kpiResults)` helper.
- Create `frontend/src/lib/visibility.test.ts` — unit tests.
- Modify `frontend/src/types/dashboard-config.ts` — add `visibleWhen?: VisibleWhen` to `KpiConfig` AND `DashboardChartConfig`. Add `coalesceZero?: boolean` to `GridConfig`.
- Modify `frontend/src/hooks/use-data-source-merge.ts` — add `coalesceZero?: boolean` to `MergeConfig`; forward `coalesce_zero` in POST body.
- Modify `frontend/src/components/dashboard/config-data-grid.tsx` — replace local `isVisible` with shared import; in `MergedSourceGrid`, forward `coalesceZero: grid.coalesceZero` into `mergeConfig` memo.
- Modify `frontend/src/components/dashboard/config-kpi-row.tsx` — gate per-KPI render on `isVisible(kpi.visibleWhen, effectiveKpis)` inside the existing `kpis.map(...)`.
- Modify `frontend/src/components/dashboard/config-chart-grid.tsx` — gate per-chart render on `isVisible(chart.visibleWhen, kpiResults)`.
- Modify `backend/app/services/merge_engine.py` — add `coalesce_zero` parameter; fill missing numeric cells with `0` when set.
- Modify `backend/app/api/data_sources.py` — accept `coalesce_zero` on `MergeRequest`, forward to engine.
- Modify `backend/tests/test_merge_engine.py` — keep `test_outer_join` default-off behavior; add `test_outer_join_coalesce_zero_*`.
- Modify `backend/app/models/data_source_config.py` — add `options: dict | None = None` to `FilterMapping`.
- Modify `backend/app/services/query_engine.py` — parameterize `_build_date_range_clause(value, dialect, *, exclude_today=False)`; thread `fm.options` through `_build_sql`.
- Modify `backend/tests/test_query_engine.py` (or `tests/test_date_range_clause.py` — verify at execution) — add tests.
- Modify `scripts/seed-oracle.py`:
  - `seed_connection`: register fourth connection `conn-reconmgmt`. Bump hardcoded `"3 rows"` print to `"4 rows"`.
  - Append `ds-tlm-automatch`, `ds-tlm-breaks`, `ds-tlm-manual-match` to `CURATED_DATASETS`.
  - Append 4 TLM KPIs to `CURATED_KPIS`.
  - Append `dash-tlm-stats` to `CURATED_DASHBOARDS`.
  - Bump `assert len(CURATED_DATASETS) == 23` → `26`, `assert len(CURATED_KPIS) == 18` → `22`, `assert len(CURATED_DASHBOARDS) == 10` → `11`.

**rectrace repo (`/Users/aarun/Workspace/Projects/autosys-job-explorer`):**

- Create `frontend-react/src/search/renderers/TlmStatsCellRenderer.tsx` — self-contained component mirroring `QuickRecStatsCellRenderer.tsx` exactly.
- Create `frontend-react/src/search/renderers/TlmStatsCellRenderer.test.tsx` — mirrors `QuickRecStatsCellRenderer.test.tsx` mocking pattern (`fireEvent` from `@testing-library/react`; mock the modal/theme/recvizConfig).
- Modify `frontend-react/src/search/renderers/registry.ts` — add `tlmStatsButtonRenderer: TlmStatsCellRenderer` to the `cellRenderers` map.
- Modify `frontend-react/src/search/__tests__/registry.test.ts` — bump length assertion from `3` to `5` (4 already-existing + 1 new); add key-presence assertions for `quickRecStatsButtonRenderer` (already in registry) and `tlmStatsButtonRenderer`.
- Modify `backend/rectrace/src/main/resources/search-config-v4.json` — set `cellRenderer: "tlmStatsButtonRenderer"` + `cellRendererParams: { entryPoint: "<type>" }` on `tlm_instance`, `set_id`, `recon` columns in the categories enumerated in Task 7. Skip rowGroup-flagged columns.
- Create `frontend-react/playwright.config.ts` — minimal Playwright config.
- Create `frontend-react/e2e/tlm-stats-modal.spec.ts` — modal-opens smoke test.

---

## Task 1: Extend `visibleWhen` to KPIs and charts

**Files:**
- Create `frontend/src/lib/visibility.ts`
- Create `frontend/src/lib/visibility.test.ts`
- Modify `frontend/src/types/dashboard-config.ts`
- Modify `frontend/src/components/dashboard/config-data-grid.tsx`
- Modify `frontend/src/components/dashboard/config-kpi-row.tsx`
- Modify `frontend/src/components/dashboard/config-chart-grid.tsx`

- [ ] **Step 1: Verify the RecViz branch**

```bash
cd /Users/aarun/Workspace/Projects/RecViz && git status -sb
```
Expected: `## feature/tlm-dashboard...`. If not, `git checkout feature/tlm-dashboard`.

- [ ] **Step 2: Write the failing test for the shared `isVisible` helper**

Create `/Users/aarun/Workspace/Projects/RecViz/frontend/src/lib/visibility.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { isVisible } from './visibility'
import type { KpiResult, VisibleWhen } from '@/types/dashboard-config'

describe('isVisible', () => {
  const kpis: KpiResult[] = [
    { id: 'k1', value: 10 },
    { id: 'k2', value: 0 },
  ]

  it('returns true when visibleWhen is undefined', () => {
    expect(isVisible(undefined, kpis)).toBe(true)
  })

  it('returns true when kpiResults is undefined (results not loaded yet)', () => {
    expect(isVisible({ kpi: 'k1', condition: 'gt', value: 0 }, undefined)).toBe(true)
  })

  it('returns true when the referenced KPI id is missing (config drift fail-open)', () => {
    expect(isVisible({ kpi: 'nope', condition: 'gt', value: 0 }, kpis)).toBe(true)
  })

  it.each([
    [{ kpi: 'k1', condition: 'gt', value: 5 } as VisibleWhen, true],
    [{ kpi: 'k1', condition: 'gt', value: 100 } as VisibleWhen, false],
    [{ kpi: 'k1', condition: 'lt', value: 100 } as VisibleWhen, true],
    [{ kpi: 'k1', condition: 'lt', value: 5 } as VisibleWhen, false],
    [{ kpi: 'k1', condition: 'eq', value: 10 } as VisibleWhen, true],
    [{ kpi: 'k2', condition: 'eq', value: 0 } as VisibleWhen, true],
  ])('evaluates %j as %p', (rule, expected) => {
    expect(isVisible(rule, kpis)).toBe(expected)
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
cd /Users/aarun/Workspace/Projects/RecViz/frontend && npx vitest run src/lib/visibility.test.ts
```
Expected: FAIL with `Cannot find module './visibility'`.

- [ ] **Step 4: Implement the shared helper**

Create `/Users/aarun/Workspace/Projects/RecViz/frontend/src/lib/visibility.ts`:

```ts
import type { KpiResult, VisibleWhen } from '@/types/dashboard-config'

/**
 * KPI-value-based visibility check. Used to gate KPI cards, chart panels,
 * and data grids on aggregated values. Returns `true` (visible) when:
 *  - `visibleWhen` is undefined (no rule = always show), OR
 *  - `kpiResults` is undefined (results not loaded yet = optimistic show), OR
 *  - the referenced KPI id is missing from `kpiResults` (config drift =
 *    fail-open rather than hide a panel due to a typo).
 *
 * Extracted from the original local helper in
 * `components/dashboard/config-data-grid.tsx` (no semantic change). Now
 * also consumed by ConfigKpiRow and ConfigChartGrid for KPI/chart-level
 * gating (Plan 4 §12.1).
 */
export function isVisible(
  visibleWhen: VisibleWhen | undefined,
  kpiResults: KpiResult[] | null | undefined,
): boolean {
  if (!visibleWhen || !kpiResults) return true
  const kpi = kpiResults.find((k) => k.id === visibleWhen.kpi)
  if (!kpi) return true
  switch (visibleWhen.condition) {
    case 'gt':
      return kpi.value > visibleWhen.value
    case 'lt':
      return kpi.value < visibleWhen.value
    case 'eq':
      return kpi.value === visibleWhen.value
    default:
      return true
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd /Users/aarun/Workspace/Projects/RecViz/frontend && npx vitest run src/lib/visibility.test.ts
```
Expected: 9 tests passing.

- [ ] **Step 6: Extend the type definitions**

Edit `/Users/aarun/Workspace/Projects/RecViz/frontend/src/types/dashboard-config.ts`. Add `visibleWhen?: VisibleWhen` to BOTH `KpiConfig` (lines ~32-39) AND `DashboardChartConfig` (lines ~60-87). The `GridConfig.visibleWhen` field already exists at line 113 — leave it.

Also add `coalesceZero?: boolean` to `GridConfig` (will be consumed in Task 2 frontend wiring):

```ts
export interface KpiConfig {
  // ... existing fields ...
  visibleWhen?: VisibleWhen   // <-- ADD
}

export interface DashboardChartConfig {
  // ... existing fields ...
  visibleWhen?: VisibleWhen   // <-- ADD
}

export interface GridConfig {
  // ... existing fields including visibleWhen?: VisibleWhen ...
  coalesceZero?: boolean      // <-- ADD (Task 2 will read this)
}
```

- [ ] **Step 7: Replace the local helper in `config-data-grid.tsx`**

Edit `/Users/aarun/Workspace/Projects/RecViz/frontend/src/components/dashboard/config-data-grid.tsx`. Remove the local `isVisible` function (lines ~32-49) and replace with an import:

```ts
import { isVisible } from '@/lib/visibility'
```

Leave the call site at line ~373 (`if (!isVisible(grid.visibleWhen, kpiResults)) return null`) intact.

- [ ] **Step 8: Add visibility gating to KPI row**

Edit `/Users/aarun/Workspace/Projects/RecViz/frontend/src/components/dashboard/config-kpi-row.tsx`. The component has its own `useDashboardKpis` and computes `effectiveKpis = crossFilteredKpis ?? serverKpis` at line ~102. Inside the per-KPI map (currently at lines ~110-120), add an early-return:

```tsx
import { isVisible } from '@/lib/visibility'

// inside ConfigKpiRow's return JSX, at the top of `kpis.map((kpi, i) => {`:
return (
  <div className="grid grid-cols-4 gap-3">
    {kpis.map((kpi, i) => {
      // Gate on KPI-value condition; uses the same effectiveKpis used to
      // compute each card's displayed value. Returns null = card unmounted.
      if (!isVisible(kpi.visibleWhen, effectiveKpis)) return null

      const result = kpiResultsMap.get(kpi.id)
      // ... existing per-card render unchanged ...
```

The `effectiveKpis` variable already exists in scope at line ~102 — no new prop plumbing needed. The `isVisible` import is the only new symbol.

[CAVEAT] There's a pre-existing Rules-of-Hooks issue in this file (the early-return at line 64 happens before `useDashboardKpis` is called when `kpis.length === 0`). Do NOT fix it as part of this task — adding the `isVisible` gate inside the map preserves the existing structure. Note it as a follow-up.

- [ ] **Step 9: Add visibility gating to chart grid**

Edit `/Users/aarun/Workspace/Projects/RecViz/frontend/src/components/dashboard/config-chart-grid.tsx`. `kpiResults` is already a prop (line ~25). Add `isVisible` import and gate the chart map (currently at lines ~542+):

```tsx
import { isVisible } from '@/lib/visibility'

// inside ConfigChartGrid's return JSX, at the top of `charts.map((chart) => {`:
{charts.map((chart) => {
  if (!isVisible(chart.visibleWhen, kpiResults)) return null

  if (chart.sourceType === 'kpi_values') {
    // ... existing render unchanged ...
  }
  return (
    // ... existing render unchanged ...
  )
})}
```

- [ ] **Step 10: Run typecheck + lint + tests**

```bash
cd /Users/aarun/Workspace/Projects/RecViz/frontend && npx tsc -b --noEmit && npx eslint src/lib/visibility.ts src/components/dashboard/config-kpi-row.tsx src/components/dashboard/config-chart-grid.tsx src/components/dashboard/config-data-grid.tsx && npx vitest run
```
Expected: typecheck passes, lint clean, all tests pass (existing grid `isVisible` test still passes — the helper extraction is behavior-preserving).

- [ ] **Step 11: Commit (LOCAL ONLY)**

```bash
cd /Users/aarun/Workspace/Projects/RecViz
git add frontend/src/lib/visibility.ts frontend/src/lib/visibility.test.ts \
       frontend/src/types/dashboard-config.ts \
       frontend/src/components/dashboard/config-data-grid.tsx \
       frontend/src/components/dashboard/config-kpi-row.tsx \
       frontend/src/components/dashboard/config-chart-grid.tsx
git commit -m "feat(dashboard): extend visibleWhen to KPIs and charts; add GridConfig.coalesceZero (Plan 4 §12.1)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: MergeRequest.coalesce_zero — backend + frontend end-to-end

**Files (backend):**
- Modify `backend/app/services/merge_engine.py`
- Modify `backend/app/api/data_sources.py`
- Modify `backend/tests/test_merge_engine.py`

**Files (frontend):**
- Modify `frontend/src/hooks/use-data-source-merge.ts`
- Modify `frontend/src/components/dashboard/config-data-grid.tsx`

- [ ] **Step 1: Write failing backend tests**

Edit `/Users/aarun/Workspace/Projects/RecViz/backend/tests/test_merge_engine.py`. Do NOT modify the existing `test_outer_join` (it locks default behavior). Append:

```python
def test_outer_join_coalesce_zero_fills_missing_numeric_cells():
    """coalesce_zero=True fills missing numeric cells in left-only / right-only
    rows with 0. Non-numeric (string/date) cells stay absent — '0' only applies
    to type=='number' columns based on cursor-detected types."""
    left = {
        "columns": [
            {"column_name": "agent_code", "name": "agent_code", "type": "string", "is_date": False},
            {"column_name": "set_id", "name": "set_id", "type": "string", "is_date": False},
            {"column_name": "total_items", "name": "total_items", "type": "number", "is_date": False},
            {"column_name": "automatch_items", "name": "automatch_items", "type": "number", "is_date": False},
        ],
        "rows": [
            {"agent_code": "A1", "set_id": "S1", "total_items": 100, "automatch_items": 90},
            {"agent_code": "A1", "set_id": "S2", "total_items": 200, "automatch_items": 180},
        ],
        "row_count": 2,
    }
    right = {
        "columns": [
            {"column_name": "agent_code", "name": "agent_code", "type": "string", "is_date": False},
            {"column_name": "set_id", "name": "set_id", "type": "string", "is_date": False},
            {"column_name": "total_manual_match_count", "name": "total_manual_match_count", "type": "number", "is_date": False},
        ],
        "rows": [
            {"agent_code": "A1", "set_id": "S1", "total_manual_match_count": 5},
            {"agent_code": "A1", "set_id": "S3", "total_manual_match_count": 10},
        ],
        "row_count": 2,
    }

    result = MergeEngine.merge(
        results=[left, right],
        merge_on=["agent_code", "set_id"],
        merge_type="outer_join",
        coalesce_zero=True,
    )

    assert result["row_count"] == 3
    rows_by_set = {r["set_id"]: r for r in result["rows"]}

    # Matched row — all numeric cells present
    assert rows_by_set["S1"]["total_items"] == 100
    assert rows_by_set["S1"]["total_manual_match_count"] == 5

    # Left-only row — right-side numeric cell coalesced to 0
    assert rows_by_set["S2"]["total_items"] == 200
    assert rows_by_set["S2"]["total_manual_match_count"] == 0

    # Right-only row — both left-side numeric cells coalesced to 0
    assert rows_by_set["S3"]["total_manual_match_count"] == 10
    assert rows_by_set["S3"]["total_items"] == 0
    assert rows_by_set["S3"]["automatch_items"] == 0


def test_outer_join_coalesce_zero_default_off_preserves_existing_behavior():
    """coalesce_zero defaults to False; behavior matches test_outer_join above."""
    left = {
        "columns": [
            {"column_name": "set_id", "name": "set_id", "type": "string", "is_date": False},
            {"column_name": "total_items", "name": "total_items", "type": "number", "is_date": False},
        ],
        "rows": [{"set_id": "S1", "total_items": 100}],
        "row_count": 1,
    }
    right = {
        "columns": [
            {"column_name": "set_id", "name": "set_id", "type": "string", "is_date": False},
            {"column_name": "manual_match", "name": "manual_match", "type": "number", "is_date": False},
        ],
        "rows": [{"set_id": "S2", "manual_match": 5}],
        "row_count": 1,
    }

    result = MergeEngine.merge(
        results=[left, right],
        merge_on=["set_id"],
        merge_type="outer_join",
    )

    rows_by_set = {r["set_id"]: r for r in result["rows"]}
    assert rows_by_set["S1"].get("manual_match") is None
    assert rows_by_set["S2"].get("total_items") is None


def test_outer_join_coalesce_zero_does_not_fill_non_numeric_cells():
    """String/date columns missing from one side stay absent even with
    coalesce_zero=True — filling them with 0 would corrupt downstream
    rendering ('0' showing in a 'Recon Name' column is wrong)."""
    left = {
        "columns": [
            {"column_name": "set_id", "name": "set_id", "type": "string", "is_date": False},
            {"column_name": "total_items", "name": "total_items", "type": "number", "is_date": False},
        ],
        "rows": [{"set_id": "S1", "total_items": 100}],
        "row_count": 1,
    }
    right = {
        "columns": [
            {"column_name": "set_id", "name": "set_id", "type": "string", "is_date": False},
            {"column_name": "recon_name", "name": "recon_name", "type": "string", "is_date": False},
        ],
        "rows": [{"set_id": "S2", "recon_name": "TRADE_RECON_NA"}],
        "row_count": 1,
    }

    result = MergeEngine.merge(
        results=[left, right],
        merge_on=["set_id"],
        merge_type="outer_join",
        coalesce_zero=True,
    )

    rows_by_set = {r["set_id"]: r for r in result["rows"]}
    # numeric column coalesced
    assert rows_by_set["S2"]["total_items"] == 0
    # string column NOT coalesced — stays absent (would serialize as null)
    assert rows_by_set["S1"].get("recon_name") is None
```

- [ ] **Step 2: Run tests to verify failures**

```bash
cd /Users/aarun/Workspace/Projects/RecViz/backend && ./.venv/bin/python -m pytest tests/test_merge_engine.py -v
```
Expected: 2 new `coalesce_zero` tests FAIL with `TypeError: merge() got an unexpected keyword argument 'coalesce_zero'`. Other 3 existing tests + 1 new default-off test still pass.

- [ ] **Step 3: Implement `coalesce_zero` in MergeEngine**

Edit `/Users/aarun/Workspace/Projects/RecViz/backend/app/services/merge_engine.py`. Replace the file body:

```python
from __future__ import annotations


class MergeEngine:
    @staticmethod
    def merge(
        results: list[dict],
        merge_on: list[str],
        merge_type: str = "outer_join",
        coalesce_zero: bool = False,
    ) -> dict:
        if merge_type not in ("outer_join", "inner_join"):
            raise ValueError(f"Unsupported merge_type: {merge_type}")
        if not results:
            return {"columns": [], "rows": [], "row_count": 0}
        if len(results) == 1:
            return {**results[0], "rows": list(results[0]["rows"])}

        merged = results[0]
        for i in range(1, len(results)):
            merged = MergeEngine._merge_two(
                merged, results[i], merge_on, merge_type, coalesce_zero
            )
        return merged

    @staticmethod
    def _merge_two(
        left: dict,
        right: dict,
        merge_on: list[str],
        merge_type: str,
        coalesce_zero: bool,
    ) -> dict:
        def make_key(row: dict) -> tuple:
            return tuple(row.get(k) for k in merge_on)

        # Columns can arrive as list[dict] (real query_engine output, with
        # {column_name, name, type, is_date}) or list[str] (test fixtures).
        # Handle both shapes uniformly.
        def col_name(col):
            return col["column_name"] if isinstance(col, dict) else col

        def col_type(col) -> str | None:
            return col.get("type") if isinstance(col, dict) else None

        right_index: dict[tuple, dict] = {}
        for row in right["rows"]:
            right_index[make_key(row)] = row

        # Build union of column metadata. Preserve left ordering then append
        # unseen right-side columns by name.
        left_names = {col_name(c) for c in left["columns"]}
        all_columns = list(left["columns"])
        for col in right["columns"]:
            if col_name(col) not in left_names:
                all_columns.append(col)

        # Numeric columns participating in zero-fill. Driven by cursor-detected
        # types; strings/dates stay absent (so a missing recon name doesn't
        # render as the literal "0").
        numeric_columns: set[str] = set()
        if coalesce_zero:
            for col in all_columns:
                if col_type(col) == "number":
                    numeric_columns.add(col_name(col))

        left_col_names = {col_name(c) for c in left["columns"]}
        right_col_names = {col_name(c) for c in right["columns"]}

        def fill_missing_zeros(row: dict, present_columns: set[str]) -> dict:
            if not coalesce_zero:
                return row
            for cname in numeric_columns:
                if cname not in present_columns:
                    row[cname] = 0
            return row

        merged_rows = []
        seen_keys = set()

        for lrow in left["rows"]:
            key = make_key(lrow)
            seen_keys.add(key)
            rrow = right_index.get(key)
            if rrow is not None:
                merged_rows.append({**lrow, **rrow})
            elif merge_type == "outer_join":
                # Left-only — right-side numeric columns get 0
                merged_rows.append(fill_missing_zeros({**lrow}, left_col_names))

        if merge_type == "outer_join":
            for rrow in right["rows"]:
                if make_key(rrow) not in seen_keys:
                    # Right-only — left-side numeric columns get 0
                    merged_rows.append(fill_missing_zeros({**rrow}, right_col_names))

        return {
            "columns": all_columns,
            "rows": merged_rows,
            "row_count": len(merged_rows),
        }
```

- [ ] **Step 4: Thread `coalesce_zero` through the API endpoint**

Edit `/Users/aarun/Workspace/Projects/RecViz/backend/app/api/data_sources.py`. Add `coalesce_zero` to `MergeRequest`:

```python
class MergeRequest(BaseModel):
    sources: list[str]
    merge_on: list[str]
    merge_type: str = "outer_join"
    coalesce_zero: bool = False
    filters: dict[str, str | int | list[str] | None] = {}
```

In the handler body, forward the new field to `MergeEngine.merge`:

```python
    merged = MergeEngine.merge(
        results, body.merge_on, body.merge_type, body.coalesce_zero
    )
```

- [ ] **Step 5: Run backend tests to verify all pass**

```bash
cd /Users/aarun/Workspace/Projects/RecViz/backend && ./.venv/bin/python -m pytest tests/test_merge_engine.py -v
```
Expected: 6 tests passing (3 originals + 3 new). `test_outer_join` still passes — `coalesce_zero` defaults to `False`.

- [ ] **Step 6: Wire `coalesceZero` through the frontend hook**

Edit `/Users/aarun/Workspace/Projects/RecViz/frontend/src/hooks/use-data-source-merge.ts`. Extend `MergeConfig` and forward in the POST body:

```tsx
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { FilterValue } from '@/types/filter'
import type { DataSourceQueryResponse } from '@/types/dashboard-config'

export interface MergeConfig {
  sources: string[]
  mergeOn: string[]
  mergeType: string
  coalesceZero?: boolean   // <-- ADD
}

export function useDataSourceMerge(
  mergeConfig: MergeConfig,
  filters: Record<string, FilterValue>,
  enabled: boolean = true,
) {
  return useQuery({
    queryKey: [
      'data-source-merge',
      mergeConfig.sources,
      mergeConfig.mergeOn,
      mergeConfig.mergeType,
      mergeConfig.coalesceZero ?? false,   // <-- ADD to key for cache busting
      filters,
    ],
    queryFn: () =>
      api.post<DataSourceQueryResponse>('/api/data-sources/merge', {
        sources: mergeConfig.sources,
        merge_on: mergeConfig.mergeOn,
        merge_type: mergeConfig.mergeType,
        coalesce_zero: mergeConfig.coalesceZero ?? false,   // <-- ADD
        filters,
      }),
    enabled: enabled && mergeConfig.sources.length > 0,
    placeholderData: keepPreviousData,
  })
}
```

- [ ] **Step 7: Forward `coalesceZero` from GridConfig through MergedSourceGrid**

Edit `/Users/aarun/Workspace/Projects/RecViz/frontend/src/components/dashboard/config-data-grid.tsx`. In `MergedSourceGrid`, update the `mergeConfig` `useMemo` (currently lines ~222-229) to include the new field:

```tsx
const mergeConfig = useMemo(
  () => ({
    sources: (grid.sources ?? []).map((s) => s.dataSourceId),
    mergeOn: grid.mergeOn ?? [],
    mergeType: grid.mergeType ?? 'inner',
    coalesceZero: grid.coalesceZero ?? false,   // <-- ADD
  }),
  [grid.sources, grid.mergeOn, grid.mergeType, grid.coalesceZero],
)
```

- [ ] **Step 8: Run frontend typecheck + lint + tests**

```bash
cd /Users/aarun/Workspace/Projects/RecViz/frontend && npx tsc -b --noEmit && npx eslint src/hooks/use-data-source-merge.ts src/components/dashboard/config-data-grid.tsx && npx vitest run
```
Expected: typecheck passes, lint clean, all tests pass.

- [ ] **Step 9: Smoke against the live backend**

```bash
lsof -iTCP:8000 -sTCP:LISTEN -t | xargs -r kill -9 || true
cd /Users/aarun/Workspace/Projects/RecViz/backend && set -a && source .env && set +a && nohup ./.venv/bin/uvicorn app.main:app --port 8000 > /tmp/recviz-uvicorn.log 2>&1 &
sleep 3 && curl -s http://localhost:8000/health
```
Expected: `{"status":"healthy",...}`.

- [ ] **Step 10: Commit (LOCAL ONLY)**

```bash
cd /Users/aarun/Workspace/Projects/RecViz
git add backend/app/services/merge_engine.py backend/app/api/data_sources.py backend/tests/test_merge_engine.py \
       frontend/src/hooks/use-data-source-merge.ts frontend/src/components/dashboard/config-data-grid.tsx
git commit -m "feat(merge): coalesce_zero end-to-end — backend MergeRequest + frontend MergeConfig/GridConfig wire-up (Plan 4 §12.6)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: `FilterMapping.options` + `_build_date_range_clause(exclude_today)`

**Files:**
- Modify `backend/app/models/data_source_config.py`
- Modify `backend/app/services/query_engine.py`
- Modify/create test file under `backend/tests/`

- [ ] **Step 1: Locate existing query_engine tests**

```bash
cd /Users/aarun/Workspace/Projects/RecViz/backend && ls tests/ | grep -i -E "query|date|filter" && grep -rn "_build_date_range_clause\|date_range_clause" tests/ 2>/dev/null
```
If a test file already covers `_build_date_range_clause`, append to it; otherwise create `tests/test_date_range_clause.py`.

- [ ] **Step 2: Write failing tests**

Append or create:

```python
import pytest
from app.services.query_engine import QueryExecutor


@pytest.fixture
def qx():
    """Bare QueryExecutor for testing pure methods. `__new__` bypasses any
    init validation; we only need the unbound `_build_date_range_clause`
    and `_build_sql` methods. Verify QueryExecutor has no __slots__ issue
    at execution — if it does, replace with `unittest.mock.create_autospec`."""
    return QueryExecutor.__new__(QueryExecutor)


def test_date_range_clause_default_ends_at_sysdate(qx):
    """RecViz/QuickRec default — includes today."""
    assert qx._build_date_range_clause(7, "oracle") == "BETWEEN SYSDATE - 7 AND SYSDATE"
    assert qx._build_date_range_clause(30, "oracle") == "BETWEEN SYSDATE - 30 AND SYSDATE"


def test_date_range_clause_exclude_today_ends_at_sysdate_minus_one(qx):
    """Legacy TLM — excludes today (parity with TlmStatsV2Service.getDateRangeClause:627-632)."""
    assert qx._build_date_range_clause(7, "oracle", exclude_today=True) == "BETWEEN SYSDATE - 7 AND SYSDATE - 1"
    assert qx._build_date_range_clause(30, "oracle", exclude_today=True) == "BETWEEN SYSDATE - 30 AND SYSDATE - 1"


def test_date_range_clause_days_one_default_business_day(qx):
    """value==1 uses business-day DECODE; default end is SYSDATE."""
    clause = qx._build_date_range_clause(1, "oracle")
    assert "TRUNC(SYSDATE)" in clause
    assert "DECODE(TO_CHAR(SYSDATE,'D')" in clause
    assert clause.endswith("AND SYSDATE")
    assert "AND SYSDATE - 1" not in clause


def test_date_range_clause_days_one_exclude_today_business_day(qx):
    """value==1 + exclude_today: business-day DECODE with SYSDATE-1 end."""
    clause = qx._build_date_range_clause(1, "oracle", exclude_today=True)
    assert "TRUNC(SYSDATE)" in clause
    assert clause.endswith("AND SYSDATE - 1")


def test_filter_mapping_options_threaded_to_date_clause(qx):
    """A FilterMapping with options={exclude_today: True} produces a
    SYSDATE-1-ending clause when substituted via _build_sql."""
    from app.models.data_source_config import (
        ColumnDef, DataSourceConfig, DatabaseRoutingMapping, FilterMapping,
    )
    ds = DataSourceConfig(
        id="test",
        name="test",
        database_routing=DatabaseRoutingMapping(type="static", database="test-db"),
        query="SELECT * FROM t WHERE 1=1 {{filters}}",
        filter_mappings=[
            FilterMapping(
                filter_id="date_range_days",
                sql_expr="stmt_date {{date_range_clause}}",
                options={"exclude_today": True},
            )
        ],
        columns=[ColumnDef(name="stmt_date", type="date")],
    )
    sql = qx._build_sql(ds, {"date_range_days": 7}, dialect="oracle")
    assert "BETWEEN SYSDATE - 7 AND SYSDATE - 1" in sql


def test_filter_mapping_options_default_off_uses_sysdate(qx):
    """Missing `options` defaults to exclude_today=False (the existing behavior)."""
    from app.models.data_source_config import (
        ColumnDef, DataSourceConfig, DatabaseRoutingMapping, FilterMapping,
    )
    ds = DataSourceConfig(
        id="test",
        name="test",
        database_routing=DatabaseRoutingMapping(type="static", database="test-db"),
        query="SELECT * FROM t WHERE 1=1 {{filters}}",
        filter_mappings=[
            FilterMapping(
                filter_id="date_range_days",
                sql_expr="stmt_date {{date_range_clause}}",
            )
        ],
        columns=[ColumnDef(name="stmt_date", type="date")],
    )
    sql = qx._build_sql(ds, {"date_range_days": 7}, dialect="oracle")
    assert "BETWEEN SYSDATE - 7 AND SYSDATE" in sql
    assert "AND SYSDATE - 1" not in sql
```

- [ ] **Step 3: Run tests to verify failures**

```bash
cd /Users/aarun/Workspace/Projects/RecViz/backend && ./.venv/bin/python -m pytest tests/test_date_range_clause.py -v
```
Expected: 6 new tests FAIL.

- [ ] **Step 4: Add `options` to `FilterMapping`**

Edit `/Users/aarun/Workspace/Projects/RecViz/backend/app/models/data_source_config.py`:

```python
class FilterMapping(BaseModel):
    filter_id: str
    sql_expr: str
    options: dict | None = None    # <-- ADD. The RecvizDataset.filter_mappings
                                   # column is OracleJSON, so this field is
                                   # absorbed without a schema migration.
```

- [ ] **Step 5: Parameterize `_build_date_range_clause`**

Edit `/Users/aarun/Workspace/Projects/RecViz/backend/app/services/query_engine.py`. Replace the helper (currently at lines ~94-106):

```python
def _build_date_range_clause(
    self,
    value: int,
    dialect: str = "oracle",
    *,
    exclude_today: bool = False,
) -> str:
    """Build a SQL BETWEEN clause for a relative date range.

    Default semantics (RecViz / QuickRec): inclusive of today —
        BETWEEN SYSDATE - N AND SYSDATE

    Legacy TLM semantics (`exclude_today=True`): exclusive of today —
        BETWEEN SYSDATE - N AND SYSDATE - 1
    Matches `TlmStatsV2Service.getDateRangeClause` (Java) lines 625-632.

    The dataset opts in via `FilterMapping.options.exclude_today`.
    """
    end = "SYSDATE - 1" if exclude_today else "SYSDATE"

    if dialect == "oracle":
        if value == 1:
            return (
                "BETWEEN TRUNC(SYSDATE) - "
                "DECODE(TO_CHAR(SYSDATE,'D'), '1',2, '2',3, '7',1, 1) "
                f"AND {end}"
            )
        return f"BETWEEN SYSDATE - {value} AND {end}"
    elif dialect == "sqlite":
        # SQLite branch: dev/test only. TLM datasets are Oracle-only, so the
        # exclude_today toggle currently has no SQLite analogue.
        return f"BETWEEN date('now', '-{value} days') AND date('now')"
    else:
        return f"BETWEEN CURRENT_DATE - INTERVAL '{value} days' AND CURRENT_DATE"
```

- [ ] **Step 6: Thread `fm.options` through the substitution site**

In the same file, find the `{{date_range_clause}}` substitution block (currently at lines ~139-142). Update:

```python
if "{{date_range_clause}}" in expr:
    opts = fm.options or {}
    exclude_today = bool(opts.get("exclude_today", False))
    clause = self._build_date_range_clause(
        int(fval), dialect, exclude_today=exclude_today
    )
    expr = expr.replace("{{date_range_clause}}", clause)
```

- [ ] **Step 7: Run tests + full suite**

```bash
cd /Users/aarun/Workspace/Projects/RecViz/backend && ./.venv/bin/python -m pytest tests/test_date_range_clause.py -v && ./.venv/bin/python -m pytest tests/ -v
```
Expected: 6 new tests pass; no new failures elsewhere.

- [ ] **Step 8: Smoke-restart uvicorn**

```bash
lsof -iTCP:8000 -sTCP:LISTEN -t | xargs -r kill -9 || true
cd /Users/aarun/Workspace/Projects/RecViz/backend && set -a && source .env && set +a && nohup ./.venv/bin/uvicorn app.main:app --port 8000 > /tmp/recviz-uvicorn.log 2>&1 &
sleep 3 && curl -s http://localhost:8000/health
```

- [ ] **Step 9: Commit (LOCAL ONLY)**

```bash
cd /Users/aarun/Workspace/Projects/RecViz
git add backend/app/models/data_source_config.py backend/app/services/query_engine.py backend/tests/
git commit -m "feat(filters): FilterMapping.options + exclude_today date-clause variant (Plan 4 §12.7)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: Register `conn-reconmgmt` + three TLM datasets

**Files:**
- Modify `scripts/seed-oracle.py` — extend `seed_connection`, append to `CURATED_DATASETS`, bump assertion gate.

- [ ] **Step 1: Register `conn-reconmgmt` in `seed_connection`**

Edit `/Users/aarun/Workspace/Projects/RecViz/scripts/seed-oracle.py`. Inside `seed_connection` (lines ~3591-3678), append a fourth `cur.execute(...)` block after the `conn-tcosprd` block. Mirror the `conn-recportal` / `conn-tcosprd` shape exactly (14-column INSERT with `:1..:12` + two `SYSTIMESTAMP`):

```python
    # TLM dashboard integration (Plan 4): register a connection to the
    # reconmgmt schema in the sibling rectrace-local-dev FREEPDB1 stack.
    # RECONMGMT owns mr_csum_man_match_details + mr_csum_netting_hist
    # which the ds-tlm-manual-match dataset reads via static routing for
    # the cross-DB merge against the dynamic-routed ds-tlm-automatch.
    cur.execute(
        "INSERT INTO recviz_connections "
        "(id, name, display_name, backend, host, port, database_name, "
        "username, encrypted_password, schema_name, extra_params, status, "
        "created_at, updated_at) "
        "VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, :10, :11, :12, "
        "SYSTIMESTAMP, SYSTIMESTAMP)",
        (
            "conn-reconmgmt",
            "reconmgmt",
            "Reconmgmt Oracle (rectrace-local-dev)",
            "oracle",
            host,
            port,
            service,
            "reconmgmt",
            _encrypt_password("reconmgmt_pwd"),
            "RECONMGMT",
            _jb({"timeout": 30}),
            "active",
        ),
    )
```

Then bump the hardcoded summary print (currently at lines ~3675-3678):

```python
    print(
        f"  recviz_connections: 4 rows "
        f"(recviz/{schema_name}, recportal/RECPORTAL, tcosprd/TCOSPRD, reconmgmt/RECONMGMT)"
    )
```

- [ ] **Step 2: Define `TLM_INSTANCE_MAPPING` near `CURATED_DATASETS`**

In the same file, find `CURATED_DATASETS` (search for `CURATED_DATASETS = `). Just before the list assignment, add the dynamic-routing mapping:

```python
# Friendly TLM-instance name → RecViz connection NAME (NOT id). The
# ConnectionResolver cache keys on `recviz_connections.name`. Only
# TLMP_CONSUMER has a local seed (Plan 3 Task 4 registered conn-tcosprd
# with name="tcosprd"). Production would seed every entry from
# TlmStatsV2Service.TLM_INSTANCE_MAP (38-50). A requested filter value
# not in the mapping surfaces as a clear "no database mapping" error.
TLM_INSTANCE_MAPPING: dict[str, str] = {
    "TLMP_CONSUMER": "tcosprd",
}
```

**CRITICAL** — `database_routing.database` and `mapping` values must be connection **NAMES** (`"tcosprd"`, `"reconmgmt"`), NOT ids (`"conn-tcosprd"`, `"conn-reconmgmt"`). The resolver at `backend/app/services/connection_resolver.py:55` caches by `row.name`. Using ids will produce a runtime "Database 'conn-X' not registered" error.

- [ ] **Step 3: Append `ds-tlm-automatch` to `CURATED_DATASETS`**

```python
    {
        "id": "ds-tlm-automatch",
        "name": "TLM Automatch",
        "description": (
            "Per-TLM-instance automatch + total-items counts grouped by "
            "(tlm_instance, agent_code, set_id, stmt_date, bran_code, "
            "corr_acc_no). Source-of-truth: TlmStatsV2Service.buildAutomatchQuery "
            "(451-491). Dynamic-routed by tlm_instance filter."
        ),
        "database_routing": {
            "type": "dynamic",
            "route_by_filter": "tlm_instance",
            "mapping": TLM_INSTANCE_MAPPING,
        },
        "sql_template": (
            "SELECT "
            "  sys_context('USERENV', 'DB_NAME') AS tlm_instance, "
            "  b.agent_code, "
            "  b.local_acc_no AS set_id, "
            "  i.stmt_date, "
            "  i.bran_code, "
            "  b.corr_acc_no, "
            "  SUM(CASE WHEN i.flag_2 IN (0,1,11) THEN 1 ELSE 0 END) AS total_items, "
            "  SUM(CASE WHEN th.last_action_owner IN ('SYSTEM','system','AUTONET') "
            "       AND i.flag_2 = 1 THEN 1 ELSE 0 END) AS automatch_items "
            "FROM bank b, message_feed mf, item i, tlm_bdr_relationship_header th "
            "WHERE b.corr_acc_no = mf.corr_acc_no "
            "  AND mf.corr_acc_no = i.corr_acc_no "
            "  AND mf.short_code = i.short_no "
            "  AND i.relationship_id = th.relationship_id (+) "
            "  AND mf.mlnv NOT IN ('9060','9066') "
            "  {{filters}} "
            "GROUP BY b.agent_code, b.local_acc_no, i.stmt_date, i.bran_code, b.corr_acc_no "
            "ORDER BY b.agent_code, b.local_acc_no, i.stmt_date, i.bran_code, b.corr_acc_no"
        ),
        "columns": [
            _col("tlm_instance", "TLM Instance", "string", "dimension"),
            _col("agent_code", "Recon", "string", "dimension"),
            _col("set_id", "Set ID", "string", "dimension"),
            _col("stmt_date", "Statement Date", "date", "time"),
            _col("bran_code", "Branch", "string", "dimension"),
            _col("corr_acc_no", "Correspondent Acct", "string", "dimension"),
            _col("total_items", "Total Items", "number", "measure", "SUM", "number"),
            _col("automatch_items", "Automatch Items", "number", "measure", "SUM", "number"),
        ],
        "filter_mappings": [
            # tlm_instance: consumed by the dynamic router BEFORE substitution.
            # Listed so the frontend filter bar exposes it; `1=1` keeps the
            # substitution loop from emitting `AND <empty>` in the SQL.
            {"filter_id": "tlm_instance", "sql_expr": "1=1"},
            {"filter_id": "recon",        "sql_expr": "b.agent_code IN ({{values}})"},
            {"filter_id": "set_id",       "sql_expr": "b.local_acc_no IN ({{values}})"},
            {
                "filter_id": "date_range_days",
                "sql_expr": "i.stmt_date {{date_range_clause}}",
                "options": {"exclude_today": True},
            },
        ],
    },
```

**SQL substitution shape** — `_build_sql` (`query_engine.py` ~108-160) prepends `AND ` to each filter clause automatically (line 152: `filter_clauses.append(f"AND {expr}")`). The `sql_expr` values above therefore do NOT carry a leading `AND`. Verify against the live code before pasting; if the loop has changed, prepend `AND ` to match.

- [ ] **Step 4: Append `ds-tlm-breaks` to `CURATED_DATASETS`**

The legacy breaks query has filters in a CTE and the date filter in the outer SELECT. RecViz's single `{{filters}}` placeholder forces us to land all filters in one substitution point. The CTE materializes the full `bank ⋈ message_feed` pairing; the outer SELECT applies all filters with `s.` (CTE alias) and `i.` (item alias) qualifiers:

```python
    {
        "id": "ds-tlm-breaks",
        "name": "TLM Breaks",
        "description": (
            "Per-TLM-instance break counts grouped by (agent_code, set_id, "
            "stmt_date, bran_code). Source-of-truth: "
            "TlmStatsV2Service.buildBreaksQuery (388-448). Dynamic-routed by "
            "tlm_instance filter."
        ),
        "database_routing": {
            "type": "dynamic",
            "route_by_filter": "tlm_instance",
            "mapping": TLM_INSTANCE_MAPPING,
        },
        "sql_template": (
            "WITH static AS ( "
            "  SELECT "
            "    f.mlnv, f.sub_acc_no, f.short_code, f.latest_stmt_date, "
            "    f.latest_stmt_no, k.agent_code, k.local_acc_no, k.corr_acc_no "
            "  FROM bank k, message_feed f "
            "  WHERE f.corr_acc_no = k.corr_acc_no "
            ") "
            "SELECT "
            "  COUNT(*) AS breaks_count, "
            "  s.agent_code, "
            "  s.local_acc_no AS set_id, "
            "  i.stmt_date, "
            "  i.bran_code "
            "FROM item i, static s "
            "WHERE s.corr_acc_no = i.corr_acc_no "
            "  AND i.flag_2 = 0 "
            "  {{filters}} "
            "GROUP BY s.agent_code, s.local_acc_no, i.stmt_date, i.bran_code"
        ),
        "columns": [
            _col("agent_code",   "Recon", "string", "dimension"),
            _col("set_id",       "Set ID", "string", "dimension"),
            _col("stmt_date",    "Statement Date", "date", "time"),
            _col("bran_code",    "Branch", "string", "dimension"),
            _col("breaks_count", "Break Count", "number", "measure", "SUM", "number"),
        ],
        "filter_mappings": [
            {"filter_id": "tlm_instance", "sql_expr": "1=1"},
            # Agent/set reference the `s.` alias (the CTE) because they're
            # applied in the outer SELECT, not inside the CTE.
            {"filter_id": "recon",            "sql_expr": "s.agent_code IN ({{values}})"},
            {"filter_id": "set_id",           "sql_expr": "s.local_acc_no IN ({{values}})"},
            {
                "filter_id": "date_range_days",
                "sql_expr": "i.stmt_date {{date_range_clause}}",
                "options": {"exclude_today": True},
            },
        ],
    },
```

- [ ] **Step 5: Append `ds-tlm-manual-match` to `CURATED_DATASETS`**

The reconmgmt schema columns differ between the two manual-match source tables (verified against `rectrace-local-dev/schema/03-reconmgmt.sql:47-71`):

- `mr_csum_man_match_details`: `agent_code, setid, corr_acc_no, bran_code, tlm_instance, stmt_date` — set-id column is `setid` (no underscore).
- `mr_csum_netting_hist`: `agent_code, local_acc_no, corr_acc_no, bran_code, tlm_instance, stmt_date` — no `setid`; uses `local_acc_no`.

Legacy `TlmStatsV2Service.buildManualMatchQuery` (547-622) handles this by projecting `setid` directly in leg 1 and `local_acc_no AS setid` in leg 2. We use the SAME aliasing strategy but normalize to `set_id` (with underscore) so the merge key matches `ds-tlm-automatch`'s alias:

```python
    {
        "id": "ds-tlm-manual-match",
        "name": "TLM Manual Match",
        "description": (
            "Reconmgmt manual-match counts: UNION ALL of "
            "mr_csum_man_match_details and mr_csum_netting_hist, grouped by "
            "(tlm_instance, agent_code, set_id, stmt_date, bran_code, "
            "corr_acc_no). Static-routed to conn-reconmgmt. Source-of-truth: "
            "TlmStatsV2Service.buildManualMatchQuery (547-622). Inner SELECTs "
            "alias setid (leg 1) and local_acc_no (leg 2) to a common set_id "
            "column so the outer {{filters}} substitution applies cleanly to "
            "both legs and the merge_on key matches ds-tlm-automatch."
        ),
        "database_routing": {"type": "static", "database": "reconmgmt"},
        "sql_template": (
            "SELECT tlm_instance, agent_code, set_id, stmt_date, bran_code, "
            "       corr_acc_no, SUM(manual_match_count) AS total_manual_match_count "
            "FROM ( "
            "  SELECT m.tlm_instance, m.agent_code, m.setid AS set_id, "
            "         m.corr_acc_no, m.bran_code, m.stmt_date, "
            "         1 AS manual_match_count "
            "  FROM mr_csum_man_match_details m "
            "  UNION ALL "
            "  SELECT n.tlm_instance, n.agent_code, n.local_acc_no AS set_id, "
            "         n.corr_acc_no, n.bran_code, n.stmt_date, "
            "         1 AS manual_match_count "
            "  FROM mr_csum_netting_hist n "
            ") "
            "WHERE 1=1 {{filters}} "
            "GROUP BY tlm_instance, agent_code, set_id, stmt_date, bran_code, corr_acc_no"
        ),
        "columns": [
            _col("tlm_instance", "TLM Instance", "string", "dimension"),
            _col("agent_code", "Recon", "string", "dimension"),
            _col("set_id", "Set ID", "string", "dimension"),
            _col("stmt_date", "Statement Date", "date", "time"),
            _col("bran_code", "Branch", "string", "dimension"),
            _col("corr_acc_no", "Correspondent Acct", "string", "dimension"),
            _col("total_manual_match_count", "Manual Match Count", "number", "measure", "SUM", "number"),
        ],
        "filter_mappings": [
            {"filter_id": "tlm_instance",    "sql_expr": "tlm_instance = '{{value}}'"},
            {"filter_id": "recon",           "sql_expr": "agent_code IN ({{values}})"},
            {"filter_id": "set_id",          "sql_expr": "set_id IN ({{values}})"},
            {
                "filter_id": "date_range_days",
                "sql_expr": "stmt_date {{date_range_clause}}",
                "options": {"exclude_today": True},
            },
        ],
    },
```

- [ ] **Step 6: Bump the `CURATED_DATASETS` assertion**

Find the line `assert len(CURATED_DATASETS) == 23` (currently at line ~1746). Bump to `26` (3 new entries):

```python
assert len(CURATED_DATASETS) == 26, (
    f"CURATED_DATASETS must have 26 entries, got {len(CURATED_DATASETS)}"
)
```

- [ ] **Step 7: Re-run the seed and verify the connections**

```bash
cd /Users/aarun/Workspace/Projects/RecViz/backend && PYTHONPATH=. ./.venv/bin/python ../scripts/seed-oracle.py 2>&1 | tail -20
```
Expected: completes; tail shows `recviz_connections: 4 rows (recviz/RECVIZ, recportal/RECPORTAL, tcosprd/TCOSPRD, reconmgmt/RECONMGMT)`.

```bash
curl -s "http://localhost:8000/api/databases" | python -m json.tool
```
Expected: lists 4 databases including `conn-reconmgmt`.

- [ ] **Step 8: Verify each dataset preview**

```bash
# Automatch (requires tlm_instance for dynamic routing)
curl -s -X POST http://localhost:8000/api/data-sources/ds-tlm-automatch/preview \
  -H 'content-type: application/json' \
  -d '{"filters":{"tlm_instance":"TLMP_CONSUMER","date_range_days":7}}' | python -m json.tool | head -40

# Breaks (same dynamic routing)
curl -s -X POST http://localhost:8000/api/data-sources/ds-tlm-breaks/preview \
  -H 'content-type: application/json' \
  -d '{"filters":{"tlm_instance":"TLMP_CONSUMER","date_range_days":7}}' | python -m json.tool | head -40

# Manual-match (static-routed to reconmgmt)
curl -s -X POST http://localhost:8000/api/data-sources/ds-tlm-manual-match/preview \
  -H 'content-type: application/json' \
  -d '{"filters":{"tlm_instance":"TLMP_CONSUMER","date_range_days":7}}' | python -m json.tool | head -40
```
Expected: each returns rows. Inspect counts; with Plan 3's seed (tcosprd: 55 banks, 7550 items; reconmgmt: matching keys for TLMP_CONSUMER) the breaks/automatch return aggregated rows per (agent_code, set_id, stmt_date, bran_code, corr_acc_no), and manual-match returns the reconmgmt-side counts.

- [ ] **Step 9: Verify the cross-DB merge with `coalesce_zero=true`**

```bash
curl -s -X POST http://localhost:8000/api/data-sources/merge \
  -H 'content-type: application/json' \
  -d '{
    "sources": ["ds-tlm-automatch","ds-tlm-manual-match"],
    "merge_on": ["tlm_instance","agent_code","set_id","stmt_date","bran_code","corr_acc_no"],
    "merge_type": "outer_join",
    "coalesce_zero": true,
    "filters": {"tlm_instance":"TLMP_CONSUMER","date_range_days":7}
  }' | python -m json.tool | head -80
```
Expected: rows where matched ones have all 3 numeric columns populated; any left-only rows have `total_manual_match_count: 0`; any right-only rows have `total_items: 0, automatch_items: 0`. With Plan 3's seed the overlap may be near-100% on volume rows — the coalesce_zero behavior is unit-tested in Task 2; this curl is a sanity check that the SQL + routing + merge endpoint all wire together.

- [ ] **Step 10: Commit (LOCAL ONLY)**

```bash
cd /Users/aarun/Workspace/Projects/RecViz
git add scripts/seed-oracle.py
git commit -m "feat(seed): register conn-reconmgmt + 3 TLM datasets (Plan 4 §12.5/§12.8)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: TLM dashboard + 4 KPIs

**Files:**
- Modify `scripts/seed-oracle.py` — append 4 KPIs to `CURATED_KPIS`, append `dash-tlm-stats` to `CURATED_DASHBOARDS`, bump assertion gates.

- [ ] **Step 1: Register 4 TLM KPIs**

Find `CURATED_KPIS` in `scripts/seed-oracle.py`. Append before its closing `]`:

```python
    # ---- TLM dashboard KPIs (Plan 4) ----
    _kpi("kpi-tlm-total-items", "Total Items",
         "Sum of items across the filtered TLM instance scope.",
         "ds-tlm-automatch", "total_items", "SUM",
         fmt={"type": "number", "decimals": 0, "abbreviate": True, "currencyCode": None},
         trend=None, thresholds=None, subtitle="TLM totals"),
    _kpi("kpi-tlm-automatch", "Automatched",
         "System-matched items (flag_2=1 + owner∈{SYSTEM,system,AUTONET}); percentage of total items.",
         "ds-tlm-automatch", "automatch_items", "SUM",
         fmt={"type": "number", "decimals": 0, "abbreviate": True, "currencyCode": None},
         trend=None, thresholds=None, subtitle="TLM totals"),
    _kpi("kpi-tlm-total-breaks", "Total Breaks",
         "Sum of break counts (flag_2=0) across the filtered TLM instance scope.",
         "ds-tlm-breaks", "breaks_count", "SUM",
         fmt={"type": "number", "decimals": 0, "abbreviate": True, "currencyCode": None},
         trend=None, thresholds=None, subtitle="TLM totals"),
    _kpi("kpi-tlm-manual-match", "Manual Matched",
         "Manual matches from reconmgmt; percentage of total items.",
         "ds-tlm-manual-match", "total_manual_match_count", "SUM",
         fmt={"type": "number", "decimals": 0, "abbreviate": True, "currencyCode": None},
         trend=None, thresholds=None, subtitle="TLM totals"),
```

- [ ] **Step 2: Bump the `CURATED_KPIS` assertion**

Find `assert len(CURATED_KPIS) == 18` (line ~2620). Bump:

```python
assert len(CURATED_KPIS) == 22, (
    f"CURATED_KPIS must have 22 entries, got {len(CURATED_KPIS)}"
)
```

- [ ] **Step 3: Register the TLM dashboard**

Find `CURATED_DASHBOARDS` and append before its closing `]`. Mirror the `dash-quickrec-stats` inline KPI pattern (NOT `_kpi_card()` — that helper doesn't carry `trend` or `accentColor`):

```python
    # ---- TLM Stats dashboard (Plan 4) ----
    # Cross-DB merge dashboard. Filter bar: tlm_instance + recon + set_id + date_range.
    # KPIs: total_items / automatched (with % trend) / total_breaks / manual_matched (with % trend).
    # Grids: reconciliation (cross-DB merge of automatch + manual-match with coalesceZero)
    # gated visibleWhen total_items > 0; breaks gated visibleWhen total_breaks > 0.
    {
        "id": "dash-tlm-stats",
        "name": "TLM Statistics",
        "description": "Per-TLM-instance reconciliation and breaks for the filtered scope.",
        "config": {
            "id": "dash-tlm-stats",
            "name": "TLM Statistics",
            "description": "Per-TLM-instance reconciliation and breaks for the filtered scope.",
            "features": {"crossFilter": False, "drillDown": False},
            "filters": [
                # tlm_instance: single-select with dynamic options sourced from
                # the automatch dataset's distinct tlm_instance values. lockable
                # because the rectrace cell-click flow locks it.
                {"id": "tlm_instance", "label": "TLM Instance", "type": "single-select", "lockable": True,
                 "optionsSource": {"dataSourceId": "ds-tlm-automatch", "valueColumn": "tlm_instance", "dependsOn": {}},
                 "options": [], "defaultValue": None},
                # recon: multi-select with dynamic options. lockable per set_id
                # entry-point flow (cell click on set_id locks both tlm_instance
                # and recon).
                {"id": "recon", "label": "Recon", "type": "multi-select", "lockable": True,
                 "optionsSource": {"dataSourceId": "ds-tlm-automatch", "valueColumn": "agent_code", "dependsOn": {"tlm_instance": "tlm_instance"}},
                 "options": [], "defaultValue": None},
                # set_id: multi-select with dynamic options that cascade on recon.
                {"id": "set_id", "label": "Set ID", "type": "multi-select", "lockable": True,
                 "optionsSource": {"dataSourceId": "ds-tlm-automatch", "valueColumn": "set_id", "dependsOn": {"tlm_instance": "tlm_instance", "recon": "agent_code"}},
                 "options": [], "defaultValue": None},
                # date_range: preset-range. Defaults to 1 day per legacy Angular
                # behavior (DateRange.ONE_DAY in TlmStatsModalV2Component).
                {"id": "date_range_days", "label": "Date Range", "type": "preset-range", "lockable": False,
                 "optionsSource": None,
                 "options": [
                     {"label": "Last 1 day", "value": 1},
                     {"label": "Last 7 days", "value": 7},
                     {"label": "Last 30 days", "value": 30},
                 ],
                 "defaultValue": 1},
            ],
            "kpis": [
                # Inline KPI cards (NOT _kpi_card()). _kpi_card doesn't carry
                # trend or accentColor — mirror dash-quickrec-stats's inline
                # pattern instead. accentColor: records=blue, breaks=warning,
                # auto=positive green, manual=violet.
                {"id": "kpi-tlm-total-items", "label": "Total Items", "format": "number",
                 "sources": [{"dataSourceId": "ds-tlm-automatch", "metric": "total_items"}],
                 "aggregation": "SUM",
                 "accentColor": "--chart-1"},
                {"id": "kpi-tlm-automatch", "label": "Automatched", "format": "number",
                 "sources": [{"dataSourceId": "ds-tlm-automatch", "metric": "automatch_items"}],
                 "aggregation": "SUM",
                 "trend": {"type": "percentage_of", "referenceKpi": "kpi-tlm-total-items", "display": "ratio"},
                 "accentColor": "--chart-positive"},
                {"id": "kpi-tlm-total-breaks", "label": "Total Breaks", "format": "number",
                 "sources": [{"dataSourceId": "ds-tlm-breaks", "metric": "breaks_count"}],
                 "aggregation": "SUM",
                 "accentColor": "--chart-warning"},
                {"id": "kpi-tlm-manual-match", "label": "Manual Matched", "format": "number",
                 "sources": [{"dataSourceId": "ds-tlm-manual-match", "metric": "total_manual_match_count"}],
                 "aggregation": "SUM",
                 "trend": {"type": "percentage_of", "referenceKpi": "kpi-tlm-total-items", "display": "ratio"},
                 "accentColor": "--series-8"},
            ],
            "charts": [],
            "grids": [
                # Reconciliation grid: cross-DB merge of automatch ⋈ manual-match.
                # Top-level `sources` / `mergeOn` / `mergeType` / `coalesceZero`
                # match the GridConfig type (NOT a nested `merge: {...}`).
                {"id": "grid-tlm-reconciliation", "title": "Reconciliation",
                 "sources": [{"dataSourceId": "ds-tlm-automatch"}, {"dataSourceId": "ds-tlm-manual-match"}],
                 "mergeOn": ["tlm_instance", "agent_code", "set_id", "stmt_date", "bran_code", "corr_acc_no"],
                 "mergeType": "outer_join",
                 "coalesceZero": True,
                 "columns": [
                     {"field": "tlm_instance",             "header": "TLM Instance", "type": "string"},
                     {"field": "agent_code",               "header": "Recon", "type": "string"},
                     {"field": "set_id",                   "header": "Set ID", "type": "string"},
                     {"field": "stmt_date",                "header": "Statement Date", "type": "date"},
                     {"field": "bran_code",                "header": "Branch", "type": "string"},
                     {"field": "corr_acc_no",              "header": "Correspondent Acct", "type": "string"},
                     {"field": "total_items",              "header": "Total Items", "type": "number"},
                     {"field": "automatch_items",          "header": "Automatched", "type": "number"},
                     {"field": "total_manual_match_count", "header": "Manual Match", "type": "number"},
                 ],
                 "visibleWhen": {"kpi": "kpi-tlm-total-items", "condition": "gt", "value": 0},
                 "layout": _layout(0, 1, 12, 5)},
                # Breaks grid: single-source from ds-tlm-breaks. Gated visibleWhen
                # total_breaks > 0 — matches legacy `dashboardSummary.total_breaks > 0`
                # template conditional.
                {"id": "grid-tlm-breaks", "title": "Breaks",
                 "dataSourceId": "ds-tlm-breaks",
                 "columns": [
                     {"field": "agent_code",   "header": "Recon", "type": "string"},
                     {"field": "set_id",       "header": "Set ID", "type": "string"},
                     {"field": "stmt_date",    "header": "Statement Date", "type": "date"},
                     {"field": "bran_code",    "header": "Branch", "type": "string"},
                     {"field": "breaks_count", "header": "Break Count", "type": "number"},
                 ],
                 "visibleWhen": {"kpi": "kpi-tlm-total-breaks", "condition": "gt", "value": 0},
                 "layout": _layout(0, 6, 12, 4)},
            ],
            "layout": {"type": "flow", "sections": ["filters", "kpis", "grids"]},
            "autoRefreshInterval": 0,
        },
    },
```

- [ ] **Step 4: Bump the `CURATED_DASHBOARDS` assertion**

Find `assert len(CURATED_DASHBOARDS) == 10` (line ~3486). Bump:

```python
assert len(CURATED_DASHBOARDS) == 11, (
    f"CURATED_DASHBOARDS must have 11 entries, got {len(CURATED_DASHBOARDS)}"
)
```

- [ ] **Step 5: Re-seed and verify**

```bash
cd /Users/aarun/Workspace/Projects/RecViz/backend && PYTHONPATH=. ./.venv/bin/python ../scripts/seed-oracle.py 2>&1 | tail -10
curl -s "http://localhost:8000/api/dashboards/dash-tlm-stats" | python -m json.tool | head -80
```
Expected: dashboard JSON returns with 4 filters, 4 KPIs (3 with trend), 2 grids (reconciliation with `sources`/`mergeOn`/`mergeType`/`coalesceZero`; breaks with `dataSourceId`).

- [ ] **Step 6: Eyeball the embed**

```bash
echo "Open: http://localhost:5173/embed/dashboards/dash-tlm-stats?filter.tlm_instance=TLMP_CONSUMER&filter.lock=tlm_instance&theme=light"
```
Expected: embed page loads, KPIs populate, reconciliation grid renders, breaks grid renders if total_breaks > 0 (or auto-hides if 0).

- [ ] **Step 7: Commit (LOCAL ONLY)**

```bash
cd /Users/aarun/Workspace/Projects/RecViz
git add scripts/seed-oracle.py
git commit -m "feat(seed): register dash-tlm-stats + 4 TLM KPIs (Plan 4)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: `TlmStatsCellRenderer` in rectrace React

**Files:**
- Create `frontend-react/src/search/renderers/TlmStatsCellRenderer.tsx`
- Create `frontend-react/src/search/renderers/TlmStatsCellRenderer.test.tsx`
- Modify `frontend-react/src/search/renderers/registry.ts`
- Modify `frontend-react/src/search/__tests__/registry.test.ts`

- [ ] **Step 1: Verify the rectrace branch**

```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer && git status -sb
```
Expected: `## milestone/modernization...`. If not, `git checkout milestone/modernization`.

- [ ] **Step 2: Read the QuickRec precedent (don't modify — read for verbatim shape)**

```bash
cat frontend-react/src/search/renderers/QuickRecStatsCellRenderer.tsx
cat frontend-react/src/search/renderers/QuickRecStatsCellRenderer.test.tsx
cat frontend-react/src/search/renderers/registry.ts
cat frontend-react/src/search/__tests__/registry.test.ts
```
Note: component signature is `(params: ICellRendererParams)`, entryPoint reads from `params.colDef.cellRendererParams.entryPoint`, modal state via `useState`, theme via `useTheme()`, URL via `buildEmbedUrl()`, returns `null` for empty/dash values, uses plain `<button>` (NOT shadcn `Button`), renders `<RecvizDashboardModal>` inline.

- [ ] **Step 3: Write the failing test**

Create `/Users/aarun/Workspace/Projects/autosys-job-explorer/frontend-react/src/search/renderers/TlmStatsCellRenderer.test.tsx`. Mirror `QuickRecStatsCellRenderer.test.tsx` mocking pattern verbatim:

```tsx
import type { ComponentProps } from 'react'
import { describe, expect, test, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ICellRendererParams } from 'ag-grid-community'

vi.mock('@/components/layout/theme-provider', () => ({ useTheme: () => ({ resolvedTheme: 'dark' }) }))
let lastModalProps: Record<string, unknown> = {}
vi.mock('@/search/recviz/RecvizDashboardModal', () => ({
  RecvizDashboardModal: (p: Record<string, unknown>) => {
    lastModalProps = p
    return p.open ? <div data-testid="modal" /> : null
  },
}))
vi.mock('@/search/recviz/recvizConfig', () => ({ getRecvizOrigin: () => 'http://localhost:5173' }))

import { TlmStatsCellRenderer } from './TlmStatsCellRenderer'

type EntryPoint = 'set_id' | 'recon' | 'tlm_instance'

function renderCell(
  data: Record<string, unknown>,
  entryPoint: EntryPoint,
  value: string,
) {
  const params = {
    value, data,
    colDef: { cellRendererParams: { entryPoint } },
  } as unknown as ICellRendererParams
  return render(<TlmStatsCellRenderer {...(params as ComponentProps<typeof TlmStatsCellRenderer>)} />)
}

describe('TlmStatsCellRenderer', () => {
  test('renders nothing when value is empty', () => {
    renderCell({ tlm_instance: 'TLMP_CONSUMER' }, 'tlm_instance', '')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  test('renders plain text when tlm_instance is missing (cannot route)', () => {
    renderCell({ tlm_instance: null, recon: 'R1' }, 'recon', 'R1')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText('R1')).toBeInTheDocument()
  })

  test('opens modal with tlm_instance lock on tlm_instance entry', () => {
    renderCell(
      { tlm_instance: 'TLMP_CONSUMER', recon: 'TRADE_RECON_NA', set_id: 'SETID_001' },
      'tlm_instance',
      'TLMP_CONSUMER',
    )
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByTestId('modal')).toBeInTheDocument()
    const u = new URL(lastModalProps.url as string)
    expect(u.pathname).toBe('/embed/dashboards/dash-tlm-stats')
    expect(u.searchParams.get('filter.tlm_instance')).toBe('TLMP_CONSUMER')
    expect(u.searchParams.get('filter.lock')).toBe('tlm_instance')
    expect(u.searchParams.get('theme')).toBe('dark')
  })

  test('opens modal with tlm_instance + recon lock on recon entry', () => {
    renderCell(
      { tlm_instance: 'TLMP_CONSUMER', recon: 'TRADE_RECON_NA', set_id: 'SETID_001' },
      'recon',
      'TRADE_RECON_NA',
    )
    fireEvent.click(screen.getByRole('button'))
    const u = new URL(lastModalProps.url as string)
    expect(u.searchParams.get('filter.tlm_instance')).toBe('TLMP_CONSUMER')
    expect(u.searchParams.get('filter.recon')).toBe('TRADE_RECON_NA')
    expect(u.searchParams.get('filter.lock')).toBe('tlm_instance,recon')
  })

  test('opens modal with tlm_instance + recon + set_id lock on set_id entry', () => {
    renderCell(
      { tlm_instance: 'TLMP_CONSUMER', recon: 'TRADE_RECON_NA', set_id: 'SETID_001' },
      'set_id',
      'SETID_001',
    )
    fireEvent.click(screen.getByRole('button'))
    const u = new URL(lastModalProps.url as string)
    expect(u.searchParams.get('filter.tlm_instance')).toBe('TLMP_CONSUMER')
    expect(u.searchParams.get('filter.recon')).toBe('TRADE_RECON_NA')
    expect(u.searchParams.get('filter.set_id')).toBe('SETID_001')
    expect(u.searchParams.get('filter.lock')).toBe('tlm_instance,recon,set_id')
  })
})
```

- [ ] **Step 4: Run the test to verify it fails**

```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer/frontend-react && pnpm vitest run src/search/renderers/TlmStatsCellRenderer.test.tsx
```
Expected: FAIL with `Cannot find module './TlmStatsCellRenderer'`.

- [ ] **Step 5: Implement the renderer**

Create `/Users/aarun/Workspace/Projects/autosys-job-explorer/frontend-react/src/search/renderers/TlmStatsCellRenderer.tsx`. Mirror `QuickRecStatsCellRenderer.tsx` verbatim — same imports, same patterns, same return shape:

```tsx
import { useState } from 'react'
import type { ICellRendererParams } from 'ag-grid-community'
import { SparklesIcon, Loader2Icon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useTheme } from '@/components/layout/theme-provider'
import { buildEmbedUrl } from '@/search/recviz/buildEmbedUrl'
import { getRecvizOrigin } from '@/search/recviz/recvizConfig'
import { RecvizDashboardModal } from '@/search/recviz/RecvizDashboardModal'

const DASHBOARD_ID = 'dash-tlm-stats'

type TlmEntryPoint = 'set_id' | 'recon' | 'tlm_instance'

/**
 * Compute the filter-lock list for the TLM stats modal. Matches Angular
 * `TlmStatsModalV2Component.initializeFilterState` (96-137):
 *  - set_id entry: locks tlm_instance + recon + set_id
 *  - recon  entry: locks tlm_instance + recon
 *  - tlm_instance entry: locks tlm_instance only
 * Lock order matters — the embed URL renders the lock-icon row in the
 * order the names appear in filter.lock.
 */
function computeLockList(entry: TlmEntryPoint): string[] {
  switch (entry) {
    case 'set_id':
      return ['tlm_instance', 'recon', 'set_id']
    case 'recon':
      return ['tlm_instance', 'recon']
    case 'tlm_instance':
    default:
      return ['tlm_instance']
  }
}

/**
 * TlmStatsCellRenderer — React port of Angular's tlm-stats cell-click flow.
 * Renders the cell value as a clickable link (sparkles icon + value) that
 * opens the embedded RecViz TLM dashboard. Mirrors QuickRecStatsCellRenderer
 * shape exactly (same component signature, same modal-owned-internally
 * pattern, same return-null-for-empty behavior).
 *
 * Wired via `cellRenderer: "tlmStatsButtonRenderer"` in search-config-v4.json
 * on tlm_instance / set_id / recon columns. `cellRendererParams.entryPoint`
 * (one of those three) decides which filters are locked when the modal opens.
 *
 * Returns null when the value is empty (so AG-Grid renders nothing — the
 * cell falls back to its default text rendering of params.value, which is
 * also empty in that case). Returns plain text when tlm_instance is null
 * — without an instance value the dynamic-routing resolver can't pick a
 * connection, so the link is dead and we render text instead.
 */
export function TlmStatsCellRenderer(params: ICellRendererParams) {
  const colDef = params.colDef as { cellRendererParams?: { entryPoint?: TlmEntryPoint } } | undefined
  const entryPoint = colDef?.cellRendererParams?.entryPoint ?? 'tlm_instance'
  const data = params.data as Record<string, unknown> | undefined
  const { resolvedTheme } = useTheme()
  const [open, setOpen] = useState(false)

  const rawValue = typeof params.value === 'string' ? params.value : ''
  const value = rawValue.trim()
  if (!value || value === '-') return null

  const tlmInstance = typeof data?.tlm_instance === 'string' ? data.tlm_instance : undefined
  if (!tlmInstance) {
    // Dynamic routing needs tlm_instance — render plain text, not a dead link.
    return <span className="text-foreground">{value}</span>
  }

  const recon = typeof data?.recon === 'string' ? data.recon : undefined
  const setId = typeof data?.set_id === 'string' ? data.set_id : undefined

  const url = buildEmbedUrl({
    origin: getRecvizOrigin(),
    dashboardId: DASHBOARD_ID,
    filters: { tlm_instance: tlmInstance, recon, set_id: setId },
    lock: computeLockList(entryPoint),
    theme: resolvedTheme,
  })

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`View TLM stats for ${value}`}
        className={cn(
          'inline-flex items-center gap-1 text-primary hover:underline',
          'cursor-pointer text-[12px] font-normal',
        )}
      >
        <SparklesIcon className="size-3.5 opacity-70" aria-hidden />
        <span className="font-mono">{value}</span>
        {open && <Loader2Icon className="size-3 animate-spin opacity-60" aria-hidden />}
      </button>
      <RecvizDashboardModal open={open} onOpenChange={setOpen} title="TLM Statistics" url={url} />
    </>
  )
}
```

- [ ] **Step 6: Run the test to verify it passes**

```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer/frontend-react && pnpm vitest run src/search/renderers/TlmStatsCellRenderer.test.tsx
```
Expected: 5 tests passing.

- [ ] **Step 7: Wire the renderer into the registry**

Edit `/Users/aarun/Workspace/Projects/autosys-job-explorer/frontend-react/src/search/renderers/registry.ts`. The export is named `cellRenderers` (NOT `RENDERERS`). Add the new entry:

```ts
import { TlmStatsCellRenderer } from './TlmStatsCellRenderer'

export const cellRenderers: Record<string, ComponentType<ICellRendererParams>> = {
  appIDCellRenderer: AppIDCellRenderer,
  supportEmailCellRenderer: SupportEmailCellRenderer,
  executionOrderButtonRenderer: ExecutionOrderCellRenderer,
  quickRecStatsButtonRenderer: QuickRecStatsCellRenderer,
  tlmStatsButtonRenderer: TlmStatsCellRenderer,   // <-- ADD
}
```

- [ ] **Step 8: Update the registry length-assertion test**

Edit `/Users/aarun/Workspace/Projects/autosys-job-explorer/frontend-react/src/search/__tests__/registry.test.ts`. The current assertion at line 21 reads `expect(Object.keys(cellRenderers).length).toBe(3)` — STALE post-Plan-2 (4 entries actually exist). Bump to 5 and add presence-checks for the two renderers that were missed:

```ts
import { describe, test, expect } from 'vitest'
import { cellRenderers } from '../renderers/registry'
import { AppIDCellRenderer } from '../renderers/AppIDCellRenderer'
import { SupportEmailCellRenderer } from '../renderers/SupportEmailCellRenderer'
import { ExecutionOrderCellRenderer } from '../renderers/ExecutionOrderCellRenderer'
import { QuickRecStatsCellRenderer } from '../renderers/QuickRecStatsCellRenderer'
import { TlmStatsCellRenderer } from '../renderers/TlmStatsCellRenderer'

describe('cellRenderers registry', () => {
  test('appIDCellRenderer key maps to AppIDCellRenderer component', () => {
    expect(cellRenderers.appIDCellRenderer).toBe(AppIDCellRenderer)
  })

  test('supportEmailCellRenderer key maps to SupportEmailCellRenderer component', () => {
    expect(cellRenderers.supportEmailCellRenderer).toBe(SupportEmailCellRenderer)
  })

  test('executionOrderButtonRenderer key maps to ExecutionOrderCellRenderer component', () => {
    expect(cellRenderers.executionOrderButtonRenderer).toBe(ExecutionOrderCellRenderer)
  })

  test('quickRecStatsButtonRenderer key maps to QuickRecStatsCellRenderer component', () => {
    expect(cellRenderers.quickRecStatsButtonRenderer).toBe(QuickRecStatsCellRenderer)
  })

  test('tlmStatsButtonRenderer key maps to TlmStatsCellRenderer component', () => {
    expect(cellRenderers.tlmStatsButtonRenderer).toBe(TlmStatsCellRenderer)
  })

  test('registry contains exactly 5 keys (regression guard for accidental drift)', () => {
    expect(Object.keys(cellRenderers).length).toBe(5)
  })

  test('unknown key resolves to undefined — adapter falls back to default text renderer', () => {
    expect(cellRenderers['unknownKey']).toBeUndefined()
  })
})
```

- [ ] **Step 9: Run typecheck + lint + tests**

```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer/frontend-react && pnpm typecheck && pnpm lint && pnpm vitest run
```
Expected: typecheck passes; lint has no NEW errors (the baseline 6 pre-existing errors per `[[project_frontend_lint_baseline]]` are acceptable); all tests pass.

- [ ] **Step 10: Commit (LOCAL ONLY)**

```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer
git add frontend-react/src/search/renderers/TlmStatsCellRenderer.tsx \
       frontend-react/src/search/renderers/TlmStatsCellRenderer.test.tsx \
       frontend-react/src/search/renderers/registry.ts \
       frontend-react/src/search/__tests__/registry.test.ts
git commit -m "feat(search): TlmStatsCellRenderer + registry update (Plan 4)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7: Wire `tlmStatsButtonRenderer` in `search-config-v4.json`

**Files:**
- Modify `backend/rectrace/src/main/resources/search-config-v4.json`

The legacy Angular modal accepts THREE entry-point types (`tlm_instance`, `recon`, `set_id`). The TLM renderer should be wired on every plain (non-rowGroup) column matching those names. Rowgroup-flagged columns are skipped — renderer behavior on group-header cells is undefined and would render the link on group rollups too.

**Authoritative target column list** (verified against `search-config-v4.json` content):

| Category (key) | Column | Renderer | Entry point |
|---|---|---|---|
| `reconName` | `tlm_instance` (L60) | tlmStatsButtonRenderer | `tlm_instance` |
| `boxName` | `tlm_instance` (L92) | tlmStatsButtonRenderer | `tlm_instance` |
| `setId` | `tlm_instance` (L123) | tlmStatsButtonRenderer | `tlm_instance` |
| `subAcc` | `tlm_instance` (L154) | tlmStatsButtonRenderer | `tlm_instance` |
| `loadFileName` | `tlm_instance` (L185) | tlmStatsButtonRenderer | `tlm_instance` |
| `tlmInstance` | `tlm_instance` (L311) | **SKIP** — rowGroup column |  |
| `setId` | `set_id` (L116) | **SKIP** — rowGroup column |  |
| `subAcc` | `set_id` (L150) | tlmStatsButtonRenderer | `set_id` |
| `tlmInstance` | `set_id` (L317) | tlmStatsButtonRenderer | `set_id` |
| `reconName` | `recon` (L52) | **SKIP** — rowGroup column |  |
| `boxName` | `recon` (L86) | tlmStatsButtonRenderer | `recon` |
| `setId` | `recon` (L117) | tlmStatsButtonRenderer | `recon` |
| `subAcc` | `recon` (L148) | tlmStatsButtonRenderer | `recon` |
| `loadFileName` | `recon` (L179) | tlmStatsButtonRenderer | `recon` |
| `jobName` | `recon` (L211) | tlmStatsButtonRenderer | `recon` |
| `tlmInstance` | `recon` (L312) | tlmStatsButtonRenderer | `recon` |
| `reconId` | `recon` (L336) | tlmStatsButtonRenderer | `recon` |
| `reconPortalId` | `recon` (L357) | tlmStatsButtonRenderer | `recon` |
| `fileName` | `recon` (L26) | tlmStatsButtonRenderer | `recon` |

Total: **14 column-entries** receive the renderer. **3 rowGroup-flagged columns** (`reconName.recon`, `setId.set_id`, `tlmInstance.tlm_instance`) are skipped.

- [ ] **Step 1: Read the QuickRec JSON wiring as the precedent shape**

```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer && grep -B1 -A3 'quickRecStatsButtonRenderer' backend/rectrace/src/main/resources/search-config-v4.json | head -30
```
Note: `cellRenderer` and `cellRendererParams` are sibling fields at the column-object root.

- [ ] **Step 2: Edit `search-config-v4.json` and add the 14 renderer wirings**

For each column in the table above (excluding rowGroup-flagged), insert `cellRenderer` and `cellRendererParams` as sibling fields:

Example for the `reconName` category's `tlm_instance` column at line 60 — change from:

```json
{ "field": "tlm_instance", "headerName": "TLM Instance" }
```

to:

```json
{
  "field": "tlm_instance",
  "headerName": "TLM Instance",
  "cellRenderer": "tlmStatsButtonRenderer",
  "cellRendererParams": { "entryPoint": "tlm_instance" }
}
```

Same shape for each of the 14 target columns; `entryPoint` matches the column field name (`tlm_instance`, `set_id`, or `recon`).

- [ ] **Step 3: Rebuild + restart the rectrace backend so the new config loads**

```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer && lsof -iTCP:6088 -sTCP:LISTEN -t | xargs -r kill -9 || true
cd backend/rectrace && nohup mvn -q spring-boot:run -Dspring-boot.run.profiles=local > /tmp/rectrace-backend.log 2>&1 &
sleep 30 && curl -s http://localhost:6088/rectrace/api/v4/search/config | python -c "
import json, sys
config = json.load(sys.stdin)
hits = 0
for cat in config.get('categories', []):
    for col in cat.get('columns', []):
        if col.get('cellRenderer') == 'tlmStatsButtonRenderer':
            hits += 1
            print(f\"{cat.get('key')}.{col.get('field')} -> entryPoint={col.get('cellRendererParams', {}).get('entryPoint')}\")
print(f'total: {hits} tlmStatsButtonRenderer wirings')
"
```
(Per `[[project_ops_backend_orphan]]` — kill the `:6088` listener first.) Expected: 14 lines printed + `total: 14`.

- [ ] **Step 4: Manually verify in the React UI**

```bash
echo "Open: http://localhost:5173/search?q=TLMP_CONSUMER&tab=tlmInstance"
```
(Note: the route Zod schema accepts `tab`, NOT `cat`. `tlmInstance` category's `searchColumn` is `tlm_instance`, so `q=TLMP_CONSUMER` hits.) Expected: rows show, `tlm_instance` / `set_id` / `recon` cells render as clickable links. Click any → modal opens with the TLM dashboard. KPIs populate.

- [ ] **Step 5: Commit (LOCAL ONLY)**

```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer
git add backend/rectrace/src/main/resources/search-config-v4.json
git commit -m "feat(search): wire tlmStatsButtonRenderer on 14 tlm_instance/set_id/recon columns (Plan 4)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 8: Playwright bootstrap + TLM-modal e2e smoke

**Files:**
- Modify `frontend-react/package.json` — add `@playwright/test` dev dep.
- Create `frontend-react/playwright.config.ts`.
- Create `frontend-react/e2e/tlm-stats-modal.spec.ts`.

Playwright is NOT currently installed in `frontend-react` (verified). The Plan 2 e2e directory referenced in earlier plans is fictional — there is no `e2e/` folder. This task lays down the harness before the spec.

- [ ] **Step 1: Install Playwright as a dev dep + browser binaries**

```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer/frontend-react && pnpm add -D @playwright/test
pnpm exec playwright install chromium
```
Expected: `package.json` gains `@playwright/test` under `devDependencies`; chromium binary downloads.

- [ ] **Step 2: Create the Playwright config**

Create `/Users/aarun/Workspace/Projects/autosys-job-explorer/frontend-react/playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config for end-to-end tests that drive the React dev server
 * against the live rectrace backend on :6088 and live RecViz backend on
 * :8000. Assumes both backends + the Oracle/ES stack are running locally.
 *
 * Run: `pnpm exec playwright test` from frontend-react/.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.RECTRACE_E2E_ORIGIN ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
```

- [ ] **Step 3: Add an npm script for convenience**

Edit `/Users/aarun/Workspace/Projects/autosys-job-explorer/frontend-react/package.json`. Add to `scripts`:

```json
"e2e": "playwright test",
```

- [ ] **Step 4: Write the e2e smoke spec**

Create `/Users/aarun/Workspace/Projects/autosys-job-explorer/frontend-react/e2e/tlm-stats-modal.spec.ts`. The spec verifies the user-visible flow (search → click cell → modal opens → KPIs visible). It does NOT assert zero-coalescing visually (Task 2 unit tests prove that — the local seed produces near-100% overlap so zero-filled cells may not appear in the merged grid):

```ts
import { test, expect } from '@playwright/test'

test.describe('TLM stats modal — embedded RecViz dashboard', () => {
  test('search → click tlm_instance cell → modal opens with 4 KPIs visible', async ({ page }) => {
    // The route Zod schema accepts `tab` (not `cat`); the `tlmInstance`
    // category's searchColumn is `tlm_instance` so q=TLMP_CONSUMER hits.
    await page.goto('/search?q=TLMP_CONSUMER&tab=tlmInstance')

    // Grid populates
    await page.locator('[role="grid"]').first().waitFor({ state: 'visible', timeout: 15_000 })

    // The TLM-stats renderer renders the tlm_instance cell value as a
    // clickable button with aria-label "View TLM stats for TLMP_CONSUMER".
    const tlmCell = page.getByRole('button', { name: /View TLM stats for TLMP_CONSUMER/i }).first()
    await tlmCell.waitFor({ state: 'visible', timeout: 10_000 })
    await tlmCell.click()

    // Modal opens → iframe loads dash-tlm-stats. The iframe lives inside
    // the RecvizDashboardModal Dialog, so wait for the iframe by src.
    const iframe = page.frameLocator('iframe[src*="/embed/dashboards/dash-tlm-stats"]')

    // All 4 KPI labels appear in the embed.
    await expect(iframe.getByText(/^Total Items$/)).toBeVisible({ timeout: 20_000 })
    await expect(iframe.getByText(/^Automatched$/)).toBeVisible()
    await expect(iframe.getByText(/^Total Breaks$/)).toBeVisible()
    await expect(iframe.getByText(/^Manual Matched$/)).toBeVisible()
  })

  test('search → click set_id cell → modal opens with tlm_instance + recon + set_id locked', async ({ page }) => {
    await page.goto('/search?q=TLMP_CONSUMER&tab=tlmInstance')
    await page.locator('[role="grid"]').first().waitFor({ state: 'visible', timeout: 15_000 })

    // Find a set_id cell button (any one — the renderer is wired on every
    // set_id cell in the tlmInstance category).
    const setIdCell = page.locator('button[aria-label^="View TLM stats for"]').filter({ hasText: /^SETID_/ }).first()
    await setIdCell.waitFor({ state: 'visible', timeout: 10_000 })

    // The embed URL is captured via the iframe src. After clicking, assert
    // the src contains filter.lock=tlm_instance,recon,set_id.
    const clickedHref = await setIdCell.evaluate((btn) => {
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      return null
    })
    expect(clickedHref).toBeNull() // sanity

    const iframe = page.locator('iframe[src*="/embed/dashboards/dash-tlm-stats"]').first()
    await iframe.waitFor({ state: 'visible', timeout: 10_000 })
    const src = await iframe.getAttribute('src')
    expect(src).toContain('filter.tlm_instance=TLMP_CONSUMER')
    expect(src).toContain('filter.lock=tlm_instance%2Crecon%2Cset_id')
  })
})
```

- [ ] **Step 5: Run the e2e spec against the live stack**

Ensure all three backends are running (`:5173` React dev, `:6088` rectrace, `:8000` RecViz) and Oracle/ES are up. Then:

```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer/frontend-react && pnpm e2e --headed
```
Expected: both tests pass. If the search returns no TLMP_CONSUMER rows, verify Plan 3's seed (`apply.py --volume 10` produced reconmgmt TLMP_CONSUMER rows AND the search index was rebuilt). If the modal doesn't open, verify Task 6 + 7 wiring took effect (rectrace backend restarted after the search-config edit).

- [ ] **Step 6: Commit (LOCAL ONLY)**

```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer
git add frontend-react/package.json frontend-react/pnpm-lock.yaml \
       frontend-react/playwright.config.ts frontend-react/e2e/tlm-stats-modal.spec.ts
git commit -m "test(e2e): bootstrap Playwright + TLM-modal smoke (Plan 4)

Installs @playwright/test as dev dep, creates playwright.config.ts +
e2e/ dir. Spec verifies the search-cell-click → modal-open flow with
all 4 TLM KPIs visible in the embedded RecViz dashboard. Does not
assert zero-fill visually (Plan 4 Task 2 unit tests prove coalesce_zero;
local seed has near-100% merge overlap which would mask the visual).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Done criteria for Plan 4

- `visibleWhen` supported on `KpiConfig` + `DashboardChartConfig`; shared `lib/visibility.ts` extracted; grid behavior preserved.
- `coalesce_zero` flows end-to-end: backend `MergeRequest` → `MergeEngine` (cursor-typed numeric coalescing) → frontend `MergeConfig` → `useDataSourceMerge` POST body → `GridConfig.coalesceZero` → `MergedSourceGrid` consumer. Default off preserves existing behavior; TLM merge sets it on.
- `FilterMapping.options` accepts JSON dict; `_build_date_range_clause(exclude_today=True)` honors per-mapping. TLM datasets use `exclude_today: True`; QuickRec stays on default.
- `conn-reconmgmt` registered alongside `conn-recportal` and `conn-tcosprd`.
- `ds-tlm-automatch` + `ds-tlm-breaks` + `ds-tlm-manual-match` produce correct rows; cross-DB merge with `coalesce_zero=true` works end-to-end via curl.
- `dash-tlm-stats` renders 4 KPIs (with trend + accentColor), 2 grids (reconciliation cross-DB merge + breaks gated visibleWhen), filter bar with dependent multi-selects.
- `TlmStatsCellRenderer` mirrors `QuickRecStatsCellRenderer` exactly; wired on 14 `tlm_instance` / `set_id` / `recon` columns across 9 categories (rowGroup columns skipped).
- Registry length-assertion bumped to 5; both renderers (Plan 2 + Plan 4) have presence checks.
- Playwright installed; e2e smoke passes (modal opens, 4 KPIs visible, lock list correct on set_id click).
- All commits local; nothing pushed.
- Assertion gates bumped: `CURATED_DATASETS == 26`, `CURATED_KPIS == 22`, `CURATED_DASHBOARDS == 11`. Hardcoded `"3 rows"` connection-summary bumped to `"4 rows"`.

## Self-review notes

- **Spec coverage:** §6.5 (embed surface — done in Plan 1, consumed by Task 6), §7 (TLM data semantics — Tasks 4-5), §12.1 (panel visibility — Task 1), §12.2 (TLM-instance friendly↔DB_NAME — Plan 3 Task 4), §12.5 (instance normalization seed-side — Plan 3 Task 2 Step 2b; SQL-side normalization unnecessary because routing keys on friendly names), §12.6 (MergeEngine — Task 2), §12.7 (date clause — Task 3), §12.8 (TLM breaks pure-SQL — Task 4).
- **Decision check** — every Task aligns with the spike outcomes locked in via AskUserQuestion: §12.1=A, §12.6=B, §12.7=B, §12.8=A.
- **v1 review findings fully addressed** —
  1. `_kpi()` signature correct (Task 5).
  2. Inline KPI cards with trend/accentColor (Task 5, mirroring `dash-quickrec-stats` precedent).
  3. `TlmStatsCellRenderer` rewritten as self-contained component (Task 6, mirroring `QuickRecStatsCellRenderer` verbatim).
  4. `mr_csum_man_match_details.setid` vs `mr_csum_netting_hist.local_acc_no` asymmetry handled per-leg with `AS set_id` aliasing (Task 4 Step 5).
  5. Routing values are connection NAMES (`tcosprd`, `reconmgmt`), not IDs (Task 4 Step 2).
  6. `conn-reconmgmt` registration added (Task 4 Step 1).
  7. `coalesceZero` end-to-end FE wiring (Task 2 Steps 6-7).
  8. Playwright bootstrap explicit (Task 8 Steps 1-3).
  9. Route schema uses `tab` not `cat`; category is `tlmInstance` not `reconName` (Tasks 7, 8).
  10. Assertion gates bumped to 26/22/11 + connection print bumped to "4 rows".
  11. Registry length-assertion bumped to 5 (Task 6 Step 8).
  12. Test fixture typo fixed (Task 2 Step 1 — `manual_match` column entry now correct).
  13. e2e zero-fill assertion dropped; smoke verifies modal opens + KPIs visible (Task 8 Step 4).
  14. `setid` (no underscore) column name used in `data/03-reconmgmt-inserts.sql` matched in SQL (Task 4 Step 5).
  15. 14 specific column-entries enumerated for Task 7 wiring (rowGroup columns skipped).
- **Type consistency** — `VisibleWhen {kpi, condition, value}` consistent across Tasks 1 + 5. `coalesce_zero`/`coalesceZero` consistent across Tasks 2 + 5. `FilterMapping.options` consistent Tasks 3 + 4. `dash-tlm-stats` / `ds-tlm-*` / `kpi-tlm-*` / `tlmStatsButtonRenderer` consistent across all referencing tasks.
- **Branch hygiene** — Tasks 1-5 on `feature/tlm-dashboard`; Tasks 6-8 on `milestone/modernization`. No cross-branch contamination.
- **No push** — every commit step is local-only per the standing rule.

## Out-of-scope (deferred to future plans / polish)

- Composite `visibleWhen` (AND/OR of multiple KPI conditions) for an explicit "No data" message panel — Plan 4 lets the grids' own `visibleWhen` hide them when their KPI is `0`. The legacy "No data" message panel is a polish follow-up if/when needed.
- Filter-value-based `visibleWhen` operand — §12.1 spike confirmed legacy doesn't need it; YAGNI.
- The `reconmgmt-only` count-style query (used by legacy `getStatsByEntryPoint` for the `recon`/`tlm_instance` entry + 7/30-day window) — the 3 datasets in Task 4 cover the demo path; the count-only variant is a future-plan optimization.
- Composite TLM-instance mapping — Plan 4 only seeds `TLMP_CONSUMER → tcosprd`. Adding the other 11 friendly names from `TlmStatsV2Service.TLM_INSTANCE_MAP` requires seeding 11 more `tcosprd-like` schemas, which is out of scope.
- Empty-state Markdown panel and dashboard-renderer-level "no data" UX — deferred to the broader "Empty-state no-results bug + contextual dashboards" sub-project (next in the user's queue after Plan 4).
- Pre-existing Rules-of-Hooks issue in `config-kpi-row.tsx` (early-return before `useDashboardKpis`) — flagged in Task 1 Step 8; not fixed as part of Plan 4.
- Pre-existing `DataSourceQueryResponse` type lie (`columns: string[]` vs actual `list[dict]`) — frontend never reads the field so it's benign; flagged but not fixed.
- Frontend `accentColor` type field on KPI cards — Plan 4 uses it inline matching `dash-quickrec-stats` precedent; if the frontend type doesn't formally declare it the JSONB round-trip still works (TS reads `unknown` extra fields gracefully). Adding the type is a follow-up.
- Branch-topology rebase of `feature/tlm-instance-seed` onto `feature/volume-seed-data` — finishing-time concern; Plan 3 follow-up.

This unblocks the **rectrace TLM-stats modal end-to-end**: the legacy Angular modal v2 can be hidden behind a feature flag (or deleted) once Plan 4 is verified.
