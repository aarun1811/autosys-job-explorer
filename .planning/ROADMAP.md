# Roadmap: Rectrace — Modernization Milestone

## Overview

This milestone modernizes the Rectrace stack along three axes — a backend platform upgrade (Spring Boot 2.7 → **3.5.14**, **Java 21**, jakarta), a net-new React frontend mirroring recviz, and a set of additive backend capabilities (config-driven SELECT, Oracle→ES scheduled loader, observability, ops script, Citi-domain security). The strategy is **vertical-slice strangler-fig**: a thin foundation lands first, then end-to-end slices ship one tab at a time while Angular keeps running. Backend-only phases (SQL, Loader, Observability) parallelize against React phases. The milestone closes with a hyphen-bug fix + design polish + ops hardening, then locks domain security as the production gate.

> **Status (2026-06-12):** This milestone is **substantially complete and merged into `main`** — `main` is the source of truth (~45 commits ahead of `milestone/modernization`, whose HEAD is the merge-base). Phases 0–3 and 5–8 are done; **Phase 4 (RecViz) is largely built on the rectrace side** with RecViz-side seeding + cross-team contract work remaining; Phase 9 (security) is not started. Significant **post-milestone work** (execution-order React Flow redesign, TLM/QuickRec RecViz embed, A1a dashboard-config removal, loader extraction to `rectrace-loader`) landed on `main` *after* the per-phase history was archived — see the "Post-Milestone Work" section below and `.planning/codebase/CURRENT-STATE-2026-06-12.md`.

## Phases

**Phase Numbering:**
- Integer phases (0, 1, 2…): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 0: Foundation** — Test gate (`maven.test.skip` removed, CI fails on red) + React↔Angular parity matrix committed. (completed 2026-05-12)
- [x] **Phase 0.1: Local Dev Seed Bootstrap** (INSERTED) — Sibling `../rectrace-local-dev/` folder with Oracle DDL/seed scripts + ES index templates/bulk-load JSON; prerequisite for Phase 1's BOOT-09 smoke. Outside the project repo; does not ship to Citi. (completed 2026-05-12; two KNOWN GAPS handed to Phase 1 BOOT-08: backend/rectrace DataSourceConfig.java + rectrace-tlm-stats DatabaseConfig.java unconditional script-executor calls)
- [x] **Phase 1: Backend Platform Upgrade** — Spring Boot 2.7 → **3.5.14**, **Java 21**, `javax` → `jakarta`, `SecurityFilterChain`, dependency-pin refresh, opportunistic cleanup. (completed 2026-05-12)
- [x] **Phase 2: React Foundation** — Vite + React 19 + shadcn + AG-Grid React scaffold, design tokens, dark/light mode, correlation-ID plumbing, ops script v1. (completed 2026-05-13)
- [x] **Phase 3: React Search Vertical Slice** — One V4 search category ported end-to-end to React with renderer, URL-sync, export, recent searches, correlation-ID error states. (completed 2026-05-17)
- [~] **Phase 4: RecViz Integration** — *rectrace side largely built on `main`* (TLM/QuickRec cell renderers + `RecvizEmbed` + `buildEmbedUrl` + `recvizConfig` + backend `ConfigController`). Remaining: seed the RecViz dashboards per env, written CSP/`frame-ancestors`/cookie/SSO contract, versioned Zod `postMessage` envelope, UAT smoke against the real instance, and the prod-config blockers (see `.planning/codebase/CURRENT-STATE-2026-06-12.md` §5).
- [x] **Phase 5: Config-driven SELECT** — `SqlSearchControllerV4` + `SqlQueryServiceV4` with JSqlParser startup guard, read-only DB user, per-statement timeout/fetchSize/maxRows, mandatory `WHERE`/`FETCH FIRST` cap, SSRM-shaped responses. (completed 2026-05-17)
- [x] **Phase 6: ES Loader Subsystem** — Config-driven multi-job Oracle→ES loader (scheduler decision locked in planning), alias-only indexes, idempotent upserts, run-history, admin endpoints, graceful shutdown. (completed 2026-05-17)
- [x] **Phase 7: Observability Sweep** — JSON logs via `logback-spring.xml`, custom `HealthIndicator` beans, slow-query timing, Prometheus, actuator lockdown, Micrometer Tracing across `@Async`/scheduler/subprocess. (completed 2026-05-17)
- [x] **Phase 8: Hyphen Bug + Design Polish + Ops Hardening** — ES `_analyze` diagnostic + `.keyword` fix + regression test; shadcn↔recviz token audit + visual regression; `rectrace-ops.sh` passes `shellcheck` + Linux CI + readiness probe. (completed 2026-05-17)
- [ ] **Phase 9: Domain Security** — User-auth mechanism (CitiPortal / SiteMinder / SPNEGO) + service-auth (keytab / Vault) locked + implemented; ES SSL re-enabled; Citi CA truststore; CORS allow-list; Citi-network preflight; CONCERNS.md CRITICAL closure.

## Phase Details

### Phase 0: Foundation
**Goal**: Establish a green test gate and a committed React↔Angular parity matrix before any feature work begins.
**Depends on**: Nothing (first phase)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04
**Success Criteria** (what must be TRUE):
  1. `mvn test` runs (not skipped) and passes locally and in CI for both `backend/rectrace` and `rectrace-tlm-stats`.
  2. CI fails the build on any backend test failure; manual override is `-DskipTests` only.
  3. At least one passing Spring context-load test exists per Maven module.
  4. `.planning/parity-matrix.md` is committed, mapping every `cellRenderer` × every search category × every grid behavior to `port | drop | replace-with-recviz`.
**Plans**: 3 plans

Plans:
- [x] 00-01-PLAN.md — backend/rectrace test gate (remove maven.test.skip, @Profile guards on DataSourceConfig + AutosysDataSourceConfig + ElasticsearchDevConfiguration, create ContextLoadsTest.java + application-test.properties)
- [x] 00-02-PLAN.md — rectrace-tlm-stats test gate (remove maven.test.skip, @Profile("!test") on DatabaseConfig, create application-test.properties with recportal.datasource.url placeholder, add @ActiveProfiles("test") to TlmStatsApplicationTests)
- [x] 00-03-PLAN.md — parity matrix day-0 inventory (create .planning/parity-matrix.md with all Angular routes/tabs/modals/features and target verbs)

### Phase 00.1: Local Dev Seed Bootstrap (INSERTED)

**Goal**: Produce a standalone sibling repo `../rectrace-local-dev/` providing a one-command local Oracle 23c + Elasticsearch 8.13.4 stack with 5 fully-connected fabricated scenarios (≥2 hyphenated for the Phase 8 dry-run target), an idempotent Python `apply.py` driver, and `application-local.properties` files in this repo so the existing Boot 2.7.16 codebase can verify the seed end-to-end before Phase 1 ships.
**Requirements**: LOCAL-DEV-01, LOCAL-DEV-02, LOCAL-DEV-03, LOCAL-DEV-04, LOCAL-DEV-04a, LOCAL-DEV-05, LOCAL-DEV-06
**Depends on:** Phase 0
**Plans:** 7/7 plans executed

Plans:
- [x] 00.1-01-PLAN.md — Sibling repo bootstrap (.gitignore, .env.example, requirements.txt, README skeleton, .venv)
- [x] 00.1-02-PLAN.md — Docker stack: gvenzl/oracle-free:23-slim + elasticsearch:8.13.4 + first-boot Oracle init script for 4 schema users
- [x] 00.1-03-PLAN.md — Oracle DDL for 11 tables across RECTRACE / AUTOSYS / RECONMGMT / RECPORTAL schemas (idempotent drop+create; ujo_job + ujo_job_status split per JobStatusService.java)
- [x] 00.1-04-PLAN.md — ES rectrace_core_index mapping with explicit .keyword multi-fields on 13 hyphen-sensitive fields (Phase 8 fix prerequisite)
- [x] 00.1-05-PLAN.md — 5 connected scenarios: scenarios.md + 4 Oracle INSERT files + ES NDJSON bulk-load
- [x] 00.1-06-PLAN.md — apply.py idempotent driver with --reset, --verify, --oracle-only, --es-only flags
- [x] 00.1-07-PLAN.md — application-local.properties in this repo + finalized README + D-0.1.23 8-item smoke verification (5/5 automatable PASS; 3/3 UI deferred to manual user verification; 2 KNOWN GAPS handed to Phase 1 BOOT-08)

### Phase 1: Backend Platform Upgrade
**Goal**: Both backend modules run on **Spring Boot 3.5.14** and **Java 21** with `jakarta` namespaces, modern Spring Security configuration, refreshed dependency pins, and all existing functionality verified.
**Depends on**: Phase 0
**Requirements**: BOOT-01, BOOT-02, BOOT-03, BOOT-04, BOOT-05, BOOT-06, BOOT-07, BOOT-08, BOOT-09
**Success Criteria** (what must be TRUE):
  1. `backend/rectrace` and `rectrace-tlm-stats` build and boot on **Spring Boot 3.5.14** and **Java 21** on both dev laptop and target VM.
  2. All `javax.*` imports migrated to `jakarta.*`; build is clean and no deprecated namespace remains.
  3. Spring Security is configured via `SecurityFilterChain` (no `WebSecurityConfigurerAdapter`); the existing `x-citiportal-loginid` filter still works end-to-end.
  4. All previously-skipped tests pass on **3.5.14**, and a manual smoke confirms search, execution order, and TLM stats remain functional.
  5. `printStackTrace`, `show_sql=true`, and the CONCERNS.md LOW/MEDIUM cleanup items addressed during the upgrade are gone.
**Plans**: 1 plan (8 waves)

### Phase 2: React Foundation
**Goal**: A net-new React shell that mirrors recviz's design language, runs side-by-side with the existing Angular app during development, and is ready to host vertical search/recviz slices.
**Depends on**: Phase 1
**Requirements**: REACT-01, REACT-02, REACT-03, REACT-04, REACT-05, REACT-06, REACT-07, REACT-08
**Success Criteria** (what must be TRUE):
  1. `frontend-react/` boots locally via `pnpm dev` (or `npm run dev` fallback) with React 19 + Vite 7 + shadcn (Tailwind v4) + AG-Grid Enterprise via `ag-grid-react`, and renders an empty SSRM grid against an existing backend endpoint.
  2. A canonical `tokens.css` + `theme.ts` exists, ESLint rejects raw hex codes in components, and a dark/light toggle reaches feature parity with the Angular app.
  3. The app footer renders the build SHA / version for bug-report quoting.
  4. The backend writes a `traceId` to MDC (via Micrometer Tracing post-BOOT) and the React shell propagates `X-Correlation-Id` on every request.
  5. `ops/rectrace-ops.sh` v1 registers backend, tlm-stats, and React components and can start/stop/status each one.
**Plans**: 5 plans

Plans:
- [x] 02-01-PLAN.md — Frontend scaffold: Vite 7 + React 19 + shadcn + tokens + ESLint hex rule + vitest
- [x] 02-02-PLAN.md — Backend tracing: micrometer-tracing-bridge-brave + logback-spring.xml + X-Correlation-Id baggage
- [x] 02-03-PLAN.md — App shell: ThemeProvider + ThemeSwitch + footer SHA + QueryClient + SmokeGrid SSRM
- [x] 02-04-PLAN.md — Ops scripts: rectrace-ops.sh v1 + build.sh react + smoke-ssrm + smoke-correlation-id
- [x] 02-05-PLAN.md — Doc supersessions: ROADMAP/REQUIREMENTS/STATE edits + frontend-react README

**UI hint**: yes

### Phase 3: React Search Vertical Slice
**Goal**: An end-to-end React search experience for one category that proves the React shell + AG-Grid SSRM + existing backend integration, served at `/rectrace/` (the production base path).
**Depends on**: Phase 2
**Requirements**: SEARCH-01, SEARCH-02, SEARCH-03, SEARCH-04, SEARCH-05, SEARCH-06, SEARCH-07
**Success Criteria** (what must be TRUE):
  1. A user can open the React app at `/rectrace/` (the production base path; no `/v6/` prefix — see Phase 2 D-2.4), run a search in the ported category, and see results in the SSRM grid identical to the Angular app's output.
  2. At least one custom cell renderer from the Angular app is ported and visibly behaves the same in React.
  3. URL fully encodes search state; pasting the URL into a new tab restores the exact view (deep linkable).
  4. Excel export from the React grid is at feature parity with Angular; recent searches (last 10) appear in a typeahead from `localStorage`.
  5. Any error in the React search flow surfaces the correlation ID as "Error — reference: <ID>" for the user to quote in a bug report.
**Plans**: 8 plans (6 waves)

Plans:
- [x] 03-01-PLAN.md — Wave 1: Zod schemas (SearchConfigurationV4, SSRMRequestV4, InitialSearchResponseV4, ColumnDefinitionV4) + useSearchConfig TanStack Query hook (staleTime: Infinity)
- [x] 03-02-PLAN.md — Wave 1: useSearchState (TanStack Router URL ↔ {q, cat}) + useRecentSearches (localStorage LRU, 10-cap, case-sensitive dedupe per D-3.11)
- [x] 03-03-PLAN.md — Wave 2: Three renderers (AppID anchor, SupportEmail mailto, ExecutionOrder button + placeholder Dialog with TODO(Phase 4)) + renderer registry string→component map + shadcn Dialog vendored
- [x] 03-04-PLAN.md — Wave 3: configCategoryToColDefs adapter (kebab→camelCase cellStyle; graceful unknown-renderer fallback) + main.tsx registers ExcelExportModule/ColumnsToolPanelModule/FiltersToolPanelModule + 8 shadcn primitives vendored (input, badge, separator, command, popover, tooltip, dropdown-menu, skeleton) at pin 3.8.5
- [x] 03-05-PLAN.md — Wave 4: SearchGrid (config-driven columnDefs from adapter; remount-by-key on (q, cat); SSRM datasource useMemo([q, cat, initialFilter]); Sonner-mount setTimeout(0) workaround per D-3.6; no Date.now()+Math.random() — Pitfall 1)
- [x] 03-06-PLAN.md — Wave 4: SearchBar (Input + clear-X + Search button + recent-searches Popover via shadcn Command), SearchToolbar (locale-formatted result Badge + Excel export DropdownMenu), CategoryTabBar (single-tab seed for Phase 4+)
- [x] 03-07-PLAN.md — Wave 5: /search route (Zod validateSearch) + / → /search redirect + SearchPage orchestrator (URL-restore useEffect, /initial GET ?keyword= per Pitfall 4, Excel export filename + columnKeys filter, error-state card) + delete SmokeGrid (Pitfall 8) + human UAT checkpoint (13-step verification against local seed)
- [x] 03-08-PLAN.md — Wave 6: Extend scripts/smoke-ssrm.sh with /api/v4/search/config shape assertion (regression net for the three renderer keys) + update .planning/parity-matrix.md (flip 6 rows: File Name tab, 3 renderers, Excel, Recent → `port`)

**UI hint**: yes

### Phase 4: recviz Integration
**Goal**: recviz can be embedded inside the new React app as a tab or modal, gated by a written cross-team contract and verified against the real recviz instance.
**Depends on**: Phase 3
**Requirements**: RECVIZ-01, RECVIZ-02, RECVIZ-03, RECVIZ-04, RECVIZ-05, RECVIZ-06, RECVIZ-07
**Success Criteria** (what must be TRUE):
  1. A written CSP / `frame-ancestors` / `SameSite` cookie / SSO contract with the recviz team exists in the repo and is referenced by the implementation.
  2. A user can open a configured tab in the React app and see a recviz view rendered inside a sandboxed iframe sized correctly via `open-iframe-resizer` (or fork), with no `targetOrigin: '*'`.
  3. Modals can render recviz iframes at parity with the existing execution-order / TLM-stats modal pattern.
  4. All `postMessage` traffic flows through a versioned Zod-validated envelope (auth handoff, height sync, navigation events), and every listener validates `event.origin` against a per-environment allow-list.
  5. A UAT smoke test against the real (non-localhost) recviz instance is recorded as evidence and committed.
**Status (2026-06-12):** the rectrace-side implementation shipped on `main` *outside* the original 3-plan structure — as the execution-order redesign + TLM/QuickRec RecViz embed work. See `docs/superpowers/specs/2026-05-28-tlm-quickrec-recviz-modals-design.md` and the 4 plans `docs/superpowers/plans/2026-05-28-tlm-quickrec-recviz-*.md`. DESIGN-01/02/03 deferred per 08-CONTEXT.md.

Shipped on the rectrace side:
- `RecvizEmbed` (sandboxed iframe + origin-validated `postMessage` `RECTRACE_THEME`/`RECTRACE_IFRAME_HEIGHT`), `buildEmbedUrl` (+ test, never `targetOrigin:'*'`), `RecvizDashboardModal`
- `TlmStatsCellRenderer` (`dash-tlm-stats`) + `QuickRecStatsCellRenderer` (`dash-quickrec-stats`), registered in `renderers/registry.ts`
- `recvizConfig.ts` (runtime fetch of `/rectrace/api/config`) + backend `ConfigController` `GET /api/config` → `{recvizOrigin}` from `app.recviz.origin`

Remaining (RecViz-side + cross-team):
- Seed the two dashboards per env via `RecViz/scripts/seed-oracle.py`; align dataset `filter_mappings` with the renderers' filter IDs
- Written CSP/`frame-ancestors`/`SameSite`/SSO contract (RECVIZ-01) + per-env origin allow-list (RECVIZ-02)
- Versioned Zod `postMessage` envelope (RECVIZ-03); CSP framing-refusal detection in `RecvizEmbed.onError`
- Prod blockers: RecViz CORS hardcoded (`RecViz/backend/app/main.py:219`); `app.recviz.origin` absent from `application-*.properties`
- UAT smoke against the real RecViz instance (RECVIZ-07)

**Research hint**: yes — RecViz CSP/cookie/SSO posture, Citi network topology between the two apps, and same-origin-vs-cross-origin embed topology should be settled during phase planning.

### Phase 5: Config-driven SELECT
**Goal**: Devs/admins can define a search tab as an arbitrary `SELECT` in config, with the application enforcing bounded resources, parser-based validation, and SSRM-shaped output — never exposing SQL to end users.
**Depends on**: Phase 1
**Requirements**: SQL-01, SQL-02, SQL-03, SQL-04, SQL-05, SQL-06, SQL-07
**Success Criteria** (what must be TRUE):
  1. A configured arbitrary `SELECT` tab can be hit from an AG-Grid SSRM client (Angular or React) and returns paged, filtered, sorted results from Oracle.
  2. The application **fails to boot** if any configured query is not a `SELECT`/`WITH` or violates configured shape rules (JSqlParser-validated at startup).
  3. All configured queries execute under a dedicated read-only Oracle account, with per-statement `setQueryTimeout`, `fetchSize`, and `maxRows` caps; the singleton `JdbcTemplate` is never globally mutated.
  4. Any configured query without a `WHERE` clause or `FETCH FIRST N ROWS ONLY` is rejected — runaway scans cannot reach Oracle.
  5. At least one example configured SELECT-tab is wired end-to-end as evidence and consumable by an existing grid.
**Plans**: 6 plans (5 waves)

Plans:
- [x] 05-01-PLAN.md — Wave 1: Test scaffolding (5 JUnit 5 classes + scripts/smoke-sql-search.sh) — SQL-02/04/05/06/07 contracts as @Disabled tests
- [x] 05-02-PLAN.md — Wave 1: Local-dev DDL (rectrace_readonly Oracle user, SELECT-only grants) + backend/rectrace application-local.properties datasource.readonly.* keys — SQL-03
- [x] 05-03-PLAN.md — Wave 2: pom.xml JSqlParser 5.3 + ReadonlyDataSourceConfig (@Profile(!test), readonlyDataSource + readonlyJdbcTemplate beans, no setters on template) — SQL-03/04
- [x] 05-04-PLAN.md — Wave 3: DTOs + sql-search-config-v4.json + SqlShapeValidator (JSqlParser visitor) + SqlSearchConfigServiceV4 (@PostConstruct, boot-fails on shape violation) — SQL-01/02/05
- [x] 05-05-PLAN.md — Wave 4: SqlQueryServiceV4 (wrapped query + StatementCallback + whitelisted sort/filter) + SqlSearchControllerV4 (GET /config, POST /ssrm/{tabKey}) — SQL-04/05/06
- [x] 05-06-PLAN.md — Wave 5: 6-assertion smoke against live stack + ANGULAR-WIRING.md + parity-matrix update — SQL-07

### Phase 6: ES Loader Subsystem
**Goal**: A configuration-driven, scheduled Oracle→Elasticsearch loader subsystem inside `backend/rectrace`, with run history, manual triggers, alias-only index access, and idempotent upserts.
**Depends on**: Phase 1
**Requirements**: LOADER-01, LOADER-02, LOADER-03, LOADER-04, LOADER-05, LOADER-06, LOADER-07, LOADER-08, LOADER-09, LOADER-10
**Success Criteria** (what must be TRUE):
  1. Multiple loader jobs can be defined in config (source `SELECT` + target ES alias + cron schedule + batch size) and the in-built scheduler runs them on schedule using the locked mechanism (Quartz JDBC JobStore *or* `@Scheduled` + ShedLock).
  2. Every job writes to ES via an alias (never a literal index name) and produces idempotent upserts via a deterministic `_id` derived from the source primary key.
  3. An operator can hit `LoaderAdminControllerV4` to list jobs, trigger a run-now, and view the last 20 runs per job with timestamp, status, row count, last-error message, and duration.
  4. A JVM signal during a run flushes in-flight bulk requests before exit — no partial-batch loss observed in a soak test.
  5. Bulk indexing uses `BulkProcessor` with sane defaults (5000 rows / 5 MB / 5 s) and is tunable per job in config.
**Plans**: 5 plans (4 waves)
**Research hint**: yes — the **Quartz JDBC JobStore vs `@Scheduled` + ShedLock decision** must be locked during phase planning per the open decision in research/SUMMARY.md; also verify ShedLock 5.x or Quartz Oracle delegate compatibility with the installed driver.

Plans:
- [x] 06-01-PLAN.md - Wave 1: Local-dev seed extensions (shedlock + loader_run_history tables; rectrace_core_alias bootstrap in apply.py) - LOADER-02/03/06 prerequisites
- [x] 06-02-PLAN.md - Wave 1: pom.xml ShedLock 7.7.0 deps + spring.lifecycle.timeout-per-shutdown-phase=60s + seven @Disabled JUnit 5 Wave-0 test scaffolds - LOADER-01..10 test contracts
- [x] 06-03-PLAN.md - Wave 2: DTOs + loader-config-v4.json + DocumentIdHasher + LoaderConfigService (boot-time alias check) + LoaderRunHistoryService (prune-to-20) - LOADER-01/04/05/06/07
- [x] 06-04-PLAN.md - Wave 3: LoaderShedLockConfig + LoaderJobRegistry (per-job BulkIngester, @PreDestroy flush) + OracleToEsLoaderJob (streamed query + alias writes) + LoaderTicker (fixedDelay PT30S + LockingTaskExecutor) - LOADER-02/03/05/09/10
- [x] 06-05-PLAN.md - Wave 4: LoaderAdminControllerV4 (GET /jobs, POST /jobs/{key}/run-now, GET /jobs/{key}/runs) + three smoke scripts (alias boot-fail, SIGTERM flush, admin shape) - LOADER-03/08/09

### Phase 7: Observability Sweep
**Goal**: Both backend modules emit structured, correlation-ID-tagged JSON logs, expose locked-down actuator endpoints with custom health indicators, and publish Prometheus metrics plus slow-query timing — instrumented horizontally now that there are multiple subsystems to observe.
**Depends on**: Phase 6
**Requirements**: OBS-01, OBS-02, OBS-03, OBS-04, OBS-05, OBS-06, OBS-07, OBS-08
**Success Criteria** (what must be TRUE):
  1. `backend/rectrace` and `rectrace-tlm-stats` both emit JSON logs via `logstash-logback-encoder` configured in `logback-spring.xml` (never `logback.xml`) with `traceId`, `userId`, `path`, `method`, `status`, and `durationMs` fields.
  2. `/actuator/health` reports custom `HealthIndicator` beans for Oracle reachability, ES reachability, loader-run-age, and search-config validity; actuator exposure is an explicit allow-list with no wildcards and `show-details` is `when-authorized` or `never`.
  3. `/actuator/prometheus` exposes Micrometer metrics, and a CI guard rejects any attempt to override the BOM-pinned Micrometer version.
  4. A slow-query log line is emitted for `JdbcTemplate` and ES calls exceeding a configurable threshold, via `@Timed`/AOP.
  5. The correlation ID propagates through `@Async` (`TaskDecorator`), scheduler jobs (fresh `traceId` per fire), and subprocess invocations — verified by tracing a single request end-to-end.
**Plans**: 5 plans (4 waves)
**Research hint**: yes — lock the log-aggregator target (Splunk / ELK / Loki / OTel collector) during phase planning before forwarder config is written.

Plans:
- [x] 07-01-PLAN.md — Wave 1: pom.xml deps (logstash-logback-encoder 8.0 + micrometer-registry-prometheus + spring-boot-starter-aop) + 13 @Disabled Wave-0 test scaffolds in backend/rectrace + 6 in rectrace-tlm-stats — OBS-01/04/05 prerequisites
- [x] 07-02-PLAN.md — Wave 2: backend/rectrace logback-spring.xml profile-aware (Console / LogstashEncoder+Splunk HEC) + actuator exposure lockdown + UserIdMdcFilter + AccessLogFilter + ActuatorSecurityConfig stub — OBS-01/03/07
- [x] 07-03-PLAN.md — Wave 2: backend/rectrace 4 HealthIndicators (Oracle + ES + LoaderRunAge in /loader group + SearchConfig) + SlowQueryLoggerAspect (concrete JdbcTemplate pointcut) + ScheduledTraceIdAspect + AsyncConfig ContextPropagatingTaskDecorator + ScriptExecutor RECTRACE_CORRELATION_ID env var — OBS-02/04/05/06
- [x] 07-04-PLAN.md — Wave 3: rectrace-tlm-stats mirror (subset: logback + filters + ActuatorSecurityConfig + OracleHealthIndicator on reconmgmt DS + AsyncConfig with ContextPropagatingTaskDecorator; NO loader, NO ES, NO slow-query) — OBS-01/02/03/05/06/07
- [x] 07-05-PLAN.md — Wave 4: maven-enforcer-plugin (dependencyConvergence + bannedDependencies on Micrometer >=2.0.0) in both POMs + scripts/smoke-observability.sh live-stack smoke — OBS-08

### Phase 8: Hyphen Bug + Design Polish + Ops Hardening
**Goal**: Close the daily hyphen-search complaint, eliminate visual drift between the React app and recviz, and harden the single-bash-script ops surface for both macOS and Linux.
**Depends on**: Phase 7
**Requirements**: BUG-01, BUG-02, BUG-03, DESIGN-01, DESIGN-02, DESIGN-03, OPS-01, OPS-02, OPS-03, OPS-04
**Success Criteria** (what must be TRUE):
  1. Searching for a hyphenated term (e.g. `ABC-123`) returns the expected documents; a regression test asserts this and is committed alongside the ES `_analyze` diagnostic and root-cause note.
  2. The fix shipped is the `.keyword`-subfield path (or, if truly required, an alias-swap reindex); ES alias indirection is in place so future reindexes are atomic.
  3. The shadcn token set is audited against recviz tokens, gaps are closed in the canonical token file, and a visual regression test fails on drift at the recviz↔React boundary.
  4. `ops/rectrace-ops.sh` passes `shellcheck`, supports `start | stop | restart | status | logs` per-component or all, blocks `start` on an actuator health probe, manages PIDs in `run/` and logs in `logs/`, and a Linux CI job runs it on every push.
  5. Adding a new managed component to the ops surface is a one-line change in `ops/components.sh`.
**Plans**: 3 plans (autonomous; 2 waves); DESIGN-01/02/03 deferred per 08-CONTEXT.md (see 08-DESIGN-DEFERRED.md)

Plans:
- [x] 08-01-PLAN.md — Wave 1: BUG-01/02/03 — HYPHEN-DIAGNOSTIC.md + ES wildcard caseInsensitive(true) on .keyword branch + HyphenSearchRegressionTest + scripts/smoke-hyphen-search.sh (4 commits 03c91ea/3358296/4835e9d/21b0f73; backend suite 86/0/0 with 4 designed skips; live smoke 6/6 PASS)
- [x] 08-02-PLAN.md — Wave 1: OPS-01/02/03 — ops/components.sh registry (indexed-array) + ops/rectrace-ops.sh v2 hardened (shellcheck-clean, set -euo pipefail, actuator readiness probe, bash 3.2+4/5 portable)
- [ ] 08-03-PLAN.md — Wave 2: OPS-04 — ops/ci-smoke.sh Linux portability smoke + .github/workflows/ops-script.yml (ubuntu-latest, [NEEDS USER REVIEW] for Citi-CI swap per D-8.11)
**UI hint**: yes

### Phase 9: Domain Security
**Goal**: The app meets Citi-domain production security posture — locked user-auth, locked service-auth, validated TLS, no public-CDN dependency, and all CRITICAL `CONCERNS.md` items closed.
**Depends on**: Phase 8
**Requirements**: SEC-01, SEC-02, SEC-03, SEC-04, SEC-05, SEC-06, SEC-07, SEC-08
**Success Criteria** (what must be TRUE):
  1. Requests without a portal-validated identity (mechanism locked in this phase: CitiPortal headers / SiteMinder / SPNEGO) are rejected by a Spring Security filter; the previous header-as-truth surface is gone.
  2. Service-auth uses the locked mechanism (Kerberos keytab with rotation runbook *or* Vault with rotation policy); `get_password.sh`-style plaintext retrieval is removed and the chosen mechanism is documented.
  3. ES SSL validation is enabled in all non-dev profiles, the dev-only bypass code path is excluded from production builds, and the internal Citi CA is installed in the JVM truststore with no in-code SSL trust manipulation outside dev.
  4. CORS is configured with an explicit per-environment allow-list (never `*` with credentials), and the Citi-network preflight checklist passes — internal Nexus/Verdaccio/Artifactory used, JVM proxy configured, zero external CDN URLs in the React bundle.
  5. All `CONCERNS.md` CRITICAL items are closed (column-name SQL injection in `OracleServiceV4.buildOrderByClause`, `printStackTrace`, `show_sql=true`, license placeholders).
**Plans**: not yet planned. Phase 9 is **not started** — it is the production security gate.

Scope (from the success criteria above): a user-auth filter (CitiPortal / SiteMinder / SPNEGO) replacing header-as-truth; service-auth (Kerberos keytab or Vault) replacing `get_password.sh`; ES SSL re-enable + Citi CA truststore; CORS per-env allow-list; Citi-network preflight. Note: the CONCERNS.md CRITICAL items this phase was meant to close (column-name SQL injection, CORS `*`, ES SSL bypass, plaintext password) were **already closed during the modernization** — see `.planning/codebase/CONCERNS.md`. What remains for Phase 9 is the auth/identity **enforcement** itself plus the network/TLS hardening.

**Research hint**: yes — the user-auth mechanism (CitiPortal / SiteMinder / SPNEGO) and service-auth mechanism (keytab+Kerberos / Vault) must be researched and locked during phase planning; also Citi-network preflight specifics (internal Nexus/npmrc, proxy at JVM level, internal CA truststore content).

## Post-Milestone Work (landed on `main` after the per-phase history was archived)

These shipped on `main` after Phase 8 and are **not** captured in the archived per-phase `.planning/` docs. They have specs/plans under `docs/superpowers/`:

- **Execution-order redesign** — full React Flow (`@xyflow/react` v12 + dagre) `ExecutionOrderModal` (JobInspector, StatusLegend, QuickFind, minimap). Replaces the Phase-3 placeholder; native graph, not Cytoscape. Specs: `docs/superpowers/specs/2026-05-27-execution-order-*.md`.
- **TLM / QuickRec → RecViz embed** — the bulk of Phase 4's rectrace side (see Phase 4 above). Spec: `2026-05-28-tlm-quickrec-recviz-modals-design.md`.
- **A1a — remove dashboard-config** (2026-05-31) — deleted the category-level `dashboard` config concept (config-only; DTO/types retained). Spec: `2026-05-31-a1a-remove-dashboard-config.md`.
- **Loader extraction** (2026-05-31) — loader moved from `backend/rectrace` into `rectrace-loader/` (:6089). Spec: `2026-05-31-loader-extraction-design.md`.
- **AG-grid styling consistency** (`2026-05-30-ag-grid-styling-consistency-*.md`), **premium search result surface**, **volume seed data**, inline-SVG logo, Citi laptop profile (`CITI-LAPTOP-SETUP.md`).

Full verified current state: `.planning/codebase/CURRENT-STATE-2026-06-12.md`.

## Progress

**Execution Order:**
Phases execute in numeric order: 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9. Phases 5 and 6 are backend-only and may run in parallel with Phases 3–4 by a separate dev; the table reflects logical ordering, not strict serialization.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 0. Foundation | 3/3 | Complete   | 2026-05-12 |
| 0.1. Local Dev Seed Bootstrap (INSERTED) | 7/7 | Complete | 2026-05-12 |
| 1. Backend Platform Upgrade | 8/8 | Complete | 2026-05-12 |
| 2. React Foundation | 5/5 | Complete   | 2026-05-13 |
| 3. React Search Vertical Slice | 8/8 | Complete   | 2026-05-17 |
| 4. RecViz Integration | rectrace side built | In progress — RecViz-side seeding + cross-team contract remaining | partial 2026-05-28 |
| 5. Config-driven SELECT | 6/6 | Complete   | 2026-05-17 |
| 6. ES Loader Subsystem | 5/5 | Complete   | 2026-05-17 |
| 7. Observability Sweep | 5/5 | Complete   | 2026-05-17 |
| 8. Hyphen Bug + Design Polish + Ops Hardening | 3/3 | Complete   | 2026-05-17 |
| 9. Domain Security | 0/TBD | Not started | - |

---
*Roadmap created: 2026-05-12*
*Phase 0 plans created: 2026-05-12*
*Phase 2 plans created: 2026-05-13*
*Phase 3 plans created: 2026-05-17*
