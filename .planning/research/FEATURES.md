# Feature Research

**Domain:** Internal enterprise data-exploration / job-search web app (grid + graph + configurable search, Oracle/ES backed)
**Researched:** 2026-05-12
**Confidence:** HIGH (table stakes / anti-features), MEDIUM (differentiators), HIGH (loader/observability — well-established patterns)

## Scope Note

This research scopes to the **active modernization milestone**: net-new React frontend, recviz iframe integration, configurable SELECT-query tabs, Oracle->ES scheduled loader, observability sweep, ops script, Citi-domain security. Features below are evaluated against an **internal-tool sensibility** — captive users, desktop browser, no marketing surface, no public sharing, no mobile. Consumer-app features are deliberately filtered out.

The product already ships several table-stakes features (v3/v4 search, AG-Grid SSRM, execution-order graph, TLM stats modal). Those are listed under "Already shipped" and not re-scoped.

## Feature Landscape

### Already Shipped (Baseline — must port to React frontend)

| Feature | Where Today | Port Notes |
|---------|-------------|------------|
| Keyword search across multiple JSON-configured categories | Angular SPA -> `/api/v4/search/initial` | Port to React + shadcn input + tabs |
| AG-Grid Enterprise with SSRM pagination | `SearchV5GridComponent` | Port SSRM datasource pattern; reuse license key |
| Group expansion via `groupKeys` in SSRM | `OracleServiceV4.fetchSSRMData` | Backend unchanged; only React grid wiring changes |
| Execution-order graph (Cytoscape + dagre, status-aware coloring) | `ExecutionOrderGraphComponent` | Either re-implement in React-Cytoscape, OR embed via recviz iframe — decide in planning |
| TLM stats modal | `rectrace-tlm-stats` service | Backend unchanged; modal re-rendered in React |
| Custom cell renderers (execution-order button, AppID link, etc.) | `custom-interactions/components/renderers/` | Port only the *latest* set per PROJECT.md scope decision |
| Excel export per category | `/api/v4/search/export/:category` | Re-wire in React; backend unchanged |
| URL-synced search state (deep linking) | `SearchV5Component` URL sync | Mandatory to preserve — internal users share URLs as their primary collab pattern |
| User identity via `x-citiportal-loginid` header | Header injection in `SearchServiceV5` | Preserve until DOMAIN-SECURITY phase replaces it |

### Table Stakes (Users Expect These — Missing = Complaint)

Internal enterprise data tools are evaluated against Excel, Splunk, Kibana, and (for Citi users) other internal Citi tools. The bar is "works like the tools I already use daily."

#### Search & Discovery

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Typeahead / autocomplete on search input | Standard search UX — every Citi internal tool has it; already in v4 (`/api/search/suggest`) | LOW | Port from Angular; debounce ~150ms |
| Hyphen / special-character handling | Job names like `ABC-123-LOAD` are the norm; current bug is the #1 known issue (SEARCH-BUG-HYPHEN) | MEDIUM | Likely ES analyzer fix (custom tokenizer or `keyword` field); covered in active requirements |
| Empty-state messaging ("No results for X") | Distinguishes "nothing found" from "still loading" or "error" | LOW | Distinct text per state; do not collapse to "No data" |
| Recent searches (per-user, browser-local) | Power users repeat 5-10 searches/day | LOW | `localStorage`; surface as dropdown below input |
| Search-while-you-type cancellation | Users type fast; in-flight requests must cancel | LOW | RxJS `switchMap` / abort controller |
| Loading skeletons / spinners per category tab | Parallel ES lookups land at different times — show progress per-tab | LOW | Existing v4 fan-out already supports per-category state |
| Error state with actionable message + correlation ID | When something breaks, ops needs the correlation ID to grep logs | LOW | Show "Error - reference: <ID>" — depends on OBSERVABILITY phase shipping correlation IDs |

#### Grid (AG-Grid)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Column show/hide + reorder | Different teams care about different columns | LOW | AG-Grid column tool panel built-in |
| Column resize + auto-size | Job names vary 10-80 chars | LOW | AG-Grid built-in |
| Multi-column sort | "Sort by status, then start time" | LOW | AG-Grid built-in via Shift+click |
| Per-column filtering (text, set, date) | Standard grid UX | LOW | AG-Grid Enterprise filter panels |
| Quick filter / global grid filter | "Filter this 1000-row tab down" | LOW | AG-Grid `quickFilterText` |
| Excel export (already shipped) | Users live in Excel; this is mandatory | — | Already shipped |
| CSV export | Some downstream tools want CSV not XLSX | LOW | AG-Grid built-in |
| Copy-to-clipboard (cell + row + range) | Power users copy job names into chat / tickets constantly | LOW | AG-Grid built-in with Ctrl+C |
| Row pinning (top/bottom) | "Keep this row visible while I scroll" | LOW | AG-Grid built-in |
| Sticky / pinned columns | Job name column should stay visible during horizontal scroll | LOW | AG-Grid built-in |

#### Visualization (Execution-Order Graph + recviz)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Status-aware node coloring (already shipped) | Operators scan graph for red/failed nodes | — | Already shipped in Angular; mirror in React |
| Zoom + pan + fit-to-screen controls | Graphs with 50+ nodes are common | LOW | Cytoscape built-in; expose buttons |
| Click node -> side-panel details | Don't make users leave the graph to see job details | LOW | Already shipped pattern in `ExecutionOrderModalComponent` |
| Legend (status colors -> meaning) | New users can't decode colors otherwise | LOW | Already shipped per recent commit history |
| Graph + grid switchable in same modal | recviz embedding scope — same data, two views | MEDIUM | Tab switcher inside modal; per RECVIZ-INTEGRATION |

#### App-Level UX

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Deep-linkable URLs (search term, tab, expanded groups) | Internal collab = pasting URLs in Slack/email | LOW | Already shipped in Angular; preserve in React |
| Browser back/forward works | Users expect back to undo their last filter | LOW | React Router; sync to URL |
| Dark mode / light mode toggle | Already shipped via `ThemeService`; users have preferences | LOW | Mirror in React (shadcn supports both natively) |
| Visible app version / build SHA in footer | Bug reports need it; ops needs it | LOW | Inject from CI; surface in footer or about modal |
| "Reference ID" on every error toast | Pair with correlation ID in logs | LOW | Hooks into OBSERVABILITY phase |
| Keyboard shortcuts: `/` to focus search, `Esc` to close modal | Power users live on keyboards | LOW | Library: `react-hotkeys-hook` or shadcn command palette |
| Loading vs empty vs error states distinct | Standard data-app discipline | LOW | Easy to skip in haste; flag in PR review |
| Reasonable accessibility (keyboard nav, focus rings, ARIA on grid + modal) | Even internal apps face audits; shadcn + Radix gives most of this free | MEDIUM | Don't fight Radix's focus management |

#### Loader (Oracle -> ES) — Operator Table Stakes

For the ES-LOADER milestone. Every scheduled-job tool (cron, Airflow, Matillion, Jenkins) ships these.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| List of configured jobs (name, index, schedule, enabled flag) | Operator needs to know what exists | LOW | Read from config file; surface in admin page or log line |
| Last-run timestamp + status per job | "Did the 6am load run?" is the #1 ops question — confirmed by Matillion docs | LOW | Persist last-run state (file, table, or in-memory if acceptable) |
| Last-run row count + duration | "Did it load everything?" | LOW | Log + persist |
| Per-job error log / last error message | When a job fails, operator needs the *why* without log-diving | LOW | Persist last N errors per job |
| Enable / disable a job without restart | Avoid full app restart to pause one bad job | LOW | Hot-reload of `enabled` flag OR runtime toggle endpoint |
| Run-now / trigger-manually endpoint | "Re-run yesterday's failed load" is constant | LOW | Authenticated POST endpoint; idempotency by run-id |
| Next-scheduled-run timestamp | Operator validates the schedule | LOW | Compute from cron expr; show on status |
| Graceful shutdown (finish in-flight job before exit) | Prevent partial loads on deploy | MEDIUM | Spring shutdown hook + cooperative cancel |
| Per-run correlation ID propagated to logs | Trace one load run end-to-end | LOW | Ties into OBSERVABILITY |
| Configurable batch size | Memory blow-ups on full table loads | LOW | Per-job `batchSize` in config |
| Idempotent index writes (upsert by ID) | Re-running a load shouldn't double-write | MEDIUM | ES bulk upsert with document ID derived from row PK |

#### Observability — Operator Table Stakes

For the OBSERVABILITY milestone. Minimum acceptable for an internal app on Citi VMs.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| `/actuator/health` returning DB + ES status | Standard Spring Boot; trivial to enable | LOW | Spring Boot Actuator built-in; `management.endpoint.health.show-details=when_authorized` |
| `/actuator/info` with build version + git SHA | Ops needs to confirm which build is running | LOW | Spring Boot `build-info` Maven plugin |
| Structured logs (JSON) with correlation IDs | Required for log aggregation; covered in active scope | MEDIUM | Logback JSON encoder + MDC filter |
| Correlation ID per HTTP request (header + MDC) | Trace one user action across backend + TLM stats | LOW | Generate or accept `X-Correlation-ID`; propagate downstream |
| Slow-query log (queries > N ms get logged WARN) | Find the 90th-percentile pain | LOW | Datasource proxy (`datasource-proxy` library) OR manual timing in `OracleServiceV4` |
| Per-endpoint request count + latency (basic) | "Is the slow user seeing the slow endpoint?" | LOW | Micrometer + Actuator `/metrics`; export to whatever Citi has |
| Login ID logged on every request | Audit trail and "who triggered this" answers | LOW | Already partially in place; ensure consistent |
| Error stack traces always logged with correlation ID | The minimum non-negotiable | LOW | MDC-aware logback pattern |
| Graceful 5xx response shape (status, error_type, message, correlationId, timestamp) | Frontend can surface correlation ID to user | LOW | Already partially in place; add correlationId field |

#### Security — Table Stakes (DOMAIN-SECURITY milestone)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| User identity not spoofable (header replaced by real auth) | Current `x-citiportal-loginid` is trust-the-client — known gap | HIGH | Deferred to security phase per PROJECT.md |
| Service-account credentials not in plaintext | Current `get_password.sh` is a placeholder | MEDIUM | Vault / keytab — deferred |
| HTTPS / TLS terminated at known point | Standard for Citi production | LOW | Likely handled by Citi infra; verify |
| CORS not `*` in production | Currently `@CrossOrigin(origins = "*")` — flagged anti-pattern | LOW | Restrict to known origins |
| Audit log of all queries with user ID | Citi compliance baseline | LOW | Log line per search; can pipe to log aggregator |

### Differentiators (Competitive Advantage — Internal-Tool Flavor)

"Competition" for an internal tool = the user's other internal tools (Splunk, Kibana, Tableau, bespoke Citi apps) and Excel. Differentiation here means "they reach for *us* first."

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Saved views (column config + filters + sort, per-user, per-tab) | Power users have 3-5 setups they switch between; saves 30s/lookup | MEDIUM | AG-Grid `getColumnState()` + persist to `localStorage` or backend; backend persistence enables cross-device |
| Shareable saved-view URLs | "Send me the view you're looking at" | LOW | Encode view in URL fragment; pairs with deep linking |
| Query history (per-user, last 50 searches with timestamp) | Reproduce yesterday's investigation | LOW | `localStorage` first, backend later if needed |
| Pinned / favorited jobs (per user) | Operators monitor the same 10-20 jobs daily | LOW | `localStorage`; surface as "My jobs" sidebar |
| Auto-refresh toggle (poll every N seconds) | Operators leave the tab open during a release | LOW | Off by default; visible toggle; pause on tab hidden |
| In-modal graph + grid + raw-JSON tabs | recviz integration play — same data, multiple lenses | MEDIUM | Aligns with RECVIZ-INTEGRATION scope |
| Cross-tab search ("found 3 hits in Tab A, 12 in Tab B") | Already partially present via category counts — emphasize in React redesign | LOW | Surface counts in tab pills, sort tabs by count (already done) |
| Configurable SELECT-query tabs (per CONFIG-DIRECT-SQL) | Lets admins add new search surfaces without code change — huge ops win | MEDIUM | Active requirement; security model = config-time review, not runtime |
| Job-status live refresh in graph (already exists for execution-order) | Watch a graph during an incident | MEDIUM | Already shipped via `JobStatusService`; preserve in port |
| Loader run history view (last 20 runs per job, status + duration sparkline) | At-a-glance health of all ingest jobs | MEDIUM | Builds on loader table-stakes status; one screen |
| Search across the *configuration* itself (which tab has column X?) | When you have 20+ configured tabs, "where does X live?" matters | LOW | Static index of config at build/startup |
| Copy job name + paste into Autosys CLI helper text | One-click "open in Autosys" deep link or copy-with-prefix | LOW | Per-column custom renderer; cheap win |

### Anti-Features (Commonly Requested, Often Problematic for Internal Tools)

The temptation when modernizing is to add consumer-app features. Resist.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| End-user SQL console | "Power users want SQL" | Massive security + perf surface; DB-load DOS risk; auditing nightmare; explicitly Out of Scope in PROJECT.md | Config-authored SELECT tabs (CONFIG-DIRECT-SQL) — the right answer is already in scope |
| Natural-language query ("show me jobs that failed yesterday") | LLM hype; "users hate writing filters" | Hallucination on internal schemas; cost; auditability; users actually prefer fast structured search | Better autocomplete + recent searches + saved views |
| Public sharing / link-anyone | "I want to share this with vendor X" | Internal job metadata is sensitive; auth-bypass risk; not a use case in PROJECT scope | Authenticated saved-view URLs (only Citi-domain users can open) |
| Mobile responsive layout | "What if I'm on my phone?" | Explicitly Out of Scope in PROJECT.md; AG-Grid + Cytoscape don't shine on mobile; 0% of actual usage | Desktop-only; document in README |
| Social features (comments, mentions, reactions on jobs) | "Like Slack/Jira" | Becomes a parallel collab system, separate from where users actually talk (Slack/email/Jira); maintenance + moderation burden | Deep links to Slack/Jira; don't rebuild collab |
| Notifications / email subscriptions on saved searches | "Alert me when job X fails" | Becomes a half-built monitoring system competing with Autosys's actual alerting; on-call paging confusion | Link out to existing Autosys / monitoring tooling; don't recreate it |
| Drag-and-drop dashboard builder | "Tableau-like flexibility" | Massive scope; users actually want 2-3 fixed layouts, not infinite flexibility; consumes the whole roadmap | Curated tab presets (saved views as differentiator) |
| Real-time streaming updates everywhere | "Live like a trading screen" | Adds WebSocket infra; most data here is batch-loaded anyway; users don't need sub-second freshness | Auto-refresh toggle on specific views only; honest about staleness |
| User-uploaded file imports | "Let me bulk-query from a CSV of job names" | File-handling security; storage; abuse vector | Paste-list filter in the search input (textarea mode) |
| Onboarding tour / product tour overlays | "New users get lost" | Patronizing for internal power users; obsolete the moment UI changes; never maintained | 1-page README + screenshots in app footer link |
| AI-generated summaries of graph / search results | "Make sense of this for me" | Cost; hallucination; users distrust summaries of compliance-relevant data | Better default views and column choices |
| Per-user theming beyond dark/light | "Let me set my brand colors" | shadcn ships dark+light; anything more is bikeshedding | Dark + light, period |
| Multi-tenant / multi-org separation in UI | "What if another team uses it?" | YAGNI at current scale; complicates auth model | Single Citi-team scope; revisit if it ships beyond current users |
| Built-in chat / support widget | "Users have questions" | Drives traffic to a non-existent support team | Footer link to team Slack channel |
| Bookmarklets / browser-extension integration | "Make it work inside Autosys UI" | Browser-extension distribution + security review nightmare | Deep-link URLs out of Autosys's UI into this app |

## Feature Dependencies

```
REACT-MIGRATION (foundation)
    |-- requires --> shadcn design system installed
    |-- requires --> port of v4 search flow
    |-- requires --> port of latest custom renderers
    |
    +--> RECVIZ-INTEGRATION (iframe host needs React shell)
    +--> Saved views, query history, keyboard shortcuts (live in React)

OBSERVABILITY (cross-cutting)
    |-- enables --> Correlation-ID-on-error UX (table stakes)
    |-- enables --> Loader run-history view (differentiator)
    |-- enables --> Slow-query surfacing
    |
    +--> Should ship before or alongside ES-LOADER so loader inherits the same logging shape

ES-LOADER
    |-- requires --> Scheduler (Spring `@Scheduled` or Quartz)
    |-- requires --> Per-job config schema
    |-- requires --> Last-run state persistence
    |
    +--> Enables Loader run-history view (differentiator)
    +--> Run-now endpoint requires DOMAIN-SECURITY-lite (don't expose unauthenticated)

CONFIG-DIRECT-SQL
    |-- requires --> Extended search-config schema (sql field + column mapping)
    |-- requires --> Read-only DB user OR query whitelist enforcement
    |
    +--> Enables ad-hoc tab creation without code change

SEARCH-BUG-HYPHEN
    |-- standalone; can ship independently
    |-- requires --> ES analyzer change + reindex
    |
    +--> Reindex tooling overlaps with ES-LOADER infrastructure

DOMAIN-SECURITY
    |-- gates --> production deployment
    |-- replaces --> x-citiportal-loginid header trust
    |-- replaces --> get_password.sh script
    |
    +--> Run-now endpoint on loader needs this resolved first

OPS-SCRIPT (low coupling)
    |-- depends on --> stable start commands for each service
    +-- last in order; consolidates after others stabilize
```

### Dependency Notes

- **OBSERVABILITY should land before ES-LOADER:** The loader will be the most operationally noisy component. Shipping it without correlation IDs and structured logs means we'll re-instrument it later.
- **REACT-MIGRATION is foundation:** Most UX differentiators (saved views, query history, keyboard shortcuts, recviz tabs in modal) live in React. Cannot ship without the React shell.
- **CONFIG-DIRECT-SQL conflicts with naive DOMAIN-SECURITY:** Arbitrary SELECT must run as a DB user with appropriately scoped grants. Coordinate so the security phase doesn't lock down the loader's DB user in a way that breaks SELECT-tabs.
- **Run-now on ES-LOADER needs at least minimal auth:** A `POST /loader/run/:job` endpoint without auth is a foot-gun. Either ship it after DOMAIN-SECURITY or gate it behind same login-id check used elsewhere.

## MVP Definition (Per-Milestone Lens)

This is a "subsequent milestone" — there's already a working Angular app. MVP here means **minimum-React-app to deprecate Angular**, not greenfield.

### Launch With (React app v1 — replaces Angular)

- [ ] **Port v4 search flow + parallel ES + SSRM grid** — without this, there's no app
- [ ] **shadcn design system installed and matching recviz** — DESIGN-SHADCN scope
- [ ] **Port latest custom renderers** — execution-order button, AppID link, status renderers
- [ ] **URL-synced search state** — deep linking is daily-use, not optional
- [ ] **Dark + light mode** — already shipped today; not regressing
- [ ] **Excel export** — non-negotiable for Excel-native users
- [ ] **Error states with correlation IDs surfaced to user** — pairs with observability
- [ ] **Recent searches (localStorage)** — cheap, high-value
- [ ] **Hyphen-search bug fixed** — SEARCH-BUG-HYPHEN, daily complaint
- [ ] **Build-version visible in footer** — for bug reporting

### Add After Validation (v1.x in same milestone)

- [ ] **Saved views (per-tab column + filter state, localStorage)** — once core port is stable
- [ ] **Keyboard shortcuts (`/` focus, `Esc` close, `Ctrl+K` command)** — when there are enough flows to need them
- [ ] **recviz embedded in modal as alternate view** — RECVIZ-INTEGRATION
- [ ] **Configurable SELECT-query tabs** — CONFIG-DIRECT-SQL
- [ ] **Loader admin page (status + run-now + last error)** — ES-LOADER
- [ ] **Health page or `/actuator/health` UI surface** — OBSERVABILITY
- [ ] **Slow-query log surfaced to operators** — OBSERVABILITY

### Future Consideration (later milestones)

- [ ] **Backend-persisted saved views (cross-device)** — needs user store; localStorage suffices for now
- [ ] **Auto-refresh toggle on grid/graph** — confirm operator demand first
- [ ] **Job favorites / pinned jobs** — confirm operator demand first
- [ ] **Loader run-history sparkline view** — after basic loader observability lands
- [ ] **Decommission v3 search controller** — flagged as anti-pattern in ARCHITECTURE.md; cleanup after React migration
- [ ] **Real auth replacing `x-citiportal-loginid`** — DOMAIN-SECURITY phase
- [ ] **Vault / keytab replacing `get_password.sh`** — DOMAIN-SECURITY phase

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Port v4 search + SSRM grid to React | HIGH | HIGH | P1 |
| shadcn install + recviz-matching design | HIGH | MEDIUM | P1 |
| Deep-linkable URL state | HIGH | LOW | P1 |
| Hyphen-search bug fix | HIGH | MEDIUM | P1 |
| Excel export port | HIGH | LOW | P1 |
| Correlation-ID-aware error states | MEDIUM | LOW | P1 (pair with observability) |
| Build-version footer | LOW | LOW | P1 |
| Dark/light mode | MEDIUM | LOW | P1 |
| Recent searches (localStorage) | MEDIUM | LOW | P1 |
| Saved views (localStorage) | HIGH | MEDIUM | P2 |
| Keyboard shortcuts | MEDIUM | LOW | P2 |
| recviz embedded in modal | MEDIUM | MEDIUM | P2 |
| CONFIG-DIRECT-SQL tabs | HIGH | MEDIUM | P2 |
| ES loader: status + run-now + last-error | HIGH | MEDIUM | P2 |
| ES loader: idempotent upserts | HIGH | MEDIUM | P2 |
| `/actuator/health` + `/info` with build SHA | MEDIUM | LOW | P2 |
| Structured logs + correlation IDs | HIGH | MEDIUM | P2 |
| Slow-query logging | MEDIUM | LOW | P2 |
| Audit log of all queries | MEDIUM | LOW | P2 |
| OPS-SCRIPT unified start/stop | MEDIUM | LOW | P2 |
| Backend-persisted saved views | LOW | MEDIUM | P3 |
| Loader run-history sparkline | LOW | MEDIUM | P3 |
| Auto-refresh toggle | LOW | LOW | P3 |
| Job favorites | LOW | LOW | P3 |
| v3 controller decommission | LOW | LOW | P3 (cleanup) |
| Replace `x-citiportal-loginid` with real auth | HIGH | HIGH | P2 (security phase) |
| Replace `get_password.sh` with Vault/keytab | MEDIUM | HIGH | P2 (security phase) |

**Priority key:**
- P1: Required for the React app to credibly replace Angular
- P2: Required for milestone "done" (operability, security, ingest)
- P3: Defer; revisit at milestone boundary

## Internal-Tool Sensibility Checklist

Applied to every proposed feature in this milestone:

- [x] **Does it serve captive users doing their job, not optional users we must delight?** — yes, operators / search users
- [x] **Is it usable with keyboard?** — keyboard shortcuts called out as P2
- [x] **Does it avoid reinventing collab/notifications/auth that other Citi tools own?** — anti-features list above
- [x] **Does it survive an audit (auditable trail, no unsafe defaults)?** — security phase + audit log
- [x] **Is the failure mode visible to operators, not just users?** — health endpoints + correlation IDs
- [x] **Is desktop-only OK?** — explicit Out of Scope for mobile in PROJECT.md
- [x] **Can a single dev maintain it after launch?** — favors AG-Grid built-ins, shadcn defaults, Spring Boot Actuator standard endpoints over custom infra

## Sources

Verified against the codebase analysis in `.planning/codebase/ARCHITECTURE.md` and `.planning/PROJECT.md`, supplemented by:

- [Enterprise UX: data table design — Pencil & Paper](https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-data-tables) — table stakes for grid UX
- [Enterprise UX: how to design usable data tables — MOZE Studio](https://www.mozestudio.com/journal/enterprise-ux-how-to-design-usable-data-tables) — sorting/filtering as fundamentals
- [AG Grid: Grid State](https://www.ag-grid.com/react-data-grid/grid-state/) — saved-views implementation reference
- [AG Grid: Column State](https://www.ag-grid.com/react-data-grid/column-state/) — granular column persistence
- [AG Grid: SSRM Configuration](https://www.ag-grid.com/react-data-grid/server-side-model-configuration/) — `serverSideInitialRowCount` for state restore
- [Persisting ag-Grid state with React & Redux — AG Grid blog](https://blog.ag-grid.com/persisting-ag-grid-state-with-react-redux/) — persistence pattern
- [Manage Schedules — Matillion ETL Docs](https://docs.matillion.com/metl/docs/2103629/) — last-run timestamp UX pattern
- [Error Handling Options in Matillion ETL — Alerting & Audit Tables](https://www.matillion.com/blog/error-handling-options-in-matillion-etl-alerting-audit-tables) — operator alerting expectations
- [ETL Scheduling and Automation — Portable.io](https://portable.io/learn/etl-scheduler) — schedule/alert feature baseline
- [Apache Airflow dry-run patterns — ayc-data.com](https://ayc-data.com/data_engineering/2021/05/21/airflow-best-practices.html) — dry-run expectation
- [Spring Boot Actuator Endpoints — docs.spring.io](https://docs.spring.io/spring-boot/reference/actuator/endpoints.html) — health/info/metrics baseline
- [Health Checks with Spring Boot — reflectoring.io](https://reflectoring.io/spring-boot-health-check/) — minimum-viable health endpoint patterns
- [Monitoring Spring Boot Microservices with Actuator + Micrometer — Uptrace](https://uptrace.dev/blog/spring-boot-microservices-monitoring) — metrics surface expectations
- [Splunk Enterprise: Search bar shortcuts](https://help.splunk.com/en/splunk-enterprise/search/search-manual/10.2/use-the-search-app/help-reading-searches/search-bar-shortcuts) — power-user keyboard expectations
- [Azure Data Explorer web UI query keyboard shortcuts — Microsoft Learn](https://learn.microsoft.com/en-us/azure/data-explorer/web-ui-query-keyboard-shortcuts) — peer enterprise tool shortcut baseline
- [9 Must-Have Enterprise Search Features — Lucidworks](https://lucidworks.com/blog/enterprise-search-tools) — recent searches, typeahead as standard
- [Enterprise UX Patterns: Designing Internal Apps for High Productivity — dev.to](https://dev.to/vinnyumtech/enterprise-ux-patterns-designing-internal-apps-for-high-productivity-2ib3) — captive-user mindset framing
- [8 Enterprise UX Design Best Practices — uxpilot.ai](https://uxpilot.ai/blogs/enterprise-ux-design) — RBAC, multi-role considerations
- [Best Authorization Tools — Oso](https://www.osohq.com/learn/best-authorization-tools-and-software) — RBAC patterns for admin tools

**Confidence:**
- Table stakes, anti-features, loader operator UI, observability minimums — **HIGH** (well-established patterns across Spring Boot, AG-Grid, ETL tooling, enterprise search; verified across multiple peer sources)
- Differentiators specific to this product — **MEDIUM** (extrapolated from internal-tool patterns + observed gaps in current Angular app; would benefit from a real user-interview pass before locking in)
- Configurable SELECT-tab UX specifics — **MEDIUM** (no peer tool ships exactly this; design surface needs planning-phase resolution)

---
*Feature research for: internal enterprise data-exploration / job-search web app modernization*
*Researched: 2026-05-12*
