---
phase: 05-config-driven-select
plan: 03
subsystem: backend/config
tags: [datasource, hikari, jsqlparser, readonly, sql-tab]
dependency_graph:
  requires: [05-01, 05-02]
  provides: [readonlyDataSource bean, readonlyJdbcTemplate bean, jsqlparser-5.3-on-classpath]
  affects: [SqlQueryServiceV4 (Wave 3), SqlValidatorService (Wave 3)]
tech_stack:
  added:
    - com.github.jsqlparser:jsqlparser:5.3 (compile)
  patterns:
    - "@Profile(\"!test\") guard mirrors DataSourceConfig / AutosysDataSourceConfig"
    - "BOOT-08 dual-source password closure (property first, ScriptExecutor fallback)"
    - "Bare JdbcTemplate singleton — per-statement caps via StatementCallback (SQL-04)"
key_files:
  created:
    - backend/rectrace/src/main/java/com/citi/gru/rectrace/config/ReadonlyDataSourceConfig.java
  modified:
    - backend/rectrace/pom.xml
    - backend/rectrace/src/test/java/com/citi/gru/rectrace/config/ReadonlyDataSourceConfigTest.java
decisions:
  - "JSqlParser 5.3 pinned as a literal version (not ${jsqlparser.version}); single dep, no exclusions"
  - "readonlyJdbcTemplate kept deliberately bare; caps belong in SqlQueryServiceV4 per-statement"
  - "setReadOnly(true) on HikariConfig as a connection-level hint; structural defense is the DB grant matrix"
metrics:
  duration: "~25 minutes"
  completed: "2026-05-17T16:39:30+05:30"
  tasks_completed: 2
  files_changed: 3
requirements:
  - SQL-03
  - SQL-04
---

# Phase 5 Plan 03: ReadonlyDataSourceConfig + JSqlParser 5.3 Summary

One-liner: dedicated read-only Oracle pool (`rectrace_readonly`, pool=5, `setReadOnly(true)`) and bare `readonlyJdbcTemplate` land under `@Profile("!test")`, plus JSqlParser 5.3 is pinned on the compile classpath for Wave 3.

## What shipped

### Task 1 — `chore(05-03): add JSqlParser 5.3 dependency to pom.xml` (commit `d405d9b`)

Added the parser dependency to `backend/rectrace/pom.xml`, grouped immediately after the Oracle security artefacts and before the Lombok block:

```diff
+
+		<!-- Phase 5 / SQL-03: SQL grammar parser for the config-driven SELECT tab
+		     validator. Pinned to 5.3 exactly (no version variable, no range) per
+		     05-RESEARCH.md Standard Stack. -->
+		<dependency>
+			<groupId>com.github.jsqlparser</groupId>
+			<artifactId>jsqlparser</artifactId>
+			<version>5.3</version>
+		</dependency>
+
```

Verification:

- `grep -c "<artifactId>jsqlparser</artifactId>" backend/rectrace/pom.xml` → `1`
- `mvn dependency:tree -DincludeArtifactIds=jsqlparser` → `[INFO] +- com.github.jsqlparser:jsqlparser:jar:5.3:compile` (single occurrence)
- `javap -cp <compile-classpath> net.sf.jsqlparser.parser.CCJSqlParserUtil` resolves; the 5.x `parse(Reader)` signature is on classpath
- `mvn -DskipTests compile` → BUILD SUCCESS

### Task 2 — `feat(05-03): ReadonlyDataSourceConfig` (commit `9fa00f7`)

Created `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/ReadonlyDataSourceConfig.java` (111 lines):

- `@Configuration` + `@Profile("!test")` + `@Slf4j`
- `@Value` injection of `datasource.readonly.{url,username,password,driver-class-name,service-name,db-schema,hikari.maximum-pool-size,hikari.minimum-idle,hikari.connection-timeout}` with the same Spring property names Plan 02 landed in `application-local.properties`
- `@Bean(name = "readonlyDataSource")` returns a `HikariDataSource` configured with `Rectrace-Readonly-HikariCP` pool name, `setReadOnly(true)`, Oracle read/connect timeouts, and the **BOOT-08 dual-source password closure** mirrored from `DataSourceConfig` (use `${datasource.readonly.password}` when supplied, fall back to `/opt/rectify/control/scripts/get_password.sh` on Citi VMs)
- `@Bean(name = "readonlyJdbcTemplate")` returns `new JdbcTemplate(ds)` — **no** `setQueryTimeout`, `setFetchSize`, or `setMaxRows` calls. Javadoc records the SQL-04 contract: per-statement caps live in `SqlQueryServiceV4` via `StatementCallback`.

`backend/rectrace/src/test/java/com/citi/gru/rectrace/config/ReadonlyDataSourceConfigTest.java` had its `@Disabled("Wave 2: …")` annotation and unused `Disabled` import removed; the now-enabled `beanExistsUnderNonTestProfile()` test asserts (under `@ActiveProfiles("test")`) that `ctx.containsBean("readonlyDataSource")` is `false`, proving the `@Profile("!test")` guard works.

### Bean contract summary

| Bean name              | Type              | Profile     | Notes                                                                       |
|------------------------|-------------------|-------------|-----------------------------------------------------------------------------|
| `readonlyDataSource`   | `HikariDataSource`| `!test`     | pool=5 max / 1 min idle, `setReadOnly(true)`, BOOT-08 dual-source password |
| `readonlyJdbcTemplate` | `JdbcTemplate`    | `!test`     | Bare — zero setter calls; SQL-04 per-statement caps live in SqlQueryServiceV4 |

### Live boot probe

`cd backend/rectrace && mvn -q spring-boot:run -Dspring-boot.run.profiles=local`

`curl http://localhost:6088/rectrace/actuator/health` → **HTTP 200**

Captured log line from `/tmp/05-03-boot.log`:

```
2026-05-17 16:39:07.867 [main] INFO  [traceId=] c.c.g.r.c.ReadonlyDataSourceConfig - Read-only DataSource initialized (pool=5, user=rectrace_readonly)
2026-05-17 16:39:08.210 [main] INFO  [traceId=] c.c.gru.rectrace.RectraceApplication - Started RectraceApplication in 1.669 seconds (process running for 1.765)
```

This proves the bean is reachable under a non-test profile, HikariCP connects to the local Oracle as `rectrace_readonly`, and `/actuator/health` reports UP.

### SQL-04 negative gate

`grep -E "readonlyJdbcTemplate.*\.(setQueryTimeout|setFetchSize|setMaxRows)|\.setQueryTimeout\(|\.setFetchSize\(|\.setMaxRows\(" src/main/java/com/citi/gru/rectrace/config/ReadonlyDataSourceConfig.java | grep -v "^\s*//" | grep -v "^\s*\*"` → **0 matches** (T-05-06 mitigated).

### Test results

- `mvn test -Dtest='ReadonlyDataSourceConfigTest'` → `Tests run: 1, Failures: 0, Errors: 0, Skipped: 0`
- `mvn test -Dtest='ContextLoadsTest'` → `Tests run: 1, Failures: 0, Errors: 0, Skipped: 0`
- `mvn -DskipTests compile` → BUILD SUCCESS

## Deviations from Plan

None — plan executed exactly as written.

### Process note

The initial Edit for Task 1 was issued against the absolute path `/Users/aarun/Workspace/Projects/autosys-job-explorer/backend/rectrace/pom.xml`, which resolved to the **main repo** rather than the worktree. The error was detected by the post-edit `git status` (clean working tree on the worktree), the unintended modification on the main checkout was reverted with `git checkout -- backend/rectrace/pom.xml` (specific-file revert — not a blanket reset), and the edit was re-applied to the worktree using a relative path. Followed worktree absolute-path safety guidance (#3099) for the remainder of execution.

## Self-Check: PASSED

- `backend/rectrace/pom.xml` — modified, jsqlparser:5.3 present (1 occurrence)
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/ReadonlyDataSourceConfig.java` — created (111 lines)
- `backend/rectrace/src/test/java/com/citi/gru/rectrace/config/ReadonlyDataSourceConfigTest.java` — modified (`@Disabled` removed)
- Commit `d405d9b` present in `git log`
- Commit `9fa00f7` present in `git log`
