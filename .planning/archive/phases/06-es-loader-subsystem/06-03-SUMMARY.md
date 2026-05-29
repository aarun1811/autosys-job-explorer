---
phase: 06-es-loader-subsystem
plan: 03
subsystem: loader
tags: [loader-config, dto, document-id-hasher, run-history, oracle-jdbc, sha-256]

requires:
  - phase: 06-es-loader-subsystem
    plan: 01
    provides: loader_run_history DDL + rectrace_core_alias ES alias bootstrap
  - phase: 06-es-loader-subsystem
    plan: 02
    provides: ShedLock 7.7.0 on classpath + Wave-0 @Disabled test scaffolds
provides:
  - "LoaderConfigV4 / LoaderJobDefV4 / LoaderSourceConfigV4 / LoaderTargetConfigV4 / LoaderBatchConfigV4 / LoaderRunRecordV4 / LoaderRunStatus — typed mirror of loader-config-v4.json schema"
  - "loader-config-v4.json with rectrace_core_loader example (D-6.15)"
  - "DocumentIdHasher — SHA-256 over JSON-encoded PK array → 16-hex-char deterministic ES _id (LOADER-04, Pitfall L5)"
  - "LoaderConfigService — @PostConstruct config load + 3-pass validation (structural, duplicate-key, ES alias existence) (LOADER-01, LOADER-03)"
  - "LoaderRunHistoryService — recordRunStart/Success/Failure + pruneToLast20 + lastN against loader_run_history (LOADER-06, LOADER-07)"
  - "LoaderJdbcConfig — loaderJdbcTemplate bean wrapping primary RECTRACE DataSource (D-6.16)"
affects: [06-04, 06-05]

tech-stack:
  added: []
  patterns:
    - "@PostConstruct config-load pattern mirroring SearchConfigServiceV4 / SqlSearchConfigServiceV4"
    - "collect-then-throw structural validation (Phase 5 SqlSearchConfigServiceV4 idiom) — aggregate all per-job errors before failing"
    - "ReflectionTestUtils + Mockito for fast unit tests without Spring context boot (Pitfall L4)"
    - "Mockito ArgumentCaptor against JdbcTemplate.update varargs — asserts exact SQL shape + binding without a live DB"
    - "JSON-encoded PK array → SHA-256 (HexFormat first 8 bytes) for separator-safe deterministic ID generation"
    - "Oracle ROW_NUMBER() analytic DELETE for per-job last-20 retention (LOADER-07)"

key-files:
  created:
    - "backend/rectrace/src/main/resources/loader-config-v4.json (22 lines)"
    - "backend/rectrace/src/main/java/com/citi/gru/rectrace/loader/dto/LoaderConfigV4.java (24)"
    - "backend/rectrace/src/main/java/com/citi/gru/rectrace/loader/dto/LoaderJobDefV4.java (28)"
    - "backend/rectrace/src/main/java/com/citi/gru/rectrace/loader/dto/LoaderSourceConfigV4.java (27)"
    - "backend/rectrace/src/main/java/com/citi/gru/rectrace/loader/dto/LoaderTargetConfigV4.java (21)"
    - "backend/rectrace/src/main/java/com/citi/gru/rectrace/loader/dto/LoaderBatchConfigV4.java (22)"
    - "backend/rectrace/src/main/java/com/citi/gru/rectrace/loader/dto/LoaderRunRecordV4.java (28)"
    - "backend/rectrace/src/main/java/com/citi/gru/rectrace/loader/dto/LoaderRunStatus.java (15)"
    - "backend/rectrace/src/main/java/com/citi/gru/rectrace/loader/DocumentIdHasher.java (98)"
    - "backend/rectrace/src/main/java/com/citi/gru/rectrace/loader/LoaderConfigService.java (168)"
    - "backend/rectrace/src/main/java/com/citi/gru/rectrace/loader/LoaderRunHistoryService.java (183)"
    - "backend/rectrace/src/main/java/com/citi/gru/rectrace/config/LoaderJdbcConfig.java (31)"
    - "backend/rectrace/src/test/resources/loader-config-good.json"
    - "backend/rectrace/src/test/resources/loader-config-duplicate-keys.json"
    - "backend/rectrace/src/test/resources/loader-config-blank-schedule.json"
    - "backend/rectrace/src/test/resources/loader-config-missing-alias.json"
  modified:
    - "backend/rectrace/src/main/resources/application.properties (added loader-config.location)"
    - "backend/rectrace/src/main/resources/application-local.properties (added loader-config.location)"
    - "backend/rectrace/src/test/java/com/citi/gru/rectrace/loader/DocumentIdHasherTest.java (enabled 4/4)"
    - "backend/rectrace/src/test/java/com/citi/gru/rectrace/loader/LoaderConfigServiceTest.java (enabled 4/4)"
    - "backend/rectrace/src/test/java/com/citi/gru/rectrace/loader/LoaderRunHistoryServiceTest.java (enabled 5/5)"
    - "backend/rectrace/src/test/java/com/citi/gru/rectrace/loader/LoaderPackageStructureTest.java (enabled 3/6; Plan-04 deliverables kept @Disabled)"

key-decisions:
  - "DocumentIdHasher uses HexFormat.of().formatHex(digest, 0, 8) instead of String.format(\"%016x\", ...) — same 16-hex-char result, fewer LOC, JDK 17+ native API."
  - "LoaderConfigService aggregates per-job structural errors before throwing (Phase 5 pattern) but throws immediately on duplicate-key and on alias-not-found — those are unrecoverable single-cause failures, not aggregable validation problems."
  - "esClient == null branch logs WARN and SKIPS the alias check rather than failing — allows boot in environments where ES is intentionally unavailable (e.g. JVM-only tests). Production deploys without spring.elasticsearch.uris will see the warning at boot."
  - "@Profile(\"!test\") on both services + LoaderJdbcConfig keeps ContextLoadsTest green; Plan 03 tests use direct instantiation + ReflectionTestUtils rather than @SpringBootTest, gaining sub-100ms test latency."
  - "LoaderRunHistoryServiceTest uses mocked JdbcTemplate not Testcontainers — fast, focused on the SERVICE's contract (exact SQL shape + binding). Live-Oracle smoke is owned by Plan 05's smoke scripts."
  - "LoaderPackageStructureTest enabled only the 3 classes Plan 03 ships; the 3 Plan-04 classes (LoaderJobRegistry, OracleToEsLoaderJob, LoaderTicker) keep individual method-level @Disabled — so Plan 04 just removes those three annotations without touching anything else."

requirements-completed: [LOADER-01, LOADER-03, LOADER-04, LOADER-05, LOADER-06, LOADER-07]

duration: ~22min
completed: 2026-05-17
---

# Phase 6 Plan 03: Loader DTOs + Config Service + Run History Service Summary

**Built the data-layer foundation of the ES loader subsystem: 7 DTOs mirror loader-config-v4.json, DocumentIdHasher produces separator-safe deterministic 16-hex IDs via SHA-256 over JSON-encoded PK arrays, LoaderConfigService loads + validates the JSON at boot (including ES alias existence per LOADER-03), and LoaderRunHistoryService persists/prunes per-job run history. Plan 04 can now build the scheduler layer on top.**

## Performance

- **Tasks:** 2 (both `type="auto"`)
- **Files created:** 16 (12 main sources + 4 test fixtures)
- **Files modified:** 6 (2 application.properties + 4 test files)
- **Commits:** 2 atomic feat commits + this docs commit
- **mvn test:** 49 run, 0 failures, 12 skipped (Plan 04/05 deliverables)

## Accomplishments

### Task 1 — DTOs + JSON + DocumentIdHasher (commit `2241ffa`)

- Seven DTO classes under `loader/dto/` follow the Phase 5 V4 convention (`@Data @NoArgsConstructor @JsonInclude(NON_NULL)`).
- `loader-config-v4.json` declares the example `rectrace_core_loader` job per D-6.15: 22-column SELECT against `rectrace.rectrace_core`, `primaryKey: ["job_name"]`, `target.alias: "rectrace_core_alias"` (bootstrapped in Plan 06-01), 5 000-row / 5-MiB / 5-s batch defaults, `0 */5 * * * *` schedule, UTC.
- `loader-config.location=classpath:loader-config-v4.json` added to both `application.properties` and `application-local.properties`.
- `DocumentIdHasher.hash(primaryKeyColumns, row)` builds the PK value list in declaration order, JSON-encodes via Jackson (Pitfall L5 fix — distinguishes `["A","B|C"]` from `["A|B","C"]`), SHA-256s the bytes, returns `HexFormat.of().formatHex(digest, 0, 8)` — 16 lowercase hex chars.
- `DocumentIdHasherTest` enabled — 4/4 pass, including the explicit Pitfall L5 separator-collision pin.

### Task 2 — Services + Config + Test Enablement (commit `b317953`)

- `LoaderJdbcConfig` exposes `loaderJdbcTemplate` (D-6.16 — primary DS, not readonly). `@Profile("!test")` aligned with `DataSourceConfig`.
- `LoaderConfigService.load()` performs three sequential passes: (1) structural per-job validation with collect-then-throw aggregation (blank key/query/primaryKey/alias/schedule + cron-parse via `CronExpression.parse`), (2) duplicate-key detection (linked-hash-map build), (3) ES alias existence via `esClient.indices().existsAlias(b -> b.name(alias))` — if `esClient == null` (test profile or no ES configured), logs a WARN and skips the check.
- `LoaderRunHistoryService` ships four mutation methods (`recordRunStart`, `recordRunSuccess`, `recordRunFailure`, `pruneToLast20`) + one read method (`lastN`). Success/failure flows automatically prune. Failure path truncates `last_error` to 8 192 chars (Pitfall L8 / Research A8). Prune is the Oracle 19c+ `ROW_NUMBER() OVER (PARTITION BY job_key ORDER BY started_at DESC)` analytic DELETE with `rn <= 20`, bound to a single `job_key` (LOADER-07 race-safety with concurrent prunes on different jobs).
- Four test resource fixtures pin each LoaderConfigService failure mode.
- `LoaderConfigServiceTest` enabled — 4/4 pass; uses direct instantiation + `ReflectionTestUtils` + Mockito (`BooleanResponse(false)` for the missing-alias case), no Spring context boot. Sub-100ms per test.
- `LoaderRunHistoryServiceTest` enabled — 5/5 pass; mocked `JdbcTemplate` with `ArgumentCaptor` asserts SQL contains `INSERT INTO loader_run_history` / `UPDATE ... 'SUCCESS'` / `UPDATE ... 'FAILED' ... last_error` / `ROW_NUMBER()` / `rn <= 20`; 80 000-char error string truncated to exactly 8 192; prune SQL has `job_key = ?` appearing twice (outer + inner) and no `OR` operator.
- `LoaderPackageStructureTest` — 3 of 6 enabled (the Plan-03 deliverables: `LoaderConfigService`, `LoaderRunHistoryService`, `DocumentIdHasher`). The 3 Plan-04 deliverables stay `@Disabled` at method level so Plan 04 only needs to remove three annotations.

## Test Status

| Test | Methods Enabled | Status | Notes |
|------|-----------------|--------|-------|
| `DocumentIdHasherTest`        | 4/4 | PASS | Pure JUnit, no Spring |
| `LoaderConfigServiceTest`     | 4/4 | PASS | Direct instantiation + ReflectionTestUtils + Mockito |
| `LoaderRunHistoryServiceTest` | 5/5 | PASS | Mocked JdbcTemplate + ArgumentCaptor on SQL shape |
| `LoaderPackageStructureTest`  | 3/6 | PASS | 3 remain `@Disabled` (Plan 04 deliverables) |
| `LoaderJobLockTest`           | 0/2 | SKIP | All `@Disabled` (Plan 04) |
| `BulkIngesterFactoryTest`     | 0/2 | SKIP | All `@Disabled` (Plan 04) |
| `LoaderAdminControllerV4Test` | 0/5 | SKIP | All `@Disabled` (Plan 05) |

`mvn test`: **49 run, 0 failures, 12 skipped, BUILD SUCCESS**.

## Resolved Interfaces (for Plan 04 to consume)

### DTOs
```java
LoaderConfigV4               { List<LoaderJobDefV4> jobs }
LoaderJobDefV4               { String key; LoaderSourceConfigV4 source; LoaderTargetConfigV4 target;
                               String schedule; String timezone = "UTC" }
LoaderSourceConfigV4         { String datasource = "primary"; String query; List<String> primaryKey }
LoaderTargetConfigV4         { String alias; LoaderBatchConfigV4 batch }
LoaderBatchConfigV4          { int rows = 5000; long bytes = 5 MiB; long flushMs = 5000 }
LoaderRunRecordV4            { String jobKey; Instant startedAt; Instant finishedAt;
                               LoaderRunStatus status; Long rowCount; String lastError; Long durationMs }
LoaderRunStatus              { RUNNING, SUCCESS, FAILED }
```

### Services
```java
@Component
class DocumentIdHasher {
    DocumentIdHasher(ObjectMapper);                                // constructor-injected
    String hash(List<String> primaryKeyColumns, Map<String,Object> row);   // 16-hex-char ID
}

@Profile("!test") @Service
class LoaderConfigService {
    @PostConstruct void load();                                    // boot-time validation
    LoaderConfigV4 getConfiguration();
    List<LoaderJobDefV4> getJobs();
    Optional<LoaderJobDefV4> getJob(String key);
}

@Profile("!test") @Service
class LoaderRunHistoryService {
    LoaderRunHistoryService(@Qualifier("loaderJdbcTemplate") JdbcTemplate);
    Instant recordRunStart(String jobKey);
    void    recordRunSuccess(String jobKey, Instant startedAt, long rowCount, long durationMs);
    void    recordRunFailure(String jobKey, Instant startedAt, long durationMs, String errorMessage);
    void    pruneToLast20(String jobKey);
    List<LoaderRunRecordV4> lastN(String jobKey, int n);
}
```

### Bean
```java
@Profile("!test") @Configuration
class LoaderJdbcConfig {
    @Bean(name = "loaderJdbcTemplate")
    JdbcTemplate loaderJdbcTemplate(@Qualifier("dataSource") DataSource);
}
```

## Deviations from Plan

None. All Task 1 + Task 2 sub-actions executed verbatim. The one test fix (`recordRunSuccessUpdatesRowToSuccess` — removed redundant `verify(jdbc, atLeastOnce()).update(sql.capture(), any())` that incorrectly tried to match 5-arg invocations as 2-arg) was a test-harness refinement, not a behavioral deviation; the second verify with full `eq()` matchers is the authoritative assertion.

## Threat Flags

None. No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries beyond those declared in the plan's `<threat_model>` (T-06-08 through T-06-11) — all mitigations are in place:

- **T-06-09 mitigation (separator collision):** `DocumentIdHasherTest#separatorInPkValueDoesNotCollide` passes — JSON encoding of `["A","B|C"]` vs `["A|B","C"]` produces distinct SHA-256 digests.
- **T-06-10 mitigation (last_error CLOB):** `LoaderRunHistoryService.recordRunFailure` truncates to 8 192 chars, asserted by `LoaderRunHistoryServiceTest#recordRunFailureCapturesTruncatedError`.
- **T-06-11 mitigation (silent ES-unavailable boot):** `LoaderConfigService.load()` logs a WARN when `esClient == null` rather than silently passing — documented in code Javadoc as a development concession.

T-06-08 (DML in `source.query`) remains an accepted risk per plan.

## Self-Check: PASSED

- [x] `backend/rectrace/src/main/resources/loader-config-v4.json` exists
- [x] 7 DTO files exist under `loader/dto/`
- [x] `DocumentIdHasher.java`, `LoaderConfigService.java`, `LoaderRunHistoryService.java`, `LoaderJdbcConfig.java` exist
- [x] Commit `2241ffa` exists (feat 06-03 DTOs + hasher)
- [x] Commit `b317953` exists (feat 06-03 services + config)
- [x] `mvn test` BUILD SUCCESS (49 run / 0 failures / 12 skipped)
- [x] Verification greps: `@PostConstruct` ≥ 1 (=2), `existsAlias` ≥ 1 (=2), `SHA-256` = 1, `ROW_NUMBER` ≥ 1 (=2)
