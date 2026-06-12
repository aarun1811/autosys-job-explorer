# Rectrace — Current State (Verified)

**Date:** 2026-06-12
**Method:** Multi-agent deep-dive of `backend/rectrace`, `frontend-react`, the DB layer, the sibling seed repo (`../rectrace-local-dev`), and the RecViz app, followed by an adversarial fact-verification pass against actual code. Every claim below was checked against source; `file:line` citations point at the evidence.

> **Why this doc exists:** the per-phase `.planning/` docs (STATE / ROADMAP / parity-matrix) and the 2026-05-12 `codebase/*` audit snapshot lag the code by ~3–4 weeks of heavy work (execution-order redesign, TLM/QuickRec RecViz embed, loader extraction, A1a). This is the current source of truth. When it disagrees with an older doc, trust this one.

---

## 1. System map

Rectrace ("autosys-job-explorer") is an internal Citi web app for exploring Autosys job metadata, file-load reconciliation config, and TLM/QuickRec statistics. Users search a denormalized catalog of recon jobs, drill into per-job execution-order dependency graphs (native React Flow), and open TLM/QuickRec statistics dashboards that are **embedded from a second, separate app, RecViz** (FastAPI + React). The two apps share an Oracle *instance* but no schema, no code, and no runtime API calls — RecViz is embedded one-directionally via iframe.

```
Browser ── frontend-react (Vite7 + React19 + AG-Grid35, base /rectrace, :5173 dev)
            ├─ SSRM search grid (config-driven columns)
            ├─ ExecutionOrderModal ── React Flow @xyflow/react v12 + dagre (NATIVE, done)
            └─ RecvizEmbed <iframe> ── TLM / QuickRec stats dashboards
                  │ /rectrace/api/v4/*            │ iframe src →
                  ▼                               ▼ {recvizOrigin}/embed/dashboards/{id}?filter…
   backend/rectrace (Boot 3.5.14, Java21, ctx /rectrace, :6088)     RecViz backend (FastAPI, Py3.12, :8000)
     ├─ SearchControllerV4 (ES → Oracle two-step)                    ├─ /embed/dashboards/{id}
     ├─ ExecutionOrderController (AUTOSYS JPA native query)          ├─ /api/data-sources/{id}/query
     └─ ConfigController → {recvizOrigin}                            └─ Fernet conn pool, oracledb THICK
         │ JdbcTemplate        │ ElasticsearchClient                     │
         ▼                     ▼                                         ▼
       Oracle FREEPDB1       ES 8.13.4 (rectrace_core_index)       same Oracle instance, diff schema/user
         ▲ reads                ▲ writes via alias rectrace_core_alias
         └──────── rectrace-loader (Boot 3.5.14, :6089, ShedLock + BulkIngester, Oracle→ES)

  Local dev: sibling repo ../rectrace-local-dev/ → docker-compose (Oracle 23-free + ES 8.13.4), apply.py seed
```

**Components (CLAUDE.md component table is accurate):**

| Module | Stack | Port | Notes |
|---|---|---|---|
| `backend/rectrace` | Boot 3.5.14, Java 21, jakarta | 6088 | ctx path `/rectrace`. Main API. Zero loader code. |
| `rectrace-loader` | Boot 3.5.14, Java 21 | 6089 | Owns Oracle→ES loader (extracted from backend). No context path. |
| `rectrace-tlm-stats` | Boot 3.5.14, Java 21 (no Lombok) | 8080 | TLM stats service. **Not deeply audited in this pass.** |
| `frontend-react` | Vite 7 + React 19 + shadcn (Tailwind v4) + AG-Grid 35 + TanStack | 5173 | Active, go-forward UI. |
| `frontend/` (Angular 18) | AG-Grid 32, Cytoscape, RxJS | 4200 | Frozen; slated for deletion. |
| RecViz (separate repo) | FastAPI 0.128, Py 3.12, React 19, AG-Charts/ECharts | 8000 | Embedded via iframe only. |

**Branch reality:** the modernization milestone is **merged into `main`**. `main` is ~45 commits **ahead** of `milestone/modernization` (whose HEAD is the merge-base; `milestone/modernization` is 0 commits ahead of `main`). The "milestone branch ~160 commits ahead of main" framing in old docs is obsolete.

---

## 2. The domain model

The logical unit is a **recon entity** = one `rectrace_core` row (22 cols, all `VARCHAR2(4000)`, no declared PK; `job_name` is the natural/loader key). DDL + seed live in the sibling repo `../rectrace-local-dev`.

**Key identifiers and their join targets** (union of `rectrace_core` DDL, `search-config-v4.json`, seed scenarios):

| `rectrace_core` field | Joins to | Purpose |
|---|---|---|
| `job_name` | ES `_id` (hash), `autosys.ujo_job.job_name` | search natural key |
| `load_job` | exec-order chain root | execution-order graph |
| `recon`, `set_id` | `reconmgmt.recon_bank`, `mr_csum_*` | TLM stats |
| `recon_id`, `recon_portal_id` | `recportal.quickrec_stats_table` | QuickRec stats |
| `tlm_instance` | routing key → physical TLM Oracle DB | TLM DB selection |
| `app_id`, `support_email` | — | display (anchor / mailto) |

**Execution-order DAG** — two tables, both physically in the `rectrace` schema despite the `AUTOSYS_` name prefix:
- `autosys_tlm_recon_sequences(job_name, load_job, exec_order)` — ordered chain.
- `autosys_all_jobs_data(insert_job, job_type, machine, run_calendar, exclude_calendar, box_name, command, description)` — per-step detail; `command`/`description` are CLOB.

**Seed graph shape per `load_job` is a linear 3-node chain inside a BOX** (verified `rectrace-local-dev/data/01-rectrace-inserts.sql:93-180`):
```
PRE_{load_job}(exec_order=1) → MAIN_{load_job}(2) → POST_{load_job}(3)
```
`autosys_all_jobs_data` = 1 BOX row (`job_type='BOX'`, `command=NULL`) + 3 CMD rows (`/scripts/run_pre|main|post.sh`) per load_job, all sharing one `box_name`. **The seed contains only trivial linear DAGs — no fan-in/fan-out/diamond topologies — so any richer graph layout (branches) is untested against seed data.** Hyphenated variants use `-` as the separator.

**Live job status:** `autosys.ujo_job ⋈ autosys.ujo_job_status` on `joid`; codes `1=SUCCESS 2=RUNNING 3=STARTING 4=FAILURE 5=TERMINATED 7=ON HOLD`. The 5 canonical seed scenarios span SUCCESS/RUNNING/FAILURE/ON-HOLD so status-coloring is exercisable.

---

## 3. Backend (`backend/rectrace`)

- **Build:** Java 21, Spring Boot 3.5.14, ojdbc/ucp pinned 21.5.0.0, JSqlParser 5.3 (`pom.xml:7-8,30-31`).
- **Profiles:** nearly all production beans are `@Profile("!test")` (DataSourceConfig, AutosysDataSourceConfig, ReadonlyDataSourceConfig, SearchControllerV4, OracleServiceV4, SqlSearchControllerV4, ExecutionOrderController, etc.); the `test` profile bypasses Oracle/ES wiring.
- **Three datasources:** primary `RECTRACE` + `AUTOSYS` + read-only (for the SQL tab). Default DataSource & JPA auto-config are excluded at the app class; all three are hand-wired.

**Verified REST endpoint inventory** (paths shown WITH the `/rectrace` context prefix; 8 controllers):

| Controller | Profile | Endpoints |
|---|---|---|
| `ConfigController` | always | `GET /rectrace/api/config` → `{recvizOrigin}` |
| `SearchController` (legacy suggest) | `!test` | `GET /rectrace/api/search/suggest?prefix=` |
| `ExecutionOrderController` | `!test` | `GET /rectrace/api/execution-order/{loadJobName}` |
| `UserController` | always | `GET /rectrace/api/user/info` |
| `FrontendController` | always | `GET /rectrace/{path:[^\.]*}` → forward `/index.html` (SPA) |
| `SearchControllerV4` | `!test` | `GET /rectrace/api/v4/search/initial?keyword=` · `POST /rectrace/api/v4/search/ssrm/{category}` · `GET /rectrace/api/v4/search/config` · `POST /rectrace/api/v4/search/export/{category}` · `GET /rectrace/api/v4/search/health` |
| `SqlSearchControllerV4` | `!test` | `GET /rectrace/api/v4/sql-search/config` · `POST /rectrace/api/v4/sql-search/ssrm/{tabKey}` |

(The loader admin endpoints `/api/v4/loader-admin/*` now live in **`rectrace-loader`** on :6089, not here.)

**V4 search — config-driven, dual-provider, two-step:**
- `search-config-v4.json` declares **13 categories** (`fileName, reconName, boxName, setId, subAcc, loadFileName, jobName, machineName, runCalendar, excludeCalendar, tlmInstance, reconId, reconPortalId`). **All 13 share** `elasticsearch.index = rectrace_core_index` and `oracle.table = rectrace_core`.
- Step 1: ES wildcard + collapse on `<field>.keyword` answers "which distinct values match the keyword?" (cap 1000). Step 2: those strings pass **verbatim as Oracle bind params** in an `IN (?,?,…)` clause; Oracle returns SSRM-paged/sorted/filtered detail rows.
- **`ColumnNameWhitelist.forCategory(config)`** validates every client-supplied column (sort `colId`, filter keys, `visibleColumns`, `rowGroupCols`) + sort direction before any SQL string concat — the SQL-injection gate. Table name is interpolated from server-side config only.
- **`DashboardConfig` DTO exists** (`dto/v4/DashboardConfig.java`) and `CategoryConfigV4.dashboard` is a field, but **no category in `search-config-v4.json` populates it** — A1a (2026-05-31) removed the category-level dashboard concept (config-only edit; infra/types kept). This is the ready-made hook if a "search tab that is a RecViz iframe" is ever wanted; `SearchServiceV4` already handles `elasticsearch:null` dashboard-only categories.

**SQL-tab subsystem:** JSqlParser 5.3 boot-time shape validation (fails to boot on a bad query), dedicated read-only Oracle DS, per-statement `setMaxRows`/`setQueryTimeout`/`setFetchSize` caps. Path segment is `sql-search`.

**Observability:** profile-aware `logback-spring.xml` (Splunk HEC), Brave/Micrometer tracing with `X-Correlation-Id` as the 128-bit traceId, Prometheus, slow-query AOP. **Exactly 3 HealthIndicators in this module:** `@Component("oracle")`, `@Component("elasticsearch")`, `@Component("searchConfig")`. **No `loaderRunAge` indicator here** — it moved to `rectrace-loader`. (`searchConfig` is DOWN by design in the `test` profile and in any env without a SQL-tab config file.)

**Security:** `SecurityFilterChain` permit-all (auth deferred to Phase 9). CORS is property-driven via `app.cors.allowed-origins` (empty = block); prod/uat carry placeholders. `x-citiportal-loginid` is read for logging, **not enforced**.

---

## 4. Frontend (`frontend-react`)

- **Stack:** Vite 7, React 19, TanStack Router + Query, AG-Grid Enterprise 35, shadcn/Tailwind v4, `@xyflow/react` 12 + `dagre`, Zod, Sonner. `next-themes` is in `package.json` but **unused** (dead dep) — the theme provider is hand-rolled (`STORAGE_KEY = 'rectrace-theme'`).
- **Routing:** TanStack Router; the search route's Zod schema is `{ q?, tab?, view? }` — the active-category param is **`tab`** (not `cat`). Deep-linkable.
- **Data layer:** `apiFetch` wrapper generates a 32-char hex correlation ID per call and attaches it to thrown errors for "Error — reference: <ID>" toasts. `queryClient` default `staleTime` is **5 min** (not `Infinity`); `gcTime` 30 min, `retry: 1`, `refetchOnWindowFocus: false`.
- **Config-driven columns:** column defs arrive **inline** with `GET /api/v4/search/initial` (`CategoryResultV4.columns`); `configToColDefs` adapts `ColumnDefinitionV4` → `ColDef`. **No `useSearchConfig` hook exists** (a `/api/v4/search/config` endpoint exists and `configToColDefs` can adapt either source).
- **Cell renderers (5, `renderers/registry.ts`, map named `cellRenderers`):** `appIDCellRenderer`, `supportEmailCellRenderer`, `executionOrderButtonRenderer`, `quickRecStatsButtonRenderer`, `tlmStatsButtonRenderer`. Keys must match `cellRenderer` strings in `search-config-v4.json`.
- **Execution-order graph:** a **complete native React Flow implementation** under `src/search/execution-order/` (ExecutionOrderModal/Graph + JobFlowNode/SpineEdge + JobInspector + StatusLegend + QuickFind + PipelineSummaryStrip; dagre layout; minimap > 12 nodes). Uses `@xyflow/react` v12 + `dagre`. **No Cytoscape anywhere** (that was the Angular app). Clicking the cell fetches `GET /rectrace/api/execution-order/{jobName}` and opens the modal.
- **AG-Grid v35:** `LicenseManager.setLicenseKey(...)` is called **first** (`main.tsx:31`), **then** `ModuleRegistry.registerModules([...])` with **16 modules** (`main.tsx:43-72`; code comment: "License MUST be set before any ModuleRegistry.registerModules() call"). The 16: ServerSideRowModel, ExcelExport, ColumnsToolPanel, FiltersToolPanel, SideBar, TextFilter, CellStyle, ColumnAutoSize, RowApi, ColumnApi, RowGrouping, RowGroupingPanel, ServerSideRowModelApi, ColumnMenu, GridState, EventApi.
- **Excel export is server-side:** `exportSearch.ts` does `POST /rectrace/api/v4/search/export/{category}` → `res.blob()` → anchor download (`{category}_export.xlsx`). NOT client-side `gridApi.exportDataAsExcel()`.
- ESLint has a hex-rejection rule (use `var(--color-*)` tokens).

---

## 5. RecViz & the integration

**RecViz** = self-service BI/visualization platform for Citi's Global Reconciliation Unit. Dev defines parameterized Oracle datasets once; business users build/customize dashboards. It does **no** reconciliation, has **no** Autosys/rectrace dependency, and makes **no** runtime calls to rectrace.

- **Backend:** FastAPI 0.128.6, Python 3.12, Uvicorn, SQLAlchemy 2.0 (sync), `oracledb` **thick mode** (Oracle Instant Client + `init_oracle_client` before any import), Alembic, Fernet for stored DB passwords. Port 8000, no context path. In prod, FastAPI serves both `frontend/dist/` at `/` and APIs at `/api/*` (no nginx, no Docker; native RHEL, Oracle 19c).
- **Frontend:** React 19, Vite 7, **AG Charts Enterprise 13 + ECharts 6** (no Cytoscape/D3), AG Grid Enterprise 35, TanStack, Zustand, Monaco. Dev port 5173 (collides with rectrace dev — run RecViz built behind FastAPI on :8000 locally).
- **Embed contract:** `/embed/dashboards/{id}?filter.{filterId}={value}&filter.lock={ids}&hide={filter-bar,title,toolbar}&theme={light|dark}`. `dashboardId` is a row in `recviz_dashboards`. Dashboard data comes from `POST /api/data-sources/{id}/query {filters}`.
- **Framing:** `XFrameOptionsMiddleware` → `frame_headers_for_path()` gives `/embed/*` a CSP `frame-ancestors 'self' <RECVIZ_EMBED_FRAME_ANCESTORS>` (default `http://localhost:5173`); everything else `X-Frame-Options: SAMEORIGIN`. **No auth of any kind** — all endpoints public; the only cross-origin guard is the embed CSP.
- **RecViz docs caveat:** `RecViz/README.md` still describes Superset/PostgreSQL/Redis/Docker — all removed; the real stack is Oracle-only. Canonical docs are `RecViz/CLAUDE.md` + `.planning/PROJECT.md`. (RecViz **does** have `DEPLOY.md` and `CITI-LAPTOP-SETUP.md`.)

**What's wired on the rectrace side today (largely complete):** `ConfigController` `GET /api/config`; `recvizConfig.ts` (runtime fetch of `/rectrace/api/config`, falls back to `VITE_RECVIZ_ORIGIN` then `http://localhost:8000`); `buildEmbedUrl.ts` (+test, never `targetOrigin:'*'`); `RecvizEmbed.tsx` (sandboxed iframe, origin-validated `postMessage` `RECTRACE_THEME`, listens for `RECTRACE_IFRAME_HEIGHT`); `RecvizDashboardModal.tsx`; `TlmStatsCellRenderer` (`dash-tlm-stats`); `QuickRecStatsCellRenderer` (`dash-quickrec-stats`); `public/recviz-placeholder.html` (local dev stand-in). Design spec: `docs/superpowers/specs/2026-05-28-tlm-quickrec-recviz-modals-design.md` (+ 4 plans `docs/superpowers/plans/2026-05-28-tlm-quickrec-recviz-*.md`).

**The only data hand-off is URL filter params.** A builder must map rectrace row fields (`set_id`/`recon`/`tlm_instance`/`recon_id`/`rec_portal_id`) to RecViz dashboard **filter IDs**. `TlmStatsCellRenderer` reads an `entryPoint` param; `QuickRecStatsCellRenderer` is only clickable when `data.tlm_instance === 'QuickRec'`. These must align with RecViz `RecvizDataset.filter_mappings` (migration 002 added the columns; rows come from the seed).

### Prod blockers (verified)

1. **RecViz CORS is hardcoded** — `RecViz/backend/app/main.py:219` → `allow_origins=["http://localhost:5173","http://localhost:3000","http://localhost:4200"]`. `config.py` has no CORS field and `RECVIZ_CORS_ALLOWED_ORIGINS` (documented in `.env.citi.example:46`) is **never read** (pydantic `extra='ignore'`). Any non-localhost rectrace origin (UAT/prod) is blocked before the iframe loads. **Must be fixed in RecViz** (or RecViz served same-origin via reverse proxy).
2. **`app.recviz.origin` is absent from every** rectrace `application-*.properties` (prod/uat/local/citi only define `app.cors.allowed-origins`). `ConfigController` resolves it to empty → `recvizConfig.ts` falls back to the dead `http://localhost:8000`. DEPLOY.md documents adding it but the line isn't committed.
3. **Dashboards must be seeded per env.** `dash-tlm-stats` + `dash-quickrec-stats` ARE authored by `RecViz/scripts/seed-oracle.py` (both are in its 12-entry `CURATED_DASHBOARDS`, inserted into `recviz_dashboards`); `setup-tlm-citi.py` authors only `dash-tlm-stats`; Alembic migrations author neither (table-create only). So running the seed in each env is the requirement — they aren't "missing," but a fresh env without the seed → cell click → 404.
4. **No SSO/auth on either app**, and no auth handoff in the `postMessage` envelope. Hard blocker for prod cutover (rectrace Phase 9; RecViz has none).
5. **CSP framing-refusal not detected** — `RecvizEmbed.tsx` `onError` never fires when an iframe is refused by `frame-ancestors`; UI shows "loading" forever instead of a retry state.
6. **No versioned Zod `postMessage` envelope** yet (RECVIZ-03 open); the live `RECTRACE_THEME`/`RECTRACE_IFRAME_HEIGHT` messages are bespoke and unversioned.

(No localStorage collision with RecViz: rectrace uses `rectrace-theme`, RecViz uses `recviz-theme`. The unresolved collision is intra-rectrace — Angular *and* React both use `rectrace-theme` under `/rectrace/`.)

---

## 6. Local dev stack (sibling repo `../rectrace-local-dev`)

- **docker-compose:** `oracle` = `gvenzl/oracle-free:23-slim` (`rectrace-oracle`, `1521:1521`, `ORACLE_PASSWORD=oracle`, healthcheck) + `elasticsearch` = `docker.elastic.co/elasticsearch/elasticsearch:8.13.4` (`rectrace-es`, `9200:9200`, single-node, security disabled, `-XX:UseSVE=0` Apple-Silicon workaround). Named volumes `oracle-data`, `es-data`. DB+ES only — no app services.
- **`apply.py`** is the idempotent driver (`--reset/--verify/--oracle-only/--es-only`); it owns the ES index lifecycle (drop+recreate from the mapping JSON on `--reset`).
- **ES mapping** (`es/rectrace_core_index.mapping.json`): **13 fields carry `.keyword`, all with `ignore_above: 8192`** (Phase-8 hyphen fix — the default 256 would silently truncate long hyphenated identifiers); **8 completion-suggester fields**; 10 plain-text fields; 1 shard / 0 replicas. The **loader has no mapping resource of its own** — local-dev owns the mapping.
- **Seed:** 5 fully-connected fabricated scenarios across 11 Oracle tables + 5 ES docs (≥2 scenarios hyphenated for the Phase-8 dry-run target). Dates are always `TRUNC(SYSDATE) ± N`; volume RNG seed fixed (`20260527`) for byte-identical reruns. Seed SQL files: `01-rectrace-inserts.sql`, `02-autosys-inserts.sql`, `03-reconmgmt-inserts.sql`, `04-recportal-inserts.sql`, `05-tlm-instance-inserts.sql`, `05-elasticsearch-bulk.ndjson` (+ `scenarios.md`). **Note:** the sibling repo's README mislabels the `data/` listing as `03-tlm-stats-inserts.sql` / `04-quickrec-inserts.sql` — those files don't exist.
- First-boot-only Oracle user creation: `init/01-create-schema-users.sql` runs only when the named volume is empty — schema-user changes require `docker compose down -v`.

**Loader `_id` hashing** (`rectrace-loader/.../DocumentIdHasher.java`): hashes the job's **configured `primaryKey` column list** (generic) — extract PK values in declared order → JSON-encode the array → SHA-256 → first 8 bytes as 16 hex chars. The default loader job declares `"primaryKey": ["job_name"]`, so for that job `_id` = hash of the JSON-encoded `[job_name]` (not the raw string). Loader writes via alias `rectrace_core_alias`; search reads the concrete index. ShedLock `usingDbTime()`; `loader_run_history` keeps last 20 rows/job via `ROW_NUMBER()`.

---

## 7. Doc-vs-code corrections folded in

Fixed across CLAUDE.md / STATE / ROADMAP / parity-matrix / README / INTEGRATIONS on 2026-06-12:

- **ExecutionOrder is NOT a placeholder / Cytoscape** → complete React Flow (`@xyflow/react` + dagre) modal.
- **Phase 4 RecViz is NOT "not started"** → rectrace-side plumbing largely built; remaining work is RecViz-side + cross-team contract.
- Search param is **`tab`**, not `cat`.
- **16** AG-Grid modules, registered **after** `LicenseManager.setLicenseKey`, not "10 before license."
- **No `useSearchConfig` hook**; columns arrive inline with `/initial`; default `staleTime` 5 min (not Infinity).
- **Excel export is server-side** (`POST /api/v4/search/export/{category}`), not `gridApi.exportDataAsExcel()`.
- Backend has **3** health indicators (oracle/elasticsearch/searchConfig); `loaderRunAge` is in `rectrace-loader`.
- `application-uat.properties:2` **sets `spring.profiles.active=uat`** — forbidden in Boot 3.x; will fail boot if the UAT profile is activated (the other profile files only mention it in comments).
- `AutosysDataSourceConfig` has **no `get_password.sh` fallback** (unlike primary/readonly DS) — empty on a Citi VM → Hikari connection fails.
- `main` is the source of truth; the modernization branch is merged.

---

## 8. Open questions for the user (gate RecViz integration)

1. **Prod/UAT RecViz origin** per env (for `app.recviz.origin` + RecViz `RECVIZ_EMBED_FRAME_ANCESTORS`).
2. **Who fixes RecViz CORS** (patch `main.py`/`config.py` to read the env var) — or is RecViz served same-origin behind a reverse proxy (making CORS moot)?
3. **Same-origin vs cross-origin** embed topology in prod (decides whether CORS/`frame-ancestors`/`postMessage` per-env config matter at all).
4. **Filter-ID contract** — exact RecViz dashboard filter IDs the renderers should populate; do they match what rectrace emits, or is a mapping layer needed?
5. **SSO/auth model** (CitiPortal/SiteMinder/SPNEGO; cookies; SameSite) and how identity propagates into the embedded RecViz iframe (which has no auth today).
6. **Angular retirement path** (both serve `/rectrace/` and use `rectrace-theme`).

---

## 9. Not yet explored (do before/while building integration features)

- **`rectrace-tlm-stats`** (:8080) entirely — its relationship to the RecViz TLM dashboards (does it become redundant? does React still call it?).
- RecViz `query_engine.py` / `config_store.py` / `RecvizDataset.filter_mappings` + `database_routing` — the crux of getting TLM/QuickRec dashboard numbers correct (how `filter.{id}` maps to dataset SQL binds; how `tlm_instance` selects a physical DB).
- The legacy `TlmStatsV2Service` / `QuickRecStatsService` business logic (authoritative automatch classification, date windows, instance routing) the RecViz datasets must replicate.
- End-to-end `buildEmbedUrl` ↔ RecViz `dashboard-url-state.ts` round-trip (no smoke exists; RECVIZ-07 open).
- Whether rectrace itself sets any CSP that would block embedding a cross-origin iframe.

---

*Source artifacts for this doc: the deep-dive reports and the verification verdicts were produced 2026-06-12; raw reports were retained under `/tmp/rectrace-dd/` during authoring (ephemeral). This committed doc is the durable record.*
