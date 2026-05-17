# Requirements: Rectrace — Modernization Milestone

**Defined:** 2026-05-12
**Core Value:** Users can quickly find Autosys jobs and understand their dependencies and TLM statistics through a unified, performant, design-consistent UI.

## v1 Requirements

Listed in user-stated priority order. v1 = this modernization milestone. Categories and REQ-IDs are stable handles; phase mapping is in the Traceability section.

### Foundation (test gate + parity)

- [ ] **FOUND-01**: Remove `maven.test.skip=true` from `backend/rectrace/pom.xml` and `rectrace-tlm-stats/pom.xml`; switch to explicit `-DskipTests` for manual override only.
- [ ] **FOUND-02**: Add CI gate that fails on `mvn test` failure for both backend modules.
- [ ] **FOUND-03**: Bootstrap minimum test scaffolding — at least one passing Spring context-load test per Maven module.
- [ ] **FOUND-04**: Commit a React↔Angular **parity matrix** mapping every `cellRenderer` × every search category × every grid behavior to `port | drop | replace-with-recviz`. Lives at `.planning/parity-matrix.md` and gates the React phase.

### Backend platform upgrade (Spring Boot 2.7 → 3.2 + Java + cleanup)

- [ ] **BOOT-01**: Bump Java target to 17 (or 21 if Citi VM supports it) in both `pom.xml` files and CI; confirm `mvn -version` matches on dev laptop and target VM.
- [ ] **BOOT-02**: Migrate `backend/rectrace` and `rectrace-tlm-stats` to Spring Boot 3.2.x — parent POM + BOM version + starter alignment.
- [ ] **BOOT-03**: Global `javax.*` → `jakarta.*` namespace migration (servlet, persistence, validation, annotation, ws, transaction).
- [ ] **BOOT-04**: Spring Security migration — replace deprecated `WebSecurityConfigurerAdapter` with `SecurityFilterChain` bean configuration; port the existing `x-citiportal-loginid` filter to the new model (final auth mechanism still locked in Phase 9 / SEC).
- [ ] **BOOT-05**: Spring Data JPA 3 / Hibernate 6 — fix breaking changes (entity manager, repository signatures, named-parameter binding).
- [ ] **BOOT-06**: Elasticsearch client upgrade aligned with Boot 3.2 BOM — existing search code (v3/v4) and bulk indexing path both verified end-to-end.
- [ ] **BOOT-07**: Dependency-pin refresh — Micrometer 1.12+, `logstash-logback-encoder` 8.x (Logback 1.4+), Quartz / ShedLock / JSqlParser versions resolved against Boot 3.2 BOM.
- [ ] **BOOT-08**: Opportunistic cleanup — replace `printStackTrace` with structured logging, remove `show_sql=true`, prune dead code, remove deprecated API usage, address `CONCERNS.md` LOW/MEDIUM items that are cheap under the upgrade.
- [ ] **BOOT-09**: All existing tests (now un-skipped per FOUND-01) pass on 3.2; manual end-to-end smoke confirms search, execution order, TLM stats still work.

### React Foundation (scaffolding + cross-cutting filter)

- [x] **REACT-01**: Scaffold `frontend-react/` with Vite 7 + React 19 + TypeScript 5.6 + shadcn/ui (Tailwind v4).
- [x] **REACT-02**: Wire TanStack Router + TanStack Query + Zustand + React Hook Form + Zod.
- [x] **REACT-03**: Integrate AG-Grid Enterprise via `ag-grid-react` with an SSRM datasource that calls the existing backend search endpoints unchanged.
- [x] **REACT-04**: Single canonical design-tokens file (`tokens.css` + `theme.ts`) aligned with recviz; ESLint rule rejects hex codes in components.
- [x] **REACT-05**: Dark/light mode toggle at feature parity with the existing Angular app.
- [x] **REACT-06**: Build version / SHA visible in app footer for bug-report reference.
- [x] **REACT-07**: Correlation-ID propagation: backend writes `traceId` to MDC (post-BOOT-UPGRADE this uses Micrometer Tracing's native support rather than a hand-rolled filter); React shell sends the ID via `X-Correlation-Id` and renders it in error states ("Error — reference: \<ID\>").
- [x] **REACT-08**: `ops/rectrace-ops.sh` v1 with backend, tlm-stats, and React components registered; no angular component (decommissioned at React go-live per D-2.15 / D-2.17).

### React Vertical Slice — Search

- [x] **SEARCH-01**: Port the **latest** search flow (currently v3/v4) to React end-to-end for one search category, consuming the existing backend without modification.
- [x] **SEARCH-02**: Port at least one custom cell renderer from `custom-interactions/components/renderers/` to React, preserving behavior.
- [ ] **SEARCH-03**: URL-synced search state — every meaningful UI parameter is reflected in / restored from the URL (deep-linkable).
- [x] **SEARCH-04**: Excel export carryover — feature parity with the Angular app's export.
- [x] **SEARCH-05**: Recent searches stored in `localStorage`; show last 10 in a typeahead/dropdown.
- [ ] **SEARCH-06**: All error states display the correlation ID so users can quote it in bug reports.
- [ ] **SEARCH-07**: React app served at `/rectrace/` (no `/v6/` prefix — D-2.4; Angular is decommissioned at React go-live); React and Angular run side-by-side during development only (manual `npm start` in `frontend/rectrace/`).

### recviz Integration

- [ ] **RECVIZ-01**: Written CSP / `frame-ancestors` / `SameSite` cookie / single-SSO contract agreed in writing with the recviz team **before** implementation begins.
- [ ] **RECVIZ-02**: Per-environment recviz origin allow-list (dev / UAT / prod) in config; never `targetOrigin: '*'`.
- [ ] **RECVIZ-03**: Versioned, Zod-validated `postMessage` envelope covering auth handoff, height sync, and navigation events.
- [ ] **RECVIZ-04**: `RecvizFrame` React component using `open-iframe-resizer` (or `rezonant/iframe-resizer`) for height sync, sandboxed.
- [ ] **RECVIZ-05**: Search config supports rendering a tab as a recviz iframe (alongside AG-Grid as the alternate renderer choice).
- [ ] **RECVIZ-06**: Modals can render recviz iframes (parity with the existing execution-order / TLM-stats modal pattern).
- [ ] **RECVIZ-07**: UAT smoke test recorded against the real recviz instance (not localhost) as the phase exit criterion.

### Config-Driven SELECT Queries

- [ ] **SQL-01**: Search configuration supports defining a tab via an arbitrary `SELECT` query authored by devs/admins (not by end users); no in-app SQL editor surface.
- [ ] **SQL-02**: JSqlParser-based startup validation — the application **fails to boot** if any configured query is not a `SELECT` / `WITH` or violates configured shape rules.
- [ ] **SQL-03**: Dedicated read-only Oracle account for these queries; not shared with the existing write-capable datasource.
- [ ] **SQL-04**: Per-statement `setQueryTimeout`, `fetchSize`, and `maxRows` cap enforced inside `SqlQueryServiceV4` (NEVER set on the singleton `JdbcTemplate`).
- [ ] **SQL-05**: Mandatory `WHERE` clause or `FETCH FIRST N ROWS ONLY` injection at executor level — runaway scans rejected.
- [ ] **SQL-06**: `SqlSearchControllerV4` exposes SSRM-shaped responses compatible with the AG-Grid SSRM datasource shape.
- [ ] **SQL-07**: At least one example configured SELECT-tab end-to-end (Angular grid can consume it as a sanity check during transition).

### ES Loader (Oracle → Elasticsearch, scheduled)

- [ ] **LOADER-01**: Multi-job configuration: each job specifies source Oracle `SELECT`, target ES index (or alias), cron schedule, batch size.
- [ ] **LOADER-02**: In-built scheduler — **Quartz JDBC JobStore OR `@Scheduled` + ShedLock** locked during phase planning (see open decision in research SUMMARY).
- [ ] **LOADER-03**: ES indexes accessed via **aliases**, never literal names, from day one of this phase.
- [ ] **LOADER-04**: Idempotent upserts via deterministic `_id` derived from source primary key.
- [ ] **LOADER-05**: New `loader/` package in `backend/rectrace`: `LoaderConfigService`, `LoaderJobRegistry`, `OracleToEsLoaderJob`, `LoaderRunHistoryService`.
- [ ] **LOADER-06**: Per-job last-run state persisted: timestamp, status, row count, last-error message, duration.
- [ ] **LOADER-07**: Run-history view — last 20 runs per job, queryable via admin endpoint.
- [ ] **LOADER-08**: `LoaderAdminControllerV4` endpoints: list jobs, run-now, run-history.
- [ ] **LOADER-09**: Graceful shutdown on JVM signal — in-flight bulk requests flush before exit, no partial-batch loss.
- [ ] **LOADER-10**: Bulk indexing via ES `BulkProcessor` (default batch 5000 rows / 5 MB / 5 s, tunable per job).

### Observability sweep

- [ ] **OBS-01**: `logstash-logback-encoder` (8.x post-BOOT-UPGRADE) configured in `logback-spring.xml` (NEVER `logback.xml`) for `backend/rectrace` and `rectrace-tlm-stats`; JSON logs with `traceId`, `userId`, `path`, `method`, `status`, `durationMs`.
- [ ] **OBS-02**: Custom `HealthIndicator` beans — Oracle reachability, ES reachability, loader-run-age, search-config validity — exposed via `/actuator/health`.
- [ ] **OBS-03**: Actuator endpoints locked down: `management.endpoints.web.exposure.include` is an explicit list (no wildcards); `show-details=when-authorized` or `never`.
- [ ] **OBS-04**: `@Timed`/AOP slow-query logger around `JdbcTemplate` and ES calls; threshold-driven log line emitted.
- [ ] **OBS-05**: Prometheus metrics via `micrometer-registry-prometheus` at `/actuator/prometheus`.
- [ ] **OBS-06**: Correlation ID propagated through `@Async` (`TaskDecorator`), scheduler jobs (fresh `traceId` per fire), and subprocess invocations (`ScriptExecutor`).
- [ ] **OBS-07**: Log aggregator forwarder wired (target — Splunk / ELK / Loki / OTel collector — locked during phase planning).
- [ ] **OBS-08**: Micrometer (1.12+ post-BOOT-UPGRADE) pinned by the Boot BOM; CI guard rejects an override. Micrometer Tracing (Boot 3 native) replaces the hand-rolled correlation ID filter.

### Hyphen / special-char search bug fix

- [ ] **BUG-01**: ES `_analyze` diagnostic captured for the affected field(s); root-cause documented in `.planning/codebase/` or phase notes.
- [ ] **BUG-02**: Fix landed — preferred path: add a `.keyword` subfield (additive, no reindex). Fallback: new analyzer + reindex via alias swap.
- [ ] **BUG-03**: Regression test asserting `ABC-123` (and other documented hyphenated values) return the expected documents.

### Design — shadcn × recviz consistency

- [ ] **DESIGN-01**: Audit of shadcn tokens against recviz design tokens; gaps documented; canonical token file updated.
- [ ] **DESIGN-02**: Visual regression test (Playwright + Percy/Chromatic equivalent OR screenshot diff) at the recviz↔React boundary.
- [ ] **DESIGN-03**: Component coverage parity — every shadcn primitive used in the React app maps to a recviz-style preset.

### Ops script hardening

- [ ] **OPS-01**: `rectrace-ops.sh` passes `shellcheck`; uses `#!/usr/bin/env bash`, `set -euo pipefail`; works on macOS bash 3.2 and Linux bash 4/5; no GNU-only flags.
- [ ] **OPS-02**: Subcommands: `start`, `stop`, `restart`, `status`, `logs` — each operates per-component or all. `start` blocks on a readiness probe (curl against actuator health, not just `kill -0`).
- [ ] **OPS-03**: PID files in `run/`, logs in `logs/`; signal handling correct; idempotent start (no zombie processes); component registry in `ops/components.sh` so adding a process is a one-line change.
- [ ] **OPS-04**: CI job runs the script on Linux to catch portability regressions.

### Domain Security

- [ ] **SEC-01**: User-auth mechanism locked (CitiPortal headers / SiteMinder / SPNEGO — picked during phase planning) and implemented as a Spring Security filter; requests without a portal-validated identity are rejected.
- [ ] **SEC-02**: Service-auth: replace `get_password.sh`-style plaintext credential retrieval with the locked mechanism (Kerberos keytab OR Vault — picked during phase planning).
- [ ] **SEC-03**: ES SSL validation enabled in all non-dev Spring profiles; the dev-only bypass code path removed from production builds.
- [ ] **SEC-04**: Internal Citi CA installed in the JVM truststore; no in-code SSL trust manipulation outside dev profile.
- [ ] **SEC-05**: CORS configured with explicit allowed origins per environment; never `*` with credentials.
- [ ] **SEC-06**: Citi-network preflight checklist completed: internal Nexus / Verdaccio / Artifactory used for all dependencies; JVM-level proxy configured; React bundle audited for external CDN URLs (zero).
- [ ] **SEC-07**: Keytab rotation runbook (owner, expiry, 14-day alert) OR Vault rotation policy documented.
- [ ] **SEC-08**: Close `CONCERNS.md` CRITICAL items — column-name SQL injection in `OracleServiceV4.buildOrderByClause`, `printStackTrace` calls, `show_sql` left on, license-placeholder removal.

## v2 Requirements

Acknowledged but deferred to a later milestone.

### Saved State

- **VIEWS-01**: Backend-persisted saved views (column state + filters + sort), cross-device.
- **VIEWS-02**: Auto-refresh toggle per tab.
- **VIEWS-03**: Job favorites / bookmarks.

### Legacy Cleanup

- **LEGACY-01**: Decommission existing Angular SPA after parity matrix is green.
- **LEGACY-02**: Decommission legacy v1/v2/v3 search controllers superseded by the v4/SQL surface.

### Scale-Out

- **HA-01**: Multi-node `backend/rectrace` deployment; scheduler clustering becomes load-bearing rather than defense-in-depth.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Backend rewrite or service split | Additive features only; no structural backend changes (the Boot upgrade is a version bump, not a structural rewrite) |
| TLM-stats service rewrite | Receives observability work only; stays as-is structurally |
| End-user SQL console | Anti-feature; queries are dev/admin-authored in config |
| Natural-language / LLM query | Anti-feature for an internal data tool |
| Mobile / responsive UI | Desktop browser only |
| Public sharing / social / comments | Anti-feature for an internal tool |
| Drag-drop dashboard builder | Out of scope; users want tables and graphs, not dashboards |
| Built-in chat / notifications | Use existing Citi alerting; do not reinvent |
| Onboarding tour / product analytics | Internal captive users; not needed |
| Modifications to recviz | recviz is a separate app; we integrate only |
| Rewrite of existing Angular SPA | New React project is net-new; Angular stays until parity matrix green |

## Traceability

Each requirement maps to exactly one phase. Filled during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 0 — Foundation | Pending |
| FOUND-02 | Phase 0 — Foundation | Pending |
| FOUND-03 | Phase 0 — Foundation | Pending |
| FOUND-04 | Phase 0 — Foundation | Pending |
| BOOT-01 | Phase 1 — Backend Platform Upgrade | Pending |
| BOOT-02 | Phase 1 — Backend Platform Upgrade | Pending |
| BOOT-03 | Phase 1 — Backend Platform Upgrade | Pending |
| BOOT-04 | Phase 1 — Backend Platform Upgrade | Pending |
| BOOT-05 | Phase 1 — Backend Platform Upgrade | Pending |
| BOOT-06 | Phase 1 — Backend Platform Upgrade | Pending |
| BOOT-07 | Phase 1 — Backend Platform Upgrade | Pending |
| BOOT-08 | Phase 1 — Backend Platform Upgrade | Pending |
| BOOT-09 | Phase 1 — Backend Platform Upgrade | Pending |
| REACT-01 | Phase 2 — React Foundation | Pending |
| REACT-02 | Phase 2 — React Foundation | Complete |
| REACT-03 | Phase 2 — React Foundation | Complete |
| REACT-04 | Phase 2 — React Foundation | Pending |
| REACT-05 | Phase 2 — React Foundation | Complete |
| REACT-06 | Phase 2 — React Foundation | Complete |
| REACT-07 | Phase 2 — React Foundation | Complete |
| REACT-08 | Phase 2 — React Foundation | Complete |
| SEARCH-01 | Phase 3 — React Search Vertical Slice | Complete |
| SEARCH-02 | Phase 3 — React Search Vertical Slice | Complete |
| SEARCH-03 | Phase 3 — React Search Vertical Slice | Pending |
| SEARCH-04 | Phase 3 — React Search Vertical Slice | Complete |
| SEARCH-05 | Phase 3 — React Search Vertical Slice | Complete |
| SEARCH-06 | Phase 3 — React Search Vertical Slice | Pending |
| SEARCH-07 | Phase 3 — React Search Vertical Slice | Pending |
| RECVIZ-01 | Phase 4 — recviz Integration | Pending |
| RECVIZ-02 | Phase 4 — recviz Integration | Pending |
| RECVIZ-03 | Phase 4 — recviz Integration | Pending |
| RECVIZ-04 | Phase 4 — recviz Integration | Pending |
| RECVIZ-05 | Phase 4 — recviz Integration | Pending |
| RECVIZ-06 | Phase 4 — recviz Integration | Pending |
| RECVIZ-07 | Phase 4 — recviz Integration | Pending |
| SQL-01 | Phase 5 — Config-driven SELECT | Pending |
| SQL-02 | Phase 5 — Config-driven SELECT | Pending |
| SQL-03 | Phase 5 — Config-driven SELECT | Pending |
| SQL-04 | Phase 5 — Config-driven SELECT | Pending |
| SQL-05 | Phase 5 — Config-driven SELECT | Pending |
| SQL-06 | Phase 5 — Config-driven SELECT | Pending |
| SQL-07 | Phase 5 — Config-driven SELECT | Pending |
| LOADER-01 | Phase 6 — ES Loader Subsystem | Pending |
| LOADER-02 | Phase 6 — ES Loader Subsystem | Pending |
| LOADER-03 | Phase 6 — ES Loader Subsystem | Pending |
| LOADER-04 | Phase 6 — ES Loader Subsystem | Pending |
| LOADER-05 | Phase 6 — ES Loader Subsystem | Pending |
| LOADER-06 | Phase 6 — ES Loader Subsystem | Pending |
| LOADER-07 | Phase 6 — ES Loader Subsystem | Pending |
| LOADER-08 | Phase 6 — ES Loader Subsystem | Pending |
| LOADER-09 | Phase 6 — ES Loader Subsystem | Pending |
| LOADER-10 | Phase 6 — ES Loader Subsystem | Pending |
| OBS-01 | Phase 7 — Observability Sweep | Pending |
| OBS-02 | Phase 7 — Observability Sweep | Pending |
| OBS-03 | Phase 7 — Observability Sweep | Pending |
| OBS-04 | Phase 7 — Observability Sweep | Pending |
| OBS-05 | Phase 7 — Observability Sweep | Pending |
| OBS-06 | Phase 7 — Observability Sweep | Pending |
| OBS-07 | Phase 7 — Observability Sweep | Pending |
| OBS-08 | Phase 7 — Observability Sweep | Pending |
| BUG-01 | Phase 8 — Hyphen Bug + Design Polish + Ops Hardening | Pending |
| BUG-02 | Phase 8 — Hyphen Bug + Design Polish + Ops Hardening | Pending |
| BUG-03 | Phase 8 — Hyphen Bug + Design Polish + Ops Hardening | Pending |
| DESIGN-01 | Phase 8 — Hyphen Bug + Design Polish + Ops Hardening | Pending |
| DESIGN-02 | Phase 8 — Hyphen Bug + Design Polish + Ops Hardening | Pending |
| DESIGN-03 | Phase 8 — Hyphen Bug + Design Polish + Ops Hardening | Pending |
| OPS-01 | Phase 8 — Hyphen Bug + Design Polish + Ops Hardening | Pending |
| OPS-02 | Phase 8 — Hyphen Bug + Design Polish + Ops Hardening | Pending |
| OPS-03 | Phase 8 — Hyphen Bug + Design Polish + Ops Hardening | Pending |
| OPS-04 | Phase 8 — Hyphen Bug + Design Polish + Ops Hardening | Pending |
| SEC-01 | Phase 9 — Domain Security | Pending |
| SEC-02 | Phase 9 — Domain Security | Pending |
| SEC-03 | Phase 9 — Domain Security | Pending |
| SEC-04 | Phase 9 — Domain Security | Pending |
| SEC-05 | Phase 9 — Domain Security | Pending |
| SEC-06 | Phase 9 — Domain Security | Pending |
| SEC-07 | Phase 9 — Domain Security | Pending |
| SEC-08 | Phase 9 — Domain Security | Pending |

**Coverage:**
- v1 requirements: 67 total (across 12 categories)
- Mapped to phases: 67 ✓
- Unmapped: 0

---
*Requirements defined: 2026-05-12*
*Last updated: 2026-05-12 after roadmap creation*
