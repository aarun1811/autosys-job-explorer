---
phase: 00-foundation
plan: 02
subsystem: rectrace-tlm-stats
tags: [testing, spring-boot, maven, database-config, test-profile]
dependency_graph:
  requires: []
  provides: [green-test-gate-tlm-stats]
  affects: [rectrace-tlm-stats]
tech_stack:
  added: []
  patterns: [spring-profile-guard, spring-boot-test-mock-bean, application-test-properties]
key_files:
  created:
    - rectrace-tlm-stats/src/test/resources/application-test.properties
  modified:
    - rectrace-tlm-stats/pom.xml
    - rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/config/DatabaseConfig.java
    - rectrace-tlm-stats/src/test/java/com/citi/gru/rectrace/tlmstats/TlmStatsApplicationTests.java
decisions:
  - "@MockBean for TlmStatsService/TlmStatsV2Service/QuickRecStatsService in test: when @Profile(!test) prevents DatabaseConfig beans from registering, the downstream services that @Autowired those beans also fail to register. Mocking those services at the test class level is the standard Spring Boot pattern and avoids adding @Profile(!test) to 6 production service/controller classes."
metrics:
  duration: "2 minutes"
  completed_date: "2026-05-12"
  tasks_completed: 2
  files_changed: 4
---

# Phase 0 Plan 02: Green Test Gate for rectrace-tlm-stats Summary

Established a passing Maven test gate for `rectrace-tlm-stats` by removing `maven.test.skip=true`, guarding `DatabaseConfig` with `@Profile("!test")`, creating `application-test.properties` with auto-config exclusions and `@Value` placeholder properties, and adding `@MockBean` for DB-dependent services so the Spring context loads without a live Oracle database.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Remove maven.test.skip and annotate DatabaseConfig with @Profile("!test") | acf81f6 | rectrace-tlm-stats/pom.xml, DatabaseConfig.java |
| 2 | Create application-test.properties and update TlmStatsApplicationTests | 12aa925 | application-test.properties, TlmStatsApplicationTests.java |

## Verification Results

All 5 phase gate checks pass:

1. `grep -c 'maven.test.skip' rectrace-tlm-stats/pom.xml` → 0 (PASS)
2. `grep -n '@Profile("!test")' DatabaseConfig.java` → line 30 (PASS)
3. `grep -c 'recportal.datasource.url' application-test.properties` → 1 (PASS)
4. `grep -c '@ActiveProfiles' TlmStatsApplicationTests.java` → 1 (PASS)
5. `mvn test` → BUILD SUCCESS, 1 test, 0 failures, 0 errors (PASS)

## Auto-config Exclusion List Used

```properties
spring.autoconfigure.exclude=\
  org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,\
  org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration,\
  org.springframework.boot.autoconfigure.jdbc.DataSourceTransactionManagerAutoConfiguration
```

## recportal.datasource.url Placeholder Confirmed

The property `recportal.datasource.url=jdbc:oracle:thin:@test-placeholder` is present in `application-test.properties`. This resolves the `IllegalStateException: Could not resolve placeholder 'recportal.datasource.url'` that the plan identified as the critical blocker (no default in `@Value`, missing from `application.properties`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added @MockBean for DB-dependent services to prevent NoSuchBeanDefinitionException**

- **Found during:** Task 2 (running mvn test)
- **Issue:** `@Profile("!test")` on `DatabaseConfig` prevents registration of `TlmJdbcTemplateFactory`, `reconmgmtJdbcTemplate`, and `recportalJdbcTemplate` beans. Three service classes (`TlmStatsService`, `TlmStatsV2Service`, `QuickRecStatsService`) `@Autowired` those beans with `required=true`. Spring fails to create those services during context load → `NoSuchBeanDefinitionException` on `TlmJdbcTemplateFactory`. The plan did not anticipate this downstream cascade.
- **Fix:** Added `@MockBean` for `TlmStatsService`, `TlmStatsV2Service`, and `QuickRecStatsService` in `TlmStatsApplicationTests.java`. This replaces the real beans with Mockito mocks, satisfying the controller `@Autowired` dependencies without triggering the missing `DatabaseConfig` beans.
- **Files modified:** `rectrace-tlm-stats/src/test/java/com/citi/gru/rectrace/tlmstats/TlmStatsApplicationTests.java`
- **Commit:** 12aa925
- **Why not Rule 4:** Did not require architectural changes — no new tables, no service restructuring. Adding `@MockBean` to a test class is a standard Spring Boot testing pattern fully supported by the existing test infrastructure.

## Known Stubs

None. No stub patterns introduced.

## Threat Flags

None. All files are in `src/test/` (excluded from production JAR) or modify a single annotation on an existing class. No new network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED

- [x] `rectrace-tlm-stats/pom.xml` - maven.test.skip removed
- [x] `rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/config/DatabaseConfig.java` - @Profile("!test") present at line 30
- [x] `rectrace-tlm-stats/src/test/resources/application-test.properties` - file exists, recportal.datasource.url present
- [x] `rectrace-tlm-stats/src/test/java/com/citi/gru/rectrace/tlmstats/TlmStatsApplicationTests.java` - @ActiveProfiles("test") and @MockBean present
- [x] Commit acf81f6 exists (Task 1)
- [x] Commit 12aa925 exists (Task 2)
- [x] mvn test = BUILD SUCCESS, 1 test, 0 failures, 0 errors
