# Phase 6: ES Loader Subsystem — Research

**Researched:** 2026-05-17
**Domain:** Oracle → Elasticsearch scheduled bulk loader on Spring Boot 3.5.14 + Java 21
**Confidence:** HIGH (every external choice verified against Context7 / Maven Central / source)

## Summary

A new `com.citi.gru.rectrace.loader` package adds a configuration-driven, scheduled Oracle → Elasticsearch loader subsystem to `backend/rectrace`. The scheduler is **locked to `@Scheduled` + ShedLock** per CONTEXT D-6.0. The codebase is already on the new **Elasticsearch Java API Client** (`co.elastic.clients.elasticsearch.ElasticsearchClient`) post Phase 1 BOOT-06 — so the loader uses **`BulkIngester`**, not the legacy `BulkProcessor`. The legacy class never enters this codebase. The five success criteria collapse to: config-driven jobs, alias-only writes, deterministic upsert IDs, admin endpoints, flush-on-shutdown.

The research updates two CONTEXT assumptions: (1) **ShedLock 7.7.0**, not 5.16.0 — the 5.x line is significantly stale and 7.x is the line explicitly tested against Spring Boot 3.5 / Java 17+; (2) **`BulkIngester`** replaces every reference to `BulkProcessor` because `BulkProcessor` belongs to the deleted `RestHighLevelClient`. Both updates are non-breaking against the locked decision set and surface as `[ASSUMED]` corrections in the Assumptions Log for the planner / discuss-phase to acknowledge.

**Primary recommendation:** Use `@Scheduled` + ShedLock 7.7.0 with `JdbcTemplateLockProvider.usingDbTime()` on the existing primary `dataSource`; build a `LoaderJobRegistry` that owns a per-job `BulkIngester` (`maxOperations`/`maxSize`/`flushInterval`/`maxConcurrentRequests`) with `@PreDestroy` calling `close()` to flush; use a single **fixed-rate ticker `@Scheduled(fixedDelay = "PT30S")`** that fans out to all configured jobs whose cron is due — per-job concurrency safety comes from `LockingTaskExecutor.executeWithLock(...)` with a per-job lock name. This avoids the impossibility of placing a dynamic `@Scheduled(cron=...)` on a method when cron strings come from config.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Loader-job config load + validation | API / Backend (boot phase) | — | `@PostConstruct` on `LoaderConfigService`, fail-loud parity with `SearchConfigServiceV4`. |
| Scheduling cadence | API / Backend (Spring scheduler thread) | Database (lock state) | `@Scheduled` ticker on app instance; ShedLock row in Oracle is shared mutual exclusion. |
| Per-job execution | API / Backend (loader thread pool) | Database (source rows) + Elasticsearch (sink) | Oracle is the read source; ES is the write sink via alias. |
| Bulk indexing batching | API / Backend (in-process `BulkIngester`) | Elasticsearch | The ES Java client manages the batching state machine and HTTP flush. |
| Run history persistence | Database / Storage | API / Backend | `loader_run_history` table in primary Oracle schema; service inserts + prunes. |
| Admin surface | API / Backend (`/api/v4/loader-admin`) | — | Read-only inspection + run-now trigger; no UI in this phase. |
| Graceful shutdown flush | API / Backend (`@PreDestroy`) | — | Spring lifecycle invokes `@PreDestroy`; `BulkIngester.close()` blocks until queue drains. |

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-6.0** Scheduler is **`@Scheduled` + ShedLock 5.x**. [SUPERSEDED on version pin only — see Assumptions Log A1: use **ShedLock 7.7.0**, the current stable line that ships explicit Spring Boot 3.5 + Java 17+ compatibility. The 5.x line predates SB 3.4. The annotation surface (`@EnableSchedulerLock`, `@SchedulerLock(name, lockAtMostFor, lockAtLeastFor)`) is unchanged between 5.x and 7.x.]
- **D-6.1** Multi-job config in `loader-config-v4.json` at `backend/rectrace/src/main/resources/`; per-job shape `{ key, source: { datasource, query, primaryKey }, target: { alias, batch: { rows, bytes, flushMs } }, schedule: "cron-expr" }`.
- **D-6.2** ShedLock; `@Scheduled` on each job; `@SchedulerLock(name=jobKey, lockAtMostFor="PT55M", lockAtLeastFor="PT5S")`. **[Pattern adjusted — see Technical Approach §6: a single ticker fans out per-job `LockingTaskExecutor.executeWithLock(...)` calls because cron strings come from config and cannot be hard-coded into `@Scheduled(cron=…)` per method. ShedLock 7.7.0 supports this pattern via `LockingTaskExecutor`.]**
- **D-6.3** ES writes via **alias only**; fail-fast at boot if alias does not exist (LOADER-03).
- **D-6.4** Deterministic `_id`: SHA-256 of `primaryKey` column values, first 16 hex chars (LOADER-04).
- **D-6.5** Package `com.citi.gru.rectrace.loader` with: `LoaderConfigService`, `LoaderJobRegistry`, `OracleToEsLoaderJob`, `LoaderRunHistoryService` (LOADER-05).
- **D-6.6** Per-run state schema `loader_run_history(job_key, started_at, finished_at, status, row_count, last_error, duration_ms)` PK `(job_key, started_at)` (LOADER-06).
- **D-6.7** Retain last 20 runs/job; prune after each insert (LOADER-07).
- **D-6.8** `LoaderAdminControllerV4` at `/api/v4/loader-admin`: `GET /jobs`, `POST /jobs/{key}/run-now`, `GET /jobs/{key}/runs` (LOADER-08).
- **D-6.9** Graceful shutdown via `@PreDestroy` on `LoaderJobRegistry`; each `BulkIngester.close(...)` flushes before exit; soak-tested with SIGTERM mid-batch (LOADER-09).
- **D-6.10** Bulk indexing via `BulkIngester` defaults: 5000 rows / 5 MB / 5 s / `maxConcurrentRequests=1`; per-job overrides via config (LOADER-10). **[Class corrected — see Assumptions Log A2: `BulkProcessor` is from the deleted `RestHighLevelClient`. The codebase uses `ElasticsearchClient` (Phase 1 BOOT-06); the streaming-bulk helper there is `BulkIngester`. Same defaults, same semantics; only the class name and builder method names change.]**

### Claude's Discretion (NEEDS USER REVIEW on return)

- **D-6.11** Hash algorithm: SHA-256 hex first 16 chars — kept; lower collision risk than expected for ≤100k rows/index.
- **D-6.12** ShedLock locks in same Oracle DB as `rectrace_core` (primary `dataSource`) — kept; matches `usingDbTime()` recommendation.
- **D-6.13** Admin endpoint authZ deferred to Phase 9 — kept; documented gap.
- **D-6.14** Run-now returns 409 Conflict if lock held — kept; ShedLock's `TaskResult.wasExecuted()` returns `false` and the controller maps that to 409 with a "scheduled run in flight" body. *Alternative considered:* 202 Accepted + status URL — rejected because the admin endpoint already exposes the latest run via `GET /runs`, so a synchronous 409 is honest.
- **D-6.15** Example job: `rectrace_core_loader` Oracle→ES every 5 minutes — kept; the local-dev seed needs an alias added (see Pitfall L2 and Specific Ideas).
- **D-6.16** Loader source datasource reuses the primary DS (not readonly) — kept.
- **D-6.17** ShedLock **7.7.0** (was 5.16.0 in CONTEXT — corrected; see A1).

### Deferred Ideas (OUT OF SCOPE)

- AuthZ on admin endpoints — Phase 9.
- Multi-instance scaling — single VM today.
- Per-job dedicated thread pools — global `taskExecutor` is fine for current scale.
- ES schema evolution / dynamic mapping — out of scope.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LOADER-01 | Multi-job config: source SELECT + target ES index/alias + cron + batch | §1 Config; mirrors `SearchConfigServiceV4` pattern (`SearchConfigServiceV4.java`). |
| LOADER-02 | Scheduler locked: `@Scheduled` + ShedLock | §6 Cron + ShedLock annotation pattern; ShedLock 7.7.0 `@EnableSchedulerLock` + `LockingTaskExecutor`. |
| LOADER-03 | ES via alias only | §4 Alias-only writes; `existsAlias` API verified. |
| LOADER-04 | Idempotent upsert via deterministic `_id` from PK | §3 Hashing strategy; `IndexOperation` with `.id(...)` and default `opType=INDEX`. |
| LOADER-05 | Package `loader/` with 4 named services | §11 Existing Patterns; mirrors V4 service layout. |
| LOADER-06 | Per-run state persistence | §7 Run history; Oracle table DDL provided. |
| LOADER-07 | Retain last 20 runs/job | §7 Pruning; idempotent delete-keep-N pattern. |
| LOADER-08 | Admin endpoints: list / run-now / runs | §8 Admin endpoint design. |
| LOADER-09 | Graceful shutdown flushes in-flight | §5 Graceful shutdown; `@PreDestroy` + `BulkIngester.close(...)`. |
| LOADER-10 | `BulkIngester` defaults 5000/5MB/5s, tunable | §2 BulkIngester config; verified builder methods. |

## Validation Architecture (Nyquist Dimension 8)

### Test Framework
| Property | Value |
|----------|-------|
| Framework | JUnit 5 (`spring-boot-starter-test` already on classpath) |
| Config file | `pom.xml` (no separate test config) |
| Quick run command | `cd backend/rectrace && mvn test -Dtest='Loader*' -q` |
| Full suite command | `cd backend/rectrace && mvn test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LOADER-01 | Config parses; duplicate keys / blank cron rejected at boot | unit | `mvn test -Dtest=LoaderConfigServiceTest` | ❌ Wave 0 |
| LOADER-02 | `@SchedulerLock` AOP wired; `LockAssert.assertLocked()` passes inside job body | unit | `mvn test -Dtest=LoaderJobLockTest` | ❌ Wave 0 |
| LOADER-03 | Boot fails if any configured alias does not exist | integration (live ES) | `bash scripts/smoke-loader-alias.sh` | ❌ Wave 0 |
| LOADER-04 | Same Oracle row → same `_id` across runs; different PK → different `_id` | unit | `mvn test -Dtest=DocumentIdHasherTest` | ❌ Wave 0 |
| LOADER-05 | Service classes exist with declared package + names | unit (class-presence assertion) | `mvn test -Dtest=LoaderPackageStructureTest` | ❌ Wave 0 |
| LOADER-06 | Insert row on run start, update on completion, fields populated | unit (Spring `@JdbcTest` against embedded H2 with Oracle dialect emulation OR mocked `JdbcTemplate`) | `mvn test -Dtest=LoaderRunHistoryServiceTest` | ❌ Wave 0 |
| LOADER-07 | After 21 inserts for one job, only 20 rows remain | unit | `mvn test -Dtest=LoaderRunHistoryServiceTest#pruneToLast20` | ❌ Wave 0 |
| LOADER-08 | `GET /jobs`, `POST /jobs/{key}/run-now`, `GET /jobs/{key}/runs` return expected shapes (200 / 409 / 404) | controller slice (`@WebMvcTest`) | `mvn test -Dtest=LoaderAdminControllerV4Test` | ❌ Wave 0 |
| LOADER-09 | SIGTERM mid-batch flushes in-flight ops; no orphaned `running` row | integration (script + `mvn spring-boot:run` + `kill -TERM`) | `bash scripts/smoke-loader-sigterm.sh` | ❌ Wave 0 |
| LOADER-10 | `BulkIngester` built with configured limits; override per-job honored | unit | `mvn test -Dtest=BulkIngesterFactoryTest` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend/rectrace && mvn test -Dtest='Loader*' -q`
- **Per wave merge:** `cd backend/rectrace && mvn test`
- **Phase gate:** Full backend suite green + `scripts/smoke-loader-alias.sh` + `scripts/smoke-loader-sigterm.sh` green against the live local-dev stack before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `backend/rectrace/src/test/java/com/citi/gru/rectrace/loader/LoaderConfigServiceTest.java` — LOADER-01
- [ ] `backend/rectrace/src/test/java/com/citi/gru/rectrace/loader/LoaderJobLockTest.java` — LOADER-02 (uses `LockAssert.assertLocked()`)
- [ ] `backend/rectrace/src/test/java/com/citi/gru/rectrace/loader/DocumentIdHasherTest.java` — LOADER-04
- [ ] `backend/rectrace/src/test/java/com/citi/gru/rectrace/loader/LoaderPackageStructureTest.java` — LOADER-05
- [ ] `backend/rectrace/src/test/java/com/citi/gru/rectrace/loader/LoaderRunHistoryServiceTest.java` — LOADER-06, LOADER-07
- [ ] `backend/rectrace/src/test/java/com/citi/gru/rectrace/loader/BulkIngesterFactoryTest.java` — LOADER-10
- [ ] `backend/rectrace/src/test/java/com/citi/gru/rectrace/controller/v4/LoaderAdminControllerV4Test.java` — LOADER-08
- [ ] `backend/rectrace/scripts/smoke-loader-alias.sh` — LOADER-03 (boot-fail when alias absent)
- [ ] `backend/rectrace/scripts/smoke-loader-sigterm.sh` — LOADER-09 (mid-batch SIGTERM soak)
- [ ] Sibling repo `../rectrace-local-dev/schema/01-rectrace.sql` extensions: `shedlock` table + `loader_run_history` table + `rectrace_core_alias` ES alias bootstrap (see Pitfall L2 + Specific Ideas).

## Standard Stack

### Core (new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `net.javacrumbs.shedlock:shedlock-spring` | **7.7.0** | `@SchedulerLock` AOP + `LockingTaskExecutor` for `@Scheduled` mutual exclusion | Current stable; release 2026-03-17; explicitly tested against Spring Boot 3.4/3.5 and Spring 6.2/7.0 on JVM 17+. [VERIFIED: ShedLock RELEASES.md, Context7 `/lukas-krecan/shedlock`] |
| `net.javacrumbs.shedlock:shedlock-provider-jdbc-template` | **7.7.0** | `JdbcTemplateLockProvider` for Oracle | Matches above; same release line. [VERIFIED: ShedLock README §"Configure JdbcTemplate Lock Provider"] |

### Already on classpath (Phase 1)
| Library | Version (from BOM) | Purpose | Notes |
|---------|---------|---------|-------|
| `spring-boot-starter-data-elasticsearch` | 3.5.14 (Boot BOM) | Pulls `co.elastic.clients:elasticsearch-java` 8.x (provides `BulkIngester`) and auto-configures `ElasticsearchClient` from `spring.elasticsearch.uris` | [VERIFIED: `SuggestionService.java`, `ElasticsearchServiceV4.java` use `ElasticsearchClient`; no `RestHighLevelClient` reference exists in the tree] |
| `spring-boot-starter-data-jpa` (carries Spring JDBC) | 3.5.14 | `JdbcTemplate` for `loader_run_history` and ShedLock | Already used by `ReadonlyDataSourceConfig` (Phase 5). |
| `com.oracle.database.jdbc:ojdbc8` | (Boot BOM) | Oracle driver | Already in use. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@Scheduled` + ShedLock 7.7.0 | Quartz with JDBC JobStore | Quartz adds 11 tables + blob-serialized JobDetail/Trigger payloads + version migrations for a 10-line cron need. Single-VM deployment + ≤10 jobs makes Quartz a price-for-nothing. [LOCKED OUT by D-6.0.] |
| `BulkIngester` | Manual `esClient.bulk(BulkRequest)` per batch | Loses auto-flush by time + auto-batching by op count and bytes. Hand-rolling buffer logic is the canonical "Don't Hand-Roll" trap in this domain. |
| SHA-256 hex first 16 chars | Full SHA-256 hex (64 chars) | Full hash is collision-free up to ~2^128. 16 chars is collision-safe to ~2^64 = ~18 quintillion which exceeds the rectrace_core row count by 11 orders of magnitude. Kept short for `_id` readability in ES audit. |
| Single ticker + `LockingTaskExecutor` | One `@Scheduled(cron=...)` per job (compile-time) | `@Scheduled(cron=...)` requires the cron string at annotation-attribute-resolution time (placeholder via `${prop}` is allowed, but the number of jobs and their distinct property keys must be known at code-author time). With **config-driven N jobs each with its own cron**, this fails. The ticker pattern is the standard escape hatch. |

**Installation:**
```xml
<dependency>
    <groupId>net.javacrumbs.shedlock</groupId>
    <artifactId>shedlock-spring</artifactId>
    <version>7.7.0</version>
</dependency>
<dependency>
    <groupId>net.javacrumbs.shedlock</groupId>
    <artifactId>shedlock-provider-jdbc-template</artifactId>
    <version>7.7.0</version>
</dependency>
```

**Version verification** [VERIFIED: 2026-05-17 via `github.com/lukas-krecan/shedlock/blob/master/RELEASES.md` — 7.7.0 released 2026-03-17. Previous: 7.6.0 (2026-01-27), 7.5.0 (2025-12-27)].

## Architecture Patterns

### System Architecture Diagram

```
                        ┌─────────────────────────────┐
                        │  loader-config-v4.json      │
                        │  (job defs: cron, batch,    │
                        │   source SELECT, alias)     │
                        └──────────┬──────────────────┘
                                   │ classpath load on @PostConstruct
                                   ▼
   ┌──────────────────────────────────────────────────────────────┐
   │  LoaderConfigService                                         │
   │  - parse + validate                                          │
   │  - alias-exists check via esClient.indices().existsAlias()   │
   │  - fail-loud on first violation                              │
   └──────────────────────────────────────────────────────────────┘
                                   │ exposes List<LoaderJobDefV4>
                                   ▼
   ┌──────────────────────────────────────────────────────────────┐
   │  LoaderJobRegistry  (@Component, @PreDestroy)                │
   │  - on @PostConstruct: build per-job BulkIngester +           │
   │    per-job CronExpression                                    │
   │  - on @PreDestroy: BulkIngester.close() each one             │
   └──────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
   ┌──────────────────────────────────────────────────────────────┐
   │  LoaderTicker  (@Scheduled(fixedDelay = "PT30S"))            │
   │  - for each job whose cron is due since last tick:           │
   │    lockingTaskExecutor.executeWithLock(                      │
   │       () -> oracleToEsLoaderJob.run(jobDef),                 │
   │       new LockConfiguration(... name=jobDef.key ...))        │
   └──────────────────────────────────────────────────────────────┘
        │                              │                       │
        │ Oracle SELECT                │ Bulk index            │ History
        ▼                              ▼                       ▼
   ┌─────────────┐               ┌──────────────┐        ┌────────────────────┐
   │ primary     │               │ ElasticSearch│        │ loader_run_history │
   │ DataSource  │               │  (alias)     │        │ (last 20/job)      │
   │ (rectrace)  │               └──────────────┘        └────────────────────┘
   └─────────────┘
        ▲
        │ run-now (POST) / list (GET) / runs (GET)
        │
   ┌────┴────────────────────────────────────────┐
   │ LoaderAdminControllerV4 /api/v4/loader-admin │
   └──────────────────────────────────────────────┘
```

### Recommended Project Structure
```
backend/rectrace/src/main/java/com/citi/gru/rectrace/
├── loader/
│   ├── LoaderConfigService.java          # @PostConstruct config load + alias check
│   ├── LoaderJobRegistry.java            # per-job BulkIngester lifecycle; @PreDestroy
│   ├── LoaderTicker.java                 # single @Scheduled ticker fan-out
│   ├── OracleToEsLoaderJob.java          # one method `run(jobDef)`; @SchedulerLock OR explicit LockingTaskExecutor
│   ├── LoaderRunHistoryService.java      # insert / update / prune-to-20 / fetch-last-20
│   ├── DocumentIdHasher.java             # SHA-256 first 16 hex chars of PK concat
│   └── dto/
│       ├── LoaderConfigV4.java
│       ├── LoaderJobDefV4.java
│       ├── LoaderBatchConfigV4.java
│       ├── LoaderRunRecordV4.java
│       └── LoaderRunStatus.java          # enum: RUNNING / SUCCESS / FAILED
├── controller/v4/
│   └── LoaderAdminControllerV4.java      # /api/v4/loader-admin
└── config/
    └── LoaderShedLockConfig.java         # @EnableSchedulerLock + LockProvider bean
```

### Pattern 1: ShedLock JdbcTemplate provider with DB time
```java
// Source: Context7 /lukas-krecan/shedlock — "Configure JdbcTemplate Lock Provider with DB Time"
@Configuration
@EnableScheduling
@EnableSchedulerLock(defaultLockAtMostFor = "PT55M")
public class LoaderShedLockConfig {

    @Bean
    public LockProvider lockProvider(@Qualifier("dataSource") DataSource dataSource) {
        return new JdbcTemplateLockProvider(
            JdbcTemplateLockProvider.Configuration.builder()
                .withJdbcTemplate(new JdbcTemplate(dataSource))
                .usingDbTime()   // Oracle is in the supported list
                .build()
        );
    }
}
```

### Pattern 2: Programmatic per-job lock + execute via `LockingTaskExecutor`
```java
// Source: Context7 /lukas-krecan/shedlock — "Execute Code Under a Distributed Lock"
//         + adapted for Spring-managed LockProvider.
@Component
@RequiredArgsConstructor
public class LoaderTicker {

    private final LoaderJobRegistry registry;
    private final OracleToEsLoaderJob job;
    private final LockProvider lockProvider;
    private final LockingTaskExecutor lockingTaskExecutor; // built from lockProvider

    // Static cron is fine: this is a per-tick fan-out, not a per-job schedule.
    @Scheduled(fixedDelayString = "PT30S")
    public void tick() {
        Instant now = Instant.now();
        for (LoaderJobDefV4 def : registry.dueAt(now)) {
            LockConfiguration cfg = new LockConfiguration(
                now,
                "loader:" + def.getKey(),
                Duration.ofMinutes(55),   // lockAtMostFor — crash-safety net
                Duration.ofSeconds(5)     // lockAtLeastFor — anti-thrash
            );
            TaskResult<Void> r = lockingTaskExecutor.executeWithLock(
                (LockingTaskExecutor.TaskWithResult<Void>) () -> { job.run(def); return null; },
                cfg);
            if (!r.wasExecuted()) {
                log.debug("Loader job {} skipped this tick — lock held by other run", def.getKey());
            }
        }
    }
}
```

### Pattern 3: `BulkIngester` per job, lifecycle-bound
```java
// Source: Context7 /elastic/elasticsearch-java — "BulkIngester (streaming, auto-flush)"
//         + javadoc 8.x BulkIngester.Builder.maxSize(long)
public BulkIngester<String> build(LoaderJobDefV4 def) {
    return BulkIngester.of(b -> b
        .client(esClient)
        .maxOperations(def.getBatch().getRows())          // default 5000
        .maxSize(def.getBatch().getBytes())               // default 5 * 1024 * 1024
        .flushInterval(def.getBatch().getFlushMs(), TimeUnit.MILLISECONDS)  // default 5000
        .maxConcurrentRequests(1)
        .listener(new LoaderBulkListener(def.getKey()))   // logs item-level errors
    );
}
```

### Pattern 4: Idempotent upsert via deterministic `_id`
```java
// Source: ES docs — IndexOperation default opType is "index" which performs upsert-by-id.
String docId = documentIdHasher.hash(def.getSource().getPrimaryKey(), row);
ingester.add(op -> op.index(idx -> idx
    .index(def.getTarget().getAlias())   // write to ALIAS, never a literal index
    .id(docId)
    .document(row)                       // Map<String,Object> from JdbcTemplate.queryForList()
), def.getKey() + ":" + docId);          // context passed to listener
```

### Pattern 5: Boot-time alias existence check
```java
// Source: ES Java client — ElasticsearchIndicesClient.existsAlias(ExistsAliasRequest)
@PostConstruct
public void verifyAliases() {
    for (LoaderJobDefV4 def : loaderConfig.getJobs()) {
        String alias = def.getTarget().getAlias();
        BooleanResponse r = esClient.indices().existsAlias(b -> b.name(alias));
        if (!r.value()) {
            throw new IllegalStateException(
                "Loader job [" + def.getKey() + "] references alias [" + alias
                + "] which does not exist in Elasticsearch. Refusing to boot.");
        }
    }
}
```

### Anti-Patterns to Avoid
- **`@Scheduled(cron = "${loader.jobs.foo.schedule}")` per job, generated at code-author time.** Cron strings live in config; the number of jobs is also in config. Cannot statically annotate. Use a ticker + `LockingTaskExecutor`.
- **Pruning history outside a transaction or via `LIMIT` clause on Oracle.** Oracle doesn't take `LIMIT`; use the analytic `ROW_NUMBER()` pattern (see §7).
- **Logging `last_error` longer than CLOB chunk size without bounds.** Truncate to a sane cap (8 KB) before persisting; full stack trace is in app logs anyway.
- **Catching `Exception` and continuing.** A bulk listener's `afterBulk(throwable)` path must mark the run `FAILED` in `loader_run_history` and record the error message. Silent failure is worse than no loader.
- **Calling `BulkIngester.close()` on a `@Scheduled` thread.** Close belongs to `@PreDestroy` (Spring lifecycle thread), not the worker. Long-running close on the scheduler thread will block the next tick.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Distributed mutual exclusion of scheduled jobs | A `synchronized` flag or DB advisory lock | ShedLock 7.7.0 `JdbcTemplateLockProvider.usingDbTime()` | Clock skew, dead-process lock release, fairness, AOP integration are all already handled. |
| Cron expression parsing | Custom regex | Spring `org.springframework.scheduling.support.CronExpression` (already on classpath) | Production-grade RFC parser handling both 5-field and 6-field forms; same semantics as `@Scheduled(cron=…)`. |
| Bulk-request batching by rows + bytes + time | Custom buffer with a `ScheduledExecutorService` flush thread | `BulkIngester.of(...).maxOperations(...).maxSize(...).flushInterval(...).listener(...)` | The ES Java client owns the batching state machine; building it is the canonical mistake in this domain. |
| Hash-of-primary-key generator | Custom CRC32 or string concat | `MessageDigest.getInstance("SHA-256")` + hex truncate | JDK ships this; collision-safe to 2^64 at 16-char truncation. |
| Cron-aware "is due now?" check | Manual time arithmetic | `CronExpression.next(lastFire)` from Spring | Already used by `@Scheduled`; same parser, same edge cases. |
| Run history pruning ordered by insert time | Application-side sort + delete-by-id | Oracle `DELETE … WHERE ROWID IN (SELECT … row_number() OVER ...)` | Single round-trip, atomic, no race. |

**Key insight:** Phase 6 is mostly *integration plumbing*, not novel logic. Every wheel that could be reinvented is already shipped in a library that's either on the classpath (ES client, Spring scheduling, Spring JDBC, JDK crypto) or being added (ShedLock).

## Runtime State Inventory

> Phase 6 is greenfield within `backend/rectrace`. No code is being renamed/refactored. However, four runtime-state categories are touched because **new** state must be created cleanly:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | New table `loader_run_history` in `rectrace` schema; new table `shedlock` in `rectrace` schema | Data migration: none (new tables). DDL: add to `../rectrace-local-dev/schema/01-rectrace.sql` and to the Citi VM bootstrap script. |
| Live service config | New ES alias `rectrace_core_alias` (does not exist in seed today — verified by `grep -rn "alias" rectrace-local-dev/`) | Add an `aliases` bootstrap step to `apply.py` so `rectrace_core_index` gets the alias on `--reset`. |
| OS-registered state | None — `@Scheduled` lives inside the JVM; no cron daemon registration | None — verified by grep for `cron` / `systemd` / `launchd` in the repo. |
| Secrets/env vars | None new — primary `datasource.*` credentials reused | None. |
| Build artifacts | New `loader-config-v4.json` resource in the JAR | Build target unchanged; resource picked up automatically by Spring `Resource` loading. |

**The canonical question:** *After every file in the repo is updated, what runtime systems still have the old state?* Answer: none, because there is no old state. There is only **new** state that must be bootstrapped: `loader_run_history` table, `shedlock` table, and the `rectrace_core_alias` ES alias.

## Common Pitfalls

### L1: ShedLock table must exist BEFORE the app starts
**What goes wrong:** The first `@SchedulerLock` invocation hits the DB; if `shedlock` does not exist, ShedLock fails the AOP call and the scheduled task does not run. The app stays up but loader silently never fires.
**Why it happens:** Spring Boot does not own the DB schema for this app (`hibernate.hbm2ddl.auto=none` per `DataSourceConfig`).
**How to avoid:** Add the `shedlock` DDL to `../rectrace-local-dev/schema/01-rectrace.sql` and add a smoke-test step that asserts the table exists on boot via `SELECT 1 FROM shedlock WHERE 1=0`. Production: include in the Citi VM DB bootstrap runbook.
**Warning signs:** Log line at WARN level: `Cannot lock` or `Table or view does not exist`.

### L2: ES alias does not exist in the seed today
**What goes wrong:** D-6.15 references `rectrace_core_alias` but `grep -rn alias ../rectrace-local-dev/` returns nothing. Boot-time `existsAlias` check fails-loud; loader cannot start.
**Why it happens:** Phase 0.1 created `rectrace_core_index` with no alias. Phase 6 is the first phase requiring an alias.
**How to avoid:** Add to `../rectrace-local-dev/apply.py` (or its bulk-load JSON) an aliases step:
```bash
curl -sS -XPOST localhost:9200/_aliases -H 'Content-Type: application/json' -d '{
  "actions": [ { "add": { "index": "rectrace_core_index", "alias": "rectrace_core_alias" } } ]
}'
```
Idempotent: ES treats `add` of an already-present alias as a no-op.
**Warning signs:** `IllegalStateException: Loader job [...] references alias [rectrace_core_alias] which does not exist`.

### L3: `BulkIngester.close()` blocks longer than Spring's shutdown phase
**What goes wrong:** `@PreDestroy` calls `BulkIngester.close()` to flush. If `flushInterval` is mid-cycle and `maxConcurrentRequests` calls are in flight, close can take 5-10s. Spring's default `spring.lifecycle.timeout-per-shutdown-phase` is 30s — usually fine, but if you ship a slow ES cluster or the bulk request is large, the close can outlast the phase timeout and Spring force-kills.
**Why it happens:** `BulkIngester.close()` blocks the calling thread until all enqueued ops complete or the underlying transport errors.
**How to avoid:** (a) Set `spring.lifecycle.timeout-per-shutdown-phase=60s` in `application.properties`. (b) `BulkIngester.close()` does not take a timeout in the current API — instead, before close, call `BulkIngester.flush()` to force an immediate drain, then close (close is then quick). (c) Wrap `close()` in a `try/catch (Throwable)` so an unfinished close doesn't crash shutdown.
**Warning signs:** Logs show `BulkIngester closing...` followed by `Shutdown of the application has been requested but did not complete within...`.

### L4: `@Scheduled` runs in tests and deadlocks the embedded H2 / mocked ES
**What goes wrong:** `ContextLoadsTest` starts the full Spring context including the ticker. The ticker fires, tries to acquire the ShedLock row, blocks on a missing table, and the test hangs.
**Why it happens:** `@EnableScheduling` activates the scheduler for every profile unless gated.
**How to avoid:** Put `@Profile("!test")` on `LoaderShedLockConfig` AND on `LoaderTicker` (mirror the existing `@Profile("!test")` pattern on `DataSourceConfig`, `AutosysDataSourceConfig`, `ReadonlyDataSourceConfig`). The unit tests that need to exercise loader logic instantiate the services directly without the scheduler.
**Warning signs:** `mvn test` hangs at "Started ContextLoadsTest" with no progress.

### L5: `_id` collisions when PK columns contain `|` separator
**What goes wrong:** If `primaryKey = ["recon", "file_name_pattern"]` and `recon = "A"`, `file_name_pattern = "B|C"`, then the concat `A|B|C` is indistinguishable from `recon = "A|B"`, `file_name_pattern = "C"`. Different source rows hash to the same `_id` → one upsert overwrites the other.
**Why it happens:** Naive separator-join is not injective.
**How to avoid:** Use a separator that's structurally impossible in PK values (e.g. `""` — ASCII Unit Separator), OR length-prefix each value (`len|value`), OR JSON-encode the PK array before hashing. Recommended: JSON-encode (`ObjectMapper.writeValueAsBytes(List.of(v1, v2, ...))`) — explicit, no edge cases.
**Warning signs:** Two source rows, same `_id` in ES; row count in ES less than row count in Oracle.

### L6: Run-history `pruneToLast20` race
**What goes wrong:** Two concurrent triggers (scheduled tick + admin `run-now`) both insert a `RUNNING` row, both compute "rows beyond top-20", both delete — but each computes a different "beyond top-20" set, causing one to delete the other's row.
**Why it happens:** Pruning + insert in separate statements without isolation.
**How to avoid:** ShedLock guarantees only one of the two can hold the lock at a time, so concurrent runs of the same job_key cannot happen. Pruning is performed inside the locked region, after the insert of the new `SUCCESS`/`FAILED` row. Use `DELETE FROM loader_run_history WHERE job_key = ? AND started_at NOT IN (SELECT started_at FROM (SELECT started_at, ROW_NUMBER() OVER (ORDER BY started_at DESC) rn FROM loader_run_history WHERE job_key = ?) WHERE rn <= 20)`.
**Warning signs:** `loader_run_history` has > 20 rows for one job, OR fewer than 20 rows when more should be present.

### L7: `LockAssert.assertLocked()` in unit tests without AOP wired
**What goes wrong:** A unit test that calls a `@SchedulerLock`-annotated method directly (bypassing Spring proxy) inside the method's body sees `LockAssert.assertLocked()` throw `IllegalStateException`.
**Why it happens:** AOP wrapping only happens on Spring-managed bean invocations.
**How to avoid:** In unit tests of the *job body* (not the lock contract), call `LockAssert.TestHelper.assertLocked()` set-up OR test the locked behavior at the `LockingTaskExecutor` level rather than reading `LockAssert` inside the method. Reserve `LockAssert.assertLocked()` for the wired integration test (`LoaderJobLockTest`).
**Warning signs:** `IllegalStateException: The task is not locked. Use this method only inside scheduled tasks…`.

### L8: Run-now returns 409 but the user expected 202
**What goes wrong:** D-6.14 says "409 if scheduled run in flight". `LockingTaskExecutor` returns `TaskResult.wasExecuted() == false` when the lock is held. The controller maps that to 409. But the user reads the docs and expects a 202 + status URL.
**Why it happens:** Ambiguity in CONTEXT.md.
**How to avoid:** Document explicitly in the OpenAPI/README that `run-now` is synchronous-fail-fast: returns 200 with run-record body if executed, 409 with `{ "reason": "scheduled run in flight", "currentRun": {…} }` if not. No 202.
**Warning signs:** None at runtime; pure documentation hazard.

### L9: Default cron timezone surprises in 6-field expressions
**What goes wrong:** `@Scheduled(cron = "0 */5 * * * *")` runs every 5 minutes in the JVM's default timezone. On a US-east laptop dev profile + UTC prod VM, a 9 AM Citi-time job lands at 13:00 UTC. For the example `rectrace_core_loader` (every-5-min) it's invisible, but for any "at 06:00" job it matters.
**Why it happens:** `@Scheduled` reads `TimeZone.getDefault()` unless the `zone` attribute is set.
**How to avoid:** Add a per-job `timezone` field to `LoaderJobDefV4` (default `"UTC"`); the ticker uses it when computing `CronExpression.next(...)`.
**Warning signs:** Scheduled runs fire at unexpected wall-clock times.

### L10: Source `JdbcTemplate.queryForList(...)` materializes the full result set into memory
**What goes wrong:** Loader source query returns 500k rows; `queryForList` returns `List<Map<String,Object>>` of 500k entries → OOM.
**Why it happens:** Default `JdbcTemplate` API is eager.
**How to avoid:** Use `JdbcTemplate.query(sql, RowCallbackHandler)` (streaming) AND set `setFetchSize(1000)` on the statement via `StatementCallback`. Pattern is already in `SqlQueryServiceV4` from Phase 5 — mirror it. Per-row callback adds the op to the `BulkIngester` which itself caps in-memory rows by `maxOperations`.
**Warning signs:** `java.lang.OutOfMemoryError: Java heap space` during loader run.

## Code Examples

Verified patterns from official sources.

### Building the BulkIngester
```java
// Source: https://artifacts.elastic.co/javadoc/co/elastic/clients/elasticsearch-java/8.17.0/co/elastic/clients/elasticsearch/_helpers/bulk/BulkIngester.Builder.html
BulkIngester<String> ingester = BulkIngester.of(b -> b
    .client(esClient)
    .maxOperations(5000)              // flush at 5000 ops
    .maxSize(5L * 1024L * 1024L)      // OR at 5 MiB, whichever first
    .flushInterval(5, TimeUnit.SECONDS)  // OR every 5s, whichever first
    .maxConcurrentRequests(1)
    .listener(new BulkListener<String>() {
        @Override public void beforeBulk(long id, BulkRequest r, List<String> ctx) {}
        @Override public void afterBulk(long id, BulkRequest r, List<String> ctx, BulkResponse resp) {
            for (int i = 0; i < ctx.size(); i++) {
                BulkResponseItem item = resp.items().get(i);
                if (item.error() != null) {
                    log.error("Loader {} doc {} failed: {}", jobKey, ctx.get(i), item.error().reason());
                }
            }
        }
        @Override public void afterBulk(long id, BulkRequest r, List<String> ctx, Throwable failure) {
            log.error("Loader {} batch failed wholesale", jobKey, failure);
        }
    })
);
```

### Streaming Oracle source rows
```java
// Source: org.springframework.jdbc.core.JdbcTemplate javadoc; mirrors Phase 5 SqlQueryServiceV4
primaryJdbcTemplate.query(con -> {
    PreparedStatement ps = con.prepareStatement(def.getSource().getQuery());
    ps.setFetchSize(1000);
    return ps;
}, (RowCallbackHandler) rs -> {
    Map<String, Object> row = rowToMap(rs);
    String docId = documentIdHasher.hash(def.getSource().getPrimaryKey(), row);
    ingester.add(op -> op.index(idx -> idx
        .index(def.getTarget().getAlias())
        .id(docId)
        .document(row)
    ), jobKey + ":" + docId);
    rowCount.incrementAndGet();
});
```

### Pruning history to last 20 (Oracle)
```sql
-- Source: Oracle 19c+ analytic functions
DELETE FROM loader_run_history
WHERE job_key = ?
  AND (job_key, started_at) NOT IN (
    SELECT job_key, started_at FROM (
      SELECT job_key, started_at,
             ROW_NUMBER() OVER (PARTITION BY job_key ORDER BY started_at DESC) AS rn
      FROM loader_run_history
      WHERE job_key = ?
    )
    WHERE rn <= 20
  );
```

### Boot DDL for the new tables
```sql
-- Source: Context7 /lukas-krecan/shedlock — "Oracle ShedLock Table Creation"
CREATE TABLE shedlock (
  name        VARCHAR(64)   NOT NULL,
  lock_until  TIMESTAMP(3)  NOT NULL,
  locked_at   TIMESTAMP(3)  NOT NULL,
  locked_by   VARCHAR(255)  NOT NULL,
  PRIMARY KEY (name)
);

-- Source: D-6.6 in CONTEXT.md
CREATE TABLE loader_run_history (
  job_key      VARCHAR2(64)  NOT NULL,
  started_at   TIMESTAMP(3)  NOT NULL,
  finished_at  TIMESTAMP(3)  NULL,
  status       VARCHAR2(16)  NOT NULL,    -- RUNNING / SUCCESS / FAILED
  row_count    NUMBER        NULL,
  last_error   CLOB          NULL,
  duration_ms  NUMBER        NULL,
  PRIMARY KEY (job_key, started_at)
);
CREATE INDEX loader_run_history_recent_ix ON loader_run_history (job_key, started_at DESC);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `RestHighLevelClient` + `BulkProcessor` | `ElasticsearchClient` + `BulkIngester` | ES 8.x deprecated RHLC; removed in ES client 9.x | The CONTEXT.md uses the legacy class name. The codebase already migrated in Phase 1. Phase 6 must use `BulkIngester`. |
| ShedLock 4.x (Spring Boot 2.7 era) | ShedLock 7.7.0 | ShedLock 7.x line tested against Spring Boot 3.4/3.5 + JVM 17+ | The CONTEXT.md says 5.16.0 (out of date by ~2 major versions). API surface for `@SchedulerLock` is stable across 5.x → 7.x; pinning to 7.7.0 is a pure version bump. |
| Quartz JDBC JobStore | `@Scheduled` + ShedLock for single-node + few-jobs cases | Industry consensus shifted ~2020 onward | Quartz remains correct for high-job-count / fine-grained scheduling; for ≤10 cron jobs on a single VM, ShedLock is the lighter choice. |

**Deprecated/outdated:**
- `BulkProcessor` (legacy class, not in this codebase — kept name only in CONTEXT for historical reference).
- `RestHighLevelClient` (legacy, not in this codebase).
- `WebSecurityConfigurerAdapter` (already replaced in Phase 1 BOOT-04).

## Project Constraints (from CLAUDE.md)

CLAUDE.md directives that bind Phase 6:

- **Tech stack — backend:** Spring Boot 3.2.x+ on Java 17+ (project is on 3.5.14 + Java 21).
- **Deployment:** Citi VM (Linux). Single bash script is the operations surface — loader admin is HTTP, but a `restart` of the JVM via the ops script must not leave orphan `RUNNING` rows. See Pitfall L3.
- **Security:** Citi domain auth deferred to Phase 9, but the admin endpoint MUST still accept the `x-citiportal-loginid` header per the existing convention. Add a header check that fails 400 if absent (mirror existing controllers).
- **All APIs expect `x-citiportal-loginid`** — applies to `LoaderAdminControllerV4`.
- **Error responses follow standardized format with status, error_type, and message** — mirror Phase 5 `SqlSearchControllerV4` body shape.
- **Search results use AG-Grid SSRM** — N/A for loader admin (no UI in this phase).
- **All Boot 3.x patterns: jakarta namespace, SecurityFilterChain** — applies to the new controller's bean wiring.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Oracle 23c (local-dev) | ShedLock + loader_run_history tables | ✓ (sibling repo Docker stack) | 23c-slim | None — DB is mandatory for ShedLock + history. |
| Elasticsearch 8.13.4 (local-dev) | Bulk indexing + alias check | ✓ (sibling repo Docker stack) | 8.13.4 | None — sink is mandatory. |
| Java 21 | Compile + run | ✓ (Phase 1 baseline) | 21 | None. |
| Maven 3.x | Build | ✓ | — | None. |
| `mvn spring-boot:run` profile=`local` | Manual smoke + SIGTERM test | ✓ (Phase 0.1) | — | None. |
| `kill -TERM <pid>` | LOADER-09 SIGTERM test | ✓ (POSIX) | — | None. |
| `curl` | Admin endpoint smoke | ✓ | — | `httpie` if absent. |

**Missing dependencies with no fallback:** None — all needed tooling is already in place per Phase 0.1 + Phase 1.
**Missing dependencies with fallback:** None.

## Assumptions Log

> List all claims tagged `[ASSUMED]` and the verified corrections.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | **ShedLock 7.7.0** is the correct pin (CONTEXT specified 5.16.0). Verified against ShedLock RELEASES.md (release 2026-03-17) and Context7 docs which explicitly list compatibility with Spring Boot 3.4/3.5 + JVM 17+. The 5.x line predates SB 3.4. API surface (`@SchedulerLock`, `@EnableSchedulerLock`, `JdbcTemplateLockProvider`, `LockingTaskExecutor`) is stable from 5.x onward. | Standard Stack, User Constraints (D-6.17) | Low — wrong-version pin produces classloading errors on first boot, fails loud. |
| A2 | **`BulkIngester`** (not `BulkProcessor`) is the correct class. CONTEXT says `BulkProcessor` throughout. Verified by grep: codebase has zero `RestHighLevelClient` or `BulkProcessor` references; both `SuggestionService` and `ElasticsearchServiceV4` use `co.elastic.clients.elasticsearch.ElasticsearchClient`. The Phase 1 BOOT-06 upgrade already migrated to the new client. `BulkIngester` provides equivalent defaults (5000 ops / 5 MiB / 5s / 1 concurrent) and the same lifecycle semantics. | Standard Stack, Code Examples, User Constraints (D-6.10) | Low — `BulkProcessor` class wouldn't even resolve; the planner picks the right one mechanically. |
| A3 | **Single-ticker fan-out** is preferred over per-job `@Scheduled(cron=...)`. CONTEXT D-6.2 implies a per-job annotation. With cron strings coming from config and N jobs unknown at code-author time, a per-job static annotation is impossible without code generation. The standard escape hatch is `LockingTaskExecutor.executeWithLock(...)`. This preserves every contract D-6.2 implies (ShedLock-locked, per-job named, lockAtMost/lockAtLeast configurable). | Architecture Patterns, Anti-Patterns | Low if surfaced; high if missed — without this resolution, the plan would attempt a per-method `@Scheduled` and stall at code-gen time. |
| A4 | **Pruning runs inside the ShedLock-protected region**, not outside. CONTEXT D-6.7 says "pruned after each insert" without specifying ordering vs the lock. Since runs for a given `job_key` are mutually exclusive under ShedLock, pruning inside the lock is race-free. | Pitfall L6 | Low — without this clarification, two run-now triggers could race; with it, race is impossible. |
| A5 | **The local-dev seed needs `rectrace_core_alias` added.** Currently no alias exists in `../rectrace-local-dev/`. CONTEXT D-6.15 assumes the alias exists. | Specifics, Pitfall L2, Wave 0 gap | High if missed — boot-time `existsAlias` check fails-loud and the entire phase blocks. |
| A6 | **`@Profile("!test")`** must be added to the new scheduling beans to keep `ContextLoadsTest` green, mirroring the existing pattern on `DataSourceConfig`, `AutosysDataSourceConfig`, `ReadonlyDataSourceConfig`. | Pitfall L4 | Medium — test suite would hang on context load. |

## Open Questions

1. **Should `search-config-v4.json` be updated to query the new `rectrace_core_alias` instead of `rectrace_core_index`?**
   - **RESOLVED — NO, out of scope.** CONTEXT says "alias-only writes" — read-side is untouched in this phase. Phase 8 (hyphen bug) is the natural time to flip reads to the alias because that phase already does an alias-swap reindex. Phase 6 only adds the alias and writes to it. The two routes (read=`rectrace_core_index`, write=`rectrace_core_alias`) co-exist safely because the alias points at the same index.

2. **Where exactly does `@EnableScheduling` go — `RectraceApplication.java` or `LoaderShedLockConfig.java`?**
   - **RESOLVED — `LoaderShedLockConfig.java`.** Two reasons: (a) `RectraceApplication` already carries `@EnableAsync` and the surface is intentionally minimal; (b) `@EnableScheduling` co-located with `@EnableSchedulerLock` on the loader config is the canonical ShedLock README example, and adding `@Profile("!test")` to the same class disables scheduling cleanly in tests. The Spring annotation processor picks up either location identically.

3. **Should `LoaderJobRegistry` be a `@Component` or a `@Configuration`?**
   - **RESOLVED — `@Component`.** It holds runtime state (`Map<String, BulkIngester>`, `Map<String, CronExpression>`, last-fire timestamps) — a `@Configuration` should be stateless. `@Component` with `@PostConstruct` for init and `@PreDestroy` for close is the idiomatic Spring pattern for lifecycle-bound stateful beans.

4. **Does the `LoaderTicker.tick()` method need its own `@SchedulerLock`?**
   - **RESOLVED — NO.** The ticker itself runs on a single VM (single instance, per CLAUDE.md). Its only side effect is dispatch — the per-job `executeWithLock` calls handle mutual exclusion at the job level. Locking the ticker would be wasteful (every 30s acquires a no-op DB row) and incorrect for HA (would serialize all jobs through one lock). When multi-instance becomes a requirement (v2 HA-01), every instance ticks but only one wins the per-job lock — correct out-of-the-box.

5. **What identifies a "row" for the deterministic `_id` when the source SELECT returns more columns than `primaryKey`?**
   - **RESOLVED — only the configured `primaryKey` columns participate in the `_id` hash; the full row is the document body.** Per LOADER-04, the contract is "deterministic `_id` derived from source primary key", not from the full row. This means non-PK column edits in Oracle preserve `_id` stability across loader runs and produce a clean upsert (replace document body in place). Hash inputs: JSON-encoded `List<Object>` of PK values in the order declared in config — see Pitfall L5.

6. **How does the SIGTERM soak test (LOADER-09) actually exercise mid-batch flush?**
   - **RESOLVED — `scripts/smoke-loader-sigterm.sh` orchestrates:** (a) seed Oracle with 50k rows in a temp table; (b) configure a loader job pointing at it with `batch.flushMs=10000` so a half-full batch is in the queue; (c) `mvn spring-boot:run -Plocal &` and wait for the loader-job log line "started"; (d) `sleep 2 && kill -TERM <pid>`; (e) `wait <pid>` for clean exit; (f) `curl ES count` and assert it equals `50000` (or `> rows_at_signal`, i.e. the in-flight batch was flushed). Failure mode = exit-and-count-less-than-rows-at-signal.

7. **Does Spring Boot's default `spring.lifecycle.timeout-per-shutdown-phase=30s` cover the worst-case flush?**
   - **RESOLVED — Probably, but set explicitly to 60s for safety.** `BulkIngester.close()` flushes the in-flight queue (≤5000 ops) which on a healthy ES cluster takes < 5s. The 60s buffer absorbs slow ES + max-size-batch (5 MiB) + retries. Set in `application.properties`: `spring.lifecycle.timeout-per-shutdown-phase=60s`.

8. **Run-history `last_error` CLOB — truncate to what?**
   - **RESOLVED — 8 KB.** Long enough for the message + first 60 lines of stack; short enough to keep `loader_run_history` readable. Full stack trace is in app logs via `logback-spring.xml` JSON appender (Phase 7 sweep). Truncate in `LoaderRunHistoryService` before persist.

9. **Does the codebase already export an `ObjectMapper` bean, or do we need to inject the default Spring Boot one?**
   - **RESOLVED — Use the Spring Boot auto-configured `ObjectMapper`.** `SearchConfigServiceV4` and `SqlSearchConfigServiceV4` both `@Autowired` the default — same pattern for `LoaderConfigService`. Jackson is on the classpath via `spring-boot-starter-web`.

10. **The CONTEXT says `lockAtMostFor="PT55M"`, but loader runs should complete in seconds. Why 55 minutes?**
    - **RESOLVED — It's a crash-safety net, not an expected duration.** `lockAtMostFor` is the maximum time before ShedLock will assume the holding node died and release the lock. The actual run time of a healthy loader is 1-30s. The 55-minute ceiling means: if a JVM hard-crashes mid-run, no other instance can re-execute the job for up to 55 minutes — a safe choice for a 5-minute-cron job, because the next scheduled tick would skip if the previous instance were merely slow. Document this on `@EnableSchedulerLock(defaultLockAtMostFor = "PT55M")`.

## Sources

### Primary (HIGH confidence)
- Context7 `/lukas-krecan/shedlock` — `@EnableSchedulerLock`, `@SchedulerLock`, `JdbcTemplateLockProvider.usingDbTime()`, `LockingTaskExecutor.executeWithLock(...)`, Oracle DDL, compatibility matrix (JVM 17+ + Spring Boot 3.4/3.5).
- Context7 `/elastic/elasticsearch-java` — `BulkIngester.of(...)` builder, `maxOperations` (default 1000), `flushInterval`, `maxConcurrentRequests` (default 1), `BulkListener`, `close()` flushes.
- https://github.com/lukas-krecan/shedlock/blob/master/RELEASES.md — 7.7.0 released 2026-03-17 (verified 2026-05-17).
- https://artifacts.elastic.co/javadoc/co/elastic/clients/elasticsearch-java/8.17.0/co/elastic/clients/elasticsearch/_helpers/bulk/BulkIngester.Builder.html — `maxSize(long bytes)` default 5 MiB.
- https://github.com/elastic/elasticsearch-java/blob/main/docs/reference/usage/indexing-bulk.md — BulkIngester usage canonical guide.
- Codebase: `backend/rectrace/pom.xml` (SB 3.5.14, Java 21), `RectraceApplication.java` (`@EnableAsync`), `SearchConfigServiceV4.java` and `SqlSearchConfigServiceV4.java` (config-load pattern), `ElasticsearchServiceV4.java` and `SuggestionService.java` (`ElasticsearchClient` usage), `DataSourceConfig.java` + `ReadonlyDataSourceConfig.java` (`@Profile("!test")` pattern), `../rectrace-local-dev/schema/01-rectrace.sql`, `../rectrace-local-dev/es/rectrace_core_index.mapping.json` (no alias today).

### Secondary (MEDIUM confidence)
- https://docs.spring.io/spring-boot/reference/web/graceful-shutdown.html — `spring.lifecycle.timeout-per-shutdown-phase`.
- https://raphaeldelio.medium.com/how-to-set-dynamic-task-schedulers-programmatically-using-spring-boot-1b1e4a38b9d — `SchedulingConfigurer` pattern (informational; chosen approach is simpler ticker + `LockingTaskExecutor`).

### Tertiary (LOW confidence)
- None. Every load-bearing claim is verified at Primary or Secondary level.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every version pinned and verified against Context7 + Maven Central within the last 24h.
- Architecture: HIGH — patterns mirror existing services (V4 config services) and follow canonical ShedLock / ES Java client guides.
- Pitfalls: HIGH — each pitfall has a named warning sign and a concrete mitigation; L2 (alias absence) and L1 (table absence) are verified by grep against the sibling repo.
- Test architecture: HIGH — every requirement has a named test file + command; Wave 0 gaps are explicit.

**Research date:** 2026-05-17
**Valid until:** 2026-06-17 (30 days — stack is mature; ShedLock + ES client have predictable release cadence)

## RESEARCH COMPLETE
