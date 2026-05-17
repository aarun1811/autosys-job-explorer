---
phase: 06-es-loader-subsystem
plan: 02
subsystem: es-loader
tags: [shedlock, pom, junit5, wave-0-tests, dependencies, scaffold]
dependency_graph:
  requires:
    - "Phase 6 Plan 01 (rectrace-local-dev sub-repo with shedlock + loader_run_history DDL)"
    - "Phase 1 Boot Upgrade (Spring Boot 3.5.14, Java 21)"
    - "Phase 5 SQL-VAL infrastructure (Wave-0 @Disabled scaffold convention)"
  provides:
    - "ShedLock 7.7.0 (shedlock-spring + shedlock-provider-jdbc-template) on backend classpath"
    - "spring.lifecycle.timeout-per-shutdown-phase=60s (Pitfall L3 mitigation)"
    - "Seven @Disabled JUnit 5 test classes locking LOADER-01/02/04/05/06/07/08/10 contracts"
  affects:
    - "Plan 06-03 (enables LoaderConfigServiceTest, DocumentIdHasherTest, LoaderRunHistoryServiceTest, 4 of LoaderPackageStructureTest)"
    - "Plan 06-04 (enables LoaderJobLockTest, BulkIngesterFactoryTest, 2 of LoaderPackageStructureTest)"
    - "Plan 06-05 (enables LoaderAdminControllerV4Test)"
tech_stack:
  added:
    - "net.javacrumbs.shedlock:shedlock-spring 7.7.0 (compile)"
    - "net.javacrumbs.shedlock:shedlock-provider-jdbc-template 7.7.0 (compile)"
    - "Transitive: shedlock-core 7.7.0, shedlock-sql-support 7.7.0"
  patterns:
    - "Pinned-version (no property variable) for new deps — mirrors Phase 5 jsqlparser convention"
    - "Class-level @Disabled on Wave-0 scaffolds (one annotation per file, not per method)"
    - "Reflective Class.forName presence assertions for cheap structure gates (LoaderPackageStructureTest)"
key_files:
  created:
    - "backend/rectrace/src/test/java/com/citi/gru/rectrace/loader/LoaderConfigServiceTest.java"
    - "backend/rectrace/src/test/java/com/citi/gru/rectrace/loader/LoaderJobLockTest.java"
    - "backend/rectrace/src/test/java/com/citi/gru/rectrace/loader/DocumentIdHasherTest.java"
    - "backend/rectrace/src/test/java/com/citi/gru/rectrace/loader/LoaderPackageStructureTest.java"
    - "backend/rectrace/src/test/java/com/citi/gru/rectrace/loader/LoaderRunHistoryServiceTest.java"
    - "backend/rectrace/src/test/java/com/citi/gru/rectrace/loader/BulkIngesterFactoryTest.java"
    - "backend/rectrace/src/test/java/com/citi/gru/rectrace/controller/v4/LoaderAdminControllerV4Test.java"
  modified:
    - "backend/rectrace/pom.xml"
    - "backend/rectrace/src/main/resources/application.properties"
decisions:
  - "ShedLock 7.7.0 pinned inline (no `<shedlock.version>` Maven property) — mirrors Phase 5 jsqlparser:5.3 convention. Single-version dep that does not move with Spring Boot releases."
  - "Wave-0 scaffolds use class-level @Disabled, not per-method. Plans 06-03/04/05 enable by removing the one annotation, not by editing each method. Reduces enablement diff and review surface."
  - "LoaderPackageStructureTest uses Class.forName reflection (not @SpringBootTest) — cheapest possible LOADER-05 gate, runs in <1ms when enabled."
  - "LoaderJobLockTest Javadoc explicitly notes that Plan 06-04 must provide a @TestConfiguration with an in-memory LockProvider before enabling — the production LoaderShedLockConfig will be @Profile(!test)-gated like DataSourceConfig et al."
metrics:
  duration_min: 7
  tasks_completed: 2
  files_changed: 9
  completed: 2026-05-17
---

# Phase 6 Plan 02: ShedLock Deps + Wave-0 Test Scaffolds Summary

Added ShedLock 7.7.0 to the backend classpath, set the Spring graceful-shutdown phase timeout to 60s (Pitfall L3 mitigation), and shipped seven @Disabled JUnit 5 test scaffolds that lock the LOADER-01/02/04/05/06/07/08/10 contracts at compile time so Plans 06-03/04/05 enable them progressively (Phase 5 Wave-0 pattern).

## What Changed

### Task 1 — ShedLock 7.7.0 + shutdown timeout (commit `c9f564b`)

`backend/rectrace/pom.xml` — added two dependency blocks immediately after the JSqlParser 5.3 block (same inline-comment, pinned-version style):

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

`backend/rectrace/src/main/resources/application.properties` — appended:

```
spring.lifecycle.timeout-per-shutdown-phase=60s
```

### Task 2 — Seven @Disabled Wave-0 scaffolds (commit `67e0b23`)

| # | File | Target Requirement | Enabled By | @Disabled Methods | Lines |
|---|------|--------------------|------------|-------------------|-------|
| 1 | `loader/LoaderConfigServiceTest.java` | LOADER-01 | Plan 06-03 | 4 | 60 |
| 2 | `loader/LoaderJobLockTest.java` | LOADER-02 | Plan 06-04 | 2 | 47 |
| 3 | `loader/DocumentIdHasherTest.java` | LOADER-04 (+Pitfall L5) | Plan 06-03 | 4 | 60 |
| 4 | `loader/LoaderPackageStructureTest.java` | LOADER-05 | Plans 06-03 + 06-04 | 6 | 73 |
| 5 | `loader/LoaderRunHistoryServiceTest.java` | LOADER-06, LOADER-07 | Plan 06-03 | 5 | 78 |
| 6 | `loader/BulkIngesterFactoryTest.java` | LOADER-10 | Plan 06-04 | 2 | 52 |
| 7 | `controller/v4/LoaderAdminControllerV4Test.java` | LOADER-08 (incl. D-6.14) | Plan 06-05 | 5 | 71 |
| | | | **Total** | **28** | **441** |

Every scaffold:
- declares its package matching the directory location;
- uses standard JUnit 5 imports (`org.junit.jupiter.api.Test`, `Disabled`) plus AssertJ where useful;
- carries a class-level Javadoc naming the requirement IDs, the plan that enables it, and the production class under test;
- uses **class-level** `@Disabled("Wave 0 / Plan 06-02 — enabled when …")` rather than per-method annotations (single removal during enablement);
- contains a body for each `@Test` method (an `assertThat(...)` or `fail(...)` call) that names the behavior under test — so Plans 03/04/05 only need to remove `@Disabled`, wire autowire/instantiation, and refine the assertion.

## Verification

### `mvn dependency:tree` excerpt

```
[INFO] +- com.github.jsqlparser:jsqlparser:jar:5.3:compile
[INFO] +- net.javacrumbs.shedlock:shedlock-spring:jar:7.7.0:compile
[INFO] |  +- net.javacrumbs.shedlock:shedlock-core:jar:7.7.0:compile
[INFO] +- net.javacrumbs.shedlock:shedlock-provider-jdbc-template:jar:7.7.0:compile
[INFO] |  \- net.javacrumbs.shedlock:shedlock-sql-support:jar:7.7.0:compile
```

### `mvn test` (full suite, including new scaffolds)

```
[INFO] Tests run: 49, Failures: 0, Errors: 0, Skipped: 28
[INFO] BUILD SUCCESS
```

- The 28 Skipped exactly match the 28 new `@Test` methods across the seven scaffolds (4 + 2 + 4 + 6 + 5 + 2 + 5).
- The 21 non-skipped, non-failing tests are the pre-existing Phase 1/5 suite (`ContextLoadsTest`, `ReadonlyDataSourceConfigTest`, `SqlQueryServiceV4Test`, `SqlSearchConfigServiceV4Test`, `SqlShapeValidatorTest`, `SqlValidationBootFailureTest`).

### Targeted run of new scaffolds only

```
mvn test -Dtest='Loader*Test,LoaderAdminControllerV4Test,DocumentIdHasherTest,BulkIngesterFactoryTest'
Tests run: 28, Failures: 0, Errors: 0, Skipped: 28
BUILD SUCCESS
```

### File-count gates (from plan `<automated>` block)

```
ls src/test/java/com/citi/gru/rectrace/loader/*.java        | wc -l  →  6
ls src/test/java/com/citi/gru/rectrace/controller/v4/*.java | wc -l  →  1
grep -c shedlock-spring backend/rectrace/pom.xml                     →  1
grep -c shedlock-provider-jdbc-template backend/rectrace/pom.xml     →  1
grep -c spring.lifecycle.timeout-per-shutdown-phase=60s …properties  →  1
```

All five gates pass.

## Deviations from Plan

None — plan executed exactly as written.

One **process** incident worth recording (no code/spec drift): the first attempt at Task 1 used absolute paths rooted at `/Users/aarun/Workspace/Projects/autosys-job-explorer/backend/rectrace/...` which resolved to the **main repo**, not the worktree (issue #3099 — absolute-path containment failure inside Claude Code worktrees). The main repo's pom.xml and application.properties were edited briefly, then restored via `git -C <main-repo> checkout -- <files>` before any commit. All Task 1 work was re-applied to the worktree-rooted paths under `/Users/aarun/Workspace/Projects/autosys-job-explorer/.claude/worktrees/agent-ab6fe644a589eed98/...` and verified with `grep -c shedlock` on **both** the worktree pom (`1`) and the main-repo pom (`0`) before committing. No commit landed on the wrong branch; the main repo's working tree is clean of any 06-02 changes (only its pre-existing untracked UAT screenshots remain).

## Threat Surface Scan

No new security-relevant surface introduced by this plan. ShedLock 7.7.0 supply-chain risk is identical to every other Maven Central dep (cross-cutting Phase 9 SEC-06 mitigation via internal Nexus). Shutdown timeout property is a self-DoS-mitigation, not a self-DoS-introduction.

## Known Stubs

The seven test classes are themselves "stubs" in the sense the plan intends — they intentionally hold no enabled assertions yet. This is the documented Wave-0 contract-lock convention (Phase 5 precedent), not a defect:

- Every method body still contains a named contract assertion (`assertThat` or `fail`) that names the requirement under test.
- The class-level `@Disabled` causes JUnit to report each as **Skipped**, not **Passed** — CI sees no false coverage.
- The class Javadoc explicitly names the plan that flips the `@Disabled` off (06-03 for 3 classes, 06-04 for 2 classes, 06-05 for 1 class, 06-03+04 jointly for `LoaderPackageStructureTest`).
- The threat register (Plan 06-02 frontmatter T-06-07) calls this out as an accepted, mitigated risk.

## Commits

- `c9f564b` — `chore(06-02): add ShedLock 7.7.0 deps + shutdown timeout`
- `67e0b23` — `test(06-02): add seven @Disabled JUnit 5 Wave-0 loader scaffolds`

## Self-Check: PASSED

All 9 modified/created file paths exist on disk in the worktree. Both commit hashes resolve via `git log`. `mvn test` BUILD SUCCESS with the expected 49/0/0/28 line.
