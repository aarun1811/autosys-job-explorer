# Stack Research

**Domain:** Enterprise internal web app — net-new React SPA + additive Spring Boot 2.7 backend features (scheduled ingest, observability, micro-frontend embed)
**Researched:** 2026-05-12
**Confidence:** HIGH for React/build/data layer (Context7-verified). MEDIUM for embed/observability/scheduler (Context7 + verified web sources; some choices are policy-dependent on Citi infra).

Scope is limited to the **NEW** stack pieces called out in the milestone. The existing Angular 18 SPA, AG-Grid Enterprise license, Cytoscape graph, and core Spring Boot 2.7.16 + Oracle + Elasticsearch stack are NOT re-evaluated — they remain in place as per `.planning/PROJECT.md` constraints.

---

## Section A — New React Frontend (REACT-MIGRATION, DESIGN-SHADCN)

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **React** | `19.2.x` | UI framework | Stable; Actions, `useOptimistic`, `use()`, ref-as-prop now baseline. shadcn/ui Tailwind v4 templates ship with React 19. |
| **TypeScript** | `5.6.x` (avoid jumping to TS 6 until ecosystem catches up) | Type system | Strict typing is non-negotiable for an enterprise app porting from a strict Angular codebase. `moduleResolution: "bundler"` required by Vite. |
| **Vite** | `7.x` (stable, mature) — Vite 8 is GA but introduces Rolldown as default; defer until shadcn/Tailwind/plugin ecosystem confirmed working on Citi air-gapped Verdaccio mirror | Build tool / dev server | Standard 2026 React SPA build tool. Native ESM dev server, instant HMR, `import.meta.env` for environment config maps cleanly to existing `environment.ts` pattern. |
| **@vitejs/plugin-react** | `4.3.x` (matches Vite 7) | React Fast Refresh + JSX transform | Official React integration for Vite. SWC variant (`@vitejs/plugin-react-swc`) is faster but the Babel-based default has wider plugin compatibility — recommend default unless build times hurt. |
| **Node.js** | `20.18 LTS` or `22.x LTS` (pin in `.nvmrc`) | Build/dev runtime | Vite 7 requires Node 20+. 22 is "Active LTS" through 2027; 20 is "Maintenance LTS." Pin via `.nvmrc` since existing repo has no Node version file (gap called out in `.planning/codebase/STACK.md:170`). |

**Why not Vite 8 (yet):** Vite 8 swaps esbuild for Rolldown as the default bundler. Net-positive long-term but: (1) shadcn/ui v4 install templates currently target Vite 6/7; (2) air-gapped Verdaccio mirrors may lag the latest Rolldown native binaries; (3) plugin compatibility for `@tanstack/router-plugin` and `@tailwindcss/vite` should be re-validated. Lock to Vite 7 for this milestone; revisit at next milestone.

### Routing

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| **TanStack Router** | `1.114+` | Type-safe client routing, search-param state | 100% type-safe routes; first-class search params (the existing app already has URL sync — see `SearchV5Component`); built-in code splitting via file-based routes; integrates natively with TanStack Query. Default choice in 2026 for non-SSR React SPAs. |
| `@tanstack/router-plugin` | matches router | Vite plugin for file-based routes | Generates `routeTree.gen.ts`; eliminates manual route registration. |

**Why not React Router v7:** It works fine, but it has shifted toward being a Remix-style full-stack framework (loaders, actions, SSR), which is overhead we don't need. TanStack Router's search-param ergonomics are materially better for a search-heavy app like this. Keep React Router as the fallback if the team has prior React Router experience and doesn't want the new learning curve — note it under "Alternatives Considered."

### State Management

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| **TanStack Query (React Query)** | `5.90+` | Server state, caching, request dedup, retries | Standard 2026 data-fetching layer. Replaces all the bespoke RxJS `BehaviorSubject` plumbing in the Angular app (`search-v5.service.ts`, `execution-order.service.ts`, etc.). Cache keys give us SSRM-style page caching for free; mutations + invalidation handle the "refresh after action" flow. |
| **Zustand** | `5.0.x` | Tiny client-only state (theme, sidebar, user identity, last-selected tab) | ~1 KB, no Provider boilerplate, hook-based selectors, native TS. We do **not** need Redux. Existing app already uses lightweight `BehaviorSubject` patterns — Zustand is the direct equivalent. |
| `nuqs` | `2.x` | URL-synced query params (search term, active tab, sort) | Optional but recommended. TanStack Router handles search params at the route level; `nuqs` is useful for cross-cutting params not tied to a route. Use only if needed. |

**Critical rule:** Server data → TanStack Query (NEVER Zustand). Client/UI state → Zustand. Form state → React Hook Form. URL state → TanStack Router search params (or `nuqs`).

**Why not Redux Toolkit:** Too much boilerplate for the actual needs of this app. There's no complex cross-component server cache or time-travel-debug requirement. RTK Query is fine but TanStack Query has a larger ecosystem and better React 19 alignment.

**Why not Jotai/Recoil:** Both are valid, but Zustand is the simplest mental model and matches what the team already does in Angular (services with subjects). Optimize for portability of patterns, not novelty.

### Data Fetching / HTTP

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| **Native `fetch`** | platform | HTTP transport | All modern browsers + Node 20+ ship `fetch`. No need for `axios`. |
| **TanStack Query** | `5.90+` (above) | Caching, retries, dedup over fetch | See above. |
| **ofetch** *(optional)* | `1.4.x` | Thin fetch wrapper if we want auto-JSON, base URL, error throwing | Skip unless we need the ergonomics. A small ~30-line typed `apiFetch()` wrapper that injects the `x-citiportal-loginid` header and base URL is fine. |
| **Zod** | `3.23.x` | Runtime schema validation of API responses | Critical for an app that consumes backend responses with shapes that drift between v3/v4 (`SearchControllerV4`). Validate at the API boundary; downstream code gets exact types. |

**Why not Axios:** No technical advantage over `fetch` in 2026. Adds 13 KB. The only reason to use it is teams that need request/response interceptors at a global level — we get those via the wrapper function approach.

### Forms

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| **React Hook Form** | `7.55+` | Form state, validation, perf | Standard. Uncontrolled-first, integrates with Zod via `@hookform/resolvers/zod`. |
| **Zod** *(shared with API layer)* | `3.23.x` | Schema validation | Single schema for API response AND form input — DRY. |

**Why not TanStack Form:** Newer, less battle-tested. RHF is the safe enterprise pick.

### Data Grid — the AG-Grid Replacement Question

This is the highest-stakes decision in the React migration. Evidence:

| Need (from existing app) | Provided by AG-Grid Enterprise | Provided by TanStack Table | Provided by AG-Grid Community |
|--------------------------|--------------------------------|-----------------------------|-------------------------------|
| Server-Side Row Model (SSRM) | Yes (Enterprise) | NO — has `manualGrouping` and `manualPagination` flags but no SSRM equivalent for infinite-scroll group expansion | NO (Enterprise-only) |
| Row grouping with server-side aggregation | Yes (Enterprise) | Manual grouping mode + custom cell renderers — must build expand-on-demand logic yourself | NO |
| Virtualization | Built-in | Requires TanStack Virtual (separate library) | Built-in |
| Custom cell renderers | Yes | Yes (more idiomatic React via `flexRender`) | Yes |
| Excel export | Yes (Enterprise) | NO — bring your own (SheetJS / `xlsx`) | NO |
| Column pinning, resizing, reorder | Yes | Yes (headless, you wire it) | Limited |
| License cost / vendor lock | Paid enterprise license | MIT | MIT |

**Recommendation: keep AG-Grid Enterprise in the React app.**

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| **AG-Grid Enterprise** + **ag-grid-react** | `33.x` (latest) — currently on `32.2.2` in Angular app | Server-side data grid with SSRM | The existing app's SSRM + group expansion + Excel export is fundamental, not incidental. Re-implementing SSRM on top of TanStack Table costs weeks and ships less-tested code. The Enterprise license is already paid for the Angular app — switching to ag-grid-react reuses the license. **Highest-value carryover from the existing stack.** |

**When TanStack Table is the right answer:** If we ever build smaller tables that are NOT the main SSRM search results (e.g., a settings table, an audit log under 10K rows), use TanStack Table — it's lighter and renders idiomatic React JSX. So the answer is a hybrid: AG-Grid for the search grid; TanStack Table + TanStack Virtual for ancillary tables.

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `@tanstack/react-table` | `8.20+` | Headless tables for ancillary use cases | Optional but cheap to add when needed. |
| `@tanstack/react-virtual` | `3.10+` | Row/column virtualization for non-AG-Grid tables | Required if using TanStack Table for >100 rows. |

**Why not Material React Table / Mantine React Table:** They wrap TanStack Table + a specific design system. We're using shadcn (Tailwind + Radix) — those wrappers would fight the design system.

### Design System / UI Components

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| **shadcn/ui** | `3.5.x` CLI; components copied into repo (no version per se) | Component primitives (Button, Dialog, Tabs, Tooltip, Command palette, etc.) | Mandated by `DESIGN-SHADCN`. Copy-in model means we own the source — perfect for an enterprise air-gapped/Verdaccio environment with no SaaS dependency. |
| **Tailwind CSS** | `4.x` (v4) | Utility CSS engine | shadcn/ui v3+ ships with Tailwind v4 templates. CSS-first config via `@theme`; ~10x faster builds; no `tailwind.config.js`. |
| **@tailwindcss/vite** | matches Tailwind v4 | Vite plugin | Replaces the v3 PostCSS plugin. |
| **Radix UI Primitives** | latest (transitively via shadcn) | Accessibility behavior (focus trap, keyboard nav, ARIA) | Underlies every shadcn component. Battle-tested A11Y. |
| **lucide-react** | `0.460+` | Icon set used by shadcn | Tree-shakable; matches shadcn defaults. Replaces Material Icons. |
| **class-variance-authority (cva)** | `0.7.x` | Variant-based component styling | Used by every shadcn component. |
| **tailwind-merge** | `2.5.x` | Resolve conflicting Tailwind classes | Used by the `cn()` utility shadcn installs. |
| **clsx** | `2.1.x` | Conditional class concatenation | Used by `cn()`. |

**Why shadcn over Material UI / Mantine / Chakra:**
- **Owned source code** = no version-lock, no breaking-change surprises from a third-party upgrade. Critical for a Citi-air-gapped repo that may go months between dep updates.
- **No runtime CSS-in-JS** = better performance, simpler SSR story, no Emotion/styled-components tax.
- **Matches recviz** per `DESIGN-SHADCN` requirement.
- **Tailwind v4** is genuinely faster than v3 and removes the config-file ceremony.

**Why not Angular Material in the React app:** Different framework. Existing Angular Material usage stays in the Angular app and is not ported.

### Graph Visualization (for ported execution order modal)

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| **Cytoscape.js + cytoscape-dagre** | `3.30+` / `2.5+` | DAG visualization | Direct port from Angular app. Framework-agnostic. Wrap in a `useEffect`-based React component. No reason to switch to React Flow / Reaflow — Cytoscape has the dagre layout and visual styling already working. |

### Testing

| Tool | Version | Purpose | Why |
|------|---------|---------|-----|
| **Vitest** | `2.1+` | Unit/integration test runner | Native Vite integration, Jest-compatible API, faster. Replaces Karma+Jasmine from Angular world. |
| **@testing-library/react** | `16.x` | Component testing | Standard. |
| **Playwright** | `1.48+` | E2E in browser | Replaces any Karma-era browser test. Cross-browser, network mocking. |
| **MSW (Mock Service Worker)** | `2.x` | API mocking | Mock backend in tests without changing app code. |

### Dev Tooling

| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| **ESLint** | `9.x` (flat config) | Linting | Use `typescript-eslint` v8, `eslint-plugin-react-x`, `eslint-plugin-react-dom`. |
| **Prettier** | `3.3+` | Formatting | `prettier-plugin-tailwindcss` for class sorting. |
| **TypeScript ESLint** | `8.x` | TS-aware lint rules | |
| **Husky + lint-staged** | `9.x` / `15.x` | Pre-commit hooks | Optional but recommended given backend has tests disabled — frontend should not slip too. |

### Installation Cheat Sheet

```bash
# Scaffold
npm create vite@latest frontend-react -- --template react-ts
cd frontend-react

# Core
npm install react@19 react-dom@19
npm install @tanstack/react-query@5 @tanstack/react-router@1
npm install zustand@5 react-hook-form@7 zod@3
npm install ag-grid-enterprise@33 ag-grid-react@33
npm install cytoscape@3 cytoscape-dagre@2

# shadcn / Tailwind v4
npm install tailwindcss@4 @tailwindcss/vite@4
npm install class-variance-authority clsx tailwind-merge lucide-react
npx shadcn@latest init

# Dev
npm install -D vite@7 @vitejs/plugin-react@4 typescript@5.6
npm install -D @tanstack/router-plugin@1
npm install -D vitest@2 @testing-library/react@16 @testing-library/jest-dom jsdom
npm install -D eslint@9 typescript-eslint@8 eslint-plugin-react-x eslint-plugin-react-dom
npm install -D prettier@3 prettier-plugin-tailwindcss
```

---

## Section B — Embedding recviz (RECVIZ-INTEGRATION)

### Recommendation: iframe + postMessage (NOT Module Federation, NOT single-spa)

**Why iframe over Module Federation in this case:**
- recviz is a **separate app at a separate URL** with its own backend (Python). We are **not allowed to modify recviz** (per Out of Scope in PROJECT.md). Module Federation requires the embedded app to ship a federated remote bundle — we can't add that to recviz.
- iframe is the **only zero-recviz-change** integration path.
- iframe provides **hard isolation** of recviz's CSS, JS errors, and dependency conflicts from our React app. This is a feature, not a bug, for a side-by-side integration.
- 2026 consensus from web search: iframe is appropriate when hard isolation is needed and the embedded app can't be modified. Module Federation is for shared-runtime federated remotes. **Our constraint forces iframe.**

**Why not single-spa:** Same problem as Module Federation — requires recviz to register as a single-spa application. Not happening.

### Core Libraries

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| **`@open-iframe-resizer/core`** OR **`@rezonant/iframe-resizer`** | latest | Dynamic height syncing parent ↔ child | Original `iframe-resizer` is now **GPLv3 or commercial** as of v5 — incompatible with Citi internal closed-source code unless a commercial license is purchased. Two MIT-licensed forks exist: `rezonant/iframe-resizer` and `open-iframe-resizer`. Recommend **`open-iframe-resizer`** (more actively maintained as of 2025). **Confirm license clearance with Citi OSS review** before adoption. |
| **Native `window.postMessage`** | platform | Cross-frame messaging | No library needed for the wire. Use a typed wrapper. |
| **Zod** *(already in stack)* | `3.23.x` | Validate inbound messages | Critical for security — every postMessage payload must be schema-validated before use. |

**Why no third-party "micro-frontend framework":** Adding `single-spa`, `qiankun`, or `Module Federation` adds complexity and dependency surface for zero benefit in this scenario. A ~150-line typed `IframeBridge` class is sufficient.

### Patterns to Use

1. **Strict origin allow-listing.** Hardcode allowed recviz origins per environment (dev/UAT/prod) in env config. NEVER use `targetOrigin: "*"`. NEVER trust `event.origin` checks against `*`. Validate origin on every `message` event.
2. **Versioned message envelope.** `{ v: 1, type: "RECVIZ.READY" | ..., payload, requestId }`. Validate with Zod on receive.
3. **Auth pass-through via short-lived signed tokens, NOT via cookies and NOT via shared localStorage.** If recviz and our app share a parent domain (`*.citigroup.net`), a session cookie scoped to the parent domain works — but cookies in cross-origin iframes are increasingly restricted by browsers (ITP/3P-cookie deprecation). The safer pattern: parent obtains an auth token, posts it to the iframe at handshake. Mechanism (CitiPortal header forwarding vs SiteMinder vs SPNEGO ticket) is deferred to the DOMAIN-SECURITY phase per PROJECT.md.
4. **Sandbox the iframe.** `<iframe sandbox="allow-scripts allow-same-origin allow-forms allow-popups">` — start tight, open as needed.
5. **CSP `frame-src` on parent + `frame-ancestors` on recviz.** Both apps must agree, and this is configured at the reverse proxy / Citi load balancer layer.
6. **Height/width sync** via the resizer library. The "scroll inside iframe inside scrolling page" UX is bad — auto-sized iframes eliminate it.

### Configuration Sketch

```ts
// allowed origins per environment
const RECVIZ_ORIGINS: Record<string, string> = {
  dev: 'http://localhost:5174',
  uat: 'https://recviz-uat.intranet.citigroup.net',
  prod: 'https://recviz.intranet.citigroup.net',
};

// strict, typed bridge
const MessageSchema = z.discriminatedUnion('type', [
  z.object({ v: z.literal(1), type: z.literal('RECVIZ.READY') }),
  z.object({ v: z.literal(1), type: z.literal('RECVIZ.NAV'), payload: z.object({ jobName: z.string() }) }),
]);
```

---

## Section C — Spring Boot 2.7.16 Observability (OBSERVABILITY)

### Constraints
- **Spring Boot 2.7 stays** (per PROJECT.md). This means:
  - **Micrometer 1.9.x** (NOT 1.12+ — 1.12 requires Boot 3). Spring Boot 2.7's `spring-boot-starter-actuator` brings Micrometer 1.9 transitively.
  - **No Micrometer Tracing** (that's a Spring Boot 3 feature). On 2.7 you get either **Spring Cloud Sleuth** (deprecated but works) or roll your own MDC correlation IDs via a servlet filter.
  - **Java 17** is fine (already in use).

### Core Libraries

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| **spring-boot-starter-actuator** | `2.7.16` (matches Boot) | `/actuator/health`, `/actuator/info`, `/actuator/metrics`, `/actuator/prometheus`, `/actuator/loggers` | Already partially in TLM Stats. Add to `backend/rectrace` too. Selectively expose endpoints; never expose `env`/`heapdump`/`threaddump` to the network. |
| **micrometer-registry-prometheus** | `1.9.x` (Spring Boot 2.7-aligned) | Prometheus scrape endpoint | Adds `/actuator/prometheus`. Prometheus is the de-facto enterprise metrics target; works fully on-prem with no SaaS dependency. |
| **logstash-logback-encoder** | `7.4` (the last release compatible with Logback 1.2 shipped by Boot 2.7) — verify against installed Logback version | Structured JSON logs with MDC | Drop-in `LogstashEncoder` in `logback-spring.xml`. JSON logs ship to file → tailed by Filebeat/Vector → forwarded to whatever Citi log aggregator exists (Splunk / ELK / internal). |
| **Spring Cloud Sleuth** *(optional)* | `3.1.x` | Auto-generated `traceId` + `spanId` in MDC | Adds correlation IDs across HTTP boundaries. **DEPRECATED upstream** (replaced by Micrometer Tracing in Boot 3). Acceptable as a temporary stopgap on 2.7. Alternative: a 30-line `OncePerRequestFilter` that puts `requestId` in MDC manually — simpler, no dep. **Recommend the manual filter approach** — fewer moving parts. |
| **Custom MDC filter** | n/a (write it) | Correlation IDs in MDC | Extract `x-citiportal-loginid`, generate or accept `x-request-id`, put both in MDC, clear in `finally`. ~30 LOC. |

### What Gets Logged / Measured

**Logs (JSON via logstash-logback-encoder):**
- `timestamp`, `level`, `logger`, `message`, `thread`, `exception` (always)
- MDC: `requestId`, `userId` (from CitiPortal header), `traceId` (if Sleuth), `category` (search category if applicable)
- Custom fields per app via `<customFields>` (service name, version, environment)

**Metrics (Micrometer → Prometheus):**
- `http.server.requests` (auto, with `uri`, `status`, `method` tags)
- `jvm.*`, `process.*`, `system.*` (auto)
- `hikaricp.*` connection pool metrics (auto)
- `spring.data.elasticsearch.client.requests` if using REST client
- **Custom slow-query timer** (`@Timed` on `OracleServiceV4.fetchSSRMData` etc.) → exposes p95/p99 of Oracle queries — this is the "slow-query visibility" requirement.

**Health probes:**
- `/actuator/health/liveness` (just JVM up)
- `/actuator/health/readiness` (Oracle + ES reachable)
- Custom `HealthIndicator` for the AutoSys DB conditional bean

### Central Aggregation — Air-Gap-Safe Options

The PROJECT.md constraint is "no SaaS-only tools" and Citi private network. Practical options:

| Option | Pros | Cons | When to pick |
|--------|------|------|--------------|
| **Splunk** (if Citi already runs it) | Likely already mandated by Citi infrastructure team; just ship JSON logs to a file and a Splunk forwarder picks them up | Splunk-specific dashboards; license cost (not our problem) | **Most likely default at Citi.** Confirm with ops. |
| **Elastic Stack (ELK)** | Open source, already familiar (we already use ES) | Requires running a separate ES cluster for logs — do NOT mix with the search index | Good fallback if Splunk isn't standard. Already have ES skills. |
| **Grafana Loki + Prometheus + Grafana** | Cheaper than ELK for logs; pulls labels from the same Prometheus dimensions | Less of an enterprise standard | Good for laptop dev environment + small VM deployments. |
| **OpenTelemetry Collector** | Vendor-neutral, can fan out to Splunk/Loki/Elastic | Adds a sidecar process per VM | Worth adopting if there's a multi-target requirement. |

**Recommendation:** Emit JSON logs to disk + expose Prometheus metrics on `/actuator/prometheus`. Let the Citi platform team (or our `OPS-SCRIPT`) handle the forwarder. Don't over-couple to a specific aggregator until the security/ops phase clarifies what Citi standardizes on.

### What NOT to Do

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Micrometer Tracing on Boot 2.7 | Requires Boot 3.0+ | Sleuth (deprecated) or manual MDC filter |
| Datadog / New Relic / Honeycomb agents | SaaS, off-network, blocked at Citi egress | Prometheus + Splunk/ELK |
| Logging passwords / Oracle wallet paths / JDBC URLs at INFO | Compliance | Mask in MDC; never log `application.properties` content |
| `@CrossOrigin(origins = "*")` on actuator endpoints | Security | Restrict via Spring Security or reverse proxy |
| Exposing `/actuator/env`, `/heapdump`, `/threaddump` over network | Leaks Oracle creds & internal IPs | `management.endpoints.web.exposure.include=health,info,metrics,prometheus,loggers` only |

---

## Section D — ES Loader Scheduling (ES-LOADER)

### Constraints (from PROJECT.md)
- Configurable multi-job loader (each: index + SELECT + schedule)
- **In-built scheduler** (no external dep like cron managed by ops)
- Runs on Citi VM and on laptop
- Likely **single-instance** deployment per environment (one VM per env) — confirm before locking in

### Verdict: `@Scheduled` + ShedLock + a small job-config bean

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| **Spring's `@Scheduled`** | bundled with Boot 2.7 | Cron/fixed-rate triggering | Zero new deps. Native to Spring. Supports cron expressions. Sufficient for "run job X every N minutes." |
| **ShedLock (`net.javacrumbs.shedlock:shedlock-spring`)** | `5.16+` (5.x is Java 17 compatible) | Prevent double-execution if the app ever scales to 2+ instances | Critical safety net. Uses an Oracle table (`shedlock`) as the distributed lock. Even on a single-node deploy, this protects against accidental double-deployments during a rolling restart. **Use `usingDbTime()` to avoid clock skew between app and Oracle.** |
| **`shedlock-provider-jdbc-template`** | `5.16+` | JDBC-backed lock provider | Reuses the existing Oracle datasource — no new infra. |
| **JdbcTemplate (already in Spring Boot)** | bundled | Executing the SELECT for each loader job | Reuse the existing primary Oracle `DataSource` config; the loader's job is "run this SELECT, transform rows, bulk-index to ES." |
| **Spring Data Elasticsearch** | already present | Bulk indexing target | Use the existing high-level client. For very large loads consider the lower-level `BulkProcessor` for batching. |

### Why NOT Quartz

| Need | `@Scheduled` + ShedLock | Quartz |
|------|-------------------------|--------|
| Cron triggers | Yes | Yes |
| Persistent job state across restarts | NO (jobs reschedule from config at startup) | Yes (Quartz JDBC store) |
| Misfire handling | Basic | Sophisticated |
| Clustering | Via ShedLock (lock-based) | Native (DB-coordinated firing) |
| New database tables required | 1 (`shedlock`) | ~11 Quartz tables |
| Boilerplate | Minimal — annotation + `@SchedulerLock` | High — JobDetail, Trigger, SchedulerFactoryBean |
| Operational complexity | Low | Medium-high |

**Our actual needs:** Periodic Oracle→ES extract. Idempotent (re-running is fine). No need for persistent misfire-aware job state. No complex chaining, calendars, or pause/resume semantics. **Quartz is over-spec'd by 5×.**

**Use Quartz only if:** You need persistent misfire recovery (e.g., "job missed at 2am due to maintenance — fire it when you come back up"), complex multi-step DAGs, or operator-managed pause/resume of individual jobs from a UI. None apply here.

### Why NOT db-scheduler

`db-scheduler` is genuinely nicer than Quartz for cluster-friendly persistent scheduling, but it's still over-spec'd for our scenario. ShedLock is the lightest tool that solves the actual concurrency risk.

### Loader Architecture Sketch

```yaml
# loader-config.yml (or .json, matching existing search-config-v4.json pattern)
jobs:
  - id: rectrace-core-load
    targetIndex: rectrace_core_index
    sourceSql: |
      SELECT job_name, ... FROM RECTRACE.JOBS WHERE last_modified > :checkpoint
    cron: "0 */15 * * * *"   # every 15 minutes
    incremental:
      checkpointColumn: last_modified
      checkpointStorage: shedlock_checkpoints  # table
```

**Incremental loading via checkpointing:**
- Maintain a `loader_checkpoints` table: `(job_id, last_processed_ts, last_run_at, status)`.
- Each run reads checkpoint, queries `WHERE col > :checkpoint`, indexes rows, updates checkpoint **in the same transaction as the index ack** (or after — accept that ES isn't transactional).
- For idempotency, use deterministic ES `_id` from the source row's PK so re-runs upsert rather than duplicate.

### Annotation Pattern

```java
@Scheduled(cron = "${loader.rectrace-core-load.cron}")
@SchedulerLock(name = "rectrace-core-load",
               lockAtMostFor = "30m",
               lockAtLeastFor = "1m")
public void runRectraceLoad() {
    loaderService.runJob("rectrace-core-load");
}
```

`lockAtMostFor` should be > expected runtime (else lock release happens while job runs). `lockAtLeastFor` prevents rapid re-firing if a job finishes quickly.

### Job Discovery

For dynamic config-driven jobs (many jobs from a config file, not annotated methods), implement `SchedulingConfigurer` and register cron triggers programmatically from the parsed config. ShedLock supports this via `LockableTaskScheduler`.

---

## Stack Patterns by Variant

**If recviz must be deeply integrated (shared chrome, single navigation, fast cross-app routing):**
- Re-open the Module Federation question — but only if recviz team agrees to ship a federated remote.
- Until then, iframe is correct.

**If we ever go multi-instance deployment for `backend/rectrace`:**
- ShedLock becomes load-bearing (not just defense-in-depth).
- Make CORS policies stricter (remove `@CrossOrigin(origins = "*")` per `.planning/codebase/CONCERNS.md`-class issues).

**If Citi mandates Splunk specifically:**
- Use `logstash-logback-encoder` for JSON output to file; Splunk Universal Forwarder reads the file. No app code changes needed beyond the encoder config.

**If Citi mandates a specific OpenTelemetry collector:**
- Swap `micrometer-registry-prometheus` for `opentelemetry-micrometer-bridge` + OTLP exporter. The app code (`Timer`, `Counter`, `@Timed`) doesn't change.

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Spring Boot `2.7.16` | Micrometer `1.9.x` | Boot 2.7 brings 1.9 transitively. Don't override to 1.10+ without Boot upgrade. |
| Spring Boot `2.7.16` | logstash-logback-encoder `7.4` | 7.4 = last version targeting Logback 1.2.x which Boot 2.7 ships. 8.x targets Logback 1.4 (Boot 3). |
| Spring Boot `2.7.16` | ShedLock `5.x` | ShedLock 5 requires Java 11+; you're on 17 — fine. |
| Spring Boot `2.7.16` | Spring Cloud Sleuth `3.1.x` | Last version targeting Boot 2.7. |
| React `19.2.x` | shadcn/ui (Tailwind v4) | shadcn v3.5 templates target React 19 + Tailwind v4. |
| Vite `7.x` | `@tanstack/router-plugin` `1.114+` | Verified compatible. |
| Vite `7.x` | `@tailwindcss/vite` `4.x` | Verified. Don't mix with the older PostCSS plugin. |
| TanStack Query `5.90+` | TanStack Router `1.114+` | Designed to integrate; loaders can use the QueryClient. |
| AG-Grid `33.x` | React `19` | AG-Grid 33 supports React 19. The existing Angular app is on 32.2.2 — slight version skew is acceptable since they're separate apps. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Create React App (CRA) | Deprecated, unmaintained, slow | Vite 7 |
| Webpack 5 (from scratch) | Slow dev server, complex config, Vite-equivalent results | Vite 7 |
| Redux / Redux Toolkit (for this app) | Boilerplate-heavy; needs not present | Zustand for client state, TanStack Query for server state |
| `axios` | No advantage over `fetch` in 2026; +13KB | Native `fetch` + small typed wrapper |
| Material UI / Mantine / Chakra | Fights shadcn; runtime CSS-in-JS overhead | shadcn/ui |
| `iframe-resizer` v5+ (original) | GPLv3 — viral license incompatible with closed-source enterprise code unless commercial license purchased | `open-iframe-resizer` (MIT) or `rezonant/iframe-resizer` (MIT fork) — pending OSS review |
| Module Federation / single-spa for recviz | Requires modifying recviz; out of scope | iframe + postMessage |
| `*` as `targetOrigin` in postMessage | Sends payload to any listener — data leak | Strict per-environment origin allow-list |
| Quartz Scheduler for ES loader | Over-spec'd; ~11 new DB tables; complex misfire model we don't need | `@Scheduled` + ShedLock |
| Spring Cloud Sleuth on new code | Deprecated upstream | Manual MDC filter (~30 LOC) |
| Micrometer Tracing on Boot 2.7 | Boot 3+ only | Sleuth or manual MDC |
| `@CrossOrigin(origins="*")` on V4 controllers (existing smell) | Anyone-can-call from browser | Configure CORS centrally via `WebMvcConfigurer` / Citi reverse proxy |
| Datadog / New Relic / Sentry SaaS | SaaS — Citi egress blocked, compliance concerns | Prometheus + Splunk/ELK on-prem |
| Logging Oracle passwords or wallet paths in MDC | Compliance | Never put credentials in MDC |
| Karma + Jasmine in the new React app | Heavy, slow, dated | Vitest |
| `npm install` without lockfile commit | Reproducibility | Commit `package-lock.json` (already done in Angular app) |

---

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| Vite 7 + React 19 + TS | **HIGH** | Context7 verified, official docs current. |
| TanStack Router + Query | **HIGH** | Context7 verified, dominant 2026 choice for non-SSR React. |
| Zustand for client state | **HIGH** | Context7 verified; matches existing Angular service patterns. |
| shadcn/ui + Tailwind v4 | **HIGH** | Context7 verified; explicitly mandated in PROJECT.md. |
| Keeping AG-Grid Enterprise (not switching to TanStack Table) | **HIGH** | Driven by SSRM + existing license + Excel export needs — not opinion. |
| iframe + postMessage for recviz | **HIGH** | Forced by "no recviz modifications" constraint. |
| `open-iframe-resizer` MIT fork | **MEDIUM** | License story is correct; fork maturity needs Citi OSS-review validation. |
| Spring Boot 2.7 + Micrometer 1.9 + Prometheus | **HIGH** | Context7 verified; Boot 2.7's transitive deps are well-known. |
| logstash-logback-encoder `7.4` for Boot 2.7 | **MEDIUM** | Version pin is correct as of last release; verify against actual Boot 2.7.16 Logback version (1.2.12) at install time. |
| ShedLock over Quartz | **HIGH** | Context7 verified; matches the actual job profile (idempotent periodic extract). |
| Specific log aggregator (Splunk vs ELK vs Loki) | **LOW** | Depends on what Citi platform team standardizes on; deferred. Recommendation: emit JSON + Prometheus, let ops route. |

---

## Open Questions for Roadmap / Phase Planning

1. **Citi Verdaccio / Artifactory coverage** — confirm all listed npm packages and their native binaries (esp. Rolldown if we ever move to Vite 8) are mirrored. Lock in `package-lock.json` against the internal mirror.
2. **AG-Grid Enterprise license key** — the existing license in `environment.ts` covers Angular usage. Confirm it covers `ag-grid-react` usage too (it does, per AG-Grid licensing — but verify renewal scope).
3. **recviz origin URL per environment** — required for the iframe origin allow-list before integration phase.
4. **Citi log aggregator standard** — Splunk? ELK? Loki? Drives the forwarder config in OPS-SCRIPT.
5. **Single-node or multi-node deployment for `backend/rectrace`?** — Determines whether ShedLock is defense-in-depth or load-bearing. PROJECT.md implies single VM per env but should be confirmed.
6. **iframe-resizer fork selection** — `open-iframe-resizer` vs `rezonant/iframe-resizer` — both MIT; recommend going with whichever has more recent activity at evaluation time. Subject to Citi OSS review.
7. **Spring Boot 3 migration timing** — out of scope for this milestone, but several stack choices (Sleuth deprecation, Micrometer Tracing, logstash-logback-encoder 8.x) become trivially better on Boot 3. Worth a separate research issue.

---

## Sources

**Context7 (HIGH confidence):**
- `/vitejs/vite` — Vite 7/8 setup, TS config for `bundler` resolution
- `/tanstack/router` — file-based routing, plugin install
- `/tanstack/query` — QueryClient setup, React integration
- `/tanstack/table` — manual grouping for server-side ops, virtualization caveat
- `/shadcn-ui/ui` — Tailwind v4 install, Vite integration
- `/pmndrs/zustand` — store factory, TS patterns
- `/lukas-krecan/shedlock` — JDBC lock provider, `usingDbTime()`
- `/quartz-scheduler/quartz` — job persistence, `@PersistJobDataAfterExecution`
- `/micrometer-metrics/micrometer` — Prometheus registry, Spring Boot integration
- `/logfellow/logstash-logback-encoder` — JSON encoder config, MDC propagation

**Official docs / blogs (verified MEDIUM-HIGH):**
- [Vite 7 release](https://vite.dev/blog/announcing-vite7), [Vite 8 release](https://vite.dev/blog/announcing-vite8)
- [shadcn/ui Vite install](https://github.com/shadcn-ui/ui/blob/main/apps/v4/content/docs/installation/vite.mdx)
- [iframe-resizer pricing/license](https://iframe-resizer.com/pricing/), [GPL discussion](https://github.com/davidjbradshaw/iframe-resizer/issues/1265), [rezonant MIT fork](https://github.com/rezonant/iframe-resizer)
- [ShedLock README](https://github.com/lukas-krecan/ShedLock), [Baeldung ShedLock guide](https://www.baeldung.com/shedlock-spring)
- [TanStack Table vs AG-Grid 2026](https://www.pkgpulse.com/blog/tanstack-table-vs-ag-grid-vs-react-data-grid-2026), [simple-table comparison](https://www.simple-table.com/blog/tanstack-table-vs-ag-grid-comparison)
- [Module Federation 2026 status](https://blog.weskill.org/2026/03/micro-frontends-2026-module-federation_0688468676.html)
- [Spring Boot 2026 monitoring guide](https://sharpskill.dev/en/blog/spring-boot/spring-boot-actuator-monitoring-micrometer-prometheus), [SigNoz Spring Boot logging guide](https://signoz.io/guides/spring-boot-logging/)

**Project context:**
- `/Users/aarun/Workspace/Projects/autosys-job-explorer/.planning/PROJECT.md` — milestone requirements, constraints, out-of-scope items
- `/Users/aarun/Workspace/Projects/autosys-job-explorer/.planning/codebase/STACK.md` — existing stack baseline
- `/Users/aarun/Workspace/Projects/autosys-job-explorer/.planning/codebase/ARCHITECTURE.md` — existing patterns

---
*Stack research for: enterprise React migration + observability/scheduler additions on Spring Boot 2.7*
*Researched: 2026-05-12*
