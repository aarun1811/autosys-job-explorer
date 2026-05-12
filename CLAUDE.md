# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Autosys Job Explorer is a three-tier enterprise application for exploring and managing Autosys job information:
- **Backend** (`backend/rectrace`): Spring Boot 2.7.16 REST API with Elasticsearch and Oracle DB
- **Frontend** (`frontend/rectrace`): Angular 16 SPA with AG-Grid Enterprise
- **TLM Stats Service** (`rectrace-tlm-stats`): Standalone Spring Boot service for TLM statistics

## Essential Commands

### Backend Development
```bash
cd backend/rectrace

# Build and package
mvn clean install

# Run application
mvn spring-boot:run

# Run without tests (tests are currently skipped by default)
mvn clean install -DskipTests

# Application runs on http://localhost:6088
```

### Frontend Development
```bash
cd frontend/rectrace

# Install dependencies
npm install

# Development server (http://localhost:4200)
npm start

# Production build
npm run build

# Run tests
npm test
```

### TLM Stats Service
```bash
cd rectrace-tlm-stats

# Build and run
mvn clean install
mvn spring-boot:run

# Service runs on http://localhost:8080
```

## Architecture and Key Patterns

### Backend Architecture
- **Search Configuration**: Dynamic JSON-based search categories in `src/main/resources/search-config.json`
- **Multi-Provider Search**: Supports both Elasticsearch and Oracle queries through provider interfaces
- **API Structure**: 
  - `/api/v3/search/*` - Main search endpoints with SSRM support
  - `/api/execution-order/*` - Job dependency visualization
  - `/api/user/*` - User management
- **Key Services**: 
  - `SearchServiceV3` - Orchestrates search across providers
  - `ExecutionOrderService` - Manages job dependencies
  - `SearchConfigServiceV3` - Handles dynamic search configuration

### Frontend Architecture
- **State Management**: Service-based state management using RxJS
- **Grid Integration**: AG-Grid Enterprise with server-side row model
- **Custom Components**:
  - Cell renderers in `custom-interactions/components/renderers/`
  - Modal dialogs for execution order and TLM stats
- **Search Flow**: SearchComponent → SearchService → Backend API → Grid Display

### Database Connections
- Backend uses Oracle with configurable Elasticsearch
- TLM Stats connects to multiple Oracle instances (configured in `tlm-instances.json`)
- Password retrieval via external scripts for security

## Development Notes

### Testing
- Backend: Maven tests are skipped by default (`maven.test.skip=true`)
- Frontend: Karma/Jasmine tests available via `npm test`

### Key Configuration Files
- Backend: `application.properties`, `search-config.json`
- Frontend: `environment.ts`, `environment.prod.ts`
- TLM Stats: `application.properties`, `tlm-instances.json`

### Common Tasks
- **Add new search category**: Update `search-config.json` with category definition
- **Add custom grid renderer**: Create component in `custom-interactions/components/renderers/`
- **Modify API endpoints**: Update controllers in backend and corresponding services in frontend

### Important Patterns
- All APIs expect `x-citiportal-loginid` header for user context
- Search results use AG-Grid's server-side row model for performance
- Execution order visualization uses Cytoscape.js with dagre layout
- Error responses follow standardized format with status, error_type, and message

<!-- GSD:project-start source:PROJECT.md -->
## Project

**Rectrace**

Rectrace is an internal enterprise web application at Citi for exploring and managing Autosys job information. Users search and visualize Autosys job metadata, dependencies, and TLM statistics pulled from Oracle databases and Elasticsearch.

The system today is a three-tier stack — Spring Boot 2.7.16 REST API (`backend/rectrace`), an Angular 16 SPA with AG-Grid Enterprise (`frontend/rectrace`), and a standalone Spring Boot TLM stats service (`rectrace-tlm-stats`) — developed on a laptop and deployed to Citi VM servers.

The current milestone is a modernization initiative: stand up a **new React frontend** mirroring the design and patterns of an existing internal app called **recviz**, embed recviz views inside the app via a configurable iframe/micro-frontend pattern, fix outstanding search bugs, and improve operability, observability, and Citi-domain security posture. The existing Angular app stays in place during the React build-out; the React app is **net-new**, not a rewrite.

**Core Value:** Users can quickly find Autosys jobs and understand their dependencies and TLM statistics through a unified, performant, design-consistent UI.

### Constraints

- **Tech stack — backend**: Spring Boot 3.2.x (LTS-style), Java 17 (or 21 if VM supports). Upgrade lands as BOOT-UPGRADE phase; all subsequent backend work targets 3.x.
- **Tech stack — new frontend**: React, with **shadcn** as the design system, mirroring recviz's design language and structural patterns.
- **Integration — recviz**: Embedded as iframe / micro-frontend. We do not modify recviz.
- **Deployment**: Citi VM servers (Linux). Single bash script is the operations surface.
- **Security**: Citi domain integration is required for production. User-side auth (CitiPortal headers / SiteMinder / SPNEGO) and service-side auth (Kerberos keytab / Vault) deferred to the security phase but must be resolved before "done."
- **Development environment**: macOS laptop; all tooling must run locally without a Citi VM.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- Java 17 - Backend (`backend/rectrace`) and TLM Stats (`rectrace-tlm-stats`) services
- TypeScript 5.5 - Frontend SPA (`frontend/rectrace/src/`)
- HTML/SCSS - Angular component templates and stylesheets
## Runtimes
- JVM 17 (configured via `<java.version>17</java.version>` in `backend/rectrace/pom.xml`)
- JVM 17 (configured via `<java.version>17</java.version>` in `rectrace-tlm-stats/pom.xml`)
- Node.js (version not pinned — no `.nvmrc` or `.node-version` present)
- Target: ES2022 (set in `frontend/rectrace/tsconfig.json`)
## Package Managers
- Maven (Spring Boot Maven Plugin via `spring-boot-starter-parent`)
- Lockfile: Not applicable (Maven uses `pom.xml`)
- npm
- Lockfile: `frontend/rectrace/package-lock.json` (present)
## Frameworks
### Backend (`backend/rectrace`)
- Spring Boot 2.7.16 - Web application framework (`backend/rectrace/pom.xml`)
- Spring Data JPA - ORM layer for Oracle (`spring-boot-starter-data-jpa`)
- Spring Data Elasticsearch - Elasticsearch integration (`spring-boot-starter-data-elasticsearch`)
- Spring MVC - REST controllers (`spring-boot-starter-web`)
- Spring Boot Maven Plugin - Executable JAR packaging
### TLM Stats (`rectrace-tlm-stats`)
- Spring Boot 2.7.16 - Web application framework (`rectrace-tlm-stats/pom.xml`)
- Spring Data JPA - ORM for Oracle data sources
- Spring Boot Actuator - Health and info endpoints (`spring-boot-starter-actuator`)
- Spring Boot DevTools - Hot reload in development (`scope: runtime`)
- Spring Boot Maven Plugin - Executable JAR packaging
### Frontend (`frontend/rectrace`)
- Angular 18.2.14 - SPA framework (`frontend/rectrace/package.json`)
- RxJS 7.8 - Reactive state and async handling
- Angular Material 18.2.14 - Dialog, button, and icon components (`@angular/material`)
- Angular CDK 18.2.14 - Overlay and layout primitives (`@angular/cdk`)
- Material Icons 1.13.14 - Icon font
- AG-Grid Enterprise 32.2.2 - Server-side row model grid (`ag-grid-enterprise`)
- AG-Grid Angular 32.2.2 - Angular integration (`ag-grid-angular`)
- AG Charts Angular 10.2.0 - Charts within grid cells (`ag-charts-angular`)
- Cytoscape.js 3.31.1 - Job dependency graph (`cytoscape`)
- cytoscape-dagre 2.5.0 - Directed acyclic graph layout plugin (`cytoscape-dagre`)
- Karma 6.4 - Test runner (`frontend/rectrace/package.json`)
- Jasmine 5.1 - Test framework and assertions
- karma-chrome-launcher 3.2 - Chrome browser launcher
- karma-coverage 2.2 - Coverage reporting
- Config: `frontend/rectrace/karma.conf.js` (generated by Angular CLI)
- Angular CLI 18.2.14 (`@angular/cli`)
- @angular-devkit/build-angular 18.2.14 - Build toolchain
- ng-packagr 18.2.1 - Library packaging for `rec-shared-lib`
- TypeScript 5.5 - Compiler
## Key Dependencies
### Backend (`backend/rectrace`)
- `ojdbc8` (Oracle JDBC) - Primary Oracle database driver
- `oraclepki` 21.5.0.0 - Oracle PKI for wallet-based authentication (`com.oracle.database.security`)
- `osdt_core` / `osdt_cert` 21.5.0.0 - Oracle security dependencies for wallet support
- `spring-boot-starter-data-elasticsearch` - Elasticsearch search provider
- HikariCP - Connection pooling for Autosys Oracle datasource (bundled with Spring Boot)
- Lombok - Boilerplate reduction (annotations, logging via `@Slf4j`)
- Apache POI `poi-ooxml` / `poi` 5.2.3 - Excel export (`XSSFWorkbook` used in `SearchServiceV4.java`)
- Jackson Databind - JSON parsing for search config (`SearchConfigServiceV3.java`)
### TLM Stats (`rectrace-tlm-stats`)
- `ojdbc8` (Oracle JDBC, `scope: runtime`) - Dynamic multi-instance Oracle connections
- `jackson-databind` - Parses `tlm-instances.json` at startup
## Configuration
### Backend (`backend/rectrace`)
- `backend/rectrace/src/main/resources/application.properties` - Base config (dev defaults)
- `backend/rectrace/src/main/resources/application-prod.properties` - Production profile
- `backend/rectrace/src/main/resources/application-uat.properties` - UAT profile
- `backend/rectrace/src/main/resources/search-config-v4.json` - Active search category definitions (V4)
- `backend/rectrace/src/main/resources/search-config.json` - Legacy search config (V3, kept for reference)
- `server.port=6088` - Backend listens on port 6088
- `spring.servlet.context-path=/rectrace` - Context path prefix
- `datasource.*` - Primary Oracle (rectrace schema) connection
- `autosys.db.*` - Secondary Oracle (Autosys schema) connection via HikariCP
- `spring.elasticsearch.uris` - Elasticsearch cluster URL
### TLM Stats (`rectrace-tlm-stats`)
- `rectrace-tlm-stats/src/main/resources/application.properties` - Base config
- `rectrace-tlm-stats/src/main/resources/tlm-instances.json` - 9 TLM Oracle instance definitions
- `server.port=8080`
- `reconmgmt.datasource.*` - Reconmgmt Oracle database
- `recportal.datasource.*` - Recportal Oracle database
- `password.script.path=/opt/rectify/control/scripts/get_password.sh`
### Frontend (`frontend/rectrace`)
- `frontend/rectrace/src/environments/environment.ts` - Development (points to `localhost:6088`, `localhost:8080`)
- `frontend/rectrace/src/environments/environment.prod.ts` - Production (relative paths)
- `frontend/rectrace/src/environments/environment.uat.ts` - UAT (same as prod, relative paths)
- `frontend/rectrace/angular.json` - Build configurations for dev/uat/production
- `frontend/rectrace/tsconfig.json` - TypeScript config with strict mode, `@env/*` path alias
- `@env/*` → `src/environments/*` (defined in `frontend/rectrace/tsconfig.json`)
## Platform Requirements
- Java 17 JDK
- Maven 3.x
- Node.js (compatible with Angular 18 — LTS 20.x recommended)
- npm
- External Oracle wallets/credentials (path: `/Users/arun/Workspace/Keys/Wallet_*` per dev `application.properties`)
- Password retrieval script at `/opt/rectify/control/scripts/get_password.sh`
- Java 17 JRE
- Oracle Wallet files accessible on server
- `/opt/rectify/control/scripts/get_password.sh` present and executable
- Elasticsearch cluster accessible at configured URI
- Backend serves frontend static files from `classpath:/static/` — Angular build output must be deployed there
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Module Overview
- `backend/rectrace` — Spring Boot 2.7.16, Java 17
- `frontend/rectrace` — Angular 18 (package.json declares `^18.2.14`), TypeScript 5.5, SCSS
- `rectrace-tlm-stats` — Spring Boot 2.7.16, Java 17
## Backend (backend/rectrace)
### Package Naming
- `com.citi.gru.rectrace.controller` — REST controllers (v4 variant lives in `.controller.v4`)
- `com.citi.gru.rectrace.service` — business logic services (v3 variants in `.service.v3`, v4 in `.service.v4`)
- `com.citi.gru.rectrace.dto` — data transfer objects (v4 variants in `.dto.v4`)
- `com.citi.gru.rectrace.config` — Spring configuration classes
- `com.citi.gru.rectrace.constants` — application-wide constants
- `com.citi.gru.rectrace.util` — utility classes
### Naming Patterns
- Controllers: `<Domain>Controller` (e.g., `SearchController`, `ExecutionOrderController`)
- Versioned controllers: `<Domain>ControllerV4` in sub-package `controller.v4`
- Services: `<Domain>Service` or `<Domain>ServiceV3` / `<Domain>ServiceV4`
- DTOs: `<Domain>DTO` (e.g., `ExecutionOrderDTO`, `UserInfoDTO`); v4 DTOs use descriptive names without `DTO` suffix (e.g., `SSRMRequestV4`, `CategoryResultV4`)
- Config classes: `<Domain>Config` (e.g., `AsyncConfig`, `CorsConfig`)
- Constants: `AppConstants` (utility class — private constructor, throws `UnsupportedOperationException`)
- camelCase throughout
- Controller methods: descriptive verb phrases (`getExecutionOrder`, `performInitialSearch`, `fetchSSRMData`)
- Private helpers: prefixed intent (`createDefaultOracleConfig`, `filterDataByVisibleColumns`, `deduplicateData`)
- camelCase
- Constants: `static final` UPPER_SNAKE_CASE (e.g., `CITI_PORTAL_LOGIN_ID_HEADER`)
- Logger: `private static final Logger logger = LoggerFactory.getLogger(ClassName.class)`
### Controller Pattern
### Error Response Format
- `TlmStatsController` — `backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/SearchController.java`
- `TlmStatsV2Controller` — `rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/controller/TlmStatsV2Controller.java`
- `QuickRecStatsController` — `rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/quickrec/controller/QuickRecStatsController.java`
### DTO Pattern
- Jackson annotations used selectively: `@JsonInclude(Include.NON_NULL)` to suppress null fields; `@JsonProperty("snake_case_name")` for API field naming
- Nested static classes for sub-objects (e.g., `ExecutionOrderDTO.JobNodeDTO`, `ExecutionOrderDTO.JobDetailsDTO`)
- Example: `backend/rectrace/src/main/java/com/citi/gru/rectrace/dto/v4/SSRMRequestV4.java`
### Service Pattern
- Annotated `@Service`
- Constructor injection with `@Autowired` on constructor (v3); field `@Autowired` (v4)
- Logger via SLF4J: `LoggerFactory.getLogger(ClassName.class)` (v3); Lombok `@Slf4j` shorthand as `log.xxx(...)` (v4)
- Async methods: `@Async("taskExecutor")` returning `CompletableFuture<T>`
- Config loaded `@PostConstruct` in config services
### Logging
## TLM Stats Service (rectrace-tlm-stats)
### Package Naming
- `com.citi.gru.rectrace.tlmstats.controller` — REST controllers
- `com.citi.gru.rectrace.tlmstats.service` — business logic
- `com.citi.gru.rectrace.tlmstats.model` — data models (v2 variants in `.model.v2`)
- `com.citi.gru.rectrace.tlmstats.config` — configuration
- `com.citi.gru.rectrace.tlmstats.util` — utilities
- `com.citi.gru.rectrace.quickrec.controller` — QuickRec-specific controllers
- `com.citi.gru.rectrace.quickrec.service` — QuickRec-specific services
- `com.citi.gru.rectrace.quickrec.model` — QuickRec data models
### Model Pattern
- Default constructor + all-args constructor
- `@JsonProperty("snake_case_name")` on all fields for JSON serialization
- Manual getters/setters
- `toString()` override
- Example: `rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/model/BreakStats.java`
### Controller Pattern
## Frontend (frontend/rectrace)
### Angular Version
### Component Structure
### Cell Renderer Pattern
- `execution-order-button.component.ts` — opens `ExecutionOrderModalComponent`
- `app-id-cell-renderer.component.ts` — simple app ID display
- `app-support-cell-renderer.component.ts` — support contact display
- `set-id-cell-renderer.component.ts` — legacy set ID
- `recon-cell-renderer.component.ts` — legacy recon
- `v2/set-id-v2-renderer.component.ts` — opens `TlmStatsModalV2Component`; QuickRec rows render plain text
- `v2/recon-v2-renderer.component.ts` — opens `TlmStatsModalV2Component`; QuickRec rows render plain text
- `v2/tlm-instance-v2-renderer.component.ts` — TLM instance display
- `recon-id-renderer/recon-id-renderer.component.ts` — opens `QuickRecStatsModalComponent` (QuickRec entry); uses external template/stylesheet (`.css`, not `.scss`)
- `rec-portal-id-renderer/rec-portal-id-renderer.component.ts` — portal ID display
### SCSS Migration Pattern
- `recon-id-renderer.component.ts` still references `styleUrls: ['./recon-id-renderer.component.css']`
### CSS Variable / Theming Pattern
### RxJS Service Pattern
### `x-citiportal-loginid` Header
### Search Config Pattern
### Module Declarations Pattern
### Naming Conventions
### Import Organization
### Error Handling
## Comments and Documentation
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## System Overview
```text
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
- Every search category is backed by Elasticsearch for fast keyword lookup and Oracle for full detail retrieval
- Search category definitions (columns, ES index config, Oracle query) live entirely in JSON config files, not Java code
- The frontend uses AG-Grid's Server-Side Row Model (SSRM) to lazy-load and paginate data on demand
- RxJS `Subject` + `takeUntil` pattern for all Angular service subscriptions and lifecycle cleanup
- `x-citiportal-loginid` HTTP header is the sole authentication/identity mechanism across all tiers
## Layers
- Purpose: HTTP request handling, header extraction, input validation
- Location: `backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/`
- Contains: `SearchController`, `SearchControllerV4`, `ExecutionOrderController`, `UserController`, `FrontendController`
- Depends on: Service layer
- Used by: Angular frontend (HTTP)
- Purpose: V3 search orchestration with async parallel execution across ES categories
- Location: `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v3/`
- Contains: `SearchServiceV3`, `ElasticsearchSearchProviderV3`, `OracleSearchProviderV3`
- Depends on: `SearchConfigServiceV3`, `RestHighLevelClient`, `DataSource`
- Used by: `SearchController`
- Purpose: V4 search orchestration with `CompletableFuture.runAsync` parallel ES lookup and Oracle SSRM
- Location: `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v4/`
- Contains: `SearchServiceV4`, `ElasticsearchServiceV4`, `OracleServiceV4`, `SearchConfigServiceV4`
- Depends on: `search-config-v4.json`, `RestHighLevelClient`, `DataSource`
- Used by: `SearchControllerV4`
- Purpose: Load, parse, and validate `search-config.json` at application startup; serve typed configs to search providers
- Location: `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/SearchConfigServiceV3.java`
- Contains: `SearchConfigServiceV3` (v3), `SearchConfigServiceV4` (v4)
- Depends on: Jackson `ObjectMapper`, classpath resources
- Used by: All search providers
- Purpose: Typed data transfer between layers and JSON serialization
- Location: `backend/rectrace/src/main/java/com/citi/gru/rectrace/dto/`
- Contains: `SearchCategoryDefinition`, `ElasticsearchProviderConfig`, `OracleProviderConfig`, `ExecutionOrderDTO`, `JobStatusInfo`; V4 variants in `dto/v4/`
- Purpose: External script execution for password retrieval
- Location: `backend/rectrace/src/main/java/com/citi/gru/rectrace/util/ScriptExecutor.java`
- Contains: `ScriptExecutor` — invokes `/opt/rectify/control/scripts/get_password.sh` at startup for datasource credentials
- Purpose: HTTP communication and shared state via `BehaviorSubject`
- Location: `frontend/rectrace/src/app/services/`
- Contains: `SearchServiceV5`, `ExecutionOrderService`, `TlmStatsService`, `TlmStatsV2Service`, `QuickRecStatsService`, `UserService`, `ThemeService`
- Depends on: `HttpClient`, `environment.ts` for base URLs
- Purpose: UI rendering and user interaction
- Location: `frontend/rectrace/src/app/search-v5/`, `frontend/rectrace/src/app/custom-interactions/`
## Data Flow
### Primary Search Request Path (V4)
### SSRM Grid Data Load Path
### Execution Order Graph Path
- No NgRx/Redux; component-local state with service-injected `Observable` streams
- `ThemeService` uses `BehaviorSubject<Theme>` for app-wide dark/light mode
- Search state (term, results, selected tab) lives in `SearchV5Component`
- AG-Grid expanded group state tracked in `SearchV5GridComponent.expandedGroupIds: Set<string>`
- User login ID stored in `localStorage` after first retrieval from `/api/user/info`
## Key Abstractions
- Purpose: Defines a search category with both ES and Oracle configuration in a single JSON entry
- Examples: `backend/rectrace/src/main/resources/search-config.json`, `backend/rectrace/src/main/resources/search-config-v4.json`
- Pattern: `searchProviderType` field discriminates between `ElasticsearchProviderConfig` and `OracleProviderConfig` via Jackson `@JsonSubTypes`; an additional sibling `oracleConfig` field allows a category to have both ES (for keyword lookup) and Oracle (for group expansion)
- Key DTO: `backend/rectrace/src/main/java/com/citi/gru/rectrace/dto/SearchCategoryDefinition.java`
- Purpose: Connects AG-Grid's server-side row model to the backend paginated Oracle queries
- Implementation: `SearchV5GridComponent.createSSRMDatasource()` — implements `IServerSideDatasource`
- Request shape: `SSRMRequestV4` with `initialFilter` (ES pre-filter values), `groupKeys`, `startRow`, `endRow`, `sortModel`, `filterModel`, `visibleColumns`
- Purpose: Declarative column definitions, ES index config, Oracle query template per category — no code changes needed to add/modify categories
- V3 config: `backend/rectrace/src/main/resources/search-config.json`
- V4 config: `backend/rectrace/src/main/resources/search-config-v4.json`
- Column definitions in config include `cellRenderer` references (string keys) that map to registered AG-Grid components
- Purpose: AG-Grid column-level interactive components (links, buttons, external system deep-links)
- Registered by string key in `SearchV5GridComponent.gridOptions.components`
- Examples: `executionOrderButtonRenderer` → `ExecutionOrderButtonComponent`, `appIDCellRenderer` → `AppIDCellRendererComponent`
## Entry Points
- Location: `backend/rectrace/src/main/java/com/citi/gru/rectrace/RectraceApplication.java`
- Context path: `/rectrace` (all API endpoints are at `/rectrace/api/...` in production)
- Key routes:
- Location: `frontend/rectrace/src/app/app.module.ts`
- Default route: `/` redirects to `/search` (lazy-loaded `SearchV5Module`)
- Routing: `frontend/rectrace/src/app/app-routing.module.ts`
- Location: `rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/TlmStatsApplication.java`
- Key routes:
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
### getRowId uses timestamp + random for uniqueness
## Error Handling
- Backend controllers: `try/catch` wrapping service calls, return `{ status: "error", error_type, message, timestamp }` on failure
- `SearchServiceV3`/`V4`: Return empty result sets on exception; log at ERROR level with full stack trace
- Frontend: RxJS `catchError` in suggestion stream returns `of([])`; grid datasource calls `params.fail()` on error; `subscribe({ error })` handler sets `errorMessage` for display
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
