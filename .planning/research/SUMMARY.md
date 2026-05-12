# Project Research Summary

**Project:** Rectrace — React modernization milestone
**Domain:** Internal enterprise data-exploration tool (Citi-internal) — net-new React SPA + additive Spring Boot 2.7 backend features (config-driven SELECT, Oracle→ES scheduled loader, observability, ops script, Citi-domain security), with recviz embedded via iframe.
**Researched:** 2026-05-12
**Confidence:** HIGH overall — most decisions are grounded in the existing codebase, verified Context7/official docs, and well-established Spring Boot 2.7 / React 19 patterns. Specific Citi-infra choices (log aggregator target, user-auth mechanism, service-auth mechanism) are explicitly deferred.

## Executive Summary

This is **not a greenfield build** — it's a modernization milestone bolted onto a working three-tier Citi-internal app (Spring Boot 2.7.16 + Angular 16 + standalone TLM-stats service). The product is an Excel-grade, Splunk-grade internal data tool for captive users (Citi operators and search users); table-stakes are AG-Grid SSRM, deep-linkable URLs, structured search, and operability. The active scope is **9 items**: React migration (net-new, mirroring recviz), recviz iframe embed, hyphen search bug fix, config-driven arbitrary-SELECT tabs, shadcn design system, observability sweep, Oracle→ES scheduled loader, single bash ops script, and Citi-domain security.

**The recommended approach is vertical-slice strangler-fig**, not big-bang. A thin foundation (Vite + React 19 + shadcn + AG-Grid React + TanStack Query + Router, plus a `CorrelationIdFilter` and the ops script registry) lands first. Then end-to-end slices ship one tab at a time — first a ported V4 search tab (validates React+SSRM+backend), then a recviz iframe tab (surfaces the highest-uncertainty integration early). Backend features (`SqlSearchControllerV4` for arbitrary SELECT, `loader/` subsystem for Oracle→ES) can land in parallel because they have no React dependency. Observability is a horizontal sweep landed *after* there's enough to observe but *before* loader operationalizes. Bug fix, design polish, and ops hardening close out the milestone.

**The dominant risks are: (1) React app shipping without Angular feature parity** and Angular becoming the permanent production path — mitigated by a Phase-0 parity matrix and a committed Angular decommission date; **(2) the recviz iframe breaking in production** on CSP / SameSite cookies / SSO challenge — mitigated by a written contract with the recviz team plus a UAT smoke test, never localhost demo; **(3) config-driven SELECT becoming a SQL-injection / runaway-scan / data-loss vector** — mitigated by parser-based validation, a dedicated read-only DB user, mandatory statement timeout, and a `WHERE`/`ROWNUM` cap; **(4) the ES analyzer "fix" for the hyphen bug requiring a full reindex stall** — mitigated by `.keyword` subfield + alias indirection from day one; **(5) `maven.test.skip=true` letting silent regressions ship** — mitigated by removing the skip flag as the first commit of the milestone. A tactical question that researchers disagreed on — **Quartz JDBC JobStore vs `@Scheduled` + ShedLock for the loader** — is surfaced as an open decision below; both are defensible and the choice hinges on whether durable misfire state and an admin trigger UI are required.

## Key Findings

### Recommended Stack

The new React SPA stands on a 2026-canonical foundation; the existing Spring Boot 2.7 backend gets minimal-deps observability and a deliberately lightweight scheduler. The full table is in [STACK.md](STACK.md).

**Core technologies (new React frontend):**
- **React 19.2.x + TypeScript 5.6 + Vite 7** — Vite 8/Rolldown deferred until shadcn/Tailwind/plugin compat re-verified against Citi Verdaccio mirror.
- **TanStack Router 1.114+ + TanStack Query 5.90+** — type-safe routing with first-class search-param state (matches existing URL-sync pattern); standard 2026 server-state layer (replaces RxJS `BehaviorSubject` plumbing).
- **Zustand 5** for client-only state, **React Hook Form 7 + Zod 3** for forms + runtime schema validation at the API boundary.
- **shadcn/ui (Tailwind v4)** — mandated by `DESIGN-SHADCN`; copy-in model is ideal for an air-gapped Verdaccio environment; aligns visually with recviz.
- **AG-Grid Enterprise 33 + ag-grid-react** — **keep, don't replace**. SSRM, server-side grouping, Excel export, and the existing Enterprise license make this the highest-value carry-over. TanStack Table is only the right answer for ancillary tables (<10K rows, no SSRM).
- **Cytoscape.js + cytoscape-dagre** — direct port from Angular for the execution-order graph.
- **Vitest 2 + Testing Library + Playwright + MSW** — replaces Karma/Jasmine.

**Core technologies (backend additions, Spring Boot 2.7.16 stays):**
- **Observability**: `spring-boot-starter-actuator` (already partial in TLM-stats), **Micrometer 1.9.x** (pinned by Boot 2.7 BOM — must NOT be overridden), `micrometer-registry-prometheus`, **logstash-logback-encoder 7.4** (last Logback-1.2-compatible release; targets the `logback-spring.xml`, never `logback.xml`), and a hand-written `CorrelationIdFilter` (~30 LOC) rather than the deprecated Spring Cloud Sleuth.
- **Scheduler — open decision** (see below): either **`@Scheduled` + ShedLock 5** (Stack.md / Pitfalls.md option B) OR **Quartz with Oracle JDBC JobStore** (Architecture.md). Both researchers agree the choice must be made before ES-LOADER implementation begins.
- **Config SQL execution**: `NamedParameterJdbcTemplate` with per-statement `setQueryTimeout` (NEVER on the singleton `JdbcTemplate`), `fetchSize=500`, `maxRows` cap, `@Transactional(readOnly=true, propagation=REQUIRES_NEW)`, plus a **startup-time SQL parser guard** (JSqlParser or equivalent) — regex-based "is-this-SELECT" is rejected by both Architecture.md and Pitfalls.md.

**Embedding recviz:**
- **iframe + `postMessage`**, NOT Module Federation, NOT single-spa — forced by the "no recviz modifications" constraint.
- **`open-iframe-resizer`** (MIT) or `rezonant/iframe-resizer` (MIT) — the original `iframe-resizer` v5 went GPLv3 and is incompatible with Citi closed-source. Subject to Citi OSS-review.
- Strict origin allow-listing per environment, versioned Zod-validated message envelope, sandboxed iframe, CSP `frame-ancestors` coordination with recviz team.

### Expected Features

The product already ships V4 search, AG-Grid SSRM, the execution-order graph, the TLM stats modal, Excel export, URL-synced search state, and dark/light mode — those are **port-only** to React, not re-scope. Full feature inventory in [FEATURES.md](FEATURES.md).

**Must have — table stakes (missing = complaint):**
- Port of V4 search flow + parallel ES + SSRM grid to React (without this, there's no app)
- Hyphen search bug fix (SEARCH-BUG-HYPHEN — daily user complaint)
- Excel export carryover (non-negotiable for Excel-native users)
- URL-synced search state / deep linking (internal collab = pasting URLs)
- Dark/light mode (already shipped; do not regress)
- Recent searches (`localStorage`) and typeahead
- Correlation-ID-aware error states ("Error — reference: <ID>")
- Build-version/SHA visible in footer (for bug reports)
- `/actuator/health` + `/info` with build SHA + structured JSON logs with MDC fields
- Loader operator UX: list jobs, last-run timestamp + status + row-count, run-now endpoint, per-job error message, idempotent upserts (deterministic ES `_id` from source PK)

**Should have — differentiators:**
- Saved views per-tab (column state + filters + sort, `localStorage` first, backend later)
- Configurable SELECT-query tabs (CONFIG-DIRECT-SQL — admin authoring, not end-user SQL)
- recviz embedded as alternate view in modals (RECVIZ-INTEGRATION)
- Keyboard shortcuts (`/` focus search, `Esc` close, `Ctrl+K` command palette)
- Loader run-history view (last 20 runs with status sparkline)
- Slow-query log surfaced to operators

**Defer (v2+ or later milestones):**
- Backend-persisted saved views (cross-device) — `localStorage` suffices initially
- Auto-refresh toggle / job favorites — confirm operator demand first
- Decommission of v3 search controller
- Mobile UI (explicit out-of-scope)

**Explicitly anti-features (do not build):**
End-user SQL console; NL/LLM query; public sharing; in-app social/comments; notifications/alerting (link to existing Autosys/monitoring); drag-drop dashboard builder; built-in chat; onboarding tour. The temptation when modernizing is to add consumer-app features — resist.

### Architecture Approach

A net-new React SPA at `frontend-react/` (peer to the legacy `frontend/`) embedding recviz via an `<iframe>` with a strict origin-checked `postMessage` contract. The existing Spring Boot backend at `backend/rectrace` grows two new endpoint families (`/api/v4/search/sql/*` for arbitrary-SELECT tabs, `/api/loader/*` for the scheduled-loader admin surface) and a new `loader/` package — the loader is a **package inside the existing JAR**, not a separate service, because a 1–3 dev team on a single Citi VM doesn't yet need the operational cost of a second deployable. Observability is additive across both `backend/rectrace` and `rectrace-tlm-stats`. A single `ops/rectrace-ops.sh` with a `components.sh` registry is the operations surface, portable across macOS dev laptop and Citi Linux VM. Full diagrams and rationale in [ARCHITECTURE.md](ARCHITECTURE.md).

**Major components:**
1. **React shell** (new, `frontend-react/`) — Vite + React 19 + shadcn + AG-Grid React; hosts search tabs, recviz iframe panels, modals; mirrors recviz design language.
2. **Recviz iframe panel** — `<iframe>` with bidirectional, origin-validated, Zod-typed `postMessage` (auth handoff, height sync, navigation events).
3. **`SqlQueryServiceV4` + `SqlSearchControllerV4`** (new in backend) — config-driven arbitrary-SELECT executor with bounded resources, SSRM-shaped output, startup parser validation.
4. **ES Loader subsystem** (new package `loader/` in backend) — config-driven (each job: index + SELECT + schedule), with per-job last-run state, run-history, manual trigger endpoint, idempotent ES upserts via deterministic `_id`.
5. **Observability cross-cut** — `CorrelationIdFilter` writing to MDC; logstash-logback JSON encoder; `HealthIndicator` beans for Oracle/ES/loader/search-config; Prometheus metrics via Actuator; slow-query timer.
6. **`rectrace-ops.sh`** (new `ops/`) — single bash entry point: start/stop/restart/status/logs per component, PID files in `run/`, logs in `logs/`, readiness probe via `curl` against actuator health (not just `kill -0`).

**Key patterns:**
- Strangler-fig migration: Angular keeps running, React lives at a distinct URL prefix (e.g. `/v6/`), parity matrix gates Angular shutdown.
- Reverse-proxy recviz to same-origin in production where possible (eliminates third-party cookie pain); cross-origin only with negotiated `SameSite=None; Secure` cookies AND `frame-ancestors` CSP.
- ES indexes accessed via **aliases**, never literal names — required to support the hyphen-bug reindex without downtime.
- Single canonical token file for shadcn theming (`tokens.css` / `theme.ts`); zero hex codes in components (lint-enforced) to prevent recviz↔React design drift.

### Critical Pitfalls

Top 5 from [PITFALLS.md](PITFALLS.md) (10 total in that file):

1. **React app reaches "looks ready" without Angular parity, and Angular becomes the permanent production path.** Avoid via a Phase-0 parity matrix (every `cellRenderer` string in `search-config.json` × every category × every V5 grid behavior, marked `port | drop | replace-with-recviz-iframe`) and a committed Angular decommission date on the roadmap.
2. **iframe embedding of recviz breaks in production** due to CSP `frame-ancestors`, `SameSite` cookies, or a second SSO challenge inside the frame. Avoid via a written contract with the recviz team (CSP/XFO/cookie/SSO), strict `targetOrigin` (never `'*'`), `event.origin` validation in every listener, and a UAT smoke test as phase exit criterion.
3. **Config-driven SELECT becomes a SQL-injection / runaway-scan / data-loss vector.** "SELECT-only" via regex is rejected. Avoid via parser-based validation (JSqlParser at startup, fail-fast app boot if invalid), a **dedicated read-only DB user**, mandatory `setQueryTimeout` on the `PreparedStatement` (NEVER on singleton `JdbcTemplate`), mandatory `WHERE` clause OR `FETCH FIRST N ROWS ONLY` injection, named parameter binding, and EXPLAIN PLAN in CI for any new configured query.
4. **Hyphen bug fix stalls for two weeks** because the team tries to alter an analyzer on an existing index (immutable in ES) and ends up reindexing during a loader run. Avoid via `_analyze` diagnostic first, prefer a `.keyword` subfield (additive, allowed on existing index), and **establish alias indirection from day one** so any future reindex is a single atomic alias swap.
5. **`maven.test.skip=true` lets silent regressions ship.** Avoid by removing the skip flag in the FIRST commit of the milestone, adding a CI gate that fails on test red, and bootstrapping minimum scaffolding (one passing context-load test) before any feature work.

Additional high-impact pitfalls covered in PITFALLS.md: shadcn token drift from recviz (#2), scheduler overlap/drift/loss (#6 — directly intersects the open decision below), observability misconfig including Logback pattern conflicts and Micrometer-version-override (#7), bash script portability and PID footguns (#8), Citi-network deploy gotchas — proxy, no public CDN, Kerberos keytabs, internal CA truststore (#9).

## Open Decisions

### ES Loader scheduler: Quartz vs `@Scheduled` + ShedLock

The researchers disagree, and the disagreement is substantive — both options are defensible and the right answer depends on requirements that aren't yet locked. **This must be decided before ES-LOADER implementation begins (Phase E in the suggested ordering).** Pitfalls.md explicitly flags this as a "Phase-1 decision, not a Phase-N rescue."

| Aspect | `@Scheduled` + ShedLock (Stack.md) | Quartz JDBC JobStore (Architecture.md) |
|--------|------------------------------------|----------------------------------------|
| Cron triggers | Yes (Spring 6-field, with `zone=`) | Yes |
| Durable state across JVM restart | NO — config re-loaded at startup; last-run state must be hand-rolled in a separate table | Yes — Quartz persists job/trigger state in `QRTZ_*` tables |
| Misfire policy (catch-up vs skip after downtime) | Basic — must implement manually | Sophisticated — per-trigger `MISFIRE_INSTRUCTION_*` |
| Multi-instance leader election | Via ShedLock JDBC lock (defensive) | Native via `isClustered=true` |
| Manual trigger endpoint | Build it yourself | Native — Quartz scheduler API exposes `triggerJob()` |
| New DB tables required | 1 (`shedlock`) + 1 hand-rolled `loader_state` | ~11 (`QRTZ_*` prefix) |
| Per-job concurrency control | Hand-rolled (or rely on `@Scheduled`'s single-threaded scheduler default) | Native via `@DisallowConcurrentExecution` |
| Boilerplate | Minimal — annotation + `@SchedulerLock` | Higher — JobDetail, Trigger, SchedulerFactoryBean, AutowiringSpringBeanJobFactory |
| Operational complexity | Low | Medium |

**Decision criteria:**
- **Pick `@Scheduled` + ShedLock IF**: deployment is genuinely single-VM-per-env (PROJECT.md implies this but should be confirmed); idempotent re-runs are acceptable so missed-run replay isn't needed; admin trigger / per-job pause-resume UX is not a v1 requirement; minimizing new dependency surface matters more than out-of-the-box features.
- **Pick Quartz IF**: durable misfire recovery is required ("job missed at 2am due to maintenance — fire it when you come back up"); the admin loader-status / run-now / per-job pause UI is a v1 must-have (FEATURES.md classifies these as table stakes for operators); future HA is anticipated within this milestone or the next; the ~11 extra Oracle tables are acceptable.

**Recommendation for the roadmapper:** treat this as a planning-phase decision inside ES-LOADER phase planning (`/gsd-plan-phase`). Both researchers agree it must be locked before implementation. Either choice is defensible; the choice cannot be skipped.

### Other deferred decisions (already deferred in PROJECT.md, surfaced here for visibility)

- **User-auth mechanism** (CitiPortal headers vs SiteMinder vs SPNEGO) — deferred to DOMAIN-SECURITY phase. Blocks production; informs the recviz iframe auth-handoff contract.
- **Service-auth mechanism** (Kerberos keytab+rotation vs Vault vs scripts) — deferred to DOMAIN-SECURITY phase. Replaces the existing `get_password.sh` smell.
- **Log aggregator target** (Splunk vs ELK vs Loki) — deferred to OBSERVABILITY phase, but JSON logs + Prometheus emit are forward-compatible with any target. Drives the forwarder config in OPS-SCRIPT.
- **iframe-resizer fork** (`open-iframe-resizer` vs `rezonant/iframe-resizer`) — both MIT; pick whichever has more recent activity at evaluation; subject to Citi OSS review.
- **Single-node vs multi-node deployment for `backend/rectrace`** — determines whether ShedLock / Quartz clustering is defense-in-depth or load-bearing.

## Implications for Roadmap

Based on the four research files and the cross-cutting dependency map in FEATURES.md and ARCHITECTURE.md, the suggested phase structure follows **vertical-slice strangler-fig**, with backend-only phases parallelizable against frontend phases. Architecture.md's "Build Order" section is the canonical reference.

### Phase 0: Test gate + parity matrix (prerequisite — small)
**Rationale:** PITFALLS.md #10 and #1 both demand this as a Phase-0 prerequisite. `maven.test.skip=true` must be removed and replaced with `-DskipTests` for explicit manual skip only; CI gate added; minimum scaffolding (one passing context-load test) bootstrapped. Separately, the **React-Angular parity matrix** (every `cellRenderer` × every category × every V5 grid behavior, marked `port | drop | replace`) is committed before any React code lands.
**Delivers:** Green CI on `mvn test`; parity-matrix.md committed.
**Avoids:** Pitfalls #1, #10.

### Phase 1: React foundation (thin) + ops script skeleton + correlation-ID filter
**Rationale:** Minimum scaffolding so subsequent vertical slices can land without re-doing setup. Architecture.md Phase A. Do NOT over-build — point is to enable feature slices, not to land all observability.
**Delivers:** `frontend-react/` scaffolded with Vite 7 + React 19 + shadcn + AG-Grid React + TanStack Query/Router; `ops/rectrace-ops.sh` v1 with backend / tlm-stats / angular components registered (React added once `npm run dev` works); `CorrelationIdFilter` in backend writing to MDC.
**Uses:** STACK.md Section A core; STACK.md Section C correlation ID filter.
**Implements:** ARCHITECTURE.md `frontend-react/` peer-directory structure, ops registry pattern.
**Avoids:** Pitfalls #2 (token-driven theme established before components), #8 (ops script designed correctly from day one).

### Phase 2: First vertical slice — React V4 search tab
**Rationale:** Proves React + shadcn + AG-Grid SSRM + backend integration with zero new backend code. Discovers shadcn/Tailwind friction, AG-Grid React API differences, and recviz design-token alignment early. Architecture.md Phase B.
**Delivers:** One search category ported end-to-end to React; one custom renderer ported; Angular still default route, React behind `/v6/` (or feature URL); URL-synced search state working.
**Addresses:** FEATURES.md P1 — port V4 search flow + SSRM grid, deep-linkable URL state, Excel export carryover, dark/light mode, build-version footer, recent searches.
**Avoids:** Pitfall #1 (vertical slice forces actual feature port, not infrastructure-only progress).

### Phase 3: Second vertical slice — recviz iframe tab (HIGHEST UNCERTAINTY — research-phase candidate)
**Rationale:** Recviz is the highest-uncertainty integration. Surface origin / auth / CSP / cookie issues as early as possible. PITFALLS.md #3 names a written contract with the recviz team as the blocking prerequisite.
**Delivers:** `RecvizFrame` component with full Zod-validated `postMessage` contract (auth handoff, height sync, navigation events); `recviz-tabs.json` config; one tab rendering recviz; UAT smoke test recorded; coordinated `frame-ancestors` header on recviz side.
**Uses:** STACK.md Section B (`open-iframe-resizer`, Zod, native `postMessage`).
**Implements:** ARCHITECTURE.md Pattern 1 (iframe + postMessage contract).
**Avoids:** Pitfall #3.
**Research flag:** Phase planning should include `/gsd-research-phase` to nail down (a) recviz's CSP/cookie/SSO posture, (b) which Citi network topology applies (same-origin reverse proxy vs subdomain vs cross-origin), (c) iframe-resizer fork selection post-OSS-review.

### Phase 4: Config-driven arbitrary SELECT (backend-only — parallelizable)
**Rationale:** Net-new backend feature with no React dependency; can be developed in parallel with Phases 2–3 by a different dev. Architecture.md Phase D.
**Delivers:** `SqlSearchControllerV4` + `SqlQueryServiceV4` + `sql-search-config.json` + JSqlParser-based startup validation guard + dedicated read-only DB user + per-statement timeout + `WHERE`/`ROWNUM` enforcement; one example configured query end-to-end (Angular grid can consume for sanity check).
**Addresses:** FEATURES.md P2 — CONFIG-DIRECT-SQL.
**Implements:** ARCHITECTURE.md Pattern 2 (Config-Driven Arbitrary SELECT with Bounded Resources).
**Avoids:** Pitfall #5.

### Phase 5: ES Loader subsystem (backend-only — parallelizable; CONTAINS OPEN DECISION)
**Rationale:** Largest single new package; self-contained; can run parallel to React work. Architecture.md Phase E. **Phase planning must lock the Quartz vs `@Scheduled`+ShedLock decision (see Open Decisions above).**
**Delivers:** Scheduler config (Quartz JDBC store + 11 `QRTZ_*` tables OR `@Scheduled` + ShedLock + 1 `shedlock` table + 1 `loader_state` table) + `LoaderConfigService` + `LoaderJobRegistry` + `OracleToEsLoaderJob` + `LoaderRunHistoryService` + `LoaderAdminControllerV4` (list/trigger/run-history); one configured loader job end-to-end; **ES alias indirection** in place from day one (Pitfalls #4 prerequisite); idempotent upserts via deterministic `_id`.
**Addresses:** FEATURES.md P2 — ES-LOADER + loader operator UX (last-run, run-now, error visibility).
**Implements:** ARCHITECTURE.md Pattern 3 (Quartz JDBC JobStore) OR STACK.md Section D (`@Scheduled` + ShedLock).
**Avoids:** Pitfalls #4 (alias indirection), #6 (scheduler overlap/drift/loss).
**Research flag:** Phase planning needs `/gsd-research-phase` to lock the scheduler decision based on the matrix above, plus verify ShedLock 5.x JDBC provider works against the existing Oracle datasource OR Quartz Oracle delegate config.

### Phase 6: Observability sweep (horizontal cross-cut)
**Rationale:** Most valuable when there are multiple subsystems to instrument. Doing this *after* Phases 2–5 means we instrument once, not three times. Architecture.md Phase F. PITFALLS.md #7 names log-aggregator-target selection as a Phase-0 decision *within* this phase — must be picked before code lands.
**Delivers:** Logback JSON encoder via logstash-logback-encoder 7.4 in `backend/rectrace` AND `rectrace-tlm-stats` (via `logback-spring.xml`, never `logback.xml`); custom `HealthIndicator` beans (Oracle, ES, loader run age, search config validity); `@Timed`/AOP slow-query logger around `JdbcTemplate`; actuator lockdown (`exposure.include` explicit, no wildcards; `show-details=when-authorized` or `never`); correlation ID propagation through `@Async` (`TaskDecorator`) and into Quartz/scheduled jobs (fresh `traceId` per job start) and subprocess (`ScriptExecutor`).
**Addresses:** FEATURES.md P2 — OBSERVABILITY.
**Uses:** STACK.md Section C.
**Implements:** ARCHITECTURE.md Pattern 5.
**Avoids:** Pitfall #7.
**Research flag:** Phase planning needs `/gsd-research-phase` to lock log-aggregator target (Splunk if Citi standardizes on it; ELK; Loki). Drives the forwarder config in Phase 7. JSON-logs-to-file is forward-compatible.

### Phase 7: SEARCH-BUG-HYPHEN fix + design-shadcn polish + OPS-SCRIPT hardening
**Rationale:** Cleanup / polish. Architecture.md Phase G. Hyphen fix benefits from alias indirection landed in Phase 5; design-shadcn polish closes the recviz↔React visual gap; ops script hardens against the macOS↔Linux portability and PID-footgun pitfalls.
**Delivers:** ES analyzer change (`.keyword` subfield preferred; reindex via alias swap if truly required); regression test asserting `ABC-123` finds expected doc; visual regression test at recviz↔React boundary; ops script passing `shellcheck` + Linux CI + `start` blocks on readiness probe + signal handling + portability (`#!/usr/bin/env bash`, `set -euo pipefail`, no GNU-only flags).
**Addresses:** FEATURES.md P1 — SEARCH-BUG-HYPHEN; DESIGN-SHADCN polish; FEATURES.md P2 — OPS-SCRIPT.
**Avoids:** Pitfalls #2, #4, #8.

### Phase 8: DOMAIN-SECURITY
**Rationale:** Gates production deployment per PROJECT.md. Replaces `x-citiportal-loginid` header-as-truth, `get_password.sh` plaintext credentials, ES SSL bypass in `ElasticsearchDevConfiguration`, CORS `*`-with-credentials. Specific mechanisms (CitiPortal vs SiteMinder vs SPNEGO; keytab+Kerberos vs Vault) are still deferred and must be locked here.
**Delivers:** User-auth filter rejecting requests without portal-injected, validated header; service-auth mechanism with keytab rotation runbook (owner, expiry, 14-day alert) OR Vault integration; internal Citi CA in JVM truststore; ES SSL validation re-enabled in all non-dev profiles; CORS explicit allowed origins; Citi-network preflight checklist (npm/Maven internal repo, proxy at JVM level, no external CDN URLs in React bundle).
**Addresses:** FEATURES.md P2 — DOMAIN-SECURITY; closes Pitfalls #9 and CONCERNS.md CRITICAL items.
**Research flag:** Phase planning needs `/gsd-research-phase` to research Citi-standard auth (CitiPortal forwarding vs SiteMinder vs SPNEGO) and Citi-standard service-auth (Kerberos keytab vs Vault), informed by what's actually deployed at Citi.

### Phase Ordering Rationale

- **Strangler-fig vertical-slice over big-bang** — PITFALLS.md #1 + ARCHITECTURE.md "Why this order" both reject horizontal sweeps that delay user-visible value. Each of Phases 2–5 ships an end-to-end increment.
- **Parallelizable backend work (Phases 4, 5) against frontend work (Phases 2, 3)** — for a 1–3 dev team, this matters. Phase 4 (`SqlSearchControllerV4`) and Phase 5 (loader) have no React dependency and can run in parallel with the React vertical slices.
- **Observability after enough exists to observe (Phase 6, not Phase 1)** — but the correlation-ID filter ships in Phase 1 as a foundation. FEATURES.md notes "OBSERVABILITY should land before ES-LOADER goes into ops" — Phase 6 lands before Phase 7's ops-script hardening uses the health endpoints.
- **DOMAIN-SECURITY last (Phase 8)** because it gates production but not development, and because run-now endpoints from Phase 5 depend on at-least-minimal auth — but the security model itself is contained in this phase. Some Phase-8 deliverables (internal-CA truststore, no-external-CDN audit) cross-cut every prior phase; treat them as ongoing hygiene with the final lock-in at Phase 8.
- **Phase 0 prerequisite enforced** — `maven.test.skip=true` removal and parity matrix are not negotiable; both are roadmap-level Phase-0 items per PITFALLS.md #1 and #10.

### Research Flags

Phases likely needing deeper research during planning (`/gsd-research-phase`):
- **Phase 3 (recviz iframe):** recviz CSP/cookie/SSO posture, Citi network topology between the two apps, iframe-resizer fork OSS-review outcome. Highest-uncertainty integration in the milestone.
- **Phase 5 (ES Loader):** **lock the Quartz vs `@Scheduled`+ShedLock decision** based on the open-decision criteria above; verify single-instance deployment assumption; confirm ShedLock 5.x or Quartz Oracle delegate compat with installed driver.
- **Phase 6 (Observability):** lock the log-aggregator target (Splunk / ELK / Loki / OpenTelemetry collector) based on what Citi standardizes on; confirm Micrometer 1.9.x stays BOM-resolved.
- **Phase 8 (Domain Security):** Citi-standard user-auth (CitiPortal / SiteMinder / SPNEGO) and service-auth (keytab+Kerberos / Vault); Citi-network preflight (internal Nexus/npmrc, proxy, internal CA truststore).

Phases with standard patterns (skip research-phase, planning-only sufficient):
- **Phase 0:** removing `maven.test.skip` is a one-line `pom.xml` change; parity matrix is investigation, not research.
- **Phase 1:** React/Vite/shadcn/TanStack scaffolding is heavily documented in STACK.md Section A; standard 2026 setup.
- **Phase 2:** AG-Grid SSRM + V4 search is a direct port of the existing Angular pattern; backend is unchanged.
- **Phase 4:** Arbitrary-SELECT with JSqlParser + read-only user + per-statement timeout is well-documented in ARCHITECTURE.md Pattern 2; STACK.md confirms libraries.
- **Phase 7:** Hyphen-bug fix via `.keyword` subfield + alias indirection is documented in PITFALLS.md #4 recovery; ops-script hardening is mechanical checklist work.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Context7-verified for React/Vite/TanStack/shadcn/Zustand/ShedLock/Quartz/Micrometer/logstash-logback-encoder. MEDIUM only for log-aggregator target (Citi-infra-dependent) and iframe-resizer fork (OSS-review-dependent). |
| Features | HIGH | Table stakes, anti-features, loader operator UX, observability minimums all triangulated across Spring Boot, AG-Grid, ETL tooling, enterprise search peer sources. Differentiators MEDIUM (would benefit from user-interview pass; deferred until after launch validation). |
| Architecture | HIGH | Component boundaries and data flow are grounded in the existing codebase (`.planning/codebase/ARCHITECTURE.md`) and Citi-VM deployment constraints. MEDIUM only for the keep-vs-split decisions (calibrated to 1–3 dev team). |
| Pitfalls | HIGH | Most pitfalls are grounded in the existing `.planning/codebase/CONCERNS.md` and verified against Spring Boot / Quartz / ES / iframe behavior. MEDIUM only for items dependent on the still-undecided observability/auth stack. |

**Overall confidence:** HIGH. The milestone is well-mapped. Deferred decisions are explicit and bounded.

### Gaps to Address

- **Quartz vs `@Scheduled`+ShedLock for ES loader** — open decision (see above). Must lock in Phase 5 planning before implementation. Both are defensible; the choice is criteria-driven.
- **Log aggregator target** (Splunk / ELK / Loki / OTel collector) — deferred to Phase 6 planning. JSON logs to file is forward-compatible until the target is picked.
- **User-auth mechanism** (CitiPortal / SiteMinder / SPNEGO) — deferred to Phase 8 planning. Blocks production; informs Phase 3 recviz auth handoff contract.
- **Service-auth mechanism** (keytab / Vault) — deferred to Phase 8 planning. Replaces `get_password.sh`.
- **iframe-resizer fork selection** (`open-iframe-resizer` vs `rezonant/iframe-resizer`) — both MIT; pick at evaluation time subject to Citi OSS review.
- **Single-node vs multi-node `backend/rectrace` deployment** — PROJECT.md implies single VM per env but should be confirmed; determines whether scheduler clustering is defense-in-depth or load-bearing.
- **AG-Grid Enterprise license renewal scope** — existing license covers Angular; need explicit confirmation it covers `ag-grid-react` use in the new app.
- **Citi Verdaccio / Artifactory coverage** — confirm every npm and Maven dep listed in STACK.md is mirrored; lock `package-lock.json` against the internal mirror.
- **recviz origin URLs per environment (dev/UAT/prod)** — required for the iframe origin allow-list before Phase 3 implementation; must be obtained from recviz team.

## Sources

### Primary (HIGH confidence)

- Context7: `/vitejs/vite`, `/tanstack/router`, `/tanstack/query`, `/tanstack/table`, `/shadcn-ui/ui`, `/pmndrs/zustand`, `/lukas-krecan/shedlock`, `/quartz-scheduler/quartz`, `/micrometer-metrics/micrometer`, `/logfellow/logstash-logback-encoder`
- Official docs: Vite 7/8 release notes; shadcn/ui Vite install; Spring Boot Reference (Quartz, Actuator); Quartz JDBC JobStore Clustering Configuration; ShedLock README; AG Grid React/SSRM/Column State docs; Spring Boot Actuator endpoints docs.
- Project context: `.planning/PROJECT.md`, `.planning/codebase/STACK.md`, `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/CONCERNS.md`, `CLAUDE.md`.

### Secondary (MEDIUM confidence)

- Baeldung ShedLock guide; TanStack Table vs AG-Grid 2026 comparisons (pkgpulse, simple-table); Module Federation 2026 status (weskill.org); Spring Boot 2026 monitoring guides (sharpskill.dev, SigNoz); enterprise-tool UX patterns (Pencil&Paper, MOZE Studio, Lucidworks); Matillion ETL operator UX docs; Strangler Fig pattern references for Angular→React.

### Tertiary (LOW confidence — deferred decisions)

- Citi internal-infra specifics (log aggregator, user-auth mechanism, service-auth mechanism, Verdaccio coverage, internal CA truststore content, recviz environment URLs) — not researchable from outside Citi; must be answered during respective phase planning.

### Detailed research files

- [STACK.md](STACK.md) — full technology recommendations with versions and rationale
- [FEATURES.md](FEATURES.md) — table stakes, differentiators, anti-features, dependencies, MVP definition
- [ARCHITECTURE.md](ARCHITECTURE.md) — component diagrams, patterns, data flows, build-order rationale
- [PITFALLS.md](PITFALLS.md) — 10 critical pitfalls + technical debt patterns + integration gotchas + performance/security/UX traps + "looks done but isn't" checklist + recovery strategies

---
*Research completed: 2026-05-12*
*Ready for roadmap: yes*
