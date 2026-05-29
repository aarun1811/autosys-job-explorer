---
phase: 00-foundation
plan: 01
subsystem: testing
tags: [spring-boot, maven, junit5, spring-profiles, lombok, annotation-processing]

# Dependency graph
requires: []
provides:
  - Green mvn test gate for backend/rectrace with ContextLoadsTest passing
  - @Profile("!test") guards on all DB-dependent config and service classes
  - @Profile("dev") guard on ElasticsearchDevConfiguration (closes CRITICAL SSL bypass)
  - maven.compiler.release=17 in pom.xml for cross-JVM compatibility
affects:
  - 00-02-foundation (rectrace-tlm-stats test gate — same pattern)
  - All future backend/rectrace phases (test gate runs on every mvn install)
  - Phase 1 Boot Upgrade (establishes test gate before upgrade)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "@Profile(\"!test\") on @Configuration and @Service beans that depend on Oracle/JPA/ES"
    - "spring.autoconfigure.exclude in application-test.properties for Spring Boot auto-configs"
    - "@SpringBootTest + @ActiveProfiles(\"test\") context-load test pattern"
    - "maven.compiler.release=17 for Lombok compatibility across JVM versions"

key-files:
  created:
    - backend/rectrace/src/test/resources/application-test.properties
    - backend/rectrace/src/test/java/com/citi/gru/rectrace/ContextLoadsTest.java
  modified:
    - backend/rectrace/pom.xml
    - backend/rectrace/src/main/java/com/citi/gru/rectrace/config/DataSourceConfig.java
    - backend/rectrace/src/main/java/com/citi/gru/rectrace/config/AutosysDataSourceConfig.java
    - backend/rectrace/src/main/java/com/citi/gru/rectrace/config/ElasticsearchDevConfiguration.java
    - backend/rectrace/src/main/java/com/citi/gru/rectrace/service/ExecutionOrderService.java
    - backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v3/OracleSearchProviderV3.java
    - backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v3/SearchServiceV3.java
    - backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v4/OracleServiceV4.java
    - backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v4/SearchServiceV4.java
    - backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/ExecutionOrderController.java
    - backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/SearchController.java
    - backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/v4/SearchControllerV4.java

key-decisions:
  - "@Profile(\"!test\") applied to service layer beans (ExecutionOrderService, OracleSearchProviderV3, SearchServiceV3, OracleServiceV4, SearchServiceV4) not just config classes — required due to cascading @PersistenceContext and DataSource constructor injection"
  - "@Profile(\"!test\") applied to controllers (ExecutionOrderController, SearchController, SearchControllerV4) that depend on profile-guarded services"
  - "maven.compiler.release=17 added to pom.xml to enable Lombok annotation processing with Java 25 JDK"
  - "@Profile(\"dev\") on ElasticsearchDevConfiguration closes CONCERNS.md CRITICAL item — SSL bypass now restricted to dev profile only"

patterns-established:
  - "Test gate pattern: @Profile(\"!test\") on any @Configuration or @Service that requires Oracle/JPA/ES infrastructure"
  - "Controller gate pattern: @Profile(\"!test\") on controllers whose required service deps are profile-guarded"
  - "Auto-config exclusion pattern: spring.autoconfigure.exclude in application-test.properties for Spring Boot-managed auto-configs"
  - "Two-pronged DB exclusion: auto-config exclusions (Spring-managed) + @Profile guards (user-defined beans)"

requirements-completed:
  - FOUND-01
  - FOUND-02
  - FOUND-03

# Metrics
duration: 7min
completed: 2026-05-12
---

# Phase 0 Plan 01: backend/rectrace Green Test Gate Summary

**maven.test.skip removed from backend/rectrace pom.xml; ContextLoadsTest passes with zero DB/ES dependencies using @Profile("!test") guards on all DB-dependent beans and maven.compiler.release=17**

## Performance

- **Duration:** 7 min
- **Started:** 2026-05-12T10:43:07Z
- **Completed:** 2026-05-12T10:50:52Z
- **Tasks:** 2
- **Files modified:** 13 (2 created, 11 modified)

## Accomplishments
- Removed `<maven.test.skip>true</maven.test.skip>` from `backend/rectrace/pom.xml` so every `mvn install` now fails on test red
- `ContextLoadsTest` passes with `@SpringBootTest @ActiveProfiles("test")` — no live Oracle or Elasticsearch required
- CRITICAL security fix: `ElasticsearchDevConfiguration` now has `@Profile("dev")`, preventing SSL bypass from firing in production or test contexts

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove maven.test.skip and annotate DataSource config classes** - `4b17d05` (feat)
2. **Task 2: Create application-test.properties and ContextLoadsTest.java** - `b3ad437` (feat)

**Plan metadata:** (committed as part of final summary commit)

## Files Created/Modified
- `backend/rectrace/pom.xml` — removed `maven.test.skip`, added `maven.compiler.release=17`
- `backend/rectrace/src/test/resources/application-test.properties` — NEW: excludes HibernateJpaAutoConfiguration, DataSourceTransactionManagerAutoConfiguration, and all 3 Elasticsearch auto-configs
- `backend/rectrace/src/test/java/com/citi/gru/rectrace/ContextLoadsTest.java` — NEW: @SpringBootTest @ActiveProfiles("test") with contextLoads() test
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/DataSourceConfig.java` — added @Profile("!test")
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/AutosysDataSourceConfig.java` — added @Profile("!test")
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/ElasticsearchDevConfiguration.java` — added @Profile("dev")
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/ExecutionOrderService.java` — added @Profile("!test") (deviation)
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v3/OracleSearchProviderV3.java` — added @Profile("!test") (deviation)
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v3/SearchServiceV3.java` — added @Profile("!test") (deviation)
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v4/OracleServiceV4.java` — added @Profile("!test") (deviation)
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v4/SearchServiceV4.java` — added @Profile("!test") (deviation)
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/ExecutionOrderController.java` — added @Profile("!test") (deviation)
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/SearchController.java` — added @Profile("!test") (deviation)
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/v4/SearchControllerV4.java` — added @Profile("!test") (deviation)

## Decisions Made
- Used `@Profile("!test")` on service layer and controller beans (not just config classes) because `ExecutionOrderService` uses `@PersistenceContext EntityManager` which requires an `EntityManagerFactory` — the JPA auto-config exclusion in `application-test.properties` means no EMF is registered in test context. Guards must propagate to all transitive dependents.
- Added `maven.compiler.release=17` to `pom.xml` because the machine runs Java 25 as the default JDK, and Lombok 1.18.x (bundled with Spring Boot 2.7.x) does not process annotations correctly with the Java 25 compiler. Setting `release=17` causes `javac` to compile against Java 17 API signatures, enabling Lombok to function correctly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added @Profile("!test") to service-layer DB-dependent beans**
- **Found during:** Task 2 (create ContextLoadsTest and application-test.properties)
- **Issue:** The plan specified `@Profile("!test")` only on `DataSourceConfig` and `AutosysDataSourceConfig` (config classes). However, `ExecutionOrderService` directly injects `EntityManager` via `@PersistenceContext`, `OracleSearchProviderV3` takes `DataSource` as constructor argument, `SearchServiceV3` depends on `OracleSearchProviderV3`, `OracleServiceV4` uses `JdbcTemplate`, and `SearchServiceV4` depends on `OracleServiceV4`. Excluding JPA/DataSource auto-configs meant none of these beans could be created in test context, causing `NoSuchBeanDefinitionException` cascade.
- **Fix:** Added `@Profile("!test")` to `ExecutionOrderService`, `OracleSearchProviderV3`, `SearchServiceV3`, `OracleServiceV4`, `SearchServiceV4`, and their dependent controllers (`ExecutionOrderController`, `SearchController`, `SearchControllerV4`).
- **Files modified:** 7 service/controller files
- **Verification:** `mvn test` → BUILD SUCCESS, 1 test, 0 failures
- **Committed in:** `b3ad437` (Task 2 commit)

**2. [Rule 3 - Blocking] Added maven.compiler.release=17 to pom.xml**
- **Found during:** Task 2 verification — `mvn test` failed with 40+ "cannot find symbol" errors (Lombok-generated `log`, `builder()`, getters/setters not visible)
- **Issue:** Machine default Maven uses Java 25. Lombok 1.18.x (via Spring Boot 2.7.16 BOM) does not support Java 25 annotation processing without `--release` flag. This was a pre-existing issue hidden by `maven.test.skip=true`.
- **Fix:** Added `<maven.compiler.release>17</maven.compiler.release>` to `pom.xml` `<properties>`. This instructs `javac` to compile against Java 17 APIs regardless of JDK version in use.
- **Files modified:** `backend/rectrace/pom.xml`
- **Verification:** `mvn test` (using Java 25 JDK) → BUILD SUCCESS
- **Committed in:** `b3ad437` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking)
**Impact on plan:** Both deviations were required for the test gate to function correctly. Rule 2 fix is correct behavior — the plan's `@Profile` pattern must be complete across the dependency chain. Rule 3 fix adds a compiler-level compatibility guard that makes the build robust across JDK versions. No scope creep.

## Issues Encountered
- Pre-existing compilation failures in `service/v4/` on Java 25 due to Lombok annotation processing. These failures were silently hidden by `maven.test.skip=true`. Resolved by `maven.compiler.release=17`.

## User Setup Required
None — no external service configuration required. Test gate runs via `cd backend/rectrace && mvn test` with no prerequisites.

## Next Phase Readiness
- Green test gate established for `backend/rectrace` — `mvn install` now fails on test red
- Pattern established for `rectrace-tlm-stats` test gate (Plan 00-02) — identical two-pronged approach applies
- `@Profile("!test")` pattern can be applied to new beans added in Phase 1 (Boot Upgrade) when they depend on DB infrastructure

---
*Phase: 00-foundation*
*Completed: 2026-05-12*
