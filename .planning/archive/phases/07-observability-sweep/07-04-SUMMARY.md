---
phase: 07-observability-sweep
plan: 04
subsystem: infra
tags: [observability, tlm-stats, mirror, logback, splunk, actuator, health-indicator, prometheus, mdc, async, context-propagation]

# Dependency graph
requires:
  - phase: 07-observability-sweep/01
    provides: "POM dependencies (logstash-logback-encoder 8.0, micrometer-registry-prometheus, spring-boot-starter-aop, micrometer-tracing-bridge-brave); 6 @Disabled OBS contract test scaffolds in rectrace-tlm-stats"
  - phase: 07-observability-sweep/02
    provides: "Canonical backend/rectrace logback-spring.xml + UserIdMdcFilter + AccessLogFilter + ActuatorSecurityConfig + actuator exposure block ported verbatim into tlm-stats"
  - phase: 07-observability-sweep/03
    provides: "Canonical backend/rectrace OracleHealthIndicator + HealthIndicatorDataSourceConfig + AsyncConfig (ContextPropagatingTaskDecorator) mirrored into tlm-stats subset"
provides:
  - "tlm-stats logback-spring.xml byte-identical to backend/rectrace (profile-aware !prod console / prod STDOUT_JSON + SPLUNK_HEC, parameterised via spring.application.name)"
  - "tlm-stats observability filter chain: UserIdMdcFilter (HIGHEST_PRECEDENCE+100) + AccessLogFilter (LOWEST_PRECEDENCE) emitting canonical traceId/userId/path/method/status/durationMs MDC keys"
  - "tlm-stats /actuator/ exposure allow-list matching backend/rectrace (health, info, prometheus, loggers, metrics; sensitive endpoints deny-listed)"
  - "tlm-stats ActuatorSecurityConfig stub (anonymous permit-all for Phase 7; Phase 9 SEC-01 hardens AUTH)"
  - "tlm-stats OracleHealthIndicator + HealthIndicatorDataSourceConfig probing reconmgmtDataSource via dedicated 2 s-timeout JdbcTemplate (Open Q9 — single static DS, no per-TLM amplification)"
  - "tlm-stats AsyncConfig wires ContextPropagatingTaskDecorator + Slf4jThreadLocalAccessor (created from scratch; tlm-stats had no AsyncConfig previously)"
  - "Six Wave-0 OBS tests in tlm-stats un-disabled and PASSING (AccessLogJsonShapeTest, ActuatorExposureTest, ActuatorHealthIntegrationTest, PrometheusEndpointTest, AsyncMdcPropagationTest, OracleHealthIndicatorTest)"
affects: ["07-05 phase-gate verification", "future Phase 8 ops hardening", "future Phase 9 SEC-01 actuator AUTH"]

# Tech tracking
tech-stack:
  added: []  # No new dependencies — Plan 07-01 pre-staged everything for tlm-stats
  patterns:
    - "Cross-module logback-spring.xml parity: identical byte content, per-module variance resolved at boot time via <springProperty source='spring.application.name'/> — guarantees single canonical JSON schema for Splunk ingest (T-07-20)"
    - "Lean-mirror discipline: tlm-stats receives the subset of Phase 7 surface that maps to its real subsystem inventory — no loader, no Elasticsearch, no SQL search => no LoaderRunAgeHealthIndicator / ElasticsearchHealthIndicator / SearchConfigHealthIndicator; no SlowQueryLoggerAspect either (Plan 07-04 A3 decision)"
    - "Health probe isolation: dedicated healthCheckJdbcTemplate bean per module — never mutate the shared production JdbcTemplate's queryTimeout (Pitfall P-7 / T-07-12)"
    - "Health probe scope minimisation: aggregate /actuator/health probes only the static reconmgmtDataSource — per-TLM-instance datasources (9 dynamic instances) are deliberately excluded to avoid 9x load amplification + flapping (T-07-22)"
    - "Test-context @MockBean discipline in tlm-stats: DatabaseConfig is @Profile('!test') so service-layer @SpringBootTest classes mirror TlmStatsApplicationTests by mocking TlmStatsService / TlmStatsV2Service / QuickRecStatsService"

key-files:
  created:
    - rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/observability/filter/UserIdMdcFilter.java
    - rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/observability/filter/AccessLogFilter.java
    - rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/observability/ActuatorSecurityConfig.java
    - rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/observability/health/OracleHealthIndicator.java
    - rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/observability/health/HealthIndicatorDataSourceConfig.java
    - rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/config/AsyncConfig.java
  modified:
    - rectrace-tlm-stats/src/main/resources/logback-spring.xml (REPLACED — now byte-identical to backend/rectrace)
    - rectrace-tlm-stats/src/main/resources/application.properties (actuator exposure allow-list + observability flags)
    - rectrace-tlm-stats/src/test/resources/application-test.properties (test-classpath flags mirroring backend test props)
    - rectrace-tlm-stats/src/test/java/com/citi/gru/rectrace/tlmstats/observability/AccessLogJsonShapeTest.java (un-disabled + @MockBean wiring)
    - rectrace-tlm-stats/src/test/java/com/citi/gru/rectrace/tlmstats/observability/ActuatorExposureTest.java (un-disabled + @MockBean wiring)
    - rectrace-tlm-stats/src/test/java/com/citi/gru/rectrace/tlmstats/observability/ActuatorHealthIntegrationTest.java (un-disabled + @MockBean wiring)
    - rectrace-tlm-stats/src/test/java/com/citi/gru/rectrace/tlmstats/observability/PrometheusEndpointTest.java (un-disabled + @MockBean wiring)
    - rectrace-tlm-stats/src/test/java/com/citi/gru/rectrace/tlmstats/observability/AsyncMdcPropagationTest.java (un-disabled + @MockBean wiring)
    - rectrace-tlm-stats/src/test/java/com/citi/gru/rectrace/tlmstats/observability/health/OracleHealthIndicatorTest.java (un-disabled; forward-declared stub class replaced with imports of the real OracleHealthIndicator)

key-decisions:
  - "logback-spring.xml is byte-identical across both modules (diff = 0). The single XML file resolves spring.application.name at boot time, so one canonical file fits both modules — no template forking, no per-module variance to maintain."
  - "OracleHealthIndicator probes ONLY the static reconmgmtDataSource (Open Q9). Per-TLM-instance datasources are intentionally NOT registered as health contributors because /actuator/health is invoked frequently by load balancers/probes and probing 9 instances would amplify Oracle load 9x; one transient TLM-instance outage would also flap the aggregate health status. A future per-instance health endpoint can be added if/when needed without changing the OBS-02 aggregate contract."
  - "AsyncConfig taskExecutor pool sizes are halved relative to backend/rectrace (core=5, max=10, queue=50). tlm-stats has no SSRM and no parallel ES — its @Async footprint is lighter, so a smaller pool keeps the resource budget proportional. Can be tuned upward if @Async usage grows."
  - "Slow-query AOP NOT ported to tlm-stats (Plan 07-04 A3). The aspect was added in backend/rectrace because the SQL search subsystem makes diagnosing slow JDBC paths a recurring need; tlm-stats has a fixed, narrow set of queries (TLM stats aggregations + QuickRec stats) with no evidence of latency issues. If TLM queries prove slow under prod load, a follow-up plan adds the aspect; the current decision is 'don't ship parity for a non-evidence-based hypothetical.'"
  - "Test infrastructure: every @SpringBootTest in tlm-stats observability/ adds @MockBean for TlmStatsService / TlmStatsV2Service / QuickRecStatsService because DatabaseConfig is @Profile('!test') and the TlmJdbcTemplateFactory bean is therefore absent. This mirrors the pre-existing TlmStatsApplicationTests pattern and is the established convention in this module."

patterns-established:
  - "Multi-module observability parity (Splunk schema invariant): same logback-spring.xml, same MDC keys, same exposure list, same security stub — module name resolved at runtime, not at file edit time."
  - "Mirror with sub-setting: when the source module has subsystems the mirror module doesn't (loader / ES / SQL search), the mirror skips the indicator/aspect entirely rather than shipping a stub — keeps /actuator/health truthful about what's being probed."

requirements-completed: [OBS-01, OBS-02, OBS-03, OBS-05, OBS-06, OBS-07]

# Metrics
duration: 40min
completed: 2026-05-17
---

# Phase 7 Plan 04: tlm-stats observability mirror Summary

**Profile-aware JSON logging via logstash-logback-encoder 8.0, MDC filter chain (traceId/userId/path/method/status/durationMs), locked-down /actuator/* surface with anonymous-stub security, OracleHealthIndicator over reconmgmt DS with dedicated 2 s-timeout JdbcTemplate, and ContextPropagatingTaskDecorator-backed AsyncConfig — all mirrored from backend/rectrace into rectrace-tlm-stats with a lean subset that matches the module's actual subsystem inventory.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-05-17T13:58:00Z
- **Completed:** 2026-05-17T14:36:00Z
- **Tasks:** 2 (both `type=auto`, both `tdd=true`; six Wave-0 contract tests gated each task's `<verify>` block)
- **Files modified:** 14 (6 created in main, 1 replaced + 2 edited in main resources, 5 modified + 1 rewritten in tests)

## Accomplishments

- **tlm-stats logback-spring.xml is byte-identical to backend/rectrace's** (`diff` returns exit 0 / 0 lines). Single canonical file resolves `spring.application.name` at boot time; prod profile attaches `STDOUT_JSON` (LogstashEncoder) + `SPLUNK_HEC` (LogstashTcpSocketAppender at `${splunkHost}:${splunkPort}` with built-in 8192-slot ring buffer). `!prod` keeps a single human-readable Console appender for laptop dev / UAT / test.
- **Filter chain ported under `com.citi.gru.rectrace.tlmstats.observability.filter`** — same regex `^[A-Za-z0-9._-]{1,64}$` for log-injection protection (T-07-05), same MDC `finally`-block cleanup discipline (Pitfall P-3), same ordering relative to Phase 2's `CorrelationIdPropagationConfig`.
- **`/actuator/*` allow-list locked down** to `health, info, prometheus, loggers, metrics` with explicit deny-list for `env, heapdump, shutdown, beans, configprops, threaddump, scheduledtasks` (T-07-21). No `loader` group line — tlm-stats has no loader subsystem.
- **OracleHealthIndicator over reconmgmtDataSource** via dedicated `healthCheckJdbcTemplate` with `setQueryTimeout(2)` — the shared `reconmgmtJdbcTemplate` used by `TlmStatsService` / `TlmStatsV2Service` / `QuickRecStatsService` is left untouched (Pitfall P-7 / T-07-12). Per-TLM-instance datasources intentionally NOT registered as health contributors to avoid 9× load amplification + flapping (T-07-22, Open Q9).
- **AsyncConfig created from scratch** with `ThreadPoolTaskExecutor` (core=5, max=10, queue=50, `TlmStatsAsync-` thread prefix) + `ContextPropagatingTaskDecorator` + `@PostConstruct` registration of `Slf4jThreadLocalAccessor` — MDC `traceId` / `userId` + Brave TraceContext + Security + RequestContext propagate from caller to async worker thread (D-7.6 / OBS-06 / T-07-19). Pool halved vs. backend/rectrace because tlm-stats has no SSRM / no parallel ES.
- **Six Wave-0 OBS contract tests in tlm-stats are now un-disabled and green:** `AccessLogJsonShapeTest`, `ActuatorExposureTest`, `ActuatorHealthIntegrationTest`, `PrometheusEndpointTest`, `AsyncMdcPropagationTest`, `OracleHealthIndicatorTest`.
- **Full tlm-stats test suite remains green:** **10 tests run, 0 failures, 0 errors, 0 skipped.**
- **Backend regression check:** **82 tests, 0 failures, 0 errors, 0 skipped** in `backend/rectrace`. Phase 7 surface in both modules is now consistent.
- **Lean-mirror integrity verified:** no `Loader`, `SearchConfig`, `Elasticsearch`, `SlowQuery`, or `SlowLog` artifacts created in `rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/observability/` (grep returned no matches).

## Task Commits

Each task was committed atomically on `milestone/modernization`:

1. **Task 1: Port logback-spring.xml + application.properties + filters + ActuatorSecurityConfig + un-disable 2 tests** — `9a36301` (feat)
2. **Task 2: OracleHealthIndicator + HealthIndicatorDataSourceConfig + AsyncConfig + un-disable 4 tests** — `5929fcb` (feat)

**Plan metadata:** _to be added after SUMMARY write_ (docs: complete plan).

## Files Created/Modified

### Created (6 main-source files)

- `rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/observability/filter/UserIdMdcFilter.java` — Validates `x-citiportal-loginid` against `^[A-Za-z0-9._-]{1,64}$` and puts it into MDC.userId; HIGHEST_PRECEDENCE+100.
- `rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/observability/filter/AccessLogFilter.java` — Emits one `info` event on the `access` SLF4J logger per HTTP request with MDC.path/method/status/durationMs; LOWEST_PRECEDENCE.
- `rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/observability/ActuatorSecurityConfig.java` — `@Order(HIGHEST_PRECEDENCE)` SecurityFilterChain matching `EndpointRequest.toAnyEndpoint()` with anonymous permitAll; active in all profiles.
- `rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/observability/health/OracleHealthIndicator.java` — `@Component("oracle")` extending `AbstractHealthIndicator`; runs `SELECT 1 FROM DUAL` via `healthCheckJdbcTemplate`; null-safe so it boots in test profile and surfaces `$.components.oracle.status` regardless.
- `rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/observability/health/HealthIndicatorDataSourceConfig.java` — `@Profile("!test") @Configuration` exposing a dedicated `healthCheckJdbcTemplate` bean over `reconmgmtDataSource` with `setQueryTimeout(2)`; `@ConditionalOnBean(name="reconmgmtDataSource")`.
- `rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/config/AsyncConfig.java` — `@Configuration @EnableAsync` with `taskExecutor` bean wiring `ContextPropagatingTaskDecorator`; `@PostConstruct` registers `Slf4jThreadLocalAccessor` with the global `ContextRegistry`.

### Modified

- `rectrace-tlm-stats/src/main/resources/logback-spring.xml` — REPLACED with the byte-identical backend/rectrace template; `diff` of the two files now returns exit 0.
- `rectrace-tlm-stats/src/main/resources/application.properties` — replaced the legacy two-line actuator block with the full Plan 02 OBS allow/deny list + show-details=when-authorized + observations.annotations.enabled + probes.enabled. NO `loader` group line (lean-mirror).
- `rectrace-tlm-stats/src/test/resources/application-test.properties` — added show-details=always, exposure allow-list, DOWN→200 status mapping, and `management.defaults.metrics.export.enabled=true` + `management.prometheus.metrics.export.enabled=true` to neutralise Spring Boot's `DisableObservabilityContextCustomizer`. Mirrors backend test props.
- Six test files: removed `@Disabled` and (where required) added `@MockBean` for `TlmStatsService` / `TlmStatsV2Service` / `QuickRecStatsService`. `OracleHealthIndicatorTest` was rewritten — the original scaffold contained a forward-declared stub `OracleHealthIndicator` class which has been replaced with imports of the real production class plus a third test (`downWhenJdbcTemplateMissing`) that matches the backend equivalent.

## Decisions Made

- **One canonical logback-spring.xml across both modules.** Byte-identical (verified by `diff` returning exit 0). The only per-module variance is `spring.application.name` which `<springProperty source="spring.application.name"/>` resolves at boot. This keeps Splunk ingest seeing one canonical JSON schema (T-07-20) and removes future drift risk.
- **Aggregate `/actuator/health` probes only `reconmgmtDataSource`** (Plan 07-04 Open Q9). Per-TLM-instance datasources (dynamically constructed from `tlm-instances.json` at startup) are NOT registered as health contributors because /actuator/health is hit frequently and probing 9 instances would amplify load 9× plus flap the aggregate status on any single-instance outage (T-07-22). Future per-instance endpoint can be added separately.
- **Slow-query aspect NOT ported to tlm-stats** (Plan 07-04 A3). The aspect was justified in backend/rectrace by the SQL search subsystem; tlm-stats has a fixed, narrow query set with no current latency evidence. Will revisit only if prod telemetry shows slow TLM queries.
- **AsyncConfig pool sizes halved vs. backend/rectrace** (core=5/max=10/queue=50 vs. backend's 10/20/100). tlm-stats has lighter async load — no SSRM, no parallel ES.
- **Test classpath @MockBean discipline.** Mirrors `TlmStatsApplicationTests` — `DatabaseConfig` is `@Profile("!test")` so its beans are absent; every `@SpringBootTest` in `observability/` mocks the three service classes that depend on `TlmJdbcTemplateFactory`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Added `@MockBean` declarations to four un-disabled `@SpringBootTest` classes**
- **Found during:** Task 1 (`AccessLogJsonShapeTest` and `ActuatorExposureTest`) and Task 2 (`ActuatorHealthIntegrationTest`, `PrometheusEndpointTest`, `AsyncMdcPropagationTest`).
- **Issue:** Removing `@Disabled` caused ApplicationContext load failures: `NoSuchBeanDefinitionException: No qualifying bean of type 'com.citi.gru.rectrace.tlmstats.config.DatabaseConfig$TlmJdbcTemplateFactory' available`. `DatabaseConfig` is `@Profile("!test")` so its inner `TlmJdbcTemplateFactory` bean is absent in the test profile; `TlmStatsService` / `TlmStatsV2Service` / `QuickRecStatsService` field-inject that bean and fail to instantiate. The Plan 07-01 scaffold authors didn't include `@MockBean` wiring because the scaffolds were `@Disabled` — they couldn't have caught this until enable-time.
- **Fix:** Added `@MockBean TlmStatsService tlmStatsService; @MockBean TlmStatsV2Service tlmStatsV2Service; @MockBean QuickRecStatsService quickRecStatsService;` to every `@SpringBootTest` class in `observability/`. This is the established `TlmStatsApplicationTests` pattern in this module.
- **Files modified:** five test files (`AccessLogJsonShapeTest`, `ActuatorExposureTest`, `ActuatorHealthIntegrationTest`, `PrometheusEndpointTest`, `AsyncMdcPropagationTest`).
- **Verification:** All five tests load ApplicationContext successfully and assertions pass. `OracleHealthIndicatorTest` did not need this (pure unit test, no Spring context).
- **Committed in:** `9a36301` (Task 1) and `5929fcb` (Task 2).

**2. [Rule 1 — Bug] Rewrote `OracleHealthIndicatorTest` to remove forward-declared stub class**
- **Found during:** Task 2 (un-disabling `OracleHealthIndicatorTest`).
- **Issue:** The Plan 07-01 scaffold defined an inner static class `OracleHealthIndicator implements HealthIndicator` as a placeholder, intended to be deleted when the real class landed. If the un-disable had just deleted `@Disabled`, the test would still have been testing the forward-declared stub, not the real `com.citi.gru.rectrace.tlmstats.observability.health.OracleHealthIndicator`.
- **Fix:** Rewrote the test file: removed the inner stub class, added an import of the real `OracleHealthIndicator`, and added a third test (`downWhenJdbcTemplateMissing`) matching the backend equivalent which the scaffold lacked.
- **Files modified:** `rectrace-tlm-stats/src/test/java/com/citi/gru/rectrace/tlmstats/observability/health/OracleHealthIndicatorTest.java`.
- **Verification:** 3 tests in this file, all green; tests now exercise the production class.
- **Committed in:** `5929fcb` (Task 2).

**3. [Rule 3 — Blocking] Stripped extra parity comment block from `logback-spring.xml` to achieve byte-identical diff**
- **Found during:** Task 1 verify step.
- **Issue:** My first draft of the tlm-stats `logback-spring.xml` added a five-line comment paragraph explaining the parity. The plan's `<verify>` requires `diff` to return 0–3 differences max (all comments); my version returned 6 added comment lines. While that still met the "all comments" qualifier, it was simpler to remove the extra block — Spring's single canonical file already speaks for itself.
- **Fix:** Removed the parity comment paragraph.
- **Files modified:** `rectrace-tlm-stats/src/main/resources/logback-spring.xml`.
- **Verification:** `diff backend/rectrace/src/main/resources/logback-spring.xml rectrace-tlm-stats/src/main/resources/logback-spring.xml` now returns exit 0 — byte-identical.
- **Committed in:** `9a36301` (Task 1).

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 bug).
**Impact on plan:** All three auto-fixes were corrections to scaffolds left over from Plan 07-01 (which knew it couldn't enable them without the real classes landing). No scope creep — every change keeps the lean-mirror posture intact. No new dependencies, no new subsystems, no work outside the plan's two tasks.

## Output Spec Compliance (per Plan 07-04 `<output>`)

- **Byte-diff between modules' logback-spring.xml:** zero. Verified via `diff` returning exit 0.
- **Exact `reconmgmtDataSource` qualifier name discovered:** `reconmgmtDataSource` (confirmed via grep of `DatabaseConfig.java` line 113). `HealthIndicatorDataSourceConfig` uses `@Qualifier("reconmgmtDataSource")` exactly.
- **Regression check for existing `/api/tlm-stats/*` + `/api/quickrec-stats/*`:** the controllers were not touched by this plan. The only test-classpath service is mocked, but production wiring is untouched — Spring still instantiates the real controllers when the `test` profile is inactive. A live-stack curl check is outside the scope of this autonomous run; the production controller paths were not modified, the package build succeeds, and `TlmStatsApplicationTests` (which loads the full Spring context with services mocked) passes.
- **Lean-mirror integrity:** grep for `Loader\|SearchConfig\|Elasticsearch\|SlowQuery\|SlowLog` in `rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/observability/` returns no matches. Five expected files only.

## Issues Encountered

None beyond the three deviations above; each was the natural consequence of enabling scaffolds that had been deliberately left structurally incomplete by Plan 07-01.

## User Setup Required

None — no external service configuration. Splunk HEC endpoint host/port are read from `splunk.hec.host` / `splunk.hec.port` properties at boot; defaults match backend/rectrace. Production `application-prod.properties` (if/when added by Phase 8 ops hardening) can override.

## Next Phase Readiness

- Phase 7 module surface complete across BOTH modules. OBS-01 / OBS-02 / OBS-03 / OBS-05 / OBS-06 / OBS-07 fully covered (backend has additionally OBS-04 / OBS-08 via Plan 07-03's slow-query aspect; tlm-stats does not by design — A3).
- Plan 07-05 (phase-gate verification) can now run a single multi-module audit: backend has 82 tests green, tlm-stats has 10 tests green. Both `mvn -DskipTests package` builds succeed.
- No blockers for Phase 8 or Phase 9. Phase 9 SEC-01 will harden the `ActuatorSecurityConfig` stubs in both modules in lockstep (swap `permitAll()` for `authenticated()` on `/actuator/loggers` and `/actuator/metrics`).

## Self-Check: PASSED

**Files exist:**
- FOUND: `rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/observability/filter/UserIdMdcFilter.java`
- FOUND: `rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/observability/filter/AccessLogFilter.java`
- FOUND: `rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/observability/ActuatorSecurityConfig.java`
- FOUND: `rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/observability/health/OracleHealthIndicator.java`
- FOUND: `rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/observability/health/HealthIndicatorDataSourceConfig.java`
- FOUND: `rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/config/AsyncConfig.java`

**Commits exist:**
- FOUND: `9a36301` (Task 1)
- FOUND: `5929fcb` (Task 2)

---
*Phase: 07-observability-sweep*
*Completed: 2026-05-17*
