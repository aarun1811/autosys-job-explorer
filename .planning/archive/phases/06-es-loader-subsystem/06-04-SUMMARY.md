---
phase: 06-es-loader-subsystem
plan: 04
subsystem: infra
tags: [shedlock, scheduler, bulk-ingester, jdbc-streaming, graceful-shutdown, elasticsearch-java, cron]

# Dependency graph
requires:
  - phase: 06-es-loader-subsystem
    provides: "LoaderConfigService.getJobs(), LoaderRunHistoryService.recordRunStart/Success/Failure, DocumentIdHasher.hash, loaderJdbcTemplate bean (Plan 06-03)"
  - phase: 06-es-loader-subsystem
    provides: "shedlock + shedlock-provider-jdbc-template:7.7.0 deps, shedlock + loader_run_history table DDL (Plan 06-01/02)"
provides:
  - "LoaderShedLockConfig: @EnableScheduling + @EnableSchedulerLock + LockProvider (JdbcTemplateLockProvider.usingDbTime) + LockingTaskExecutor beans"
  - "LoaderBulkListener: BulkListener<String> with jobKey+docId context + AtomicLong failed-item counter"
  - "LoaderJobRegistry: per-job BulkIngester + CronExpression + LoaderBulkListener maps; @PostConstruct init, @PreDestroy flush"
  - "OracleToEsLoaderJob: streamed JdbcTemplate.query(RowCallbackHandler) with setFetchSize(1000); alias-only writes; broad-catch records FAILED"
  - "LoaderTicker: single @Scheduled(fixedDelayString=PT30S) ticker, fans out via LockingTaskExecutor.executeWithLock; public runNow(LoaderJobDefV4) returns TaskResult<Void> for admin controller"
  - "shedlock-provider-inmemory:7.7.0 test dependency (LoaderJobLockTest uses InMemoryLockProvider — keeps tests Oracle-free)"
affects: [06-05-admin-controller, 06-06-smoke-and-docs, 07-observability]

# Tech tracking
tech-stack:
  added:
    - "shedlock-provider-inmemory:7.7.0 (test scope)"
  patterns:
    - "Single-ticker + programmatic LockingTaskExecutor.executeWithLock (06-RESEARCH.md §6 Pattern 2) — replaces @SchedulerLock annotation when lock names are runtime-computed"
    - "Per-job BulkIngester<String> with context=jobKey:docId for traceable failure logs"
    - "@Profile(\"!test\") on every scheduler/loader bean (Pitfall L4) keeps ContextLoadsTest free of Oracle/ES dependencies"
    - "Streaming JDBC via PreparedStatementCreator + setFetchSize(1000) + RowCallbackHandler (Pitfall L10) — avoids materializing multi-million-row result sets"
    - "Broad catch(Throwable) → recordRunFailure with 8 KB-truncated fingerprint (research Anti-Patterns) — silent failure prohibited"
    - "@PreDestroy flush() + close() inside try/catch over every ingester (Pitfall L3) — SIGTERM mid-batch drains in-flight ops"

key-files:
  created:
    - backend/rectrace/src/main/java/com/citi/gru/rectrace/config/LoaderShedLockConfig.java
    - backend/rectrace/src/main/java/com/citi/gru/rectrace/loader/LoaderBulkListener.java
    - backend/rectrace/src/main/java/com/citi/gru/rectrace/loader/LoaderJobRegistry.java
    - backend/rectrace/src/main/java/com/citi/gru/rectrace/loader/OracleToEsLoaderJob.java
    - backend/rectrace/src/main/java/com/citi/gru/rectrace/loader/LoaderTicker.java
  modified:
    - backend/rectrace/pom.xml
    - backend/rectrace/src/test/java/com/citi/gru/rectrace/loader/BulkIngesterFactoryTest.java
    - backend/rectrace/src/test/java/com/citi/gru/rectrace/loader/LoaderJobLockTest.java
    - backend/rectrace/src/test/java/com/citi/gru/rectrace/loader/LoaderPackageStructureTest.java

key-decisions:
  - "Used Pattern 2 (programmatic LockingTaskExecutor.executeWithLock) instead of @SchedulerLock annotation — lock name 'loader:<jobKey>' is runtime-derived from config and annotation values must be compile-time constants"
  - "Co-located @EnableScheduling on LoaderShedLockConfig (not RectraceApplication) so the scheduler only activates with the loader profile (Pitfall L4 / Research Open Q#2)"
  - "Used BulkIngester accessor methods (maxOperations / maxSize / flushInterval / maxConcurrentRequests) for test assertions — cleaner than behavioral flush-count probing (Wave-0 scaffold option (a))"
  - "Mocked ElasticsearchClient with RETURNS_DEEP_STUBS because BulkIngester.of(...) reads esClient._transport().options() at build time; deep stubs avoid NPE without booting a real transport"
  - "lockAtLeastFor=5s (D-6.2 anti-thrash) ensures sub-30s crons cannot double-fire on the tick boundary; lockAtMostFor=55m (A10) is purely the crash-safety ceiling, not an expected run duration"
  - "runNow does NOT call markFired — manual triggers must not perturb the cron schedule's next-fire calculation (clearly documented in LoaderTicker javadoc for Plan 05 to consume)"
  - "Broad catch(Throwable) in OracleToEsLoaderJob.run is intentional — records FAILED to loader_run_history rather than letting executor swallow silently (research Anti-Patterns)"

patterns-established:
  - "Pattern: BulkIngester<String> construction = .client(esClient).maxOperations(rows).maxSize(bytes).flushInterval(ms, MILLISECONDS).maxConcurrentRequests(1).listener(perJobListener)"
  - "Pattern: streaming JDBC read = JdbcTemplate.query(con->{PreparedStatement ps=con.prepareStatement(sql); ps.setFetchSize(1000); return ps;}, (RowCallbackHandler) rs->{...})"
  - "Pattern: per-row ES write = ingester.add(op->op.index(idx->idx.index(alias).id(docId).document(row)), key+':'+docId)"
  - "Pattern: ticker dispatch = lockingTaskExecutor.executeWithLock((TaskWithResult<Void>) ()->{markFired(key,now); job.run(def); return null;}, new LockConfiguration(now, 'loader:'+key, PT55M, PT5S))"

requirements-completed: [LOADER-02, LOADER-03, LOADER-05, LOADER-09, LOADER-10]

# Metrics
duration: 22min
completed: 2026-05-17
---

# Phase 6 Plan 04: Scheduler + ShedLock + BulkIngester loader engine Summary

**ShedLock-guarded 30-second ticker streams Oracle rows into ES via per-job BulkIngester with deterministic doc IDs and graceful @PreDestroy flush**

## Performance

- **Duration:** 22 min
- **Started:** 2026-05-17T18:13:00Z (approx)
- **Completed:** 2026-05-17T18:35:00Z (approx)
- **Tasks:** 2
- **Files modified:** 9 (5 new prod classes + 1 pom + 3 test files)

## Accomplishments

- Scheduler + ShedLock wired (`LoaderShedLockConfig`) with co-located `@EnableScheduling` and `defaultLockAtMostFor=PT55M`. `LockProvider` uses `JdbcTemplateLockProvider.usingDbTime()` against the primary RECTRACE datasource (D-6.12) so all lock timestamps come from Oracle — eliminates dev-laptop vs Citi VM clock skew.
- Loader job lifecycle is end-to-end functional: `LoaderJobRegistry.@PostConstruct` builds one `BulkIngester<String>` per `LoaderJobDefV4` honoring `batch.rows / batch.bytes / batch.flushMs` (defaults 5000 rows / 5 MiB / 5s per LOADER-10) with `maxConcurrentRequests=1`. `@PreDestroy` flushes+closes every ingester inside try/catch (LOADER-09 + Pitfall L3) so SIGTERM mid-batch drains rather than dropping in-flight ops.
- `OracleToEsLoaderJob.run` streams the source SELECT via `JdbcTemplate.query(PreparedStatementCreator, RowCallbackHandler)` with `setFetchSize(1000)` (Pitfall L10) — does NOT materialize the full result set. Each row gets a 16-hex-char deterministic ES `_id` via `DocumentIdHasher.hash(pkColumns, row)` and is dispatched to the configured `target.alias` (LOADER-03 — alias-only writes, never literal indices).
- `LoaderTicker.@Scheduled(fixedDelayString="PT30S")` fans out to `LockingTaskExecutor.executeWithLock(...)` per due job; lock name `"loader:<jobKey>"` plus `lockAtLeastFor=5s` (D-6.2 anti-thrash) means sub-30s cron schedules cannot double-fire. `runNow(LoaderJobDefV4)` exposes the same locked path to Plan 05's admin controller, returning `TaskResult<Void>` for HTTP 200/409 mapping.
- All five Wave-0 loader tests previously stubbed by Plan 06-02 are now enabled: `BulkIngesterFactoryTest` (2/2 — asserts default + per-job overrides via BulkIngester accessors), `LoaderJobLockTest` (2/2 — uses `InMemoryLockProvider` to verify executeWithLock mutual exclusion semantics), and the three remaining `LoaderPackageStructureTest` class-presence checks. Total: 49 tests, 5 skipped (all in `LoaderAdminControllerV4Test` — Plan 06-05 territory).

## Task Commits

Each task was committed atomically:

1. **Task 1: LoaderShedLockConfig + LoaderBulkListener + LoaderJobRegistry + 5 enabled tests** — `75e1292` (feat)
2. **Task 2: OracleToEsLoaderJob + LoaderTicker + 2 enabled class-presence tests** — `ad402e7` (feat)

**Plan metadata (this SUMMARY):** to be committed as `docs(06-04): plan summary`

## Files Created/Modified

### Created (5 production classes)

- `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/LoaderShedLockConfig.java` (87 LOC) — `@EnableScheduling` + `@EnableSchedulerLock(defaultLockAtMostFor="PT55M")` + `LockProvider` bean (Oracle via `JdbcTemplateLockProvider.usingDbTime`) + `LockingTaskExecutor` bean.
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/loader/LoaderBulkListener.java` (96 LOC) — `BulkListener<String>` impl with jobKey+docId context, `AtomicLong failedItemCount`, three event handlers.
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/loader/LoaderJobRegistry.java` (176 LOC, min 60) — per-job `BulkIngester<String>` + `CronExpression` + `LoaderBulkListener` + `lastFireTimes` maps; `dueAt(Instant)`, `markFired(key, when)`, `@PreDestroy shutdown()`.
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/loader/OracleToEsLoaderJob.java` (167 LOC, min 70) — `run(LoaderJobDefV4)`: streamed query via RowCallbackHandler + `setFetchSize(1000)`, alias-only writes, broad-catch records FAILED with truncated fingerprint.
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/loader/LoaderTicker.java` (138 LOC, min 40) — `@Scheduled(fixedDelayString="PT30S") tick()` fans out via `LockingTaskExecutor.executeWithLock`; public `runNow(LoaderJobDefV4) → TaskResult<Void>`.

### Modified

- `backend/rectrace/pom.xml` — added `shedlock-provider-inmemory:7.7.0` (test scope) for `LoaderJobLockTest`.
- `backend/rectrace/src/test/java/com/citi/gru/rectrace/loader/BulkIngesterFactoryTest.java` — enabled; 2 methods use BulkIngester accessors with `Mockito.RETURNS_DEEP_STUBS` for the ES client.
- `backend/rectrace/src/test/java/com/citi/gru/rectrace/loader/LoaderJobLockTest.java` — enabled; 2 methods exercise `LockingTaskExecutor.executeWithLock` against `InMemoryLockProvider`.
- `backend/rectrace/src/test/java/com/citi/gru/rectrace/loader/LoaderPackageStructureTest.java` — removed `@Disabled` from `loaderJobRegistryExists`, `oracleToEsLoaderJobExists`, `loaderTickerExists`; removed unused `Disabled` import.

## Interface Signatures (for Plan 05 admin controller consumption)

### `LoaderJobRegistry` (selected public API)

```java
public List<LoaderJobDefV4> dueAt(Instant now);            // pure read; never mutates state
public BulkIngester<String> ingesterFor(String jobKey);    // null if unknown
public LoaderBulkListener  listenerFor(String jobKey);     // null if unknown
public void markFired(String jobKey, Instant when);        // call ONLY inside the locked task
public int size();                                          // test seam
```

### `OracleToEsLoaderJob`

```java
public void run(LoaderJobDefV4 def);    // never throws — failures land in loader_run_history
```

Caller responsibility: hold the per-job ShedLock (acquired via `LoaderTicker.tick()` or `LoaderTicker.runNow()`) for the duration of the call. `run` itself does not acquire any locks.

### `LoaderTicker` — primary surface for Plan 05

```java
@Scheduled(fixedDelayString = "PT30S")
public void tick();                            // not called by Plan 05

public TaskResult<Void> runNow(LoaderJobDefV4 def);
// HTTP mapping for the admin controller:
//   result.wasExecuted() == true  → 200 OK ("started")
//   result.wasExecuted() == false → 409 CONFLICT ("already running")
//   IllegalStateException        → 500 INTERNAL_SERVER_ERROR (executor itself failed)
```

`runNow` deliberately does NOT call `LoaderJobRegistry.markFired` — a manual trigger should not perturb the next scheduled fire calculation. Plan 05 should look up the `LoaderJobDefV4` via `LoaderConfigService.getJob(key).orElseThrow(...)` (returns 404 for unknown keys before reaching `runNow`).

## Decisions Made

See `key-decisions` in frontmatter. Notable highlights:

1. **Pattern 2 (programmatic locking) over `@SchedulerLock` annotation.** The lock name `loader:<jobKey>` is computed at runtime from config; Java annotation values must be compile-time constants. Pattern 2 is explicitly documented in 06-RESEARCH.md §6 as the standard escape hatch.

2. **`@EnableScheduling` co-located on `LoaderShedLockConfig`, not on `RectraceApplication`.** Together with `@Profile("!test")` this keeps the scheduler dormant during tests — `ContextLoadsTest` (Plan 02) does not need an `Elasticsearch` client or `shedlock` table.

3. **`RETURNS_DEEP_STUBS` for the mocked `ElasticsearchClient` in `BulkIngesterFactoryTest`.** `BulkIngester.of(...)` reads `esClient._transport().options()` at build time even though no operations are dispatched in the test. Deep stubs synthesize the chain without booting a real transport.

4. **`runNow` does NOT call `markFired`.** Manual triggers are independent of the cron schedule. Documented in the `LoaderTicker.runNow` javadoc so Plan 05 consumes the contract correctly.

5. **`shedlock-provider-inmemory:7.7.0` added as test-scoped dep.** Production uses `JdbcTemplateLockProvider` (Oracle); tests use the in-memory variant so they never touch a real database — matches the rest of the test suite's posture.

## Deviations from Plan

None - plan executed exactly as written.

The one minor implementation tweak (deep-stub mocking of the ES client in `BulkIngesterFactoryTest`) was anticipated by the plan's Wave-0 scaffold notes which acknowledged BulkIngester does not expose getters — except that ES Java API 8.18.8 does expose accessors (`maxOperations()`, `maxSize()`, `flushInterval()`, `maxConcurrentRequests()`), so option (a) "capturing in BulkIngesterSettings" was unnecessary and we read the values directly. This is the plan-favored choice; not a deviation.

## Issues Encountered

- First test run NPE'd inside `BulkIngester.of(...)` because it dereferences `esClient._transport().options()` at build time. Resolved by mocking the `ElasticsearchClient` with `Mockito.RETURNS_DEEP_STUBS`. No production code change required.

## User Setup Required

None - no external service configuration required. Plan 06-01 created the `loader_run_history` and `shedlock` tables; Plan 06-02/03 added the dependencies; this plan only wires beans.

## Next Phase Readiness

- **Plan 06-05 (admin controller) is unblocked.** `LoaderTicker.runNow(LoaderJobDefV4)` and `LoaderConfigService.getJob(String)` together provide all the surface needed for the `POST /api/v4/admin/loader/{key}/run` endpoint. The `TaskResult.wasExecuted()` boolean maps cleanly to 200 vs 409.
- **Plan 06-06 (smoke-and-docs) is unblocked.** All loader machinery — ShedLock, BulkIngester, run-history, alias writes, graceful shutdown — is in place. The smoke script can register a tiny loader job in `loader-config-v4.json`, boot the app, watch `loader_run_history` populate, and observe the in-flight count drain during SIGTERM.
- **Phase 7 (OBS-02) prerequisites met.** `LoaderJobRegistry` exposes `size()` and the run-history age can be derived from `LoaderRunHistoryService.lastN(jobKey, 1)`. Adding a `HealthIndicator` that surfaces "any RUNNING row older than 55 min" is a one-class change.

## Self-Check: PASSED

Files exist:
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/LoaderShedLockConfig.java`: FOUND
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/loader/LoaderBulkListener.java`: FOUND
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/loader/LoaderJobRegistry.java`: FOUND
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/loader/OracleToEsLoaderJob.java`: FOUND
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/loader/LoaderTicker.java`: FOUND

Commits exist:
- `75e1292` (Task 1: feat(06-04): add ShedLock wiring + BulkListener + JobRegistry): FOUND
- `ad402e7` (Task 2: feat(06-04): add streaming loader job + 30s dispatch ticker): FOUND

Verification checks (from `<verification>` block):
- `@Scheduled` count in LoaderTicker.java = 1 (expected 1) ✓
- `@SchedulerLock` count in loader/ = 0 (expected 0) ✓
- `@Profile("!test")` across new classes = 4 (LoaderShedLockConfig, LoaderJobRegistry, OracleToEsLoaderJob, LoaderTicker) ✓
- `executeWithLock` count in LoaderTicker.java ≥ 1 ✓ (actual: 3 — tick + runNow + javadoc reference)
- `@PreDestroy` count in LoaderJobRegistry.java = 1 ✓
- `ingester.flush()` calls in loader/ = 2 (one in registry shutdown, one in job.run) ✓
- `mvn test`: 49 tests, 0 failures, 0 errors, 5 skipped (Plan 06-05 territory) — BUILD SUCCESS ✓

---
*Phase: 06-es-loader-subsystem*
*Completed: 2026-05-17*
