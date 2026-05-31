# Loader Extraction — Design

**Date:** 2026-05-31
**Status:** Approved (architecture, file map, migration sequence locked)
**Motivation:** Backend should be a strict read-side API. The ES loader subsystem currently lives in `backend/rectrace` as 20 main files + 9 tests + a JSON config + its own deps; that's the wrong shape for an upcoming demo focused on architectural cleanliness. The loader becomes its own deployable, sibling to `rectrace-tlm-stats`, scalable + restartable independently of the read-side API.

## Problem

`backend/rectrace` today carries the ES loader subsystem (verified file-by-file 2026-05-31):

- `loader/` package — 14 files: 7 top-level (`DocumentIdHasher`, `LoaderBulkListener`, `LoaderConfigService`, `LoaderJobRegistry`, `LoaderRunHistoryService`, `LoaderTicker`, `OracleToEsLoaderJob`) + 7 DTOs (`LoaderBatchConfigV4`, `LoaderConfigV4`, `LoaderJobDefV4`, `LoaderRunRecordV4`, `LoaderRunStatus`, `LoaderSourceConfigV4`, `LoaderTargetConfigV4`).
- `controller/v4/LoaderAdminControllerV4.java` — admin surface at `/api/v4/loader-admin/*` (GET `/jobs`, POST `/jobs/{key}/run-now`, GET `/jobs/{key}/runs`).
- `config/LoaderShedLockConfig.java` + `config/LoaderJdbcConfig.java` — loader-specific wiring.
- `observability/health/LoaderRunAgeHealthIndicator.java` — health indicator that directly imports + injects `LoaderConfigService` + `LoaderRunHistoryService` (in-process Java dep, not DB-mediated).
- `dto/v4/LoaderJobSummaryV4.java` + `dto/v4/RunNowConflictResponseV4.java` — loader DTOs.
- `resources/loader-config-v4.json` — loader's job catalog (cron, batch, source SQL, target index — all loader-cycle config lives in this JSON, not in `application*.properties`).
- `pom.xml` deps: `shedlock-spring` + `shedlock-provider-jdbc-template` (main scope) + `shedlock-provider-inmemory` (test scope). All three are loader-only.
- `application*.properties` keys: just one — `loader-config.location=classpath:loader-config-v4.json` (in both `application.properties` and `application-local.properties`). Plus a 6-line comment block at `application.properties:64-68` documenting the deferred `management.endpoint.health.group.loader.include=loaderRunAge` (the dedicated health-group wiring was deferred during Phase 7 — see "Phase 7 deferred health group" note below).

Total: 20 main Java files + 9 test files (`loader/` test package has 7: `BulkIngesterFactoryTest`, `DocumentIdHasherTest`, `LoaderConfigServiceTest`, `LoaderJobLockTest`, `LoaderPackageStructureTest`, `LoaderRunHistoryServiceTest`, `OracleToEsLoaderJobTest`; plus `observability/health/LoaderRunAgeHealthIndicatorTest` and `controller/v4/LoaderAdminControllerV4Test`).

`BulkIngesterFactoryTest` covers the inline BulkIngester construction inside `OracleToEsLoaderJob` (no separate factory class exists). Test moves with that source.

**Phase 7 deferred health group**: backend currently registers `LoaderRunAgeHealthIndicator` (bean name `loaderRunAge`) but does NOT add it to a dedicated `management.endpoint.health.group.loader` group. The indicator therefore contributes to the default `/actuator/health` aggregate. This posture stays in the loader module after extraction (move the indicator + the deferred-comment block; don't enable the group during this work).

Two concrete problems:

1. **Conceptual**: backend mixes read-side (search API) and write-side (loader ingestion). A reader of the codebase has to mentally partition. Restarts of one affect the other.
2. **Operational**: a loader cron-misconfiguration today shows up as `LoaderTicker: dueAt() threw` errors in the backend log every 30 seconds (live evidence in `logs/backend.log`). The loader's failure mode pollutes backend's signal.

The `LoaderRunHistoryService` already writes to its own Oracle table (`loader_run_history`, DDL in `rectrace-local-dev/schema/01-rectrace.sql`), and `LoaderAdminControllerV4`'s endpoints have **zero React/backend consumers** — only `scripts/smoke-loader-admin.sh` and `scripts/smoke-loader-sigterm.sh` call them. So the extraction breaks no public API.

## Approach — strict separation, sibling module

Create `rectrace-loader/` at the repo root, mirroring `rectrace-tlm-stats/`. Move all loader code there. Backend loses every loader-related class, property, dep, and test. Each module owns its own actuator/health. No shared Java code. Both modules talk to the same Oracle schema + ES indices (deployment-level coupling, not source-level coupling).

**Strict** means backend has zero loader awareness: no `LoaderRunAgeHealthIndicator`, no loader properties, no loader admin endpoints proxied through, no loader-config-v4.json. "Data freshness" becomes a monitoring concern (Prometheus alert on loader's metrics or an ES timestamp probe), not a backend health gate.

## Architecture

```
┌──────────────────────────────┐         ┌────────────────────────────────┐
│  backend/rectrace            │         │  rectrace-loader  (NEW)        │
│  :6088                       │         │  :6089                         │
│                              │         │                                │
│  • Search config endpoint    │         │  • LoaderTicker (@Scheduled)   │
│  • /initial + /ssrm SSRM     │         │  • OracleToEsLoaderJob         │
│  • Cell-renderer data        │         │  • BulkIngester → ES aliases   │
│  • Read-only Oracle pool     │         │  • LoaderRunHistoryService     │
│  • ES read client (search)   │         │  • LoaderAdminController       │
│  • /actuator/health          │         │    /api/v4/loader-admin/*      │
│    (oracle + es + cfg)       │         │  • ShedLock writer pool        │
│  • Brave tracing, MDC,       │         │  • ES BulkIngester client      │
│    correlation-id            │         │  • Own Splunk-aware logback    │
│                              │         │  • /actuator/health            │
│                              │         │    (oracle + es + cfg          │
│                              │         │     + loaderRunAge)            │
│  • NO loader awareness       │         │                                │
└──────────────────────────────┘         └────────────────────────────────┘
              │                                       │
              │ JDBC                       JDBC
              │ read: rectrace_core        read:  rectrace_core (source)
              │       (SSRM detail rows,   write: loader_run_history,
              │        cell-renderer)             shedlock_locks
              ▼                                       ▼
┌─────────────────────────────────────────────────────────────────┐
│  Oracle 23c FREEPDB1 (sibling rectrace-local-dev compose)       │
│  schema/01-rectrace.sql defines all tables — no changes         │
└─────────────────────────────────────────────────────────────────┘
              │                                       │
              │ ES read (search via                ES write (alias-only)
              │ rectrace_core_alias)               via rectrace_core_alias
              ▼                                       ▼
┌─────────────────────────────────────────────────────────────────┐
│  Elasticsearch 8.13.4 — rectrace_core_alias → versioned index   │
└─────────────────────────────────────────────────────────────────┘
```

Shared infra: Oracle schema (DDL stays in `rectrace-local-dev/`), ES indices. Zero shared Java code.

## Module identity

- **Directory**: `rectrace-loader/` (repo root, sibling of `rectrace-tlm-stats/`)
- **Maven**: `groupId=com.citi.gru.rectrace`, `artifactId=loader`, `name=rectrace-loader`, `version=0.0.1-SNAPSHOT`
- **Parent**: `spring-boot-starter-parent 3.5.14` (standalone, no parent in repo)
- **Java**: 21
- **Port**: 6089 (adjacent to backend's 6088)
- **Lombok**: NOT used — mirror `rectrace-tlm-stats`. `@Slf4j` on existing loader code rewrites to manual `Logger log = LoggerFactory.getLogger(X.class)` during the move.
- **Admin endpoint paths**: unchanged — `/api/v4/loader-admin/jobs`, `.../jobs/{key}/run-now`, `.../jobs/{key}/runs`. No consumer to break; smoke scripts only update the host port.

## File-level move map

### Leaves `backend/rectrace` (deletions in Phase 4)

| Path | Why |
|---|---|
| `src/main/java/.../loader/` (14 files: 7 top-level — DocumentIdHasher, LoaderBulkListener, LoaderConfigService, LoaderJobRegistry, LoaderRunHistoryService, LoaderTicker, OracleToEsLoaderJob; 7 DTOs — LoaderBatchConfigV4, LoaderConfigV4, LoaderJobDefV4, LoaderRunRecordV4, LoaderRunStatus, LoaderSourceConfigV4, LoaderTargetConfigV4) | Whole loader package |
| `src/main/java/.../controller/v4/LoaderAdminControllerV4.java` | Loader admin |
| `src/main/java/.../config/LoaderShedLockConfig.java` | Loader-specific wiring |
| `src/main/java/.../config/LoaderJdbcConfig.java` | Loader-specific DS |
| `src/main/java/.../dto/v4/LoaderJobSummaryV4.java` | Loader DTO |
| `src/main/java/.../dto/v4/RunNowConflictResponseV4.java` | Loader admin DTO |
| `src/main/java/.../observability/health/LoaderRunAgeHealthIndicator.java` | Loader-self-monitoring → relocates to loader module |
| `src/main/resources/loader-config-v4.json` | Loader's config catalog |
| `src/test/.../loader/` (7 test files: BulkIngesterFactoryTest, DocumentIdHasherTest, LoaderConfigServiceTest, LoaderJobLockTest, LoaderPackageStructureTest, LoaderRunHistoryServiceTest, OracleToEsLoaderJobTest) | Mirrors source move |
| `src/test/.../observability/health/LoaderRunAgeHealthIndicatorTest.java` | Mirrors source move |
| `src/test/.../controller/v4/LoaderAdminControllerV4Test.java` | Mirrors source move |

**`pom.xml` deps to prune (exactly 3, all ShedLock)**:
- `net.javacrumbs.shedlock:shedlock-spring`
- `net.javacrumbs.shedlock:shedlock-provider-jdbc-template`
- `net.javacrumbs.shedlock:shedlock-provider-inmemory` (test scope)

**Backend KEEPS** (still needed for search read-side): `spring-boot-starter-data-elasticsearch`, `co.elastic.clients:elasticsearch-java`, `micrometer-tracing-bridge-brave`, `micrometer-registry-prometheus`. Don't accidentally prune these.

**`application*.properties` prune**: one key in each file — `loader-config.location=classpath:loader-config-v4.json`. Plus the 6-line comment block at `application.properties:64-68` about the deferred loader health group.

### Created in `rectrace-loader/` (Phase 1 skeleton + Phase 3 move)

- `pom.xml` — Boot 3.5.14, Java 21; deps: spring-boot-starter-web, -actuator, -jdbc, -scheduling; ojdbc11; ShedLock-JDBC 7.7.0; co.elastic.clients elasticsearch-java BulkIngester; micrometer-tracing-bridge-brave; logstash-logback-encoder.
- `src/main/java/com/citi/gru/rectrace/loader/RectraceLoaderApplication.java` — Spring main.
- `src/main/java/com/citi/gru/rectrace/loader/*` — 14 moved files (7 top-level + 7 DTOs under `dto/`); `@Slf4j` rewritten to manual SLF4J `Logger`.
- `src/main/java/com/citi/gru/rectrace/loader/controller/LoaderAdminController.java` — moved + repackaged under loader; same `/api/v4/loader-admin/*` paths.
- `src/main/java/com/citi/gru/rectrace/loader/config/{LoaderShedLockConfig,LoaderJdbcConfig}.java` — moved.
- `src/main/java/com/citi/gru/rectrace/loader/dto/{LoaderJobSummaryV4,RunNowConflictResponseV4}.java` — consolidated under loader package.
- `src/main/java/com/citi/gru/rectrace/loader/health/LoaderRunAgeHealthIndicator.java` — self-monitoring; bean name `loaderRunAge` unchanged.
- `src/main/resources/application.properties` + `application-local.properties` — `server.port=6089`; Oracle/ES connection same as backend's local profile; `loader-config.location=classpath:loader-config-v4.json`.
- `src/main/resources/loader-config-v4.json` — moved verbatim.
- `src/main/resources/logback-spring.xml` — copy backend's profile-aware Splunk HEC pattern (loader logs ship to the same Splunk index for ops continuity).
- `src/test/...` — 9 moved test files (7 in `loader/` package + `LoaderRunAgeHealthIndicatorTest` under `loader/health/` + `LoaderAdminControllerV4Test` under `loader/controller/`); slice tests re-anchored to `RectraceLoaderApplication`; `LoaderPackageStructureTest` package set adjusted.

## Migration sequence — 6 phases

Each phase commits direct to `main` with the system in a known-good state.

### Phase 1 — SKELETON

Create `rectrace-loader/` that boots on :6089 with no loader beans. Mirror `rectrace-tlm-stats` shape (pom.xml, main class, application properties, logback). Verify: `mvn spring-boot:run -Dspring-boot.run.profiles=local` → `curl http://localhost:6089/actuator/health` → `UP`.

### Phase 2 — BACKEND LOADER OFF (no code move)

Add `rectrace.loader.enabled` property in backend's `application.properties` (default `true` preserves current behavior). Gate every backend loader bean (Ticker, JobRegistry, ShedLockConfig, LoaderAdminController, health indicator) with `@ConditionalOnProperty("rectrace.loader.enabled", havingValue="true", matchIfMissing=true)`. Flip to `false` in local profile. Verify:

- Backend boots clean with flag off.
- `GET /api/v4/loader-admin/jobs` returns 404 (controller bean absent).
- `/actuator/health` UP (no `loaderRunAge` indicator active).
- Search still works end-to-end.

### Phase 3 — MOVE LOADER CODE INTO `rectrace-loader`

Copy all 20 main + 9 test files + `loader-config-v4.json` into the new module under package `com.citi.gru.rectrace.loader.*`. Rewrite `@Slf4j` to manual SLF4J. Re-anchor slice tests to `RectraceLoaderApplication`. Verify:

- `cd rectrace-loader && mvn test` green.
- `mvn spring-boot:run -Dspring-boot.run.profiles=local` → loader boots on :6089.
- Ticker runs; ShedLock acquires the lock; one ingestion cycle completes.
- `curl http://localhost:6089/api/v4/loader-admin/jobs` returns the job catalog.
- ES indices populate via alias; `loader_run_history` rows append.

### Phase 4 — DELETE LOADER FROM BACKEND

Delete every loader file from `backend/rectrace/` (20 main + 9 test + `loader-config-v4.json`). Remove the `@ConditionalOnProperty` flag and the property. Prune the 3 ShedLock deps from `pom.xml` (`shedlock-spring`, `shedlock-provider-jdbc-template`, `shedlock-provider-inmemory`). Prune the `loader-config.location` key + the deferred-health-group comment block from `application*.properties`. Verify:

- `cd backend/rectrace && mvn test` green; no broken imports.
- Backend boots clean on :6088.
- `GET /actuator/health` UP without `loaderRunAge`.
- Search end-to-end + cell-renderer modals unchanged.

### Phase 5 — OPS WIRING

Add `rectrace-loader` entry to `ops/components.sh` (mirror tlm-stats line: port 6089, pid_file, log_file, health url, `mvn spring-boot:run -f rectrace-loader/pom.xml -Dspring-boot.run.profiles=local`). Verify:

- `ops/rectrace-ops.sh start loader` brings up :6089.
- `ops/rectrace-ops.sh status loader` reports correctly.
- `ops/rectrace-ops.sh stop loader` shuts down cleanly.
- `ops/rectrace-ops.sh logs loader` tails the right log.
- `ops/rectrace-ops.sh start all` brings up backend + tlm-stats + loader + react all healthy.
- `ops/ci-smoke.sh` portability check passes (Bash 3.2 compliance).

### Phase 6 — SMOKE + DOCS

Repoint `scripts/smoke-loader-admin.sh` and `scripts/smoke-loader-sigterm.sh` from :6088 to :6089. Update `CLAUDE.md` module table: add `rectrace-loader | Spring Boot 3.5.14 | 6089 | Active` row; trim the backend description to mention only its read-side responsibilities; remove loader subsystem bullets from "Architecture & Key Patterns". Verify both smoke scripts end-to-end against :6089.

## Test strategy

- All 9 loader test files **move** (not copy) with their target source. Same package layout under `com.citi.gru.rectrace.loader.*` (7 files), `loader.health.*` (1 file), `loader.controller.*` (1 file).
- Slice tests (`LoaderJobLockTest`, `OracleToEsLoaderJobTest`, `LoaderRunHistoryServiceTest`) using `@SpringBootTest` re-anchor to `RectraceLoaderApplication` and use the loader module's test profile.
- `LoaderPackageStructureTest` ArchUnit-style package assertions update for the new module's package set.
- `BulkIngesterFactoryTest` moves with `OracleToEsLoaderJob` (the inline BulkIngester construction it exercises).
- Backend gains zero new tests (loses 9). Backend's existing test suite must stay green after Phase 4 with no loader-related imports.

## Verification matrix

| Phase | Per-phase gate |
|---|---|
| 1 | rectrace-loader `mvn test` green; `:6089/actuator/health` UP |
| 2 | Backend boots with flag off; loader-admin 404; search works; tests green |
| 3 | rectrace-loader `mvn test` green; ticker runs; ingestion cycle completes; loader-admin returns jobs |
| 4 | Backend `mvn test` green; backend boots; search works; cell-renderer modals work |
| 5 | All `rectrace-ops.sh` subcommands work for `loader`; `start all` brings up everything healthy |
| 6 | Both smoke scripts pass against :6089; CLAUDE.md table reflects reality |

**Final acceptance** (after Phase 6):

- `ops/rectrace-ops.sh start all` → 4 services healthy.
- `scripts/smoke-loader-admin.sh` PASS against :6089.
- `scripts/smoke-loader-sigterm.sh` PASS (graceful shutdown + ShedLock release).
- `cd rectrace-local-dev && .venv/bin/python apply.py --volume 100` re-seeds clean; loader picks up the seed; backend `?q=tlm` returns expected rows.
- Backend log clean of any `Loader*` references.

## Out of scope (deliberately)

- **Phase 9 auth on loader admin endpoints**. Today admin paths log `x-citiportal-loginid` without enforcing. Same posture stays after extraction; Phase 9 will gate both modules' admin surfaces simultaneously.
- **CORS on loader**. Admin endpoints have no browser consumer. Loader does not need `app.cors.allowed-origins`. Phase 9 may revisit.
- **Splunk HEC routing differentiation**. Loader logs ship to the same Splunk index as backend with `service=rectrace-loader` field. Splitting indices is an ops decision deferrable to Citi deployment.
- **Prometheus scrape config changes**. Adding `rectrace-loader` as a scrape target belongs to the deployment manifests (not in this monorepo). Out of scope here.
- **Schema changes**. `loader_run_history` + `shedlock_locks` already exist in `rectrace-local-dev/schema/01-rectrace.sql`. No DDL changes.
- **Multi-instance loader scaling**. ShedLock already supports it; running N=1 today, will run N=1 after extraction. N>1 is a future ops decision.
- **Loader admin UI in React**. Today loader-admin has no UI; just smoke-script consumers. Building a UI is unrelated work.
- **Phase 8 DESIGN-01/02/03 + recviz integration**. Independent track.

## Rollback

Each phase is independently revertible (`git revert <sha>`). Most damaging failure mode: Phase 4 deletes backend's loader and Phase 3 was actually broken. Mitigation: Phase 3's verification includes a full ingestion cycle on :6089 with `loader_run_history` rows appended — Phase 4 won't ship without that evidence. If something post-merge surfaces, revert Phases 4-6, restore `rectrace.loader.enabled=true` in backend → full pre-extraction behavior restored within minutes.

## Effort

~1-2 days end-to-end if executed as 6 subagent-driven tasks with `feature-dev:code-reviewer` between phases. Largest single phase is Phase 3 (code move + slice-test re-anchor + manual run verification). Smallest is Phase 5 (one line in `ops/components.sh`).
