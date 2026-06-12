# Codebase Concerns

**Analysis Date:** 2026-05-12
**Last reviewed:** 2026-05-18 — CRITICAL items 1-4 closed; "STATUS" markers added inline.

> **2026-06-12 reconciliation** (see `.planning/codebase/CURRENT-STATE-2026-06-12.md`): the modernization, now merged to `main`, closed most of the HIGH/MEDIUM **backend** items below even where they aren't individually marked:
> - **Backend tests skipped** → CLOSED Phase 0 (`maven.test.skip` removed; suites run).
> - **Spring Boot 2.7.x EOL** → CLOSED Phase 1 (now Boot 3.5.14 / Java 21, jakarta).
> - **Primary Oracle DS lacks pool** → CLOSED Phase 1 (explicit HikariCP, 4 named pools).
> - **`AppConstants` empty** → CLOSED Phase 1 (populated; header constants centralized).
> - **Parallel V3 + V4 APIs** → CLOSED Phase 1 (V3 controllers/services/providers deleted).
> - **`hibernate.show_sql=true`** → CLOSED Phase 1 (off in prod/uat).
> - **`System.err` / `printStackTrace`** → CLOSED Phase 7 (routed through SLF4J).
>
> **All MEDIUM/LOW items scoped to the Angular app** (`frontend/`: V1 renderers, `console.log`, `: any`, Cytoscape, dark-mode TODO) are **MOOT** — Angular is frozen and slated for deletion.
>
> **Still open:** `x-citiportal-loginid` is logged-not-enforced (Phase 9); `AutosysDataSourceConfig` has no `get_password.sh` password fallback (empty on a Citi VM); ES SSL re-enable + Citi CA truststore (Phase 9); AG-Grid license is a build-time value in React `main.tsx`. **New (Boot 3.x):** `application-uat.properties:2` sets `spring.profiles.active=uat` — forbidden in a profile-specific file; fails boot if the UAT profile is activated. The four CRITICALs remain CLOSED.

---

## CRITICAL

### Plaintext Database Password in Version-Controlled Properties File

**STATUS:** CLOSED 2026-05-18 — value externalized to `${AUTOSYS_DB_PASSWORD:}` env var in `backend/rectrace/src/main/resources/application.properties:32`. User confirmed the previously committed literal was a placeholder, not a live credential, so no rotation needed. The local profile retains a dev-only literal in `application-local.properties` per LOCAL-DEV scope.

**Area:** Backend configuration
- Issue: `autosys.db.password` is set to a real-looking plaintext password in the default `application.properties`. The file is not `.gitignored`.
- Files: `backend/rectrace/src/main/resources/application.properties` (line 29)
- Impact: Anyone with read access to the repo (or git history) has the production Autosys DB credential.
- Fix approach: Remove value entirely. Use Spring's externalized configuration (`${AUTOSYS_DB_PASSWORD}` env var), a secrets vault (HashiCorp Vault / AWS Secrets Manager), or `.env` files outside version control. Rotate the credential immediately.

---

### Elasticsearch SSL Validation Bypassed — No Profile Guard

**STATUS:** CLOSED — `ElasticsearchDevConfiguration.java` was deleted during the Boot 3.5.14 / ES Java API Client migration in Phase 1. No replacement equivalent exists. Re-audit if any new SSL-bypass code is introduced in Phase 9.

**Area:** Backend security configuration
- Issue: `ElasticsearchDevConfiguration` disables all SSL certificate validation and hostname verification. It is annotated only `@Configuration` — there is **no** `@Profile("dev")` annotation. It will activate in all Spring environments unless the class is explicitly excluded.
- Files: `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/ElasticsearchDevConfiguration.java`
- Impact: Production and UAT traffic to Elasticsearch is unprotected against MITM attacks. The class logs explicit warnings but cannot prevent production activation.
- Fix approach: Add `@Profile("dev")` to the class, or replace the whole approach with proper truststore configuration via `spring.elasticsearch.ssl.*` properties per environment.

---

### SQL Injection via Unsanitized Column Names in ORDER BY

**STATUS:** CLOSED 2026-05-18 — `ColumnNameWhitelist.forCategory(config)` (new) validates every client-supplied column name (sort `colId`, filter keys, `visibleColumns`, `rowGroupCols`) and every sort direction at the entry to `OracleServiceV4.fetchSSRMData`. `IllegalArgumentException` surfaces as 400 Bad Request (already wired in `SearchControllerV4:67-69`). 23 new tests cover the closure (`ColumnNameWhitelistTest`, `OracleServiceV4SqlInjectionTest`). The V3 reference is moot — V3 service classes were deleted in Phase 1.

**Area:** Backend Oracle query building
- Issue: `buildOrderByClause()` concatenates `sort.getColId()` (a client-supplied string) directly into the `ORDER BY` clause without any whitelist validation. `buildFilterClause()` similarly interpolates the `column` key from the client's filter model directly into SQL predicates. `buildGroupExpansionQuery()` in `OracleSearchProviderV3` also injects `visibleColumns` directly via `String.join`.
- Files:
  - `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v4/OracleServiceV4.java` (lines 382–392, 401–443, 460–490)
  - `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v3/OracleSearchProviderV3.java` (lines 99–110)
- Impact: A crafted `colId` or column key in the request body can inject arbitrary SQL. Values are bound with `?` for filter _values_ but not for column _names_.
- Fix approach: Validate each column name against the `CategoryConfigV4.columns` whitelist before appending it to any SQL string. Reject requests with unknown column names.

---

### CORS Configured to Allow All Origins Globally

**STATUS:** CLOSED 2026-05-18 — both `CorsConfig.java` files now bind to the `app.cors.allowed-origins` property (comma-separated explicit list). Local-profile defaults to dev origins. Prod / UAT profiles ship `[NEEDS USER REVIEW]` placeholders awaiting the Citi portal origin(s). `allowCredentials(true)` dropped in tlm-stats — auth is via the custom `x-citiportal-loginid` header, not cookies. The seven `@CrossOrigin(origins = "*")` controller annotations were removed so global config is the single source of truth.

**Area:** Backend CORS configuration
- Issue: Both backend services use `allowedOrigins("*")` / `allowedOriginPatterns("*")` across all routes with all HTTP methods.
- Files:
  - `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/CorsConfig.java` (line 15)
  - `rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/config/CorsConfig.java` (line 15)
- Impact: Any origin can call these APIs. The TLM stats config also allows `credentials: true`, which combined with wildcard origin is a CSRF escalation risk.
- Fix approach: Restrict `allowedOrigins` to the known portal origin(s). The `allowedOriginPatterns("*")` + `allowCredentials(true)` combination in TLM stats is invalid per the CORS specification and should be replaced with explicit origins.

---

## HIGH

### Backend Tests Skipped by Default

**Area:** Backend testing
- Issue: Both backend Maven projects have `<maven.test.skip>true</maven.test.skip>` set as a default property in `pom.xml`. There are zero test class files in the backend `src/test` directory. The TLM stats service has only a single context-load smoke test.
- Files:
  - `backend/rectrace/pom.xml` (line 13)
  - `rectrace-tlm-stats/pom.xml` (line 8)
  - `rectrace-tlm-stats/src/test/java/com/citi/gru/rectrace/tlmstats/TlmStatsApplicationTests.java`
- Impact: No regressions are caught by CI. Service logic including complex SQL-building, script execution, and multi-datasource wiring is completely untested.
- Fix approach: Remove `maven.test.skip` from properties; write unit tests for `OracleServiceV4.buildOrderByClause()`, `buildFilterClause()`, `ScriptExecutor`, and `ExecutionOrderService`. Add Testcontainers for Oracle integration tests.

---

### Password Retrieval via Unguarded External Shell Script

**Area:** Backend security
- Issue: `ScriptExecutor` (duplicated in both services) spawns a subprocess to retrieve DB passwords. The backend version does not use the SLF4J logger — it uses `e.printStackTrace()` (stderr). The path `/opt/rectify/control/scripts/get_password.sh` is hardcoded as a string literal in `DatabaseConfig.TlmJdbcTemplateFactory` constructor, bypassing the configurable `password.script.path` property. The script is executed at application startup for every DB connection; failures silently return an empty password and the app continues.
- Files:
  - `backend/rectrace/src/main/java/com/citi/gru/rectrace/util/ScriptExecutor.java` (line 22)
  - `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/DataSourceConfig.java` (lines 39–41)
  - `rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/config/DatabaseConfig.java` (line 177)
- Impact: On script failure the backend starts with an empty password, causing all DB queries to fail at runtime with no clear startup error. The hardcoded path cannot be overridden via configuration. The backend `ScriptExecutor` silently swallows exceptions.
- Fix approach: Propagate exceptions (throw, don't swallow) in `ScriptExecutor`. Use the `passwordScriptPath` injected field everywhere. Add a startup health check that validates DB connectivity after `DataSource` creation.

---

### Spring Boot 2.7.x — OSS EOL (November 2023)

**Area:** Dependency staleness
- Issue: Both backend services target `spring-boot-starter-parent` version `2.7.16`. The Spring Boot 2.7.x OSS support window ended November 2023.
- Files:
  - `backend/rectrace/pom.xml` (line 7)
  - `rectrace-tlm-stats/pom.xml` (line 7)
- Impact: No more security patches or bug fixes from the OSS Spring Boot 2.7 line. Using deprecated `javax.*` namespace (JEE8), Hibernate 5.x dialects, and the old Elasticsearch REST client — all of which are removed in Spring Boot 3.x. Migration requires namespace changes (`javax` → `jakarta`), Elasticsearch client API migration, and Hibernate 6 dialect names.
- Fix approach: Upgrade to Spring Boot 3.3.x LTS. Key migration: rename all `javax.persistence.*` / `javax.servlet.*` imports to `jakarta.*`. Replace `Oracle12cDialect` with `OracleDialect`. Replace `RestClientBuilderCustomizer` Elasticsearch SSL customizer with the 3.x API.

---

### No Input Validation or Rate Limiting on Search Endpoints

**Area:** Backend API security
- Issue: The search endpoints (`/api/v4/search/initial`, `/api/v3/search/ssrm/{category}`) accept unbounded query strings and request bodies with no server-side validation framework (no JSR-303 / Jakarta Validation annotations). There is no request rate limiting or authentication enforcement in code.
- Files:
  - `backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/v4/SearchControllerV4.java`
  - `backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/SearchController.java`
- Impact: Any anonymous caller (CORS is open) can submit unlimited search requests or attempt to exhaust the Oracle connection pool / Elasticsearch.
- Fix approach: Add Spring Security to enforce authentication (the portal already injects `x-citiportal-loginid`; validate it). Add `@Valid` annotations and `@NotBlank` constraints to request DTOs.

---

### Primary Oracle DataSource Lacks Connection Pool

**Area:** Backend performance / reliability
- Issue: `DataSourceConfig.dataSource()` uses `DataSourceBuilder.create()` with no HikariCP or DBCP configuration. This returns Spring Boot's default simple DataSource (backed by HikariCP defaults only if the driver is on classpath, but with no explicit pool sizing). The Autosys DataSource in `AutosysDataSourceConfig` is correctly configured with HikariCP. The TLM stats reconmgmt and recportal DataSources in `DatabaseConfig.java` also lack explicit pool configuration.
- Files:
  - `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/DataSourceConfig.java` (lines 42–48)
  - `rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/config/DatabaseConfig.java` (lines 80–88, 105–116)
- Impact: Under concurrent search load, connection starvation may occur on the primary rectrace Oracle DB without explicit pool limits.
- Fix approach: Wrap `DataSourceBuilder` with `HikariConfig` as done in `AutosysDataSourceConfig`.

---

### TLM Stats `recportal.datasource.url` Missing from application.properties

**Area:** TLM stats service configuration
- Issue: `DatabaseConfig` requires `recportal.datasource.url`, `recportal.datasource.username`, `recportal.datasource.service-name`, and `recportal.datasource.db-schema` at startup, but none of these are defined in `rectrace-tlm-stats/src/main/resources/application.properties`. The service will fail to start unless these are provided via an external config file or environment variables.
- Files:
  - `rectrace-tlm-stats/src/main/resources/application.properties`
  - `rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/config/DatabaseConfig.java` (lines 49–62)
- Impact: Fresh deployments of the TLM stats service fail at startup. No documentation exists for the required properties.
- Fix approach: Add placeholder entries with documentation comments to `application.properties`. Add a `@ConditionalOnProperty` guard or default values so the service can start without a recportal DB.

---

## MEDIUM

### AG-Grid Enterprise License Key is Placeholder in All Environments

**Area:** Frontend licensing
- Issue: `agGridLicenseKey` is set to the literal string `'License_Value'` in all three environment files (`environment.ts`, `environment.prod.ts`, `environment.uat.ts`). No code in `app.module.ts` or `core.module.ts` registers the license key with `LicenseManager.setLicenseKey()`.
- Files:
  - `frontend/rectrace/src/environments/environment.ts`
  - `frontend/rectrace/src/environments/environment.prod.ts`
  - `frontend/rectrace/src/environments/environment.uat.ts`
- Impact: AG-Grid Enterprise will display a watermark / license warning popup in production and UAT. Enterprise features (server-side row model, row grouping, Excel export) may be disabled or rate-limited by the trial license enforcement.
- Fix approach: Register a valid license in `app.module.ts` via `import { LicenseManager } from 'ag-grid-enterprise'; LicenseManager.setLicenseKey(environment.agGridLicenseKey)`. Store the real license key outside version control (injected at build time via CI env variable).

---

### Parallel V3 and V4 Search APIs Both Active

**Area:** Backend tech debt / architecture
- Issue: The backend runs two parallel sets of search services simultaneously: `SearchServiceV3` + `OracleSearchProviderV3` + `ElasticsearchSearchProviderV3` (serving `/api/v3/search/*`) and `SearchServiceV4` + `OracleServiceV4` + `ElasticsearchServiceV4` (serving `/api/v4/search/*`). Both are Spring `@Service` beans instantiated at startup.
- Files:
  - `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v3/` (3 service classes)
  - `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v4/` (3 service classes)
  - `backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/SearchController.java`
  - `backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/v4/SearchControllerV4.java`
- Impact: Duplicate code paths must be maintained in parallel. Bug fixes applied to V4 may not be applied to V3. Memory and startup time increase.
- Fix approach: Identify which API version the frontend actively uses (V5 frontend calls `/api/v4/search/*`). Deprecate and remove V3 controller, service, and search provider classes.

---

### Dead Code: V1 Cell Renderers and TLM Stats Modal Still Registered

**Area:** Frontend dead code / bundle size
- Issue: `SetIdCellRendererComponent` and `ReconCellRendererComponent` (V1 renderers) are declared in `CustomInteractionsModule` and used only by each other and by the V1 `TlmStatsModalComponent`. The V5 search grid uses only the `v2/` renderers. The original 545-line `TlmStatsModalComponent` remains registered and shipped in the bundle.
- Files:
  - `frontend/rectrace/src/app/custom-interactions/custom-interactions.module.ts` (lines 25–26, 32, 51–52, 58)
  - `frontend/rectrace/src/app/custom-interactions/components/renderers/set-id-cell-renderer.component.ts`
  - `frontend/rectrace/src/app/custom-interactions/components/renderers/recon-cell-renderer.component.ts`
  - `frontend/rectrace/src/app/custom-interactions/components/modals/tlm-stats-modal/tlm-stats-modal.component.ts` (545 lines)
- Impact: Approximately 830 lines of dead component code inflates the bundle. Any search-config entry pointing to the V1 `setIdCellRenderer` string key would silently do nothing in the V5 grid.
- Fix approach: Remove V1 renderer components and the V1 `TlmStatsModalComponent` from the module declarations and from the codebase after verifying no active search-config entry references them.

---

### Legacy `SearchService` Orphaned — No Active Consumer

**Area:** Frontend dead code
- Issue: `src/app/services/search.service.ts` wraps the old `/api/search` endpoint (V1/V2 API). It is imported only in its own spec file. No production component uses it.
- Files:
  - `frontend/rectrace/src/app/services/search.service.ts`
  - `frontend/rectrace/src/app/services/search.service.spec.ts`
- Impact: Dead code adds maintenance noise and confuses new contributors about which service to use.
- Fix approach: Delete `search.service.ts` and `search.service.spec.ts` after confirming no dynamic/lazy import exists.

---

### `hibernate.show_sql=true` Hard-Coded as Default

**Area:** Backend performance / information disclosure
- Issue: SQL logging is enabled via two mechanisms in the default profile: `spring.jpa.show-sql=true` in `application.properties` and `properties.setProperty("hibernate.show_sql", "true")` in `DataSourceConfig`. Neither is overridden in `application-prod.properties` or `application-uat.properties`.
- Files:
  - `backend/rectrace/src/main/resources/application.properties` (line 3)
  - `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/DataSourceConfig.java` (line 63)
- Impact: Every SQL statement (including queries that may echo user-supplied filter values) is printed to stdout in production. This produces verbose logs and may expose schema structure.
- Fix approach: Remove `hibernate.show_sql` from `DataSourceConfig` (it is redundant when `spring.jpa.show-sql` is set). Set `spring.jpa.show-sql=false` in prod/UAT profiles.

---

### `System.err.println` and `e.printStackTrace()` in Production Code

**Area:** Backend code quality
- Issue: `ExecutionOrderService.clobToString()` uses `System.err.println("Error reading CLOB")` (discarding the exception object). `ScriptExecutor` (backend) uses `e.printStackTrace()` in its catch block, bypassing the SLF4J logging framework configured for the rest of the service.
- Files:
  - `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/ExecutionOrderService.java` (line 153)
  - `backend/rectrace/src/main/java/com/citi/gru/rectrace/util/ScriptExecutor.java` (line 22)
- Impact: These errors do not appear in any log aggregation system; they only appear on the raw JVM stderr stream. CLOB read failures in `ExecutionOrderService` silently return empty strings for `command` and `description` fields.
- Fix approach: Replace with `logger.error("Error reading CLOB", e)` and `logger.error("Script execution failed", e)`.

---

### `clobToString` Fields Commented Out — Data Always Empty

**Area:** Backend known limitation
- Issue: In `ExecutionOrderService`, `details.setCommand()` and `details.setDescription()` are set to empty strings with the actual CLOB-to-string conversion lines commented out. The `clobToString()` method exists but is never called.
- Files: `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/ExecutionOrderService.java` (lines 112–115)
- Impact: The execution order graph details panel always shows empty `command` and `description` fields for every job, even when data exists in the database.
- Fix approach: Uncomment the two lines and test CLOB reading; the `clobToString()` method is already implemented correctly.

---

### `AppConstants` Class is Empty

**Area:** Backend architecture
- Issue: `AppConstants.java` defines a utility class with a private constructor and no constants. It is a placeholder with no content.
- Files: `backend/rectrace/src/main/java/com/citi/gru/rectrace/constants/AppConstants.java`
- Impact: Low immediate impact, but indicates constants are being defined inline (e.g., `"x-citiportal-loginid"` duplicated across `SearchController` and `UserController`) instead of referenced from a central location.
- Fix approach: Either populate `AppConstants` with shared string constants or delete the class.

---

### Frontend Tests Minimal — Near Zero Coverage

**Area:** Frontend testing
- Issue: Only 3 spec files exist across the entire frontend (`app.component.spec.ts`, `search.service.spec.ts`, `execution-order-graph.component.spec.ts`). All three test only that components/services are created (`toBeTruthy()`). No behavior, no service method coverage, no grid or modal interaction tests. Coverage threshold is not configured in `angular.json`.
- Files:
  - `frontend/rectrace/src/app/app.component.spec.ts`
  - `frontend/rectrace/src/app/services/search.service.spec.ts`
  - `frontend/rectrace/src/app/custom-interactions/components/modals/execution-order-graph/execution-order-graph.component.spec.ts`
- Impact: Frontend regressions in the 655-line `SearchV5GridComponent`, 473-line `ExecutionOrderGraphComponent`, and all modal components go undetected.
- Fix approach: Add coverage for `SearchServiceV5` HTTP methods (using `HttpClientTestingModule`), `OracleServiceV4`-driven grid data flow, and modal open/close interactions for the execution order graph.

---

### `x-citiportal-loginid` Header Not Enforced — Logging Only

**Area:** Backend authentication
- Issue: All backend controllers read `x-citiportal-loginid` for logging purposes only. The header is `required = false` in `SearchControllerV4`. Missing or spoofed header values are never validated.
- Files:
  - `backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/SearchController.java` (lines 20, 46, 68, 86)
  - `backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/v4/SearchControllerV4.java` (lines 27, 50, 90)
  - `backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/UserController.java` (lines 19, 23)
- Impact: The backend relies entirely on the upstream portal proxy to supply the header. If the API is reachable directly (which open CORS enables), any caller can supply any user ID in logs.
- Fix approach: Add Spring Security filter to reject requests with missing/empty `x-citiportal-loginid` if the API is not behind a portal proxy that enforces it.

---

## LOW

### `tlm-instances.json` Contains Only Placeholder Hostnames

**Area:** TLM stats service configuration
- Issue: `tlm-instances.json` defines 9 TLM instances (TLM1–TLM9) with placeholder hosts (`tlm1-host`, `tlm1_service`, etc.). No real values are committed.
- Files: `rectrace-tlm-stats/src/main/resources/tlm-instances.json`
- Impact: The TLM stats service starts but cannot connect to any real TLM database. This is a deployment configuration concern rather than a code defect.
- Fix approach: Document the required override mechanism (external config file, environment variable substitution, or a mounted secrets volume) in deployment runbooks. Consider reading instance configs from an external properties source rather than a bundled classpath JSON.

---

### `TlmJdbcTemplateFactory` Has a Hardcoded Script Path

**Area:** TLM stats service configurability
- Issue: The inner class `DatabaseConfig.TlmJdbcTemplateFactory` hardcodes `/opt/rectify/control/scripts/get_password.sh` in its constructor instead of using the injected `passwordScriptPath` field from the outer `DatabaseConfig` class.
- Files: `rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/config/DatabaseConfig.java` (line 177)
- Impact: If the script path is overridden via `password.script.path` property, the factory ignores the override and uses the hardcoded value.
- Fix approach: Pass `passwordScriptPath` into the `TlmJdbcTemplateFactory` constructor from `tlmJdbcTemplateFactory()` bean method.

---

### TODO Comment: Dark Mode Text Color in TLM Filters

**Area:** Frontend UI debt
- Issue: A CSS `TODO` comment exists in the TLM filters SCSS noting a dark mode text color issue in form fields.
- Files: `frontend/rectrace/src/app/custom-interactions/components/modals/tlm-stats-modal-v2/components/tlm-filters-v2/tlm-filters-v2.component.scss` (line 19)
- Impact: Dark mode users may see illegible text in TLM filter form fields.
- Fix approach: Apply `color: var(--mat-form-field-input-text-color)` or the equivalent CSS custom property for dark mode form field text.

---

### `console.log` Statements in Production Frontend Code

**Area:** Frontend code quality
- Issue: 16 `console.log` / `console.error` statements remain in production component files. Several are informational logs (e.g., `'Data copied to clipboard'`, `'Cytoscape graph loaded'`, `'QuickRec modal closed'`).
- Files (representative):
  - `frontend/rectrace/src/app/search-v5/components/search-v5-grid/search-v5-grid.component.ts` (lines 463, 465, 542)
  - `frontend/rectrace/src/app/custom-interactions/components/modals/execution-order-graph/execution-order-graph.component.ts` (line 274)
  - `frontend/rectrace/src/app/custom-interactions/components/renderers/rec-portal-id-renderer/rec-portal-id-renderer.component.ts` (line 75)
- Impact: Browser console noise for all users. Informational logs may expose internal state.
- Fix approach: Remove informational `console.log` calls. Replace error logging with a centralized Angular error handler service.

---

### Widespread Use of `any` Type in Frontend

**Area:** Frontend type safety
- Issue: 58 occurrences of `: any` across the frontend TypeScript codebase. The `search-v5-grid.component.ts` alone contains 21 `any`-typed declarations (`gridApi: any`, `gridColumnApi: any`).
- Files:
  - `frontend/rectrace/src/app/search-v5/components/search-v5-grid/search-v5-grid.component.ts` (lines 46–47)
- Impact: Reduces TypeScript's ability to catch runtime errors at compile time. AG-Grid 32 provides full typed API (`GridApi<TData>`) that should replace `any`.
- Fix approach: Replace `gridApi: any` with the typed `GridApi` import from `ag-grid-community`. Replace untyped `Map<String, Object>` response mappings with explicit interfaces.

---

### Typo in Log Message: "statusses"

**Area:** Backend code quality
- Issue: `ExecutionOrderService` logs `"skipping live job statusses fetch"` (double 's').
- Files: `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/ExecutionOrderService.java` (line 134)
- Impact: Cosmetic only; affects grep-ability of logs.
- Fix approach: Correct to `"statuses"`.

---

*Concerns audit: 2026-05-12*
