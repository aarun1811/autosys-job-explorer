---
phase: 01-backend-platform-upgrade
plan: 01
wave: 6
subsystem: backend-platform
tags: [BOOT-08, D-1.10, D-1.11, D-1.12, D-1.13, T-1-LOG-01, T-1-CFG-01, HikariCP, SLF4J, AppConstants]
status: COMPLETE
commit: 1527f53
baseline: eba1a70
branch: milestone/modernization
duration-seconds: 144
completed: 2026-05-12T16:51:34Z
requires: [Wave-1, Wave-2, Wave-3, Wave-5]
provides: [BOOT-08-closed, D-1.10-closed, D-1.11-closed, D-1.12-closed, D-1.13-closed]
affects: [backend/rectrace, rectrace-tlm-stats]
key-files:
  modified:
    - backend/rectrace/src/main/java/com/citi/gru/rectrace/util/ScriptExecutor.java
    - backend/rectrace/src/main/java/com/citi/gru/rectrace/service/ExecutionOrderService.java
    - backend/rectrace/src/main/resources/application.properties
    - backend/rectrace/src/main/java/com/citi/gru/rectrace/config/DataSourceConfig.java
    - backend/rectrace/src/main/java/com/citi/gru/rectrace/constants/AppConstants.java
    - backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/UserController.java
    - backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/v4/SearchControllerV4.java
    - rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/config/DatabaseConfig.java
---

# Phase 01 Plan 01 Wave 6: BOOT-08 Cleanup Quartet Summary

Folded the four "cheap during the upgrade" cleanup items into one wave-anchor commit: SLF4J migration in both remaining holdouts, `show_sql=true` removal from properties + redundant in-Java setProperty deletion, explicit HikariCP pool tuning on the primary rectrace DataSource and the two TLM-stats DataSources, and `AppConstants.CITI_PORTAL_LOGIN_ID_HEADER` populated + referenced from two controllers (the third — `SearchController` — no longer reads the header post-Wave 1 strip).

## What Landed

### Task 6.1 — SLF4J migration (D-1.10, T-1-LOG-01)

- `ScriptExecutor.java`: added `org.slf4j.Logger` / `LoggerFactory` imports and a `private static final Logger logger = LoggerFactory.getLogger(ScriptExecutor.class)` field. Replaced `e.printStackTrace()` at line 22 with `logger.error("Failed to execute password script {} for service {} schema {}", scriptPath, serviceName, dbSchema, e)`. Did NOT add `@Component` — `ScriptExecutor` is instantiated via `new` in `DataSourceConfig.java`; widening to `@Component` is out of scope per PATTERNS.md line 217.
- `ExecutionOrderService.java::clobToString(...)`: replaced `System.err.println("Error reading CLOB")` with `logger.error("Error reading CLOB", e)` using the existing `logger` field at line 31. Now the exception cause is captured, not silently dropped.
- `rectrace-tlm-stats/.../util/ScriptExecutor.java` already uses SLF4J — no change.

### Task 6.2 — `show_sql=true` removal (D-1.11, T-1-CFG-01)

- `application.properties:3`: `spring.jpa.show-sql=true` → `spring.jpa.show-sql=false`.
- `DataSourceConfig.java`: removed the redundant in-Java `properties.setProperty("hibernate.show_sql", "true")` line from the `entityManagerFactory()` bean (Wave 2 already removed the sibling dialect setter from the same block). The properties-file value alone now governs Hibernate SQL logging.
- `application-local.properties` already had `show-sql=false` (Phase 0.1) — no change.
- `application-prod.properties` / `application-uat.properties` do not override `show-sql` — they inherit `false` from the base.

### Task 6.3 — Explicit HikariCP pool config (D-1.12)

- `backend/rectrace/.../config/DataSourceConfig.java::dataSource()`: replaced the `DataSourceBuilder.create()` path with an explicit `HikariConfig` block mirroring `AutosysDataSourceConfig.java`. Added five `@Value` Hikari fields with property prefix `datasource.hikari.*` and Boot-friendly defaults (`maximumPoolSize:5`, `minimumIdle:2`, `connectionTimeout:30000`, `idleTimeout:600000`, `maxLifetime:1800000`). `poolName="Rectrace-HikariCP"`. Oracle optimizations `oracle.jdbc.ReadTimeout=60000` and `oracle.net.CONNECT_TIMEOUT=10000` added via `addDataSourceProperty`. Returns `new HikariDataSource(config)`.
- `rectrace-tlm-stats/.../config/DatabaseConfig.java`: same shape applied to `reconmgmtDataSource()` (poolName=`Reconmgmt-HikariCP`, prefix `reconmgmt.datasource.hikari.*`) and `recportalDataSource()` (poolName=`Recportal-HikariCP`, prefix `recportal.datasource.hikari.*`). Ten new `@Value` Hikari fields added. The `TlmJdbcTemplateFactory.getJdbcTemplate(String)` per-instance DataSource builder at line 190 was intentionally **NOT** touched — CONCERNS LOW #2 / PATTERNS.md line 182 explicitly defers it. The `DataSourceBuilder` import is kept (still used by that factory method).
- The unconditional `scriptExecutor.executeScript(...)` calls in all three files (DataSourceConfig:42-43, DatabaseConfig:80-81, DatabaseConfig:108-109) are left in place — Wave 7 owns the `isBlank()` guard wrapping per STATE.md KNOWN GAP (a)/(b).

### Task 6.4 — `AppConstants` populate + controller references (D-1.13)

- `AppConstants.java`: added `public static final String CITI_PORTAL_LOGIN_ID_HEADER = "x-citiportal-loginid";`. Private constructor + utility-class shape preserved.
- `UserController.java`: deleted local `private static final String CITI_PORTAL_LOGIN_ID_HEADER`. Added `import com.citi.gru.rectrace.constants.AppConstants;`. `request.getHeader(...)` now references `AppConstants.CITI_PORTAL_LOGIN_ID_HEADER`.
- `SearchControllerV4.java`: added `import com.citi.gru.rectrace.constants.AppConstants;`. Replaced all three `@RequestHeader(value = "x-citiportal-loginid", required = false)` occurrences (lines 30, 53, 93 after edit) with `@RequestHeader(value = AppConstants.CITI_PORTAL_LOGIN_ID_HEADER, required = false)`. The constant is `public static final String`, which is a compile-time constant — legal in annotation attributes (PATTERNS.md line 360 confirms).
- `SearchController.java`: not edited. Post-Wave 1 it is a single `/api/search/suggest` controller and no longer reads the header at all — no local constant survived Wave 1 to remove.

## Wave-Exit Verification

| Gate | Expectation | Result |
|------|-------------|--------|
| (a) No `printStackTrace` / `System.err` survivors in either module's `src/main` | grep returns empty | **PASS** — zero matches |
| (b) No `show-sql=true` / `hibernate.show_sql.*true` anywhere under `src/main` | grep returns empty | **PASS** — zero matches |
| (c) At least 3 `new HikariConfig()` / `HikariDataSource` instances + `Rectrace-HikariCP` pool name on `DataSourceConfig` | 4 instances total (rectrace primary + autosys + reconmgmt + recportal); `setPoolName("Rectrace-HikariCP")` at `DataSourceConfig.java:72` | **PASS** |
| (d) `AppConstants` populated + `UserController` + `SearchControllerV4` reference it + no stray local constants | constant declared at AppConstants:8; `AppConstants.CITI_PORTAL_LOGIN_ID_HEADER` ref at UserController:22 + 3 refs in SearchControllerV4 (lines 30, 53, 93); zero stray `private static final String CITI_PORTAL_LOGIN_ID_HEADER` under controller/ | **PASS** |
| (e) Both modules compile + context-load tests green | `mvn compile` clean for both; `ContextLoadsTest` PASS for backend/rectrace; `TlmStatsApplicationTests` PASS for rectrace-tlm-stats | **PASS** |

## Verification Commands & Output

```
$ grep -rn 'printStackTrace\|System\.err' backend/rectrace/src/main rectrace-tlm-stats/src/main
(empty)

$ grep -rn 'show-sql=true\|show_sql.*=.*true\|"hibernate\.show_sql".*"true"' backend/rectrace/src/main rectrace-tlm-stats/src/main
(empty)

$ grep -rn 'new HikariConfig()' backend/rectrace/src/main/java rectrace-tlm-stats/src/main/java | wc -l
4

$ grep -n 'Rectrace-HikariCP' backend/rectrace/src/main/java/com/citi/gru/rectrace/config/DataSourceConfig.java
72:        config.setPoolName("Rectrace-HikariCP");

$ grep -n 'CITI_PORTAL_LOGIN_ID_HEADER = "x-citiportal-loginid"' backend/rectrace/src/main/java/com/citi/gru/rectrace/constants/AppConstants.java
8:    public static final String CITI_PORTAL_LOGIN_ID_HEADER = "x-citiportal-loginid";

$ grep -rn 'private static final String CITI_PORTAL_LOGIN_ID_HEADER' backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/
(empty)

$ mvn -f backend/rectrace/pom.xml -q test -Dtest=ContextLoadsTest
Started ContextLoadsTest in 0.751 seconds  ✓

$ mvn -f rectrace-tlm-stats/pom.xml -q test -Dtest=TlmStatsApplicationTests
Started TlmStatsApplicationTests in 1.169 seconds  ✓
```

## Decisions Made

1. **Hikari pool defaults mirror `AutosysDataSourceConfig` exactly** (5 / 2 / 30000 / 600000 / 1800000) rather than copying the AutoSys property file's overridden values (10 / 5 / 20000). The `@Value` annotations carry these defaults inline so operators can override per-profile via properties without code change.
2. **`DataSourceBuilder` import retained in `DatabaseConfig.java`** — `TlmJdbcTemplateFactory.getJdbcTemplate(String)` still uses it for dynamic per-TLM-instance DataSources (CONCERNS LOW #2 deferred).
3. **`SearchController.java` left untouched** — Wave 1's V3 strip already deleted the local `CITI_PORTAL_LOGIN_ID_HEADER` constant; the surviving 1-endpoint controller no longer reads the header. Re-adding an `AppConstants` import there would be dead code.
4. **`@Component` NOT added to backend/rectrace's `ScriptExecutor`** — instantiated via `new` in `DataSourceConfig.dataSource()`; switching to DI is a wider refactor out of scope (PATTERNS.md line 217). The `rectrace-tlm-stats` `ScriptExecutor` is Spring-managed (`@Autowired private ScriptExecutor scriptExecutor` in DatabaseConfig) — those two modules diverge intentionally for now.
5. **Conditional `isBlank()` wrap deferred to Wave 7** — STATE.md KNOWN GAP (a)/(b) is owned by Wave 7 per the plan. This wave only adds HikariCP shape; the script-executor call site is preserved as-is.

## Deviations from Plan

None — plan executed exactly as written. All four tasks landed in a single wave-anchor commit per the plan's "fold cleanup quartet" directive.

## Self-Check: PASSED

- Modified files all present in git diff `HEAD~1..HEAD` (8 files, +125/-38 lines).
- Commit `1527f53` exists on `milestone/modernization`:
  ```
  $ git log --oneline -1 1527f53
  1527f53 chore(01): Wave 6 — BOOT-08 cleanup quartet (SLF4J + show_sql + HikariCP + AppConstants) [BOOT-08,D-1.10,1.11,1.12,1.13,T-1-LOG-01,T-1-CFG-01]
  ```
- All five wave-exit gates verified PASS prior to commit.
- No untracked files left in the working tree.

## Ready for Wave 7

YES. Wave 7 picks up the `isBlank()` guard wrapping for the three preserved unconditional `scriptExecutor.executeScript(...)` call sites (DataSourceConfig:42-43, DatabaseConfig:80-81, DatabaseConfig:108-109; line 190 stays per CONCERNS LOW #2 defer).
