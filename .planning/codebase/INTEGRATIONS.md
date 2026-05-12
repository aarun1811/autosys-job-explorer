# External Integrations

**Analysis Date:** 2026-05-12

## APIs & External Services

**AG-Grid Enterprise:**
- Used for server-side row model grid rendering throughout the frontend
- SDK: `ag-grid-enterprise` 32.2.2, `ag-grid-angular` 32.2.2
- License: `agGridLicenseKey` field in environment files (`frontend/rectrace/src/environments/environment.ts`)
  - Value: `'License_Value'` (placeholder — must be replaced with actual enterprise license in deployment)
- License registration: Injected via `ENVIRONMENT` provider in `frontend/rectrace/src/app/app.module.ts`

**Cytoscape.js + cytoscape-dagre:**
- Used for execution order job dependency visualization
- Integrated in `frontend/rectrace/src/app/custom-interactions/components/modals/execution-order-graph/execution-order-graph.component.ts`
- dagre plugin registered at module load via `cytoscape.use(dagre)`

**AG Charts:**
- Used for charts within grid cell renderers
- SDK: `ag-charts-angular` 10.2.0
- Registered in `frontend/rectrace/src/app/custom-interactions/custom-interactions.module.ts`

## Data Storage

### Databases — Backend (`backend/rectrace`)

**Primary Oracle DB (Rectrace schema):**
- Driver: `oracle.jdbc.OracleDriver` (ojdbc8)
- Connection: TNS-based via Oracle Wallet (`TNS_ADMIN` path in JDBC URL)
- Config properties: `datasource.url`, `datasource.username`, `datasource.service-name`, `datasource.db-schema`
- File: `backend/rectrace/src/main/resources/application.properties`
- DataSource bean: `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/DataSourceConfig.java`
- Schema: `RECTRACE`
- Password: Retrieved at startup via external shell script (see "Password Retrieval" section below)
- ORM: Hibernate with `Oracle12cDialect`, `hbm2ddl.auto=none`

**Secondary Oracle DB (Autosys schema):**
- Driver: `oracle.jdbc.OracleDriver` (ojdbc8)
- Config properties: `autosys.db.url`, `autosys.db.username`, `autosys.db.password`, `autosys.db.schema`
- File: `backend/rectrace/src/main/resources/application.properties`
- DataSource bean: `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/AutosysDataSourceConfig.java`
- Bean name: `autosysDataSource`
- Pool: HikariCP (pool name: `AutoSys-HikariCP`)
  - `maximum-pool-size=10`, `minimum-idle=5`, `connection-timeout=20000ms`
- Schema: `AUTOSYS`
- Oracle optimizations: `oracle.jdbc.ReadTimeout=60000`, `oracle.net.CONNECT_TIMEOUT=10000`
- Note: Password stored in `application.properties` directly (not script-retrieved — see CONCERNS.md)

**Elasticsearch:**
- URI: `spring.elasticsearch.uris=https://localhost:9200` (dev default)
- Auth: `spring.elasticsearch.username` / `spring.elasticsearch.password`
- File: `backend/rectrace/src/main/resources/application.properties`
- Client: Spring Data Elasticsearch (`spring-boot-starter-data-elasticsearch`)
- SSL: Dev configuration bypasses SSL certificate validation entirely
  - File: `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/ElasticsearchDevConfiguration.java`
  - Warning: `TrustStrategy` accepts all certificates; `NoopHostnameVerifier` used — this bean is active in ALL profiles, not only dev
- Search providers: `ElasticsearchSearchProviderV3` and `ElasticsearchServiceV4`

### Databases — TLM Stats (`rectrace-tlm-stats`)

**Reconmgmt Oracle DB:**
- Driver: `oracle.jdbc.OracleDriver`
- Config properties: `reconmgmt.datasource.url`, `reconmgmt.datasource.username`, `reconmgmt.datasource.service-name`, `reconmgmt.datasource.db-schema`
- File: `rectrace-tlm-stats/src/main/resources/application.properties`
- DataSource bean: `reconmgmtDataSource` in `rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/config/DatabaseConfig.java`
- JdbcTemplate bean: `reconmgmtJdbcTemplate`
- Password: Retrieved at startup via external shell script

**Recportal Oracle DB:**
- Driver: `oracle.jdbc.OracleDriver` (default)
- Config properties: `recportal.datasource.url`, `recportal.datasource.username`, `recportal.datasource.service-name`, `recportal.datasource.db-schema`
- DataSource bean: `recportalDataSource` in `DatabaseConfig.java`
- JdbcTemplate bean: `recportalJdbcTemplate`
- Password: Retrieved at startup via external shell script

**9 TLM Oracle Instances (TLM1–TLM9):**
- Instance definitions: `rectrace-tlm-stats/src/main/resources/tlm-instances.json`
- Each instance has: `instanceName`, `host`, `port` (1521), `serviceName`, `username`, `dbSchema`
- Connection creation: Lazy — `TlmJdbcTemplateFactory.getJdbcTemplate(instanceName)` creates connections on first use
- Factory bean: `tlmJdbcTemplateFactory` in `DatabaseConfig.java`
- Password: Retrieved on each new connection via external shell script

**HikariCP connection pool:**
- Config: `spring.datasource.hikari.*` in `rectrace-tlm-stats/src/main/resources/application.properties`
  - `maximum-pool-size=10`, `minimum-idle=5`, `connection-timeout=30000ms`, `idle-timeout=600000ms`, `max-lifetime=1800000ms`

### File Storage

- Local filesystem only — no object storage integration

### Caching

- None — no Redis, Memcached, or in-memory cache layer detected

## Authentication & Identity

**Auth Provider:**
- No dedicated auth provider (no OAuth2, Keycloak, LDAP, Spring Security)
- Identity propagated via HTTP request header: `x-citiportal-loginid`
  - Set by upstream portal/proxy before requests reach the backend
  - Used for audit logging only — no authorization enforcement in code

**Implementation:**
- Header read in `SearchController.java` (`backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/SearchController.java`):
  ```java
  private static final String CITI_PORTAL_LOGIN_ID_HEADER = "x-citiportal-loginid";
  String loginId = request.getHeader(CITI_PORTAL_LOGIN_ID_HEADER);
  ```
- Same pattern in `UserController.java`, `SearchControllerV4.java` (`@RequestHeader(value = "x-citiportal-loginid", required = false)`)
- Frontend services do not inject this header — it must be injected by the reverse proxy

## Password Retrieval — External Script

Both `backend/rectrace` and `rectrace-tlm-stats` retrieve Oracle passwords by executing a shell script rather than storing them in config.

**Script path:** `/opt/rectify/control/scripts/get_password.sh`
- Configured via: `password.script.path` property in `rectrace-tlm-stats/src/main/resources/application.properties`
- Hardcoded in backend: `DataSourceConfig.java` calls `scriptExecutor.executeScript("/opt/rectify/control/scripts/get_password.sh", serviceName, dbSchema)`

**Invocation — Backend:**
- Class: `backend/rectrace/src/main/java/com/citi/gru/rectrace/util/ScriptExecutor.java`
- Signature: `executeScript(String scriptPath, String serviceName, String dbSchema)`
- Args passed: `@<SERVICE_NAME>`, `<DB_SCHEMA>` (both uppercased)
- Returns: first line of stdout

**Invocation — TLM Stats:**
- Class: `rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/util/ScriptExecutor.java`
- Signature: `executeScript(String scriptPath, String... args)`
- Returns: full trimmed stdout output

**When called:**
- Backend: at DataSource bean initialization (Spring startup)
- TLM Stats reconmgmt/recportal: at DataSource bean initialization (Spring startup)
- TLM Stats TLM instances: lazily, on first `getJdbcTemplate(instanceName)` call

**Note:** The Autosys secondary Oracle DB in the backend (`autosys.db.*`) does NOT use the script — its password is stored in `application.properties` directly.

## Monitoring & Observability

**Health Endpoints — TLM Stats:**
- Spring Boot Actuator: `GET /actuator/health`, `GET /actuator/info`
- Exposed in: `rectrace-tlm-stats/src/main/resources/application.properties` (`management.endpoints.web.exposure.include=health,info`)
- Custom health endpoint: `GET /api/health` (`HealthController.java`)
- TLM-specific health: `GET /api/tlm-stats/health` (`TlmStatsController.java`)

**Logging:**
- Backend: SLF4J + Logback (Spring Boot default). Logger instances created with `LoggerFactory.getLogger(...)` or `@Slf4j` (Lombok)
- TLM Stats: SLF4J + Logback. Log levels in `application.properties`:
  - `logging.level.com.citi.gru.rectrace.tlmstats=INFO`
  - `logging.level.org.springframework.web=INFO`
  - `logging.level.org.springframework.jdbc=DEBUG`

**Error Tracking:**
- None — no Sentry, Datadog, or similar APM integration detected

## CI/CD & Deployment

**Hosting:**
- No Dockerfile, docker-compose, or `.github/` CI configuration found in the repository
- Deployment mechanism: Not captured in repository

**Build outputs:**
- Backend: `backend/rectrace/target/*.jar` (Spring Boot fat JAR)
- TLM Stats: `rectrace-tlm-stats/target/*.jar` (Spring Boot fat JAR)
- Frontend: `frontend/rectrace/dist/rectrace/` (Angular build output)
  - The backend serves the Angular SPA as static content from `classpath:/static/` via `FrontendController.java`
  - Context path: `/rectrace/`

## Internal Service-to-Service Communication

**Frontend → Backend:**
- Dev: `http://localhost:6088/api` (`frontend/rectrace/src/environments/environment.ts`)
- Prod/UAT: `/api` (relative, same-origin via reverse proxy)

**Frontend → TLM Stats:**
- Dev: `http://localhost:8080/api/tlm-stats`
- Prod/UAT: `/api/tlm-stats` (relative)
- Additional TLM Stats endpoints fronted under same base:
  - `/api/qrk-stats` (QuickRec stats — `qrkStatsUrl`)
  - `/api/di-dashboard` (DI Dashboard — `diDashboardUrl`)

**Backend API Endpoints:**
- `GET /rectrace/api/search/suggest` — Autocomplete suggestions
- `GET /rectrace/api/v3/search/keyword` — V3 keyword search
- `GET /rectrace/api/v3/search/expand` — V3 group expansion
- `POST /rectrace/api/v3/search/ssrm/{category}` — AG-Grid server-side row model
- `GET /rectrace/api/v4/search/initial` — V4 initial keyword search
- `GET /rectrace/api/execution-order/{loadJobName}` — Job dependency graph data
- `GET /rectrace/api/user/info` — Logged-in user info (reads `x-citiportal-loginid`)

**TLM Stats API Endpoints:**
- `GET /api/tlm-stats/breaks` — Break statistics
- `GET /api/tlm-stats/automatch` — Auto-match statistics
- `GET /api/tlm-stats/manual-match` — Manual match statistics
- `GET /api/tlm-stats/health` — Health check
- `POST /api/tlm-stats/v2/dashboard/breaks` — V2 break dashboard
- `POST /api/tlm-stats/v2/dashboard/recon` — V2 recon dashboard
- `GET /api/tlm-stats/v2/dashboard/summary` — V2 summary
- `GET /api/tlm-stats/v2/filters/recons` — Filter options
- `GET /api/tlm-stats/v2/filters/set-ids` — Set ID filter options
- `GET /api/quickrec-stats/*` — QuickRec statistics (via `QuickRecStatsController.java`)

## CORS Configuration

**Backend (`backend/rectrace`):**
- Allows all origins (`*`), all standard HTTP methods, all headers
- File: `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/CorsConfig.java`

**TLM Stats (`rectrace-tlm-stats`):**
- `@CrossOrigin(origins = "*")` on controller classes (`TlmStatsController.java`, `QuickRecStatsController.java`)

## Environment Configuration

**Required at runtime — Backend:**
- Oracle Wallet files accessible at path referenced in JDBC URL (`TNS_ADMIN=...`)
- `/opt/rectify/control/scripts/get_password.sh` executable
- Elasticsearch cluster reachable at `spring.elasticsearch.uris`

**Required at runtime — TLM Stats:**
- `/opt/rectify/control/scripts/get_password.sh` executable
- Oracle hosts for all configured TLM instances, reconmgmt, and recportal reachable

**Secrets location:**
- Oracle passwords: Retrieved at runtime via `/opt/rectify/control/scripts/get_password.sh` (not stored in repo)
- Exception: `autosys.db.password` is stored in `backend/rectrace/src/main/resources/application.properties` (development value — see CONCERNS.md)
- AG-Grid license: `agGridLicenseKey` in environment files (placeholder value committed)

---

*Integration audit: 2026-05-12*
