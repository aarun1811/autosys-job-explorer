# Phase 7: Observability Sweep — Context

**Gathered:** 2026-05-17
**Source:** Autonomous mode (`workflow.skip_discuss=true`). ROADMAP + REQUIREMENTS are the spec. D-7.x judgment calls flagged `[NEEDS USER REVIEW]` where exercised.

<domain>
## Phase Boundary

Both backend modules (`backend/rectrace`, `rectrace-tlm-stats`) and the React frontend (where relevant — correlation ID only) get a coherent observability layer:

1. **Structured JSON logs** with `traceId/userId/path/method/status/durationMs` via `logstash-logback-encoder` configured in `logback-spring.xml`.
2. **Custom `HealthIndicator` beans** at `/actuator/health` (Oracle, ES, loader-run-age, search-config validity).
3. **Locked-down actuator** (explicit allow-list, no wildcards, `show-details=when-authorized` or `never`).
4. **Slow-query log line** via `@Timed`/AOP for JdbcTemplate + ES calls exceeding a configurable threshold.
5. **Prometheus metrics** at `/actuator/prometheus` via `micrometer-registry-prometheus`.
6. **Correlation ID propagation** through `@Async` (`TaskDecorator`), scheduler jobs (fresh `traceId` per fire), and `ScriptExecutor` subprocess invocations.
7. **Log aggregator forwarder** wired to a target (Splunk / ELK / Loki / OTel — locked below).
8. **Micrometer Tracing** (SB 3 native) replaces hand-rolled correlation ID filter where applicable.
</domain>

<decisions>
## Implementation Decisions

### Log aggregator target — LOCKED (D-7.0)

**`Splunk HEC`-compatible JSON event shape with a local `appender-no-op` fallback** for local-dev and CI; production Splunk HEC URL + token configured via `application-prod.properties` (placeholder values `[NEEDS USER REVIEW]`).

Rationale:
- Citi enterprise standard is Splunk per CLAUDE.md context (internal app, VM-deployed). ELK / Loki are unlikely targets given Citi infrastructure conventions.
- `logstash-logback-encoder`'s JSON output is Splunk HEC compatible directly (HEC-style `event`/`source`/`sourcetype` fields).
- Local-dev does NOT have a Splunk endpoint → use a no-op appender so the logback config is identical across environments.
- The actual Splunk HEC URL + token are Citi-VM secrets the user must fill in.

If you disagree on return, swap the appender — `logback-spring.xml` is the only file that needs to change.

### Locked from ROADMAP / REQUIREMENTS

- **D-7.1**: `logstash-logback-encoder` 8.0 (post-Phase-1; verified Java 21 compatible). In `backend/rectrace` AND `rectrace-tlm-stats`. Configuration in `logback-spring.xml` (NOT `logback.xml`). JSON layout with MDC keys `traceId`, `userId`, `path`, `method`, `status`, `durationMs` (OBS-01).
- **D-7.2**: Four `HealthIndicator` beans (OBS-02):
  - `OracleHealthIndicator` — `SELECT 1 FROM DUAL` against primary DS, returns DOWN with error message on failure
  - `ElasticsearchHealthIndicator` — `ElasticsearchClient.ping()` (use `co.elastic.clients` API)
  - `LoaderRunAgeHealthIndicator` — DOWN if any configured job's most-recent successful run is older than `2 × cron-interval`
  - `SearchConfigHealthIndicator` — DOWN if `SearchConfigServiceV4`/`SqlSearchConfigServiceV4` failed startup validation (which would have already prevented boot, but as a status reporter)
- **D-7.3**: Actuator exposure list (OBS-03): `health`, `info`, `prometheus`, `loggers`, `metrics`. NO `*`, NO `env` (leaks secrets), NO `heapdump`, NO `shutdown`. `management.endpoint.health.show-details=when-authorized`.
- **D-7.4**: Slow-query AOP (OBS-04). One `@Aspect` bean `SlowQueryLoggerAspect` matching execution of `JdbcOperations.query*`, `JdbcOperations.update*`, and methods annotated `@SlowLog`. Threshold default 500ms; configurable via `observability.slow-query-threshold-ms`. Logs at WARN with bind args (truncated to 200 chars per arg).
- **D-7.5**: Prometheus metrics (OBS-05). `micrometer-registry-prometheus` dep; `@Timed` annotations applied selectively to controllers and key service methods. JVM + Hikari + Tomcat metrics auto-registered by Spring Boot.
- **D-7.6**: Correlation ID propagation (OBS-06):
  - HTTP layer already has correlation ID per Phase 2 D-2.10 (`X-Correlation-Id` accepted, propagated to MDC).
  - `@Async`: `TaskDecorator` that copies MDC from the calling thread to the async thread. Bean wired in `AsyncConfig`.
  - Scheduler: `LoaderTicker` and any other `@Scheduled` methods get a fresh `traceId` per fire (UUID, 32 hex chars, no dashes — match HTTP layer format).
  - `ScriptExecutor`: pass `X-Correlation-Id` to subprocess via env var `RECTRACE_CORRELATION_ID`; the script can echo it back in its output for log correlation.
- **D-7.7**: Log forwarder (OBS-07): Splunk HEC; local-dev = no-op `ConsoleAppender`. Production = `LogstashTcpSocketAppender` pointing at `${splunk.hec.host}:${splunk.hec.port}` with Splunk HEC token in `application-prod.properties` `[NEEDS USER REVIEW]`.
- **D-7.8**: Micrometer (OBS-08): pinned by Spring Boot 3.5.14 BOM (≥1.14 transitively). CI guard added to `pom.xml` as `<requireUpperBoundDeps/>` enforcer rule that fails if any sub-dep tries to override Micrometer. Micrometer Tracing native replaces the hand-rolled correlation ID filter wherever idiomatic — but keep the existing `X-Correlation-Id` header for backward compatibility with the React app's existing `apiFetch`.

### Claude's Discretion (NEEDS USER REVIEW)

- **D-7.9** [judgment]: 500ms slow-query threshold default. Configurable.
- **D-7.10** [judgment]: 32-char hex traceId (no dashes) — matches Phase 2 React `apiFetch` convention (`crypto.randomUUID().replace(/-/g, '')`).
- **D-7.11** [judgment]: `userId` MDC key sourced from `x-citiportal-loginid` request header. Phase 9 may replace this with proper auth; for now mirror the existing convention.
- **D-7.12** [judgment]: Loader-run-age health indicator threshold: 2× cron interval (configurable). E.g., a 5-min cron job → DOWN if last success > 10 min ago.
- **D-7.13** [judgment]: Slow-query log line is WARN not ERROR. WARN avoids paging on legitimate-but-slow queries; ERROR is reserved for true failures.
- **D-7.14** [judgment]: `application-prod.properties` Splunk HEC fields are placeholders (`splunk.hec.host=splunk.citi.intra.example`, `splunk.hec.token=<TO_BE_FILLED>`). Real values are Citi-VM deployment-time secrets.

### What this phase does NOT do

- No frontend changes.
- No authZ — actuator endpoints are simply locked-down by exposure list; auth-bound exposure is Phase 9.
- No alerting rules — Prometheus metrics are emitted; PromQL alerts are out of scope.

</decisions>

<canonical_refs>
## Canonical References

- `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/AsyncConfig.java` — TaskDecorator goes here
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/util/ScriptExecutor.java` — subprocess env var injection
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/loader/LoaderTicker.java` — scheduler traceId injection
- `backend/rectrace/src/main/resources/application.properties` — actuator exposure config
- `backend/rectrace/pom.xml` — `logstash-logback-encoder`, `micrometer-registry-prometheus` deps
- `rectrace-tlm-stats/pom.xml` — same deps for the second module

</canonical_refs>

<deferred>
## Deferred Ideas

- Per-tenant log shards — N/A for single-tenant internal app.
- Distributed tracing across services (Zipkin/Jaeger) — Micrometer Tracing emits spans but no collector wired. Out of scope.
- Alerting rules — Prometheus output is enough; PromQL alerts are operator-owned.

</deferred>

---

*Phase: 07-observability-sweep*
*Context gathered: 2026-05-17 via autonomous mode*
