# Architecture Research

**Domain:** Enterprise three-tier modernization — net-new React shell embedding an internal app via iframe, plus a config-driven Oracle→ES loader, an arbitrary-SELECT search extension, observability cross-cutting, and a single bash ops surface — added alongside an existing Angular SPA + Spring Boot REST API + standalone TLM-stats service.
**Researched:** 2026-05-12
**Confidence:** HIGH for components and data flow; MEDIUM for the keep-vs-split decisions (calibrated to a 1–3 dev team on Citi VMs).

## Standard Architecture

### System Overview — Target State (end of milestone)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                Browser                                        │
│                                                                               │
│  ┌─────────────────────────────┐    ┌──────────────────────────────────────┐ │
│  │   Angular 16 SPA (legacy)   │    │      React + shadcn SPA (new)        │ │
│  │   /  (kept alive)           │    │      /v2  or distinct host           │ │
│  │   port 4200 in dev          │    │      port 5173 (Vite) in dev         │ │
│  │                             │    │                                       │ │
│  │   - SearchV5                │    │  ┌───────────────────────────────┐   │ │
│  │   - AG-Grid SSRM            │    │  │ Search shell + tabs (shadcn)  │   │ │
│  │   - Modals (exec order,     │    │  │ AG-Grid (ported renderers)    │   │ │
│  │     TLM stats)              │    │  │ Modal host                    │   │ │
│  │                             │    │  │                               │   │ │
│  │                             │    │  │ ┌─────────────────────────┐   │   │ │
│  │                             │    │  │ │ <iframe src="recviz/…"> │   │   │ │
│  │                             │    │  │ │  postMessage contract   │   │   │ │
│  │                             │    │  │ └─────────────────────────┘   │   │ │
│  │                             │    │  └───────────────────────────────┘   │ │
│  └──────────────┬──────────────┘    └────────────────┬─────────────────────┘ │
│                 │ HTTP (REST/JSON)                   │ HTTP (REST/JSON)       │
└─────────────────┼────────────────────────────────────┼────────────────────────┘
                  │            x-citiportal-loginid    │
       ┌──────────┴──────────────────────┬─────────────┴──────────────┐
       ▼                                 ▼                            ▼
┌──────────────────────────┐  ┌────────────────────────┐  ┌─────────────────────┐
│ backend/rectrace         │  │ rectrace-tlm-stats     │  │   recviz            │
│ Spring Boot 2.7.16       │  │ Spring Boot            │  │   (separate app,    │
│ port 6088                │  │ port 8080              │  │    not modified)    │
│                          │  │ (observability only)   │  │   embedded via      │
│ /api/v4/search/*         │  └─────────┬──────────────┘  │   iframe URL        │
│ /api/v4/search/sql/*  ◄──┤            │                 └─────────────────────┘
│   (new — config-driven   │            ▼
│    arbitrary SELECT)     │     ┌─────────────────┐
│ /api/execution-order/*   │     │ Oracle (TLM ×N) │
│ /api/user/*              │     └─────────────────┘
│ /api/health/*  (new)     │
│ /api/loader/*  (new) ─┐  │
│                       │  │
│  ┌────────────────────▼──┴─┐
│  │ ES Loader subsystem      │     (decision: lives inside backend/rectrace
│  │  - Quartz scheduler      │      as a new package, NOT a separate service.
│  │  - Job registry (config) │      See "Internal Boundaries — ES Loader.")
│  │  - SELECT→ES bulk indexer│
│  │  - Run history table     │
│  └──────────┬───────────────┘
│             │
└────────┬────┼─────────────────────┐
         ▼    ▼                     ▼
   ┌──────────┐         ┌──────────────────┐
   │ Oracle   │         │ Elasticsearch    │
   │ rectrace │         │ rectrace_core    │
   │ schema   │         │ + new indexes    │
   │ + AUTOSYS│         │   (per loader    │
   └──────────┘         │    job)          │
                        └──────────────────┘

       ┌────────────────────────────────────────────────────────────┐
       │ rectrace-ops.sh   (single bash script — laptop + Citi VM)  │
       │ ── start | stop | restart | status | logs   per-component   │
       │ ── components: backend, tlm-stats, react-dev, angular-dev,  │
       │                loader-trigger (admin)                       │
       │ ── PID files in ./run/, logs in ./logs/                     │
       └────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **React shell** (new) | Hosts search UI, recviz iframe panels, modals; mirrors recviz design language via shadcn | Vite + React 18 + TypeScript; AG-Grid React; `frontend-react/` peer to `frontend/` |
| **Recviz iframe panel** | Configurable per-tab + in-modal embedding of recviz pages | `<iframe>` with `postMessage` contract (auth handoff, height sync, navigation events) |
| **Backend search controllers** (existing, extended) | V4 search endpoints + new arbitrary-SELECT endpoint family | `controller/v4/SearchControllerV4`, add `controller/v4/SqlSearchController` |
| **SqlQueryService** (new) | Execute config-declared SELECTs with bounded resources, return rows for SSRM grid | `JdbcTemplate`, `PreparedStatement`, named parameters, fetch/maxRows/queryTimeout, dedicated bounded thread pool |
| **ES Loader subsystem** (new, inside `backend/rectrace`) | Schedule + execute Oracle→ES bulk loads; per-job index/query/cron config; run history | Quartz with JDBC JobStore in the existing Oracle schema; `BulkProcessor` (Elasticsearch RestHighLevelClient) for indexing; `LoaderConfigService` mirroring `SearchConfigServiceV4` pattern |
| **Observability layer** (cross-cutting) | Correlation IDs, structured logs, health/readiness probes, slow-query log, run-history exposure | Logback JSON encoder; Spring Boot Actuator `/actuator/health`, `/actuator/info`; MDC filter; `@Timed`/`StopWatch` for slow queries |
| **rectrace-ops.sh** (new) | Single ops surface — start/stop/restart/status/logs per component | Pure bash; PID files; portable shell (no GNU-specific flags); `kill -0` for liveness; `curl` for health |

## Recommended Project Structure

```
autosys-job-explorer/
├── backend/
│   └── rectrace/
│       └── src/main/java/com/citi/gru/rectrace/
│           ├── controller/v4/
│           │   ├── SearchControllerV4.java          # existing
│           │   ├── SqlSearchControllerV4.java       # NEW — arbitrary SELECT endpoints
│           │   └── LoaderAdminControllerV4.java     # NEW — list/trigger/status of loader jobs
│           ├── service/v4/
│           │   ├── SearchServiceV4.java             # existing
│           │   └── SqlQueryServiceV4.java           # NEW — bounded SELECT executor
│           ├── loader/                              # NEW package — ES loader subsystem
│           │   ├── LoaderApplicationConfig.java     # Quartz wiring, BulkProcessor bean
│           │   ├── LoaderConfigService.java         # parses loader-config.json (mirrors SearchConfigServiceV4)
│           │   ├── LoaderJobRegistry.java           # registers @PostConstruct Quartz jobs from config
│           │   ├── OracleToEsLoaderJob.java         # the Quartz Job — executes one job's SELECT, bulk-indexes
│           │   ├── LoaderRunHistoryService.java     # writes/reads run history rows
│           │   └── dto/
│           │       ├── LoaderJobDefinition.java
│           │       └── LoaderRunRecord.java
│           ├── observability/                       # NEW cross-cutting
│           │   ├── CorrelationIdFilter.java         # adds correlation ID to MDC + response header
│           │   ├── SlowQueryLogger.java             # AOP around JdbcTemplate operations
│           │   └── HealthIndicators.java            # custom @Component HealthIndicator beans
│           └── config/
│               ├── QuartzConfig.java                # NEW — JDBC JobStore, isClustered=false (single instance)
│               └── BulkProcessorConfig.java         # NEW — ES BulkProcessor bean
│       └── src/main/resources/
│           ├── search-config-v4.json                # existing
│           ├── sql-search-config.json               # NEW — { tabKey, sql, params[], columns[] }
│           ├── loader-config.json                   # NEW — [{ jobName, sql, esIndex, cron, batchSize }]
│           └── db/migration/
│               └── V001__quartz_tables.sql          # NEW — Quartz JDBC store DDL for Oracle
│
├── frontend/                                        # legacy Angular, untouched
│   └── rectrace/                                    # existing
│
├── frontend-react/                                  # NEW — net-new React app
│   ├── package.json                                 # Vite + React + TS + shadcn + ag-grid-react
│   ├── vite.config.ts
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── routes/                                  # React Router routes
│   │   ├── features/
│   │   │   ├── search/                              # search shell, tabs, results
│   │   │   ├── grid/                                # AG-Grid wrapper + ported renderers
│   │   │   └── recviz-embed/                        # RecvizFrame component (iframe + postMessage hook)
│   │   ├── services/
│   │   │   └── api.ts                              # fetch wrappers, header injection
│   │   ├── components/ui/                           # shadcn components
│   │   └── config/
│   │       └── recviz-tabs.json                    # which tabs render recviz iframe vs grid
│   └── .env.development                             # VITE_API_URL=http://localhost:6088/rectrace
│
├── rectrace-tlm-stats/                              # existing, untouched structurally
│   └── (observability changes only)
│
├── ops/                                             # NEW
│   ├── rectrace-ops.sh                              # the single ops script
│   ├── components.sh                                # sourced — declares each component (name, start cmd, port, health URL)
│   ├── lib/
│   │   ├── proc.sh                                  # start_bg / stop_pid / is_alive helpers
│   │   └── health.sh                                # http_health helper using curl
│   ├── run/                                         # PID files (gitignored)
│   └── logs/                                        # per-component logs (gitignored)
│
└── CLAUDE.md
```

### Structure Rationale

- **`frontend-react/` as a peer directory, not a subdir of `frontend/`:** The legacy Angular app stays as-is; the new React app is net-new and must not inherit Angular's build chain, tsconfig, or shared package.json. A peer directory keeps node_modules independent, allows different toolchains (Angular CLI vs Vite), and makes "delete Angular when done" a single `rm -rf frontend/`.
- **`loader/` as a new package inside `backend/rectrace`, NOT a separate service:** See *Internal Boundaries — ES Loader* below. The package is large enough to feel like a subsystem and is wired through Spring's normal DI, but ships in the same JAR.
- **`sql-search-config.json` separate from `search-config-v4.json`:** The SSRM `WHERE col IN (:values)` pattern in v4 search is fundamentally different from "run this whole SELECT as-is." Keeping the configs separate avoids shoehorning an arbitrary SQL config into a schema designed for column+filter searches, and lets each config evolve independently.
- **`ops/` as a top-level directory:** The ops script is a peer to backend/frontend/loader, not owned by any one of them. Components are declared in `components.sh` so adding a new process is a one-line change.
- **Quartz tables in the existing Oracle schema, not a new DB:** Avoids the ops cost of a new datasource. Quartz's 11 tables are well-scoped (`QRTZ_*` prefix) and easily auditable.

## Architectural Patterns

### Pattern 1: Iframe Embedding with `postMessage` Contract

**What:** The React shell embeds recviz as an `<iframe>`. A bidirectional `postMessage` contract handles auth handoff (CitiPortal login ID), navigation events from recviz, height sync, and ready-state. The shell never reaches into the iframe's DOM; the iframe never reaches into the shell's DOM. Only structured messages cross the boundary, and `event.origin` is validated on both ends.

**When to use:**
- Embedded app is a separate codebase you don't own structurally (recviz)
- Strong isolation is acceptable or desired (independent CSS, independent state)
- "Good enough" is shippable in a sprint, vs weeks for Module Federation

**Trade-offs:**
- **Pros:** Zero coupling to the embedded app's build/framework; survives recviz framework changes; simplest auth story (postMessage handoff); independent deploys.
- **Cons:** Cookie / third-party-cookie pain on cross-origin; height/scroll friction; can't share React context or AG-Grid licenses; double load of common deps.

**Same-origin vs subdomain vs cross-origin (decision matrix):**

| Setup | Cookie sharing | postMessage cost | Recommended when |
|-------|---------------|------------------|------------------|
| **Same origin** (`/recviz` reverse-proxied from React app's host) | Free — cookies just work | Still needed for events; `origin === self.origin` | Production deploy — use a reverse proxy (nginx/Apache) to put recviz at a path under the React host. **Recommended for Citi VM deploy.** |
| **Subdomain** (`recviz.intra.citi.net` ↔ `explorer.intra.citi.net`) | Possible if `Domain=intra.citi.net` cookie scope is set; check Public Suffix List for the parent domain | Required; cross-origin postMessage | Acceptable if both apps share a common parent that's NOT on the public suffix list |
| **Cross-origin** (different hosts entirely) | Third-party cookies blocked in modern browsers; must use postMessage-based token handoff | Required; full origin validation | Only if there's no shared deployment topology; expect auth friction |

**Auth handoff contract (recommended):**
1. React shell loads, reads `x-citiportal-loginid` from its own session.
2. React shell mounts `<iframe src="https://recviz.host/...">`.
3. React shell waits for `{ type: 'RECVIZ_READY' }` message from iframe.
4. React shell posts `{ type: 'AUTH_HANDOFF', loginId, correlationId }` with `targetOrigin` set to the recviz origin (never `*`).
5. Recviz stores the loginId in-memory (not localStorage if the iframe is cross-origin and untrusted by browser) and uses it on its API calls.
6. Recviz acks with `{ type: 'AUTH_ACK' }`. Shell now considers iframe usable.

**Height sync:** Recviz observes its document `body` size with `ResizeObserver`, posts `{ type: 'RESIZE', height }`; shell sets `iframe.style.height`. Origin check on the listener is mandatory.

**Security headers on the recviz response (must be set by recviz's hosting, not the shell):**
- `Content-Security-Policy: frame-ancestors 'self' https://explorer.intra.citi.net` — modern standard.
- `X-Frame-Options: SAMEORIGIN` is overridden by CSP `frame-ancestors` in modern browsers but include for older-browser belt-and-braces.

**Example (shell side):**
```tsx
function RecvizFrame({ src, loginId }: { src: string; loginId: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState<number>(600);
  const recvizOrigin = useMemo(() => new URL(src).origin, [src]);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== recvizOrigin) return; // origin guard — non-negotiable
      const msg = e.data;
      if (msg?.type === 'RECVIZ_READY') {
        ref.current?.contentWindow?.postMessage(
          { type: 'AUTH_HANDOFF', loginId, correlationId: crypto.randomUUID() },
          recvizOrigin // never '*'
        );
      } else if (msg?.type === 'RESIZE' && typeof msg.height === 'number') {
        setHeight(Math.min(msg.height, 4000)); // bound to prevent runaway
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [recvizOrigin, loginId]);

  return <iframe ref={ref} src={src} style={{ width: '100%', height, border: 0 }} sandbox="allow-scripts allow-same-origin allow-forms" />;
}
```

### Pattern 2: Config-Driven Arbitrary SELECT with Bounded Resources

**What:** Devs/admins declare named SELECT queries in `sql-search-config.json` (query text is static, but the *set* of queries is configurable). The backend exposes `/api/v4/search/sql/:queryKey` that runs the named query with bounded resources and SSRM-shaped output.

**When to use:**
- Search categories that don't fit the existing ES-then-Oracle-expansion pattern
- One-off reporting queries that don't justify their own controller/service
- Queries that join across tables or compute aggregates inline

**Trade-offs:**
- **Pros:** Adding a category is a config edit; no Java change; SQL is auditable in source control.
- **Cons:** Bypasses ES keyword-search speed; query authors must understand cost; harder to migrate later.

**Safety profile (this matters for the security phase but ship it correctly from day one):**

| Concern | Approach |
|---------|----------|
| **SQL injection from end users** | NOT a risk by construction — users never write SQL. The SELECT text is static-in-config, version-controlled, and only changes via PR. |
| **SQL injection from config authors** | Out of scope — config authors are devs/admins with repo write access. They could already deploy malicious code. |
| **End-user filter parameters** | Use `NamedParameterJdbcTemplate` and bind every user-supplied filter as a JDBC parameter. Never string-concat user input into the SQL. The config schema should declare expected parameter names + types. |
| **Query timeout** | Set per-call via `JdbcTemplate.setQueryTimeout(seconds)` is unsafe on a singleton bean (race condition). Instead, use `PreparedStatementCreator` to set timeout on the statement itself. Default 30s, configurable per-query in `sql-search-config.json`. |
| **Row cap** | Always wrap the configured SELECT in a pagination layer (Oracle: `OFFSET ... FETCH NEXT ... ROWS ONLY` in 12c+). Hard ceiling (e.g., 10,000 rows total per call) enforced by SqlQueryService even if config doesn't specify. |
| **ResultSet streaming** | Set `JdbcTemplate.setFetchSize(500)` so the JDBC driver doesn't materialize the entire result set in memory. Iterate with `RowCallbackHandler` and emit incrementally. |
| **Statement validation** | At startup, parse each configured SQL with a lightweight check: must start with `SELECT`/`WITH`, no `;`, no `--` outside string literals, no `INSERT/UPDATE/DELETE/MERGE/DROP/ALTER/GRANT/REVOKE`. Reject app startup if validation fails — fail fast. |
| **Connection isolation** | Loader writes and search reads share the same datasource — that's fine, but consider a dedicated `JdbcTemplate` bean for ad-hoc SELECTs with a smaller pool ceiling so a runaway SELECT can't starve the rest of the app. |
| **Read-only transaction** | Run inside `@Transactional(readOnly = true, propagation = REQUIRES_NEW)` so Oracle can optimize and any accidental DML throws. |

**Example (service skeleton):**
```java
@Service
public class SqlQueryServiceV4 {
  private final NamedParameterJdbcTemplate jdbc;
  private final SqlSearchConfigService config;

  @Transactional(readOnly = true, propagation = REQUIRES_NEW)
  public SsrmPage execute(String queryKey, Map<String,Object> params, int startRow, int endRow) {
    SqlQueryDef def = config.require(queryKey);          // resolves named SQL + declared params
    String paginated = wrapWithPagination(def.sql(), startRow, endRow);
    int timeoutSec = def.timeoutSeconds().orElse(30);
    int maxRows = def.maxRows().orElse(10_000);

    return jdbc.execute(paginated, new MapSqlParameterSource(params), (PreparedStatementCallback<SsrmPage>) ps -> {
      ps.setQueryTimeout(timeoutSec);
      ps.setFetchSize(500);
      ps.setMaxRows(maxRows);
      try (ResultSet rs = ps.executeQuery()) {
        return readRows(rs, def.columns());
      }
    });
  }
}
```

### Pattern 3: Quartz JDBC JobStore Inside the Existing Backend

**What:** The ES loader runs as Quartz jobs inside `backend/rectrace`. Jobs are declared in `loader-config.json` (jobName, SQL, ES index, cron); at startup, `LoaderJobRegistry` reconciles the config against Quartz's stored jobs (add new, update changed cron, remove deleted). Quartz uses a JDBC JobStore in the existing Oracle schema for run state and history.

**When to use:**
- Single backend instance (matches current Citi VM deployment)
- Need to survive restarts mid-execution (job state persisted)
- Want a manual trigger API (`POST /api/loader/jobs/:name/trigger`) and run-history visibility

**Trade-offs vs `@Scheduled` vs separate service:**

| Option | Pros | Cons | Verdict for this milestone |
|--------|------|------|-----------------------------|
| `@Scheduled` in backend | Zero new dependencies; trivial to add | No persistence across restarts; no run history; no manual trigger; no per-job pause/resume | **Reject** — operability requirements (run history, manual trigger) need more than annotations |
| **Quartz JDBC store in backend** | Persistence, history, manual trigger, per-job config; one deployable; reuses existing Oracle | New library; 11 new tables; isClustered=false acceptable for one VM | **Recommended** — best fit for 1–3 devs on a single VM |
| Separate loader service | Independent scaling; failures don't crash search | Two deployables, two log streams, two PID files for ops script, two health endpoints, extra config for ES + Oracle, harder local dev | **Reject for now** — split later if loader load grows or backend memory pressure shows up |

**Loader job lifecycle:**
```
loader-config.json (committed)
        │
        ▼
LoaderConfigService.load()  @PostConstruct
        │
        ▼
LoaderJobRegistry.reconcile()  — diff against QRTZ_JOB_DETAILS / QRTZ_TRIGGERS
        │   add new | update cron | delete removed
        ▼
Quartz Scheduler — fires OracleToEsLoaderJob per trigger
        │
        ▼
OracleToEsLoaderJob.execute(ctx)
        │  1. record run start → LOADER_RUN_HISTORY
        │  2. open Oracle cursor with fetchSize=1000, queryTimeout=N
        │  3. BulkProcessor.add(IndexRequest) per row → ES (batch flush at 5k or 5MB)
        │  4. on completion: record run end (rows, duration, ES errors)
        ▼
LOADER_RUN_HISTORY table (queryable via /api/loader/runs)
```

**Example (Quartz config):**
```java
@Configuration
public class QuartzConfig {
  @Bean
  public SchedulerFactoryBean scheduler(DataSource ds, ApplicationContext ctx) {
    var f = new SchedulerFactoryBean();
    f.setDataSource(ds);
    f.setApplicationContext(ctx);
    f.setJobFactory(new AutowiringSpringBeanJobFactory(ctx)); // lets jobs @Autowire
    var props = new Properties();
    props.put("org.quartz.jobStore.class", "org.springframework.scheduling.quartz.LocalDataSourceJobStore");
    props.put("org.quartz.jobStore.driverDelegateClass", "org.quartz.impl.jdbcjobstore.oracle.OracleDelegate");
    props.put("org.quartz.jobStore.isClustered", "false"); // single VM
    props.put("org.quartz.scheduler.instanceId", "AUTO");
    props.put("org.quartz.threadPool.threadCount", "4");
    f.setQuartzProperties(props);
    return f;
  }
}
```

### Pattern 4: Single Bash Ops Script — Component Registry Style

**What:** One script (`ops/rectrace-ops.sh`) dispatches to subcommands (`start | stop | restart | status | logs`). Each subcommand operates over a registry of components declared in `ops/components.sh`. Each component declares: name, working dir, start command, port, and health URL.

**Process supervision approach — picked deliberately:**

| Option | Why we don't use it for this script |
|--------|-------------------------------------|
| systemd unit files | Linux-only; doesn't run on macOS laptop |
| supervisord | Extra runtime dependency (Python); overkill for 4–5 processes; not pre-installed on Citi VMs typically |
| nohup + PID files (recommended) | POSIX-portable; no dependencies; trivially understandable; macOS + RHEL identical behavior |
| docker-compose | Adds container surface; doesn't match the "run on laptop and VM" simplicity bar |

**Standard structure:**
```bash
# rectrace-ops.sh — entrypoint
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=components.sh
source "$SCRIPT_DIR/components.sh"
source "$SCRIPT_DIR/lib/proc.sh"
source "$SCRIPT_DIR/lib/health.sh"

cmd="${1:-}"; target="${2:-all}"
case "$cmd" in
  start)   for c in $(components "$target"); do start_component "$c"; done ;;
  stop)    for c in $(components "$target"); do stop_component  "$c"; done ;;
  restart) "$0" stop "$target"; "$0" start "$target" ;;
  status)  for c in $(components "$target"); do status_component "$c"; done ;;
  logs)    tail_logs "$target" ;;
  *)       usage; exit 64 ;;
esac
```

**components.sh — the registry (one source of truth):**
```bash
declare -A COMPONENTS=(
  [backend]="dir=backend/rectrace cmd='mvn spring-boot:run' port=6088 health=/rectrace/actuator/health"
  [tlm-stats]="dir=rectrace-tlm-stats cmd='mvn spring-boot:run' port=8080 health=/actuator/health"
  [angular]="dir=frontend/rectrace cmd='npm start' port=4200 health=/"
  [react]="dir=frontend-react cmd='npm run dev' port=5173 health=/"
)
```

**Portability rules baked in:**
- Use `#!/usr/bin/env bash`, not `/bin/sh` — Citi VMs are RHEL, laptop is macOS (which has bash 3.x by default — test on bash 3.2 OR require bash 5 via Homebrew explicitly).
- No GNU-only flags: avoid `date -d`, `readlink -f`, `mktemp --tmpdir`. Use POSIX equivalents.
- Status check is two-stage: (1) PID file alive via `kill -0 $pid 2>/dev/null`, (2) HTTP health via `curl -fsS --max-time 3 "http://localhost:$port$health"`. Status reports `running-healthy`, `running-unhealthy`, `dead-pidfile`, or `stopped`.
- Idempotency: `start` of a running component is a no-op + warning; `stop` of a stopped component is a no-op + warning; `restart` sequences stop→start with a bounded wait loop on the health URL.

### Pattern 5: Observability Cross-Cut (lightweight)

**What:** Three additive layers in the existing Spring Boot apps, no new infrastructure.

1. **Correlation IDs.** `CorrelationIdFilter` reads `X-Correlation-Id` header (or generates UUID), pushes to SLF4J MDC, echoes back in response. React shell forwards the ID into iframe via the auth-handoff postMessage so iframe→recviz→backend calls keep the same ID.
2. **Structured logs.** Switch Logback encoder to JSON (`logstash-logback-encoder`) including MDC fields. No log aggregator picked yet (deferred) but the format is forward-compatible with ELK/Splunk/Loki.
3. **Health/readiness.** Enable Spring Boot Actuator `/actuator/health` with custom `HealthIndicator` beans for: Oracle reachability, ES reachability, last loader run age, search config validity.

**Trade-off:** This is the minimum-viable observability. Slow-query log, metrics export, and tracing are explicitly deferred — flagged in PITFALLS.

## Data Flow

### Request Flow — React shell → arbitrary-SELECT search

```
User clicks "Foo SQL tab"
        ↓
React SearchPage  →  api.fetchSqlSearch('foo-sql', filters, startRow, endRow)
        ↓
GET /api/v4/search/sql/foo-sql?startRow=0&endRow=100&filters=...   (x-citiportal-loginid, X-Correlation-Id)
        ↓
SqlSearchControllerV4.run(queryKey, ...)
        ↓
SqlQueryServiceV4.execute(queryKey, params, startRow, endRow)
        ↓                                          ↑
  NamedParameterJdbcTemplate + PreparedStatement   │  bounded: queryTimeout, maxRows, fetchSize
        ↓                                          │  read-only transaction
   Oracle (rectrace schema)                        │
        ↓                                          │
   ResultSet → rows[] → SsrmPage{rows, lastRow} ──┘
        ↓
JSON response → AG-Grid SSRM datasource → grid render
```

### Request Flow — React shell → recviz iframe

```
User clicks "Recviz tab"
        ↓
React RecvizFrame mounts <iframe src="https://recviz-host/page?...">
        ↓
recviz loads, posts { type:'RECVIZ_READY' } to parent
        ↓
Shell validates event.origin === recvizOrigin
        ↓
Shell posts { type:'AUTH_HANDOFF', loginId, correlationId } targetOrigin=recvizOrigin
        ↓
recviz applies loginId to its own API calls → recviz backend
        ↓
recviz posts { type:'RESIZE', height } as content grows
        ↓
Shell setIframeHeight(height)   (bounded to ≤ 4000px)
```

### Loader Flow — Oracle → ES (scheduled)

```
Quartz trigger fires (per cron from loader-config.json)
        ↓
OracleToEsLoaderJob.execute(ctx)
        ↓
LoaderRunHistoryService.recordStart(jobName, correlationId)  →  LOADER_RUN_HISTORY (Oracle)
        ↓
JdbcTemplate.query(def.sql, RowCallbackHandler)
        │   fetchSize=1000, queryTimeout=def.timeoutSec
        ↓
   per row → BulkProcessor.add(IndexRequest(esIndex, docId, source))
        ↓
   BulkProcessor flushes at 5MB / 5000 actions / 5s
        ↓
   ES bulk response → count successes/failures
        ↓
LoaderRunHistoryService.recordEnd(rowsRead, rowsIndexed, errors, durationMs)
        ↓
Operator queries:  GET /api/loader/runs?job=foo  →  recent runs JSON
```

### State Management (React shell)

```
URL (React Router)  ←─ source of truth for: active tab, search keyword
        ↓
React Router state  →  drives  SearchPage component tree
        ↓
TanStack Query (recommended)  ←→  api.ts  ←→  backend
        │
        ├── caches per-tab results
        ├── revalidates on focus
        └── shares cache between grid and detail views

Component-local state (useState) for:
  - grid filters/sorts (then synced into AG-Grid SSRM request)
  - modal open/close
  - iframe handshake status
```

### Key Data Flows

1. **Search → display:** React → backend search controller → ES (initial) → Oracle (SSRM expansion) → AG-Grid. Identical shape to current Angular flow; only the client changes.
2. **Arbitrary SELECT → display:** React → `SqlSearchControllerV4` → `SqlQueryServiceV4` → Oracle (bounded) → AG-Grid SSRM. New endpoint family; same SSRM contract.
3. **Recviz integration:** React iframe ↔ recviz via `postMessage`. Backend not involved beyond providing the `loginId` to the shell.
4. **Scheduled load:** Quartz trigger → OracleToEsLoaderJob → Oracle cursor → ES BulkProcessor → run history. Pure backend-internal flow; no user request.
5. **Ops control:** `rectrace-ops.sh start|stop|status` → reads `components.sh` → manages PID files + health probes. No network flow.
6. **Observability:** Every flow above carries a correlation ID via MDC; logs are JSON; health is queryable via Actuator.

## Scaling Considerations

| Scale | Architecture adjustments |
|-------|--------------------------|
| **Current (single VM, 1–3 devs, internal users)** | Everything in one backend JAR; Quartz `isClustered=false`; AG-Grid SSRM handles per-tab data volume; loader run-history retention 90 days. **No changes needed for this milestone.** |
| **2× usage / multi-VM HA** | Flip Quartz `isClustered=true` (it already uses JDBC store); put backend behind a load balancer; ensure session affinity is NOT required (current design has no server-side session); React shell is statically served, trivially scales. |
| **Loader load grows materially (>10 jobs, >1M rows/run)** | Split loader into its own service (`backend/rectrace-loader`) — package boundaries already isolate it. Quartz config moves with it. Backend search service no longer competes for thread pool or memory with bulk ES indexing. |
| **Cross-region** | Out of scope. |

### Scaling Priorities

1. **First bottleneck likely:** Backend memory during loader bulk indexes. Mitigated by `BulkProcessor` (flushes incrementally) + `fetchSize` on the SELECT cursor. Detection: heap growth correlated with loader runs.
2. **Second bottleneck:** Oracle query timeouts on arbitrary-SELECT tab. Mitigated by per-query `queryTimeout` + `maxRows`. Detection: `SQLException` with ORA-01013 logged with correlation ID.
3. **Third bottleneck:** ES indexing latency lagging Oracle source-of-truth. Detection: `LOADER_RUN_HISTORY` duration trend climbing. Mitigation: tune batch size, parallelize loader jobs (Quartz thread pool already supports this).

## Anti-Patterns

### Anti-Pattern 1: Splitting the ES loader into a service before there's a reason

**What people do:** "It's a different concern — make it a microservice."
**Why it's wrong:** Doubles the ops surface (two PID files, two log streams, two health endpoints, two restart commands, two heap sizes to tune), splits the Oracle schema across two apps, and complicates local dev — for a team of 1–3.
**Do this instead:** Ship it as a package inside `backend/rectrace`. Keep the package boundary clean (no leakage of loader types into search code) so the eventual split is mechanical when load justifies it.

### Anti-Pattern 2: Treating the iframe as if it's part of the React tree

**What people do:** Reach into `iframe.contentDocument` from React; share Redux/Zustand store; mount React components into iframe DOM.
**Why it's wrong:** Cross-origin breaks it entirely; same-origin "works" but creates invisible coupling that breaks the day someone moves recviz to a different host. Defeats the point of choosing iframe over Module Federation.
**Do this instead:** All communication goes through the `postMessage` contract. Define every message type up front; document them in `recviz-embed/messages.ts`; treat the iframe as a black box.

### Anti-Pattern 3: Setting `queryTimeout` on the singleton `JdbcTemplate`

**What people do:** Call `jdbc.setQueryTimeout(30)` once at config time.
**Why it's wrong:** `JdbcTemplate` is a singleton bean. Setting state on it affects every parallel thread. There's no per-call isolation.
**Do this instead:** Set timeout on the `PreparedStatement` inside a `PreparedStatementCallback`. The setting lives on the statement, not the template — see `SqlQueryServiceV4` example in Pattern 2.

### Anti-Pattern 4: Allowing the configured SQL to be anything that parses

**What people do:** Trust the dev who wrote the config; execute the SQL as-is.
**Why it's wrong:** A typo or copy-paste from a SQL Developer session can land `DELETE` in config. Even with read-only DB users, a config-driven Bobby Tables is one PR-review-mishap away.
**Do this instead:** Startup-time guard: reject any configured SQL that isn't `SELECT`/`WITH`, contains `;`, contains DDL/DML keywords outside of string literals. Fail application startup — not at first request — so the failure is loud.

### Anti-Pattern 5: One bash script that grows tentacles

**What people do:** Start with `rectrace-ops.sh start backend`, end up with 800 lines mixing process logic, log parsing, deploy steps, and DB migrations.
**Why it's wrong:** Becomes a second codebase nobody owns.
**Do this instead:** Limit scope to start/stop/status/restart/logs. Anything else (deploy, migrate, backup) is a separate script invoked by humans, not folded into the ops surface. Components registry in `components.sh` is the only thing that should change as the system grows.

### Anti-Pattern 6: Big-bang React rewrite phase

**What people do:** Spend three months building all of the React app, then cut over.
**Why it's wrong:** Long-running branches diverge; the Angular app keeps mutating; the cut-over becomes a high-risk event; no production feedback during the rewrite.
**Do this instead:** Strangler-fig — see *Build Order* below. Vertical slices ship to users behind a feature flag or URL prefix; Angular keeps serving everything the React app hasn't yet replaced.

## Integration Points

### External Services

| Service | Integration pattern | Notes |
|---------|---------------------|-------|
| **Oracle (rectrace schema)** | Existing `DataSourceConfig`; add Quartz tables; add bounded `JdbcTemplate` for ad-hoc SELECTs | Same DB user for now; security phase to introduce a read-only user for arbitrary-SELECT |
| **Oracle (AUTOSYS schema)** | Existing `AutosysDataSourceConfig`; no changes | Conditional bean; loader does NOT touch this |
| **Elasticsearch** | Existing `RestHighLevelClient`; new `BulkProcessor` bean for loader | Same cluster; new indexes per loader job |
| **recviz** | iframe + `postMessage` contract | We do not modify recviz; coordinate frame-ancestors header with recviz team |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| **React shell ↔ backend** | HTTP/JSON; same endpoints as Angular consumes today; `x-citiportal-loginid` + `X-Correlation-Id` headers | Add `/api/v4/search/sql/*` and `/api/loader/*` endpoint families |
| **React shell ↔ recviz iframe** | `postMessage` only; strict origin validation | Message catalog in `recviz-embed/messages.ts` |
| **Search code ↔ Loader code** (inside backend) | None at runtime — they share only the Oracle DataSource and ES client beans | Different packages; loader has its own controller, service, dto subpackages |
| **Loader code ↔ Observability** | Loader emits structured logs with MDC; HealthIndicator queries loader run-history table | Loader is a citizen of the observability layer, not a special case |
| **Ops script ↔ everything** | Process lifecycle (PID) + HTTP health (port + path) | Ops never imports application code; uses only `kill -0` and `curl` |
| **ES Loader → Search (data path)** | Loader writes ES indexes; search reads them | Decoupled — search code doesn't know loader exists. New indexes appear in `search-config-v4.json` after a loader job has populated them at least once. |

## Build Order — Recommended Phase Decomposition

This is the most consequential question for the roadmap. **Recommendation: vertical-slice first, then horizontal sweeps for cross-cutting concerns.** Foundation-first is rejected because there's nothing useful to validate until something ships end-to-end.

### Phase A — Foundation slice (thin)

Minimum scaffolding so subsequent slices can land without re-doing setup.
- `frontend-react/` scaffold: Vite + React + TS + shadcn + AG-Grid React + TanStack Query + React Router.
- `ops/rectrace-ops.sh` initial version with backend, tlm-stats, angular components registered. React component added once frontend-react has `npm run dev`.
- `CorrelationIdFilter` in backend. **Just** the filter, not full observability sweep.

**Rationale:** Don't over-build. The point is to be able to add features in slices.

### Phase B — First vertical slice: search-only React tab

Pick one search category, port end-to-end to React.
- React search page + AG-Grid SSRM datasource → existing `/api/v4/search/*` endpoints.
- One port of an existing custom renderer.
- Angular still default route; React behind `/v2` or a feature URL.

**Rationale:** Proves React + AG-Grid + backend integration with zero new backend code. Discovers shadcn/Tailwind friction early.

### Phase C — Second vertical slice: recviz iframe tab

Wire up recviz integration end-to-end on one tab.
- `RecvizFrame` component with full postMessage contract (auth handoff, height sync, navigation events).
- `recviz-tabs.json` config telling the React app which tab is iframe vs grid.
- Coordinate with recviz team on `frame-ancestors` header and message contract docs.

**Rationale:** Recviz is the highest-uncertainty integration — surface origin/auth/CSP issues as early as possible, not at the end.

### Phase D — Backend extension: arbitrary SELECT

Net-new backend feature; doesn't depend on React phases.
- `SqlSearchControllerV4` + `SqlQueryServiceV4` + `sql-search-config.json` + startup validation guard.
- One example configured query end-to-end (Angular grid can also consume it — useful for validation).
- React shell adopts the new endpoint family once it exists; Angular app can optionally consume it for sanity-check.

**Rationale:** Can be developed in parallel with Phase B/C by a different dev. No frontend dependency.

### Phase E — ES Loader subsystem

The biggest single new package. Depends on nothing else functionally.
- Quartz config + JDBC store DDL (Oracle migration).
- `LoaderConfigService`, `LoaderJobRegistry`, `OracleToEsLoaderJob`, `LoaderRunHistoryService`.
- `LoaderAdminControllerV4` for list/trigger/run-history.
- One configured loader job end-to-end (Oracle → ES → verify in Kibana / ES query).

**Rationale:** Self-contained subsystem; can be built parallel to React work by a different dev. The hardest part is the runtime ergonomics (config reconciliation, run history visibility), not the Quartz wiring.

### Phase F — Observability sweep (horizontal)

After enough features exist to have something to observe.
- Logback JSON encoder in both backend and tlm-stats.
- Custom `HealthIndicator` beans (Oracle, ES, loader, search config).
- Slow-query AOP around `JdbcTemplate`.
- Confirm correlation ID flows shell → backend → loader run-history.

**Rationale:** Cross-cutting work is most valuable when there are multiple subsystems to instrument. Doing this last (within this milestone) avoids re-doing it as new features land.

### Phase G — Search-bug-hyphen, design-shadcn polish, ops-script hardening

Cleanup / polish. Defer to the end where possible.
- Hyphen bug: ES analyzer/mapping fix (likely a `keyword` subfield + custom analyzer).
- shadcn theme alignment with recviz.
- Ops script edge cases: race conditions on start, log rotation.

### Why this order (vs alternatives)

| Alternative | Why rejected |
|-------------|--------------|
| **Foundation-first (all infra, then features)** | Burns weeks of "scaffolding" without user feedback. Risk of building wrong abstractions. |
| **Thick horizontal layer first (all observability, then all React, then all loader)** | Each phase blocks the next; no shippable increment until late. Doesn't fit 1–3 dev parallelism. |
| **All-React-first then all-backend** | Backend work (arbitrary SELECT, loader) is independent of React work; serializing wastes parallelizable time. |
| **All-backend-first then all-React** | Same problem in reverse; React risk (shadcn + recviz iframe) discovered late. |

The vertical-slice order delivers a working end-to-end React + recviz tab in 2 phases, parallelizes the backend phases (SELECT and Loader) against the frontend phases, and lands the cross-cutting observability sweep when there's actually something to observe.

## Sources

- [Iframes and Communicating Between Applications — DEV](https://dev.to/damcosset/iframes-and-communicating-between-applications-31k5)
- [The Frontend Auth Middleware: Cross-Origin Iframes Without Third-Party Cookies](http://seg6.space/posts/the-frontend-auth-middleware/)
- [Build Micro-Frontends with iFrames and postMessages](https://blog.adeeshsharma.com/micro-fe-with-iframes-and-postmessages)
- [Using Message Events to Resize an IFrame — This Dot Labs](https://www.thisdot.co/blog/using-message-events-to-resize-an-iframe)
- [Same-origin policy — MDN](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy)
- [Content Security Policy `frame-ancestors`](https://content-security-policy.com/frame-ancestors/)
- [X-Frame-Options — MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Frame-Options)
- [OWASP Clickjacking Defense Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Clickjacking_Defense_Cheat_Sheet.html)
- [Spring Boot Scheduling Best Practices](https://dev.to/dixitgurv/spring-boot-scheduling-best-practices-503h)
- [Spring Scheduling: @Scheduled vs Quartz — JavaThinking](https://www.javathinking.com/blog/spring-scheduling-scheduled-vs-quartz/)
- [Quartz Scheduler with Spring Boot — Spring Boot Reference](https://docs.spring.io/spring-boot/reference/io/quartz.html)
- [Quartz JDBC JobStore Clustering Configuration](https://www.quartz-scheduler.org/documentation/quartz-2.3.0/configuration/ConfigJDBCJobStoreClustering.html)
- [Spring Boot + Quartz Scheduler in Cluster mode — DEV](https://dev.to/hronom/spring-boot-quartz-scheduler-in-cluster-mode-35ej)
- [JdbcTemplate Javadoc — Spring Framework](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/jdbc/core/JdbcTemplate.html)
- [Per-Statement QueryTimeout for JdbcTemplate — spring-projects issue](https://github.com/spring-projects/spring-framework/issues/26326)
- [How to Timeout JDBC Queries — Codelooru](https://www.codelooru.com/2017/02/how-to-timeout-jdbc-queries.html)
- [Linux Job Control: nohup, disown — Baeldung](https://www.baeldung.com/linux/job-control-disown-nohup)
- [Strangler Fig Pattern — Migration & Decomposition](https://softwarepatternslexicon.com/microservices-boundaries-and-service-decomposition/migration/the-strangler-pattern/)
- [The Strangler-Fig Pattern for Legacy Angular — JS in Plain English](https://javascript.plainenglish.io/the-strangler-fig-pattern-my-favourite-way-to-upgrade-legacy-angular-projects-761fcc727ed1)
- [Strategies for migrating from Angular to ReactJS — Makers Den](https://makersden.io/blog/angular-to-react-migration-strategies)

---
*Architecture research for: enterprise three-tier modernization (React shell + iframe embed + Oracle→ES loader + arbitrary SELECT + observability + bash ops)*
*Researched: 2026-05-12*
