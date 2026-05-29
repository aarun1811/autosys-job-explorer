---
phase: 07-observability-sweep
plan: 03
subsystem: observability
tags: [observability, health-indicators, aop, slow-query, micrometer-prometheus, mdc-propagation, scheduler-trace, env-var-correlation]
dependency-graph:
  requires:
    - "07-01 (POM deps + Wave-0 contract scaffolds)"
  provides:
    - "Four HealthIndicator beans (oracle, elasticsearch, loaderRunAge, searchConfig)"
    - "Dedicated healthCheckJdbcTemplate (2s queryTimeout) — never mutates shared template"
    - "SlowQueryLoggerAspect on concrete JdbcTemplate + @SlowLog annotation"
    - "@Profile('!test') gate on slow-query aspect to keep tests fast"
    - "ScheduledTraceIdAspect — fresh Brave span per @Scheduled fire"
    - "AsyncConfig wires ContextPropagatingTaskDecorator + Slf4jThreadLocalAccessor"
    - "ScriptExecutor injects RECTRACE_CORRELATION_ID env var into subprocess"
    - "/actuator/health/loader group (loaderRunAge isolated from readiness)"
  affects:
    - "07-04 (rectrace-tlm-stats parallel work)"
    - "07-05 (deployment ops smoke gate)"
tech-stack:
  added:
    - "io.micrometer.context.integration.Slf4jThreadLocalAccessor (registered on global ContextRegistry)"
    - "org.springframework.core.task.support.ContextPropagatingTaskDecorator (Boot 3.2+ built-in)"
    - "org.springframework.boot.actuate.health.AbstractHealthIndicator (×4 indicators)"
  patterns:
    - "AbstractHealthIndicator base for all indicator beans (Pitfall P-4 — exception → DOWN+error)"
    - "Dedicated short-timeout JdbcTemplate for health probes (Pitfall P-7)"
    - "Separate /actuator/health/loader group for staleness check (Pitfall P-11)"
    - "@Profile('!test') on production SlowQueryLoggerAspect; test registers via @TestConfiguration"
    - "Pointcut on concrete JdbcTemplate (NOT JdbcOperations interface) to avoid double-fire (Pitfall P-6)"
    - "@AutoConfigureObservability on Prometheus test (Boot Test disables observability by default)"
key-files:
  created:
    - backend/rectrace/src/main/java/com/citi/gru/rectrace/observability/health/HealthIndicatorDataSourceConfig.java
    - backend/rectrace/src/main/java/com/citi/gru/rectrace/observability/health/OracleHealthIndicator.java
    - backend/rectrace/src/main/java/com/citi/gru/rectrace/observability/health/ElasticsearchHealthIndicator.java
    - backend/rectrace/src/main/java/com/citi/gru/rectrace/observability/health/LoaderRunAgeHealthIndicator.java
    - backend/rectrace/src/main/java/com/citi/gru/rectrace/observability/health/SearchConfigHealthIndicator.java
    - backend/rectrace/src/main/java/com/citi/gru/rectrace/observability/aop/SlowLog.java
    - backend/rectrace/src/main/java/com/citi/gru/rectrace/observability/aop/SlowQueryLoggerAspect.java
    - backend/rectrace/src/main/java/com/citi/gru/rectrace/observability/aop/ScheduledTraceIdAspect.java
  modified:
    - backend/rectrace/src/main/java/com/citi/gru/rectrace/config/AsyncConfig.java
    - backend/rectrace/src/main/java/com/citi/gru/rectrace/util/ScriptExecutor.java
    - backend/rectrace/src/test/resources/application-test.properties
    - backend/rectrace/src/test/java/com/citi/gru/rectrace/observability/ActuatorHealthIntegrationTest.java
    - backend/rectrace/src/test/java/com/citi/gru/rectrace/observability/PrometheusEndpointTest.java
    - backend/rectrace/src/test/java/com/citi/gru/rectrace/observability/AsyncMdcPropagationTest.java
    - backend/rectrace/src/test/java/com/citi/gru/rectrace/observability/aop/SlowQueryLoggerAspectTest.java
    - backend/rectrace/src/test/java/com/citi/gru/rectrace/observability/aop/ScheduledTraceIdAspectTest.java
    - backend/rectrace/src/test/java/com/citi/gru/rectrace/observability/health/OracleHealthIndicatorTest.java
    - backend/rectrace/src/test/java/com/citi/gru/rectrace/observability/health/ElasticsearchHealthIndicatorTest.java
    - backend/rectrace/src/test/java/com/citi/gru/rectrace/observability/health/LoaderRunAgeHealthIndicatorTest.java
    - backend/rectrace/src/test/java/com/citi/gru/rectrace/observability/health/SearchConfigHealthIndicatorTest.java
    - backend/rectrace/src/test/java/com/citi/gru/rectrace/util/ScriptExecutorEnvVarTest.java
decisions:
  - "All four HealthIndicator beans extend AbstractHealthIndicator (Pitfall P-4) so thrown exceptions map to DOWN with an `error` detail."
  - "Dedicated `healthCheckJdbcTemplate` (queryTimeout=2s) declared in HealthIndicatorDataSourceConfig — never mutates the shared primary JdbcTemplate (Pitfall P-7 / Threat T-07-12)."
  - "LoaderRunAgeHealthIndicator placed in `/actuator/health/loader` group (Pitfall P-11 / Threat T-07-14) so loader staleness never flaps the aggregate /actuator/health readiness probe."
  - "LoaderRunAgeHealthIndicator wires LoaderConfigService + LoaderRunHistoryService directly (the scaffold's FakeRegistry/FakeHistory pre-dated the cron-driven implementation). Cron interval computed via CronExpression.parse(...).next(now)."
  - "SlowQueryLoggerAspect pointcut targets concrete `org.springframework.jdbc.core.JdbcTemplate` ONLY (NOT JdbcOperations interface) to avoid double-fire through NamedParameterJdbcTemplate delegation (Pitfall P-6)."
  - "Slow-query aspect is @Profile('!test') to keep test boots fast/clean (Pitfall P-9). Tests register the aspect via @TestConfiguration."
  - "AsyncConfig uses Spring Boot 3.2+'s built-in ContextPropagatingTaskDecorator (D-7.6) — NOT a hand-rolled MDC-copying decorator."
  - "Slf4jThreadLocalAccessor must be explicitly registered on the global ContextRegistry — it has no SPI auto-registration in context-propagation 1.1.4. Without it, ContextSnapshotFactory.captureAll() does NOT capture MDC."
  - "ScheduledTraceIdAspect uses Micrometer's `io.micrometer.tracing.Tracer.nextSpan().start()` (NOT brave.Tracer directly). Brave's MDC scope decorator populates MDC.traceId from the active span."
  - "ScriptExecutor env-var injection is conditional on MDC.traceId being non-null AND non-empty. Empty-string MDC.traceId is treated as ABSENT (env var omitted, not blank) — Threat T-07-17 + test contract."
metrics:
  duration: ~50 min (executor wall-clock; includes ~5 min cwd-drift recovery)
  completed: 2026-05-17
  tasks_completed: 3
  files_created: 8
  files_modified: 13
  commits: 3
---

# Phase 7 Plan 03: Backend Instrumentation Surface — Summary

Four custom `HealthIndicator` beans (Oracle/ES/LoaderRunAge/SearchConfig) extending `AbstractHealthIndicator`, a `SlowQueryLoggerAspect` with `@SlowLog` annotation pointcut on concrete `JdbcTemplate`, a `ScheduledTraceIdAspect` opening a fresh Brave span per `@Scheduled` fire, the `ContextPropagatingTaskDecorator` wiring (plus a manually-registered `Slf4jThreadLocalAccessor`) on `AsyncConfig.taskExecutor`, and `RECTRACE_CORRELATION_ID` env-var injection on `ScriptExecutor`. Ten Wave-0 tests un-disabled; 28 tests, 0 failures across Plan 03's contract surface; full backend suite 82 tests / 4 skipped (all 4 belong to Plan 02 — Logback / Actuator exposure).

## What Landed

### Task 1: Four HealthIndicators + dedicated health-check JdbcTemplate

| Bean | JSON-path key | Detail keys (UP) | Detail keys (DOWN) |
| --- | --- | --- | --- |
| `OracleHealthIndicator` | `$.components.oracle.status` | `query` | `error` or `reason` |
| `ElasticsearchHealthIndicator` | `$.components.elasticsearch.status` | (none) | `error` or `reason` |
| `LoaderRunAgeHealthIndicator` | `$.components.loaderRunAge.status` (under `/loader` group) | `<jobKey>.{lastSuccess,ageMs,status}` or `jobs` | per-job DOWN block(s) |
| `SearchConfigHealthIndicator` | `$.components.searchConfig.status` | `v4Loaded`, `sqlLoaded` (both true) | `v4Loaded`, `sqlLoaded` (one false) |

`HealthIndicatorDataSourceConfig` (new) declares a dedicated `healthCheckJdbcTemplate` bean with `queryTimeout=2s` — the primary shared JdbcTemplate is untouched (Pitfall P-7).

### Task 2: SlowQueryLoggerAspect + @SlowLog + Prometheus

- `SlowLog` annotation (METHOD + TYPE targets, RUNTIME retention).
- `SlowQueryLoggerAspect` (@Profile('!test')) with two `@Around` advices:
  - Pointcut 1: `execution(* org.springframework.jdbc.core.JdbcTemplate.query*(..))` ∥ `update*` ∥ `execute*` ∥ `batchUpdate*` — tag `jdbc`.
  - Pointcut 2: `@annotation(SlowLog) ∥ @within(SlowLog)` — tag `slowlog`.
- Bind-arg preview truncated to 200 chars (Threat T-07-15).
- Prometheus endpoint test asserts `text/plain;version=0.0.4` + `http_server_requests_seconds_count` + `jvm_memory_used_bytes`. `@AutoConfigureObservability` added to override Spring Boot Test's default observability-off behavior.

### Task 3: Three thread-boundary holes closed

- `AsyncConfig.taskExecutor.setTaskDecorator(new ContextPropagatingTaskDecorator())` — Spring Boot 3.2+ built-in (NOT hand-rolled per D-7.6). Plus `@PostConstruct registerSlf4jMdcAccessor()` to register `Slf4jThreadLocalAccessor` on the global `ContextRegistry` — without this, the snapshot factory does not capture MDC.
- `ScheduledTraceIdAspect` — `@Around("@annotation(...Scheduled)")` opens `tracer.nextSpan().start()`, scopes with `tracer.withSpan(span)`, closes in `finally`. Active span's traceId is populated into MDC via Brave's scope decorator.
- `ScriptExecutor.executeScript` — conditional `pb.environment().put("RECTRACE_CORRELATION_ID", traceId)` when MDC.traceId is present and non-empty. Test rewritten to use real ScriptExecutor against a temp shell script.

## Verification Results

| Check | Result |
| --- | --- |
| `mvn test -Dtest=Actuator*HealthIntegrationTest,OracleHealth*,ElasticsearchHealth*,LoaderRunAgeHealth*,SearchConfigHealth*` | 18 tests, 0 failures |
| `mvn test -Dtest=SlowQueryLoggerAspectTest,PrometheusEndpointTest` | 4 tests, 0 failures |
| `mvn test -Dtest=AsyncMdcPropagationTest,ScheduledTraceIdAspectTest,ScriptExecutorEnvVarTest` | 6 tests, 0 failures |
| Full backend `mvn test` | 82 tests, 0 failures, 4 skipped (Plan 02 scope) |
| `grep "ContextPropagatingTaskDecorator" AsyncConfig.java` | found |
| `grep "RECTRACE_CORRELATION_ID" ScriptExecutor.java` | found |
| `grep "tracer.nextSpan" ScheduledTraceIdAspect.java` | found |
| `grep "AbstractHealthIndicator" observability/health/*.java` | 4 files (all four indicators) |
| `grep -E "^[^*/]*JdbcOperations" SlowQueryLoggerAspect.java` | empty (code does not reference the interface) |
| `grep "@Profile(\"!test\")" SlowQueryLoggerAspect.java` | found (Pitfall P-9) |

### Health endpoint shape (per integration test, MockMvc against test profile)

```json
GET /actuator/health
{
  "status": "DOWN",                    // test profile: no DS / no ES client → indicators DOWN by design
  "components": {
    "oracle":        { "status": "DOWN", "details": { "reason": "healthCheckJdbcTemplate not configured" } },
    "elasticsearch": { "status": "DOWN", "details": { "reason": "ElasticsearchClient not configured" } },
    "searchConfig":  { "status": "UP",   "details": { "v4Loaded": true, "sqlLoaded": true } },
    "diskSpace":     { "status": "UP" },
    "livenessState": { "status": "UP" },
    "ping":          { "status": "UP" },
    "readinessState":{ "status": "UP" },
    "ssl":           { "status": "UP" }
  }
}
```

`loaderRunAge` is correctly OMITTED from the default group; it lives at `/actuator/health/loader`:

```json
GET /actuator/health/loader
{
  "status": "UP",                       // test profile: no LoaderConfigService → "none configured"
  "components": {
    "loaderRunAge": { "status": "UP", "details": { "jobs": "none configured" } }
  }
}
```

### Prometheus body sample (per test capture)

```
# HELP jvm_memory_used_bytes The amount of used memory
# TYPE jvm_memory_used_bytes gauge
jvm_memory_used_bytes{area="heap",id="...",} 1.2345E7
...
# HELP http_server_requests_seconds Duration of HTTP server request handling
# TYPE http_server_requests_seconds histogram
http_server_requests_seconds_count{...,uri="/actuator/health",} 1.0
http_server_requests_seconds_sum{...,uri="/actuator/health",} 0.012
```

Content-Type: `text/plain;version=0.0.4;charset=utf-8`.

### AsyncMdcPropagationTest evidence

Test: set MDC.traceId="abc123def4567890abc123def4567890" → invoke `@Async("taskExecutor")` method that returns `MDC.get("traceId")` from worker thread → received string equals the input. PASS.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Spring Security default filter chain blocks MockMvc /actuator requests**

- **Found during:** Task 1 — ActuatorHealthIntegrationTest setup
- **Issue:** Production `SecurityConfig` is `@Profile("!test")`, so the test profile falls back to Spring Boot's default user-detail authentication, which blocks anonymous MockMvc requests to /actuator/health (and `show-details=when-authorized` would only return `{status:UP}` without `$.components`).
- **Fix:** Added `SecurityAutoConfiguration`, `UserDetailsServiceAutoConfiguration`, `ManagementWebSecurityAutoConfiguration` to the `spring.autoconfigure.exclude` list in `application-test.properties`; added `management.endpoint.health.show-details=always` + `show-components=always` in test profile.
- **Files modified:** `src/test/resources/application-test.properties`
- **Commit:** `7d7b978`

**2. [Rule 3 — Blocking] Test profile DOWN status returns HTTP 503**

- **Found during:** Task 1
- **Issue:** Oracle / ES indicators in test profile return DOWN (no datasource / no client), so the aggregate `/actuator/health` returns HTTP 503 by default. MockMvc `andExpect(status().isOk())` then fails.
- **Fix:** Added `management.endpoint.health.status.http-mapping.down=200` (and `out-of-service=200`) in test profile only. Production keeps default 503 mapping for k8s readiness probes.
- **Files modified:** `src/test/resources/application-test.properties`
- **Commit:** `7d7b978`

**3. [Rule 3 — Blocking] LoaderRunHistoryService has no `getLastSuccess(jobKey)` method**

- **Found during:** Task 1 design
- **Issue:** Plan-01 scaffold's `FakeHistoryApi.lastSuccessByJob()` assumed an API that doesn't exist on the real `LoaderRunHistoryService`. The real surface is `lastN(jobKey, n): List<LoaderRunRecordV4>` (with a `status` field).
- **Fix:** Per plan's explicit guidance ("adapt indicator to whatever signature exists; do NOT add adapter methods to the service"), the production indicator iterates `lastN(jobKey, 20)` and picks the most-recent `LoaderRunStatus.SUCCESS` row. Test rewritten with Mockito mocks of the real services (deleted scaffold's `FakeRegistry`/`FakeHistory` inner classes).
- **Files modified:** `LoaderRunAgeHealthIndicator.java`, `LoaderRunAgeHealthIndicatorTest.java`
- **Commit:** `7d7b978`

**4. [Rule 3 — Blocking] Spring Boot Test disables observability by default**

- **Found during:** Task 2 — PrometheusEndpointTest
- **Issue:** `DisableObservabilityContextCustomizer` sets `management.defaults.metrics.export.enabled=false` automatically in `@SpringBootTest`, which prevents `PrometheusMetricsExportAutoConfiguration` from wiring the `PrometheusScrapeEndpoint`. /actuator/prometheus returns 404.
- **Fix:** Added `@AutoConfigureObservability` to PrometheusEndpointTest. Also added `management.endpoints.web.exposure.include` to `application-test.properties` (the test profile was inheriting nothing from `application.properties`, so the include list was empty).
- **Files modified:** `PrometheusEndpointTest.java`, `application-test.properties`
- **Commit:** `3143b64`

**5. [Rule 3 — Blocking] PrometheusEndpointTest scaffold asserted on `hikaricp_connections_active`**

- **Found during:** Task 2
- **Issue:** Hikari metrics require a live HikariCP DataSource, which the test profile excludes via autoconfigure exclude list.
- **Fix:** Dropped the Hikari assertion per plan's verification (verify spec only requires `http_server_requests_seconds_count` + `jvm_memory_used_bytes`). Hikari metric presence verified in production smoke (Plan 05).
- **Files modified:** `PrometheusEndpointTest.java`
- **Commit:** `3143b64`

**6. [Rule 2 — Missing functionality] `Slf4jThreadLocalAccessor` not auto-registered**

- **Found during:** Task 3 — AsyncMdcPropagationTest first run
- **Issue:** `ContextPropagatingTaskDecorator` uses `ContextSnapshotFactory.getInstance().captureAll()` to capture thread-local context. SLF4J MDC requires `io.micrometer.context.integration.Slf4jThreadLocalAccessor` to be registered on the global `ContextRegistry`, but `context-propagation-1.1.4` does NOT auto-register it via SPI. Without registration, the snapshot captures only `ObservationThreadLocalAccessor` (from `micrometer-tracing`) and the MDC map is silently dropped on worker threads.
- **Fix:** Added `@PostConstruct registerSlf4jMdcAccessor()` to `AsyncConfig` that calls `ContextRegistry.getInstance().registerThreadLocalAccessor(new Slf4jThreadLocalAccessor())`. `ContextRegistry` dedupes by key so multiple registrations are idempotent.
- **Files modified:** `AsyncConfig.java`
- **Commit:** `cb484fa`

**7. [Rule 3 — Test design issue] ScriptExecutorEnvVarTest scaffold tested its own subclass**

- **Found during:** Task 3
- **Issue:** Plan-01 scaffold used `CapturingScriptExecutor extends ScriptExecutor` that overrode `executeScript` and duplicated the env-var logic in the subclass — the test was verifying the subclass's correctness, not the real `ScriptExecutor`. The real class was never exercised.
- **Fix:** Rewrote test to invoke the REAL `ScriptExecutor` against a temporary shell script (`Files.writeString`+`PosixFilePermissions`) that echoes `$RECTRACE_CORRELATION_ID` or `__ABSENT__`. The returned first-line-of-stdout from `ScriptExecutor.executeScript()` IS the assertion surface. Added a third test (`emptyMdcTraceIdTreatedAsAbsent`) to lock down the contract that empty-string MDC.traceId is also treated as absent.
- **Files modified:** `ScriptExecutorEnvVarTest.java`
- **Commit:** `cb484fa`

### Forward-declared inner-class stubs deleted

Plan-01's `OracleHealthIndicator`, `ElasticsearchHealthIndicator`, `LoaderRunAgeHealthIndicator`, `SearchConfigHealthIndicator` inner-stub classes were deleted from their respective test files; tests now import the real main-source classes. Same for `CapturingScriptExecutor` (deleted; replaced with real-subprocess test pattern).

## Authentication Gates

None — all work was local Maven, file creation, and AOP/HealthIndicator wiring.

## Process Incident: cwd-drift During Initial Task 1 Writes

A `cd ..` earlier in the session left a prior Bash invocation rooted at the main repo (`/Users/aarun/Workspace/Projects/autosys-job-explorer/`), not the worktree (`/Users/aarun/Workspace/Projects/autosys-job-explorer/.claude/worktrees/agent-aaeaf023fc9d639e1/`). Subsequent `Edit`/`Write` calls with absolute paths like `/Users/aarun/Workspace/Projects/autosys-job-explorer/backend/rectrace/...` resolved to the MAIN REPO, not the worktree (absolute-path safety issue #3099).

**Resolution path taken:**
1. Detected via `git status --short` showing main repo had modifications while worktree was clean.
2. Copied all stray files from main repo to worktree using `cp` (no `git mv`).
3. Ran `git restore` on main repo modified files and `rm -rf` on stray new directories.
4. Re-verified worktree state, ran tests in worktree (`mvn -f .claude/worktrees/.../pom.xml`), confirmed `82/0/4` test results.
5. Switched all subsequent Edit/Write calls to use the worktree-relative path prefix `/Users/aarun/Workspace/Projects/autosys-job-explorer/.claude/worktrees/agent-aaeaf023fc9d639e1/...`.

No work lost. Protected branch (`milestone/modernization`) was never force-rewound. Per #2924 absolute prohibition.

## Known Stubs

The implementation uses `@Autowired(required=false)` + null-tolerant code paths on all four indicators so they boot cleanly in the test profile where their backing services / clients are excluded. In test context the indicators return DOWN-with-reason or UP-with-jobs-none-configured — these are NOT "leaked stubs"; they are intentional safe-default behaviors documented in each class's Javadoc, and the test contract explicitly asserts on them.

No UI / data-rendering stubs exist (this plan touches only backend code and test resources).

## Threat Flags

None — this plan's surface (HealthIndicators + AOP + ProcessBuilder env-var) is fully covered by the threat register entries T-07-12 / T-07-13 / T-07-14 / T-07-15 / T-07-16 / T-07-17 / T-07-18 / T-07-19 in `07-03-PLAN.md`. No new network endpoints, no new auth paths, no new file-access patterns beyond `Files.writeString` for the temp test shell script.

## TDD Gate Compliance

Plan 03 follows the test-first pattern at the plan level (Plan 01 landed the @Disabled scaffold tests; this plan implements + enables them). Per-task commits are `feat(...)` because the test-first commits already exist as Plan 01's `test(07-01): ...` commits. RED→GREEN sequence verifiable in git log: `99d1826 test(07-01): ...` → this plan's three `feat(07-03): ...` commits.

## Self-Check: PASSED

- All 8 main-source files exist at documented paths (verified via `find`).
- All 3 task commits present on `worktree-agent-aaeaf023fc9d639e1`: `7d7b978`, `3143b64`, `cb484fa`.
- 28 Plan-03 tests across 10 test classes pass with 0 failures.
- Full backend `mvn test`: 82 tests, 0 failures, 4 skipped (Plan 02 scope).
- All required `grep` contracts pass:
  - `AbstractHealthIndicator` × 4 (matches 4 indicator files).
  - `ContextPropagatingTaskDecorator` in `AsyncConfig.java`.
  - `RECTRACE_CORRELATION_ID` in `ScriptExecutor.java`.
  - `tracer.nextSpan` in `ScheduledTraceIdAspect.java`.
  - `@Profile("!test")` in `SlowQueryLoggerAspect.java`.
  - No code-level `JdbcOperations` references in `SlowQueryLoggerAspect.java`.
