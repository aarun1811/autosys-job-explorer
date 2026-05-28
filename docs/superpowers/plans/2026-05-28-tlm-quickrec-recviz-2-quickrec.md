# QuickRec Dashboard + React Modal — Implementation Plan (Plan 2 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy Angular QuickRec-stats modal with a React modal that embeds a native RecViz "quickrec-stats" dashboard, filtered by the clicked recon-id / rec-portal-id cell.

**Architecture:** Author a RecViz dashboard (filters + KPI row + two grids) backed by two SQL datasets (`qr_automatch` ← `recportal.quickrec_stats_table`, `qr_manual` ← `recportal.recportal_manual_match_table`), seeded into the `recviz_*` tables with working `filter_mappings` (enabled by Plan 1). On the React side, a config-driven `quickRecStatsButtonRenderer` (gated on `tlm_instance === 'QuickRec'`) opens a `RecvizDashboardModal` (shadcn `Dialog` + the existing `RecvizEmbed`) pointed at `/embed/dashboards/quickrec-stats?filter.recon_id=…&filter.lock=…&hide=title&theme=…`.

**Tech Stack:** RecViz (FastAPI + Oracle, seed-oracle.py), React 19 + Vite + shadcn + AG-Grid + vitest + Playwright.

**Prerequisite:** **Plan 1 (RecViz embed foundation) must be complete** — `filter_mappings`/`database_routing` persistence, `/embed` framing, and the `recportal` connection all depend on it.

**Repos & branches:**
- RecViz work (Tasks 1-3): RecViz repo `/Users/aarun/Workspace/Projects/recviz`, on `feature/quickrec-dashboard` branched off `feature/embed-foundation`.
- React work (Tasks 4-9): this repo `frontend-react/`, on `milestone/modernization`.

**Spec:** §5.2, §6.1, §6.2, §6.4, §6.5, §12.9. Legacy reference: `frontend/rectrace/src/app/.../quickrec-stats-modal/` and `rectrace-tlm-stats/.../quickrec/service/QuickRecStatsService.java`.

**React commands (from `frontend-react/`):** `pnpm test` (vitest), `pnpm typecheck`, `pnpm lint` (gate on **no NEW** errors — baseline is red), `pnpm build`.

---

## File Structure

**RecViz (created/modified):**
- Modify `recviz/scripts/seed-oracle.py` — add `ds-qr-automatch` + `ds-qr-manual` to `CURATED_DATASETS`; add 8 KPIs to `CURATED_KPIS`; add `dash-quickrec-stats` to `CURATED_DASHBOARDS`.

**React (created):**
- `frontend-react/src/search/recviz/buildEmbedUrl.ts` — pure URL builder (origin + dashboard id + `filter.*` + `filter.lock` + `hide` + `theme`). Shared by QuickRec + TLM renderers.
- `frontend-react/src/search/recviz/RecvizDashboardModal.tsx` — shadcn Dialog + `RecvizEmbed`.
- `frontend-react/src/search/renderers/QuickRecStatsCellRenderer.tsx` — the trigger.
- Tests: `buildEmbedUrl.test.ts`, `RecvizDashboardModal.test.tsx`, `QuickRecStatsCellRenderer.test.tsx`, and a Playwright spec `frontend-react/e2e/quickrec-modal.spec.ts` (or the repo's existing e2e location).

**React (modified):**
- `frontend-react/src/search/renderers/registry.ts` — register `quickRecStatsButtonRenderer`.
- `backend/rectrace/src/main/resources/search-config-v4.json` — add the renderer to the `recon_id` / `recon_portal_id` columns; add the RecViz embed origin to config.
- `frontend-react/src/search/recviz/recvizConfig.ts` (or reuse existing config plumbing) — RecViz origin per environment.

---

## Part A — RecViz dashboard (Tasks 1-3)

### Task 1: QuickRec datasets in the seed

**Files:** Modify `recviz/scripts/seed-oracle.py` (`CURATED_DATASETS`).

- [ ] **Step 1: Create the RecViz branch off the foundation branch**

```bash
cd /Users/aarun/Workspace/Projects/recviz
git checkout feature/embed-foundation
git checkout -b feature/quickrec-dashboard
```

- [ ] **Step 2: Add the two datasets to `CURATED_DATASETS`**

Append these two entries to the `CURATED_DATASETS` list in `seed-oracle.py` (mirror the existing entry shape from §4 of the foundation research; `_col(name, display, type, role, agg, fmt)`). They route to the `recportal` connection added in Plan 1 (so set `database_routing` to static on `recportal`):

```python
    {
        "id": "ds-qr-automatch",
        "name": "QuickRec — Auto-Match Stats",
        "description": "QuickRec system match/break stats per recon.",
        "database_routing": {"type": "static", "database": "recportal"},
        "sql_template": (
            "SELECT reconname, recon_id, rec_portal_id, "
            "left_record_count, right_record_count, "
            "left_break_count, right_break_count, "
            "left_match_count, right_match_count, load_date "
            "FROM quickrec_stats_table WHERE 1=1 {{filters}} "
            "ORDER BY load_date DESC, reconname"
        ),
        "columns": [
            _col("reconname", "Recon Name", "string", "dimension"),
            _col("recon_id", "Recon ID", "string", "dimension"),
            _col("rec_portal_id", "Rec Portal ID", "string", "dimension"),
            _col("left_record_count", "Left Records", "number", "measure", "SUM", "number"),
            _col("right_record_count", "Right Records", "number", "measure", "SUM", "number"),
            _col("left_break_count", "Left Breaks", "number", "measure", "SUM", "number"),
            _col("right_break_count", "Right Breaks", "number", "measure", "SUM", "number"),
            _col("left_match_count", "Left Auto Matches", "number", "measure", "SUM", "number"),
            _col("right_match_count", "Right Auto Matches", "number", "measure", "SUM", "number"),
            _col("load_date", "Load Date", "date", "time"),
        ],
        "filter_mappings": [
            {"filter_id": "recon_id", "sql_expr": "recon_id = '{{value}}'"},
            {"filter_id": "rec_portal_id", "sql_expr": "rec_portal_id = '{{value}}'"},
            {"filter_id": "date_range_days", "sql_expr": "load_date {{date_range_clause}}"},
        ],
    },
    {
        "id": "ds-qr-manual",
        "name": "QuickRec — Manual Match Stats",
        "description": "QuickRec manual (human) match counts per portal/COB.",
        "database_routing": {"type": "static", "database": "recportal"},
        "sql_template": (
            "SELECT rec_portal_id, cob, updated_date, "
            "left_manual_matches, right_manual_matches "
            "FROM recportal_manual_match_table WHERE 1=1 {{filters}} "
            "ORDER BY updated_date DESC, rec_portal_id"
        ),
        "columns": [
            _col("rec_portal_id", "Rec Portal ID", "string", "dimension"),
            _col("cob", "COB", "date", "time"),
            _col("updated_date", "Updated", "date", "time"),
            _col("left_manual_matches", "Left Manual Matches", "number", "measure", "SUM", "number"),
            _col("right_manual_matches", "Right Manual Matches", "number", "measure", "SUM", "number"),
        ],
        "filter_mappings": [
            {"filter_id": "rec_portal_id", "sql_expr": "rec_portal_id = '{{value}}'"},
            {"filter_id": "date_range_days", "sql_expr": "updated_date {{date_range_clause}}"},
        ],
    },
```

(`recon_id` is NOT a filter on `qr_manual` — the manual table has no recon_id, matching the legacy. The `CURATED_DATASETS` count assertion at `seed-oracle.py:1746` increases by 2 — update it from 23 to 25.)

- [ ] **Step 3: Bump the dataset-count assertion**

In `seed-oracle.py:1746` change the expected count (e.g. `assert len(CURATED_DATASETS) == 23` → `== 25`).

- [ ] **Step 4: Re-seed and verify the datasets exist + filter narrows SQL**

Run: `cd /Users/aarun/Workspace/Projects/recviz/backend && PYTHONPATH=. python ../scripts/seed-oracle.py`
Expected: completes; `recviz_datasets: 25 rows`.

With the server running (`uvicorn app.main:app --reload --port 8000`):

First pick a real seeded recon_id:
Run: `RID=$(curl -s -X POST "http://localhost:8000/api/data-sources/ds-qr-automatch/query" -H 'Content-Type: application/json' -d '{"filters":{}}' | python -c "import sys,json; d=json.load(sys.stdin); r=d['rows'][0]; print(r.get('recon_id') or r.get('RECON_ID'))")`
Expected: `$RID` is set to a non-empty string.

Then re-query with the filter and assert ALL returned rows match it:
Run: `curl -s -X POST "http://localhost:8000/api/data-sources/ds-qr-automatch/query" -H 'Content-Type: application/json' -d "{\"filters\":{\"recon_id\":\"$RID\"}}" | python -c "import sys,os,json; d=json.load(sys.stdin); rid=os.environ['RID']; rows=d['rows']; print('rows:',len(rows)); assert len(rows)>0, 'no rows returned'; assert all((r.get('recon_id') or r.get('RECON_ID'))==rid for r in rows), 'filter not applied — Plan 1 filter push-down not working'"` (with `RID` exported into the env)
Expected: prints `rows: N` (≥1), no assertion errors. Proves Plan 1's filter push-down works.

- [ ] **Step 5: Commit**

```bash
cd /Users/aarun/Workspace/Projects/recviz
git add scripts/seed-oracle.py
git commit -m "feat(quickrec): add qr_automatch + qr_manual datasets with filter mappings

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

### Task 2: QuickRec KPIs + dashboard config in the seed

**Files:** Modify `recviz/scripts/seed-oracle.py` (`CURATED_KPIS`, `CURATED_DASHBOARDS`).

QuickRec parity (per the legacy explorer): two summary cards (Left/Right), each showing Total Records, Breaks (+%), Auto Matches (+%), Manual Matches (+%), plus an Auto-Match grid and a Manual grid. No chart. → 8 KPIs (6 with `percentage_of`), 2 grids.

- [ ] **Step 1: Add 8 KPIs to `CURATED_KPIS`** with the correct signature.

The real `_kpi(...)` signature at `seed-oracle.py:2346` is **`_kpi(kpi_id, name, description, dataset_id, metric_column, aggregation, *, fmt, trend, thresholds, subtitle="", comment=None)`** — 6 positional + 3 required keyword-only (`fmt`, `trend`, `thresholds`). Add these 8 entries:

```python
    _kpi("kpi-qr-left-records", "Left Records",
         "Total left-side record count across the filtered QuickRec scope.",
         "ds-qr-automatch", "left_record_count", "SUM",
         fmt={"type": "number", "decimals": 0, "abbreviate": True, "currencyCode": None},
         trend=None, thresholds=None, subtitle="Left totals"),
    _kpi("kpi-qr-left-breaks", "Left Breaks",
         "Left-side breaks; percentage of left records.",
         "ds-qr-automatch", "left_break_count", "SUM",
         fmt={"type": "number", "decimals": 0, "abbreviate": True, "currencyCode": None},
         trend=None, thresholds=None, subtitle="Left totals"),
    _kpi("kpi-qr-left-auto", "Left Auto Matches",
         "Left-side system-matched count; percentage of left records.",
         "ds-qr-automatch", "left_match_count", "SUM",
         fmt={"type": "number", "decimals": 0, "abbreviate": True, "currencyCode": None},
         trend=None, thresholds=None, subtitle="Left totals"),
    _kpi("kpi-qr-left-manual", "Left Manual Matches",
         "Left-side manual matches; percentage of left records.",
         "ds-qr-manual", "left_manual_matches", "SUM",
         fmt={"type": "number", "decimals": 0, "abbreviate": True, "currencyCode": None},
         trend=None, thresholds=None, subtitle="Left totals"),
    _kpi("kpi-qr-right-records", "Right Records",
         "Total right-side record count across the filtered QuickRec scope.",
         "ds-qr-automatch", "right_record_count", "SUM",
         fmt={"type": "number", "decimals": 0, "abbreviate": True, "currencyCode": None},
         trend=None, thresholds=None, subtitle="Right totals"),
    _kpi("kpi-qr-right-breaks", "Right Breaks",
         "Right-side breaks; percentage of right records.",
         "ds-qr-automatch", "right_break_count", "SUM",
         fmt={"type": "number", "decimals": 0, "abbreviate": True, "currencyCode": None},
         trend=None, thresholds=None, subtitle="Right totals"),
    _kpi("kpi-qr-right-auto", "Right Auto Matches",
         "Right-side system-matched count; percentage of right records.",
         "ds-qr-automatch", "right_match_count", "SUM",
         fmt={"type": "number", "decimals": 0, "abbreviate": True, "currencyCode": None},
         trend=None, thresholds=None, subtitle="Right totals"),
    _kpi("kpi-qr-right-manual", "Right Manual Matches",
         "Right-side manual matches; percentage of right records.",
         "ds-qr-manual", "right_manual_matches", "SUM",
         fmt={"type": "number", "decimals": 0, "abbreviate": True, "currencyCode": None},
         trend=None, thresholds=None, subtitle="Right totals"),
```

Trend is `None` here on the **library** KPI; we attach `percentage_of` directly on the **dashboard** KPI cards in Step 2, because `_kpi_card(kpi_id)` does not forward trend.

Also bump the `CURATED_KPIS` count assertion (`seed-oracle.py:2620`) from `== 18` to `== 26`.

- [ ] **Step 2: Add `dash-quickrec-stats` to `CURATED_DASHBOARDS`**

Clone the `dash-sla-health` structure (`seed-oracle.py:2877`) — note every entry is wrapped in an outer `{id, name, description, config: {...}}` shape. KPI cards include `trend: {type: "percentage_of", referenceKpi: ...}` inline (NOT via `_kpi_card`, which strips trend). No charts.

```python
    {
        "id": "dash-quickrec-stats",
        "name": "QuickRec Statistics",
        "description": "QuickRec auto-match and manual-match statistics.",
        "config": {
        # NB: every existing CURATED_DASHBOARDS entry duplicates id/name/description
        # inside the config dict (see dash-sla-health, seed-oracle.py:2882-2884).
        "id": "dash-quickrec-stats",
        "name": "QuickRec Statistics",
        "description": "QuickRec auto-match and manual-match statistics.",
        "features": {"crossFilter": False, "drillDown": False},
        "filters": [
            {"id": "recon_id", "label": "Recon ID", "type": "single-select", "lockable": True,
             "optionsSource": None, "options": [], "defaultValue": None},
            {"id": "rec_portal_id", "label": "Rec Portal ID", "type": "single-select", "lockable": True,
             "optionsSource": None, "options": [], "defaultValue": None},
            {"id": "date_range_days", "label": "Date Range", "type": "preset-range", "lockable": False,
             "optionsSource": None,
             "options": [{"label": "Last 1 day", "value": 1}, {"label": "Last 7 days", "value": 7},
                         {"label": "Last 30 days", "value": 30}],
             "defaultValue": 1},
        ],
        # Inline KPI cards (not _kpi_card) so percentage_of trends survive — see §12.9.
        "kpis": [
            {"id": "kpi-qr-left-records", "label": "Left Records", "format": "number",
             "sources": [{"dataSourceId": "ds-qr-automatch", "metric": "left_record_count"}],
             "aggregation": "SUM"},
            {"id": "kpi-qr-left-breaks", "label": "Left Breaks", "format": "number",
             "sources": [{"dataSourceId": "ds-qr-automatch", "metric": "left_break_count"}],
             "aggregation": "SUM",
             "trend": {"type": "percentage_of", "referenceKpi": "kpi-qr-left-records"}},
            {"id": "kpi-qr-left-auto", "label": "Left Auto Matches", "format": "number",
             "sources": [{"dataSourceId": "ds-qr-automatch", "metric": "left_match_count"}],
             "aggregation": "SUM",
             "trend": {"type": "percentage_of", "referenceKpi": "kpi-qr-left-records"}},
            {"id": "kpi-qr-left-manual", "label": "Left Manual Matches", "format": "number",
             "sources": [{"dataSourceId": "ds-qr-manual", "metric": "left_manual_matches"}],
             "aggregation": "SUM",
             "trend": {"type": "percentage_of", "referenceKpi": "kpi-qr-left-records"}},
            {"id": "kpi-qr-right-records", "label": "Right Records", "format": "number",
             "sources": [{"dataSourceId": "ds-qr-automatch", "metric": "right_record_count"}],
             "aggregation": "SUM"},
            {"id": "kpi-qr-right-breaks", "label": "Right Breaks", "format": "number",
             "sources": [{"dataSourceId": "ds-qr-automatch", "metric": "right_break_count"}],
             "aggregation": "SUM",
             "trend": {"type": "percentage_of", "referenceKpi": "kpi-qr-right-records"}},
            {"id": "kpi-qr-right-auto", "label": "Right Auto Matches", "format": "number",
             "sources": [{"dataSourceId": "ds-qr-automatch", "metric": "right_match_count"}],
             "aggregation": "SUM",
             "trend": {"type": "percentage_of", "referenceKpi": "kpi-qr-right-records"}},
            {"id": "kpi-qr-right-manual", "label": "Right Manual Matches", "format": "number",
             "sources": [{"dataSourceId": "ds-qr-manual", "metric": "right_manual_matches"}],
             "aggregation": "SUM",
             "trend": {"type": "percentage_of", "referenceKpi": "kpi-qr-right-records"}},
        ],
        "charts": [],
        "grids": [
            {"id": "grid-qr-automatch", "title": "Auto-Match Statistics",
             "dataSourceId": "ds-qr-automatch",
             "columns": [
                 {"field": "reconname", "header": "Recon Name", "type": "string"},
                 {"field": "recon_id", "header": "Recon ID", "type": "string"},
                 {"field": "rec_portal_id", "header": "Rec Portal ID", "type": "string"},
                 {"field": "left_record_count", "header": "Left Records", "type": "number"},
                 {"field": "right_record_count", "header": "Right Records", "type": "number"},
                 {"field": "left_break_count", "header": "Left Breaks", "type": "number"},
                 {"field": "right_break_count", "header": "Right Breaks", "type": "number"},
                 {"field": "left_match_count", "header": "Left Auto", "type": "number"},
                 {"field": "right_match_count", "header": "Right Auto", "type": "number"},
                 {"field": "load_date", "header": "Load Date", "type": "date"},
             ],
             "layout": {"col": 0, "row": 2, "width": 12, "height": 4}},
            {"id": "grid-qr-manual", "title": "Manual Match Statistics",
             "dataSourceId": "ds-qr-manual",
             "columns": [
                 {"field": "rec_portal_id", "header": "Rec Portal ID", "type": "string"},
                 {"field": "cob", "header": "COB", "type": "date"},
                 {"field": "left_manual_matches", "header": "Left Manual", "type": "number"},
                 {"field": "right_manual_matches", "header": "Right Manual", "type": "number"},
                 {"field": "updated_date", "header": "Updated", "type": "date"},
             ],
             "layout": {"col": 0, "row": 6, "width": 12, "height": 4}},
        ],
        "layout": {"type": "flow", "sections": ["filters", "kpis", "grids"]},
        "autoRefreshInterval": 0,
        }  # end "config"
    },
```

Bump the `CURATED_DASHBOARDS` count assertion at `seed-oracle.py:3486` from `== 10` to `== 11`.

- [ ] **Step 3: Re-seed and verify the dashboard renders end-to-end**

Run: `cd /Users/aarun/Workspace/Projects/recviz/backend && PYTHONPATH=. python ../scripts/seed-oracle.py`
Then with the server up:
Run: `curl -s "http://localhost:8000/api/dashboards/managed/dash-quickrec-stats" | python -c "import sys,json; d=json.load(sys.stdin); c=d['config']; print(len(c['kpis']),'kpis',len(c['grids']),'grids',len(c['filters']),'filters')"`
Expected: `8 kpis 2 grids 3 filters`.

Manual browser check: open `http://localhost:8000/embed/dashboards/dash-quickrec-stats?filter.recon_id=<real id>&filter.lock=recon_id&hide=title` — the dashboard renders KPIs + two grids scoped to that recon, no app chrome.

- [ ] **Step 4: Commit**

```bash
cd /Users/aarun/Workspace/Projects/recviz
git add scripts/seed-oracle.py
git commit -m "feat(quickrec): seed quickrec-stats dashboard (8 KPIs, 2 grids)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

### Task 3: Verify filter-lock + date-range interaction in the embed

- [ ] **Step 1: Manual verification (no code)** — confirm `filter.lock=recon_id` makes the Recon ID filter read-only in the embed and changing the Date Range re-queries both grids. Document the result in the PR description. (This validates Plan 1's `filter.lock` honoring + the date-range mapping before the React side depends on it.)

---

## Part B — React modal + trigger (Tasks 4-9, on `milestone/modernization`)

### Task 4: `buildEmbedUrl` pure helper

**Files:** Create `frontend-react/src/search/recviz/buildEmbedUrl.ts` + `buildEmbedUrl.test.ts`.

- [ ] **Step 1: Write the failing test**

Create `frontend-react/src/search/recviz/buildEmbedUrl.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { buildEmbedUrl } from './buildEmbedUrl'

describe('buildEmbedUrl', () => {
  test('composes origin, dashboard id, locked filters, hide and theme', () => {
    const url = buildEmbedUrl({
      origin: 'http://localhost:5173',
      dashboardId: 'dash-quickrec-stats',
      filters: { recon_id: 'RECON_42', rec_portal_id: 'RP_7' },
      lock: ['recon_id', 'rec_portal_id'],
      theme: 'dark',
    })
    const u = new URL(url)
    expect(u.origin + u.pathname).toBe('http://localhost:5173/embed/dashboards/dash-quickrec-stats')
    expect(u.searchParams.get('filter.recon_id')).toBe('RECON_42')
    expect(u.searchParams.get('filter.rec_portal_id')).toBe('RP_7')
    expect(u.searchParams.get('filter.lock')).toBe('recon_id,rec_portal_id')
    expect(u.searchParams.get('hide')).toBe('title')
    expect(u.searchParams.get('theme')).toBe('dark')
  })

  test('omits empty filters and lock', () => {
    const url = buildEmbedUrl({
      origin: 'http://localhost:5173', dashboardId: 'd',
      filters: { recon_id: '', rec_portal_id: undefined }, lock: [], theme: 'light',
    })
    const u = new URL(url)
    expect(u.searchParams.has('filter.recon_id')).toBe(false)
    expect(u.searchParams.has('filter.lock')).toBe(false)
  })
})
```

- [ ] **Step 2: Run → fail**

Run: `cd /Users/aarun/Workspace/Projects/autosys-job-explorer/frontend-react && pnpm test buildEmbedUrl`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `frontend-react/src/search/recviz/buildEmbedUrl.ts`:

```ts
export interface BuildEmbedUrlArgs {
  origin: string
  dashboardId: string
  filters: Record<string, string | undefined>
  lock: string[]
  theme: 'light' | 'dark'
}

/** Compose a RecViz embed URL: {origin}/embed/dashboards/{id}?filter.*&filter.lock&hide=title&theme. */
export function buildEmbedUrl({ origin, dashboardId, filters, lock, theme }: BuildEmbedUrlArgs): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value != null && value !== '') params.set(`filter.${key}`, value)
  }
  const presentLocks = lock.filter((k) => filters[k] != null && filters[k] !== '')
  if (presentLocks.length > 0) params.set('filter.lock', presentLocks.join(','))
  params.set('hide', 'title')
  params.set('theme', theme)
  return `${origin}/embed/dashboards/${dashboardId}?${params.toString()}`
}
```

- [ ] **Step 4: Run → pass**

Run: `cd /Users/aarun/Workspace/Projects/autosys-job-explorer/frontend-react && pnpm test buildEmbedUrl`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer
git add frontend-react/src/search/recviz/buildEmbedUrl.ts frontend-react/src/search/recviz/buildEmbedUrl.test.ts
git commit -m "feat(recviz): buildEmbedUrl helper for embedded dashboard modals

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

### Task 5: `RecvizDashboardModal` component

**Files:** Create `frontend-react/src/search/recviz/RecvizDashboardModal.tsx` + `RecvizDashboardModal.test.tsx`.

- [ ] **Step 1: Write the failing test**

Create `frontend-react/src/search/recviz/RecvizDashboardModal.test.tsx`:

```tsx
import { describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/search/RecvizEmbed', () => ({
  RecvizEmbed: ({ url }: { url: string }) => <div data-testid="embed" data-url={url} />,
}))

import { RecvizDashboardModal } from './RecvizDashboardModal'

describe('RecvizDashboardModal', () => {
  test('renders the embed with the given url + title when open', () => {
    render(
      <RecvizDashboardModal open onOpenChange={() => {}} title="QuickRec Statistics" url="http://x/embed/dashboards/d?theme=dark" />,
    )
    expect(screen.getByText('QuickRec Statistics')).toBeInTheDocument()
    expect(screen.getByTestId('embed')).toHaveAttribute('data-url', 'http://x/embed/dashboards/d?theme=dark')
  })

  test('renders nothing visible when closed', () => {
    render(<RecvizDashboardModal open={false} onOpenChange={() => {}} title="QuickRec" url="http://x/d" />)
    expect(screen.queryByTestId('embed')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run → fail**

Run: `cd /Users/aarun/Workspace/Projects/autosys-job-explorer/frontend-react && pnpm test RecvizDashboardModal`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** (mirror `ExecutionOrderModal` sizing; `RecvizEmbed` takes `url` + `q` — pass `q=""` since the URL is already fully composed)

Create `frontend-react/src/search/recviz/RecvizDashboardModal.tsx`:

```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { RecvizEmbed } from '@/search/RecvizEmbed'

export interface RecvizDashboardModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  url: string
}

export function RecvizDashboardModal({ open, onOpenChange, title, url }: RecvizDashboardModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] w-[min(95vw,1100px)] max-w-[min(95vw,1100px)] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">Embedded RecViz dashboard</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1">
          <RecvizEmbed url={url} q="" title={title} minHeight={400} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: Run → pass**

Run: `cd /Users/aarun/Workspace/Projects/autosys-job-explorer/frontend-react && pnpm test RecvizDashboardModal`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer
git add frontend-react/src/search/recviz/RecvizDashboardModal.tsx frontend-react/src/search/recviz/RecvizDashboardModal.test.tsx
git commit -m "feat(recviz): RecvizDashboardModal (Dialog + RecvizEmbed shell)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

### Task 6: `QuickRecStatsCellRenderer`

**Files:** Create `frontend-react/src/search/renderers/QuickRecStatsCellRenderer.tsx` + `QuickRecStatsCellRenderer.test.tsx`.

Behavior (mirror `ExecutionOrderCellRenderer` + spec §6.4): render a "View" button ONLY when `params.data.tlm_instance === 'QuickRec'` and the cell value is non-empty. The renderer is used on both `recon_id` and `recon_portal_id` columns; `cellRendererParams.entryPoint` (`'recon_id'` | `'rec_portal_id'`) decides which filter is locked. On click, build the embed URL and open the modal.

- [ ] **Step 1: Write the failing test**

Create `frontend-react/src/search/renderers/QuickRecStatsCellRenderer.test.tsx`:

```tsx
import type { ComponentProps } from 'react'
import { describe, expect, test, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ICellRendererParams } from 'ag-grid-community'

vi.mock('@/components/layout/theme-provider', () => ({ useTheme: () => ({ resolvedTheme: 'dark' }) }))
let lastModalProps: Record<string, unknown> = {}
vi.mock('@/search/recviz/RecvizDashboardModal', () => ({
  RecvizDashboardModal: (p: Record<string, unknown>) => { lastModalProps = p; return p.open ? <div data-testid="modal" /> : null },
}))
vi.mock('@/search/recviz/recvizConfig', () => ({ getRecvizOrigin: () => 'http://localhost:5173' }))

import { QuickRecStatsCellRenderer } from './QuickRecStatsCellRenderer'

function renderCell(data: Record<string, unknown>, entryPoint: 'recon_id' | 'rec_portal_id', value: string) {
  const params = {
    value, data,
    colDef: { cellRendererParams: { entryPoint } },
  } as unknown as ICellRendererParams
  return render(<QuickRecStatsCellRenderer {...(params as ComponentProps<typeof QuickRecStatsCellRenderer>)} />)
}

describe('QuickRecStatsCellRenderer', () => {
  test('renders nothing when tlm_instance is not QuickRec', () => {
    renderCell({ tlm_instance: 'TLMP_CONSUMER', recon_id: 'R1', recon_portal_id: 'P1' }, 'recon_id', 'R1')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  test('renders View and opens modal with recon_id locked on click', () => {
    renderCell({ tlm_instance: 'QuickRec', recon_id: 'R1', recon_portal_id: 'P1' }, 'recon_id', 'R1')
    fireEvent.click(screen.getByRole('button', { name: /view/i }))
    expect(screen.getByTestId('modal')).toBeInTheDocument()
    const u = new URL(lastModalProps.url as string)
    expect(u.pathname).toBe('/embed/dashboards/dash-quickrec-stats')
    expect(u.searchParams.get('filter.recon_id')).toBe('R1')
    expect(u.searchParams.get('filter.rec_portal_id')).toBe('P1')
    expect(u.searchParams.get('filter.lock')).toBe('recon_id')
    expect(u.searchParams.get('theme')).toBe('dark')
  })
})
```

- [ ] **Step 2: Run → fail**

Run: `cd /Users/aarun/Workspace/Projects/autosys-job-explorer/frontend-react && pnpm test QuickRecStatsCellRenderer`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the renderer (and the tiny `recvizConfig` helper)**

Declare the env var in `frontend-react/src/vite-env.d.ts` (append a property to the existing `ImportMetaEnv` interface):

```ts
readonly VITE_RECVIZ_ORIGIN?: string
```

Create `frontend-react/src/search/recviz/recvizConfig.ts`:

```ts
/** RecViz embed origin. Dev default; per-env via VITE_RECVIZ_ORIGIN. NOTE: spec §6.5
 * prefers a server-driven origin (added to backend search config like `dashboard.url`).
 * This env-var path is a pragmatic interim — switch to server-driven in a follow-up
 * once the backend SearchConfigV4 carries a `recvizOrigin` field. */
export function getRecvizOrigin(): string {
  return import.meta.env.VITE_RECVIZ_ORIGIN ?? 'http://localhost:5173'
}
```

Create `frontend-react/src/search/renderers/QuickRecStatsCellRenderer.tsx`:

```tsx
import { useState } from 'react'
import type { ICellRendererParams } from 'ag-grid-community'
import { BarChart3Icon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useTheme } from '@/components/layout/theme-provider'
import { buildEmbedUrl } from '@/search/recviz/buildEmbedUrl'
import { getRecvizOrigin } from '@/search/recviz/recvizConfig'
import { RecvizDashboardModal } from '@/search/recviz/RecvizDashboardModal'

const DASHBOARD_ID = 'dash-quickrec-stats'

/** Opens the QuickRec RecViz dashboard for a row. Only rendered for QuickRec rows
 * (tlm_instance === 'QuickRec'); entryPoint (recon_id | rec_portal_id) locks that filter. */
export function QuickRecStatsCellRenderer(params: ICellRendererParams) {
  const colDef = params.colDef as { cellRendererParams?: { entryPoint?: 'recon_id' | 'rec_portal_id' } } | undefined
  const entryPoint = colDef?.cellRendererParams?.entryPoint ?? 'recon_id'
  const data = params.data as Record<string, unknown> | undefined
  const { resolvedTheme } = useTheme()
  const [open, setOpen] = useState(false)

  const value = typeof params.value === 'string' ? params.value : undefined
  if (data?.tlm_instance !== 'QuickRec' || !value || value.trim().length === 0) return null

  // Row field is `recon_portal_id` (per rectrace_core schema); RecViz filter id is
  // `rec_portal_id` (per the qr_automatch/qr_manual filter_mappings). Translate at the boundary.
  const reconId = typeof data.recon_id === 'string' ? data.recon_id : undefined
  const recPortalId = typeof data.recon_portal_id === 'string' ? data.recon_portal_id : undefined

  const url = buildEmbedUrl({
    origin: getRecvizOrigin(),
    dashboardId: DASHBOARD_ID,
    filters: { recon_id: reconId, rec_portal_id: recPortalId },
    lock: [entryPoint],
    theme: resolvedTheme,
  })

  return (
    <>
      <Button
        size="sm" variant="ghost" onClick={() => setOpen(true)}
        aria-label="View QuickRec stats"
        className="h-6 min-w-[80px] px-2 text-primary text-[12px] font-normal hover:bg-accent"
      >
        <span className="inline-flex items-center gap-1">
          <BarChart3Icon className="size-3.5 opacity-70" />
          View
        </span>
      </Button>
      <RecvizDashboardModal open={open} onOpenChange={setOpen} title="QuickRec Statistics" url={url} />
    </>
  )
}
```

- [ ] **Step 4: Run → pass**

Run: `cd /Users/aarun/Workspace/Projects/autosys-job-explorer/frontend-react && pnpm test QuickRecStatsCellRenderer`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer
git add frontend-react/src/search/renderers/QuickRecStatsCellRenderer.tsx frontend-react/src/search/recviz/recvizConfig.ts frontend-react/src/search/renderers/QuickRecStatsCellRenderer.test.tsx
git commit -m "feat(quickrec): QuickRecStatsCellRenderer opens embedded dashboard modal

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

### Task 7: Register the renderer

**Files:** Modify `frontend-react/src/search/renderers/registry.ts`.

- [ ] **Step 1: Add the import + map entry**

Add `import { QuickRecStatsCellRenderer } from './QuickRecStatsCellRenderer'` and add to the `cellRenderers` object:

```ts
  quickRecStatsButtonRenderer: QuickRecStatsCellRenderer,
```

- [ ] **Step 2: Typecheck**

Run: `cd /Users/aarun/Workspace/Projects/autosys-job-explorer/frontend-react && pnpm typecheck`
Expected: passes (no new errors).

- [ ] **Step 3: Commit**

```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer
git add frontend-react/src/search/renderers/registry.ts
git commit -m "feat(quickrec): register quickRecStatsButtonRenderer

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

### Task 8: Wire the renderer into `search-config-v4.json`

**Files:** Modify `backend/rectrace/src/main/resources/search-config-v4.json`.

**Pattern change (re-review correction):** unhiding a `rowGroup: true` column does NOT render a visible leaf cell — AG-Grid's `autoGroupColumnDef` owns leaf rendering for grouped columns (`frontend-react/src/search/SearchGrid.tsx:150-154`). The proven precedent is `executionOrderButtonRenderer`: a **frontend-only sentinel column** (not in the SSRM SELECT) that hosts the trigger button. Apply that pattern here.

- [ ] **Step 1: Whitelist `quickrec_stats_button` as a frontend-only column.** Add it to two `FRONTEND_ONLY_COLUMNS` sets so the SSRM pipeline knows it's not an Oracle column:

  - `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v4/OracleServiceV4.java:21-24` — extend the set to include `"quickrec_stats_button"`.
  - `frontend-react/src/search/lib/ssrm.ts:6` — extend the same-name set in the frontend.

  (Existing precedent in both files for `execution_order`.)

- [ ] **Step 2: Update `reconId` category** (~line 312-330 in `search-config-v4.json`):

  Keep the existing `recon_id` row-group column as it is (`rowGroup: true, hide: true`); leaf rendering goes through `autoGroupColumnDef`. **Add visible** `tlm_instance` and `recon_portal_id` columns so the row data carries them for the renderer. **Add the sentinel column** with the renderer (pinned right, no SSRM projection):

  ```json
  {"field": "tlm_instance", "headerName": "TLM Instance", "sortable": true, "filter": true},
  {"field": "recon_portal_id", "headerName": "Rec Portal ID", "sortable": true, "filter": true},
  {"field": "quickrec_stats_button", "headerName": "QuickRec Stats", "width": 110,
   "cellRenderer": "quickRecStatsButtonRenderer",
   "cellRendererParams": {"entryPoint": "recon_id"},
   "cellStyle": {"display": "flex", "align-items": "center", "justify-content": "center"},
   "sortable": false, "filter": false, "resizable": false, "pinned": "right"},
  ```

- [ ] **Step 3: Update `reconPortalId` category** (~line 333-352) symmetrically:

  ```json
  {"field": "tlm_instance", "headerName": "TLM Instance", "sortable": true, "filter": true},
  {"field": "recon_id", "headerName": "Recon ID", "sortable": true, "filter": true},
  {"field": "quickrec_stats_button", "headerName": "QuickRec Stats", "width": 110,
   "cellRenderer": "quickRecStatsButtonRenderer",
   "cellRendererParams": {"entryPoint": "rec_portal_id"},
   "cellStyle": {"display": "flex", "align-items": "center", "justify-content": "center"},
   "sortable": false, "filter": false, "resizable": false, "pinned": "right"},
  ```

  (`tlm_instance` and the cross-id columns are visible — so `OracleServiceV4.buildSelectClause` projects them into the SSRM rows and the renderer's `params.data.tlm_instance` is populated. The sentinel column is in `FRONTEND_ONLY_COLUMNS`, so the backend SELECT skips it. Mirrors the `execution_order` precedent.)

- [ ] **Step 4: Verify the backend still boots and serves config**

Run: `cd /Users/aarun/Workspace/Projects/autosys-job-explorer/backend/rectrace && mvn -q -DskipTests spring-boot:run -Dspring-boot.run.profiles=local` (in a separate shell; or rely on the e2e in Task 9). Confirm `/api/v4/search/initial` returns the `recon_id` column carrying `cellRenderer: "quickRecStatsButtonRenderer"`.

(Per project memory, the renderer key falls back to AG-Grid default text if the React map lacks it — so this JSON change is safe even before the React build ships.)

- [ ] **Step 5: Commit**

```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer
git add backend/rectrace/src/main/resources/search-config-v4.json backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v4/OracleServiceV4.java frontend-react/src/search/lib/ssrm.ts
git commit -m "feat(quickrec): wire quickRecStatsButtonRenderer via frontend-only sentinel column

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

### Task 9: Playwright e2e (full pipeline)

**Files:** Create an e2e spec in the repo's existing Playwright location (check `frontend-react/playwright.config.*` / `e2e/`).

- [ ] **Step 1: Write the e2e** — search for a QuickRec recon, click the recon-id "View" button, assert the modal opens and the iframe `src` points at `/embed/dashboards/dash-quickrec-stats` with `filter.recon_id` set. (Requires RecViz running on :5173 with Plan 1 + Tasks 1-3 seeded, and the rectrace stack up.)

```ts
import { test, expect } from '@playwright/test'

test('QuickRec cell opens embedded RecViz dashboard scoped to the recon', async ({ page }) => {
  await page.goto('/search?q=<a real QuickRec recon term>&tab=reconId')
  // expand the grouped row if needed, then click the recon-id View button
  await page.getByRole('button', { name: /view quickrec stats/i }).first().click()
  const frame = page.locator('iframe[title="QuickRec Statistics"]')
  await expect(frame).toBeVisible()
  const src = await frame.getAttribute('src')
  expect(src).toContain('/embed/dashboards/dash-quickrec-stats')
  expect(src).toContain('filter.recon_id=')
})
```

- [ ] **Step 2: Run the e2e**

Run the repo's e2e command (e.g. `cd /Users/aarun/Workspace/Projects/autosys-job-explorer/frontend-react && pnpm exec playwright test quickrec-modal`).
Expected: PASS with all services running.

- [ ] **Step 3: Final gates**

Run: `cd /Users/aarun/Workspace/Projects/autosys-job-explorer/frontend-react && pnpm typecheck && pnpm test && pnpm lint`
Expected: typecheck clean, all unit tests pass, no NEW lint errors vs baseline.

- [ ] **Step 4: Commit**

```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer
git add frontend-react/e2e/quickrec-modal.spec.ts
git commit -m "test(quickrec): e2e — cell opens embedded RecViz dashboard scoped to recon

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Done criteria for Plan 2

- RecViz `dash-quickrec-stats` renders KPIs + two grids, scoped by `?filter.recon_id`/`rec_portal_id` (server-side narrowed via Plan 1).
- Clicking a `recon_id`/`recon_portal_id` cell on a `QuickRec` row opens `RecvizDashboardModal` with the correct locked filter and theme.
- `pnpm typecheck && pnpm test` green; no new lint errors; e2e passes with services up.
- RecViz commits on `feature/quickrec-dashboard`; React/backend-config commits on `milestone/modernization`.

## Self-review notes
- **Spec coverage:** §5.2 datasets (Task 1), KPIs/dashboard (Task 2), §12.9 six percentages (Task 2's 8 KPIs), §6.1 modal (Task 5), §6.2/§6.4 renderer + lock (Task 6), §6.5 origin config (Task 6 `recvizConfig`), config wiring (Task 8).
- **Verify-at-execution flags (not placeholders):** the `_kpi`, `_kpi_card`, `_dash_chart_ref` helper signatures and the `CURATED_*` count assertions must be confirmed against `seed-oracle.py` at execution (their exact arg lists weren't all captured) — each step says so explicitly; the data values are fully specified. Real seeded `recon_id`/QuickRec search terms are environment data to look up at run time.
- **Type consistency:** `buildEmbedUrl` args/`filter.*` keys match the renderer's call and the dataset `filter_mappings` (`recon_id`, `rec_portal_id`, `date_range_days`); `RecvizDashboardModal` props match the renderer's usage; `RecvizEmbed` is called with `url` + `q=""`.
