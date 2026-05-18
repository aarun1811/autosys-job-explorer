---
milestone: v1.0 — Modernization
status: in_progress
last_updated: 2026-05-18
progress:
  total_phases: 11
  completed_phases: 8
  open_phases: ["4 (recviz)", "8 DESIGN-01/02/03", "9 (security)"]
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-12)

**Core value:** Users can quickly find Autosys jobs and understand their dependencies and TLM statistics through a unified, performant, design-consistent UI.
**Current focus:** Phase 03 — React Search Vertical Slice (next; not yet specced)

## Current Position

Phase: 02 (React Foundation) — **CLOSED PASS** (4/4 live-stack UAT items verified 2026-05-13; ROADMAP success criteria 1-5 all green; code review fix-cycle 4C/8W/5I → 14 fixed; 8 follow-up `fix(02): …` commits closed latent Phase 01 boot/wiring regressions surfaced during UAT).

**Phase 02 deliverables landed:**

- `frontend-react/` net-new SPA boots via Vite 7 + React 19 + TypeScript + shadcn (Tailwind v4 / new-york / mist tokens)
- AG-Grid Enterprise SSRM `SmokeGrid` against `/rectrace/api/v4/search/ssrm/fileName`
- TanStack Router + TanStack Query + apiFetch wrapper with `X-Correlation-Id` propagation
- Custom dark/light ThemeProvider with `rectrace-theme` localStorage key + visible build SHA in footer
- ESLint flat config with hex-rejection rule and proof fixture
- Backend Brave Propagation.Factory (Option B) — inbound `X-Correlation-Id` adopted as 128-bit traceId, written to MDC via `%X{traceId}`
- `ops/rectrace-ops.sh` v1 (backend/tlm-stats/react; no angular per D-2.15), `ops/build.sh`, `scripts/smoke-ssrm.sh`, `scripts/smoke-correlation-id.sh`
- Phase 0.1 docs supersessions (D-2.5, D-2.17, D-2.18 captured)

**Phase 02 surfaced & fixed latent Phase 01 regressions** (committed back to milestone branch):

- Missing Lombok annotation processor (compile failure on clean build)
- `spring.servlet.context-path` typo (should be `server.servlet.…`)
- Missing `spring-boot-starter-actuator` (broke Brave auto-config + health endpoint)
- Brave 5.12+ API migration in `CorrelationIdPropagationConfig` (both modules)
- `ops/rectrace-ops.sh` spring profile flag typo (`-Dspring.profiles.active` → `-Dspring-boot.run.profiles`)
- `smoke-ssrm.sh` BSD `head` portability + two-step `/initial` → SSRM real-data flow
- `SmokeGrid` failed-request Sonner toast wiring + Sonner Toaster mount-order race

Plan: 5 of 5 — final.

**Phase 01 deliverables landed:**

- Boot **3.5.14** + Java **21** in both modules (lockstep)
- jakarta-EE sweep complete (`javax.sql`/`javax.net.ssl` JDK packages correctly preserved)
- ES Java API Client (`co.elastic.clients.elasticsearch.ElasticsearchClient`) on the live ES paths
- V3 search trio + V3 endpoints + frontend `search.service.*` deleted
- `SecurityFilterChain` permit-all per module (auth deferred to Phase 9)
- BOOT-08 cleanup quartet: SLF4J + show_sql off + explicit HikariCP (4 named pools) + AppConstants populated
- Phase 0.1 KNOWN GAPS closed via conditional `scriptExecutor.executeScript` wraps
- ROADMAP.md updated to reflect 3.5.14/Java 21

**Next:** Phase 03 — React Search Vertical Slice. Requirements: SEARCH-01..SEARCH-07. Depends on Phase 02 (now satisfied). Entry point: `/gsd-ui-phase 3` (recommended — UI-hint phase; produce UI-SPEC.md design contract first), or `/gsd-discuss-phase 3` (skip the UI contract step and go straight to context gathering).

Last activity: 2026-05-17

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 8
- Average duration: ~2-6 min (mostly small bootstrap-style plans)
- Total execution time: ~30 min cumulative

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| Phase 0 — Foundation | 3 | ~12min | ~4min |
| Phase 00.1 — Local Dev Seed Bootstrap | 7/7 | ~56min | ~8min |

**Recent Trend:**

- Last 8 plans: Phase 0 (3 plans complete) → Phase 00.1-01 (sibling repo bootstrap) → Phase 00.1-02 (docker stack + schema-user init) → Phase 00.1-03 (Oracle DDL across 4 schemas) → Phase 00.1-04 (ES rectrace_core_index mapping with 13 .keyword multi-fields) → Phase 00.1-05 (5 connected scenarios seeded across 11 tables + ES index; Phase 8 dry-run target verified)
- Trend: Atomic, fast plans; one Rule 3 inline fix in 00.1-05 (index-create-from-mapping before bulk-load — apply.py inherits in 00.1-06)

*Updated after each plan completion*

**Per-plan metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 00.1 P01 | 2min | 2 tasks | 4 files |
| Phase 00.1 P02 | 6min | 2 tasks | 2 files |
| Phase 00.1 P03 | 5min | 2 tasks | 4 files |
| Phase 00.1 P04 | 1min | 1 task | 1 file |
| Phase 00.1 P05 | 3min | 2 tasks | 6 files |
| Phase 00.1 P06 | 25min | 2 tasks | 1 files |
| Phase 00.1 P07 | 14min | 3 tasks | 4 files (2 .properties + README + SUMMARY) |
| Phase 02-react-foundation P03 | 12 | 2 tasks | 17 files |
| Phase 03 P08 | 15min | 2 tasks | 2 files |
| Phase 05-config-driven-select P06 | 25min | 2 tasks | 5 files |
| Phase 06 P01 | 16min | 3 tasks | 2 files |
| Phase 06 P02 | 7min | 2 tasks | 9 files |
| Phase 06 P03 | 22min | 2 tasks | 22 files |
| Phase 06-es-loader-subsystem P04 | 22min | 2 tasks | 9 files |
| Phase 06-es-loader-subsystem P05 | 75min | 3 tasks | 9 files |
| Phase 07-observability-sweep P04 | 40m | 2 tasks | 14 files |
| Phase 07 P05 | 47min | 2 tasks | 3 files |
| Phase 08 P02 | 156 | 2 tasks | 2 files |
| Phase 08 P03 | 15m | 2 tasks | 3 files |

## Accumulated Context

### Roadmap Evolution

- Phase 00.1 inserted after Phase 0: Local Dev Seed Bootstrap — prerequisite for Phase 1 BOOT-09 smoke; produces sibling ../rectrace-local-dev/ folder outside repo (URGENT)

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Build new React app rather than rewrite Angular — pending
- Spring Boot 2.7 → 3.2 upgrade lands as Phase 1 before all net-new code — pending
- Vertical-slice strangler-fig; Angular and React run side-by-side at distinct URL prefixes — pending
- ES Loader scheduler (Quartz vs `@Scheduled`+ShedLock) — **open decision**, lock in Phase 6 planning
- User-auth mechanism (CitiPortal / SiteMinder / SPNEGO) — deferred to Phase 9 planning
- Service-auth mechanism (Kerberos keytab / Vault) — deferred to Phase 9 planning
- Log-aggregator target (Splunk / ELK / Loki / OTel) — deferred to Phase 7 planning
- [Phase 00.1]: Sibling repo bootstrapped per D-0.1.1/D-0.1.2 — standalone git repo at /Users/aarun/Workspace/Projects/rectrace-local-dev/ on main; .gitignore committed FIRST to mitigate threat T-00.1-01
- [Phase 00.1]: Python virtualenv lives in .venv/ inside the sibling repo (per D-0.1.21); pinned deps installed: oracledb 4.0.0, elasticsearch 8.13.2, python-dotenv 1.2.2
- [Phase 00.1]: Two-service docker stack live per D-0.1.15/D-0.1.16/D-0.1.17 — gvenzl/oracle-free:23-slim + elasticsearch:8.13.4, container_name pinning (BLOCKER-4 fix), :ro init mount (T-00.1-04 mitigated), -XX:UseSVE=0 Apple Silicon workaround (T-00.1-06 mitigated); 4 schema users created in FREEPDB1
- [Phase 00.1]: 11 Oracle tables live across 4 schemas via 4 idempotent DDL files (schema/01-rectrace.sql..04-recportal.sql); ujo_job and ujo_job_status are SEPARATE tables joined on joid per JobStatusService.java:46-50 (BLOCKER-1+3 fix — status NUMBER(10), next_start NUMBER(19)); command/description CLOB on autosys_all_jobs_data per D-0.1.8; rectrace_core has 22 columns matching search-config-v4.json union; re-apply confirmed idempotent
- [Phase 00.1]: ES rectrace_core_index mapping authored at es/rectrace_core_index.mapping.json with explicit `.keyword` multi-fields at `ignore_above: 8192` on the 13 hyphen-sensitive fields (file_name_pattern, recon, box_name, set_id, sub_acc, load_file_name_pattern, job_name, machine, run_calendar, exclude_calendar, tlm_instance, recon_id, recon_portal_id) — Phase 8 hyphen-bug fix prerequisite per CONTEXT.md D-0.1.10 / RESEARCH.md Pitfall 3 (dynamic mapping would default to ignore_above:256 and silently truncate); live-validated by PUT against localhost:9200 then deleted for plan 00.1-06 idempotency
- [Phase 00.1]: Seed-data plan 5 complete — 5 fully-connected fabricated scenarios across 11 Oracle tables (220 rows total: 5 rectrace_core + 5 ujo_job + 5 ujo_job_status + 15 autosys_tlm_recon_sequences + 20 autosys_all_jobs_data + 5 recon_bank + 50×3 mr_csum_* + 10 quickrec_stats + 5 recportal_manual_match) + ES rectrace_core_index (5 docs); ujo_job and ujo_job_status split with joid JOIN returning 5 rows (BLOCKER-1+3 verified live); mr_csum_* / quickrec.load_date / manual_match.cob+updated_date all use TRUNC(SYSDATE) ± N (WARNING-5); status mix [(1,2),(2,1),(4,1),(7,1)]; 2 of 5 scenarios use hyphenated identifiers (LOAD-ABC-123, RECON-XYZ-42 and friends), `term:set_id.keyword="SET-ABC-123"` and `term:job_name.keyword="LOAD-ABC-123"` each return 1 hit (Phase 8 dry-run target verified — LOCAL-DEV-04a). Rule 3 inline fix: index-create-from-mapping conditional added because plan 04 deleted the index for plan 06 idempotency — same conditional becomes apply.py's logic in plan 00.1-06.
- [Phase 00.1]: apply.py owns ES index lifecycle (drop+recreate from mapping JSON on every --reset) — plan 05's inline conditional was a one-time bootstrap; apply.py is now the version-controlled source of truth for the 13 .keyword multi-fields
- [Phase 00.1]: apply_sql_file does NOT strip trailing ';' from SQL chunks — oracledb thin mode REQUIRES 'END;' on PL/SQL blocks (PLS-00103 without it) and accepts a trailing ';' on plain DDL — the simpler-and-correct rule is to leave chunk endings untouched
- [Phase 00.1 P07]: Two application-local.properties files committed in THIS repo (scope concession to D-0.1.24) — backend/rectrace points at localhost:1521/FREEPDB1 with rectrace/autosys schema-user credentials + http://localhost:9200 (no auth); rectrace-tlm-stats points at the same Oracle for reconmgmt/recportal. Phase 1 D-1.14 inherits these as-is. Rule 3 inline fix: removed `application-local.properties` from rectrace-tlm-stats/.gitignore.
- [Phase 00.1 P07]: D-0.1.23 8-item smoke executed at phase exit — 5/5 automatable steps PASS (1=app starts with KNOWN GAP, 2=V4 search returns 3 SAMPLE_* rows, 3=suggest endpoint 200 OK empty, 7=hyphenated set_id.keyword=SET-ABC-123 returns 1 hit (Phase 8 dry-run prerequisite VERIFIED LIVE), 8=apply.py --reset idempotent across 2 cycles). UI steps 4/5/6 (execution-order graph, TLM-stats modal, QuickRec modal) deferred to manual user verification with explicit recipes in SUMMARY.md.
- [Phase 00.1 P07]: TWO KNOWN GAPS handed to Phase 1 BOOT-08 — (a) **backend/rectrace DataSourceConfig.java** lines 41-42 unconditionally call scriptExecutor.executeScript("/opt/rectify/control/scripts/get_password.sh", ...) IGNORING datasource.password (newly discovered by strict smoke; matches the parallel rectrace-tlm-stats DatabaseConfig.java pattern at lines 80/108/190 the plan already knew about); (b) Lombok 1.18.30 ↔ Java 25 compile incompatibility (workaround: build with JAVA_HOME=Java 21). Both resolved by Phase 1 Boot 2.7 → 3.3.x upgrade.
- [Phase ?]: BASE_URL='' in queryClient.ts — RESEARCH.md Pattern 7 superseded; Vite dev proxy handles /rectrace/api routing
- [Phase ?]: apiFetch wrapper with X-Correlation-Id — 32-char hex per call; correlationId attached to thrown Error for toast display
- [Phase ?]: Custom ThemeProvider context (NOT next-themes) with STORAGE_KEY='rectrace-theme' mirroring recviz pattern
- [Phase ?]: Phase 3 close: smoke-ssrm Step 0 asserts /config exposes the 3 Phase 3 renderer keys; parity-matrix flipped 6 deliverables to port
- [Phase ?]: D-5.06.1: Schema-qualify configured SELECT (rectrace.rectrace_core) to resolve Plan 05 deferred ORA-00942 without touching sibling seed repo.
- [Phase ?]: D-5.06.2: Ship ANGULAR-WIRING.md (file:line citation) rather than Angular code edits — strangler-fig + D-5.18 + SQL-07 satisfied by green smoke.
- [Phase ?]: ShedLock 7.7.0 pinned inline (no Maven property variable) — mirrors Phase 5 jsqlparser:5.3 pattern
- [Phase ?]: Wave-0 scaffold uses class-level @Disabled, not per-method — Plans 06-03/04/05 enable by removing one annotation
- [Phase ?]: spring.lifecycle.timeout-per-shutdown-phase=60s mitigates Pitfall L3 (default 30s force-kills BulkIngester mid-flush)
- [Phase ?]: Plan 06-03: DocumentIdHasher uses JSON-encoded PK array → SHA-256 → first 8 bytes → HexFormat 16-hex-char ID (Pitfall L5)
- [Phase ?]: Plan 06-03: LoaderConfigService is @Profile('!test') + uses ReflectionTestUtils-based unit tests; ES alias check skipped when esClient is null with WARN
- [Phase ?]: Plan 06-03: LoaderRunHistoryService prunes via Oracle ROW_NUMBER() analytic DELETE scoped to single job_key (LOADER-07 race-safety); last_error truncated to 8192 chars
- [Phase ?]: Plan 06-04: Pattern 2 (programmatic LockingTaskExecutor.executeWithLock) over @SchedulerLock — lock name is runtime config-derived
- [Phase ?]: Plan 06-04: @EnableScheduling co-located on LoaderShedLockConfig (not RectraceApplication) so scheduler stays dormant in test profile
- [Phase ?]: Plan 06-04: runNow does NOT call markFired — manual triggers must not perturb cron schedule next-fire calculation
- [Phase ?]: Plan 06-05: loaderJdbcTemplate marked @Primary to restore type-autowire for legacy V4 search after Plan 06-03 introduced JdbcTemplate ambiguity
- [Phase ?]: Plan 06-05: recordRunStart truncates Instant to ChronoUnit.MILLIS to match loader_run_history TIMESTAMP(3) precision (fixes phantom RUNNING-status rows)
- [Phase ?]: Plan 06-05: controller-slice tests for @Profile('!test') controllers use @ActiveProfiles('slice') + @AutoConfigureMockMvc(addFilters=false)
- [Phase ?]: Phase 07-04: tlm-stats observability mirror lands as lean subset of backend/rectrace surface — byte-identical logback-spring.xml (diff=0), mirrored filter chain + actuator lockdown + ActuatorSecurityConfig, OracleHealthIndicator over reconmgmt DS only (per-TLM-instance datasources excluded — T-07-22), AsyncConfig with ContextPropagatingTaskDecorator created from scratch. Slow-query AOP intentionally NOT ported (A3). Six Wave-0 OBS contract tests un-disabled and green; tlm-stats suite 10/0/0; backend regression 82/0/0.
- [Phase ?]: Plan 07-05: maven-enforcer Micrometer pin (Option A) — bannedDependencies io.micrometer:*:[2.0.0,) + two scoped requireSameVersions (core 1.15.x train + tracing 1.5.x train); single-group spec split inline because the two Micrometer release trains have BOM-blessed separate versions (Rule 3)
- [Phase ?]: Plan 07-05: smoke-observability.sh tolerates env-state DOWNs — Section 3 (loader group 404) is WARN not FAIL; Section 2 (health 503) reports the env gap honestly; Section 6 cleanly SKIPs when tlm-stats unreachable
- [Phase ?]: Plan 07-05: synthetic-override proof done by tightening bannedDependencies ceiling to [1.15.0,) rather than pinning Micrometer 2.0.0 — Maven Central has no 2.x publication yet so BOM-import resolution fails before enforcer runs
- [Phase ?]: Phase 8 Plan 02: registry field separator is pipe (start_cmd contains colon)
- [Phase ?]: Phase 8 Plan 02: eval $C_CMD scoped + sourced from version-controlled registry only (T-08-05)
- [Phase ?]: Phase 8 Plan 02: start all spawns then probes — wall-clock bounded by slowest component
- [Phase 8 Plan 08-01]: D-8.2 locked in code — `ElasticsearchServiceV4` routes `.keyword`-suffixed wildcards through `caseInsensitive(true)` via a `buildWildcard(field, pattern)` helper. Additive only — no reindex, no `search-config-v4.json` edit. Production-stack mapping PUT documented in HYPHEN-DIAGNOSTIC.md as a deploy-phase runbook.
- [Phase 8 Plan 08-01]: Test-input alignment with seed (Rule 1) — plan body referred to `RECON-XYZ-42` for `reconId`, but seed has `recon_id=RID-XYZ-42` while `RECON-XYZ-42` is in `job_name`. Tests/smoke use the seed's actual values mapped to the right categories: `reconId/RID-XYZ-42`, `jobName/RECON-XYZ-42`, `setId/SET-ABC-123`, mixed-case `jobName/recon-xyz-42`. Recorded in HYPHEN-DIAGNOSTIC.md "Test-input alignment".
- [Phase 8 Plan 08-01]: Live-stack regression gate pattern — `@SpringBootTest` + `@ActiveProfiles("local")` + `@EnabledIfSystemProperty(named="es.live", matches="true")`. Re-usable for any future boot+live-infra test. CI without ES skips cleanly; locally runs with `-Des.live=true`. Backend suite now 86 tests / 4 skipped by design.
- [Phase 8 Plan 08-01]: Smoke health-probe = `/actuator/health/readiness` (not aggregate `/actuator/health`) — aggregate is DOWN on laptop dev stack for reasons unrelated to search (Oracle DS, loader-run-age indicator); readiness reflects the contract the smoke actually cares about.
- [Phase ?]: Adopt RECTRACE_COMPONENTS_FILE env-hook for stub registries — one-line patch on the source line in ops/rectrace-ops.sh, zero risk to existing call sites (08-03).
- [Phase ?]: Use python3 -m http.server as readiness target in ops/ci-smoke.sh — pre-installed on every ubuntu-latest runner, no extra Action needed (08-03).
- [Phase ?]: Path-filter the GitHub Actions workflow to ops/** + the workflow file itself — keeps CI minutes minimal while preserving every regression signal (08-03).

### Pending Todos

None yet.

### Blockers/Concerns

- Backend tests are skipped by default (`maven.test.skip=true`) — addressed in Phase 0.
- Hyphen search bug is a daily user complaint — addressed in Phase 8 (fix benefits from alias indirection landed in Phase 6).
- recviz embed is the highest-uncertainty integration — written cross-team contract gated as Phase 4 entry criterion.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Planning state | REQUIREMENTS.md missing LOCAL-DEV-01..06 entries (referenced by ROADMAP Phase 00.1 + every 00.1-*-PLAN.md) — see `.planning/phases/00.1-local-dev-seed-bootstrap/deferred-items.md` | Open | Plan 00.1-01 (2026-05-12) |
| Design tokens | Add chart/series/ramp tokens to `frontend-react/src/index.css` "Rectrace extensions" overlay block — surfaces when first chart/data-viz component is planned (see Phase 2 CONTEXT.md D-2.7). Reference recviz `src/index.css` `--series-1..8`, `--ramp-low/high`, `--chart-positive/negative/warning`. Phase 8 DESIGN-01 audits the lot. | Open | Phase 2 discuss (2026-05-13) |
| Docs hygiene | ROADMAP.md (Phase 2 SC#5, Phase 3 SC#1) + REQUIREMENTS.md (REACT-08, SEARCH-07) need edits: drop `/v6/` references (superseded by Phase 2 D-2.4); drop "angular" from ops-script component lists (superseded by Phase 2 D-2.15). Either fold into Phase 2 plan-phase or capture separately. | Closed — resolved in Plan 02-05 | Phase 2 discuss (2026-05-13) |

## Session Continuity

Last session: 2026-05-17T16:17:43.393Z
Stopped at: Plan 08-03 complete (OPS-04 — Linux CI gate: ops/ci-smoke.sh 11/11 + .github/workflows/ops-script.yml); Phase 8 ready for verification
Resume file: None
