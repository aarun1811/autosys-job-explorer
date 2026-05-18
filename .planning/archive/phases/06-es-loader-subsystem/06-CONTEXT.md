# Phase 6: ES Loader Subsystem — Context

**Gathered:** 2026-05-17
**Status:** Ready for planning
**Source:** Autonomous mode — `workflow.skip_discuss=true`; ROADMAP + REQUIREMENTS + research are the spec. Decisions D-6.x marked `[NEEDS USER REVIEW]` where I exercised judgment.

<domain>
## Phase Boundary

A new configuration-driven Oracle→Elasticsearch loader subsystem inside `backend/rectrace`. Devs/admins declare loader jobs in JSON config (source `SELECT` + target ES alias + cron schedule + batch size). The application runs them on schedule, persists per-run history, and exposes an admin API.

Five hard requirements (success criteria SC1–SC5):
1. Config-driven multi-job scheduling.
2. Idempotent upserts via deterministic `_id` derived from source primary key; ES writes go via **alias** never literal index name.
3. Admin API: list jobs, run-now, last-20-runs history.
4. Graceful shutdown — JVM signal flushes in-flight bulk requests, no partial-batch loss.
5. `BulkProcessor` with sane defaults (5000 rows / 5 MB / 5 s), tunable per job.
</domain>

<decisions>
## Implementation Decisions

### Scheduler — LOCKED (D-6.0)

**`@Scheduled + ShedLock 5.x`** for in-built scheduling.

Rationale:
- Single-instance Citi VM deployment per CLAUDE.md → ShedLock's DB-row locking is sufficient (Quartz JDBC JobStore is overkill).
- Quartz JobStore requires 11+ tables, triggers, blob-serialized JobDetail/Trigger payloads, version migrations — significant operational surface for a 10-line cron need.
- ShedLock 5.x: one `shedlock` table, Spring `@Scheduled` cron syntax, `@SchedulerLock` annotation. Simpler boot, simpler debug.
- Quartz wins only at very high job counts (>50) or sub-second scheduling — neither applies here.

If you disagree on return, swap `@Scheduled + ShedLock` for Quartz at the boundary `LoaderJobRegistry` — the per-job execution logic stays the same.

### Locked from ROADMAP / REQUIREMENTS

- **D-6.1**: Multi-job config in `loader-config-v4.json` at `backend/rectrace/src/main/resources/`. Each job: `{ key, source: { datasource, query, primaryKey }, target: { alias, batch: { rows, bytes, flushMs } }, schedule: "cron-expr" }` (LOADER-01).
- **D-6.2**: ShedLock 5.x; `@Scheduled` on each job; `@SchedulerLock(name=jobKey, lockAtMostFor="PT55M", lockAtLeastFor="PT5S")` (LOADER-02).
- **D-6.3**: ES writes via **alias** only — `_index` parameter on every bulk request is `target.alias` from config; loader fails-fast at config load if alias does not exist (LOADER-03).
- **D-6.4**: Deterministic `_id`: hash of `primaryKey` column values from source row → SHA-256 hex first 16 chars (idempotent upserts; collision-resistant enough for internal data) (LOADER-04). Actual hash algorithm marked `[NEEDS USER REVIEW]` — concat is simpler but reveals PK in `_id`; hashed is opaque.
- **D-6.5**: Package layout `com.citi.gru.rectrace.loader` with: `LoaderConfigService` (load+validate JSON), `LoaderJobRegistry` (instantiate jobs at boot), `OracleToEsLoaderJob` (one instance per configured job), `LoaderRunHistoryService` (persistence + retrieval) (LOADER-05).
- **D-6.6**: Per-run state schema in Oracle table `loader_run_history` columns: `job_key VARCHAR2(64)`, `started_at TIMESTAMP`, `finished_at TIMESTAMP NULL`, `status VARCHAR2(16)` (`running`/`success`/`failed`), `row_count NUMBER NULL`, `last_error CLOB NULL`, `duration_ms NUMBER NULL`. PK: `(job_key, started_at)` (LOADER-06).
- **D-6.7**: Run history retains last 20 runs per job; older rows pruned by `LoaderRunHistoryService` after each insert (LOADER-07).
- **D-6.8**: `LoaderAdminControllerV4` at `/api/v4/loader-admin`: `GET /jobs` (list), `POST /jobs/{key}/run-now` (manual trigger), `GET /jobs/{key}/runs` (last-20 history) (LOADER-08).
- **D-6.9**: Graceful shutdown — `@PreDestroy` on `LoaderJobRegistry` calls `bulkProcessor.awaitClose(30, SECONDS)` on each active processor; tested via integration test sending SIGTERM mid-batch (LOADER-09).
- **D-6.10**: `BulkProcessor` defaults from REST high-level client (existing dep in Phase 1): `bulkActions=5000`, `bulkSize=5 MB`, `flushInterval=5 s`, `concurrentRequests=1`; per-job overrides via config (LOADER-10).

### Claude's Discretion (NEEDS USER REVIEW on return)

- **D-6.11** [judgment]: Hash algorithm for `_id` is SHA-256 hex first 16 chars. Alternative: full SHA-256 hex (longer but no collision risk). For internal-only data and rectrace_core's small row counts, 16 chars is sufficient.
- **D-6.12** [judgment]: ShedLock locks in the SAME Oracle DB as `rectrace_core` (using the existing primary datasource). Alternative: dedicated `shedlock` table in a different schema/account. Same-DB is simpler and consistent.
- **D-6.13** [judgment]: Admin endpoint authZ deferred to Phase 9. For now, `/api/v4/loader-admin/**` requires `x-citiportal-loginid` header (existing convention) but does NOT validate against any allow-list. Document the gap.
- **D-6.14** [judgment]: Run-now endpoint queues a SHedLock-eligible run; if a scheduled run is in flight, returns 409 Conflict. Operator sees current state via `GET /runs`.
- **D-6.15** [judgment]: Example loader job for evidence: a "rectrace_core_loader" that copies `rectrace_core` to `rectrace_core_alias` (already used by `/initial`). Schedule: `0 */5 * * * *` (every 5 minutes) — frequent enough for soak testing.
- **D-6.16** [judgment]: Source datasource for loader queries reuses the existing PRIMARY datasource (NOT the Phase 5 readonly DS). Reason: loader queries may be heavier and benefit from the primary pool size; the readonly DS is for end-user SQL tabs only.
- **D-6.17** [judgment]: ShedLock 5.16.0 (latest stable as of 2026-05-17). Java 21 + SB 3.5 compatible.

### What this phase does NOT do

- No frontend changes.
- No new datasource — reuses primary.
- No security on the admin endpoint (deferred to Phase 9).
- No Phase 0.1-style sibling-repo seed change unless the test-harness needs it.

</decisions>

<canonical_refs>
## Canonical References

### Existing patterns to mirror

- `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/DataSourceConfig.java` — primary DS bean (reuse for loader source)
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/SearchConfigServiceV4.java` — `@PostConstruct` config-load pattern (mirror for `LoaderConfigService`)
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v4/SearchServiceV4.java` — Async pattern, RestHighLevelClient usage
- `backend/rectrace/pom.xml` — existing `spring-boot-starter-data-elasticsearch` brings `BulkProcessor`
- Existing `EsSearchProvider` / `ElasticsearchServiceV4` for ES client patterns
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/RectraceApplication.java` — `@EnableAsync`; we'll also `@EnableScheduling`

### External — new deps to add to pom.xml

- `net.javacrumbs.shedlock:shedlock-spring:5.16.0`
- `net.javacrumbs.shedlock:shedlock-provider-jdbc-template:5.16.0`
- Elasticsearch BulkProcessor — already on classpath via `spring-boot-starter-data-elasticsearch` from Phase 1

</canonical_refs>

<specifics>
## Specific Ideas

- The `loader_run_history` DDL must be added to `rectrace-local-dev/schema/01-rectrace.sql` for local testing.
- The `shedlock` table DDL must also be added — schema per ShedLock docs (Oracle dialect).
- The "alias check at boot" should issue a `HEAD /<alias>` ES request and fail-loud if 404.
- For idempotent upsert: `client.bulk()` with `IndexRequest.id(deterministicId).source(...).opType(INDEX)` (upsert semantics by ID).

</specifics>

<deferred>
## Deferred Ideas

- AuthZ on admin endpoints — Phase 9.
- Multi-instance horizontal scaling — single-instance VM today; ShedLock supports HA if/when needed.
- Per-job dedicated thread pools — global async pool is fine for current scale.
- Schema-evolution / dynamic-mapping handling on the ES side — out of scope.

</deferred>

---

*Phase: 06-es-loader-subsystem*
*Context gathered: 2026-05-17 via autonomous mode (skip_discuss=true)*
