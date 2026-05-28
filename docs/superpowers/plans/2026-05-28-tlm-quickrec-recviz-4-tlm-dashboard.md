# TLM Dashboard Implementation Plan (Plan 4 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy Angular `tlm-stats-modal-v2` with a React modal that embeds a native RecViz TLM dashboard. The dashboard cross-DB-merges per-TLM-instance automatch data (from `conn-tcosprd`) with reconmgmt manual-match data on `(agent_code, set_id, stmt_date, bran_code, corr_acc_no)`, fills missing numeric cells with `0`, and shows separate panels for breaks and reconciliation gated on KPI values (matching the legacy modal's only conditional logic).

**Architecture:** Three small RecViz capability additions land first — (1) `visibleWhen` on `KpiConfig`/`DashboardChartConfig` (currently grid-only), (2) `coalesce_zero` flag on the merge endpoint, (3) `FilterMapping.options` passing `exclude_today` to a parameterized `_build_date_range_clause`. Then three datasets register in `seed-oracle.py` — `ds-tlm-automatch` (dynamic-routed to `conn-tcosprd` by `tlm_instance` filter), `ds-tlm-breaks` (same routing), `ds-tlm-manual-match` (static on `conn-reconmgmt`, UNION ALL of `mr_csum_man_match_details` and `mr_csum_netting_hist`). The TLM dashboard config wires four KPIs (`total_items`, `automatch_items`, `total_breaks`, `total_manual_match`), the breaks grid (`visibleWhen total_breaks > 0`), and the reconciliation grid backed by a cross-DB merge of `ds-tlm-automatch + ds-tlm-manual-match` with `coalesce_zero: true` (`visibleWhen total_items > 0`). React-side adds `TlmStatsCellRenderer` (Angular-faithful pattern, same as `QuickRecStatsCellRenderer`) wired on `tlm_instance`/`set_id`/`recon` columns in `search-config-v4.json` for the categories that already expose those columns.

**Tech Stack:** RecViz backend (FastAPI + SQLAlchemy 2 + Alembic + oracledb), RecViz frontend (Vite 7 + React 19 + shadcn + AG-Grid 35 + TanStack), rectrace frontend (Vite 7 + React 19 + AG-Grid 35), Oracle 23c, Playwright.

**Prerequisite:** Plans 1, 2, 3 done. `conn-tcosprd` registered. `tcosprd` schema seeded via `apply.py --volume 10`. RecViz uvicorn on `:8000`, rectrace backend on `:6088`, rectrace React on `:5173`.

**Repos & branches:**
- Tasks 1–5 (RecViz capabilities + datasets + dashboard): RecViz repo, on `feature/tlm-dashboard` (created at Plan 3 Task 4; HEAD `ca0d546`).
- Tasks 6–7 (rectrace cell renderer + config wiring): autosys-job-explorer, on `milestone/modernization`.
- Task 8 (Playwright end-to-end): rectrace `frontend-react/e2e/`.

**Spec:** `docs/superpowers/specs/2026-05-28-tlm-quickrec-recviz-modals-design.md` — §6.5, §7, §12.1, §12.2, §12.5-§12.8.

**Source of truth for SQL:** `rectrace-tlm-stats/.../TlmStatsV2Service.java` — `buildAutomatchQuery` (451-491), `buildBreaksQuery` (388-448), `buildManualMatchQuery` (547-622), `getDateRangeClause` (624-633), `TLM_INSTANCE_MAP` (38-50). All references in this plan cite line numbers in that file.

**Spike outcomes folded in (locked decisions):**
- §12.1 → A. Extend `visibleWhen` to KPIs + charts (currently grid-only). No filter-value mechanism — the legacy modal doesn't have one.
- §12.6 → B. Add `coalesce_zero: bool = false` to `MergeRequest`. TLM merge panel sets it `true`.
- §12.7 → B. Add `options: dict | None = None` to `FilterMapping`. Parameterize `_build_date_range_clause(value, dialect, *, exclude_today=False)`. The JSON column on `RecvizDataset.filter_mappings` absorbs the new field — no Alembic migration needed.
- §12.8 → A. One row-level dataset per query family. KPIs aggregate via `aggregation: "SUM"` which RecViz turns into server-side `SELECT SUM(...) FROM (...)`.

---

## File Structure

**RecViz repo (`/Users/aarun/Workspace/Projects/RecViz`):**

- Modify `frontend/src/types/dashboard-config.ts` — add `visibleWhen?: VisibleWhen` to `KpiConfig` and `DashboardChartConfig`.
- Create `frontend/src/lib/visibility.ts` — extract the `isVisible(visibleWhen, kpiResults)` helper into a shared module.
- Modify `frontend/src/components/dashboard/config-data-grid.tsx` — replace local `isVisible` with the shared import.
- Modify `frontend/src/components/dashboard/config-kpi-row.tsx` — gate per-KPI render on `isVisible`.
- Modify `frontend/src/components/dashboard/config-chart-grid.tsx` — gate per-chart render on `isVisible`.
- Modify `backend/app/services/merge_engine.py` — add `coalesce_zero` parameter; fill missing numeric cells with `0` when set.
- Modify `backend/app/api/data_sources.py` — accept `coalesce_zero` on `MergeRequest`, forward to engine.
- Modify `backend/tests/test_merge_engine.py` — keep current `test_outer_join` semantics (default false) and add `test_outer_join_coalesce_zero`.
- Modify `backend/app/models/data_source_config.py` — add `options: dict | None = None` to `FilterMapping`.
- Modify `backend/app/services/query_engine.py` — parameterize `_build_date_range_clause` with `exclude_today` kwarg; thread `fm.options` through `_build_sql`.
- Modify `backend/tests/test_query_engine.py` (or wherever date-clause tests live — verify at execution) — add `test_date_range_clause_exclude_today` + `test_filter_mapping_options_threaded_to_date_clause`.
- Modify `scripts/seed-oracle.py` — register `ds-tlm-automatch`, `ds-tlm-breaks`, `ds-tlm-manual-match` datasets, plus `dash-tlm-stats` dashboard, plus 4 KPIs (`kpi-tlm-total-items`, `kpi-tlm-automatch`, `kpi-tlm-total-breaks`, `kpi-tlm-manual-match`).

**rectrace repo (`/Users/aarun/Workspace/Projects/autosys-job-explorer`):**

- Create `frontend-react/src/search/renderers/TlmStatsCellRenderer.tsx` — Angular-faithful renderer for `tlm_instance` / `set_id` / `recon` cells.
- Create `frontend-react/src/search/renderers/TlmStatsCellRenderer.test.tsx` — unit tests for the lock-list + entry-point gating.
- Modify `frontend-react/src/search/renderers/registry.ts` — add `tlmStatsButtonRenderer`.
- Modify `backend/rectrace/src/main/resources/search-config-v4.json` — set `cellRenderer: "tlmStatsButtonRenderer"` on `tlm_instance`, `set_id`, `recon` columns in the relevant categories.
- Create `frontend-react/e2e/tlm-stats-modal.spec.ts` — Playwright end-to-end.

---

## Task 1: Extend `visibleWhen` to KPIs and charts

**Files:**
- Create `frontend/src/lib/visibility.ts`
- Modify `frontend/src/types/dashboard-config.ts`
- Modify `frontend/src/components/dashboard/config-data-grid.tsx`
- Modify `frontend/src/components/dashboard/config-kpi-row.tsx`
- Modify `frontend/src/components/dashboard/config-chart-grid.tsx`
- Modify `frontend/src/lib/visibility.test.ts` (new)
- Modify `frontend/src/components/dashboard/config-kpi-row.test.tsx` (new — if existing test file isn't present, create it)

- [ ] **Step 1: Verify the RecViz branch**

```bash
cd /Users/aarun/Workspace/Projects/RecViz && git status -sb
```
Expected: `## feature/tlm-dashboard` (or `## feature/tlm-dashboard...origin/...`). If not on `feature/tlm-dashboard`, `git checkout feature/tlm-dashboard` first.

- [ ] **Step 2: Write the failing test for the shared `isVisible` helper**

Create `/Users/aarun/Workspace/Projects/RecViz/frontend/src/lib/visibility.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { isVisible } from './visibility'
import type { VisibleWhen, KpiResult } from '@/types/dashboard-config'

describe('isVisible', () => {
  const kpis: KpiResult[] = [
    { id: 'k1', value: 10, label: 'k1' } as KpiResult,
    { id: 'k2', value: 0, label: 'k2' } as KpiResult,
  ]

  it('returns true when visibleWhen is undefined', () => {
    expect(isVisible(undefined, kpis)).toBe(true)
  })

  it('returns true when kpiResults is undefined (results not loaded yet)', () => {
    expect(isVisible({ kpi: 'k1', condition: 'gt', value: 0 }, undefined)).toBe(true)
  })

  it('returns true when the referenced KPI is missing (unknown id)', () => {
    expect(isVisible({ kpi: 'nope', condition: 'gt', value: 0 }, kpis)).toBe(true)
  })

  it.each([
    [{ kpi: 'k1', condition: 'gt', value: 5 }, true],
    [{ kpi: 'k1', condition: 'gt', value: 100 }, false],
    [{ kpi: 'k1', condition: 'lt', value: 100 }, true],
    [{ kpi: 'k1', condition: 'lt', value: 5 }, false],
    [{ kpi: 'k1', condition: 'eq', value: 10 }, true],
    [{ kpi: 'k2', condition: 'eq', value: 0 }, true],
  ])('evaluates %p as %p', (rule, expected) => {
    expect(isVisible(rule as VisibleWhen, kpis)).toBe(expected)
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
 * KPI-value-based visibility check. Used to gate KPI cards, chart panels, and
 * data grids on aggregated values. Returns `true` (visible) when:
 *  - `visibleWhen` is undefined (no rule = always show), OR
 *  - `kpiResults` is undefined (results not loaded yet = optimistic show), OR
 *  - the referenced KPI id is missing from `kpiResults` (config drift =
 *    fail-open rather than hide a panel due to a typo).
 *
 * The single-value condition shape was extracted from the original local
 * helper in `components/dashboard/config-data-grid.tsx`; no semantic change.
 */
export function isVisible(
  visibleWhen: VisibleWhen | undefined,
  kpiResults: KpiResult[] | undefined,
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

Edit `/Users/aarun/Workspace/Projects/RecViz/frontend/src/types/dashboard-config.ts`. Find `KpiConfig` and add `visibleWhen?: VisibleWhen`. Find `DashboardChartConfig` and add the same. The `GridConfig.visibleWhen` field already exists — leave it.

Concretely, the two changes:

```ts
export interface KpiConfig {
  // ... existing fields ...
  visibleWhen?: VisibleWhen   // <-- ADD
}

export interface DashboardChartConfig {
  // ... existing fields ...
  visibleWhen?: VisibleWhen   // <-- ADD
}
```

- [ ] **Step 7: Replace the local helper in `config-data-grid.tsx`**

Edit `/Users/aarun/Workspace/Projects/RecViz/frontend/src/components/dashboard/config-data-grid.tsx`. Remove the local `isVisible` function (lines ~32-49) and replace with an import:

```ts
import { isVisible } from '@/lib/visibility'
```

Leave the call site (`if (!isVisible(grid.visibleWhen, kpiResults))`) intact.

- [ ] **Step 8: Add visibility gating to KPI row**

Edit `/Users/aarun/Workspace/Projects/RecViz/frontend/src/components/dashboard/config-kpi-row.tsx`. Find the per-KPI `.map(...)` render and wrap with `isVisible`:

```tsx
import { isVisible } from '@/lib/visibility'

// ...

{kpis.map((kpi) => {
  // Pass the SAME kpiResults the grid uses (the prop is already plumbed in;
  // verify the prop name at the call site in dashboard-renderer.tsx). If the
  // KPI gates ITSELF on its own value, that's allowed — first-paint shows it,
  // then the next render hides it; this matches grid behavior today.
  if (!isVisible(kpi.visibleWhen, kpiResults)) return null
  return (
    // ... existing KPI card render ...
  )
})}
```

The exact JSX wrapping depends on the existing structure of `config-kpi-row.tsx` — preserve every other rendering decision (cross-filter dim styles, partial-match badges, etc.). The only change is the early-`return null` before the existing card render.

- [ ] **Step 9: Add visibility gating to chart grid**

Edit `/Users/aarun/Workspace/Projects/RecViz/frontend/src/components/dashboard/config-chart-grid.tsx`. Same pattern — wrap the per-chart `.map(...)` with `isVisible(chart.visibleWhen, kpiResults)`:

```tsx
import { isVisible } from '@/lib/visibility'

// ... inside the charts.map(chart => ...) callback:
if (!isVisible(chart.visibleWhen, kpiResults)) return null
```

- [ ] **Step 10: Run typecheck + lint + tests**

```bash
cd /Users/aarun/Workspace/Projects/RecViz/frontend && npx tsc -b --noEmit && npx eslint src/lib/visibility.ts src/components/dashboard/config-kpi-row.tsx src/components/dashboard/config-chart-grid.tsx src/components/dashboard/config-data-grid.tsx && npx vitest run
```
Expected: typecheck passes, lint clean, all tests pass (the existing grid test should continue to pass since the helper extraction is behavior-preserving).

- [ ] **Step 11: Commit (LOCAL ONLY, do NOT push)**

```bash
cd /Users/aarun/Workspace/Projects/RecViz
git add frontend/src/lib/visibility.ts frontend/src/lib/visibility.test.ts \
       frontend/src/types/dashboard-config.ts \
       frontend/src/components/dashboard/config-data-grid.tsx \
       frontend/src/components/dashboard/config-kpi-row.tsx \
       frontend/src/components/dashboard/config-chart-grid.tsx
git commit -m "feat(dashboard): extend visibleWhen to KPIs and charts (Plan 4 §12.1)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: MergeEngine `coalesce_zero` flag

**Files:**
- Modify `backend/app/services/merge_engine.py`
- Modify `backend/app/api/data_sources.py`
- Modify `backend/tests/test_merge_engine.py`

- [ ] **Step 1: Write the failing test for `coalesce_zero=True` behavior**

Edit `/Users/aarun/Workspace/Projects/RecViz/backend/tests/test_merge_engine.py`. **Do not modify** the existing `test_outer_join` — it locks in the default behavior. Append:

```python
def test_outer_join_coalesce_zero_fills_missing_numeric_cells():
    """When coalesce_zero=True, left-only and right-only rows get 0 for
    missing numeric columns. Non-numeric (string/date) missing cells stay
    absent — `0` only applies to type=='number' columns."""
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
    s1 = [r for r in result["rows"] if r.get("set_id") == "S1"][0]
    assert s1["total_items"] == 100
    assert s1["total_manual_match_count"] == 5

    # Left-only row gets 0 for the right-side numeric column
    s2 = [r for r in result["rows"] if r.get("set_id") == "S2"][0]
    assert s2["total_items"] == 200
    assert s2["total_manual_match_count"] == 0   # was None; now 0

    # Right-only row gets 0 for both left-side numeric columns
    s3 = [r for r in result["rows"] if r.get("set_id") == "S3"][0]
    assert s3["total_manual_match_count"] == 10
    assert s3["total_items"] == 0          # was None; now 0
    assert s3["automatch_items"] == 0      # was None; now 0


def test_outer_join_coalesce_zero_default_off_preserves_existing_behavior():
    """coalesce_zero defaults to False; behavior must match test_outer_join."""
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
            {"column_name": "manual_match": "manual_match", "name": "manual_match", "type": "number", "is_date": False},
        ],
        "rows": [{"set_id": "S2", "manual_match": 5}],
        "row_count": 1,
    }

    result = MergeEngine.merge(
        results=[left, right],
        merge_on=["set_id"],
        merge_type="outer_join",
    )

    s1 = [r for r in result["rows"] if r["set_id"] == "S1"][0]
    s2 = [r for r in result["rows"] if r["set_id"] == "S2"][0]
    assert s1.get("manual_match") is None
    assert s2.get("total_items") is None
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

```bash
cd /Users/aarun/Workspace/Projects/RecViz/backend && ./.venv/bin/python -m pytest tests/test_merge_engine.py -v
```
Expected: `test_outer_join_coalesce_zero_fills_missing_numeric_cells` FAILs with `TypeError: merge() got an unexpected keyword argument 'coalesce_zero'`. Other tests still pass.

- [ ] **Step 3: Implement `coalesce_zero` in MergeEngine**

Edit `/Users/aarun/Workspace/Projects/RecViz/backend/app/services/merge_engine.py`. Replace the whole class body:

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

        right_index: dict[tuple, dict] = {}
        for row in right["rows"]:
            key = make_key(row)
            right_index[key] = row

        # Union of column metadata, preserving left order then appending unseen
        # right-side columns. `cols` here are list-of-dicts ({column_name, name,
        # type, is_date}) when the merge runs over real query results; the
        # original tests use list-of-strings shapes — handle both by reading
        # the column name uniformly.
        def col_name(col):
            return col["column_name"] if isinstance(col, dict) else col

        def col_type(col) -> str | None:
            return col.get("type") if isinstance(col, dict) else None

        all_columns = list(left["columns"])
        left_names = {col_name(c) for c in left["columns"]}
        for col in right["columns"]:
            if col_name(col) not in left_names:
                all_columns.append(col)

        # Numeric-column index for the zero-fill step. Only number-typed columns
        # are coalesced; strings/dates stay absent (and serialize as null on the
        # wire) so a missing recon-name doesn't become the literal string "0".
        numeric_columns: set[str] = set()
        if coalesce_zero:
            for col in all_columns:
                if col_type(col) == "number":
                    numeric_columns.add(col_name(col))

        def fill_missing_zeros(row: dict, present_columns: set[str]) -> dict:
            """Add 0 for every numeric column not in `present_columns`."""
            if not coalesce_zero:
                return row
            for cname in numeric_columns:
                if cname not in present_columns:
                    row[cname] = 0
            return row

        left_col_names = {col_name(c) for c in left["columns"]}
        right_col_names = {col_name(c) for c in right["columns"]}

        merged_rows = []
        seen_keys = set()

        for lrow in left["rows"]:
            key = make_key(lrow)
            seen_keys.add(key)
            rrow = right_index.get(key)

            if rrow:
                merged_rows.append({**lrow, **rrow})
            elif merge_type == "outer_join":
                # Left-only: fill numeric cells the right side WOULD have
                # supplied. `present_columns` is the set of columns the left
                # row has — anything else numeric gets a 0.
                merged_rows.append(fill_missing_zeros({**lrow}, left_col_names))

        if merge_type == "outer_join":
            for rrow in right["rows"]:
                key = make_key(rrow)
                if key not in seen_keys:
                    # Right-only: fill numeric cells the left side WOULD have
                    # supplied.
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

In the handler body, forward the new field:

```python
    merged = MergeEngine.merge(
        results, body.merge_on, body.merge_type, body.coalesce_zero
    )
```

- [ ] **Step 5: Run the tests to verify all pass**

```bash
cd /Users/aarun/Workspace/Projects/RecViz/backend && ./.venv/bin/python -m pytest tests/test_merge_engine.py -v
```
Expected: 5 tests passing (3 originals + 2 new). The original `test_outer_join` still passes because `coalesce_zero` defaults to `False`.

- [ ] **Step 6: Smoke against the live backend**

If uvicorn is up on `:8000`, restart it to pick up the model + engine changes:

```bash
lsof -iTCP:8000 -sTCP:LISTEN -t | xargs -r kill -9 || true
cd /Users/aarun/Workspace/Projects/RecViz/backend && set -a && source .env && set +a && nohup ./.venv/bin/uvicorn app.main:app --port 8000 > /tmp/recviz-uvicorn.log 2>&1 &
sleep 3 && curl -s http://localhost:8000/health
```
Expected: `{"status":"healthy",...}`.

- [ ] **Step 7: Commit (LOCAL ONLY)**

```bash
cd /Users/aarun/Workspace/Projects/RecViz
git add backend/app/services/merge_engine.py backend/app/api/data_sources.py backend/tests/test_merge_engine.py
git commit -m "feat(merge): coalesce_zero flag fills missing numeric cells with 0 (Plan 4 §12.6)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: `FilterMapping.options` + `_build_date_range_clause(exclude_today)`

**Files:**
- Modify `backend/app/models/data_source_config.py`
- Modify `backend/app/services/query_engine.py`
- Modify `backend/tests/test_query_engine.py` (or create `test_date_range_clause.py` if no query_engine test file exists — verify at execution)

- [ ] **Step 1: Locate existing query_engine tests**

```bash
cd /Users/aarun/Workspace/Projects/RecViz/backend && ls tests/ | grep -i -E "query|date|filter" && grep -rn "_build_date_range_clause\|date_range_clause" tests/ 2>/dev/null
```
If a test file already covers `_build_date_range_clause`, append to it; otherwise create `tests/test_date_range_clause.py`. Pick the right file before proceeding.

- [ ] **Step 2: Write the failing tests**

Append (or create) the following tests. The shape assumes a fresh file; if appending, drop the imports and the QueryExecutor construction lines as needed:

```python
import pytest
from app.services.query_engine import QueryExecutor


@pytest.fixture
def qx():
    """Bare QueryExecutor — we only need its method bodies; no DB."""
    return QueryExecutor.__new__(QueryExecutor)


def test_date_range_clause_default_ends_at_sysdate(qx):
    # RecViz / QuickRec semantics: includes today
    assert qx._build_date_range_clause(7, "oracle") == "BETWEEN SYSDATE - 7 AND SYSDATE"
    assert qx._build_date_range_clause(30, "oracle") == "BETWEEN SYSDATE - 30 AND SYSDATE"


def test_date_range_clause_exclude_today_ends_at_sysdate_minus_one(qx):
    # Legacy TLM semantics: excludes today
    assert qx._build_date_range_clause(7, "oracle", exclude_today=True) == "BETWEEN SYSDATE - 7 AND SYSDATE - 1"
    assert qx._build_date_range_clause(30, "oracle", exclude_today=True) == "BETWEEN SYSDATE - 30 AND SYSDATE - 1"


def test_date_range_clause_days_one_default_business_day(qx):
    # value==1 still uses the existing business-day DECODE; end stays SYSDATE
    clause = qx._build_date_range_clause(1, "oracle")
    assert "TRUNC(SYSDATE)" in clause
    assert clause.endswith("AND SYSDATE")
    assert "DECODE(TO_CHAR(SYSDATE,'D')" in clause


def test_date_range_clause_days_one_exclude_today_business_day(qx):
    # value==1 with exclude_today: end SYSDATE - 1 (parity with legacy
    # TlmStatsV2Service.getDateRangeClause line 627)
    clause = qx._build_date_range_clause(1, "oracle", exclude_today=True)
    assert "TRUNC(SYSDATE)" in clause
    assert clause.endswith("AND SYSDATE - 1")


def test_filter_mapping_options_threaded_to_date_clause(qx):
    """A FilterMapping with options={"exclude_today": true} must produce a
    SYSDATE-1-ending clause when substituted via _build_sql."""
    from app.models.data_source_config import (
        DataSourceConfig, DatabaseRoutingMapping, FilterMapping, ColumnDef,
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
    assert "BETWEEN SYSDATE - 7 AND SYSDATE\n" not in sql  # not the default
```

- [ ] **Step 3: Run the tests to verify they fail**

```bash
cd /Users/aarun/Workspace/Projects/RecViz/backend && ./.venv/bin/python -m pytest tests/test_date_range_clause.py -v
```
(Or the file you appended to.) Expected: all 5 new tests FAIL (`exclude_today` is not a kwarg yet; `FilterMapping` has no `options` field).

- [ ] **Step 4: Add `options` to `FilterMapping`**

Edit `/Users/aarun/Workspace/Projects/RecViz/backend/app/models/data_source_config.py`:

```python
class FilterMapping(BaseModel):
    filter_id: str
    sql_expr: str
    options: dict | None = None    # <-- ADD. JSON-typed; the column is JSON
                                   # so no Alembic migration needed.
```

- [ ] **Step 5: Parameterize `_build_date_range_clause`**

Edit `/Users/aarun/Workspace/Projects/RecViz/backend/app/services/query_engine.py`. Replace the helper:

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
    Matches `TlmStatsV2Service.getDateRangeClause` (Java) line 627-632.

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
        # SQLite branch: keep the existing default (used by tests + dev seed
        # that runs against SQLite). The `exclude_today` toggle currently only
        # alters the Oracle branch — TLM datasets are Oracle-only.
        return f"BETWEEN date('now', '-{value} days') AND date('now')"
    else:
        return f"BETWEEN CURRENT_DATE - INTERVAL '{value} days' AND CURRENT_DATE"
```

- [ ] **Step 6: Thread `fm.options` through the substitution site**

In the same file, find the `{{date_range_clause}}` substitution block (currently around line 139-142). Update it to read the `exclude_today` flag from `fm.options`:

```python
if "{{date_range_clause}}" in expr:
    opts = fm.options or {}
    exclude_today = bool(opts.get("exclude_today", False))
    clause = self._build_date_range_clause(
        int(fval), dialect, exclude_today=exclude_today
    )
    expr = expr.replace("{{date_range_clause}}", clause)
```

- [ ] **Step 7: Run the tests to verify they pass**

```bash
cd /Users/aarun/Workspace/Projects/RecViz/backend && ./.venv/bin/python -m pytest tests/test_date_range_clause.py -v
```
Expected: all 5 new tests PASS. Run the full backend test suite to confirm nothing else broke:

```bash
cd /Users/aarun/Workspace/Projects/RecViz/backend && ./.venv/bin/python -m pytest tests/ -v
```
Expected: no new failures.

- [ ] **Step 8: Verify the frontend type still compiles (no schema change visible there)**

The frontend `FilterMapping` type in `frontend/src/types/dashboard-config.ts` may not need touching at all — the field is optional and serialized by Pydantic via `model_dump(exclude_none=True)`. But if the frontend explicitly enumerates `FilterMapping` fields, add `options?: Record<string, unknown>`:

```bash
cd /Users/aarun/Workspace/Projects/RecViz/frontend && grep -n "FilterMapping\|filterMappings\b" src/types/dashboard-config.ts src/types/builder.ts 2>/dev/null | head -20
```
If `FilterMapping` is referenced as a typed interface, add the field. If only `filterMappings: Array<{ filterId: string; sqlExpr: string }>` literals are used at consumer sites, no change required.

- [ ] **Step 9: Smoke-restart uvicorn**

```bash
lsof -iTCP:8000 -sTCP:LISTEN -t | xargs -r kill -9 || true
cd /Users/aarun/Workspace/Projects/RecViz/backend && set -a && source .env && set +a && nohup ./.venv/bin/uvicorn app.main:app --port 8000 > /tmp/recviz-uvicorn.log 2>&1 &
sleep 3 && curl -s http://localhost:8000/health
```

- [ ] **Step 10: Commit (LOCAL ONLY)**

```bash
cd /Users/aarun/Workspace/Projects/RecViz
git add backend/app/models/data_source_config.py backend/app/services/query_engine.py backend/tests/
git commit -m "feat(filters): FilterMapping.options + exclude_today date-clause variant (Plan 4 §12.7)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: Three TLM datasets in `seed-oracle.py`

**Files:**
- Modify `scripts/seed-oracle.py` — add `ds-tlm-automatch`, `ds-tlm-breaks`, `ds-tlm-manual-match` inside `CURATED_DATASETS` and emit via `seed_managed_datasets`.

- [ ] **Step 1: Locate the dataset registration block**

```bash
cd /Users/aarun/Workspace/Projects/RecViz && grep -n "ds-qr-automatch\|ds-qr-manual\|CURATED_DATASETS" scripts/seed-oracle.py | head -20
```
This finds where the QuickRec datasets live (Plan 2 reference). Insert the TLM datasets immediately after them inside the same `CURATED_DATASETS` list.

- [ ] **Step 2: Build the `TLM_INSTANCE_MAPPING` constant**

In `scripts/seed-oracle.py`, near the top of the curated section (alongside any existing `CURATED_*` constants), define:

```python
# Friendly TLM-instance name → RecViz connection id. Only TLMP_CONSUMER has a
# local seed (Plan 3 Task 4). Production would seed every entry from
# TlmStatsV2Service.TLM_INSTANCE_MAP (38-50). The dynamic-routing engine
# raises if a requested filter value isn't in the mapping — for the local
# demo, only TLMP_CONSUMER produces results; other values surface as a clear
# "no database mapping" error in the response.
TLM_INSTANCE_MAPPING: dict[str, str] = {
    "TLMP_CONSUMER": "conn-tcosprd",
}
```

- [ ] **Step 3: Register `ds-tlm-automatch`**

Append to `CURATED_DATASETS`:

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
        {"name": "tlm_instance", "type": "string", "label": "TLM Instance"},
        {"name": "agent_code", "type": "string", "label": "Recon"},
        {"name": "set_id", "type": "string", "label": "Set ID"},
        {"name": "stmt_date", "type": "date", "label": "Statement Date"},
        {"name": "bran_code", "type": "string", "label": "Branch"},
        {"name": "corr_acc_no", "type": "string", "label": "Correspondent Acct"},
        {"name": "total_items", "type": "number", "label": "Total Items"},
        {"name": "automatch_items", "type": "number", "label": "Automatch Items"},
    ],
    "filter_mappings": [
        # The tlm_instance filter is consumed by the dynamic-routing resolver
        # BEFORE substitution — it does NOT appear in the SQL. Listed here
        # only so the frontend filter bar exposes it; the resolver picks up
        # the value via `routing.route_by_filter` independent of these maps.
        # The `1=1` no-op keeps the routing-consumed filter from getting an
        # `AND <empty>` from the substitution loop.
        {"filter_id": "tlm_instance", "sql_expr": "1=1"},
        {"filter_id": "recon",        "sql_expr": "b.agent_code IN ({{values}})"},
        {"filter_id": "set_id",       "sql_expr": "b.local_acc_no IN ({{values}})"},
        {
            "filter_id": "date_range_days",
            "sql_expr": "i.stmt_date {{date_range_clause}}",
            "options": {"exclude_today": True},   # legacy TLM semantics §12.7
        },
    ],
},
```

**Substitution-shape verification (do BEFORE pasting):** RecViz's `_build_sql` (`query_engine.py` lines ~108-160) prepends `AND ` to each filter clause automatically — verified in the §12.8 spike at line 152: `filter_clauses.append(f"AND {expr}")`. The `sql_expr` values above therefore do NOT carry leading `AND `. Re-confirm this against the live source before pasting — if the loop has changed, prepend `AND ` to each clause to match.

- [ ] **Step 4: Register `ds-tlm-breaks`**

Append to `CURATED_DATASETS`. RecViz `_build_sql` only supports a single `{{filters}}` placeholder. The legacy Java has the agent/set filters in the CTE and the date filter on the outer SELECT — but here we land all filters in one outer-`WHERE` substitution point and let the CTE materialize the full `bank ⋈ message_feed` pairing first. The outer SELECT then references the `static s` alias (CTE) for agent/set columns and the `item i` alias for date — matching the legacy Java semantically:

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
        {"name": "agent_code",  "type": "string", "label": "Recon"},
        {"name": "set_id",      "type": "string", "label": "Set ID"},
        {"name": "stmt_date",   "type": "date",   "label": "Statement Date"},
        {"name": "bran_code",   "type": "string", "label": "Branch"},
        {"name": "breaks_count", "type": "number", "label": "Break Count"},
    ],
    "filter_mappings": [
        {"filter_id": "tlm_instance", "sql_expr": "1=1"},
        # agent/set reference the `s.` alias (the CTE), not `k.`, because
        # they're applied in the outer SELECT not inside the CTE.
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

- [ ] **Step 5: Register `ds-tlm-manual-match`**

Append to `CURATED_DATASETS`:

```python
{
    "id": "ds-tlm-manual-match",
    "name": "TLM Manual Match",
    "description": (
        "Reconmgmt manual-match counts: UNION ALL of "
        "mr_csum_man_match_details and mr_csum_netting_hist, grouped by "
        "(tlm_instance, agent_code, set_id, stmt_date, bran_code, "
        "corr_acc_no). Static-routed to conn-reconmgmt. Source-of-truth: "
        "TlmStatsV2Service.buildManualMatchQuery (547-622)."
    ),
    "database_routing": {
        "type": "static",
        "database": "conn-reconmgmt",
    },
    "sql_template": (
        "SELECT tlm_instance, agent_code, set_id, stmt_date, bran_code, "
        "       corr_acc_no, SUM(manual_match_count) AS total_manual_match_count "
        "FROM ( "
        "  SELECT m.tlm_instance, m.agent_code, m.set_id, m.stmt_date, "
        "         m.bran_code, m.corr_acc_no, "
        "         COUNT(*) AS manual_match_count "
        "  FROM mr_csum_man_match_details m "
        "  WHERE 1=1 {{filters}} "
        "  GROUP BY m.tlm_instance, m.agent_code, m.set_id, m.stmt_date, "
        "           m.bran_code, m.corr_acc_no "
        "  UNION ALL "
        "  SELECT n.tlm_instance, n.agent_code, n.set_id, n.stmt_date, "
        "         n.bran_code, n.corr_acc_no, "
        "         COUNT(*) AS manual_match_count "
        "  FROM mr_csum_netting_hist n "
        "  WHERE 1=1 {{filters}} "
        "  GROUP BY n.tlm_instance, n.agent_code, n.set_id, n.stmt_date, "
        "           n.bran_code, n.corr_acc_no "
        ") "
        "GROUP BY tlm_instance, agent_code, set_id, stmt_date, bran_code, corr_acc_no"
    ),
    "columns": [
        {"name": "tlm_instance", "type": "string", "label": "TLM Instance"},
        {"name": "agent_code", "type": "string", "label": "Recon"},
        {"name": "set_id", "type": "string", "label": "Set ID"},
        {"name": "stmt_date", "type": "date", "label": "Statement Date"},
        {"name": "bran_code", "type": "string", "label": "Branch"},
        {"name": "corr_acc_no", "type": "string", "label": "Correspondent Acct"},
        {"name": "total_manual_match_count", "type": "number", "label": "Manual Match Count"},
    ],
    "filter_mappings": [
        # The same three filters apply to BOTH legs of the UNION ALL. RecViz's
        # str.replace("{{filters}}", ...) replaces all occurrences — so writing
        # {{filters}} twice in the SQL gets the same clause string injected
        # into both legs. Confirmed by reading query_engine.py:156.
        {
            "filter_id": "tlm_instance",
            "sql_expr": "tlm_instance = '{{value}}'",
        },
        {
            "filter_id": "recon",
            "sql_expr": "agent_code IN ({{values}})",
        },
        {
            "filter_id": "set_id",
            "sql_expr": "set_id IN ({{values}})",
        },
        {
            "filter_id": "date_range_days",
            "sql_expr": "stmt_date {{date_range_clause}}",
            "options": {"exclude_today": True},
        },
    ],
},
```

**Important**: this dataset assumes `mr_csum_man_match_details` and `mr_csum_netting_hist` have columns `tlm_instance`, `agent_code`, `set_id`, `stmt_date`, `bran_code`, `corr_acc_no`. Verify against `rectrace-local-dev/schema/03-reconmgmt.sql` before pasting. If a column name differs (e.g. `recon` instead of `agent_code`), adjust the SELECT list and filter mappings to match the actual schema — the legacy Java in `buildManualMatchQuery` (547-622) is the source-of-truth for which columns these tables expose.

- [ ] **Step 6: Re-run the seed**

```bash
cd /Users/aarun/Workspace/Projects/RecViz/backend && PYTHONPATH=. ./.venv/bin/python ../scripts/seed-oracle.py 2>&1 | tail -20
```
Expected: the seed completes; tail shows the 3 new datasets registered (look for `ds-tlm-automatch`, `ds-tlm-breaks`, `ds-tlm-manual-match` in the output, or the `recviz_datasets: N rows` line jumping by 3).

- [ ] **Step 7: Verify each dataset preview via the API**

```bash
# Automatch (requires tlm_instance for dynamic routing)
curl -s -X POST http://localhost:8000/api/data-sources/ds-tlm-automatch/preview \
  -H 'content-type: application/json' \
  -d '{"filters":{"tlm_instance":"TLMP_CONSUMER","date_range_days":7}}' | python -m json.tool | head -40

# Breaks (same routing)
curl -s -X POST http://localhost:8000/api/data-sources/ds-tlm-breaks/preview \
  -H 'content-type: application/json' \
  -d '{"filters":{"tlm_instance":"TLMP_CONSUMER","date_range_days":7}}' | python -m json.tool | head -40

# Manual-match (static reconmgmt)
curl -s -X POST http://localhost:8000/api/data-sources/ds-tlm-manual-match/preview \
  -H 'content-type: application/json' \
  -d '{"filters":{"tlm_instance":"TLMP_CONSUMER","date_range_days":7}}' | python -m json.tool | head -40
```
Expected: each returns rows. Inspect the row counts; remember from Plan 3 the tcosprd schema has 7550 item rows + 55 of each parent over a 30-day window. With `date_range_days=7 AND exclude_today`, expect a fraction of those.

- [ ] **Step 8: Verify the cross-DB merge end-to-end**

```bash
curl -s -X POST http://localhost:8000/api/data-sources/merge \
  -H 'content-type: application/json' \
  -d '{
    "sources": ["ds-tlm-automatch","ds-tlm-manual-match"],
    "merge_on": ["tlm_instance","agent_code","set_id","stmt_date","bran_code","corr_acc_no"],
    "merge_type": "outer_join",
    "coalesce_zero": true,
    "filters": {"tlm_instance":"TLMP_CONSUMER","date_range_days":7}
  }' | python -m json.tool | head -60
```
Expected: rows where matched ones have all 3 numeric columns populated, left-only rows have `total_manual_match_count: 0`, right-only rows have `total_items: 0, automatch_items: 0`. Verify the zero-coalescing visually.

- [ ] **Step 9: Commit (LOCAL ONLY)**

```bash
cd /Users/aarun/Workspace/Projects/RecViz
git add scripts/seed-oracle.py
git commit -m "feat(seed): register ds-tlm-automatch/breaks/manual-match datasets (Plan 4 §12.8)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: TLM dashboard config

**Files:**
- Modify `scripts/seed-oracle.py` — add `dash-tlm-stats` to `CURATED_DASHBOARDS` and 4 KPIs to `CURATED_KPIS`.

- [ ] **Step 1: Register 4 KPIs**

Find `CURATED_KPIS` in `scripts/seed-oracle.py` (Plan 2 added the QuickRec KPIs there). Append:

```python
# ---- TLM dashboard KPIs (Plan 4) ----
{
    "id": "kpi-tlm-total-items",
    "name": "Total Items",
    "data_source_id": "ds-tlm-automatch",
    "aggregation": "SUM",
    "column": "total_items",
    "accent_color": "--chart-1",       # blue — matches QuickRec records KPI
    "trend": None,
},
{
    "id": "kpi-tlm-automatch",
    "name": "Automatched",
    "data_source_id": "ds-tlm-automatch",
    "aggregation": "SUM",
    "column": "automatch_items",
    "accent_color": "--chart-positive", # green — matches QuickRec auto KPI
    "trend": {
        "type": "percentage_of",
        "of_kpi": "kpi-tlm-total-items",
        "display": "ratio",             # neutral pill (no green/red arrow)
    },
},
{
    "id": "kpi-tlm-total-breaks",
    "name": "Total Breaks",
    "data_source_id": "ds-tlm-breaks",
    "aggregation": "SUM",
    "column": "breaks_count",
    "accent_color": "--chart-warning",   # amber — matches QuickRec breaks KPI
    "trend": None,
},
{
    "id": "kpi-tlm-manual-match",
    "name": "Manual Matched",
    "data_source_id": "ds-tlm-manual-match",
    "aggregation": "SUM",
    "column": "total_manual_match_count",
    "accent_color": "--series-8",        # violet — matches QuickRec manual KPI
    "trend": {
        "type": "percentage_of",
        "of_kpi": "kpi-tlm-total-items",
        "display": "ratio",
    },
},
```

Verify field names against the existing QuickRec KPI entries — the casing convention in `CURATED_KPIS` may be `accentColor` not `accent_color`, etc. Match the existing convention exactly.

- [ ] **Step 2: Register the TLM dashboard**

Append to `CURATED_DASHBOARDS`:

```python
{
    "id": "dash-tlm-stats",
    "name": "TLM Stats",
    "description": (
        "Per-TLM-instance reconciliation and breaks. Embeds in the rectrace "
        "TLM-stats modal when a user clicks a tlm_instance / set_id / recon "
        "cell."
    ),
    "config": {
        "filters": [
            {
                "id": "tlm_instance",
                "label": "TLM Instance",
                "type": "select",
                "options_source": {
                    "type": "static",
                    "options": [{"value": "TLMP_CONSUMER", "label": "TLMP_CONSUMER"}],
                },
            },
            {
                "id": "recon",
                "label": "Recon",
                "type": "multi-select",
                "options_source": {
                    "type": "distinct_column",
                    "data_source_id": "ds-tlm-automatch",
                    "column": "agent_code",
                },
            },
            {
                "id": "set_id",
                "label": "Set ID",
                "type": "multi-select",
                "options_source": {
                    "type": "distinct_column",
                    "data_source_id": "ds-tlm-automatch",
                    "column": "set_id",
                },
            },
            {
                "id": "date_range_days",
                "label": "Date Range",
                "type": "select",
                "default_value": 1,
                "options_source": {
                    "type": "static",
                    "options": [
                        {"value": 1, "label": "1 day"},
                        {"value": 7, "label": "7 days"},
                        {"value": 30, "label": "30 days"},
                    ],
                },
            },
        ],
        "kpis": [
            {"id": "kpi-tlm-total-items"},
            {"id": "kpi-tlm-automatch"},
            {"id": "kpi-tlm-total-breaks"},
            {"id": "kpi-tlm-manual-match"},
        ],
        "charts": [],
        "grids": [
            {
                "id": "grid-tlm-reconciliation",
                "title": "Reconciliation",
                "data_source_id": "ds-tlm-automatch",
                "merge": {
                    "sources": ["ds-tlm-automatch", "ds-tlm-manual-match"],
                    "merge_on": [
                        "tlm_instance", "agent_code", "set_id",
                        "stmt_date", "bran_code", "corr_acc_no",
                    ],
                    "merge_type": "outer_join",
                    "coalesce_zero": True,
                },
                "columns": [
                    {"name": "tlm_instance", "header": "TLM Instance"},
                    {"name": "agent_code",   "header": "Recon"},
                    {"name": "set_id",       "header": "Set ID"},
                    {"name": "stmt_date",    "header": "Statement Date"},
                    {"name": "bran_code",    "header": "Branch"},
                    {"name": "corr_acc_no",  "header": "Correspondent Acct"},
                    {"name": "total_items",  "header": "Total Items"},
                    {"name": "automatch_items", "header": "Automatched"},
                    {"name": "total_manual_match_count", "header": "Manual Match"},
                ],
                "visible_when": {
                    "kpi": "kpi-tlm-total-items",
                    "condition": "gt",
                    "value": 0,
                },
                "layout": {"span": 12},
            },
            {
                "id": "grid-tlm-breaks",
                "title": "Breaks",
                "data_source_id": "ds-tlm-breaks",
                "columns": [
                    {"name": "agent_code",   "header": "Recon"},
                    {"name": "set_id",       "header": "Set ID"},
                    {"name": "stmt_date",    "header": "Statement Date"},
                    {"name": "bran_code",    "header": "Branch"},
                    {"name": "breaks_count", "header": "Break Count"},
                ],
                "visible_when": {
                    "kpi": "kpi-tlm-total-breaks",
                    "condition": "gt",
                    "value": 0,
                },
                "layout": {"span": 12},
            },
        ],
        "layout": {
            "sections": ["filters", "kpis", "grids"],
        },
    },
},
```

**Field-naming caveat**: the actual field names (`options_source` vs `optionsSource`, `data_source_id` vs `dataSourceId`, `visible_when` vs `visibleWhen`) depend on whether the seed config dict is written in camelCase (the Pydantic API alias) or snake_case (the storage alias). Compare to the QuickRec dashboard entry already registered on `feature/quickrec-dashboard` and use the SAME casing as that working precedent. The Python `CamelModel` auto-aliases between the two, so either works if consistent — match the existing seed style.

- [ ] **Step 3: Re-seed and verify the dashboard registers**

```bash
cd /Users/aarun/Workspace/Projects/RecViz/backend && PYTHONPATH=. ./.venv/bin/python ../scripts/seed-oracle.py 2>&1 | tail -10
curl -s "http://localhost:8000/api/dashboards/dash-tlm-stats" | python -m json.tool | head -50
```
Expected: dashboard JSON returns with the 4 filters, 4 KPIs, 2 grids, and the merge spec.

- [ ] **Step 4: Open the embed page directly in a browser to eyeball it**

```bash
echo "Open: http://localhost:5173/embed/dashboards/dash-tlm-stats?filter.tlm_instance=TLMP_CONSUMER&filter.lock=tlm_instance&theme=light"
```
Expected: the embed page loads, KPIs populate, the reconciliation grid renders rows with `0`s in left-only / right-only cells (from coalesce_zero), the breaks grid renders if `breaks_count > 0`.

- [ ] **Step 5: Commit (LOCAL ONLY)**

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

- [ ] **Step 1: Verify the rectrace branch**

```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer && git status -sb
```
Expected: `## milestone/modernization...`. If not, `git checkout milestone/modernization`.

- [ ] **Step 2: Read the QuickRecStatsCellRenderer precedent (don't modify it — read for shape)**

```bash
cat frontend-react/src/search/renderers/QuickRecStatsCellRenderer.tsx
cat frontend-react/src/search/renderers/registry.ts
```
Note the exact shape: cell value displayed as a clickable link with an icon, gated on a `data.tlm_instance` comparison (`tlm_instance === 'QuickRec'`), opening a modal that builds a RecViz embed URL with `filter.lock`. The TLM renderer mirrors this 1:1.

- [ ] **Step 3: Write the failing test**

Create `/Users/aarun/Workspace/Projects/autosys-job-explorer/frontend-react/src/search/renderers/TlmStatsCellRenderer.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TlmStatsCellRenderer, computeTlmLockList } from './TlmStatsCellRenderer'

describe('computeTlmLockList', () => {
  it('locks tlm_instance + recon + set_id when entryPoint is set_id', () => {
    expect(computeTlmLockList('set_id')).toEqual(['tlm_instance', 'recon', 'set_id'])
  })
  it('locks tlm_instance + recon when entryPoint is recon', () => {
    expect(computeTlmLockList('recon')).toEqual(['tlm_instance', 'recon'])
  })
  it('locks only tlm_instance when entryPoint is tlm_instance', () => {
    expect(computeTlmLockList('tlm_instance')).toEqual(['tlm_instance'])
  })
  it('falls back to tlm_instance-only for an unknown entry point', () => {
    expect(computeTlmLockList('unknown' as any)).toEqual(['tlm_instance'])
  })
})

describe('TlmStatsCellRenderer', () => {
  it('renders the cell value as a button when tlm_instance is present', () => {
    const onOpen = vi.fn()
    render(
      <TlmStatsCellRenderer
        value="TLMP_CONSUMER"
        data={{ tlm_instance: 'TLMP_CONSUMER', recon: 'TRADE_RECON_NA', set_id: 'SETID_001' }}
        entryPoint="tlm_instance"
        onOpen={onOpen}
      />
    )
    expect(screen.getByRole('button', { name: /TLMP_CONSUMER/i })).toBeInTheDocument()
  })

  it('renders the raw value (no button) when tlm_instance is empty', () => {
    render(
      <TlmStatsCellRenderer
        value="—"
        data={{ tlm_instance: null, recon: 'X', set_id: 'Y' }}
        entryPoint="tlm_instance"
        onOpen={() => {}}
      />
    )
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('invokes onOpen with the right filter payload on click', async () => {
    const onOpen = vi.fn()
    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    render(
      <TlmStatsCellRenderer
        value="SETID_001"
        data={{ tlm_instance: 'TLMP_CONSUMER', recon: 'TRADE_RECON_NA', set_id: 'SETID_001' }}
        entryPoint="set_id"
        onOpen={onOpen}
      />
    )
    await user.click(screen.getByRole('button'))
    expect(onOpen).toHaveBeenCalledWith({
      dashboardId: 'dash-tlm-stats',
      filters: {
        tlm_instance: 'TLMP_CONSUMER',
        recon: 'TRADE_RECON_NA',
        set_id: 'SETID_001',
      },
      lock: ['tlm_instance', 'recon', 'set_id'],
    })
  })
})
```

- [ ] **Step 4: Run the test to verify it fails**

```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer/frontend-react && pnpm vitest run src/search/renderers/TlmStatsCellRenderer.test.tsx
```
Expected: FAIL with `Cannot find module './TlmStatsCellRenderer'`.

- [ ] **Step 5: Implement the renderer**

Create `/Users/aarun/Workspace/Projects/autosys-job-explorer/frontend-react/src/search/renderers/TlmStatsCellRenderer.tsx`:

```tsx
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type TlmEntryPoint = 'set_id' | 'recon' | 'tlm_instance'

export interface TlmStatsCellRendererProps {
  value: unknown
  data: {
    tlm_instance?: string | null
    recon?: string | null
    set_id?: string | null
  }
  entryPoint: TlmEntryPoint
  onOpen: (args: {
    dashboardId: string
    filters: Record<string, string>
    lock: string[]
  }) => void
}

/**
 * Compute the filter-lock list for the TLM stats modal based on which cell
 * was clicked. Matches Angular `TlmStatsModalV2Component.initializeFilterState`:
 *  - set_id entry: locks tlm_instance + recon + set_id
 *  - recon  entry: locks tlm_instance + recon
 *  - tlm_instance entry: locks only tlm_instance
 *
 * The locked filters render with a lock icon and are not editable; the
 * unlocked filters become normal multi-select / select inputs in the modal.
 */
export function computeTlmLockList(entry: TlmEntryPoint): string[] {
  switch (entry) {
    case 'set_id':
      return ['tlm_instance', 'recon', 'set_id']
    case 'recon':
      return ['tlm_instance', 'recon']
    case 'tlm_instance':
      return ['tlm_instance']
    default:
      return ['tlm_instance']
  }
}

/**
 * Angular-faithful TLM-stats cell renderer. Renders the cell value as a
 * clickable button when `data.tlm_instance` is non-empty; otherwise renders
 * the raw value as plain text (a row whose TLM instance is null cannot open
 * the modal because dynamic routing needs the instance value).
 *
 * Mirrors `QuickRecStatsCellRenderer` (Plan 2): cell value AS link, not a
 * sidecar button. The `entryPoint` AG-Grid `cellRendererParams` field
 * indicates which column was clicked (tlm_instance / set_id / recon).
 */
export function TlmStatsCellRenderer(props: TlmStatsCellRendererProps) {
  const { value, data, entryPoint, onOpen } = props
  const tlm = data.tlm_instance
  if (!tlm) return <span>{value as string}</span>

  const filters: Record<string, string> = { tlm_instance: tlm }
  if (data.recon) filters.recon = data.recon
  if (data.set_id) filters.set_id = data.set_id

  return (
    <Button
      variant="link"
      size="sm"
      className="h-auto p-0 font-normal"
      onClick={() =>
        onOpen({
          dashboardId: 'dash-tlm-stats',
          filters,
          lock: computeTlmLockList(entryPoint),
        })
      }
    >
      <Sparkles className="mr-1 h-3 w-3" />
      {value as string}
    </Button>
  )
}
```

- [ ] **Step 6: Run the test to verify it passes**

```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer/frontend-react && pnpm vitest run src/search/renderers/TlmStatsCellRenderer.test.tsx
```
Expected: all 7 tests passing.

- [ ] **Step 7: Wire the renderer into the registry**

Edit `/Users/aarun/Workspace/Projects/autosys-job-explorer/frontend-react/src/search/renderers/registry.ts`. Find the `RENDERERS` export (or however the registry exposes the lookup map — verify name) and add:

```ts
import { TlmStatsCellRenderer } from './TlmStatsCellRenderer'

export const RENDERERS = {
  // ... existing ...
  tlmStatsButtonRenderer: TlmStatsCellRenderer,   // <-- ADD
}
```

The registry pattern was established by `quickRecStatsButtonRenderer` (Plan 2); follow the EXACT same shape — including how the modal-open handler (`onOpen`) gets bound. In Plan 2 the handler was bound via `cellRendererParams` at the search-grid level; the TLM renderer reads it identically. If the registry signature differs, mirror Plan 2's wiring 1-for-1.

- [ ] **Step 8: Run typecheck + lint + tests**

```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer/frontend-react && pnpm typecheck && pnpm lint && pnpm vitest run
```
Expected: typecheck passes; lint has no NEW errors (the baseline 6 pre-existing errors from `[[project_frontend_lint_baseline]]` may still appear — those are not new); all tests pass.

- [ ] **Step 9: Commit (LOCAL ONLY)**

```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer
git add frontend-react/src/search/renderers/TlmStatsCellRenderer.tsx \
       frontend-react/src/search/renderers/TlmStatsCellRenderer.test.tsx \
       frontend-react/src/search/renderers/registry.ts
git commit -m "feat(search): TlmStatsCellRenderer (Angular-faithful, Plan 4)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7: Wire `tlmStatsButtonRenderer` in `search-config-v4.json`

**Files:**
- Modify `backend/rectrace/src/main/resources/search-config-v4.json`

- [ ] **Step 1: Identify the categories and columns to touch**

```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer && grep -n '"tlm_instance"\|"set_id"\|"recon"' backend/rectrace/src/main/resources/search-config-v4.json | head -40
```
The TLM stats button should appear on `tlm_instance`, `set_id`, and `recon` columns in every category that surfaces them — Plan 2 used the analogous wiring on `recon_id` + `recon_portal_id` for `quickRecStatsButtonRenderer` across 5 categories. List the categories where these 3 columns appear (likely `reconName`, `boxName`, `setId`, `subAcc`, `loadFileName` — same set as QuickRec's).

- [ ] **Step 2: Add `cellRenderer` + `cellRendererParams.entryPoint` to each column**

For each `tlm_instance` column entry across the categories, add:

```json
"cellRenderer": "tlmStatsButtonRenderer",
"cellRendererParams": { "entryPoint": "tlm_instance" }
```

For each `set_id` column:

```json
"cellRenderer": "tlmStatsButtonRenderer",
"cellRendererParams": { "entryPoint": "set_id" }
```

For each `recon` column:

```json
"cellRenderer": "tlmStatsButtonRenderer",
"cellRendererParams": { "entryPoint": "recon" }
```

The exact JSON path within each column object depends on the existing schema (Plan 2's QuickRec wiring is the precedent — `cellRenderer` lives at the column-object root, `cellRendererParams` is a sibling). Match the QuickRec entries exactly.

- [ ] **Step 3: Rebuild + restart the rectrace backend so the new config loads**

```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer && lsof -iTCP:6088 -sTCP:LISTEN -t | xargs -r kill -9 || true
cd backend/rectrace && nohup mvn -q spring-boot:run -Dspring-boot.run.profiles=local > /tmp/rectrace-backend.log 2>&1 &
sleep 30 && curl -s http://localhost:6088/rectrace/api/v4/search/config | python -m json.tool | grep -A2 '"tlm_instance"\|"set_id"\|"recon"' | head -40
```
(Per `[[project_ops_backend_orphan]]` — kill the listener on `:6088` first.) Expected: the config JSON has `cellRenderer: "tlmStatsButtonRenderer"` on the relevant columns.

- [ ] **Step 4: Manually verify in the React UI**

```bash
echo "Open: http://localhost:5173/search?q=TLMP_CONSUMER&cat=reconName"
```
Expected: the grid shows rows; `tlm_instance`, `set_id`, and `recon` cells render as clickable links with the sparkles icon. Click one — the modal opens with the TLM dashboard, KPIs populate, the reconciliation grid shows merged rows with `0`s in unmatched-side cells.

- [ ] **Step 5: Commit (LOCAL ONLY)**

```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer
git add backend/rectrace/src/main/resources/search-config-v4.json
git commit -m "feat(search): wire tlmStatsButtonRenderer on tlm_instance/set_id/recon (Plan 4)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 8: End-to-end Playwright verification

**Files:**
- Create `frontend-react/e2e/tlm-stats-modal.spec.ts`

- [ ] **Step 1: Verify the existing Playwright setup**

```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer/frontend-react && ls e2e/ && cat e2e/playwright.config.ts 2>/dev/null | head -30
```
Confirm the config exists; note the `baseURL` and `webServer` settings.

- [ ] **Step 2: Write the failing end-to-end test**

Create `/Users/aarun/Workspace/Projects/autosys-job-explorer/frontend-react/e2e/tlm-stats-modal.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

const ORIGIN = process.env.RECTRACE_E2E_ORIGIN ?? 'http://localhost:5173'

test.describe('TLM stats modal (embedded RecViz dashboard)', () => {
  test('opens the TLM dashboard when a tlm_instance cell is clicked, shows merged rows with zero-coalescing', async ({ page }) => {
    await page.goto(`${ORIGIN}/search?q=TLMP_CONSUMER&cat=reconName`)

    // Wait for the grid to populate
    await page.locator('[role="grid"]').first().waitFor({ state: 'visible' })

    // The TLM-stats button renders on tlm_instance cells. Find one whose
    // value is TLMP_CONSUMER (the only friendly name seeded locally) and
    // click it.
    const tlmCell = page.getByRole('button', { name: /^TLMP_CONSUMER$/ }).first()
    await tlmCell.waitFor({ state: 'visible', timeout: 10_000 })
    await tlmCell.click()

    // Modal opens. The RecViz embed iframe loads dash-tlm-stats.
    const iframe = page.frameLocator('iframe[src*="/embed/dashboards/dash-tlm-stats"]')

    // KPI row populates with 4 KPIs
    await expect(iframe.getByText('Total Items')).toBeVisible({ timeout: 15_000 })
    await expect(iframe.getByText('Automatched')).toBeVisible()
    await expect(iframe.getByText('Total Breaks')).toBeVisible()
    await expect(iframe.getByText('Manual Matched')).toBeVisible()

    // The reconciliation grid shows rows (visibleWhen total_items > 0).
    // At least one row has a numeric Manual Match cell that is 0 OR a
    // numeric Total Items cell that is 0 — proving the coalesce_zero merge
    // produced filled cells rather than blanks.
    const grid = iframe.locator('[role="grid"]').first()
    await grid.waitFor({ state: 'visible', timeout: 15_000 })

    // Look for at least one "0" cell in a numeric column. Any of the
    // coalesce-filled cells should produce a literal "0" — without
    // coalesce_zero they'd be blank/null and the test would fail to find
    // the text.
    const zeroCell = iframe.getByRole('gridcell', { name: '0' }).first()
    await expect(zeroCell).toBeVisible({ timeout: 5_000 })
  })

  test('breaks grid is hidden when total_breaks == 0', async ({ page }) => {
    await page.goto(`${ORIGIN}/search?q=TLMP_CONSUMER&cat=reconName`)
    await page.locator('[role="grid"]').first().waitFor({ state: 'visible' })

    const tlmCell = page.getByRole('button', { name: /^TLMP_CONSUMER$/ }).first()
    await tlmCell.click()

    const iframe = page.frameLocator('iframe[src*="/embed/dashboards/dash-tlm-stats"]')

    // Set the date range to a window with no breaks (e.g. 1 day, where the
    // synthetic seed may or may not have flag_2=0 rows). The local seed has
    // flag_2 ∈ {0,1,11} for ALL date ranges so this assertion is only safe
    // for an empty-window scenario.
    //
    // For the demo, just assert that the Breaks grid title is gated on KPI
    // value: if total_breaks > 0 it shows; if == 0 it hides. We can't
    // reliably force 0 breaks with the seeded data, so verify the grid is
    // visible OR hidden in a way consistent with the visibleWhen rule.
    const breaksTitle = iframe.getByText(/^Breaks$/)
    const totalBreaksValue = await iframe
      .locator(':text("Total Breaks") + * .kpi-value, [data-testid="kpi-tlm-total-breaks-value"]')
      .first()
      .textContent()
      .catch(() => '')

    const breaksCount = Number(totalBreaksValue?.replace(/[^\d]/g, '')) || 0
    if (breaksCount > 0) {
      await expect(breaksTitle).toBeVisible()
    } else {
      await expect(breaksTitle).toHaveCount(0)
    }
  })
})
```

- [ ] **Step 3: Run the test against the live stack**

```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer/frontend-react && pnpm playwright test e2e/tlm-stats-modal.spec.ts --headed
```
Expected: both tests pass. If the first test fails because no TLMP_CONSUMER row appears in the search, verify:
  - The Oracle stack is up (`docker compose ps` in `rectrace-local-dev`).
  - The seed ran with `--volume 10` (per Plan 3 Task 2).
  - The reconmgmt seed actually emits TLMP_CONSUMER (per Plan 3 Step 2b normalization, 93 occurrences).
  - The rectrace backend re-loaded the search-config (Task 7 restart).

If a row exists but the button isn't clickable, verify Task 6 + Task 7 wiring — `cellRenderer: "tlmStatsButtonRenderer"` must be present in `/api/v4/search/config` for the column.

- [ ] **Step 4: Capture screenshots for the PR/handoff**

```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer/frontend-react && pnpm playwright test e2e/tlm-stats-modal.spec.ts --headed --reporter=html
```
Open the HTML report; screenshot the modal-open state showing zero-coalescing cells.

- [ ] **Step 5: Commit (LOCAL ONLY)**

```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer
git add frontend-react/e2e/tlm-stats-modal.spec.ts
git commit -m "test(e2e): TLM stats modal opens RecViz dashboard with zero-coalesced merge (Plan 4)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Done criteria for Plan 4

- `visibleWhen` supported on `KpiConfig` + `DashboardChartConfig` (frontend), shared `lib/visibility.ts` extracted, behavior-preserving for grids.
- `MergeRequest.coalesce_zero` flag fills missing numeric cells with `0` per cursor-detected column types; default off preserves existing behavior; tests cover both branches.
- `FilterMapping.options` accepts a JSON dict; `_build_date_range_clause` honors `exclude_today` per-mapping; date semantics match legacy TLM (`SYSDATE - 1`-ended).
- `ds-tlm-automatch`, `ds-tlm-breaks`, `ds-tlm-manual-match` registered with correct SQL, routing, filter mappings.
- `dash-tlm-stats` renders 4 KPIs, 2 grids, cross-DB merge produces dense numeric rows.
- `TlmStatsCellRenderer` renders on `tlm_instance`/`set_id`/`recon` cells across the relevant categories; click opens the modal with the correct `filter.lock` payload.
- Playwright spec passes: search → click cell → modal opens → KPIs populate → reconciliation grid shows zero-coalesced cells.
- All commits local; nothing pushed.

## Self-review notes

- **Spec coverage:** §6.5 (embed surface — already done in Plan 1, consumed by Task 6), §7 (TLM data semantics — Tasks 4-5), §12.1 (panel visibility — Task 1), §12.2 (TLM-instance friendly↔DB_NAME — already done in Plan 3 Task 4), §12.5 (instance normalization seed-side — done in Plan 3 Task 2 Step 2b; SQL-side normalization NOT needed because the dataset `database_routing.mapping` keys are friendly names), §12.6 (MergeEngine — Task 2), §12.7 (date clause — Task 3), §12.8 (TLM breaks pure-SQL — Task 4).
- **Decision check** — every Task aligns with the spike outcomes locked in via AskUserQuestion: §12.1=A, §12.6=B, §12.7=B, §12.8=A.
- **Placeholder scan** — every step has actual code or actual commands. The few `Verify at execution` notes flag legitimate ambiguities (CamelModel casing convention, registry signature shape, RecViz prefix-stripping behavior) where the implementer must read the existing code rather than guess. None are "TODO add error handling" or similar.
- **Type consistency** — `visibleWhen` referenced in Tasks 1 + 5 uses the same `{kpi, condition, value}` shape. `coalesce_zero` referenced in Tasks 2 + 5 same name + type. `FilterMapping.options` referenced in Tasks 3 + 4 same shape. `dash-tlm-stats` referenced in Tasks 5 + 6 + 8 same id. `tlmStatsButtonRenderer` referenced in Tasks 6 + 7 + 8 same key.
- **Branch hygiene** — all RecViz work (Tasks 1-5) lands on `feature/tlm-dashboard` already established in Plan 3 Task 4. All rectrace work (Tasks 6-8) lands on `milestone/modernization` as instructed. No cross-branch contamination.
- **No push** — every commit step is local only per the user's standing rule.

## Out-of-scope (deferred to future plans / polish)

- The `reconmgmt-only` count-style query (used by legacy `getStatsByEntryPoint` for the `recon`/`tlm_instance` entry + 7/30-day window) is not implemented here. The 3 datasets in Task 4 cover the demo path; the count-only variant is a future-plan optimization.
- Composite `visibleWhen` (e.g. AND/OR of multiple KPI conditions) for an explicit "No data" message panel — Plan 4 lets the grids' own `visibleWhen` hide them when their KPI is `0`. The legacy "No data" message panel is a polish follow-up.
- Filter-value-based `visibleWhen` operand — §12.1 spike confirmed legacy doesn't need it; YAGNI.
- Empty-state Markdown panel — deferred to the broader "Empty-state no-results bug + contextual dashboards" sub-project (next in the user's queue after Plan 4).
- Branch-topology rebase of `feature/tlm-instance-seed` onto `feature/volume-seed-data` — finishing-time concern (Plan 3 follow-up).

This unblocks the **rectrace TLM-stats modal user surface end-to-end**: the legacy Angular modal v2 can be deleted (or hidden behind a feature flag) once Plan 4 is verified.
