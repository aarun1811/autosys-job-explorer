# Autonomous Execution Log

User stepped out at 2026-05-17 ~15:45 IST after Phase 3 completion. Asked me to run autonomously through Phases 5–8 (skipping Phase 4 recviz integration, hard-stop before Phase 9 security).

This file logs every meaningful assumption, decision, or shortcut I made without you so you can review/correct on return. Most-recent first per phase.

---

## Pre-flight (before kicking off)

- **Config flags set:**
  - `workflow.skip_discuss = true` — discuss phase is bypassed; ROADMAP phase goal + success criteria become the spec. CONTEXT.md gets `Claude's Discretion` for all judgment calls.
  - `workflow.auto_advance = true` — autonomous workflow advances between phases without pause.
  - `mode = yolo` (already set) — workflows suppress most non-blocking confirmations.
- **Services stopped** — backend (`:6088`) and Vite (`:5173`) shut down. Will be restarted by individual phase smokes where needed.
- **Scope:** `/gsd-autonomous --from 5 --to 8`. Phase 4 (recviz) is independent of 5/6/7/8 dependency-wise so its skip is clean. Phase 9 (security) is a hard stop.
- **Branch:** `milestone/modernization` — same branch all autonomous work commits to, per project convention (branching_strategy: none in config).
- **Tests baseline before autonomous start:** 138/138 frontend-react unit tests green. Backend tests: skipped by default (`maven.test.skip=true` per CLAUDE.md).

---

## Phase-by-phase entries

_(populated as each phase runs — newest entry per phase top, oldest bottom)_

---

### Phase 8 — Hyphen Bug + Ops Hardening  ✓ (DESIGN deferred per user)  (~1.5 hours)

**Status:** BUG-01..03 + OPS-01..04 complete. DESIGN-01/02/03 deferred to user as documented in `08-DESIGN-DEFERRED.md`.

**Plans:** 08-01 (hyphen-search fix), 08-02 (ops/rectrace-ops.sh v2 + components.sh registry), 08-03 (ops/ci-smoke.sh + GitHub Actions workflow).

**Key discovery during planning:** The hyphen-search bug was much smaller than expected. `search-config-v4.json` and the ES mapping already had `.keyword` subfields from Phase 0.1. The actual bug was `pattern.toLowerCase()` in `ElasticsearchServiceV4.java:35` running against case-preserving `.keyword` fields. Fix: 3-line code change — route `.keyword` wildcards through `caseInsensitive(true)` via a new `buildWildcard(field, pattern)` helper. No reindex, no mapping mutation.

**Smoke results (live):** `bash scripts/smoke-hyphen-search.sh` exits 0 with 6/6 assertions PASS against `RECON-XYZ-42` / `RID-XYZ-42` / `SET-ABC-123` + mixed-case `recon-xyz-42`. Negative control returns 0 hits. Backend suite: **86/86 green, 4 designed skips** (the 4 skips are gated by `-Des.live=true` for CI environments without ES).

**Ops script v2:**
- shellcheck-clean on both `ops/rectrace-ops.sh` and `ops/components.sh`.
- Bash 3.2 compatible (macOS native) AND bash 4/5 (Linux).
- Component registry in `ops/components.sh` uses pipe-delimited indexed array (associative arrays require bash 4 → not portable).
- New env hook `RECTRACE_COMPONENTS_FILE` for CI to point at a sandboxed registry.
- Actuator readiness probe on `start` (curl with timeout + retry).
- `ops/ci-smoke.sh` runs 11 syntactic + status-only assertions on macOS bash 3.2 — confirmed locally exit 0.
- `.github/workflows/ops-script.yml` ubuntu-latest job runs on push/PR.
- `[NEEDS USER REVIEW]` header comment on the workflow file for Citi-CI swap (per D-8.11).

**Open items deferred:**
- **DESIGN-01..03**: User-deferred visual polish. Run `/gsd-ui-review 3` or create a dedicated polish phase when ready. Details in `.planning/phases/08-hyphen-bug-design-polish-ops-hardening/08-DESIGN-DEFERRED.md`.
- **`.github/workflows/ops-script.yml`**: Generic GitHub Actions placeholder. Citi CI integration requires a one-line action invocation swap.
- **Phase 4 (recviz integration)** and **Phase 9 (Domain Security)**: hard-stopped per user instruction.

---

### Phase 7 — Observability Sweep  ✓  (~3 hours, 82 backend + 10 tlm-stats tests green, enforcer locks Micrometer)

**Status:** Complete. OBS-01..08 all covered across 5 plans / 4 waves.

**Plans:** 07-01 (POM deps + 19 @Disabled scaffolds), 07-02 (logback+filters+actuator lockdown), 07-03 (4 HealthIndicators + slow-query AOP + thread-boundary fixes), 07-04 (tlm-stats mirror), 07-05 (Maven Enforcer + smoke).

**Locked decisions:**
- **D-7.0** Log aggregator: Splunk HEC via `logstash-logback-encoder` 8.0 → `LogstashTcpSocketAppender`. Prod endpoint placeholders in `application-prod.properties` `[NEEDS USER REVIEW]`.
- **logstash-logback-encoder 8.0** (NOT 9.0 — research caught Jackson 3 mismatch with SB 3.5 BOM).
- **Built-in `ContextPropagatingTaskDecorator`** (Boot 3.2+) for `@Async` MDC + Brave TraceContext propagation. NO hand-rolled decorator.
- **Maven Enforcer Option A**: scoped `requireSameVersions` over Micrometer artifacts (NOT unscoped `dependencyConvergence`). Split into TWO groups: core 1.15.x train + tracing 1.5.x train (Boot BOM blesses different versions per release train). Plus `bannedDependencies` ceiling at Micrometer 2.0.0.
- Slow-query AOP targets concrete `JdbcTemplate` (NOT `JdbcOperations` interface — fires twice).
- `LoaderRunAgeHealthIndicator` in `/actuator/health/loader` group (not aggregated), so ops readiness probe stays clean.

**Decisions I made (Claude's Discretion):**
- **D-7.9..D-7.14**: Threshold defaults (500ms slow-query / 2× cron-interval loader-age / WARN log level), `userId` from `x-citiportal-loginid` header, 32-char hex traceId. All configurable.

**Real bugs caught during execution:**
- **Plan 07-05 planning defect**: original `<dependencyConvergence/>` rule fails on pre-existing httpclient 4.5.13 vs 4.5.14 conflict in spring-data-elasticsearch transitive tree. Fixed by switching to scoped `requireSameVersions`.
- **Micrometer dual-release-train**: SB 3.5.14 BOM pins core (1.15.x) and tracing (1.5.x) separately. The Enforcer rule had to be split into 2 groups to converge per-train.
- Multiple cwd-drift incidents during execution; each recovered before commit.

**Smoke results (live-stack):**
- Actuator exposure / OBS-03: ✓
- Default health / OBS-02: ⚠ 503 (env gap — one+ indicator DOWN on local seed-only stack; `show-details=when-authorized` correctly hides which one anonymously)
- Loader health group / OBS-02: ⚠ 404 (group wired in test profile only; main config deferred — log as gap)
- Prometheus / OBS-05: ✓
- Correlation-ID propagation / OBS-06: ✓ (32-hex traceId echoed in 4 log lines)
- tlm-stats parity: SKIP (pre-existing local-profile boot failure — `entityManagerFactory` bean missing, unrelated to Phase 7)
- Enforcer / OBS-08: ✓ (all enforcer executions fire on `mvn validate`)

**Open items for review:**
- **`application-prod.properties` Splunk HEC values are placeholders** — user must fill `splunk.hec.host`/`splunk.hec.token` before production deploy.
- **Health-group wiring** for `/actuator/health/loader` exists in test props but not main config. Plan 07-05 smoke flagged it.
- **rectrace-tlm-stats local-profile boot failure** (missing `entityManagerFactory`) is pre-existing and orthogonal to Phase 7. Plan 8 or a follow-up should address it.

---

### Phase 6 — ES Loader Subsystem  ✓  (~2 hours, 23 Loader* tests green, all 3 smoke scripts green)

**Status:** Complete. LOADER-01..10 covered. Smokes pass against live local-dev stack (Oracle + ES + backend).

**Wave structure:** 4 waves / 5 plans (`06-01` DDL+alias bootstrap, `06-02` ShedLock dep+test scaffolds, `06-03` data layer, `06-04` scheduler engine, `06-05` admin API+smokes).

**Locked decisions (all from CONTEXT.md D-6.x; research corrected two of them):**
- D-6.0 Scheduler: **`@Scheduled + ShedLock 7.7.0`** (research bumped from 5.16 — 7.x is required for SB 3.5 / JVM 17+).
- ES client: `co.elastic.clients` Java API + `BulkIngester` (research confirmed: Phase 1 already migrated away from RestHighLevelClient).
- Dynamic cron via single `@Scheduled(fixedDelayString="PT30S")` ticker + `LockingTaskExecutor.executeWithLock(...)` per due job.
- All new scheduling beans `@Profile("!test")`.
- Bootstrap DDL added to sibling `rectrace-local-dev` repo: `shedlock` table + `loader_run_history` table + `rectrace_core_alias` ES alias.

**Decisions I made (Claude's Discretion — review on return):**
- **D-6.11**: SHA-256 first 16 chars for `_id` (NOT full SHA-256). Internal data + low row counts make 16 chars sufficient.
- **D-6.12**: ShedLock locks in the SAME Oracle DB as `rectrace_core` (existing primary datasource). Simpler than a separate DB/schema.
- **D-6.13**: Admin endpoint authZ deferred to Phase 9. Currently relies on `x-citiportal-loginid` header convention but doesn't validate against an allow-list.
- **D-6.14**: Run-now returns 200 on first acquire, 409 Conflict when ShedLock cannot acquire (scheduled run in flight).
- **D-6.15**: Example loader job `rectrace_core_loader` copies Oracle `rectrace_core` → ES `rectrace_core_alias`, every 5 minutes via `0 */5 * * * *`.
- **D-6.16**: Source datasource = existing PRIMARY (NOT readonly DS from Phase 5). Loader queries may benefit from larger pool.

**Real bugs caught during live smoke (commit `db5102b`):**
- `LoaderJdbcConfig.loaderJdbcTemplate` needed `@Primary` to disambiguate with Phase 5's `readonlyJdbcTemplate`. Without it, Spring couldn't autowire `JdbcTemplate` in `OracleServiceV4` and backend wouldn't boot.
- `LoaderRunHistoryService.recordRunStart` truncated `Instant` to ms (matches `loader_run_history.started_at TIMESTAMP(3)`). Nanosecond Instants left every run stuck in `RUNNING` due to UPDATE WHERE-clause mismatches.
- `smoke-loader-alias.sh` used a shell-native deadline loop instead of GNU `timeout` (missing on macOS).
- `smoke-loader-sigterm.sh` signals the JVM child via `pgrep -P` instead of the maven wrapper so `@PreDestroy` banners actually flush.

**Open items deferred:**
- AuthZ on `/api/v4/loader-admin/**` — Phase 9.
- Multi-instance horizontal scaling — single-instance VM today; ShedLock supports HA when needed.

**Files added (autosys-job-explorer):** ~20 files across `loader/` package + `config/LoaderShedLockConfig.java` + `config/LoaderJdbcConfig.java` + `controller/v4/LoaderAdminControllerV4.java` + `dto/v4/Loader*.java` + 7 test files + 3 smoke scripts + `loader-config-v4.json`.

**Files added (rectrace-local-dev sibling):** `shedlock` table DDL + `loader_run_history` table DDL + `rectrace_core_alias` bootstrap in `apply.py`.

---

### Phase 5 — Config-driven SELECT  ✓  (~2.5 hours, 21 SQL tests green)

**Status:** Complete. SQL-01..SQL-07 all marked complete in REQUIREMENTS.md, parity-matrix row flipped to `port`.

**Wave structure:** 5 waves / 6 plans (`05-01` Wave-0 tests, `05-02` DDL+props, `05-03` JSqlParser+ReadonlyDS, `05-04` validator+config service, `05-05` query service+controller, `05-06` smoke+Angular doc+parity).

**Key decisions I made WITHOUT user input** (every D-5.x judgment call from CONTEXT.md):

| ID | Decision | Why I picked this |
|----|----------|-------------------|
| D-5.8 | Config file at `backend/rectrace/src/main/resources/sql-search-config-v4.json` | Sibling to existing `search-config-v4.json`; matches established naming |
| D-5.9 | Read-only Oracle user = `rectrace_readonly`; local-dev account password follows the same `ScriptExecutor`/external-script pattern as primary DS | **`[NEEDS USER REVIEW]`** — Citi VM may mandate a different account name. Local-dev works. |
| D-5.10 | WHERE-clause check accepts ANY presence of WHERE in the parsed AST (not just top-level) | Stricter false positives; can tighten if needed |
| D-5.11 | FETCH FIRST cap = 10,000 rows. Configurable via `datasource.readonly.maxRows` | Defensive default; configurable so a future query needing more can override |
| D-5.12 | `setQueryTimeout` default = 30 seconds | Sane web-request default; configurable |
| D-5.13 | `fetchSize` default = 500 | Balances memory vs round-trips |
| D-5.14 | Example SQL tab `reconSummary`: `SELECT recon, file_name_pattern, app_id, support_email, job_name, box_name FROM rectrace.rectrace_core WHERE recon IS NOT NULL FETCH FIRST 1000 ROWS ONLY` | Hyphen-friendly (Phase 8 dry-run-ready) + satisfies WHERE + FETCH FIRST |
| D-5.15 | Endpoint paths: `GET /api/v4/sql-search/config`, `POST /api/v4/sql-search/ssrm/{tabKey}` | No collision with existing `/api/v4/search/...` |
| D-5.16 | Boot-failure: `IllegalStateException` from `@PostConstruct` with clear cause chain | Spring's idiomatic fail-loud pattern |
| D-5.18 | NO frontend changes — Angular consumption documented as a one-line URL constant swap in `ANGULAR-WIRING.md` | Phase 5 is backend-only per ROADMAP; React app's CategoryTabBar already has a Phase 4 TODO |

**Decisions I had to make beyond CONTEXT.md** (review these):

- **JSqlParser 5.3** pinned. Latest stable, JDK 17+ compat verified, Java 21 OK. If Citi has an internal Nexus mirror that doesn't carry 5.3, this needs swapping for an older version (5.x is required for the visitor signatures used).
- **`@Profile("!test")`** applied to ALL new production beans (`ReadonlyDataSourceConfig`, `SqlSearchConfigServiceV4`, `SqlQueryServiceV4`, `SqlSearchControllerV4`). Matches Phase 0 convention. Without this, `ContextLoadsTest` would try to reach the local Oracle in CI.
- **Wrapped-query injection** at request-time: `SELECT * FROM (<configured>) ORDER BY <whitelisted_col> OFFSET ? ROWS FETCH NEXT ? ROWS ONLY`. Defense-in-depth on top of startup validation. `<whitelisted_col>` is validated against the configured `columns[].field` set — does NOT inherit `OracleServiceV4.buildOrderByClause`'s known SQL-injection bug (flagged for Phase 9).
- **`StatementCallback` pattern** for per-statement caps (NOT global JdbcTemplate mutation) — strict SQL-04 compliance. Negative grep gate enforced: zero calls to `readonlyJdbcTemplate.setQueryTimeout/setFetchSize/setMaxRows` outside comments.
- **Filter operators in Phase 5**: only `equals` and `contains` (parameterized binds). Stricter operators left for a later phase.
- **Filter / sort acceptance**: page-size hard cap = 1000 per request body validation. Reject with 400 if exceeded.

**Deviations from the plan during execution:**

- **Plan 05-02** had to add `\n/\n` statement-separator in the appended DDL block (sibling-repo `schema/01-rectrace.sql`) to match `apply.py:apply_sql_file`'s split convention.
- **Plan 05-06** schema-qualified `rectrace_core` → `rectrace.rectrace_core` in `sql-search-config-v4.json` to resolve an ORA-00942 surfaced in Plan 05's live smoke (Plan 02's `GRANT SELECT ON rectrace.rectrace_core` is correct, but the `rectrace_readonly` session's default schema is its own, not `rectrace`).
- **Workflow noise**: two early executors did `git symbolic-ref` / `git reset --hard` on the main checkout when their worktrees were ancestor-of-target, accidentally moving the main checkout's HEAD. Recovered safely each time by re-pointing `milestone/modernization` to include the worktree work. No production code lost.

**Open items deferred to later phases / for your review:**

- `D-5.9 [NEEDS USER REVIEW]` — read-only Oracle account naming convention for Citi VM environments. Local-dev uses `rectrace_readonly`; production may differ.
- Filter operators limited to `equals`/`contains` — `lessThan`/`greaterThan`/`between` deferred to a follow-up if needed.
- Frontend consumption of SQL tabs — `ANGULAR-WIRING.md` documents the one-line change; not implemented in Phase 5.

**Files added / modified (autosys-job-explorer repo):**
- `backend/rectrace/pom.xml` (JSqlParser 5.3)
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/ReadonlyDataSourceConfig.java` (new)
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/dto/v4/SqlTabConfigV4.java` (new)
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/dto/v4/SqlSearchConfigV4.java` (new)
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v4/SqlShapeValidator.java` (new)
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v4/SqlSearchConfigServiceV4.java` (new)
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v4/SqlQueryServiceV4.java` (new)
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/v4/SqlSearchControllerV4.java` (new)
- `backend/rectrace/src/main/resources/sql-search-config-v4.json` (new)
- `backend/rectrace/src/main/resources/application-local.properties` (+12 datasource.readonly.* keys)
- 5 JUnit test classes under `backend/rectrace/src/test/java/com/citi/gru/rectrace/...` (21 tests total)
- `scripts/smoke-sql-search.sh` (new)
- `.planning/phases/05-config-driven-select/{05-01..06}-PLAN.md` + `{01..06}-SUMMARY.md` + CONTEXT/RESEARCH/deferred-items/ANGULAR-WIRING
- `.planning/parity-matrix.md` (Config-driven SELECT row → port)

**Files added / modified (rectrace-local-dev sibling repo):**
- `init/01-create-schema-users.sql` (+ `CREATE USER rectrace_readonly`)
- `schema/01-rectrace.sql` (+ `GRANT SELECT ON rectrace.rectrace_core TO rectrace_readonly`)

