# TLM-stats & QuickRec-stats Modals as Embedded RecViz Dashboards — Design

**Date:** 2026-05-28
**Status:** Design — reviewed (feature-dev:code-reviewer, 2026-05-28, claims verified against code); corrections folded in. Awaiting user review before writing-plans
**Milestone:** `milestone/modernization`, Phase 4 (RecViz integration) — first concrete embed use-case

---

## 1. Goal

Replace the two legacy Angular modals — **TLM-stats** (`tlm-stats-modal-v2`) and **QuickRec-stats** (`quickrec-stats-modal`) — with React modals that embed **native RecViz dashboards** via iframe. The entire modal body is a RecViz dashboard; the React side is a thin trigger + Dialog shell.

Security/auth is **explicitly out of scope** (see §11). The coupled empty-state no-results bug and the broader "contextual dashboards inline in search results" feature are **deferred to a separate spec** (see §11).

## 2. Context & ground truth

Confirmed by reading the live code in three repos:

- **RecViz** (`/Users/aarun/Workspace/Projects/recviz`) is a data-driven BI tool: React 19 + Vite + TanStack + AG-Grid/AG-Charts frontend (`:5173`), FastAPI + SQLAlchemy + `oracledb` backend (`:8000`), Oracle 19c. A dashboard is a row in `recviz_dashboards` with a JSON `config`; panels resolve through `POST /api/data-sources/{id}/query`. **It ships no TLM or QuickRec dashboard** — those must be authored.
- **`rectrace-tlm-stats`** (`:8080`) backs both legacy modals. TLM uses a lazy per-instance dynamic-datasource factory keyed on a `tlm_instance` string (`tlm-instances.json` + `TlmJdbcTemplateFactory`); QuickRec uses two static datasources (`reconmgmt`, `recportal`).
- **`frontend-react/`** already has the embed plumbing: `RecvizEmbed.tsx` (origin-validated postMessage, theme bridge, sandbox, height handshake), `DashboardPanel`, `ResultSurface`, a config-driven cell-renderer registry, and the `ExecutionOrderCellRenderer` button→Dialog pattern to clone.
- **Local Oracle is shared**: RecViz (`recviz:recviz_dev@localhost:1521/FREEPDB1`) and our stack (`reconmgmt`/`recportal` schemas in the same `FREEPDB1`) are the **same instance**. The sibling `rectrace-local-dev` seed already populates `recon_bank`, `mr_csum_man_match_stats_hist/_details/_netting_hist` (reconmgmt) and `quickrec_stats_table`, `recportal_manual_match_table` (recportal).

## 3. Decisions (locked during brainstorming)

| # | Decision | Rationale |
|---|---|---|
| D1 | **Embed RecViz**; author the two dashboards | Matches Phase 4; reuses existing React embed plumbing |
| D2 | TLM data via **RecViz SQL datasets + dynamic routing + native MergeEngine** | RecViz already supports filter-driven DB selection (`database_routing: dynamic`) and cross-DB blend (`MergeEngine`). No DB link, no REST data-source type. Query SQL is reproduced as datasets; the cross-DB merge is done by RecViz's MergeEngine — **but** MergeEngine does *not* zero-default missing measures the way the legacy Java does, so a small RecViz fix is required for fidelity (see §12.6) |
| D3 | **Seed a local TLM instance into FREEPDB1** | Makes the full TLM dashboard incl. the cross-DB merge path demoable/testable locally |
| D4 | QuickRec data via **RecViz SQL datasets** (no routing, no merge) | Two independent static tables; clean fit; data already seeded |
| D5 | Modal body is **pure RecViz** (thin Dialog shell only) | Max reuse, min React, visual consistency. Filter state stays inside the iframe |
| D6 | Touch RecViz where needed: **framing header + theme listener** | User approved RecViz changes when necessary |
| D7 | **Defer** empty-state bug + contextual-search-dashboards to a separate spec | It's a feature, not a bug; independent of the modal path |

## 4. Architecture

```
React grid cell click (TlmStats / QuickRecStats cell renderer)
  → shadcn <Dialog>  +  <RecvizEmbed>          (both already exist)
       → iframe:  {recvizOrigin}/embed/dashboards/{id}
                    ?filter.<k>=<v>&filter.lock=<k,...>&hide=title&theme=<light|dark>
            → RecViz dashboard:  filter bar + KPI row + donut + grid panel(s)
                 → POST /api/data-sources/{id}/query     (per panel; dynamic-routed for TLM automatch)
                 → POST /api/data-sources/merge          (TLM recon table; cross-DB blend on 6 keys)
                      → Oracle FREEPDB1: reconmgmt, recportal, + new local TLM-instance schema
```

Three work surfaces: **A. RecViz** (author + 2 code changes), **B. React** (modal + renderers + config), **C. local seed**.

## 5. Surface A — RecViz

### 5.1 Two new dashboards
Rows in `recviz_dashboards`, addressed at `/embed/dashboards/tlm-stats` and `/embed/dashboards/quickrec-stats`. Each config declares: filter bar, KPI row (Total / Breaks / Automatch / Manual), a donut chart, and the data grid(s). RecViz renders all of it.

### 5.2 QuickRec datasets (static)
- `qr_automatch` → `quickrec_stats_table` (columns: `reconname, recon_id, rec_portal_id, left/right_record_count, left/right_break_count, left/right_match_count, load_date`). Date filter on `load_date`. Filterable by `recon_id` and `rec_portal_id`.
- `qr_manual` → `recportal_manual_match_table` (columns: `rec_portal_id, COB, UPDATED_DATE, LEFT/RIGHT_MANUAL_MATCHES`). Date filter on `UPDATED_DATE`. Filterable by `rec_portal_id` only.
- Two grid panels (Auto-Match Statistics, Manual Match Statistics) + KPI sources + donut. Percentages computed by RecViz (KPI sources) — mirror `QuickRecDashboardSummary.calculatePercentages()`. **Note:** the legacy summary shows **six** percentages (left/right × break/automatch/manual, each relative to left/right *records*), not four. RecViz `percentage_of` is one-reference-per-KPI, so this needs ≥8 paired KPIs or pre-aggregated percentage columns in the dataset (see §12.9).

### 5.3 TLM datasets
- `tlm_recon_reconmgmt` → **static** reconmgmt. Mirrors `buildReconmgmtOnlyQuery` (`mr_csum_man_match_stats_hist`). Returns the 6 key columns + `total_items, automatch_items, manual_match_count`. Covers `recon` & `tlm_instance` entry points and `set_id` at 7/30 days.
- `tlm_automatch` → **dynamic** routing, `route_by_filter: tlm_instance`, `mapping: {<friendly instance> → <connId>}`. Mirrors `buildAutomatchQuery` (`bank + message_feed + item + tlm_bdr_relationship_header`). Returns 6 keys + `total_items, automatch_items`.
- `tlm_manual` → **static** reconmgmt. Mirrors `buildManualMatchQuery` (`mr_csum_man_match_details` UNION ALL `mr_csum_netting_hist`). Returns 6 keys + `manual_match_count`.
- `tlm_breaks` → breaks grid (per-instance for `set_id` entry: `bank + message_feed + item`). **Note:** for `recon`/`tlm_instance` entries the legacy fetches all breaks then filters by date **in Java** (`getBreaksWithoutDateFilter` + `filterBreaksByDate`); RecViz has no Java-side path, so this must be re-expressed as pure SQL with the date clause inline (see §12.8).
- Recon-table grid panel for the `set_id` + 1-day path: `sources: [tlm_automatch, tlm_manual]`, `mergeOn: [tlm_instance, agent_code, setid, stmt_date, bran_code, corr_acc_no]`, `mergeType: outer_join`.

Merge keys, semantics, and the friendly-name↔DB_NAME map (`TLM_INSTANCE_MAP`, e.g. `TLMP_CONSUMER ↔ TCOSPRD`) are taken verbatim from `TlmStatsV2Service.java`.

### 5.4 Filters (declared per dashboard)
- **TLM:** `tlm_instance` (single, lockable), `recon`/`agent_code` (multi, lockable), `set_id` (multi, lockable), `date_range` (preset 1/7/30, default 1). Dynamic options for recon/set_id from `recon_bank` (cascade set_id ← recon).
- **QuickRec:** `recon_id` (single/text), `rec_portal_id` (single/text), `date_range` (preset 1/7/30, default 1).

### 5.5 RecViz code change 1 — framing (REQUIRED)
`backend/app/main.py` currently sets `X-Frame-Options: SAMEORIGIN` on every response (`XFrameOptionsMiddleware`, ~line 229), which blocks cross-origin iframing — a hard blocker. Replace it (at least on the `/embed/*` route) with a per-environment `Content-Security-Policy: frame-ancestors 'self' <rectrace-origin>` allow-list. Dev origin: `http://localhost:5173`.

### 5.6 RecViz code change 2 — live theme (OPTIONAL-NICE)
RecViz embed honors `?theme=` only at mount. `RecvizEmbed` already posts `{type: 'RECTRACE_THEME', theme}` on toggle. Add a small `postMessage` listener on the embed route that validates origin and applies the theme, so toggling theme while the modal is open updates the iframe without reload. Without it, fall back to `?theme=` on open (theme set at open time only).

### 5.7 Coloring fidelity (OPEN — see §12)
Legacy donut uses fixed category colors (Breaks≈amber, Automatch≈green, Manual≈violet). RecViz themes via oklch tokens and exposes `--chart-positive/negative/warning` + `--series-1..8`. Confirm RecViz's chart config can pin a series color per category; if not, add that capability to RecViz chart config. No raw hex anywhere (oklch / token / `color-mix`).

## 6. Surface B — React (`frontend-react/`)

### 6.1 `RecvizDashboardModal`
New component: shadcn `Dialog` (~`h-[85vh] w-[min(95vw,1100px)]`, mirroring `ExecutionOrderModal`) wrapping the existing `RecvizEmbed`. Controlled via `open`/`onOpenChange`. Set `?hide=title` — this hides the topbar *title text* only; the 36px topbar (with the "Open in RecViz" pop-out link) still renders. Do **not** set `hide=filter-bar` (we need the date-range filter inside the modal). Fixed-height iframe (RecViz emits no height events in a modal — that's fine).

### 6.2 Two cell renderers (clone `ExecutionOrderCellRenderer`)
- `tlmStatsButtonRenderer` — on `tlm_instance` / `set_id` / `recon` cells. Reads `params.data` for context. **Excludes** rows where `tlm_instance === 'QuickRec'`.
- `quickRecStatsButtonRenderer` — on `recon_id` / `recon_portal_id` cells. **Gated on** `tlm_instance === 'QuickRec'`.

Registered in `frontend-react/src/search/renderers/registry.ts`; wired via `search-config-v4.json` (`cellRenderer` key + `cellRendererParams`). Config-driven — no hardcoded category/column logic.

### 6.3 Entry-point → embed URL (TLM)
The clicked cell determines initial + locked filters (mirrors `tlm-stats-modal-v2.component.ts` `initializeFilterState`):

| Entry (clicked cell) | `entry_point` | URL params |
|---|---|---|
| TLM Instance | `tlm_instance` | `filter.tlm_instance=<v>` · `filter.lock=tlm_instance` |
| Recon | `recon` | `filter.tlm_instance=<inst>&filter.recon=<v>` · `filter.lock=tlm_instance,recon` |
| Set ID | `set_id` | `filter.tlm_instance=<inst>&filter.recon=<recon>&filter.set_id=<v>` · `filter.lock=tlm_instance,recon,set_id` |

`date_range` always editable; default `1`. Instance/recon for non-instance entries come from the clicked row's other fields.

### 6.4 Entry-point → embed URL (QuickRec)
Mirrors `quickrec-stats-modal.component.ts`: `recon_id` entry locks `rec_portal_id` (from the row) and keeps `recon_id` editable; `rec_portal_id` entry locks `recon_id`. `date_range` editable, default `1`. (Verified against `quickrec-filters.component.html:28,38` — the editable ID field matches the entry point exactly.)

### 6.5 RecViz origin config
The embed base origin per environment is added to **backend search config** (server-driven, like the existing `dashboard.url`), not a Vite env var. `RecvizEmbed`/the renderer compose `{origin}/embed/dashboards/{id}?...`. Dev: `http://localhost:5173`.

## 7. Surface C — Local seed (`rectrace-local-dev`)

Add the per-instance TLM tables — `bank`, `message_feed`, `item`, `tlm_bdr_relationship_header` — into a **new schema** in FREEPDB1, with seed data coherent with the existing `reconmgmt`/`recportal` rows (so the merge keys line up). Register a **RecViz connection** for one demo instance (e.g. `TLMP_CONSUMER` → that schema) so `tlm_automatch` dynamic routing resolves locally. Follow the existing `apply.py` / `volume.py` idempotent-driver pattern; keep `init/` DDL ordering. reconmgmt/recportal data already exists. The seed must also create a **`recviz_connections` row** whose id equals the `tlm_automatch` dynamic-routing mapping value (e.g. `TCOSPRD`) — RecViz pre-warms and health-checks connections at startup (`recviz/backend/app/main.py:110-189`) — and the friendly↔DB_NAME translation (`TLM_INSTANCE_MAP`) must be baked into the dataset SQL so displayed instance names are the friendly form.

## 8. Data contracts (reference)

- TLM merge key (6-part, verbatim from `getMergeKey`): `(tlm_instance, agent_code, setid, stmt_date, bran_code, corr_acc_no)`; `outer_join`; automatch side → `total_items, automatch_items`; manual side → `manual_match_count`; missing side → 0.
- Legacy source-of-truth routing (`shouldUseReconmgmtOnlyQuery`): `recon`/`tlm_instance` entry → reconmgmt-only (any date); `set_id` entry → reconmgmt-only at 7/30, **merge** at 1.
- Date logic: range 1 = Oracle business-day `DECODE(TO_CHAR(SYSDATE,'D')…)`; 7/30 = `SYSDATE - N`. **Caution (corrected):** RecViz `_build_date_range_clause` (`query_engine.py:94-106`) is **not** identical to the legacy TLM clause — it ends at `AND SYSDATE` whereas legacy TLM ends at `AND SYSDATE - 1` (`TlmStatsV2Service.java:628,631`), and its range-1 `DECODE` mapping differs. It happens to match QuickRec's clause (`…AND SYSDATE`) but not TLM's. Must be parameterized/reconciled per dashboard, not reused as-is (see §12.7).

## 9. Error handling

- **Framing refusal** (if §5.5 not deployed): `RecvizEmbed` notes cross-origin refusal does not fire `onError`; rely on a handshake/load timeout to show a fallback ("Couldn't load dashboard — open in RecViz" with the pop-out link). Add a timeout-based failure state to the modal.
- **Empty data**: RecViz renders its own empty states; the donut/grids show "no data" — acceptable parity with the legacy "No data" panel.
- **Bad/unknown `tlm_instance`**: RecViz dynamic routing raises 400 if the mapping is missing; surface as the modal fallback state.

## 10. Testing strategy

- **React unit (vitest):** renderer gating (`tlm_instance === 'QuickRec'` include/exclude), entry-point→URL composition (each row of §6.3/§6.4), modal open/close + reset, fallback-on-timeout. Assert renderers read stable `params.data` business fields (no row-index dependence). Gate on "no NEW lint errors" (baseline is red).
- **RecViz MergeEngine fidelity (§12.6):** unit-test that an automatch-only key yields `manual_match_count = 0` (not undefined) and a manual-only key yields `total_items/automatch_items = 0`, after the zero-defaulting fix — i.e. parity with the legacy Java merge output.
- **RecViz:** dataset SQL + dynamic-routing resolution + merge output shape (Python tests alongside `merge_engine`/`query_engine`). Dashboard config validates against `DashboardConfig`.
- **Local e2e (Playwright):** seed up → search → click TLM-instance/recon/set-id and recon-id/portal-id cells → modal opens → RecViz dashboard renders KPIs/donut/grid with the locked filters → toggle date range → data updates. Verify the `set_id`+1-day merge path renders against the seeded local instance.
- **Manual:** light/dark theme handoff; "Open in RecViz" pop-out.

## 11. Out of scope / deferred

- **Authentication & security** — per user direction. No auth handoff, no SSO, no cookie/SameSite work.
- **Empty-state no-results bug** (`deriveSearchResults.ts:13`, the `|| c.dashboard != null` clause) — deferred to the contextual-dashboard spec; **no interim fix**.
- **Contextual dashboards inline in search results** (per-matched-entity RecViz dashboards, multiple-match stacking/lazy-mount, perf guards, which categories opt in) — its own brainstorm → spec → plan.
- **Production CSP / `frame-ancestors` / SSO contract** with the RecViz team (Phase 9 / Phase 4 entry criterion) — dev uses a local origin allow-list only.
- **Legacy endpoint cleanup** — the `rectrace-tlm-stats` V1 controllers and the `/api/qrk-stats` vs `/api/quickrec-stats` path mismatch are sidestepped (RecViz queries Oracle directly, not these endpoints); not touched here.

## 12. Open items / risks (resolve during planning; some need a short RecViz spike)

Ordered by impact after code-review verification. Items 6 and 7 are **correctness** issues that affect every panel; 1 affects only the TLM `set_id`/1-day path.

1. **Conditional source selection (TLM).** A RecViz panel binds to a fixed source/SQL; `_resolve_database` (`query_engine.py:61-92`) only swaps the DB *connection* by filter value, never the table/SQL. The legacy chooses reconmgmt-only vs merge by `entry_point` + `date_range`. Resolutions:
   - ~~(i) make `tlm_automatch` return no rows so the outer-join degrades to reconmgmt~~ — **struck.** The `/merge` endpoint applies identical filters to all sources (`data_sources.py:57`), there's no "emit `WHERE 1=0`" primitive, and the reconmgmt-only path reads a **different table** (`mr_csum_man_match_stats_hist`) than `tlm_manual`/`tlm_automatch`, so degrading the merge cannot reproduce it.
   - (ii) **multiple panels with `visibleWhen`** — `GridConfig.visibleWhen` *exists and is honored* (`dashboard-config.ts:99-103,113`; `config-data-grid.tsx:32-49,373`), BUT it keys on **KPI values**, not filter values. So this works only if a KPI can encode the `entry_point`/`date_range` condition.
   - (iii) **small RecViz addition** — add **filter-value-based panel visibility** to RecViz. This is the realistic spike target (a blend of ii+iii), not "discover whether conditional panels exist."
   **Spike against RecViz before authoring the TLM dashboard.**
2. **`quickrec_stats_table` schema / cross-schema read.** The table is owned by **recportal** (`schema/04-recportal.sql:11`; no cross-grant or synonym exists — `init/01-create-schema-users.sql` grants only `CONNECT, RESOURCE`). The *legacy* backend reads it via `reconmgmtJdbcTemplate` (reconmgmt user), which **cannot resolve it locally** — a latent legacy bug. **Our RecViz approach sidesteps this**: point `qr_automatch`'s RecViz connection at the owning schema (recportal locally). Open item is only the **prod** owning-schema (legacy implies reconmgmt; seed says recportal) — confirm against a real environment before prod.
3. **Coloring capability** (§5.7) — confirm RecViz chart config can map category→color; add if not.
4. **Data-freshness fidelity** — the merge path exists because reconmgmt historical aggregates may lag live automatch for the current day/set_id. Confirm the seeded local data exercises this meaningfully.
5. **`TLM_INSTANCE_MAP` translation** — friendly↔DB_NAME must be baked into the reconmgmt dataset SQL / filter mapping so displayed instance names match the UI's friendly form.
6. **MergeEngine zero-defaulting (correctness — RecViz code change required).** `MergeEngine._merge_two` (`merge_engine.py:24-67`) does a key-indexed full-outer merge via dict-spread (`{**lrow, **rrow}`); it does **not** COALESCE missing-side measures to 0 as the legacy Java does (`TlmStatsV2Service.java:288,310-311`). So an automatch-only row arrives with **no `manual_match_count` key** (blank cell vs legacy `0`), and the right side **overwrites** the left on any shared non-key column. SQL-side `0 AS <measure>` defaulting does **not** fix it — on a matched key the right side's `0` would overwrite the left's real value. **Chosen resolution:** add zero-coalescing (and disjoint-non-key-column enforcement) to RecViz's MergeEngine. Budget this RecViz change in Plan 3. (KPI sums skip nulls, so aggregate totals stay correct; per-row/grid display is what diverges.)
7. **TLM date-clause divergence (correctness).** Per §8, RecViz's `_build_date_range_clause` differs from the legacy TLM clause (upper bound `SYSDATE` vs `SYSDATE - 1`, and the range-1 `DECODE`). Left unreconciled, every embedded TLM panel returns a different date window than the legacy modal. **Resolution:** parameterize `_build_date_range_clause` per dashboard, or correct it to match legacy TLM. (QuickRec already matches.)
8. **TLM breaks Java-side date filter.** For `recon`/`tlm_instance` entries the legacy fetches all breaks then filters by date in Java (no SQL date filter). RecViz must express this as pure SQL — re-author `tlm_breaks` with the date clause inline.
9. **QuickRec six-percentage KPI shape.** Per §5.2, the legacy summary shows six left/right percentages, not four. RecViz `percentage_of` is one-reference-per-KPI and the aggregator sums a single `metric` column, so reproduce via ≥8 paired KPIs or pre-aggregated percentage columns in `qr_automatch`.
10. **Server-side filtering & dynamic routing are gated OFF for managed datasets (FOUNDATIONAL — RecViz code change required; verified).** `RecvizDataset` (`recviz/backend/app/db/models/dataset.py`) — the only live dataset table — has no `filter_mappings`/routing columns; `ConfigStore._build_config` hardcodes `filter_mappings=[]` and `database_routing=static` (`recviz/backend/app/services/config_store.py:54-61`); the seed strips `{{filters}}` from dataset SQL. So `query_engine`'s filter-substitution and dynamic-routing machinery — which §5.3/D2 and every "show stats for this entity" behavior rely on — **never receives mappings for managed datasets**. Passing `?filter.recon_id=X` sets the UI filter but does NOT narrow the SQL, and TLM dynamic instance routing won't engage. **Both** the QuickRec filter push-down and the TLM instance routing therefore require a shared RecViz foundation change: extend `RecvizDataset` (+ migration) and `ConfigStore._build_config` to persist & apply `filter_mappings` and `database_routing`, extend the managed-dataset CRUD/seed to write them, and stop stripping `{{filters}}`. Sequenced as **Plan 1** below.

> **RecViz runtime ports:** RecViz API is `:8000`, RecViz frontend dev server `:5173` (per `recviz/backend/.env`). Not `:6088` (that's our rectrace backend).

## 13. Implementation decomposition (for writing-plans)

Four plans; a shared **RecViz embed foundation** lands first, then **QuickRec** (the first user-visible slice) before TLM adds seed/merge:

1. **Plan 1 — RecViz embed foundation** (RecViz repo, on a dedicated branch): framing fix (§5.5, `X-Frame-Options` → CSP `frame-ancestors` on `/embed`) + the §12.10 gating fix (persist & apply `filter_mappings` and `database_routing` through `RecvizDataset` + migration + `ConfigStore` + managed-dataset CRUD/seed; stop stripping `{{filters}}`) + register the **recportal** connection (§12.2). Tests: a managed dataset with a filter mapping narrows the SQL; a dynamic-routing dataset picks the connection by filter value; `/embed` responses carry `frame-ancestors` not `X-Frame-Options`. This unblocks every dashboard.
2. **Plan 2 — QuickRec dashboard + React modal:** QuickRec datasets (§5.2, with working `filter_mappings`) + six-percentage KPI shape (§12.9) + the dashboard config (filters, KPIs, donut, two grids) + `RecvizDashboardModal` (§6.1) + `quickRecStatsButtonRenderer` (§6.2/§6.4) + config wiring + RecViz-origin config + theme handoff. Fully local (data already seeded). Proves the whole pipeline end-to-end.
3. **Plan 3 — Local TLM seed:** Surface C (§7) — per-instance TLM tables + a `recviz_connections` row keyed to the dynamic-routing mapping value.
4. **Plan 4 — TLM dashboard:** first the spike (§12.1) **and** the correctness fixes — MergeEngine zero-defaulting (§12.6) and date-clause reconciliation (§12.7); then TLM datasets + dynamic routing + merge panel (§5.3, breaks as pure SQL per §12.8) + `tlmStatsButtonRenderer` + entry-point mapping (§6.3) + optional theme listener (§5.6) + coloring (§5.7).
