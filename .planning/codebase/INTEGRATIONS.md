# External Integrations

**Reconciled:** 2026-06-12 (supersedes the 2026-05-12 pre-modernization audit). Cross-ref: `.planning/codebase/CURRENT-STATE-2026-06-12.md`.

## APIs & External Services

**RecViz (embedded BI app — the primary external integration):**
- Separate app at `/Users/aarun/Workspace/Projects/citi/RecViz` (FastAPI + Python 3.12 on :8000; React 19 + AG-Charts/ECharts). rectrace embeds it **one-directionally via iframe** — no API exchange, no shared ES, only a shared Oracle *instance* (different schema).
- rectrace side: `frontend-react/src/search/RecvizEmbed.tsx`, `recviz/buildEmbedUrl.ts`, `recviz/recvizConfig.ts`, `recviz/RecvizDashboardModal.tsx`, renderers `TlmStatsCellRenderer` / `QuickRecStatsCellRenderer`; backend `ConfigController` `GET /api/config` → `{recvizOrigin}` from `app.recviz.origin`.
- Embed URL: `{recvizOrigin}/embed/dashboards/{id}?filter.{k}={v}&filter.lock=...&hide=...&theme=...`. The only data hand-off is URL filter params.
- `postMessage`: origin-validated `RECTRACE_THEME` (down) / `RECTRACE_IFRAME_HEIGHT` (up), never `targetOrigin:'*'`.
- **Blockers** (see CURRENT-STATE §5): RecViz CORS hardcoded (`RecViz/backend/app/main.py:219`, env var unread); `app.recviz.origin` absent from `application-*.properties`; dashboards must be seeded per env; no SSO/auth on either side; `RecvizEmbed.onError` can't detect CSP framing refusal.

**AG-Grid Enterprise:**
- React: `ag-grid-enterprise` / `ag-grid-react` **35.x**. License set via `LicenseManager.setLicenseKey(...)` in `frontend-react/src/main.tsx` **before** `ModuleRegistry.registerModules([...])` (16 modules). License key comes from build env.
- Angular (frozen): `ag-grid-angular` 32.x — being retired.

**Graph / charts:**
- React execution-order graph uses **`@xyflow/react` (React Flow) v12 + dagre** (NOT Cytoscape — that was Angular).
- Charts inside cells / dashboards are owned by RecViz (AG-Charts + ECharts), not rectrace.

## Data Storage

### Backend (`backend/rectrace`) — three Oracle datasources + Elasticsearch

- **Primary `RECTRACE` DS** (`DataSourceConfig`, `@Profile("!test")`) — explicit HikariCP. Password via `${datasource.password:}` with a `get_password.sh` script fallback.
- **`AUTOSYS` DS** (`AutosysDataSourceConfig`) — HikariCP. Password via `@Value("${autosys.db.password}")` with **no script fallback** (unlike the others — empty on a Citi VM → Hikari connection failure).
- **Read-only DS** (`ReadonlyDataSourceConfig`) — for the SQL-tab subsystem; `get_password.sh` fallback; per-statement `setMaxRows`/`setQueryTimeout`/`setFetchSize`.
- **Elasticsearch** — ES Java API Client (`co.elastic.clients.elasticsearch.ElasticsearchClient`). Index `rectrace_core_index`; the loader writes via alias `rectrace_core_alias` while search reads the concrete index. (The Boot-2.7-era `ElasticsearchDevConfiguration` SSL-bypass class was deleted in Phase 1.)
- Oracle access is JDBC-template based; JPA is wired but vestigial (only `ExecutionOrderService` uses `em.createNativeQuery`; zero `@Entity`).

### Loader (`rectrace-loader`, :6089)

- Reads Oracle, writes Elasticsearch via the alias. ShedLock-coordinated ticker, `BulkIngester`, idempotent upserts (`DocumentIdHasher`: SHA-256 of JSON-encoded configured-primaryKey values → first 8 bytes → 16 hex), run history (last 20/job), admin endpoints `/api/v4/loader-admin/*`. Owns the `loaderRunAge` health indicator.

### TLM Stats (`rectrace-tlm-stats`, :8080)

- `reconmgmt` + `recportal` Oracle DS + up to 9 lazily-created TLM instance datasources (`tlm-instances.json`). **Not deeply audited in the 2026-06-12 pass** — treat its specifics as needing re-verification.

### Local dev (sibling `../rectrace-local-dev`)

- docker-compose: Oracle `gvenzl/oracle-free:23-slim` (`1521`) + ES `8.13.4` (`9200`). `apply.py` seeds DDL + data + ES index (mapping `es/rectrace_core_index.mapping.json`: 13 `.keyword` fields @ `ignore_above:8192`, 8 completion suggesters).

### Caching / object storage

- None.

## Authentication & Identity

- No auth provider. Identity is the `x-citiportal-loginid` HTTP header, set by the upstream portal/proxy, **read for logging only — not enforced** (Phase 9 will add a Spring Security filter). Read in `SearchController`, `SearchControllerV4`, `UserController` (`required=false`).
- RecViz has **no auth of any kind**; there is no auth handoff in the embed.
- `SecurityFilterChain` is permit-all per module.

## Password Retrieval — External Script

- `/opt/rectify/control/scripts/get_password.sh` invoked at DataSource init via `ScriptExecutor`. Used by the primary + read-only backend DS and the tlm-stats DS. **Exception:** the backend `AUTOSYS` DS does NOT use it.

## Observability

- JSON logs via `logstash-logback-encoder` in `logback-spring.xml` (profile-aware Splunk HEC). Brave/Micrometer tracing; `X-Correlation-Id` adopted as the 128-bit traceId. Prometheus at `/actuator/prometheus`. Slow-query AOP. Health indicators: `oracle`, `elasticsearch`, `searchConfig` (backend); `loaderRunAge` (loader). Maven-enforcer pins the Micrometer dual-release-train.

## CI/CD & Deployment

- `.github/workflows/ops-script.yml` runs the ops-script portability smoke on Linux. `ops/` is the managed-process surface (`rectrace-ops.sh`, `components.sh`, `build.sh`, `ci-smoke.sh`), bash 3.2/4/5 portable.
- The React `dist/` is copied into the backend's `static/` (`ops/build.sh react`); the backend serves the SPA via `FrontendController` under `/rectrace/`. Production deploys one Spring Boot jar per component. See `DEPLOY.md`.

## CORS

- **Property-driven** via `app.cors.allowed-origins` (comma-separated; empty = block) in both backend services — the Boot-2.7-era wildcard `allowedOrigins("*")` and `@CrossOrigin("*")` annotations were removed. Local profile defaults to dev origins; prod/uat carry placeholders.
- **RecViz** CORS is separate and currently **hardcoded** to dev origins (see Blockers above).

## Environment Configuration (deploy)

- Backend env vars: `RECTRACE_DB_*`, `RECTRACE_ES_*`, `AUTOSYS_DB_*`, `app.recviz.origin` (→ `RECVIZ_ORIGIN_*`), `SPRING_PROFILES_ACTIVE`. Oracle wallet at `TNS_ADMIN` path; Citi CA truststore for HTTPS Oracle/ES. See `DEPLOY.md` for the full cheat sheet.
- **Watch:** `application-uat.properties:2` sets `spring.profiles.active=uat` (forbidden in Boot 3.x — fails boot if the UAT profile is activated).

---

*Integration reconciliation: 2026-06-12. Prior audit (2026-05-12) described the pre-modernization V3/Angular/Boot-2.7 state and is superseded.*
