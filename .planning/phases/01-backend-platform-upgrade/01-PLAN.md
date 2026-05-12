---
phase: 01
slug: backend-platform-upgrade
plan: 01
type: execute
mode: wave-based
waves: 8
created: 2026-05-12
status: draft
nyquist_compliant: true
asvs_level: 1
block_on: high
requirements: [BOOT-01, BOOT-02, BOOT-03, BOOT-04, BOOT-05, BOOT-06, BOOT-07, BOOT-08, BOOT-09]
decisions_closed: [D-1.1, D-1.2, D-1.3, D-1.4, D-1.5, D-1.6, D-1.7, D-1.8, D-1.9, D-1.10, D-1.11, D-1.12, D-1.13, D-1.14, D-1.15, D-1.16, D-1.17, D-1.18, D-1.19]
files_modified:
  - backend/rectrace/pom.xml
  - rectrace-tlm-stats/pom.xml
  - backend/rectrace/src/main/java/com/citi/gru/rectrace/config/DataSourceConfig.java
  - backend/rectrace/src/main/java/com/citi/gru/rectrace/config/AutosysDataSourceConfig.java
  - backend/rectrace/src/main/java/com/citi/gru/rectrace/config/SecurityConfig.java
  - backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/SearchController.java
  - backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/UserController.java
  - backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/v4/SearchControllerV4.java
  - backend/rectrace/src/main/java/com/citi/gru/rectrace/service/ExecutionOrderService.java
  - backend/rectrace/src/main/java/com/citi/gru/rectrace/service/JobStatusService.java
  - backend/rectrace/src/main/java/com/citi/gru/rectrace/service/SuggestionService.java
  - backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v4/SearchConfigServiceV4.java
  - backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v4/ElasticsearchServiceV4.java
  - backend/rectrace/src/main/java/com/citi/gru/rectrace/util/ScriptExecutor.java
  - backend/rectrace/src/main/java/com/citi/gru/rectrace/constants/AppConstants.java
  - backend/rectrace/src/main/resources/application.properties
  - backend/rectrace/src/main/resources/application-local.properties
  - backend/rectrace/src/main/resources/search-config.json
  - rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/config/DatabaseConfig.java
  - rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/config/SecurityConfig.java
  - frontend/rectrace/src/app/services/search.service.ts
  - frontend/rectrace/src/app/services/search.service.spec.ts
  - .planning/ROADMAP.md
  - .planning/phases/01-backend-platform-upgrade/01-SMOKE-CHECKLIST.md
autonomous: false
must_haves:
  truths:
    - Both modules compile and `mvn test` is green on Boot 3.5.14 + Java 21.
    - Zero `^import javax\.(servlet|persistence|annotation|sql|transaction|validation|ws|inject)` matches in either module's `src/main`.
    - `Oracle12cDialect` string appears zero times anywhere in the repo; `OracleDialect` is the only Hibernate dialect referenced.
    - `service/v3/` directory does not exist; the three V3 endpoints are removed from `SearchController`; `frontend/rectrace/src/app/services/search.service.ts` does not exist.
    - `SuggestionService` and `ElasticsearchServiceV4` import `co.elastic.clients.elasticsearch.ElasticsearchClient`; `RestHighLevelClient` is not imported anywhere.
    - One `@Bean SecurityFilterChain` exists per module (`backend/rectrace/.../config/SecurityConfig.java`, `rectrace-tlm-stats/.../config/SecurityConfig.java`) — permit-all, CSRF disabled.
    - No `printStackTrace`, no `System.err`, and no `show-sql=true`/`hibernate.show_sql.*true` strings remain under `src/main` in either module.
    - `DataSourceConfig.java:41-43` and `DatabaseConfig.java:80,108` script-executor calls are wrapped in `isBlank()` conditionals (Phase 0.1 P07 KNOWN GAPS closed).
    - All `@Profile("!test")` guards from Phase 0 survive the migration.
    - BOOT-09 manual smoke checklist (`01-SMOKE-CHECKLIST.md`) executes green against the `local` profile.
  artifacts:
    - path: backend/rectrace/pom.xml
      provides: Boot 3.5.14 parent + Java 21 properties + spring-boot-starter-security dep
      contains: "<version>3.5.14</version>"
    - path: rectrace-tlm-stats/pom.xml
      provides: identical version triple + spring-boot-starter-security dep
      contains: "<version>3.5.14</version>"
    - path: backend/rectrace/src/main/java/com/citi/gru/rectrace/config/SecurityConfig.java
      provides: permit-all SecurityFilterChain bean (rectrace module)
      contains: SecurityFilterChain
    - path: rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/config/SecurityConfig.java
      provides: permit-all SecurityFilterChain bean (tlm-stats module)
      contains: SecurityFilterChain
    - path: backend/rectrace/src/main/java/com/citi/gru/rectrace/constants/AppConstants.java
      provides: shared CITI_PORTAL_LOGIN_ID_HEADER constant
      contains: CITI_PORTAL_LOGIN_ID_HEADER
    - path: .planning/phases/01-backend-platform-upgrade/01-SMOKE-CHECKLIST.md
      provides: BOOT-09 manual smoke step list
      contains: BOOT-09
  key_links:
    - from: backend/rectrace/pom.xml
      to: rectrace-tlm-stats/pom.xml
      via: identical version triple (D-1.3 lockstep)
      pattern: "spring-boot-starter-parent.*3.5.14"
    - from: backend/rectrace/.../service/SuggestionService.java
      to: co.elastic.clients.elasticsearch.ElasticsearchClient
      via: constructor injection (Boot autoconfig)
      pattern: "import co\\.elastic\\.clients\\.elasticsearch\\.ElasticsearchClient"
    - from: backend/rectrace/.../service/v4/ElasticsearchServiceV4.java
      to: co.elastic.clients.elasticsearch.ElasticsearchClient
      via: field injection
      pattern: "import co\\.elastic\\.clients\\.elasticsearch\\.ElasticsearchClient"
    - from: backend/rectrace/.../controller/SearchController.java
      to: backend/rectrace/.../constants/AppConstants.CITI_PORTAL_LOGIN_ID_HEADER
      via: import + reference
      pattern: "AppConstants\\.CITI_PORTAL_LOGIN_ID_HEADER"
---

# Phase 1: Backend Platform Upgrade — Plan

**Phase:** 01
**Slug:** backend-platform-upgrade
**Mode:** wave-based (8 waves, each ending with one bisectable commit)
**Created:** 2026-05-12
**Status:** draft

---

## Phase Goal

Upgrade both Maven modules — `backend/rectrace` and `rectrace-tlm-stats` — from Spring Boot 2.7.16 + Java 17 to **Spring Boot 3.5.14 + Java 21**, with `javax.*` → `jakarta.*` namespaces migrated, a permit-all `SecurityFilterChain` bean per module, the Elasticsearch client migrated to `co.elastic.clients.elasticsearch.ElasticsearchClient` on the live ES paths, the V3 search trio + V3 endpoints + frontend dead service deleted, the BOOT-08 cleanup quartet folded in, and the Phase 0.1 P07 KNOWN GAPS (unconditional `scriptExecutor.executeScript` in two config classes) closed inline. Phase exits when both modules build green on 3.5.14 + 21, all existing tests pass, and the manual smoke (`01-SMOKE-CHECKLIST.md`) is green against the `local` profile.

---

## Success Criteria

Restated from ROADMAP.md Phase 1 (amended per D-1.2 to lock 3.5.14 instead of 3.2.x):

1. `backend/rectrace` and `rectrace-tlm-stats` build and boot on **Spring Boot 3.5.14** and **Java 21** on the dev laptop and target VM.
2. All `javax.*` imports migrated to `jakarta.*`; build is clean and no deprecated namespace remains (`javax.net.ssl` JDK API is the only `javax` left, and only because Phase 9 owns its replacement).
3. Spring Security is configured via `SecurityFilterChain` (no `WebSecurityConfigurerAdapter`); the existing `x-citiportal-loginid` header surface is preserved unchanged (D-1.9 — real validation deferred to Phase 9 SEC-01).
4. All previously-passing tests (Phase 0's `ContextLoadsTest` + `TlmStatsApplicationTests`) still pass on 3.5.14, and the manual smoke (`01-SMOKE-CHECKLIST.md`) confirms search, suggest, execution-order, and TLM-stats remain functional.
5. `printStackTrace`, `System.err`, and `show_sql=true` are gone from `src/main`; the Phase 0.1 P07 KNOWN GAPS (`DataSourceConfig.java:41-43`, `DatabaseConfig.java:80,108`) are closed.

---

## Requirement → Wave Map

| BOOT-NN | Behavior | Closing Wave |
|---|---|---|
| BOOT-01 | Java 21 toolchain compiles both modules | Wave 1 |
| BOOT-02 | Spring Boot 3.5.14 parent + BOM resolves | Wave 1 |
| BOOT-03 | `javax.*` → `jakarta.*` namespace sweep | Wave 1 |
| BOOT-04 | `SecurityFilterChain` bean per module (permit-all, CSRF off) | Wave 5 |
| BOOT-05 | Hibernate 6 / Spring Data JPA 3 — `OracleDialect` swap | Wave 2 |
| BOOT-06 | ES client → `ElasticsearchClient` on live paths | Wave 4 |
| BOOT-07 | Dependency-pin refresh — Boot 3.5 BOM resolves transitives | Wave 1 (verified Wave 8) |
| BOOT-08 | printStackTrace/show_sql/Hikari/AppConstants + V3 + frontend dead code | Waves 3 + 6 |
| BOOT-09 | All tests pass + manual smoke green on `local` | Wave 8 |

---

## Threat Model

**ASVS Level:** 1
**Block on:** high
**Phase 1 Security Stance:** Version-bump only — all auth/authz/secrets/TLS work explicitly deferred to Phase 9 per CONTEXT.md D-1.9.

| Threat ID | STRIDE | Description | Severity | Status |
|---|---|---|---|---|
| T-1-SEC-01 | Spoofing | `x-citiportal-loginid` accepted without server-side validation | HIGH | DEFERRED → Phase 9 SEC-01 (D-1.9) |
| T-1-SEC-02 | Tampering | ES dev-profile SSL trust-all bypass (`ElasticsearchDevConfiguration`) | HIGH | DEFERRED → Phase 9 SEC-03/04 (D-1.9). Phase 1 deletes the dev configuration class per planner Discretion (RESEARCH.md line 695) because `local` profile uses HTTP and Phase 9 will write the proper truststore path. |
| T-1-SEC-03 | Information Disclosure | Plaintext Oracle/ES passwords sourced from `get_password.sh` shell script | MEDIUM | DEFERRED → Phase 9 SEC-02 (D-1.9) |
| T-1-SEC-04 | Spoofing | Default `user` / auto-generated password if `spring-boot-starter-security` lands on the classpath without an explicit `SecurityFilterChain` | HIGH | ADDRESSED — Wave 5 adds explicit permit-all `SecurityFilterChain` in both modules (D-1.8) before the next public endpoint hit. Wave-exit verify: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:6088/rectrace/api/search/suggest?prefix=AB` returns `200`, not `401`. |
| T-1-SEC-05 | Spoofing | Spring Security autoconfig activates against the test profile and blocks `ContextLoadsTest` | LOW | ADDRESSED — Wave 5 task 5.3 either extends Phase 0's `spring.autoconfigure.exclude` in `application-test.properties` to include `SecurityAutoConfiguration` OR annotates `SecurityConfig` with `@Profile("!test")`. Verify: `mvn test -Dtest=ContextLoadsTest` still green. |
| T-1-LOG-01 | Information Disclosure | `printStackTrace` / `System.err` writes potentially sensitive stack data to stderr instead of structured logger | LOW | ADDRESSED — Wave 6 migrates both holdouts (`ScriptExecutor.java:22`, `ExecutionOrderService.java:154-156`) to SLF4J `logger.error(..., e)` (D-1.10, BOOT-08) |
| T-1-CFG-01 | Information Disclosure | `hibernate.show_sql=true` logs all SQL with parameter values | LOW | ADDRESSED — Wave 6 removes `application.properties:3` and the redundant `DataSourceConfig.java:65` setProperty (D-1.11, BOOT-08) |
| T-1-CFG-02 | Information Disclosure / Misconfig | `DataSourceConfig.java:41-43` and `DatabaseConfig.java:80,108` **unconditionally** call `scriptExecutor.executeScript(...)` even when `datasource.password` is supplied — surfaces as a startup crash on Apple-silicon dev laptops, and bypasses the explicit-password code path (Phase 0.1 P07 KNOWN GAP) | MEDIUM | ADDRESSED — Wave 7 wraps the script call in `if (password == null || password.isBlank())` per RESEARCH.md § Item 3 lines 791-805 |
| T-1-SUP-01 | Tampering (supply chain) | Maven dependencies pulled from public Maven Central instead of Citi internal Nexus | MEDIUM | DEFERRED → Phase 9 SEC-06 (D-1.9) — dev laptop uses Maven Central; Citi VM deployment uses internal mirror |

**Block on `high`:** All HIGH items are either ADDRESSED in this phase (T-1-SEC-04) or explicitly DEFERRED with a Phase 9 SEC-NN owner (T-1-SEC-01, T-1-SEC-02). Plan passes the security gate.

---

## Wave Execution Order

Each wave ends with one git commit. Inside a wave, tasks may be staged as separate commits at executor discretion **only if** each intermediate commit compiles (`mvn -q -DskipTests compile`). The wave-exit commit message is the bisectable anchor.

```
Wave 1 → Wave 2 → Wave 3 → Wave 4 → Wave 5 → Wave 6 → Wave 7 → Wave 8
   |        |        |        |        |        |        |        |
  BOOT-     BOOT-    V3       ES       Sec      BOOT-08  Phase    Smoke +
  01/02/03  05       death    client   bean     quartet  0.1      ROADMAP
   compile  test     compile  test     test     test     gaps     +verify
   green    green    green    green    green    green    closed   PASS
```

---

## Wave 1: Parent POM bump + Java 21 + Boot 3.5.14 + jakarta sweep

**Goal:** Both modules compile on Spring Boot 3.5.14 + Java 21. POM bumps and the `javax.*` → `jakarta.*` sweep land in the same wave because the bump alone leaves `mvn compile` red (every `javax.servlet`/`javax.persistence` import becomes unresolvable). This wave restores compile-green.

**Closes:** D-1.1, D-1.2, D-1.3, partial D-1.17 (preserves `@Profile("!test")` guards on touched files); BOOT-01, BOOT-02, BOOT-03; partial BOOT-07 (BOM resolution).

**Wave-exit verify:**
```bash
mvn -f backend/rectrace/pom.xml -q -DskipTests compile && \
mvn -f rectrace-tlm-stats/pom.xml -q -DskipTests compile
```
Both modules exit 0. Plus:
```bash
! grep -rn '^import javax\.\(servlet\|persistence\|annotation\|sql\|transaction\|validation\|ws\|inject\)' \
  backend/rectrace/src/main rectrace-tlm-stats/src/main
```
No matches.

**Wave-exit commit:** `chore(01): bump Boot 2.7.16→3.5.14 + Java 17→21 + javax→jakarta sweep [BOOT-01,02,03]`

### Task 1.1 — Bump `backend/rectrace/pom.xml` to Boot 3.5.14 + Java 21

- **Files:** `backend/rectrace/pom.xml`
- **Closes:** D-1.1, D-1.2, D-1.3, BOOT-01, BOOT-02
- **Threat ref:** —
- **Bound to:** PATTERNS.md row "`backend/rectrace/pom.xml`" (self-update) + RESEARCH.md § Standard Stack lines 157-172.
- **Action:**
  1. Edit `<parent>` block (lines 5-10): `<version>2.7.16</version>` → `<version>3.5.14</version>`. Keep `<relativePath/>` self-closing as-is.
  2. Edit `<properties>` block (lines 28-32): `<java.version>17</java.version>` → `<java.version>21</java.version>`. `<maven.compiler.release>17</maven.compiler.release>` → `<maven.compiler.release>21</maven.compiler.release>`.
  3. Do NOT add any `<dependencyManagement>` section. Do NOT pin Lombok, Hibernate, Micrometer, Jackson, HikariCP, or ES client versions — the Boot 3.5.14 BOM resolves all of them transitively (BOOT-07 contract per RESEARCH.md line 162-172). Per RESEARCH.md line 165 the existing `oraclepki`/`osdt_core`/`osdt_cert` 21.5.0.0 pins stay (Oracle confirms Java 21 compat).
  4. The `spring-boot-starter-security` add lives in **Wave 5 task 5.1**, NOT here, to keep this wave's compile failure surface bounded to namespace changes only.
- **Verify:**
  - `<automated>grep -q '<version>3.5.14</version>' backend/rectrace/pom.xml && grep -q '<java.version>21</java.version>' backend/rectrace/pom.xml && grep -q '<maven.compiler.release>21</maven.compiler.release>' backend/rectrace/pom.xml</automated>`
  - This task alone leaves `mvn compile` RED (expected — `javax.*` imports become unresolvable on the new BOM). Compile-green is restored at task 1.3.
- **Done:** All three version values updated; no other edits to this file.

### Task 1.2 — Bump `rectrace-tlm-stats/pom.xml` to identical values (lockstep per D-1.3)

- **Files:** `rectrace-tlm-stats/pom.xml`
- **Closes:** D-1.1, D-1.2, D-1.3, BOOT-01, BOOT-02
- **Threat ref:** —
- **Bound to:** PATTERNS.md row "`rectrace-tlm-stats/pom.xml`" (exact analog of post-bump rectrace POM).
- **Action:** Apply the same three-line diff as task 1.1 to `rectrace-tlm-stats/pom.xml`. POM line numbers: parent `<version>` near line 9, `<java.version>` near line 17. End state MUST be byte-identical to `backend/rectrace/pom.xml` on the three version values (D-1.3 cross-module lockstep — no drift permitted).
- **Verify:**
  - `<automated>grep -q '<version>3.5.14</version>' rectrace-tlm-stats/pom.xml && grep -q '<java.version>21</java.version>' rectrace-tlm-stats/pom.xml && diff <(grep -E '(<version>3\.5\.14|<java\.version|<maven\.compiler\.release)' backend/rectrace/pom.xml) <(grep -E '(<version>3\.5\.14|<java\.version|<maven\.compiler\.release)' rectrace-tlm-stats/pom.xml)</automated>` — diff exits 0 (the three lines match between modules).
- **Done:** tlm-stats POM version triple matches backend POM byte-for-byte.

### Task 1.3 — javax.* → jakarta.* sweep across 14 files

- **Files (14 imports across 10 files):**
  - `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/AutosysDataSourceConfig.java:10` — `javax.sql.DataSource` → `jakarta.sql.DataSource`
  - `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/DataSourceConfig.java:3` — `javax.sql.DataSource` → `jakarta.sql.DataSource`
  - `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/DataSourceConfig.java:4` — `javax.persistence.EntityManagerFactory` → `jakarta.persistence.EntityManagerFactory`
  - `backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/SearchController.java:4` — `javax.servlet.http.HttpServletRequest` → `jakarta.servlet.http.HttpServletRequest`
  - `backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/UserController.java:3` — `javax.servlet.http.HttpServletRequest` → `jakarta.servlet.http.HttpServletRequest`
  - `backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/v4/SearchControllerV4.java:12` — `javax.servlet.http.HttpServletResponse` → `jakarta.servlet.http.HttpServletResponse`
  - `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/ExecutionOrderService.java:12-14` — three `javax.persistence.*` imports → `jakarta.persistence.*` (EntityManager, PersistenceContext, Query)
  - `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/JobStatusService.java:14` — `javax.sql.DataSource` → `jakarta.sql.DataSource`
  - `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/SearchConfigServiceV3.java:8` — handled by Wave 3 deletion (planner Discretion: delete the orphaned file rather than rewrite); record as `[DELETED Wave 3]` here
  - `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v4/SearchConfigServiceV4.java:13` — `javax.annotation.PostConstruct` → `jakarta.annotation.PostConstruct`
  - `rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/config/DatabaseConfig.java:9` — `javax.sql.DataSource` → `jakarta.sql.DataSource`
- **KEEP unchanged:** `backend/rectrace/.../config/ElasticsearchDevConfiguration.java:3` — `javax.net.ssl.SSLContext` is a JDK API, NOT in the Jakarta rename set (RESEARCH.md line 634). This file is deleted in Wave 4 (planner Discretion); until then the import stays.
- **Closes:** D-1.17 (preserves `@Profile("!test")` guards on every touched file), BOOT-03
- **Threat ref:** —
- **Bound to:** PATTERNS.md § "Javax→jakarta sweep" + RESEARCH.md § "Javax → Jakarta Migration Inventory" lines 623-657.
- **Action:** Each line is a mechanical 1:1 import rename. No method signatures change. Preserve every existing `@Profile("!test")` annotation on the file — Phase 0 added these and D-1.17 requires they survive. Apply via Edit tool one file at a time (do NOT use `sed -i` — git history clarity matters here for bisectability). After editing each file, the file MUST still compile against the new Boot 3.5.14 BOM (`HttpServletRequest`, `EntityManager`, `DataSource`, `PostConstruct` all exist in `jakarta.*` under Boot 3.5).
- **Verify:**
  - `<automated>! grep -rn '^import javax\.\(servlet\|persistence\|annotation\|sql\|transaction\|validation\|ws\|inject\)' backend/rectrace/src/main rectrace-tlm-stats/src/main && mvn -f backend/rectrace/pom.xml -q -DskipTests compile && mvn -f rectrace-tlm-stats/pom.xml -q -DskipTests compile</automated>`
  - `<automated>grep -c '@Profile("!test")' backend/rectrace/src/main/java/com/citi/gru/rectrace/config/DataSourceConfig.java backend/rectrace/src/main/java/com/citi/gru/rectrace/config/AutosysDataSourceConfig.java backend/rectrace/src/main/java/com/citi/gru/rectrace/service/ExecutionOrderService.java backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/SearchController.java backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/v4/SearchControllerV4.java rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/config/DatabaseConfig.java | awk -F: '{ if ($2 < 1) { print "MISSING @Profile guard: " $1; exit 1 } } END { print "OK" }'</automated>` — every touched file with a Phase 0 guard still has it.
- **Done:** Zero `javax.{servlet,persistence,annotation,sql,transaction,validation,ws,inject}` imports; both modules compile.

### Wave 1 commit

`chore(01): bump to Spring Boot 3.5.14 + Java 21 + javax→jakarta sweep [BOOT-01,02,03,D-1.1,1.2,1.3,1.17]`

---

## Wave 2: Hibernate dialect migration (Oracle12cDialect → OracleDialect)

**Goal:** Both modules' context-load tests pass on Hibernate 6.6.x by replacing the removed `Oracle12cDialect` class with the consolidated `OracleDialect`. The properties-file dialect is the canonical source; the redundant in-Java `properties.setProperty("hibernate.dialect", ...)` line in `DataSourceConfig.java:64` is **deleted** atomically with the rename (RESEARCH.md line 673).

**Closes:** D-1.17 (preserves `@Profile("!test")` on `DataSourceConfig`); BOOT-05.

**Wave-exit verify:**
```bash
! grep -rn 'Oracle12cDialect' backend/rectrace rectrace-tlm-stats && \
mvn -f backend/rectrace/pom.xml -q test -Dtest=ContextLoadsTest && \
mvn -f rectrace-tlm-stats/pom.xml -q test -Dtest=TlmStatsApplicationTests
```

**Wave-exit commit:** `fix(01): Hibernate 6 OracleDialect migration [BOOT-05]`

### Task 2.1 — Rename `Oracle12cDialect` → `OracleDialect` in properties

- **Files:** `backend/rectrace/src/main/resources/application.properties`, `backend/rectrace/src/main/resources/application-local.properties`
- **Closes:** BOOT-05
- **Threat ref:** —
- **Bound to:** PATTERNS.md row "`application.properties`" + RESEARCH.md § Hibernate 6 Dialect Migration lines 659-673.
- **Action:**
  - `application.properties:4` — `spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.Oracle12cDialect` → `spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.OracleDialect`
  - `application-local.properties:21` — same one-character-string edit. (Note: `application-prod.properties` / `application-uat.properties` do NOT override the dialect per RESEARCH.md line 671 — no edit needed there; the default propagates.)
  - The `rectrace-tlm-stats` module has no `hibernate.dialect` property set in any of its properties files (verified via the RESEARCH.md grep). No edit there.
- **Verify:**
  - `<automated>! grep -rn 'Oracle12cDialect' backend/rectrace/src/main/resources rectrace-tlm-stats/src/main/resources</automated>` — zero matches.
- **Done:** Two properties files updated; no `Oracle12cDialect` substring in either module's `src/main/resources`.

### Task 2.2 — Delete redundant in-Java dialect setProperty + show_sql setProperty (atomic two-line delete)

- **Files:** `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/DataSourceConfig.java`
- **Closes:** BOOT-05, BOOT-08 (item #2), D-1.11
- **Threat ref:** T-1-CFG-01 (also addressed; full closure at Wave 6 task 6.2)
- **Bound to:** PATTERNS.md row "`DataSourceConfig.java` — HikariCP pool addition" (specifically the third bullet on lines 156-157) + RESEARCH.md line 673.
- **Action:** Delete `DataSourceConfig.java:64` (`properties.setProperty("hibernate.dialect", "org.hibernate.dialect.Oracle12cDialect");`) AND line 65 (`properties.setProperty("hibernate.show_sql", "true");`). The two-line delete is atomic because the properties file already controls dialect and we want `show-sql=false` (set at Wave 6 task 6.2 in the properties file). After deletion, the remaining `Properties properties = new Properties();` block in this method may end up empty — if so, also delete the empty `properties.setProperty(...)` scaffolding and the `em.setJpaProperties(properties)` line if it has no other contents; if the block has other entries, keep the scaffolding. Verify via diff before commit.
- **Verify:**
  - `<automated>! grep -n 'Oracle12cDialect\|hibernate\.show_sql' backend/rectrace/src/main/java/com/citi/gru/rectrace/config/DataSourceConfig.java</automated>` — zero matches.
  - `<automated>mvn -f backend/rectrace/pom.xml -q -DskipTests compile</automated>` — still compiles.
- **Done:** Both setProperty lines gone; compile green.

### Task 2.3 — Run context-load tests to confirm Hibernate 6 binds OracleDialect

- **Files:** none (test-only)
- **Closes:** BOOT-05 (proof step)
- **Threat ref:** —
- **Bound to:** VALIDATION.md row BOOT-05 + Wave 0 Requirements line 120-121.
- **Action:** Run the quick test command per VALIDATION.md sampling rate. The `test` profile excludes Oracle via `spring.autoconfigure.exclude` (Phase 0 D-05) so this test does NOT actually bind a Hibernate dialect at runtime — it validates the Spring context loads without `ClassNotFoundException` for `OracleDialect` (which Hibernate 6.6.x ships in `org.hibernate.dialect.OracleDialect`). The live `local`-profile boot will exercise the actual dialect resolution in Wave 8 smoke step 1.
- **Verify:**
  - `<automated>mvn -f backend/rectrace/pom.xml -q test -Dtest=ContextLoadsTest -DskipITs && mvn -f rectrace-tlm-stats/pom.xml -q test -Dtest=TlmStatsApplicationTests -DskipITs</automated>`
- **Done:** Both context-load tests green on Boot 3.5.14 + Hibernate 6.6.x.

### Wave 2 commit

`fix(01): Hibernate 6 OracleDialect rename + delete redundant Java setProperty [BOOT-05,08-#2 partial,D-1.11 partial]`

---

## Wave 3: V3 dead-code deletion (backend + frontend, lockstep)

**Goal:** Delete the entire V3 search trio + V3 endpoint methods + orphaned `SearchConfigServiceV3` + legacy `search-config.json` + frontend `search.service.ts`/spec. Each deletion is verified by grep to have zero remaining callers before removal.

**Closes:** D-1.5, D-1.6, D-1.7, partial BOOT-08 (dead-code prune).

**Wave-exit verify:**
```bash
! find backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v3 -type f 2>/dev/null && \
! ls backend/rectrace/src/main/java/com/citi/gru/rectrace/service/SearchConfigServiceV3.java 2>/dev/null && \
! grep -rn '/v3/search/' backend/rectrace/src/main && \
! ls frontend/rectrace/src/app/services/search.service.ts frontend/rectrace/src/app/services/search.service.spec.ts 2>/dev/null && \
mvn -f backend/rectrace/pom.xml -q -DskipTests compile
```

**Wave-exit commit:** `feat(01): delete V3 search trio + V3 endpoints + frontend search.service [D-1.5,1.6,1.7,BOOT-08]`

### Task 3.1 — Delete V3 service trio directory + orphaned SearchConfigServiceV3 + legacy JSON config

- **Files (deletions):**
  - `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v3/SearchServiceV3.java`
  - `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v3/OracleSearchProviderV3.java`
  - `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v3/ElasticsearchSearchProviderV3.java`
  - `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/SearchConfigServiceV3.java` (planner Discretion per CONTEXT.md D-1.13 / RESEARCH.md line 687 — orphaned post-V3-trio; V4 has its own `SearchConfigServiceV4`)
  - `backend/rectrace/src/main/resources/search-config.json` (legacy V3 config; `search-config-v4.json` is canonical — verify zero readers before delete)
- **Closes:** D-1.5, partial D-1.13 (discretion), BOOT-08
- **Threat ref:** —
- **Bound to:** PATTERNS.md § Deletions table + RESEARCH.md § "Call-graph safety check" lines 697-706.
- **Action:**
  1. Pre-flight grep: `grep -rn 'SearchServiceV3\|OracleSearchProviderV3\|ElasticsearchSearchProviderV3\|SearchConfigServiceV3\|search-config\.json' backend/rectrace/src/main backend/rectrace/src/test rectrace-tlm-stats/src 2>/dev/null`. Expect only matches inside the v3/ directory and inside `SearchController.java` (which is rewritten in task 3.2). Any other match BLOCKS deletion.
  2. `rm -rf backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v3/` (deletes the directory and its three files).
  3. `rm backend/rectrace/src/main/java/com/citi/gru/rectrace/service/SearchConfigServiceV3.java`
  4. `rm backend/rectrace/src/main/resources/search-config.json` (only after verifying no Java code references it via `@Value` or `ClassPathResource` — `grep -rn 'search-config\.json' backend/rectrace/src` returns only the file itself or zero hits).
- **Verify:**
  - `<automated>! find backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v3 -type f 2>/dev/null && ! ls backend/rectrace/src/main/java/com/citi/gru/rectrace/service/SearchConfigServiceV3.java 2>/dev/null && ! ls backend/rectrace/src/main/resources/search-config.json 2>/dev/null</automated>`
- **Done:** All five paths gone from the working tree (and from the index via `git rm`).

### Task 3.2 — Strip V3 fields, V3 endpoints, and V3 imports from `SearchController.java`

- **Files:** `backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/SearchController.java`
- **Closes:** D-1.5, D-1.6 (planner Discretion: keep `SearchController` as a slimmed-down single-endpoint controller hosting `/api/search/suggest` rather than folding into `SearchControllerV4` — keeps package hygiene; `SearchControllerV4` already owns the v4 namespace)
- **Threat ref:** —
- **Bound to:** PATTERNS.md row "`SearchController.java` — V3 removal + jakarta + AppConstants reference" (steps 2-4 are this task; steps 1, 5, 6 already happened in Wave 1 task 1.3 and Wave 6 task 6.4 respectively).
- **Action:**
  1. Delete imports for `SearchServiceV3` and `OracleSearchProviderV3` (lines around 12-13 — verify by Read before edit).
  2. Delete the V3 service fields, V3 constructor parameters, and V3 constructor assignments (lines around 26-27, 31-32 — exact lines after Wave 1's jakarta sweep shifted nothing; verify by Read).
  3. Delete the three V3 endpoint methods entirely: `keywordSearchV3`, `expandGroupV3`, `ssrmDataV3` (the methods serving `/v3/search/keyword`, `/v3/search/expand`, `/v3/search/ssrm/{category}`). Each is its own `@GetMapping`/`@PostMapping`/`@RequestMapping` block.
  4. The surviving endpoint is the `/api/search/suggest` method that delegates to `SuggestionService`. Keep the `@Profile("!test")`, `@RestController`, `@RequestMapping("/api")` class annotations (D-1.17). The local `private static final String CITI_PORTAL_LOGIN_ID_HEADER` constant and its callers stay for now — they get replaced in Wave 6 task 6.4 with `AppConstants.CITI_PORTAL_LOGIN_ID_HEADER`.
- **Verify:**
  - `<automated>! grep -n 'SearchServiceV3\|OracleSearchProviderV3\|"/v3/search/' backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/SearchController.java && mvn -f backend/rectrace/pom.xml -q -DskipTests compile</automated>`
- **Done:** SearchController has no V3 references; compiles; `@Profile("!test")` preserved.

### Task 3.3 — Delete frontend `search.service.ts` + spec (D-1.7, CONCERNS MEDIUM #4)

- **Files (deletions):**
  - `frontend/rectrace/src/app/services/search.service.ts`
  - `frontend/rectrace/src/app/services/search.service.spec.ts`
- **Closes:** D-1.7
- **Threat ref:** —
- **Bound to:** PATTERNS.md § Deletions table + RESEARCH.md § "Frontend grep confirms" line 704.
- **Action:**
  1. Pre-flight grep: `grep -rn "from '.*search\\.service'" frontend/rectrace/src 2>/dev/null` AND `grep -rn 'search\\.service' frontend/rectrace/src/app/app.module.ts frontend/rectrace/src/app/**/*.module.ts 2>/dev/null`. Expect zero hits outside the two files being deleted (`search-v5.service.ts` is the live service — different file).
  2. Delete both files via `git rm`.
- **Verify:**
  - `<automated>! ls frontend/rectrace/src/app/services/search.service.ts frontend/rectrace/src/app/services/search.service.spec.ts 2>/dev/null && ! grep -rn "from '.*services/search\\.service'" frontend/rectrace/src 2>/dev/null</automated>` — files gone; no remaining import.
- **Done:** Files removed from working tree and git index; no remaining importer.

### Wave 3 commit

`feat(01): delete V3 search trio + V3 endpoints + frontend dead service [D-1.5,1.6,1.7,BOOT-08]`

---

## Wave 4: Elasticsearch client migration (HLRC → Java API Client)

**Goal:** Rewrite `SuggestionService` and `ElasticsearchServiceV4` against `co.elastic.clients.elasticsearch.ElasticsearchClient`. Delete `ElasticsearchDevConfiguration.java` (planner Discretion per RESEARCH.md line 695: local uses HTTP, Phase 9 owns prod truststore — file has no remaining purpose). `RestHighLevelClient` is gone from the codebase.

**Closes:** D-1.4, D-1.6; BOOT-06; partial T-1-SEC-02 (dev-config file deletion).

**Wave-exit verify:**
```bash
! grep -rn 'RestHighLevelClient\|elasticsearch\.client\.RestHighLevelClient' backend/rectrace/src/main && \
grep -q 'co\.elastic\.clients\.elasticsearch\.ElasticsearchClient' backend/rectrace/src/main/java/com/citi/gru/rectrace/service/SuggestionService.java && \
grep -q 'co\.elastic\.clients\.elasticsearch\.ElasticsearchClient' backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v4/ElasticsearchServiceV4.java && \
mvn -f backend/rectrace/pom.xml -q test -Dtest=ContextLoadsTest
```

**Wave-exit commit:** `feat(01): ES Java API Client migration on SuggestionService + ElasticsearchServiceV4 [BOOT-06,D-1.4,1.6]`

### Task 4.1 — Rewrite `SuggestionService.java` on `ElasticsearchClient`

- **Files:** `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/SuggestionService.java`
- **Closes:** D-1.4, D-1.6, BOOT-06
- **Threat ref:** —
- **Bound to:** PATTERNS.md § "SuggestionService.java — RestHighLevelClient → ElasticsearchClient" + RESEARCH.md § Pattern 4 (lines 518-587 — full before/after).
- **Action:** Replace `RestHighLevelClient` field with `@Autowired ElasticsearchClient esClient` (Boot 3.5 autoconfig provides the bean — no `@Configuration` needed per RESEARCH.md lines 689-691). Rewrite the suggest call to use `FieldSuggester.of(...)` + `esClient.search(s -> s.index(...).suggest(...).source(src -> src.fetch(false)).size(0), Void.class)`. Preserve the `/api/search/suggest` URL contract — the JSON response shape returned to the V5 Angular autocomplete frontend MUST be identical (D-1.6). The method signature returning a `Map<String, List<String>>` (or whatever the current shape is — Read the file first to confirm) is preserved.
  Imports to add:
  - `co.elastic.clients.elasticsearch.ElasticsearchClient`
  - `co.elastic.clients.elasticsearch.core.SearchResponse`
  - `co.elastic.clients.elasticsearch.core.search.FieldSuggester`
  - `co.elastic.clients.elasticsearch.core.search.Suggester`
  - `co.elastic.clients.elasticsearch.core.search.Suggestion`
  - `co.elastic.clients.elasticsearch.core.search.CompletionSuggestOption`

  Imports to delete:
  - All `org.elasticsearch.action.search.*`
  - All `org.elasticsearch.client.RestHighLevelClient`
  - All `org.elasticsearch.search.suggest.*`

  Preserve `@Profile("!test")` if currently present on the class (Phase 0 D-05).
- **Verify:**
  - `<automated>grep -q 'import co\.elastic\.clients\.elasticsearch\.ElasticsearchClient' backend/rectrace/src/main/java/com/citi/gru/rectrace/service/SuggestionService.java && ! grep -n 'RestHighLevelClient' backend/rectrace/src/main/java/com/citi/gru/rectrace/service/SuggestionService.java && mvn -f backend/rectrace/pom.xml -q -DskipTests compile</automated>`
  - Wave 8 smoke step 3 exercises the endpoint live (manual).
- **Done:** SuggestionService compiles on new client; no HLRC imports remain in the file.

### Task 4.2 — Rewrite `ElasticsearchServiceV4.java` on `ElasticsearchClient`

- **Files:** `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v4/ElasticsearchServiceV4.java`
- **Closes:** D-1.4, D-1.6, BOOT-06
- **Threat ref:** —
- **Bound to:** PATTERNS.md § "ElasticsearchServiceV4.java — RestHighLevelClient → ElasticsearchClient" + RESEARCH.md § Pattern 3 (lines 420-516 — full before/after of `getUniqueValues(...)`).
- **Action:** Replace `RestHighLevelClient` field (`@Autowired(required=false)` — the `required=false` flag stays because Phase 0's test profile excludes ES autoconfig) with `@Autowired(required=false) ElasticsearchClient esClient`. Rewrite the search/SSRM/getUniqueValues calls per RESEARCH.md Pattern 3 (lines 466-516). The pattern is: replace `SearchSourceBuilder` + `BoolQueryBuilder.should(...)` with `esClient.search(s -> s.query(q -> q.bool(b -> b.should(shoulds))).collapse(...).size(...).sort(...), Map.class)`. Preserve the V5 frontend's expected JSON response shape for the V4 SSRM grid (frontend `search-v5.service.ts` calls `/api/v4/search/initial`, `/api/v4/search/ssrm/{category}`, `/api/v4/search/export` — all live; the typed response from `esClient.search(..., Map.class)` continues to feed `SearchServiceV4` which already deals in `Map<String,Object>`).
  Companion check: `SearchServiceV4.java` may have a stray `javax.servlet.http.HttpServletResponse` or `javax.sql.DataSource` import that Wave 1's PATTERNS.md row marked as "(verify on read)". If so, Edit those imports to `jakarta.*` in this same task. Per RESEARCH.md the file is mostly delegation — no ES-API call sites — but any compile error surfaces here and is fixed in place (CONTEXT.md Discretion line 92).
- **Verify:**
  - `<automated>grep -q 'import co\.elastic\.clients\.elasticsearch\.ElasticsearchClient' backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v4/ElasticsearchServiceV4.java && ! grep -n 'RestHighLevelClient' backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v4/ElasticsearchServiceV4.java && mvn -f backend/rectrace/pom.xml -q -DskipTests compile</automated>`
- **Done:** ElasticsearchServiceV4 compiles on the new client; no HLRC imports anywhere in the module.

### Task 4.3 — Delete `ElasticsearchDevConfiguration.java` (planner Discretion, T-1-SEC-02 partial)

- **Files (deletions):** `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/ElasticsearchDevConfiguration.java`
- **Closes:** planner Discretion (RESEARCH.md Open Q #4 line 695 — "Recommendation: delete ElasticsearchDevConfiguration.java in Phase 1")
- **Threat ref:** T-1-SEC-02 (partial — removes the dev-only SSL bypass code path; the rest of SEC-02 is Phase 9)
- **Bound to:** PATTERNS.md § Deletions table + RESEARCH.md § "SSL handling" lines 693-695.
- **Action:**
  1. Pre-flight grep: `grep -rn 'ElasticsearchDevConfiguration\|RestClientBuilderCustomizer' backend/rectrace/src/main 2>/dev/null`. Expect only matches inside the file itself. Any caller blocks deletion (none expected per RESEARCH.md call-graph).
  2. `git rm backend/rectrace/src/main/java/com/citi/gru/rectrace/config/ElasticsearchDevConfiguration.java`
  3. Phase 9 SEC-03/SEC-04 will install the proper truststore for prod; the `local` profile uses HTTP (`http://localhost:9200`, Phase 0.1 D-0.1.16) and never needed SSL trust-all.
- **Verify:**
  - `<automated>! ls backend/rectrace/src/main/java/com/citi/gru/rectrace/config/ElasticsearchDevConfiguration.java 2>/dev/null && ! grep -rn 'RestClientBuilderCustomizer' backend/rectrace/src/main</automated>`
- **Done:** File gone; no remaining reference.

### Wave 4 commit

`feat(01): ES Java API Client migration + delete dev SSL bypass [BOOT-06,D-1.4,1.6,T-1-SEC-02]`

---

## Wave 5: SecurityFilterChain bootstrap

**Goal:** Add `spring-boot-starter-security` to both POMs and a permit-all `SecurityFilterChain` bean per module. This satisfies BOOT-04 mechanically without coupling a behavior change to a version-bump phase. Phase 9 owns the real auth mechanism (D-1.9). The wave is intentionally ordered AFTER Wave 4 ES migration because adding the security starter without a permit-all bean would block anonymous endpoint hits and surprise the smoke tester; the bean-and-dep land together.

**Closes:** D-1.8; BOOT-04; T-1-SEC-04 (default-credentials risk).

**Wave-exit verify:**
```bash
grep -q 'spring-boot-starter-security' backend/rectrace/pom.xml && \
grep -q 'spring-boot-starter-security' rectrace-tlm-stats/pom.xml && \
test -f backend/rectrace/src/main/java/com/citi/gru/rectrace/config/SecurityConfig.java && \
test -f rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/config/SecurityConfig.java && \
mvn -f backend/rectrace/pom.xml -q test -Dtest=ContextLoadsTest && \
mvn -f rectrace-tlm-stats/pom.xml -q test -Dtest=TlmStatsApplicationTests
```

**Wave-exit commit:** `feat(01): permit-all SecurityFilterChain per module [BOOT-04,D-1.8,T-1-SEC-04]`

### Task 5.1 — Add `spring-boot-starter-security` to both POMs

- **Files:** `backend/rectrace/pom.xml`, `rectrace-tlm-stats/pom.xml`
- **Closes:** D-1.8, BOOT-04
- **Threat ref:** T-1-SEC-04 (the dep alone activates auto-config; the bean in task 5.2 makes it permit-all)
- **Bound to:** RESEARCH.md § Standard Stack line 162.
- **Action:** Add `<dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-security</artifactId></dependency>` to the `<dependencies>` block in both POMs. No version — Boot 3.5.14 BOM resolves Spring Security 6.3.x transitively (RESEARCH.md line 162). Place the dependency block alphabetically near the other `spring-boot-starter-*` entries for readability.
- **Verify:**
  - `<automated>grep -A1 'spring-boot-starter-security' backend/rectrace/pom.xml | grep -q 'spring-boot-starter-security' && grep -A1 'spring-boot-starter-security' rectrace-tlm-stats/pom.xml | grep -q 'spring-boot-starter-security' && mvn -f backend/rectrace/pom.xml -q -DskipTests dependency:resolve 2>&1 | grep -q 'spring-security'</automated>`
- **Done:** Both POMs declare the starter; Maven resolves it.

### Task 5.2 — Create `SecurityConfig.java` in both modules (permit-all + CSRF off)

- **Files (NEW):**
  - `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/SecurityConfig.java`
  - `rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/config/SecurityConfig.java`
- **Closes:** D-1.8, BOOT-04
- **Threat ref:** T-1-SEC-04
- **Bound to:** PATTERNS.md § "SecurityConfig.java (NEW — both modules)" + RESEARCH.md § Pattern 1 (lines 351-382, verbatim body).
- **Action:** Create each file with:
  - Package: `com.citi.gru.rectrace.config` (backend module) / `com.citi.gru.rectrace.tlmstats.config` (tlm-stats module).
  - Class annotations: `@Configuration` and `@EnableWebSecurity`.
  - One `@Bean` method `SecurityFilterChain securityFilterChain(HttpSecurity http)` that calls `http.csrf(csrf -> csrf.disable()).authorizeHttpRequests(authz -> authz.anyRequest().permitAll()).build()` and returns the chain.
  - Imports: `org.springframework.context.annotation.Bean`, `org.springframework.context.annotation.Configuration`, `org.springframework.security.config.annotation.web.builders.HttpSecurity`, `org.springframework.security.config.annotation.web.configuration.EnableWebSecurity`, `org.springframework.security.web.SecurityFilterChain`.
  - No `@Profile` annotation here — task 5.3 handles test-profile exclusion via `application-test.properties` instead (cleaner; PATTERNS.md line 108 lists both options and recommends extending the exclude list).
- **Verify:**
  - `<automated>test -f backend/rectrace/src/main/java/com/citi/gru/rectrace/config/SecurityConfig.java && test -f rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/config/SecurityConfig.java && grep -q 'permitAll' backend/rectrace/src/main/java/com/citi/gru/rectrace/config/SecurityConfig.java && grep -q 'permitAll' rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/config/SecurityConfig.java && grep -q 'csrf.*disable' backend/rectrace/src/main/java/com/citi/gru/rectrace/config/SecurityConfig.java</automated>`
- **Done:** Both files exist with permit-all + CSRF-disabled body.

### Task 5.3 — Verify or extend `application-test.properties` autoconfig-exclude for SecurityAutoConfiguration

- **Files:** `backend/rectrace/src/test/resources/application-test.properties`, `rectrace-tlm-stats/src/test/resources/application-test.properties`
- **Closes:** D-1.17 (Phase 0 D-05 carry-forward), T-1-SEC-05
- **Threat ref:** T-1-SEC-05
- **Bound to:** PATTERNS.md § "Permit-all SecurityFilterChain" line 462 + Phase 0 D-05 carry-forward.
- **Action:**
  1. Read both `application-test.properties` files. They each contain a `spring.autoconfigure.exclude=...` line listing the Oracle + ES auto-configurations excluded under the test profile (Phase 0 D-05).
  2. If `org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration` is already in the list (unlikely — Phase 0 didn't add Spring Security), no edit is needed and the context-load tests stay green because the new `SecurityConfig.java` `@Configuration` class will load but the `EnableWebSecurity` autoconfig won't fire any auth filter chain mid-test.
  3. If NOT in the list AND the context-load test fails on Wave 5 task 5.4: append `,org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration` (with comma) to the existing `spring.autoconfigure.exclude=` line in both files. This was the conservative path PATTERNS.md line 462 recommended; we exercise it only if the test fails.
  4. Alternative path (planner Discretion): if extending the exclude list is awkward (e.g., line is already long), instead add `@Profile("!test")` to the `SecurityConfig` class in each module. Either path satisfies D-1.17.
- **Verify:**
  - `<automated>mvn -f backend/rectrace/pom.xml -q test -Dtest=ContextLoadsTest && mvn -f rectrace-tlm-stats/pom.xml -q test -Dtest=TlmStatsApplicationTests</automated>`
- **Done:** Both context-load tests green with `spring-boot-starter-security` on the classpath.

### Task 5.4 — Wave-exit anonymous-endpoint smoke (paper-trail)

- **Files:** none (`01-SMOKE-CHECKLIST.md` is authored at Wave 8 task 8.1; this task records the in-wave verify expectation, not the artifact)
- **Closes:** D-1.8, BOOT-04 (proof)
- **Threat ref:** T-1-SEC-04 (full closure)
- **Bound to:** VALIDATION.md row BOOT-04.
- **Action:** This task is paperwork: record in `01-SMOKE-CHECKLIST.md` (created in Wave 8) the expectation that anonymous `curl` against the suggest endpoint returns `200` (not `401`). The live curl is executed at Wave 8 smoke step 5. No code change here.
- **Verify:** No-op — the actual smoke runs at Wave 8.
- **Done:** Wave 8's smoke checklist will include the anonymous-200 assertion.

### Wave 5 commit

`feat(01): permit-all SecurityFilterChain + spring-boot-starter-security [BOOT-04,D-1.8,T-1-SEC-04]`

---

## Wave 6: BOOT-08 cleanup quartet (printStackTrace + show_sql + HikariCP + AppConstants)

**Goal:** Fold the four "cheap during the upgrade" cleanup items into one wave: SLF4J migration in both holdouts, `show_sql=true` removal in properties, explicit HikariCP pool on the primary rectrace DataSource and the two tlm-stats DataSources, and `AppConstants.CITI_PORTAL_LOGIN_ID_HEADER` populated and referenced.

**Closes:** D-1.10, D-1.11, D-1.12, D-1.13; BOOT-08 (full closure); T-1-LOG-01, T-1-CFG-01.

**Wave-exit verify:**
```bash
! grep -rn 'printStackTrace\|System\.err' backend/rectrace/src/main rectrace-tlm-stats/src/main && \
! grep -rn 'show-sql=true\|hibernate\.show_sql' backend/rectrace/src/main rectrace-tlm-stats/src/main && \
grep -q 'CITI_PORTAL_LOGIN_ID_HEADER' backend/rectrace/src/main/java/com/citi/gru/rectrace/constants/AppConstants.java && \
mvn -f backend/rectrace/pom.xml -q test -Dtest=ContextLoadsTest && \
mvn -f rectrace-tlm-stats/pom.xml -q test -Dtest=TlmStatsApplicationTests
```

**Wave-exit commit:** `chore(01): BOOT-08 cleanup quartet — SLF4J + show_sql + Hikari + AppConstants [BOOT-08,D-1.10..1.13]`

### Task 6.1 — Migrate `ScriptExecutor.java` and `ExecutionOrderService.java:154-156` to SLF4J

- **Files:**
  - `backend/rectrace/src/main/java/com/citi/gru/rectrace/util/ScriptExecutor.java`
  - `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/ExecutionOrderService.java`
- **Closes:** D-1.10, BOOT-08 (item #1)
- **Threat ref:** T-1-LOG-01
- **Bound to:** PATTERNS.md § "ScriptExecutor.java — SLF4J migration" + § "ExecutionOrderService.java:154-156 — SLF4J fix" + RESEARCH.md § BOOT-08 Item 1 lines 708-742.
- **Action:**
  1. In `ScriptExecutor.java`: add `import org.slf4j.Logger; import org.slf4j.LoggerFactory;` and the field `private static final Logger logger = LoggerFactory.getLogger(ScriptExecutor.class);` near the top of the class. Replace the `catch (Exception e) { e.printStackTrace(); }` block at line 21-23 with `catch (Exception e) { logger.error("Failed to execute password script {} for service {} schema {}", scriptPath, serviceName, dbSchema, e); }`. Do NOT add `@Component` (PATTERNS.md line 217 — backend rectrace's `ScriptExecutor` is instantiated via `new` in `DataSourceConfig.java:41`, not Spring-injected; adding `@Component` is a wider refactor out of scope).
  2. In `ExecutionOrderService.java:154-156`: the `logger` field already exists at line 31 (PATTERNS.md line 227). Replace `} catch (Exception e) { System.err.println("Error reading CLOB"); return ""; }` with `} catch (Exception e) { logger.error("Error reading CLOB", e); return ""; }`.
  3. The `rectrace-tlm-stats` `ScriptExecutor.java` already uses SLF4J correctly (PATTERNS.md line 190) — no change.
- **Verify:**
  - `<automated>! grep -rn 'printStackTrace\|System\.err' backend/rectrace/src/main && mvn -f backend/rectrace/pom.xml -q -DskipTests compile</automated>`
- **Done:** Zero `printStackTrace` or `System.err` matches in either module's `src/main`.

### Task 6.2 — Remove `show-sql=true` from `application.properties`

- **Files:** `backend/rectrace/src/main/resources/application.properties`
- **Closes:** D-1.11, BOOT-08 (item #2 full closure)
- **Threat ref:** T-1-CFG-01
- **Bound to:** PATTERNS.md § "application.properties" + RESEARCH.md note line 256.
- **Action:** Edit `application.properties:3`: `spring.jpa.show-sql=true` → `spring.jpa.show-sql=false` (or delete the line entirely — Boot default is `false`). The companion in-Java setProperty at `DataSourceConfig.java:65` was already deleted at Wave 2 task 2.2. `application-local.properties:20` already had `show-sql=false` per PATTERNS.md line 256 — no edit there. `application-prod.properties` and `application-uat.properties` do not override the property per RESEARCH.md line 671 — no edit there.
- **Verify:**
  - `<automated>! grep -rn 'show-sql=true\|hibernate\.show_sql.*true' backend/rectrace/src/main rectrace-tlm-stats/src/main</automated>`
- **Done:** Zero `show-sql=true` substrings under `src/main` in either module.

### Task 6.3 — Add explicit HikariCP pool config to primary rectrace `DataSourceConfig` + tlm-stats `DatabaseConfig` (both DataSources)

- **Files:**
  - `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/DataSourceConfig.java`
  - `rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/config/DatabaseConfig.java`
- **Closes:** D-1.12, BOOT-08 (item #3)
- **Threat ref:** —
- **Bound to:** PATTERNS.md § "DataSourceConfig.java — HikariCP pool addition" + § "rectrace-tlm-stats/.../config/DatabaseConfig.java — Hikari + javax→jakarta + KNOWN GAP" + RESEARCH.md § Item 3 lines 784-822.
- **Action:**
  1. In `backend/rectrace/.../config/DataSourceConfig.java`: replace the existing `DataSourceBuilder` call in `dataSource()` with a `HikariConfig` block mirroring `AutosysDataSourceConfig.java:43-62` (PATTERNS.md lines 118-136). Add `@Value` fields with `datasource.hikari.*` property prefix (NOT `autosys.db.hikari.*`) and defaults matching the AutosysDataSourceConfig defaults (`maximumPoolSize:5`, `minimumIdle:2`, `connectionTimeout:30000`, `idleTimeout:600000`, `maxLifetime:1800000`). Set `config.setPoolName("Rectrace-HikariCP")`. Add the `oracle.jdbc.ReadTimeout` and `oracle.net.CONNECT_TIMEOUT` `addDataSourceProperty` lines.
  2. In `rectrace-tlm-stats/.../config/DatabaseConfig.java`: apply the same HikariConfig shape to `reconmgmtDataSource()` (around line 75-90) and `recportalDataSource()` (around line 102-118). Property prefixes: `reconmgmt.datasource.hikari.*` and `recportal.datasource.hikari.*`. Pool names `Reconmgmt-HikariCP` and `Recportal-HikariCP`. `TlmJdbcTemplateFactory.getJdbcTemplate(String)` at line 190 stays unchanged (CONCERNS LOW #2 deferred per PATTERNS.md line 182).
  3. The conditional script-executor wrap (the Phase 0.1 P07 KNOWN GAP closure) is a separate concern from HikariCP shape and lands at Wave 7. Coordinate: this task may leave the existing `String datasourcePassword = scriptExecutor.executeScript(...)` line in place for now; Wave 7 will wrap it. The HikariCP `config.setPassword(datasourcePassword)` call uses whatever the password variable holds.
- **Verify:**
  - `<automated>grep -q 'new HikariConfig' backend/rectrace/src/main/java/com/citi/gru/rectrace/config/DataSourceConfig.java && grep -c 'new HikariConfig' rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/config/DatabaseConfig.java | awk '{ if ($1 < 2) exit 1 }' && grep -q 'Rectrace-HikariCP' backend/rectrace/src/main/java/com/citi/gru/rectrace/config/DataSourceConfig.java && mvn -f backend/rectrace/pom.xml -q -DskipTests compile && mvn -f rectrace-tlm-stats/pom.xml -q -DskipTests compile</automated>`
- **Done:** Three new HikariConfig instances (rectrace primary + reconmgmt + recportal); both modules compile.

### Task 6.4 — Populate `AppConstants.CITI_PORTAL_LOGIN_ID_HEADER` and replace controller literals

- **Files:**
  - `backend/rectrace/src/main/java/com/citi/gru/rectrace/constants/AppConstants.java`
  - `backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/SearchController.java`
  - `backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/UserController.java`
  - `backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/v4/SearchControllerV4.java`
- **Closes:** D-1.13, BOOT-08 (item #4)
- **Threat ref:** —
- **Bound to:** PATTERNS.md § "AppConstants.java — populate" + § "SearchController.java" steps 5-6 + § "UserController.java" + § "SearchControllerV4.java" + RESEARCH.md § BOOT-08 Item 4 lines 851-875.
- **Action:**
  1. In `AppConstants.java`: add `public static final String CITI_PORTAL_LOGIN_ID_HEADER = "x-citiportal-loginid";` to the existing utility class (PATTERNS.md lines 265-272 — the private-constructor utility-class shape is preserved).
  2. In `SearchController.java`: delete the local `private static final String CITI_PORTAL_LOGIN_ID_HEADER = "x-citiportal-loginid";` field. Add `import com.citi.gru.rectrace.constants.AppConstants;`. Replace every `request.getHeader(CITI_PORTAL_LOGIN_ID_HEADER)` call with `request.getHeader(AppConstants.CITI_PORTAL_LOGIN_ID_HEADER)`.
  3. In `UserController.java`: same pattern as SearchController — delete local constant at line 19, replace getHeader at line 23, add the AppConstants import.
  4. In `SearchControllerV4.java`: replace `@RequestHeader(value = "x-citiportal-loginid", required = false) String userId` (at lines 29, 52, 92 per RESEARCH.md line 871) with `@RequestHeader(value = AppConstants.CITI_PORTAL_LOGIN_ID_HEADER, required = false) String userId`. Add the AppConstants import. PATTERNS.md line 360 confirms `public static final String` satisfies the compile-time-constant requirement for the annotation attribute.
- **Verify:**
  - `<automated>grep -q 'CITI_PORTAL_LOGIN_ID_HEADER = "x-citiportal-loginid"' backend/rectrace/src/main/java/com/citi/gru/rectrace/constants/AppConstants.java && ! grep -rn 'private static final String CITI_PORTAL_LOGIN_ID_HEADER' backend/rectrace/src/main && grep -c 'AppConstants\.CITI_PORTAL_LOGIN_ID_HEADER' backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/SearchController.java backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/UserController.java backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/v4/SearchControllerV4.java | awk -F: 'NR<=3 && $2 < 1 { print "MISSING in " $1; exit 1 } END { print "OK" }' && mvn -f backend/rectrace/pom.xml -q -DskipTests compile</automated>`
- **Done:** Constant populated; three controllers reference it; both modules compile cleanly.

### Wave 6 commit

`chore(01): BOOT-08 cleanup quartet — SLF4J + show_sql + Hikari + AppConstants [BOOT-08,D-1.10..1.13]`

---

## Wave 7: Phase 0.1 P07 KNOWN GAPS — conditional script-executor wrap

**Goal:** Close the two KNOWN GAPS handed from Phase 0.1 P07 (STATE.md lines 96-97): `DataSourceConfig.java:41-43` and `DatabaseConfig.java:80,108` unconditionally call `scriptExecutor.executeScript("/opt/rectify/control/scripts/get_password.sh", ...)` even when `datasource.password` is supplied. The fix is to wrap each call in `if (password == null || password.isBlank())`. Line 190 of `DatabaseConfig.java` (the `TlmJdbcTemplateFactory.getJdbcTemplate(String)` per-instance call) is **out of scope** — CONCERNS LOW #2 explicitly deferred per PATTERNS.md line 182.

**Closes:** STATE.md KNOWN GAP (a) and (b); T-1-CFG-02; D-1.17 verification.

**Wave-exit verify:**
```bash
grep -q 'isBlank' backend/rectrace/src/main/java/com/citi/gru/rectrace/config/DataSourceConfig.java && \
grep -c 'isBlank' rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/config/DatabaseConfig.java | awk '{ if ($1 < 2) exit 1 }' && \
grep -c '@Profile("!test")' backend/rectrace/src/main/java/com/citi/gru/rectrace/config/DataSourceConfig.java backend/rectrace/src/main/java/com/citi/gru/rectrace/config/AutosysDataSourceConfig.java backend/rectrace/src/main/java/com/citi/gru/rectrace/service/ExecutionOrderService.java backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/SearchController.java backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/v4/SearchControllerV4.java rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/config/DatabaseConfig.java | awk -F: '$2 < 1 { print "MISSING: " $1; exit 1 } END { print "ALL PRESENT" }' && \
mvn -f backend/rectrace/pom.xml -q test -Dtest=ContextLoadsTest && \
mvn -f rectrace-tlm-stats/pom.xml -q test -Dtest=TlmStatsApplicationTests
```

**Wave-exit commit:** `fix(01): close Phase 0.1 P07 KNOWN GAPS — wrap script-executor in isBlank() guard [T-1-CFG-02,STATE-GAP-a,b]`

### Task 7.1 — Wrap `DataSourceConfig.java:41-43` script-executor call in `isBlank()` conditional

- **Files:** `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/DataSourceConfig.java`
- **Closes:** STATE.md KNOWN GAP (a), T-1-CFG-02
- **Threat ref:** T-1-CFG-02
- **Bound to:** PATTERNS.md § "DataSourceConfig.java" bullet 2 lines 154-155 + RESEARCH.md § Item 3 lines 791-805.
- **Action:** Add a `@Value("${datasource.password:}")` field near the existing `@Value("${datasource.url}")` / `@Value("${datasource.username}")` fields. The empty default `:` makes the field empty when the property is unset (don't use `${datasource.password}` without a default — Spring will fail to bind). Then wrap the existing `String datasourcePassword = scriptExecutor.executeScript("/opt/rectify/control/scripts/get_password.sh", ...)` (lines 41-43 per STATE.md) in:
  ```
  if (datasourcePassword == null || datasourcePassword.isBlank()) {
      datasourcePassword = scriptExecutor.executeScript("/opt/rectify/control/scripts/get_password.sh", serviceName, dbSchema);
  }
  ```
  The local-profile `application-local.properties` already supplies `datasource.password` (Phase 0.1 P07 lines 95 of STATE.md), so under the `local` profile the script call is skipped entirely. Under prod/uat the script call still runs as before — behavior preserved for those profiles.
- **Verify:**
  - `<automated>grep -q '@Value("\${datasource\.password:}")' backend/rectrace/src/main/java/com/citi/gru/rectrace/config/DataSourceConfig.java && grep -q 'isBlank' backend/rectrace/src/main/java/com/citi/gru/rectrace/config/DataSourceConfig.java && mvn -f backend/rectrace/pom.xml -q -DskipTests compile</automated>`
- **Done:** Script call guarded; `@Value("${datasource.password:}")` field present; module compiles.

### Task 7.2 — Wrap `DatabaseConfig.java:80,108` script-executor calls in `isBlank()` conditional (line 190 stays per CONCERNS LOW #2 defer)

- **Files:** `rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/config/DatabaseConfig.java`
- **Closes:** STATE.md KNOWN GAP (b), T-1-CFG-02
- **Threat ref:** T-1-CFG-02
- **Bound to:** PATTERNS.md § "rectrace-tlm-stats/.../config/DatabaseConfig.java" lines 161-183 + RESEARCH.md § Item 3 lines 839-844.
- **Action:** Add two `@Value` fields with empty defaults: `@Value("${reconmgmt.datasource.password:}")` and `@Value("${recportal.datasource.password:}")`. Wrap the `scriptExecutor.executeScript(...)` calls in `reconmgmtDataSource()` (line 80) and `recportalDataSource()` (line 108) in the same `if (password == null || password.isBlank())` pattern as task 7.1. The third call site at line 190 (`TlmJdbcTemplateFactory.getJdbcTemplate(String)`) is **out of scope per CONCERNS LOW #2 / PATTERNS.md line 182** — the per-instance dynamic Oracle connections in tlm-stats stay as-is; only the two main DataSource beans are wrapped.
- **Verify:**
  - `<automated>grep -c '@Value("\${\(reconmgmt\|recportal\)\.datasource\.password:}")' rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/config/DatabaseConfig.java | awk '{ if ($1 < 2) exit 1 }' && grep -c 'isBlank' rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/config/DatabaseConfig.java | awk '{ if ($1 < 2) exit 1 }' && mvn -f rectrace-tlm-stats/pom.xml -q -DskipTests compile</automated>`
- **Done:** Two script calls (lines 80 and 108) guarded; line 190 untouched; module compiles.

### Task 7.3 — Verify all Phase 0 `@Profile("!test")` guards survive the migration (D-1.17 closure)

- **Files:** none (verification-only task)
- **Closes:** D-1.17 (full closure)
- **Threat ref:** —
- **Bound to:** PATTERNS.md § "@Profile(\"!test\") guard" line 460.
- **Action:** Run the grep below to confirm every file Phase 0 annotated with `@Profile("!test")` still carries the annotation after Waves 1-7. The list is sourced from PATTERNS.md line 461 (Phase 0 D-05 carry-forward):
  - `DataSourceConfig` (rectrace)
  - `AutosysDataSourceConfig` (rectrace)
  - `ExecutionOrderService` (rectrace)
  - `SearchController` (rectrace)
  - `SearchControllerV4` (rectrace)
  - `DatabaseConfig` (tlm-stats)
  - V3/V4 services Phase 0 may have annotated — verify by grep.
- **Verify:**
  - `<automated>grep -c '@Profile("!test")' backend/rectrace/src/main/java/com/citi/gru/rectrace/config/DataSourceConfig.java backend/rectrace/src/main/java/com/citi/gru/rectrace/config/AutosysDataSourceConfig.java backend/rectrace/src/main/java/com/citi/gru/rectrace/service/ExecutionOrderService.java backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/SearchController.java backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/v4/SearchControllerV4.java rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/config/DatabaseConfig.java | awk -F: 'NR<=6 && $2 < 1 { print "MISSING in " $1; exit 1 } END { print "ALL 6 PRESENT" }'</automated>`
- **Done:** All six files still carry `@Profile("!test")`.

### Wave 7 commit

`fix(01): wrap unconditional scriptExecutor.executeScript in isBlank() guard [T-1-CFG-02,STATE-GAP-a,b,D-1.17]`

---

## Wave 8: Smoke checklist authoring + ROADMAP update + verification artifacts

**Goal:** Author `01-SMOKE-CHECKLIST.md` (the BOOT-09 manual smoke contract — planner Discretion per CONTEXT.md line 87), execute it against the `local` profile against the sibling `../rectrace-local-dev/` stack, update `ROADMAP.md` Phase 1 description to lock the actual versions (3.5.14 + Java 21), and capture smoke results inline in the checklist. This wave is the **only non-autonomous wave** — the manual UI smoke steps for execution-order graph, TLM-stats modal, and QuickRec modal are deferred to user verification with explicit step recipes (same pattern as Phase 0.1 P07).

**Closes:** BOOT-09 (full closure); planner Discretion items (smoke checklist + ROADMAP edit).

**Wave-exit verify:**
```bash
test -f .planning/phases/01-backend-platform-upgrade/01-SMOKE-CHECKLIST.md && \
grep -q '3.5.14' .planning/ROADMAP.md && \
grep -q 'Java 21' .planning/ROADMAP.md && \
mvn -f backend/rectrace/pom.xml clean test && \
mvn -f rectrace-tlm-stats/pom.xml clean test
```

**Wave-exit commit:** `docs(01): BOOT-09 smoke checklist + ROADMAP Boot 3.5.14 + Java 21 lock [BOOT-09]`

### Task 8.1 — Author `01-SMOKE-CHECKLIST.md` with BOOT-09 step list

- **Files (NEW):** `.planning/phases/01-backend-platform-upgrade/01-SMOKE-CHECKLIST.md`
- **Closes:** BOOT-09 (artifact), CONTEXT.md Discretion line 87
- **Threat ref:** T-1-SEC-04 (anonymous-200 step), T-1-LOG-01 + T-1-CFG-01 (printStackTrace/show_sql absent step)
- **Bound to:** VALIDATION.md § BOOT-09 Manual Smoke lines 60-114 + CONTEXT.md Discretion line 87.
- **Action:** Create the checklist with the 9 numbered steps from VALIDATION.md lines 64-113, verbatim, plus a results table at the bottom for capturing pass/fail per step at smoke execution time. The 9 steps are:
  1. Pre-flight: `cd ../rectrace-local-dev && docker compose ps` (both containers running); `./bin/apply.py --verify` (5 Oracle rows + 5 ES docs).
  2. `backend/rectrace` boots on `local`: `JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn spring-boot:run -Dspring-boot.run.profiles=local` — expect "Tomcat started on port 6088" + "Using dialect: org.hibernate.dialect.OracleDialect" + NO "Using generated security password".
  3. V4 keyword search returns 3 rows: `curl -s 'http://localhost:6088/rectrace/api/v4/search/initial?searchTerm=SAMPLE&category=rectrace_core' -H 'x-citiportal-loginid: smoke-test' | jq '.results | length'` → 3.
  4. `/api/search/suggest` returns 200: `curl -s -o /dev/null -w "%{http_code}\n" 'http://localhost:6088/rectrace/api/search/suggest?prefix=SET'` → 200.
  5. Hyphenated keyword (Phase 8 prerequisite): `searchTerm=SET-ABC-123` returns 1 row.
  6. Anonymous-200 (SecurityFilterChain permit-all): `curl -s -o /dev/null -w "%{http_code}\n" 'http://localhost:6088/rectrace/api/search/suggest?prefix=AB'` → 200, NOT 401. (T-1-SEC-04 closure.)
  7. Execution-order endpoint returns sequence: `curl ... /api/execution-order/LOAD-ABC-123 | jq '.executionSequence | length'` → ≥ 1.
  8. printStackTrace / show_sql absent from startup log: `grep -E "show_sql|printStackTrace"` on stdout → empty output. (T-1-LOG-01 + T-1-CFG-01 closure.)
  9. `rectrace-tlm-stats` boots on local profile: `JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn spring-boot:run -Dspring-boot.run.profiles=local` → "Tomcat started on port 8080" + actuator health 200.

  Plus three **manual UI smoke** items deferred to user (same pattern as Phase 0.1 P07 SUMMARY.md): execution-order graph rendering, TLM-stats modal, QuickRec modal. Document the click-path recipe for each (VALIDATION.md lines 131-134 supplies them).

  At the bottom of the file, add a "Results" table with columns: Step | Status (PASS/FAIL/DEFERRED) | Notes | Date. The executor fills it in during task 8.2.
- **Verify:**
  - `<automated>test -f .planning/phases/01-backend-platform-upgrade/01-SMOKE-CHECKLIST.md && grep -q 'Anonymous-200\|permit-all' .planning/phases/01-backend-platform-upgrade/01-SMOKE-CHECKLIST.md && grep -q '## Results' .planning/phases/01-backend-platform-upgrade/01-SMOKE-CHECKLIST.md</automated>`
- **Done:** Checklist file exists with all 9 automatable steps + 3 deferred manual UI steps + empty Results table.

### Task 8.2 — Execute the smoke checklist; capture results inline

- **Files:** `.planning/phases/01-backend-platform-upgrade/01-SMOKE-CHECKLIST.md` (the Results table is filled in here)
- **Closes:** BOOT-09 (execution)
- **Threat ref:** Every threat row marked ADDRESSED is exercised here.
- **Type:** `checkpoint:human-verify` — the 3 UI steps require the user. The 9 automatable steps Claude executes directly.
- **Bound to:** VALIDATION.md § BOOT-09 Manual Smoke + Wave 8 task 8.1's checklist.
- **Action:**
  1. Verify the sibling `../rectrace-local-dev/` stack is up (`docker compose ps` shows both containers; `./bin/apply.py --verify` returns 5+5).
  2. Execute steps 1-9 from `01-SMOKE-CHECKLIST.md` in order. Capture exit code / output per step in the Results table.
  3. Steps 4, 5, 6 (UI smoke) — emit a checkpoint message to the user with the click-path recipe and wait for the user to type "PASS" or "FAIL: <notes>". Record verbatim in the Results table.
  4. If any of steps 1-9 FAIL, halt the wave and report failure. Steps 1-9 are blocking. Manual UI steps are non-blocking — record DEFERRED if the user opts to defer (same pattern as Phase 0.1 P07).
- **Verify:**
  - `<automated>grep -q '| 1 .*PASS' .planning/phases/01-backend-platform-upgrade/01-SMOKE-CHECKLIST.md && grep -q '| 9 .*PASS' .planning/phases/01-backend-platform-upgrade/01-SMOKE-CHECKLIST.md</automated>` — first and last automatable steps both green.
  - Anything other than 9/9 PASS on automatable steps blocks wave-exit commit.
- **Done:** Results table populated; 9/9 automatable steps green; UI steps either PASS or DEFERRED per user.

### Task 8.3 — Update ROADMAP.md Phase 1 to lock actual versions

- **Files:** `.planning/ROADMAP.md`
- **Closes:** D-1.2 (ROADMAP propagation), CONTEXT.md "Specifics" call for explicit version in roadmap.
- **Threat ref:** —
- **Bound to:** CONTEXT.md "Phase Boundary" line 23 + RESEARCH.md ADDENDUM lines 9-34.
- **Action:** Edit `.planning/ROADMAP.md` Phase 1 section:
  - Line 5 (Overview paragraph): "Spring Boot 2.7 → 3.2, Java 17/21" → "Spring Boot 2.7 → **3.5.14**, Java **21**".
  - Line 15 (the Phase 1 bullet in the phase list): "Spring Boot 2.7 → 3.2" → "Spring Boot 2.7 → **3.5.14**". "Java 17/21" → "**Java 21**".
  - Line 60 (Phase 1 Goal): "Spring Boot 3.2.x and Java 17/21" → "**Spring Boot 3.5.14** and **Java 21**".
  - Line 64 (Success Criterion #1): "Spring Boot 3.2.x and Java 17 (or 21 if Citi VM supports)" → "**Spring Boot 3.5.14** and **Java 21**".
  - Line 67 (Success Criterion #4): "tests pass on 3.2" → "tests pass on **3.5.14**".
  - Phase 1 row in the Progress table (line 184): "0/TBD" → "8/8" (8 waves, all complete by this point in execution). "Not started" → "Complete". Add date "2026-05-12" or actual date.
  - Phase 1 "Plans: TBD" → "Plans: 1 plan (8 waves)".
- **Verify:**
  - `<automated>grep -q '3\.5\.14' .planning/ROADMAP.md && grep -q '\*\*Java 21\*\*' .planning/ROADMAP.md && ! grep -q '3\.2\.x' .planning/ROADMAP.md && ! grep -q '17 (or 21' .planning/ROADMAP.md</automated>`
- **Done:** ROADMAP.md reflects locked versions; no stale "3.2.x" or "17 or 21" strings remain.

### Task 8.4 — Final full-suite test + wave-exit commit

- **Files:** none (build/test only)
- **Closes:** BOOT-09 (final test gate)
- **Threat ref:** —
- **Bound to:** VALIDATION.md § "Full suite command" line 25.
- **Action:** Run the full Maven test suite across both modules per VALIDATION.md sampling rate "Before /gsd-verify-work":
  ```bash
  mvn -f backend/rectrace/pom.xml clean test
  mvn -f rectrace-tlm-stats/pom.xml clean test
  ```
  Both must exit 0. Estimated runtime ~60-90s combined per VALIDATION.md line 27.
- **Verify:**
  - `<automated>mvn -f backend/rectrace/pom.xml clean test && mvn -f rectrace-tlm-stats/pom.xml clean test</automated>`
- **Done:** Full suite green; ready for wave-exit commit.

### Wave 8 commit

`docs(01): BOOT-09 smoke checklist + ROADMAP Boot 3.5.14 + Java 21 lock [BOOT-09]`

---

## Out-of-scope explicit exclusions

Verbatim from CONTEXT.md "Out of scope for Phase 1" (lines 25-35):

- Auth mechanism choice and `x-citiportal-loginid` header validation — Phase 9 (SEC-01).
- CORS lock-down — Phase 9 (SEC-05).
- ES SSL truststore work; production-grade dev-bypass removal — Phase 9 (SEC-03, SEC-04). (Note: Phase 1 deletes `ElasticsearchDevConfiguration.java` per planner Discretion, but does NOT install the real truststore.)
- AG-Grid Enterprise license env-var wiring — out of phase; frontend-side, tied to React Foundation rollout.
- Long-file refactors / splitting `SearchServiceV4`, `OracleServiceV4`, `ExecutionOrderService` — Round 2 cleanup phase.
- Parent aggregator POM at repo root — build-hygiene phase.
- Renaming Angular `search-v5/` to `search-v4/` — Angular decommission path.
- TeamCity / Lightspeed / uDeploy CI wiring — Phase 0 D-03 deferred to Phase 8 / backlog.
- New integration tests against real Oracle / ES (e.g. Testcontainers) — deferred.
- Schema migrations / Liquibase / Flyway — not introduced.
- Uncommenting `clobToString` lines in `ExecutionOrderService` — Phase 8.
- `TlmJdbcTemplateFactory.getJdbcTemplate(String)` per-instance script call at `DatabaseConfig.java:190` — CONCERNS LOW #2 deferred per PATTERNS.md line 182.

---

## Multi-Source Coverage Audit

Every CONTEXT.md decision, REQUIREMENTS.md item, RESEARCH.md feature, and ROADMAP.md goal is mapped to a task or explicitly excluded.

### GOAL (ROADMAP.md Phase 1)

| Goal item | Covered by | Status |
|---|---|---|
| Both modules build/boot on Boot 3.5.14 + Java 21 | Wave 1, Wave 8 task 8.2 step 2/9 | COVERED |
| All `javax.*` → `jakarta.*` | Wave 1 task 1.3 | COVERED |
| `SecurityFilterChain` configured (no `WebSecurityConfigurerAdapter`) | Wave 5 task 5.2 | COVERED |
| Tests pass on 3.5.14 + smoke confirms search/exec-order/TLM | Wave 8 tasks 8.2, 8.4 | COVERED |
| `printStackTrace`/`show_sql`/CONCERNS items gone | Waves 3, 6 | COVERED |

### REQ (REQUIREMENTS.md BOOT-01..09)

| REQ ID | Covered by | Status |
|---|---|---|
| BOOT-01 (Java 21) | Wave 1 tasks 1.1, 1.2 | COVERED |
| BOOT-02 (Boot 3.5.14) | Wave 1 tasks 1.1, 1.2 | COVERED |
| BOOT-03 (jakarta sweep) | Wave 1 task 1.3 | COVERED |
| BOOT-04 (SecurityFilterChain) | Wave 5 tasks 5.1, 5.2, 5.3 | COVERED |
| BOOT-05 (Hibernate 6 / JPA 3) | Wave 2 tasks 2.1, 2.2, 2.3 | COVERED |
| BOOT-06 (ES client) | Wave 4 tasks 4.1, 4.2, 4.3 | COVERED |
| BOOT-07 (dependency-pin refresh — let BOM resolve) | Wave 1 (no `<dependencyManagement>` added), Wave 8 task 8.2 | COVERED |
| BOOT-08 (cleanup quartet + V3 dead code + frontend dead code) | Waves 3, 6 | COVERED |
| BOOT-09 (tests + smoke green) | Wave 8 tasks 8.2, 8.4 | COVERED |

**All 9 REQ items covered. Zero gaps.**

### RESEARCH (01-RESEARCH.md key features)

| Research item | Covered by | Status |
|---|---|---|
| 15-line javax→jakarta inventory | Wave 1 task 1.3 (14 active + 1 deleted with v3/) | COVERED |
| Boot 3.5.14 BOM pin (no overrides) | Wave 1 task 1.1 + addendum lock | COVERED |
| Hibernate `OracleDialect` swap (3 references) | Wave 2 tasks 2.1, 2.2 | COVERED |
| ES Java API Client migration (Patterns 3, 4) | Wave 4 tasks 4.1, 4.2 | COVERED |
| `ElasticsearchDevConfiguration` deletion recommendation | Wave 4 task 4.3 | COVERED |
| Spring Security bean (Pattern 1, both modules) | Wave 5 task 5.2 | COVERED |
| BOOT-08 quartet (4 file:line diffs) | Wave 6 tasks 6.1-6.4 | COVERED |
| Phase 0.1 KNOWN GAP closure (Item 3, lines 791-822) | Wave 7 tasks 7.1, 7.2 | COVERED |
| BOOT-09 smoke contract | Wave 8 task 8.1 | COVERED |

**Out-of-scope items in RESEARCH:** dev SSL truststore install (Phase 9 SEC-03/04), `TlmJdbcTemplateFactory` per-instance script call (CONCERNS LOW #2 deferred). Both explicitly excluded.

### CONTEXT (D-1.1 .. D-1.19)

| Decision | Covered by | Status |
|---|---|---|
| D-1.1 Java 21 | Wave 1 tasks 1.1, 1.2 | COVERED |
| D-1.2 Boot 3.5.14 | Wave 1 tasks 1.1, 1.2; Wave 8 task 8.3 (ROADMAP propagation) | COVERED |
| D-1.3 Cross-module version lockstep | Wave 1 tasks 1.1 + 1.2 verify-diff | COVERED |
| D-1.4 ES Java API Client | Wave 4 tasks 4.1, 4.2 | COVERED |
| D-1.5 V3 trio deletion | Wave 3 tasks 3.1, 3.2 | COVERED |
| D-1.6 SuggestionService + ESV4 migrated; `/api/search/suggest` URL preserved | Wave 4 tasks 4.1, 4.2; Wave 3 task 3.2 (keeps SearchController) | COVERED |
| D-1.7 Frontend dead code | Wave 3 task 3.3 | COVERED |
| D-1.8 SecurityFilterChain per module | Wave 5 task 5.2 | COVERED |
| D-1.9 No header validation (defer to Phase 9) | Wave 5 task 5.2 (permit-all body) + Threat Model T-1-SEC-01 row | COVERED (by deferral) |
| D-1.10 SLF4J in ScriptExecutor + ExecutionOrderService | Wave 6 task 6.1 | COVERED |
| D-1.11 `show-sql=false` + delete in-Java setProperty | Wave 2 task 2.2 + Wave 6 task 6.2 | COVERED |
| D-1.12 Explicit HikariCP on primary rectrace + 2 tlm-stats DSs | Wave 6 task 6.3 | COVERED |
| D-1.13 `AppConstants.CITI_PORTAL_LOGIN_ID_HEADER` populate + use | Wave 6 task 6.4 | COVERED |
| D-1.14 `application-local.properties` already exist (Phase 0.1 P07) | Wave 2 task 2.1 (only dialect string edit needed) | COVERED |
| D-1.15 No Docker-shaped artifacts | Plan adds zero `docker-compose.yml`, `Dockerfile`, Testcontainers dep | COVERED (by absence) |
| D-1.16 Tests stay at context-load level | No new test files in any task; BOOT-09 smoke is manual | COVERED |
| D-1.17 `@Profile("!test")` guards preserved | Wave 1 task 1.3 verify + Wave 7 task 7.3 final verify | COVERED |
| D-1.18 Convention only (Phase 2+ consumes) | No Phase 1 task needed; documented in Threat Model section | COVERED (by recording) |
| D-1.19 Phase 0.1 prerequisite — COMPLETE | STATE.md confirms; smoke checklist references `../rectrace-local-dev/` | COVERED (prerequisite met) |

**All 19 decisions closed. Zero gaps.**

### Deferred items NOT in this plan (correctly excluded)

Verified against CONTEXT.md "Deferred Ideas" lines 227-247. Zero deferred ideas appear as plan tasks. Spot-check:
- Round 2 cleanup phase (long-file splits) — NOT planned ✓
- Backend V4 → V5 rename — NOT planned ✓
- `clobToString` uncomment — NOT planned ✓
- `statusses` typo fix — NOT planned ✓
- AG-Grid license env-var wiring — NOT planned ✓
- Testcontainers — NOT planned ✓

---

## Open Questions for Plan Checker

These are areas where the planner made a call that the checker should validate:

1. **Discretion — `SearchController` post-V3 shape.** Plan KEEPS `SearchController` as a slimmed-down single-endpoint controller hosting `/api/search/suggest` (Wave 3 task 3.2 + Wave 6 task 6.4 reference it). The alternative — fold the endpoint into `SearchControllerV4` — is also acceptable per CONTEXT.md line 90. Rationale: package hygiene; `SearchControllerV4` already owns the `/api/v4/*` namespace and mixing a `/api/search/suggest` endpoint there blurs that. Checker: confirm this is consistent with codebase conventions.

2. **Discretion — `AppConstants` populate vs delete.** Plan POPULATES per D-1.13 (Wave 6 task 6.4). The alternative was delete the class. Rationale: D-1.13 said "prefer populate"; only one constant is added in this phase (`CITI_PORTAL_LOGIN_ID_HEADER`) but Phase 5 SQL / Phase 6 Loader will likely add more shared strings, so retiring the class now would just bring it back later. Checker: confirm no objection.

3. **Discretion — `SearchConfigServiceV3.java` deletion.** Plan DELETES it in Wave 3 task 3.1 (alongside the V3 trio) rather than rewriting the `javax.annotation.PostConstruct` import. Rationale: RESEARCH.md line 687 confirms zero remaining callers post-V3-trio-deletion; the file is orphaned. Checker: verify call-graph one more time before approval.

4. **Discretion — `ElasticsearchDevConfiguration.java` deletion.** Plan DELETES in Wave 4 task 4.3 per RESEARCH.md line 695 recommendation. Rationale: local profile uses HTTP, Phase 9 owns prod truststore install, no current caller. Checker: confirm Phase 9's planning takes this into account — Phase 9 will need to add a fresh truststore-aware bean, not modify the deleted file.

5. **Discretion — Task 5.3 split path.** Plan exercises the autoconfig-exclude extension only IF the context-load test fails. Alternative: `@Profile("!test")` on `SecurityConfig`. Either satisfies D-1.17. Checker: no action needed; this is a conditional and the verify command is the gate.

6. **Wave 1 mixes POM bump + jakarta sweep in one commit.** Rationale: POM bump alone leaves `mvn compile` red because `javax.servlet.*` etc. are unresolvable on the new Boot 3.5.14 BOM. The first commit that compiles green is the POM+sweep commit, so it is the right bisect anchor. Splitting into two commits would create a transient red commit in history, breaking bisectability for one of the listed must-haves. Checker: confirm bisectability rule is satisfied by atomic-per-wave (not atomic-per-task) commits.

7. **`@MockBean` deprecation in Boot 3.4+.** VALIDATION.md line 121 flagged that `@MockBean` is deprecated in Boot 3.4+ and recommends migration to `@MockitoBean` IF a deprecation warning surfaces. Plan does NOT pre-emptively migrate (only `TlmStatsApplicationTests` uses `@MockBean` per Phase 0); the migration is folded into Wave 8 task 8.4 only if a warning surfaces. Checker: confirm this conditional approach is acceptable, or add an explicit wave task.

8. **Wave 7 line 190 of `DatabaseConfig.java` deliberately untouched.** Per PATTERNS.md line 182 + CONCERNS LOW #2 deferral. The `TlmJdbcTemplateFactory.getJdbcTemplate(String)` per-instance call at line 190 still calls `scriptExecutor.executeScript` unconditionally. This is a known minor gap that the plan explicitly does not fix. Checker: confirm acceptance with this scope.

---

## PLAN COMPLETE
