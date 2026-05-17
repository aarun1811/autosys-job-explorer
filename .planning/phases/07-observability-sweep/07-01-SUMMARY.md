---
phase: 07-observability-sweep
plan: 01
subsystem: observability
tags: [observability, spring-boot, logback, micrometer, prometheus, aop, test-scaffold]
dependency-graph:
  requires: []
  provides:
    - "logstash-logback-encoder:8.0 (explicit) in both backend modules"
    - "micrometer-registry-prometheus 1.15.11 (BOM-managed) in both modules"
    - "spring-boot-starter-aop 3.5.14 (BOM-managed) in both modules"
    - "13 @Disabled JUnit 5 contract scaffolds in backend/rectrace"
    - "6 @Disabled JUnit 5 contract scaffolds in rectrace-tlm-stats"
  affects: ["07-02", "07-03", "07-04", "07-05"]
tech-stack:
  added:
    - "net.logstash.logback:logstash-logback-encoder:8.0"
    - "io.micrometer:micrometer-registry-prometheus:1.15.11"
    - "org.springframework.boot:spring-boot-starter-aop:3.5.14"
    - "org.aspectj:aspectjweaver:1.9.25.1 (transitive)"
  patterns:
    - "Wave-0 @Disabled scaffolds — test bodies complete; Plans 02/03/04 mechanically remove @Disabled"
    - "Forward-declared inner-stub HealthIndicator classes — Plan 03 replaces with imports of real main-source classes"
    - "Synthetic @TestConfiguration beans for @Async / @Scheduled aspects so the test owns the proxy boundary, not a profile-scanned bean"
key-files:
  created:
    - backend/rectrace/src/test/java/com/citi/gru/rectrace/observability/AccessLogJsonShapeTest.java
    - backend/rectrace/src/test/java/com/citi/gru/rectrace/observability/LogbackProdProfileTest.java
    - backend/rectrace/src/test/java/com/citi/gru/rectrace/observability/ActuatorHealthIntegrationTest.java
    - backend/rectrace/src/test/java/com/citi/gru/rectrace/observability/ActuatorExposureTest.java
    - backend/rectrace/src/test/java/com/citi/gru/rectrace/observability/PrometheusEndpointTest.java
    - backend/rectrace/src/test/java/com/citi/gru/rectrace/observability/AsyncMdcPropagationTest.java
    - backend/rectrace/src/test/java/com/citi/gru/rectrace/observability/aop/SlowQueryLoggerAspectTest.java
    - backend/rectrace/src/test/java/com/citi/gru/rectrace/observability/aop/ScheduledTraceIdAspectTest.java
    - backend/rectrace/src/test/java/com/citi/gru/rectrace/observability/health/OracleHealthIndicatorTest.java
    - backend/rectrace/src/test/java/com/citi/gru/rectrace/observability/health/ElasticsearchHealthIndicatorTest.java
    - backend/rectrace/src/test/java/com/citi/gru/rectrace/observability/health/LoaderRunAgeHealthIndicatorTest.java
    - backend/rectrace/src/test/java/com/citi/gru/rectrace/observability/health/SearchConfigHealthIndicatorTest.java
    - backend/rectrace/src/test/java/com/citi/gru/rectrace/util/ScriptExecutorEnvVarTest.java
    - rectrace-tlm-stats/src/test/java/com/citi/gru/rectrace/tlmstats/observability/AccessLogJsonShapeTest.java
    - rectrace-tlm-stats/src/test/java/com/citi/gru/rectrace/tlmstats/observability/ActuatorHealthIntegrationTest.java
    - rectrace-tlm-stats/src/test/java/com/citi/gru/rectrace/tlmstats/observability/ActuatorExposureTest.java
    - rectrace-tlm-stats/src/test/java/com/citi/gru/rectrace/tlmstats/observability/PrometheusEndpointTest.java
    - rectrace-tlm-stats/src/test/java/com/citi/gru/rectrace/tlmstats/observability/AsyncMdcPropagationTest.java
    - rectrace-tlm-stats/src/test/java/com/citi/gru/rectrace/tlmstats/observability/health/OracleHealthIndicatorTest.java
  modified:
    - backend/rectrace/pom.xml
    - rectrace-tlm-stats/pom.xml
decisions:
  - "logstash-logback-encoder pinned to 8.0 (per D-7.1) — explicit version, NOT BOM-managed; 9.0 would pull Jackson 3 and collide with Boot 3.5.14"
  - "micrometer-registry-prometheus left BOM-managed — resolves to 1.15.11 transitively"
  - "spring-boot-starter-aop left BOM-managed — version 3.5.14; pulls aspectjweaver 1.9.25.1"
  - "Forward-declared inner-stub indicator classes used so Wave-0 tests compile before Plan 03 lands real main-source impls; Plan 03 mechanically deletes the stubs and adds imports"
  - "tlm-stats scaffold footprint deliberately fixed at 6 — no slow-query scaffold here; Plan 07-04 decides whether to port the aspect (per A3)"
metrics:
  duration: ~17 min (executor wall-clock; includes recovery from cwd-drift incident)
  completed: 2026-05-17
  tasks_completed: 3
  files_created: 19
  files_modified: 2
  commits: 3
---

# Phase 7 Plan 01: Phase 7 Dependency Floor + Wave-0 Contract Scaffolds Summary

Two POMs gained three observability dependencies (logstash-logback-encoder 8.0 pinned, micrometer-registry-prometheus and spring-boot-starter-aop BOM-managed) and nineteen `@Disabled` JUnit 5 contract scaffolds landed across both backend modules — locking the executable specs that Plans 07-02/03/04 will satisfy by mechanically removing one `@Disabled` annotation per file.

## What Landed

### POM Changes (`chore(07-01): add observability deps to both backend POMs`, commit `0a5d83a`)

| Artifact | Module | Version | Source |
|---|---|---|---|
| `net.logstash.logback:logstash-logback-encoder` | both | `8.0` | explicit pin (D-7.1) |
| `io.micrometer:micrometer-registry-prometheus` | both | `1.15.11` | BOM-managed (Boot 3.5.14) |
| `org.springframework.boot:spring-boot-starter-aop` | both | `3.5.14` | BOM-managed |
| `org.aspectj:aspectjweaver` | both | `1.9.25.1` | transitive via starter-aop |

Verified by `mvn dependency:tree`:
- `+- net.logstash.logback:logstash-logback-encoder:jar:8.0:compile`
- `+- io.micrometer:micrometer-registry-prometheus:jar:1.15.11:compile`
- `\- org.springframework.boot:spring-boot-starter-aop:jar:3.5.14:compile`
- `   \- org.aspectj:aspectjweaver:jar:1.9.25.1:compile`

Jackson is on **2.21.2** transitively (no Jackson 3 leak — encoder 9.0 would have introduced one).

### Backend/rectrace Scaffolds (`test(07-01): add 13 @Disabled OBS-01/04/05 contract scaffolds for backend/rectrace`, commit `99d1826`)

| File | Enabled by | Tests | Contract |
|---|---|---|---|
| `observability/AccessLogJsonShapeTest.java` | Plan 02 | 1 | OBS-01 MDC keys |
| `observability/LogbackProdProfileTest.java` | Plan 02 | 1 | OBS-01/OBS-07 prod appender |
| `observability/ActuatorHealthIntegrationTest.java` | Plan 03 | 2 | OBS-02 aggregation + separate loader group |
| `observability/ActuatorExposureTest.java` | Plan 02 | 2 | OBS-03 allow/deny lists |
| `observability/PrometheusEndpointTest.java` | Plan 03 | 1 | OBS-05 content-type + metric names |
| `observability/AsyncMdcPropagationTest.java` | Plan 03 | 1 | OBS-06 MDC over `@Async("taskExecutor")` |
| `observability/aop/SlowQueryLoggerAspectTest.java` | Plan 03 | 2 | OBS-04 over/under threshold (Pitfall P-6) |
| `observability/aop/ScheduledTraceIdAspectTest.java` | Plan 03 | 2 | OBS-06 fresh traceId per fire (D-7.10) |
| `observability/health/OracleHealthIndicatorTest.java` | Plan 03 | 2 | OBS-02 UP/DOWN |
| `observability/health/ElasticsearchHealthIndicatorTest.java` | Plan 03 | 2 | OBS-02 ping UP/DOWN |
| `observability/health/LoaderRunAgeHealthIndicatorTest.java` | Plan 03 | 2 | OBS-02 2× cron threshold |
| `observability/health/SearchConfigHealthIndicatorTest.java` | Plan 03 | 3 | OBS-02 V4 + SQL service load state |
| `util/ScriptExecutorEnvVarTest.java` | Plan 03 | 2 | OBS-06 `RECTRACE_CORRELATION_ID` env-var propagation |

Total: **13 classes, 23 test methods**. `mvn test` → `Tests run: 23, Failures: 0, Errors: 0, Skipped: 23`.

### TLM-stats Scaffolds (`test(07-01): add 6 @Disabled OBS contract scaffolds for rectrace-tlm-stats`, commit `bd127f2`)

| File | Enabled by | Tests | Contract |
|---|---|---|---|
| `observability/AccessLogJsonShapeTest.java` | Plan 04 | 1 | OBS-01 MDC keys |
| `observability/ActuatorHealthIntegrationTest.java` | Plan 04 | 1 | OBS-02 Oracle-only (Open Q9) |
| `observability/ActuatorExposureTest.java` | Plan 04 | 2 | OBS-03 |
| `observability/PrometheusEndpointTest.java` | Plan 04 | 1 | OBS-05 (no Hikari assertion — DS topology differs) |
| `observability/AsyncMdcPropagationTest.java` | Plan 04 | 1 | OBS-06 (synthetic `@Async` since tlm-stats has none today) |
| `observability/health/OracleHealthIndicatorTest.java` | Plan 04 | 2 | OBS-02 reconmgmt DS UP/DOWN |

Total: **6 classes, 8 test methods**. `mvn test` → `Tests run: 8, Failures: 0, Errors: 0, Skipped: 8`.

## Verification Results

| Check | Result |
|---|---|
| `mvn -DskipTests package` (backend) | BUILD SUCCESS |
| `mvn -DskipTests package` (tlm-stats) | BUILD SUCCESS |
| `mvn dependency:tree` shows all 3 new artifacts (backend) | Yes — 8.0 / 1.15.11 / 3.5.14 |
| `mvn dependency:tree` shows all 3 new artifacts (tlm-stats) | Yes — 8.0 / 1.15.11 / 3.5.14 |
| Jackson 3 leak | None — `jackson-core:jar:2.21.2:compile` |
| Backend scaffold test run | 23/23 skipped, 0 failures, 0 errors |
| TLM-stats scaffold test run | 8/8 skipped, 0 failures, 0 errors |
| Class-level `@Disabled` annotation count | 13 backend + 6 tlm-stats = 19 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Iterator generic-type mismatch in LogbackProdProfileTest**

- **Found during:** Task 2 compile phase
- **Issue:** `root.iteratorForAppenders()` returns `Iterator<Appender<ILoggingEvent>>` not `Iterator<Appender<?>>` — initial draft used the wildcard variant and javac rejected it.
- **Fix:** Imported `ch.qos.logback.classic.spi.ILoggingEvent` and tightened the loop's iterator type parameter to match the source declaration.
- **Files modified:** `backend/rectrace/src/test/java/com/citi/gru/rectrace/observability/LogbackProdProfileTest.java`
- **Commit:** `99d1826` (folded into Task 2 commit)

**2. [Rule 3 — Blocking] SearchConfigServiceV4 / SqlSearchConfigServiceV4 do not expose `getCategoryNames()`**

- **Found during:** Task 2 design phase (pre-compile inspection)
- **Issue:** Plan's `<behavior>` block specified `Mockito-mocked SearchConfigServiceV4 / SqlSearchConfigServiceV4 returning `non-empty categories`. The actual main-source method names are `getCategories(): List<CategoryConfigV4>` and `getTabs(): List<SqlTabConfigV4>`.
- **Fix:** SearchConfigHealthIndicatorTest now stubs the real method names and asserts on their (mocked) collection emptiness. Test contract semantics unchanged.
- **Files modified:** `backend/rectrace/src/test/java/com/citi/gru/rectrace/observability/health/SearchConfigHealthIndicatorTest.java`
- **Commit:** `99d1826`

### Forward-declared inner-class stubs (intentional pattern)

Health indicator scaffolds (`OracleHealthIndicatorTest`, `ElasticsearchHealthIndicatorTest`, `LoaderRunAgeHealthIndicatorTest`, `SearchConfigHealthIndicatorTest`) declare inner static `*HealthIndicator` classes inside the test file. This is deliberate: the real main-source classes do not exist yet — Plan 07-03 (backend) / Plan 07-04 (tlm-stats) creates them. The inner stubs let the scaffold compile today; when Plan 03/04 lands the real classes, they mechanically delete the inner stub and add an `import` line. Each inner stub is documented with a Javadoc reference to its owning future plan.

Same pattern applied to `CapturingScriptExecutor` (subclass of real `ScriptExecutor`) in `ScriptExecutorEnvVarTest`.

## Authentication Gates

None — all work was local Maven and file creation.

## Process Incident: cwd-drift During Task 1 Commit

The Task 1 dependency commit (`c01058f`) initially landed on `milestone/modernization` in the main repo rather than the worktree-agent branch, due to cwd-drift: a prior `cd /Users/aarun/Workspace/Projects/autosys-job-explorer/backend/rectrace` Bash call had moved the shell into the main repo (its CWD-reset semantics meant subsequent commits ran from the main-repo working tree).

**Resolution path taken:**
1. Did **NOT** force-rewind `milestone/modernization` (per absolute prohibition #2924).
2. Cherry-picked the stray commit onto the worktree-agent branch as `0a5d83a` (identical content; non-destructive on both branches).
3. Leftover commit on `milestone/modernization` will be a no-op during the eventual merge-back (orchestrator-level reconciliation).
4. Switched all subsequent commands to absolute paths via `git -C <WT_ROOT>` and avoided plain `cd` for git operations.

This was an **executor-side process error**, not a plan defect, and it was contained without destroying any work or rewriting protected refs.

## Known Stubs

The inner forward-declared `*HealthIndicator` classes (4 in backend, 1 in tlm-stats) and `CapturingScriptExecutor` are explicit stubs documented in their files. Each Javadoc cites the plan that will replace it. These are not "leaked stubs" — they are Wave-0 scaffolds by design.

No UI / data-rendering stubs exist (this plan touches only test sources and POMs).

## Threat Flags

None — this plan added no new network endpoints, no new auth paths, no file-access patterns, and no schema changes at trust boundaries. The threat register entries in 07-01-PLAN.md remain accurate.

## Self-Check: PASSED

- All 19 scaffold files exist at the documented paths (verified via `git log --stat` on commits `99d1826` and `bd127f2`).
- All 3 task commits present on `worktree-agent-a797b2624aec1d845`: `0a5d83a`, `99d1826`, `bd127f2`.
- Both module test suites compile and run; `Tests run: 23/8, Failures: 0, Errors: 0, Skipped: 23/8` confirmed.
- Both module packages build (`mvn -DskipTests package` BUILD SUCCESS).
- Dependency tree confirms `logstash-logback-encoder:8.0` (exact), `micrometer-registry-prometheus:1.15.11` (BOM), `spring-boot-starter-aop:3.5.14` (BOM) in both modules.
