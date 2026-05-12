# Codebase Structure

**Analysis Date:** 2026-05-12

## Directory Layout

```
autosys-job-explorer/
├── backend/
│   └── rectrace/                          # Spring Boot REST API (port 6088)
│       ├── src/main/java/com/citi/gru/rectrace/
│       │   ├── RectraceApplication.java   # @SpringBootApplication entry point
│       │   ├── config/                    # Spring config beans
│       │   ├── constants/                 # AppConstants
│       │   ├── controller/                # REST controllers (v3 + base)
│       │   │   └── v4/                    # V4 REST controllers
│       │   ├── dto/                       # Request/response DTOs (v3)
│       │   │   └── v4/                    # V4-specific DTOs
│       │   ├── service/                   # Service layer (config, execution order, job status)
│       │   │   ├── v3/                    # V3 search providers
│       │   │   └── v4/                    # V4 search services
│       │   └── util/                      # ScriptExecutor (password retrieval)
│       └── src/main/resources/
│           ├── application.properties     # Main config (DB URLs, ES, ports)
│           ├── application-prod.properties
│           ├── application-uat.properties
│           ├── search-config.json         # V3 search category definitions
│           └── search-config-v4.json      # V4 search category definitions
├── frontend/
│   └── rectrace/                          # Angular 16 SPA (dev port 4200)
│       └── src/
│           ├── app/
│           │   ├── app.module.ts          # Root module
│           │   ├── app-routing.module.ts  # Top-level routing
│           │   ├── core/
│           │   │   └── core.module.ts     # Core/shared module
│           │   ├── models/
│           │   │   └── job.model.ts       # Shared data models
│           │   ├── services/              # Angular injectable services
│           │   │   ├── search-v5.service.ts        # V4 API client + DTOs
│           │   │   ├── execution-order.service.ts  # Execution order API client + DTOs
│           │   │   ├── tlm-stats.service.ts        # TLM Stats API client (v1)
│           │   │   ├── tlm-stats-v2.service.ts     # TLM Stats API client (v2)
│           │   │   ├── quickrec-stats.service.ts   # QuickRec Stats API client
│           │   │   ├── user.service.ts             # User info API client
│           │   │   └── theme.service.ts            # Dark/light mode state
│           │   ├── search-v5/             # Primary search feature module
│           │   │   ├── search-v5.module.ts
│           │   │   ├── search-v5-routing.module.ts
│           │   │   └── components/
│           │   │       ├── search-v5/             # Search bar + tabs container
│           │   │       └── search-v5-grid/        # AG-Grid SSRM grid
│           │   ├── custom-interactions/   # AG-Grid integrations module
│           │   │   ├── custom-interactions.module.ts
│           │   │   └── components/
│           │   │       ├── renderers/     # AG-Grid cell renderer components
│           │   │       │   ├── app-id-cell-renderer.component.ts
│           │   │       │   ├── app-support-cell-renderer.component.ts
│           │   │       │   ├── execution-order-button.component.ts
│           │   │       │   ├── recon-cell-renderer.component.ts
│           │   │       │   ├── set-id-cell-renderer.component.ts
│           │   │       │   ├── rec-portal-id-renderer/   # Subdirectory renderer
│           │   │       │   ├── recon-id-renderer/        # Subdirectory renderer
│           │   │       │   └── v2/                       # V2 renderer variants
│           │   │       │       ├── recon-v2-renderer.component.ts
│           │   │       │       ├── set-id-v2-renderer.component.ts
│           │   │       │       └── tlm-instance-v2-renderer.component.ts
│           │   │       └── modals/        # MatDialog overlay components
│           │   │           ├── execution-order-graph/    # Cytoscape.js graph
│           │   │           ├── execution-order-modal/    # Dialog wrapper
│           │   │           ├── tlm-stats-modal/          # TLM stats v1 modal
│           │   │           ├── tlm-stats-modal-v2/       # TLM stats v2 modal
│           │   │           │   └── components/           # Sub-components (charts, tables, filters)
│           │   │           └── quickrec-stats-modal/     # QuickRec stats modal
│           │   │               └── components/           # Sub-components
│           │   └── types/
│           │       └── cytoscape-dagre.d.ts  # TypeScript declaration for cytoscape-dagre
│           ├── assets/                    # Static assets (logos, icons)
│           └── environments/
│               ├── environment.ts         # Dev: apiUrl, tlmStatsUrl, agGridLicenseKey
│               └── environment.prod.ts    # Prod environment config
├── rectrace-tlm-stats/                    # Standalone Spring Boot service (port 8080)
│   └── src/main/java/com/citi/gru/rectrace/
│       ├── tlmstats/
│       │   ├── TlmStatsApplication.java   # Entry point
│       │   ├── config/                    # CorsConfig, DatabaseConfig
│       │   ├── controller/                # TlmStatsController, TlmStatsV2Controller, HealthController
│       │   ├── model/                     # BreakStats, AutomatchStats, ManualMatchStats, TlmInstanceConfig
│       │   │   └── v2/                    # DashboardSummary, MergedReconStats, TlmStatsRequest
│       │   ├── service/                   # TlmStatsService, TlmStatsV2Service
│       │   └── util/                      # ScriptExecutor
│       └── quickrec/
│           ├── controller/                # QuickRecStatsController
│           ├── model/                     # QuickRec DTOs
│           └── service/                   # QuickRecStatsService
└── CLAUDE.md                              # Project instructions for Claude
```

## Directory Purposes

**`backend/rectrace/src/main/java/com/citi/gru/rectrace/config/`:**
- Purpose: Spring `@Configuration` beans
- Contains: `DataSourceConfig` (primary Oracle DataSource + JPA), `AutosysDataSourceConfig` (AutoSys HikariCP DataSource), `CorsConfig`, `AsyncConfig` (thread pool for `@Async`), `ElasticsearchDevConfiguration`
- Key files: `DataSourceConfig.java`, `AutosysDataSourceConfig.java`

**`backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/`:**
- Purpose: HTTP entry points; extract headers, validate input, delegate to services
- Contains: `SearchController` (v3 API), `ExecutionOrderController`, `UserController`, `FrontendController`
- Key files: `SearchController.java`, `ExecutionOrderController.java`, `UserController.java`

**`backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/v4/`:**
- Purpose: V4 API endpoints with structured request/response DTOs
- Key files: `SearchControllerV4.java`

**`backend/rectrace/src/main/java/com/citi/gru/rectrace/service/`:**
- Purpose: Business logic services (non-search)
- Contains: `SearchConfigServiceV3`, `ExecutionOrderService`, `JobStatusService`, `SuggestionService`

**`backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v3/`:**
- Purpose: V3 search provider implementations (currently unused by frontend but still deployed)
- Contains: `SearchServiceV3`, `ElasticsearchSearchProviderV3`, `OracleSearchProviderV3`

**`backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v4/`:**
- Purpose: Active V4 search implementation
- Contains: `SearchServiceV4`, `ElasticsearchServiceV4`, `OracleServiceV4`, `SearchConfigServiceV4`

**`backend/rectrace/src/main/java/com/citi/gru/rectrace/dto/`:**
- Purpose: Plain Java objects for JSON serialization/deserialization (Jackson)
- Contains: `SearchCategoryDefinition`, `SearchCategoryConfig`, `SearchCategoryResult`, `ElasticsearchProviderConfig`, `OracleProviderConfig`, `ProviderSpecificConfig`, `ExecutionOrderDTO`, `JobStatusInfo`, `UserInfoDTO`

**`backend/rectrace/src/main/java/com/citi/gru/rectrace/dto/v4/`:**
- Purpose: V4-specific request/response DTOs using Lombok `@Builder`
- Contains: `SSRMRequestV4`, `SSRMResponseV4`, `InitialSearchResponseV4`, `CategoryConfigV4`, `CategoryResultV4`, `SearchConfigurationV4`, `ExportRequestV4`, `ColumnDefinition`, `FilterModel`, `SortModel`, `InitialFilter`

**`frontend/rectrace/src/app/services/`:**
- Purpose: All Angular HTTP client services and shared state services
- Pattern: `@Injectable({ providedIn: 'root' })` — all services are root-scoped singletons

**`frontend/rectrace/src/app/search-v5/`:**
- Purpose: Primary search feature — lazy-loaded `SearchV5Module` at route `/search`
- Contains: Module, routing module, two components (`SearchV5Component` and `SearchV5GridComponent`)

**`frontend/rectrace/src/app/custom-interactions/`:**
- Purpose: AG-Grid extensions — cell renderers and modal dialogs
- Loaded eagerly by `AppModule` (or feature module), registered with AG-Grid's `components` map

**`frontend/rectrace/src/app/custom-interactions/components/renderers/`:**
- Purpose: Custom AG-Grid `ICellRendererAngularComp` implementations
- Named by convention: `{purpose}-{type}.component.ts` or subdirectory with full component set

**`frontend/rectrace/src/app/custom-interactions/components/renderers/v2/`:**
- Purpose: V2 variants of cell renderers (newer implementations with additional features)
- Contains: `SetIdV2RendererComponent`, `ReconV2RendererComponent`, `TlmInstanceV2RendererComponent`

**`frontend/rectrace/src/app/custom-interactions/components/modals/`:**
- Purpose: `MatDialog`-based overlay components triggered from cell renderers or toolbar
- Each modal is a self-contained directory with its own sub-components for charts, tables, filters

**`frontend/rectrace/src/environments/`:**
- Purpose: Angular environment configuration
- Key values: `apiUrl` (backend base URL), `tlmStatsUrl`, `qrkStatsUrl`, `agGridLicenseKey`

## Key File Locations

**Entry Points:**
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/RectraceApplication.java`: Spring Boot main
- `frontend/rectrace/src/app/app.module.ts`: Angular root module
- `frontend/rectrace/src/app/app-routing.module.ts`: Root routing (redirects `/` to `/search`)
- `rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/TlmStatsApplication.java`: TLM Stats Spring Boot main

**Configuration:**
- `backend/rectrace/src/main/resources/application.properties`: Server port (6088), DB URLs, ES URL, search-config paths
- `backend/rectrace/src/main/resources/search-config.json`: V3 search category definitions (ES + Oracle per category)
- `backend/rectrace/src/main/resources/search-config-v4.json`: V4 search category definitions
- `frontend/rectrace/src/environments/environment.ts`: Angular dev environment (API URLs, license key)
- `frontend/rectrace/src/environments/environment.prod.ts`: Angular production environment

**Core Logic:**
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v4/SearchServiceV4.java`: Active search orchestration
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/ExecutionOrderService.java`: Execution order data assembly
- `frontend/rectrace/src/app/search-v5/components/search-v5-grid/search-v5-grid.component.ts`: AG-Grid SSRM integration
- `frontend/rectrace/src/app/services/search-v5.service.ts`: All frontend-to-backend API calls

**Testing:**
- `frontend/rectrace/src/app/services/search.service.spec.ts`: Angular service unit test (Karma/Jasmine)
- `frontend/rectrace/src/app/custom-interactions/components/modals/execution-order-graph/execution-order-graph.component.spec.ts`: Component spec
- `rectrace-tlm-stats/src/test/`: TLM Stats service test directory

## Naming Conventions

**Files (backend Java):**
- Controllers: `{Feature}Controller.java`, versioned as `{Feature}Controller{V4}.java` in a `v4/` subdirectory
- Services: `{Feature}Service.java`, providers as `{Provider}{Feature}Provider{V3}.java`
- DTOs: `{DataShape}DTO.java` for output shapes; config objects as `{Provider}ProviderConfig.java`

**Files (frontend TypeScript):**
- Services: `{feature}.service.ts` (all lowercase with hyphens)
- Components: `{feature-name}.component.ts` with matching `.html` and `.scss`
- Versioned variants: `{feature}-v2.component.ts` or placed in `v2/` subdirectory

**Directories:**
- Backend: lowercase with no separators for Java packages (`v3`, `v4`, `dto`)
- Frontend: kebab-case for all directories (`search-v5`, `custom-interactions`, `execution-order-modal`)

**Angular Modules:**
- Feature modules: `{feature}.module.ts` with routing in `{feature}-routing.module.ts`

## Where to Add New Code

**New Search Category:**
- Add entry to `backend/rectrace/src/main/resources/search-config-v4.json` with `key`, `label`, `searchColumn`, `elasticsearch`, `oracle`, and `columns`
- No Java changes needed if category follows existing ES+Oracle pattern
- If a new `cellRenderer` is needed, add to `search-config-v4.json` column def and register the component in `SearchV5GridComponent.gridOptions.components`

**New Custom Cell Renderer:**
- Create `{renderer-name}.component.ts` in `frontend/rectrace/src/app/custom-interactions/components/renderers/`
- Implement `ICellRendererAngularComp` with `agInit` and `refresh` methods
- Register in `SearchV5GridComponent.gridOptions.components` map with a string key
- Declare in `CustomInteractionsModule`
- Reference in `search-config-v4.json` column `cellRenderer` field using the string key

**New Modal Dialog:**
- Create directory under `frontend/rectrace/src/app/custom-interactions/components/modals/{feature-modal}/`
- Create `{feature}-modal.component.ts`, `.html`, `.scss`
- Use `@Inject(MAT_DIALOG_DATA)` for input data
- Open via `MatDialog.open()` from a cell renderer or toolbar button
- Add service in `frontend/rectrace/src/app/services/{feature}.service.ts` for API calls
- Declare in `CustomInteractionsModule`

**New Backend Service:**
- Create `{Feature}Service.java` in `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/`
- Create `{Feature}Controller.java` in `backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/`
- For new versioned APIs use `controller/v{N}/` and `service/v{N}/` subdirectories
- Add DTOs in `dto/` or `dto/v{N}/`

**New TLM Stats Endpoint:**
- Add method to existing `TlmStatsV2Service.java` or `TlmStatsV2Controller.java` in `rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/`
- Add corresponding Angular service method in `frontend/rectrace/src/app/services/tlm-stats-v2.service.ts`
- If a new instance is needed, update `rectrace-tlm-stats/src/main/resources/tlm-instances.json`

**Utilities:**
- Shared backend helpers: `backend/rectrace/src/main/java/com/citi/gru/rectrace/util/`
- Angular shared models: `frontend/rectrace/src/app/models/`
- Angular shared types/declarations: `frontend/rectrace/src/app/types/`

## Special Directories

**`backend/rectrace/src/main/resources/`:**
- Purpose: Classpath resources loaded at runtime
- Generated: No
- Committed: Yes — `search-config.json` and `search-config-v4.json` are the primary extension points for adding search categories

**`frontend/rectrace/src/environments/`:**
- Purpose: Build-time environment substitution
- Generated: No
- Committed: Yes — `environment.ts` contains dev config; `environment.prod.ts` for production; do not commit real license keys or credentials

**`frontend/rectrace/src/assets/`:**
- Purpose: Static assets served directly (logos, icons)
- Generated: No
- Committed: Yes

**`backend/rectrace/target/`** and **`frontend/rectrace/.angular/`** and **`frontend/rectrace/node_modules/`:**
- Purpose: Build artifacts
- Generated: Yes
- Committed: No (gitignored)

**`.planning/codebase/`:**
- Purpose: Codebase map documents consumed by GSD planning and execution commands
- Generated: Yes (by gsd-map-codebase)
- Committed: Yes

---

*Structure analysis: 2026-05-12*
