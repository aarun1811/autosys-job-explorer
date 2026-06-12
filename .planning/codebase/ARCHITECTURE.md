<!-- refreshed: 2026-05-12 -->
# Architecture

> **⚠ Point-in-time audit (2026-05-12)** — describes the pre-modernization codebase (Boot 2.7 / Angular / V3). For the current verified state see **`.planning/codebase/CURRENT-STATE-2026-06-12.md`**; for conventions + gotchas see the repo **`CLAUDE.md`**.

**Analysis Date:** 2026-05-12

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    Angular 16 SPA (port 4200)                           │
│              frontend/rectrace/src/app/                                 │
│  ┌────────────────┐  ┌───────────────────┐  ┌──────────────────────┐   │
│  │  SearchV5      │  │  AG-Grid SSRM     │  │  Modal Overlays      │   │
│  │  Component     │  │  Grid Component   │  │  (Execution Order,   │   │
│  │  search-v5/    │  │  search-v5-grid/  │  │   TLM Stats,         │   │
│  │  components/   │  │  components/      │  │   QuickRec Stats)    │   │
│  │  search-v5/    │  │  search-v5-grid/  │  │   custom-interactions│   │
│  └───────┬────────┘  └────────┬──────────┘  └──────────┬───────────┘   │
│          │                   │                          │               │
│  ┌───────▼───────────────────▼──────────────────────────▼───────────┐  │
│  │                     Services Layer                                │  │
│  │  search-v5.service.ts │ execution-order.service.ts │             │  │
│  │  tlm-stats.service.ts │ quickrec-stats.service.ts  │             │  │
│  │  user.service.ts      │ theme.service.ts            │             │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────┬──────────────────────────────────────┘
                  HTTP (REST/JSON)  │
         ┌────────────────────────┬┴──────────────────────┐
         │                        │                       │
         ▼                        ▼                       ▼
┌─────────────────┐   ┌─────────────────────┐   ┌──────────────────────┐
│  backend/rectrace│   │rectrace-tlm-stats   │   │  (future services)   │
│  (port 6088)    │   │  (port 8080)         │   │                      │
│  Spring Boot    │   │  Spring Boot         │   │                      │
│  /api/*         │   │  /api/tlm-stats/*    │   │                      │
│                 │   │  /api/qrk-stats/*    │   │                      │
└────────┬────────┘   └─────────┬────────────┘   └──────────────────────┘
         │                      │
    ┌────┴────┐           ┌─────┴──────┐
    │Oracle DB│           │Oracle DB   │
    │(rectrace│           │(multiple   │
    │ schema) │           │ TLM        │
    └─────────┘           │ instances) │
    ┌─────────┐           └────────────┘
    │Elasticsearch│
    │(rectrace_   │
    │ core_index) │
    └─────────────┘
    ┌─────────┐
    │AutoSys DB│
    │(ujo_job, │
    │ujo_job_  │
    │status)   │
    └──────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| `RectraceApplication` | Spring Boot entry point, `@EnableAsync` for parallel search | `backend/rectrace/src/main/java/com/citi/gru/rectrace/RectraceApplication.java` |
| `SearchController` | REST endpoints for v3 search (keyword, expand, SSRM) | `backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/SearchController.java` |
| `SearchControllerV4` | REST endpoints for v4 search (initial, SSRM, config, export) | `backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/v4/SearchControllerV4.java` |
| `ExecutionOrderController` | REST endpoint to fetch job dependency graph data | `backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/ExecutionOrderController.java` |
| `UserController` | REST endpoint to resolve user login ID from header | `backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/UserController.java` |
| `SearchServiceV3` | Orchestrates v3 keyword search; runs ES queries async in parallel | `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v3/SearchServiceV3.java` |
| `ElasticsearchSearchProviderV3` | Executes keyword search against Elasticsearch, returns collapsed groups | `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v3/ElasticsearchSearchProviderV3.java` |
| `OracleSearchProviderV3` | Executes group expansion queries against Oracle | `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v3/OracleSearchProviderV3.java` |
| `SearchConfigServiceV3` | Loads and validates `search-config.json` at startup via `@PostConstruct` | `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/SearchConfigServiceV3.java` |
| `SearchServiceV4` | Orchestrates v4 search; parallel ES lookup, Oracle SSRM pagination, Excel export | `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v4/SearchServiceV4.java` |
| `ExecutionOrderService` | Queries Oracle for job execution sequences and job details; fetches live status | `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/ExecutionOrderService.java` |
| `JobStatusService` | Queries AutoSys Oracle DB (`ujo_job`, `ujo_job_status`) for live job status | `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/JobStatusService.java` |
| `SearchV5Component` | Angular search UI — input, autocomplete, tab selection, URL sync | `frontend/rectrace/src/app/search-v5/components/search-v5/search-v5.component.ts` |
| `SearchV5GridComponent` | AG-Grid with server-side row model; manages SSRM datasource and all grid actions | `frontend/rectrace/src/app/search-v5/components/search-v5-grid/search-v5-grid.component.ts` |
| `SearchServiceV5` | Angular HTTP service calling `/api/v4/search/*` endpoints | `frontend/rectrace/src/app/services/search-v5.service.ts` |
| `ExecutionOrderService` (FE) | Angular HTTP service calling `/api/execution-order/:jobName` | `frontend/rectrace/src/app/services/execution-order.service.ts` |
| `ExecutionOrderGraphComponent` | Cytoscape.js + dagre graph; status-aware node coloring, zoom/pan controls | `frontend/rectrace/src/app/custom-interactions/components/modals/execution-order-graph/execution-order-graph.component.ts` |
| `ExecutionOrderModalComponent` | MatDialog wrapper hosting the graph + job detail side panel | `frontend/rectrace/src/app/custom-interactions/components/modals/execution-order-modal/execution-order-modal.component.ts` |
| `TlmStatsController` | `/api/tlm-stats/*` — breaks, automatch, manual-match endpoints | `rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/controller/TlmStatsController.java` |
| `QuickRecStatsController` | `/api/quickrec-stats/*` — automatch, manual-match, summary endpoints | `rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/quickrec/controller/QuickRecStatsController.java` |

## Pattern Overview

**Overall:** Three-tier REST architecture with a dual-provider search pattern per category.

**Key Characteristics:**
- Every search category is backed by Elasticsearch for fast keyword lookup and Oracle for full detail retrieval
- Search category definitions (columns, ES index config, Oracle query) live entirely in JSON config files, not Java code
- The frontend uses AG-Grid's Server-Side Row Model (SSRM) to lazy-load and paginate data on demand
- RxJS `Subject` + `takeUntil` pattern for all Angular service subscriptions and lifecycle cleanup
- `x-citiportal-loginid` HTTP header is the sole authentication/identity mechanism across all tiers

## Layers

**Controllers (backend/rectrace):**
- Purpose: HTTP request handling, header extraction, input validation
- Location: `backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/`
- Contains: `SearchController`, `SearchControllerV4`, `ExecutionOrderController`, `UserController`, `FrontendController`
- Depends on: Service layer
- Used by: Angular frontend (HTTP)

**Services V3 (backend/rectrace):**
- Purpose: V3 search orchestration with async parallel execution across ES categories
- Location: `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v3/`
- Contains: `SearchServiceV3`, `ElasticsearchSearchProviderV3`, `OracleSearchProviderV3`
- Depends on: `SearchConfigServiceV3`, `RestHighLevelClient`, `DataSource`
- Used by: `SearchController`

**Services V4 (backend/rectrace):**
- Purpose: V4 search orchestration with `CompletableFuture.runAsync` parallel ES lookup and Oracle SSRM
- Location: `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v4/`
- Contains: `SearchServiceV4`, `ElasticsearchServiceV4`, `OracleServiceV4`, `SearchConfigServiceV4`
- Depends on: `search-config-v4.json`, `RestHighLevelClient`, `DataSource`
- Used by: `SearchControllerV4`

**Config Service (backend/rectrace):**
- Purpose: Load, parse, and validate `search-config.json` at application startup; serve typed configs to search providers
- Location: `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/SearchConfigServiceV3.java`
- Contains: `SearchConfigServiceV3` (v3), `SearchConfigServiceV4` (v4)
- Depends on: Jackson `ObjectMapper`, classpath resources
- Used by: All search providers

**DTOs (backend/rectrace):**
- Purpose: Typed data transfer between layers and JSON serialization
- Location: `backend/rectrace/src/main/java/com/citi/gru/rectrace/dto/`
- Contains: `SearchCategoryDefinition`, `ElasticsearchProviderConfig`, `OracleProviderConfig`, `ExecutionOrderDTO`, `JobStatusInfo`; V4 variants in `dto/v4/`

**Utility (backend/rectrace):**
- Purpose: External script execution for password retrieval
- Location: `backend/rectrace/src/main/java/com/citi/gru/rectrace/util/ScriptExecutor.java`
- Contains: `ScriptExecutor` — invokes `/opt/rectify/control/scripts/get_password.sh` at startup for datasource credentials

**Angular Services (frontend):**
- Purpose: HTTP communication and shared state via `BehaviorSubject`
- Location: `frontend/rectrace/src/app/services/`
- Contains: `SearchServiceV5`, `ExecutionOrderService`, `TlmStatsService`, `TlmStatsV2Service`, `QuickRecStatsService`, `UserService`, `ThemeService`
- Depends on: `HttpClient`, `environment.ts` for base URLs

**Angular Components (frontend):**
- Purpose: UI rendering and user interaction
- Location: `frontend/rectrace/src/app/search-v5/`, `frontend/rectrace/src/app/custom-interactions/`

## Data Flow

### Primary Search Request Path (V4)

1. User types in search box → `SearchV5Component.performSearch()` (`search-v5.component.ts`)
2. `SearchServiceV5.performInitialSearch(keyword)` → `GET /api/v4/search/initial?keyword=...` (`search-v5.service.ts:103`)
3. `SearchControllerV4.performInitialSearch()` receives request (`SearchControllerV4.java:25`)
4. `SearchServiceV4.performInitialSearch()` fans out `CompletableFuture.runAsync` per category (`SearchServiceV4.java:50`)
5. `ElasticsearchServiceV4.getUniqueValues(keyword, category)` queries ES index, returns up to 1000 collapsed values
6. All futures join; response: `{ categoryResults: { [key]: { values: string[], count: N } } }`
7. Angular receives response → `SearchV5Component` filters empty categories, renders tabs sorted by count
8. Tab click activates `SearchV5GridComponent` with the category's ES values as `initialFilter`

### SSRM Grid Data Load Path

1. AG-Grid fires SSRM `getRows` callback on tab activation or scroll → `SearchV5GridComponent.createSSRMDatasource()` (`search-v5-grid.component.ts:324`)
2. `SSRMRequestV4` built with `initialFilter: { column, values }` (up to 1000 ES values) + pagination params
3. `SearchServiceV5.fetchSSRMData(request)` → `POST /api/v4/search/ssrm/:category`
4. `SearchControllerV4.fetchSSRMData()` → `SearchServiceV4.fetchSSRMData()` (`SearchServiceV4.java:102`)
5. `OracleServiceV4.fetchSSRMData()` executes Oracle SQL using `WHERE column IN (:values)` with pagination
6. Oracle returns paginated rows; `SSRMResponseV4 { rows, lastRow }` returned to grid
7. AG-Grid renders rows; group expansion fires another SSRM request with `groupKeys`

### Execution Order Graph Path

1. User clicks "View" button in grid → `ExecutionOrderButtonComponent.showExecutionOrder()` (`execution-order-button.component.ts:168`)
2. `ExecutionOrderService.getExecutionOrder(jobName)` → `GET /api/execution-order/:jobName`
3. `ExecutionOrderController` → `ExecutionOrderService.getExecutionOrder(loadJobName)` (`ExecutionOrderService.java:46`)
4. Two Oracle queries: `AUTOSYS_TLM_RECON_SEQUENCES` for sequence, `AUTOSYS_ALL_JOBS_DATA` for job details
5. `JobStatusService.getBatchJobStatus(jobNames)` queries AutoSys DB `ujo_job`/`ujo_job_status` (conditional on bean availability)
6. `ExecutionOrderDTO` returned with `executionSequence`, `jobDetails`, `jobStatuses`, `statusAvailable`
7. `MatDialog.open(ExecutionOrderModalComponent, { data })` — modal renders `ExecutionOrderGraphComponent`
8. Cytoscape.js with dagre layout renders nodes; nodes colored by `VisualState` (`COMPLETED`, `FAILED`, `RUNNING`, `WAITING`, `INACTIVE`)

**State Management (Angular):**
- No NgRx/Redux; component-local state with service-injected `Observable` streams
- `ThemeService` uses `BehaviorSubject<Theme>` for app-wide dark/light mode
- Search state (term, results, selected tab) lives in `SearchV5Component`
- AG-Grid expanded group state tracked in `SearchV5GridComponent.expandedGroupIds: Set<string>`
- User login ID stored in `localStorage` after first retrieval from `/api/user/info`

## Key Abstractions

**SearchCategoryDefinition (Dual-Provider Config):**
- Purpose: Defines a search category with both ES and Oracle configuration in a single JSON entry
- Examples: `backend/rectrace/src/main/resources/search-config.json`, `backend/rectrace/src/main/resources/search-config-v4.json`
- Pattern: `searchProviderType` field discriminates between `ElasticsearchProviderConfig` and `OracleProviderConfig` via Jackson `@JsonSubTypes`; an additional sibling `oracleConfig` field allows a category to have both ES (for keyword lookup) and Oracle (for group expansion)
- Key DTO: `backend/rectrace/src/main/java/com/citi/gru/rectrace/dto/SearchCategoryDefinition.java`

**SSRM Datasource:**
- Purpose: Connects AG-Grid's server-side row model to the backend paginated Oracle queries
- Implementation: `SearchV5GridComponent.createSSRMDatasource()` — implements `IServerSideDatasource`
- Request shape: `SSRMRequestV4` with `initialFilter` (ES pre-filter values), `groupKeys`, `startRow`, `endRow`, `sortModel`, `filterModel`, `visibleColumns`

**Search Config JSON:**
- Purpose: Declarative column definitions, ES index config, Oracle query template per category — no code changes needed to add/modify categories
- V3 config: `backend/rectrace/src/main/resources/search-config.json`
- V4 config: `backend/rectrace/src/main/resources/search-config-v4.json`
- Column definitions in config include `cellRenderer` references (string keys) that map to registered AG-Grid components

**Custom Cell Renderers:**
- Purpose: AG-Grid column-level interactive components (links, buttons, external system deep-links)
- Registered by string key in `SearchV5GridComponent.gridOptions.components`
- Examples: `executionOrderButtonRenderer` → `ExecutionOrderButtonComponent`, `appIDCellRenderer` → `AppIDCellRendererComponent`

## Entry Points

**Backend REST API:**
- Location: `backend/rectrace/src/main/java/com/citi/gru/rectrace/RectraceApplication.java`
- Context path: `/rectrace` (all API endpoints are at `/rectrace/api/...` in production)
- Key routes:
  - `GET /api/v3/search/keyword` — keyword search, returns category result map
  - `POST /api/v3/search/ssrm/:category` — SSRM data for v3 categories
  - `GET /api/v3/search/expand` — Oracle group expansion for v3
  - `GET /api/v4/search/initial` — initial parallel ES search (v4)
  - `POST /api/v4/search/ssrm/:category` — Oracle SSRM pagination (v4)
  - `GET /api/v4/search/config` — category configuration
  - `POST /api/v4/search/export/:category` — Excel export
  - `GET /api/execution-order/:loadJobName`
  - `GET /api/user/info`
  - `GET /api/search/suggest`

**Frontend SPA:**
- Location: `frontend/rectrace/src/app/app.module.ts`
- Default route: `/` redirects to `/search` (lazy-loaded `SearchV5Module`)
- Routing: `frontend/rectrace/src/app/app-routing.module.ts`

**TLM Stats Service:**
- Location: `rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/TlmStatsApplication.java`
- Key routes:
  - `GET /api/tlm-stats/breaks`
  - `GET /api/tlm-stats/automatch`
  - `GET /api/tlm-stats/manual-match`
  - `POST /api/quickrec-stats/automatch`
  - `POST /api/quickrec-stats/manual-match`
  - `GET /api/quickrec-stats/summary`

## Architectural Constraints

- **Threading:** `@EnableAsync` on `RectraceApplication`; async pool named `taskExecutor` defined in `AsyncConfig.java`. `SearchServiceV3` uses `@Async("taskExecutor")` for per-category ES calls. `SearchServiceV4` uses `CompletableFuture.runAsync` without naming the pool — falls back to `ForkJoinPool`.
- **Global state:** `SearchConfigServiceV3` and `SearchConfigServiceV4` hold in-memory category list loaded at startup — effectively module-level singletons. Changes to config files require application restart.
- **Circular imports:** None detected.
- **Dual datasources:** Backend maintains two Oracle connections — primary (`DataSourceConfig` → `RECTRACE` schema) and AutoSys (`AutosysDataSourceConfig` → `AUTOSYS` schema). `JobStatusService` is conditional on `autosysDataSource` bean existence (`@ConditionalOnBean`).
- **Password security:** Oracle passwords retrieved at startup via external shell script `/opt/rectify/control/scripts/get_password.sh` through `ScriptExecutor.java`. TLM Stats service has the same pattern in `rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/util/ScriptExecutor.java`.
- **AG-Grid license:** Enterprise license key required, configured in `frontend/rectrace/src/environments/environment.ts` as `agGridLicenseKey`.
- **CORS:** Backend uses `@CrossOrigin(origins = "*")` on V4 controller; dedicated `CorsConfig.java` also present. TLM Stats service has its own `CorsConfig.java`.

## Anti-Patterns

### V3 and V4 Search APIs coexist

**What happens:** Both `/api/v3/search/*` (`SearchController`) and `/api/v4/search/*` (`SearchControllerV4`) are live. The frontend `SearchServiceV5` exclusively calls v4 endpoints (`/api/v4/search/*`), but the v3 controller remains deployed.

**Why it's wrong:** Dead v3 API surface increases maintenance burden; any shared config changes must be validated against both code paths.

**Do this instead:** Confirm v3 endpoints are unused and remove `SearchController.java`, `SearchServiceV3.java`, `ElasticsearchSearchProviderV3.java`, `OracleSearchProviderV3.java`, and `SearchConfigServiceV3.java`.

### getRowId uses timestamp + random for uniqueness

**What happens:** `SearchV5GridComponent.getRowId` generates IDs using `Date.now()` and `Math.random()` because rows may have identical data (`search-v5-grid.component.ts:196`).

**Why it's wrong:** Non-deterministic IDs prevent AG-Grid from correctly identifying rows across refreshes, breaking features like row state persistence.

**Do this instead:** Use a stable business key from the data (e.g., composite of visible columns or a true PK from Oracle).

## Error Handling

**Strategy:** Controllers catch exceptions and return standardized error maps; services return `null` on failure and log errors.

**Patterns:**
- Backend controllers: `try/catch` wrapping service calls, return `{ status: "error", error_type, message, timestamp }` on failure
- `SearchServiceV3`/`V4`: Return empty result sets on exception; log at ERROR level with full stack trace
- Frontend: RxJS `catchError` in suggestion stream returns `of([])`; grid datasource calls `params.fail()` on error; `subscribe({ error })` handler sets `errorMessage` for display

## Cross-Cutting Concerns

**Logging:** SLF4J with Logback in all backend services; Angular uses `console.error` / `console.log` directly.

**Validation:** Backend — `SearchConfigServiceV3.validateCategories()` runs at startup and marks invalid categories; V4 controller validates keyword is non-empty before delegating. Frontend — search term checked for non-empty before API call.

**Authentication:** `x-citiportal-loginid` request header extracted in `SearchController` and `UserController`; logged for audit but not enforced (no auth filter). Frontend injects header via `SearchServiceV5.getHeaders()` using `sessionStorage.getItem('userId')`.

---

*Architecture analysis: 2026-05-12*
