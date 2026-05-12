# Phase 1: Backend Platform Upgrade — Research

**Researched:** 2026-05-12
**Domain:** Java 17 → 21 + Spring Boot 2.7.16 → **3.5.14** migration across two Maven modules + Elasticsearch HLRC → Java API Client migration on live search paths + V3 dead-code removal + BOOT-08 cleanup quartet.
**Confidence:** HIGH on stack/migration mechanics (Context7 + Maven Central + official docs verified). The Boot-line EOL question that was MEDIUM-confidence at research time has been resolved (see addendum below).

---

## ADDENDUM — Boot Line Resolution (2026-05-12, post-research)

The "Open Question" the researcher surfaced (Boot 3.3 vs 3.5) was resolved during the plan-phase orchestration after independent re-verification against endoflife.date and spring.io:

| Line | OSS support ends | Commercial support ends | Status |
|---|---|---|---|
| 3.3 | 2025-06-30 (already EOL) | 2026-06-30 (~6 wks) | Dead end |
| 3.4 | 2025-12-31 (already EOL) | 2026-12-31 (~7 mo) | Short runway |
| **3.5** | **2026-06-30 (~6 wks)** | **2032-06-30 (6 yrs)** | **Chosen — current OSS line + longest commercial support** |
| 4.0 | 2026-12-31 | 2027-12-31 | Major version (Spring FW 7) — additional migration surface beyond this phase |

**Lock: `spring-boot-starter-parent` = `3.5.14`.** CONTEXT.md D-1.2 has been amended in lockstep with this addendum.

Everywhere in the body of this RESEARCH.md that says "Boot 3.3.13", "Boot 3.3 BOM", or "3.3.x", read it as **"Boot 3.5.14"** / **"Boot 3.5 BOM"** / **"3.5.x"**. The researcher explicitly flagged that "the migration mechanics are identical between 3.3.x, 3.4.x, and 3.5.x" — no other change to the body is required.

**Transitive versions to expect under Boot 3.5.14 BOM** (planner verifies at plan-time, NEVER override):
- Spring Framework 6.2.x (not 6.1.x as the 3.3 body implies)
- Hibernate ORM 6.6.x (not 6.5.x)
- ES Java Client 8.15.x or 8.17.x (not 8.13.x — verify exact patch via `mvn dependency:tree`)
- Micrometer 1.14.x
- Jackson 2.18.x
- HikariCP 5.1.x
- Lombok 1.18.34+ — confirmed JDK 21-clean

**`${oracle-database.version}`** property (called out as a 3.3-era pitfall in the body) is still BOM-managed in 3.5 and still defaults to a 21.x patch — the body's guidance to "drop any explicit `<version>` on `ojdbc8`" still applies verbatim.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Version targets**

- **D-1.1:** Java target is **Java 21** for both modules. `<java.version>21</java.version>` and `<maven.compiler.release>21</maven.compiler.release>` in both `pom.xml`. Planner must verify the deployment VM has JDK 21+ before the upgrade ships (success criterion #1 in ROADMAP.md).
- **D-1.2:** Spring Boot line is **3.3.x LTS** (the commercial LTS line recommended by `CONCERNS.md` HIGH #3, not the 3.2.x that ROADMAP.md currently lists). Planner picks the exact patch version at plan time (latest 3.3.x patch). ROADMAP.md is updated in this phase to reflect 3.3.x.
- **D-1.3:** Both modules pin **identical** `spring-boot.version` and `java.version` properties. Any future bump must be applied to both. No drift permitted.

**Elasticsearch client strategy**

- **D-1.4:** Migrate to the new **Java API Client** (`co.elastic.clients.elasticsearch.ElasticsearchClient`) for the live ES code paths. `RestHighLevelClient` is dropped from the codebase entirely — no compat dep added.
- **D-1.5:** `SearchServiceV3`, `OracleSearchProviderV3`, `ElasticsearchSearchProviderV3` are **deleted**. The three V3 endpoints in `SearchController` (`/v3/search/keyword`, `/v3/search/expand`, `/v3/search/ssrm/{category}`) are **removed**.
- **D-1.6:** **Kept and migrated**: `SuggestionService` (preserving the `/api/search/suggest` URL contract — V5 frontend autocomplete depends on it) and `ElasticsearchServiceV4`. Planner picks whether to move `/api/search/suggest` into `SearchControllerV4` or leave it as a slimmed-down `SearchController`.
- **D-1.7:** Frontend dead code removed in lockstep: `frontend/rectrace/src/app/services/search.service.ts` and `search.service.spec.ts` are deleted (CONCERNS MEDIUM #4). Removal verified by grep — no remaining import / dynamic load.

**Spring Security scope**

- **D-1.8:** One `SecurityFilterChain` bean per module — both **permit all** and **disable CSRF** (REST API, stateless). No header validation, no CORS change, no auth filter.
- **D-1.9:** Header validation for `x-citiportal-loginid` is **explicitly deferred to Phase 9 (SEC-01)**. Controllers continue reading the header via `@RequestHeader(required = false)` exactly as they do today.

**BOOT-08 cleanup scope**

- **D-1.10:** `e.printStackTrace()` in `ScriptExecutor.java` and `System.err.println("Error reading CLOB")` in `ExecutionOrderService.clobToString` replaced with `logger.error("...", e)`. Whether to uncomment the CLOB lines is **out of scope** — Phase 8 territory if ever lands.
- **D-1.11:** `spring.jpa.show-sql=false` set in `application.properties`. `properties.setProperty("hibernate.show_sql", "true")` in `DataSourceConfig` removed entirely.
- **D-1.12:** Explicit `HikariCP` pool config added to primary rectrace `DataSourceConfig.dataSource()`, mirroring `AutosysDataSourceConfig`. Same treatment for the two TLM-stats DataSources (`reconmgmt`, `recportal`) in `DatabaseConfig.java`.
- **D-1.13:** `AppConstants.java` is **populated** with `public static final String CITI_PORTAL_LOGIN_ID_HEADER = "x-citiportal-loginid"`; the duplicated literals in `SearchController` / `UserController` / `SearchControllerV4` are replaced with the constant. (Delete is the alternative — planner picks.)

**Local dev profile**

- **D-1.14:** `application-local.properties` files already exist (Phase 0.1 P07 landed them as scope concession). Phase 1 inherits them as-is and may refine if 3.3.x property names change.
- **D-1.15:** **Nothing Docker-shaped** lands in the repo.
- **D-1.16:** Tests stay at Phase 0's context-load level. No integration tests added in this phase. BOOT-09 verification is the user's manual smoke against the `local` profile.
- **D-1.17:** All `@Profile("!test")` annotations from Phase 0 are **preserved** across the migration.

**Project-level convention (cross-cutting)**

- **D-1.18:** New React frontend (Phase 2+) uses **V4 nomenclature** to match backend URL contracts. Angular `search-v5/` decommissions by attrition.

**Phase ordering implication**

- **D-1.19:** Phase 0.1 (Local Dev Seed Bootstrap) — **COMPLETE** (verified in STATE.md; 7/7 plans landed, two KNOWN GAPS handed to Phase 1 BOOT-08).

### Claude's Discretion

- **Commit shape**: incremental staged commits per BOOT-NN vs larger commits. Bias toward bisectable atomic commits.
- **BOOT-09 smoke definition**: written checklist in `.planning/phases/01-backend-platform-upgrade/01-SMOKE-CHECKLIST.md`. Planner shapes exact step list.
- **`AppConstants` populate vs delete**: prefer populate (D-1.13), allow delete if planner judges over-engineering.
- **`SearchController` post-V3-removal shape**: keep as single-endpoint controller (`/api/search/suggest`) or fold into `SearchControllerV4`.
- **Per-module Maven build order**: both modules upgrade independently (no inter-module dep); planner picks order.
- **Concrete Hibernate 6 / Spring Data JPA 3 breakages**: planner/executor fixes in place if surfaced during upgrade.

### Deferred Ideas (OUT OF SCOPE)

- Auth mechanism choice / CitiPortal header validation → Phase 9 (SEC-01).
- CORS lock-down → Phase 9 (SEC-05).
- ES SSL truststore + removal of dev-only SSL bypass → Phase 9 (SEC-03, SEC-04).
- Plaintext DB password in `application.properties` → Phase 9 (SEC-02).
- Uncomment `clobToString` lines → Phase 8.
- AG-Grid Enterprise license env-var wiring → Phase 2 / backlog.
- Round 2 cleanup (long-file refactors of `SearchServiceV4`, `OracleServiceV4`, `ExecutionOrderService`, `SearchV5GridComponent`) → deferred cleanup phase.
- Parent aggregator POM at repo root → build-hygiene phase.
- Angular `search-v5/` → `search-v4/` rename → Angular decommission path.
- Backend V4 → V5 rename → rejected.
- Testcontainers / integration tests → not Phase 1.
- TeamCity / Lightspeed / uDeploy CI wiring → Phase 8 / backlog.
- Schema migrations (Liquibase / Flyway) → not introduced.
- Spike to verify `oraclepki` 21.5.0.0 on Java 21 → only if Phase 1 surfaces JDBC failure.
- `statusses` typo, `console.log` removal, frontend `any` cleanup, TLM filters dark-mode TODO → Phase 8.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **BOOT-01** | Bump Java target to 17 (or 21 if Citi VM supports it) in both `pom.xml` files and CI; confirm `mvn -version` matches on dev laptop and target VM. | D-1.1 locks Java 21. POM property is `<java.version>` (currently `17` in both modules — backend `pom.xml:30`, tlm-stats `pom.xml:17`). `<maven.compiler.release>` also exists in backend `pom.xml:31`. Lombok 1.18.30 (bundled with Boot 2.7.16) is INCOMPATIBLE with newer JDKs — STATE.md KNOWN GAP notes "Lombok 1.18.30 ↔ Java 25 compile incompatibility (workaround: build with JAVA_HOME=Java 21)." Boot 3.3.x BOM pins **Lombok 1.18.34** which IS Java 21-compatible. ✓ |
| **BOOT-02** | Migrate `backend/rectrace` and `rectrace-tlm-stats` to Spring Boot 3.2.x — parent POM + BOM version + starter alignment. | CONTEXT.md D-1.2 supersedes ROADMAP wording to **3.3.x LTS**. Verified latest 3.3.x patch via Maven Central: **3.3.13** (released 2025-06-19). See § Standard Stack. |
| **BOOT-03** | Global `javax.*` → `jakarta.*` namespace migration (servlet, persistence, validation, annotation, ws, transaction). | 15 grep hits across both modules — see § Javax → Jakarta Migration Inventory below for file:line list. Confirmed `javax.net.ssl.SSLContext` in `ElasticsearchDevConfiguration.java:3` STAYS `javax.*` (JDK API, not JEE → Jakarta rename). |
| **BOOT-04** | Spring Security migration — replace deprecated `WebSecurityConfigurerAdapter` with `SecurityFilterChain` bean. | Grep confirmed: **no `WebSecurityConfigurerAdapter` exists in this repo** (zero hits across both modules). Spring Security is not even on the classpath today — no `spring-boot-starter-security` in either `pom.xml`. D-1.8 → add `spring-boot-starter-security` dep + one permit-all `SecurityFilterChain` bean per module. See § Code Examples for the bean. |
| **BOOT-05** | Spring Data JPA 3 / Hibernate 6 — fix breaking changes. | Only one JPA-using class touches `EntityManager`/`Query`: `ExecutionOrderService.java` (3 `javax.persistence.*` imports lines 12-14). `LocalContainerEntityManagerFactoryBean` + `HibernateJpaVendorAdapter` in `DataSourceConfig.java:55-60` are namespace-stable (Spring API, not Jakarta). The Hibernate breakage is **`Oracle12cDialect` removed in Hibernate 6.4+** — see § Hibernate 6 Dialect Migration below. |
| **BOOT-06** | Elasticsearch client upgrade aligned with Boot 3.2 BOM — existing search code (v3/v4) and bulk indexing path both verified end-to-end. | D-1.4..1.6 narrow this to: migrate `SuggestionService` + `ElasticsearchServiceV4` to `co.elastic.clients.elasticsearch.ElasticsearchClient` (ES Java API Client 8.13.x via Boot 3.3 BOM); delete the V3 trio (D-1.5). No "bulk indexing path" exists yet (LOADER-* is Phase 6). See § ES Client Migration. |
| **BOOT-07** | Dependency-pin refresh — Micrometer 1.12+, `logstash-logback-encoder` 8.x (Logback 1.4+), Quartz / ShedLock / JSqlParser versions resolved against Boot 3.2 BOM. | Currently no Micrometer/Logback/Quartz/ShedLock/JSqlParser deps in either `pom.xml`. The "refresh" reduces to: let Boot 3.3.13 BOM pin everything that IS present (`spring-boot-starter-*`, `lombok`, `jackson-databind`, `poi`, `ojdbc8`). Do not override anything in `<dependencyManagement>`. Pitfall: Boot's `${oracle-database.version}` was added in 3.3 — see § Common Pitfalls. |
| **BOOT-08** | Opportunistic cleanup — `printStackTrace`, `show_sql=true`, dead code, deprecated API. | Concrete file:line diffs in § BOOT-08 Cleanup Quartet. Plus the two STATE.md KNOWN GAPS from Phase 00.1 P07: (a) `DataSourceConfig.java:41-42` unconditional `scriptExecutor.executeScript("/opt/rectify/...")` ignoring `datasource.password`; (b) `rectrace-tlm-stats/.../DatabaseConfig.java:80,108,190` same pattern. |
| **BOOT-09** | All existing tests pass on 3.3; manual smoke confirms search/execution-order/TLM-stats still work. | See § Validation Architecture below. |

</phase_requirements>

## Summary

The phase is a Spring Boot 2.7.16 → 3.3.x LTS + Java 17 → 21 upgrade with bounded co-located cleanup. Across both Maven modules the migration touches **15 `javax.*` imports** (14 in `backend/rectrace`, 1 in `rectrace-tlm-stats`), three properties files referencing `Oracle12cDialect`, two ES service classes built on the dead `RestHighLevelClient` API, and an entire `service/v3/` directory marked for deletion. The destination state is two cleanly compiling modules running on identical `spring-boot-starter-parent` and `<java.version>` properties, with one permit-all `SecurityFilterChain` bean per module and the BOOT-08 cleanup quartet folded in.

The migration is mechanically straightforward but has **one significant strategy question**: Spring Boot 3.3 OSS support ended 2025-06-30, and commercial support ends **2026-06-30** — i.e. roughly six weeks from today (2026-05-12). The chosen line is on the EOL cliff. The locked decision (D-1.2) anchors on 3.3 because CONCERNS.md HIGH #3 calls out "3.3.x LTS" by name; the current OSS support model (every Boot minor is 12-month OSS + commercial extension) means there is no actually-LTS line in the formal sense — 3.5 is the youngest line with active OSS support (through 2026-06-30) and an extended-support path to 2032 alongside Spring Framework 6.2. **This is a planner-level call to surface to the user, not a researcher-level override.** All other research below is written for Boot 3.3.13 per D-1.2; the migration mechanics are identical for 3.4.x and 3.5.x, so a planner-time pivot to 3.5.x adds zero rework.

**Primary recommendation:** Plan the migration in eight bisectable waves matching the BOOT-NN requirement IDs (parent bump → jakarta sweep → Hibernate dialect → V3 deletion → ES client migration → SecurityFilterChain → BOOT-08 cleanup quartet → frontend dead-code removal → ROADMAP.md edit). Pin `spring-boot-starter-parent` to `3.3.13` and let the Boot BOM resolve every transitive (Hibernate 6.5.x, Micrometer 1.13.x, ES client 8.13.x, Lombok 1.18.34). Do not declare a `<dependencyManagement>` section that overrides BOM-pinned versions. Use the new `ElasticsearchClient.of(b -> b.host(url)...)` simplified builder for both surviving ES services. Before plan execution, confirm with the user whether 3.3.13 is still the right target given the EOL cliff — this is a 30-second decision, not a research blocker.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Spring Boot parent POM + version property bump | Backend / Build | — | Maven `<parent>` and `<properties>` blocks in each module |
| `javax.*` → `jakarta.*` import rewriting | Backend (both modules) | — | Compile-time Java source files only |
| `Oracle12cDialect` → `OracleDialect` swap | Backend (rectrace only — only this module uses JPA dialect properties) | — | `DataSourceConfig.java` + `application.properties` + `application-local.properties` |
| `SecurityFilterChain` bean | Backend (per-module `config/SecurityConfig.java`) | — | Spring Security 6 bean; one per ApplicationContext |
| `RestHighLevelClient` → `ElasticsearchClient` rewrite | Backend (rectrace) | — | ES client lives only in `backend/rectrace`; tlm-stats has zero ES |
| V3 search trio deletion | Backend (rectrace) + Frontend (Angular) lockstep | — | Backend deletes `service/v3/` + 3 controller endpoints; frontend deletes `search.service.ts` + spec |
| BOOT-08 logging fix | Backend (rectrace only — tlm-stats `ScriptExecutor` is already SLF4J) | — | Two specific files in `backend/rectrace/src/main` |
| HikariCP explicit pool config | Backend (rectrace `DataSourceConfig` + tlm-stats `DatabaseConfig` × 2 datasources) | — | Both modules' DataSource beans |
| `application-local.properties` already-landed verification | Backend (both modules) | — | Files exist (Phase 0.1 P07); verify property keys survive Boot 3.3 |
| ROADMAP.md text update | Planning docs | — | Single string edit ("3.2.x" → "3.3.x LTS", "17 or 21" → "21") |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `spring-boot-starter-parent` | **3.3.13** | Maven parent + BOM | Latest 3.3.x patch on Maven Central (timestamp 2025-06-19). `[VERIFIED: Maven Central solrsearch 2026-05-12]` |
| Java | **21** | Compile target | Locked by D-1.1; matches Citi VM target. Lombok 1.18.30 (current via Boot 2.7.16 BOM) breaks on JDK 25 per STATE.md KNOWN GAP; Boot 3.3.13 BOM pins Lombok 1.18.34 which IS JDK 21-clean. `[VERIFIED: Maven Central + STATE.md note]` |
| `spring-boot-starter-web` | (BOM-managed) | Spring MVC | Already present in both modules. No version override. |
| `spring-boot-starter-data-jpa` | (BOM-managed) | JPA + Hibernate 6.5.x | Already present in both modules. Hibernate 6.5.x pulled transitively. `[CITED: github.com/spring-projects/spring-boot/wiki/Spring-Boot-3.3-Release-Notes]` |
| `spring-boot-starter-data-elasticsearch` | (BOM-managed) | Spring Data ES + ES client 8.13.x | Already present in `backend/rectrace`. Boot 3.3 BOM ships **ES client 8.13.x**. `[CITED: Boot 3.3 release notes]` |
| `spring-boot-starter-security` | (BOM-managed) | Spring Security 6.3.x | **NEW dependency** — must be added to both `pom.xml` files. Without this on the classpath, `SecurityFilterChain` is meaningless. `[VERIFIED: grep — zero current hits]` |
| `spring-boot-starter-test` | (BOM-managed) | Test scaffolding | Already present in both modules. JUnit 5, Mockito, Spring Test 6.1.x. |
| `ojdbc8` | (BOM-managed via `${oracle-database.version}`) | Oracle JDBC driver | Already present. Boot 3.3 added `${oracle-database.version}` (defaults to a 21.x patch); drop any explicit `<version>` we might have. Currently no explicit version in either POM — good. |
| `oraclepki` / `osdt_core` / `osdt_cert` | **21.5.0.0** (kept) | Oracle wallet PKI | Currently pinned at 21.5.0.0 in `backend/rectrace/pom.xml:54-67`. Oracle confirms 21.x JDBC is JDK 21-compatible. Keep version; do not bump in this phase. `[CITED: CONTEXT.md "Reusable Assets"]` |
| `lombok` | (BOM-managed → 1.18.34) | Boilerplate reduction | Boot 3.3 BOM pins 1.18.34; this RESOLVES the Phase 00.1 KNOWN GAP. Drop any explicit `<version>` we might have. Currently no explicit version in either POM — good. |
| `poi` / `poi-ooxml` | **5.2.3** (kept) | Excel export | Pinned at 5.2.3 in `backend/rectrace/pom.xml:80-87`. Apache POI 5.2.x is JDK 21-compatible. Keep version. |
| `jackson-databind` | (BOM-managed) | JSON | Present in `rectrace-tlm-stats/pom.xml:58`. Boot 3.3 BOM pins Jackson 2.17.x. |
| `HikariCP` | (BOM-managed, transitive via `spring-boot-starter-data-jpa`) | Connection pool | Boot 3.3 ships HikariCP 5.1.x. Already used in `AutosysDataSourceConfig.java`. |
| `spring-boot-starter-actuator` | (BOM-managed) | Health/info endpoints | Already present in `rectrace-tlm-stats/pom.xml:33`. Out of scope for new endpoints (Phase 7). |
| `spring-boot-devtools` | (BOM-managed, runtime, optional) | Hot reload | Already present in `rectrace-tlm-stats`. Optional/runtime; no migration impact. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `co.elastic.clients:elasticsearch-java` | **8.13.x** (BOM-managed) | New Java API Client | Pulled transitively by `spring-boot-starter-data-elasticsearch` in Boot 3.3. Verified latest 8.13.x patch: **8.13.4** (BOM-resolved). The simplified `ElasticsearchClient.of(...)` builder is available 8.13+. `[CITED: Context7 /elastic/elasticsearch-java + Maven Central]` |
| `org.elasticsearch.client:elasticsearch-rest-client` | **8.13.x** (BOM-managed transitive) | Low-level HTTP transport | Pulled transitively by `elasticsearch-java`. We do NOT add a direct dep. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Boot **3.3.13** | Boot **3.5.x** (latest patch 3.5.3) | Boot 3.3 OSS support ended 2025-06-30; commercial support ends 2026-06-30 (~6 weeks from today). 3.5.x has OSS support through 2026-06-30 with an extended-support path to 2032 alongside Spring Framework 6.2. **Locked by D-1.2 to 3.3 — surface the EOL fact to the user before planning starts; migration mechanics are identical between 3.3.x, 3.4.x, and 3.5.x.** `[VERIFIED: endoflife.date/spring-boot + spring.io/blog/2025/02/13/support-policy-updates]` |
| New ES Java API Client (`co.elastic.clients...`) | Retain `RestHighLevelClient` via compat jar (`elasticsearch-rest-high-level-client` 7.17.x) | Rejected by D-1.4. HLRC is dead upstream; new client is the only forward path. |
| `WebSecurityConfigurerAdapter` (subclass-based config) | Already deprecated and removed in Spring Security 6.0 | Not actually an alternative — N/A. |
| `OracleDialect` (Hibernate 6) | `Oracle10gDialect` (the only other OracleNNNDialect that survived Hibernate 6.4) | Wrong choice — `OracleDialect` is the consolidated replacement; it auto-detects version, no hint needed for Oracle 12c+. `[VERIFIED: Hibernate discourse]` |

**Installation (per module `pom.xml`):**

```xml
<!-- backend/rectrace/pom.xml -->
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.3.13</version>
    <relativePath/>
</parent>
<properties>
    <java.version>21</java.version>
    <maven.compiler.release>21</maven.compiler.release>
</properties>
<dependencies>
    <!-- existing deps unchanged except remove spring-boot-starter-validation if added; add: -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-security</artifactId>
    </dependency>
    <!-- … existing data-jpa, web, data-elasticsearch, ojdbc8, oraclepki triplet, lombok, test, poi pair … -->
</dependencies>
```

```xml
<!-- rectrace-tlm-stats/pom.xml -->
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.3.13</version>
    <relativePath/>
</parent>
<properties>
    <java.version>21</java.version>
</properties>
<!-- add maven.compiler.release for parity with backend/rectrace -->
<dependencies>
    <!-- existing: web, test, actuator, devtools (runtime, optional), data-jpa, ojdbc8 (runtime), jackson-databind; add: -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-security</artifactId>
    </dependency>
</dependencies>
```

**Version verification (run during plan execution, not now):**
```bash
mvn -pl backend/rectrace help:effective-pom -q | grep -A1 spring-boot.version
# Expected: 3.3.13
mvn -pl backend/rectrace dependency:tree | grep -E "hibernate-core|elasticsearch-java|micrometer|lombok"
# Expected: hibernate-core 6.5.x, elasticsearch-java 8.13.x, micrometer-core 1.13.x, lombok 1.18.34
```

## Architecture Patterns

### System Architecture Diagram

```text
Client (Angular search-v5 + future React) 
        │
        ▼  HTTP (header: x-citiportal-loginid)
┌──────────────────────────────────────────────┐
│ Backend Module: backend/rectrace             │
│  ┌────────────────────────────────────────┐  │
│  │ SecurityFilterChain (NEW, permit-all)  │  │  ◄── BOOT-04
│  └─────────────┬──────────────────────────┘  │
│                ▼                              │
│  ┌────────────────────────────────────────┐  │
│  │ Controllers                            │  │
│  │  • SearchController     (/api/search/* │  │  ◄── V3 endpoints REMOVED (D-1.5)
│  │    /suggest only after V3 deletion)    │  │
│  │  • SearchControllerV4   (/api/v4/*)    │  │  ◄── @RequestHeader uses AppConstants.CITI_PORTAL_LOGIN_ID_HEADER
│  │  • ExecutionOrderController            │  │
│  │  • UserController       (/api/user/*)  │  │
│  └─────────────┬──────────────────────────┘  │
│                ▼                              │
│  ┌────────────────────────────────────────┐  │
│  │ Services                               │  │
│  │  • SuggestionService                   │──┼──┐
│  │      (HLRC → ElasticsearchClient)      │  │  │  ES (localhost:9200 in local; Citi cluster in prod)
│  │  • ElasticsearchServiceV4              │──┼──┘
│  │      (HLRC → ElasticsearchClient)      │  │
│  │  • SearchServiceV4                     │  │
│  │  • OracleServiceV4                     │──┼──┐
│  │  • SearchConfigServiceV4               │  │  │  Oracle RECTRACE / AUTOSYS (via DataSourceConfig + AutosysDataSourceConfig)
│  │  • ExecutionOrderService               │──┼──┘
│  │  • JobStatusService (Autosys)          │──┼──► Oracle AUTOSYS
│  │  • [DELETED] SearchServiceV3,          │  │
│  │    OracleSearchProviderV3,             │  │  ◄── DELETED (D-1.5)
│  │    ElasticsearchSearchProviderV3       │  │
│  └────────────────────────────────────────┘  │
│  Profile guards: @Profile("!test") on all   │
│  beans that hit Oracle/ES at construction.  │
└──────────────────────────────────────────────┘
        │
        ▼  HTTP (port 8080)
┌──────────────────────────────────────────────┐
│ Backend Module: rectrace-tlm-stats           │
│  ┌────────────────────────────────────────┐  │
│  │ SecurityFilterChain (NEW, permit-all)  │  │  ◄── BOOT-04 (second bean, identical shape)
│  └─────────────┬──────────────────────────┘  │
│                ▼                              │
│  Controllers (TlmStatsController,            │
│   TlmStatsV2Controller, QuickRecStatsCtrl)   │
│                ▼                              │
│  Services + DatabaseConfig (HikariCP × 2     │  ◄── BOOT-08 HikariCP add for reconmgmt + recportal DataSources
│   for reconmgmt, recportal; dynamic per-TLM  │
│   via TlmJdbcTemplateFactory)                │
└──────────────────────────────────────────────┘

Verified properties / behavior the migration MUST preserve:
- /api/search/suggest URL contract (frontend autocomplete depends on it)
- /api/v4/search/initial, /ssrm/{category}, /export URL contracts
- /api/execution-order/{jobName} URL contract
- /api/user/info URL contract
- x-citiportal-loginid header read at every controller entry
- @Profile("!test") guards on all DB/ES-touching beans
- ContextLoadsTest passes on the `test` profile in both modules
```

### Recommended Project Structure (incremental — preserves existing layout)

```text
backend/rectrace/
└── src/main/java/com/citi/gru/rectrace/
    ├── config/
    │   ├── DataSourceConfig.java          ← jakarta.* + Oracle12cDialect→OracleDialect + HikariCP pool config
    │   ├── AutosysDataSourceConfig.java   ← jakarta.sql (only change)
    │   ├── ElasticsearchDevConfiguration.java  ← STAYS @Profile("dev"); SSL bypass UNCHANGED (Phase 9 owns removal)
    │   ├── ElasticsearchClientConfig.java (NEW) ← provides @Bean ElasticsearchClient using Boot's spring.elasticsearch.* + Phase 9 SSL hooks
    │   ├── CorsConfig.java                ← no change (Phase 9 territory)
    │   ├── AsyncConfig.java               ← no change
    │   └── SecurityConfig.java (NEW)      ← permit-all SecurityFilterChain bean
    ├── constants/
    │   └── AppConstants.java              ← POPULATED with CITI_PORTAL_LOGIN_ID_HEADER
    ├── controller/
    │   ├── SearchController.java          ← jakarta.servlet; V3 endpoints REMOVED; ref AppConstants
    │   ├── v4/SearchControllerV4.java     ← jakarta.servlet; ref AppConstants
    │   ├── UserController.java            ← jakarta.servlet; ref AppConstants
    │   ├── ExecutionOrderController.java
    │   └── FrontendController.java
    ├── service/
    │   ├── ExecutionOrderService.java     ← jakarta.persistence + System.err→logger.error
    │   ├── JobStatusService.java          ← jakarta.sql
    │   ├── SuggestionService.java         ← REWRITE on ElasticsearchClient
    │   ├── SearchConfigServiceV3.java     ← jakarta.annotation (KEPT — config still loaded; only V3 search code deleted)
    │   │                                    OR delete if planner confirms zero V3-config callers (V4 has SearchConfigServiceV4)
    │   └── v3/                            ← ENTIRE DIRECTORY DELETED
    └── util/
        └── ScriptExecutor.java            ← e.printStackTrace()→logger.error + add SLF4J Logger field

rectrace-tlm-stats/
└── src/main/java/com/citi/gru/rectrace/
    ├── tlmstats/config/
    │   ├── DatabaseConfig.java            ← jakarta.sql + HikariCP for reconmgmt + recportal
    │   ├── CorsConfig.java                ← no change
    │   └── SecurityConfig.java (NEW)      ← permit-all SecurityFilterChain bean
    └── (everything else namespace-clean already)
```

> **Note on `SearchConfigServiceV3`:** It is kept by D-1.5 wording ("delete the V3 trio" — `SearchServiceV3`, `OracleSearchProviderV3`, `ElasticsearchSearchProviderV3`). `SearchConfigServiceV3` is a SEPARATE config-loading service. Grep confirms `ElasticsearchSearchProviderV3` (deleted) and `OracleSearchProviderV3` (deleted) depend on it; once they go, nothing in the surviving code references `SearchConfigServiceV3`. **Planner should delete `SearchConfigServiceV3` along with the v3/ directory** — V4 has its own `SearchConfigServiceV4`. Surfacing this as a Discretion call.

### Pattern 1: Permit-All `SecurityFilterChain`

**What:** One `@Bean SecurityFilterChain` per Spring Boot module that permits every request and disables CSRF.
**When to use:** REST API with auth deferred to a later phase; need to satisfy `WebSecurityConfigurerAdapter` deprecation (Spring Security 6) without committing to an auth mechanism.
**Example:**
```java
// Source: Spring Security 6.5 reference — https://docs.spring.io/spring-security/reference/6.5/servlet/exploits/csrf.html
//         + authorize-http-requests permitAll() — same reference
// File:   backend/rectrace/src/main/java/com/citi/gru/rectrace/config/SecurityConfig.java (NEW)
package com.citi.gru.rectrace.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .authorizeHttpRequests(authz -> authz
                .anyRequest().permitAll()
            );
        return http.build();
    }
}
```

Identical file at `rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/config/SecurityConfig.java` (package and class location adjusted).

**Why this is compatible with the existing `x-citiportal-loginid` flow:** Spring Security with `permitAll()` does not strip request headers or block `@RequestHeader` resolution — the filter chain is short-circuited *after* request acceptance, and controllers continue to read `request.getHeader("x-citiportal-loginid")` and `@RequestHeader(value = "x-citiportal-loginid", required = false)` exactly as today. The added filter chain runs *before* MVC dispatch but does not alter header semantics. No ordering changes needed.

### Pattern 2: ElasticsearchClient Bean (Spring config)

**What:** A `@Bean ElasticsearchClient` (single instance) configured from `spring.elasticsearch.*` properties; injected into `SuggestionService` and `ElasticsearchServiceV4` via constructor injection (Suggestion) / field injection (V4).
**When to use:** Boot 3.3 ships `spring-boot-starter-data-elasticsearch` 5.3.x which auto-configures an `ElasticsearchClient` bean from `spring.elasticsearch.uris`, `spring.elasticsearch.username`, `spring.elasticsearch.password`. **No custom config bean is needed** for the basic case — verify this by deleting any stub `ElasticsearchClientConfig` we might be tempted to add.
**Example (only needed if Boot's auto-config doesn't satisfy us — e.g., when re-enabling the `@Profile("dev")` SSL bypass on the new client):**
```java
// Source: Context7 /elastic/elasticsearch-java — "Create ElasticsearchClient using TLS and Username/Password"
//         https://github.com/elastic/elasticsearch-java/blob/main/docs/reference/setup/connecting.md
// Only needed if Boot auto-config is bypassed; default path uses spring.elasticsearch.* from application.properties.
package com.citi.gru.rectrace.config;

import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.transport.TransportUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import javax.net.ssl.SSLContext;  // JDK API — stays javax.*

@Profile("dev")
@Configuration
public class ElasticsearchDevConfiguration {
    // Phase 1 keeps this class file in place but converts the RestClientBuilderCustomizer
    // to whatever shape the new client needs. Phase 9 removes the dev SSL bypass entirely.
    // Concrete shape: TBD by executor based on whether Boot auto-config's SSL hook is
    // sufficient. If yes, this entire @Profile("dev") class can be deleted in Phase 1
    // (it's only purpose is bypassing SSL — and the local profile uses http://, not https://).
}
```

**Recommendation for Phase 1:** Spring Boot 3.3 auto-configures `ElasticsearchClient` from `spring.elasticsearch.*` properties; `application.properties` already declares `spring.elasticsearch.uris=https://localhost:9200`. The `@Profile("dev")` SSL bypass was needed for HLRC + a self-signed prod cert; **the `local` profile in this repo uses `http://localhost:9200` (plain HTTP, ES security disabled per Phase 0.1 D-0.1.16) — no SSL bypass needed in local**. Planner-level call: either keep `ElasticsearchDevConfiguration` as a no-op `@Profile("dev")` placeholder (Phase 9 will remove), or delete it now since `local` is the only non-prod profile we run during this phase. Recommend **delete in Phase 1** with an inline note that Phase 9 owns prod SSL truststore.

### Pattern 3: ES Java API Client search call (replacement for `RestHighLevelClient.search(...)`)

**What:** Fluent builder pattern with strongly typed requests/responses; the search call shifts from a procedural `SearchSourceBuilder` to a lambda-builder.
**When to use:** Every place in `SuggestionService` and `ElasticsearchServiceV4` that calls `restHighLevelClient.search(searchRequest, RequestOptions.DEFAULT)`.
**Example — `ElasticsearchServiceV4` minimal before/after:**

Before (current `ElasticsearchServiceV4.java:32-76`):
```java
import org.elasticsearch.action.search.SearchRequest;
import org.elasticsearch.action.search.SearchResponse;
import org.elasticsearch.client.RequestOptions;
import org.elasticsearch.client.RestHighLevelClient;
import org.elasticsearch.index.query.BoolQueryBuilder;
import org.elasticsearch.index.query.QueryBuilders;
import org.elasticsearch.search.SearchHit;
import org.elasticsearch.search.builder.SearchSourceBuilder;
import org.elasticsearch.search.collapse.CollapseBuilder;
import org.elasticsearch.search.sort.SortOrder;

@Autowired(required = false)
private RestHighLevelClient esClient;

public List<String> getUniqueValues(String keyword, CategoryConfigV4 config) {
    if (esClient == null) { return new ArrayList<>(); }
    SearchRequest searchRequest = new SearchRequest(config.getElasticsearch().getIndex());
    SearchSourceBuilder sourceBuilder = new SearchSourceBuilder();
    BoolQueryBuilder query = QueryBuilders.boolQuery();
    String searchPattern = "*" + keyword.toLowerCase() + "*";
    for (String field : config.getElasticsearch().getSearchFields()) {
        query.should(QueryBuilders.wildcardQuery(field, searchPattern));
    }
    CollapseBuilder collapse = new CollapseBuilder(config.getElasticsearch().getCollapseField());
    sourceBuilder.query(query)
            .collapse(collapse)
            .size(config.getElasticsearch().getMaxResults())
            .fetchSource(new String[]{config.getSearchColumn()}, null)
            .sort(config.getElasticsearch().getCollapseField(), SortOrder.ASC);
    searchRequest.source(sourceBuilder);
    SearchResponse response = esClient.search(searchRequest, RequestOptions.DEFAULT);
    return Arrays.stream(response.getHits().getHits())
            .map(this::extractValue)
            .filter(value -> value != null && !value.isEmpty())
            .collect(Collectors.toList());
}
```

After (new client, same logic):
```java
// Source: Context7 /elastic/elasticsearch-java — "Boolean compound query" + "Additive Builder Setters" + "additive list/sort"
import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.elasticsearch._types.SortOrder;
import co.elastic.clients.elasticsearch._types.query_dsl.Query;
import co.elastic.clients.elasticsearch._types.query_dsl.WildcardQuery;
import co.elastic.clients.elasticsearch.core.SearchResponse;
import co.elastic.clients.elasticsearch.core.search.Hit;
import jakarta.annotation.Nullable;

@Autowired(required = false)
private ElasticsearchClient esClient;

public List<String> getUniqueValues(String keyword, CategoryConfigV4 config) {
    if (esClient == null) { return new ArrayList<>(); }
    final String pattern = "*" + keyword.toLowerCase() + "*";
    final String index = config.getElasticsearch().getIndex();
    final String collapseField = config.getElasticsearch().getCollapseField();
    final String searchColumn = config.getSearchColumn();
    final int size = config.getElasticsearch().getMaxResults();

    List<Query> shoulds = config.getElasticsearch().getSearchFields().stream()
            .map(field -> WildcardQuery.of(w -> w.field(field).value(pattern))._toQuery())
            .toList();

    try {
        SearchResponse<Map> response = esClient.search(s -> s
                .index(index)
                .query(q -> q.bool(b -> b.should(shoulds)))
                .collapse(c -> c.field(collapseField))
                .size(size)
                .source(src -> src.filter(f -> f.includes(searchColumn)))
                .sort(so -> so.field(f -> f.field(collapseField).order(SortOrder.Asc)))
            , Map.class);

        return response.hits().hits().stream()
                .map(Hit::source)
                .filter(Objects::nonNull)
                .map(src -> {
                    Object v = src.values().stream().filter(Objects::nonNull).findFirst().orElse(null);
                    return v != null ? v.toString() : null;
                })
                .filter(v -> v != null && !v.isEmpty())
                .collect(Collectors.toList());
    } catch (IOException e) {
        log.error("Elasticsearch query failed for category: {}", config.getKey(), e);
        return new ArrayList<>();
    }
}
```

### Pattern 4: ES Java API Client suggestion call (replacement for `CompletionSuggestionBuilder`)

**Example — `SuggestionService` minimal before/after:**

Before (current `SuggestionService.java:79-124`):
```java
SuggestBuilder suggestBuilder = new SuggestBuilder();
for (String fieldName : suggestionFields) {
    CompletionSuggestionBuilder csb = SuggestBuilders
            .completionSuggestion(fieldName).prefix(prefix).skipDuplicates(true).size(SUGGESTIONS_PER_FIELD);
    suggestBuilder.addSuggestion(fieldName, csb);
}
SearchSourceBuilder sourceBuilder = new SearchSourceBuilder();
sourceBuilder.suggest(suggestBuilder).fetchSource(false).size(0);
SearchRequest searchRequest = new SearchRequest(esIndexName);
searchRequest.source(sourceBuilder);
SearchResponse searchResponse = restHighLevelClient.search(searchRequest, RequestOptions.DEFAULT);
Suggest suggest = searchResponse.getSuggest();
// … iterate completionSuggestion.getOptions() per fieldName, collect option.getText().string()
```

After (new client):
```java
// Source: Context7 /elastic/elasticsearch-java — Suggester API surface (CompletionSuggester via FieldSuggester)
// The new client expresses each named suggestion as a (name, FieldSuggester) map; the response
// exposes suggest() returning Map<String, List<Suggestion<TDocument>>>.
import co.elastic.clients.elasticsearch.core.search.FieldSuggester;
import co.elastic.clients.elasticsearch.core.search.Suggester;
import co.elastic.clients.elasticsearch.core.search.Suggestion;
import co.elastic.clients.elasticsearch.core.search.CompletionSuggestOption;

Map<String, FieldSuggester> namedSuggesters = new LinkedHashMap<>();
for (String fieldName : suggestionFields) {
    namedSuggesters.put(fieldName, FieldSuggester.of(fs -> fs
            .prefix(prefix)
            .completion(c -> c.field(fieldName).skipDuplicates(true).size(SUGGESTIONS_PER_FIELD))
    ));
}

try {
    SearchResponse<Void> response = esClient.search(s -> s
            .index(esIndexName)
            .size(0)
            .source(src -> src.fetch(false))
            .suggest(Suggester.of(sg -> sg.suggesters(namedSuggesters)))
        , Void.class);

    Set<String> combined = new LinkedHashSet<>();
    Map<String, List<Suggestion<Void>>> suggestMap = response.suggest();
    if (suggestMap == null) return Collections.emptyList();
    for (String fieldName : suggestionFields) {
        List<Suggestion<Void>> sugs = suggestMap.get(fieldName);
        if (sugs == null) continue;
        for (Suggestion<Void> sug : sugs) {
            for (CompletionSuggestOption<Void> opt : sug.completion().options()) {
                combined.add(opt.text());
                if (combined.size() >= MAX_TOTAL_SUGGESTIONS) break;
            }
            if (combined.size() >= MAX_TOTAL_SUGGESTIONS) break;
        }
        if (combined.size() >= MAX_TOTAL_SUGGESTIONS) break;
    }
    return new ArrayList<>(combined);
} catch (IOException e) {
    log.error("IOException during combined ES suggestion for prefix '{}': {}", prefix, e.getMessage());
    return Collections.emptyList();
}
```

**Note on the Void type parameter:** The current code doesn't read `_source` for suggestions (`fetchSource(false)`, `size(0)`), so `Void` is the correct document type; the strongly-typed API requires *a* class to bind to, and `Void` signals "I'm not reading hits." Equivalent to typing the old client as `SearchResponse` ignoring `getHits()`.

### Anti-Patterns to Avoid

- **Adding an HLRC compat dep (`elasticsearch-rest-high-level-client` 7.17.x) to keep V3 alive while migrating V4.** Rejected by D-1.5 — delete V3 first, in the same phase, in its own bisectable commit. Two coexisting ES client APIs in one process is a maintenance trap.
- **Overriding the Boot BOM Hibernate/Micrometer/Lombok versions in `<dependencyManagement>`.** Phase 0 Pitfall #7 (carry-forward). Let the BOM resolve transitively.
- **Subclassing `WebSecurityConfigurerAdapter`** — removed in Spring Security 6 (Boot 3 ships SS 6.x). Not applicable here (zero hits in this repo) but planners migrating other Boot 3 codebases sometimes regress.
- **Setting `hibernate.dialect` to `Oracle12cDialect` after the bump.** Class was removed in Hibernate 6.4. Use `org.hibernate.dialect.OracleDialect`. `[VERIFIED: Hibernate discourse + GH issue spring-projects/spring-boot#39044]`
- **Reading `spring.elasticsearch.rest.uris` in `@Value`.** That property name was the Boot 2.x form; Boot 2.7+ already standardized on `spring.elasticsearch.uris` (no `.rest.` infix). Repo already uses `spring.elasticsearch.uris` — no rename needed. `[VERIFIED: grep of application*.properties]`
- **Calling `e.printStackTrace()` after BOOT-08 closure.** Replace with SLF4J `logger.error("...", e)` everywhere; STATE.md tracks this in CONCERNS.md MEDIUM.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP client + SSL wrangling for ES | Custom `RestClient` + `SSLContext` plumbing | Boot 3.3 auto-config from `spring.elasticsearch.*` → `ElasticsearchClient` bean | Auto-config handles URI parsing, basic auth, default JsonpMapper, transport lifecycle. Verified by `spring-boot-starter-data-elasticsearch` auto-config (Boot 3.3 release notes). |
| Suggestion result deduplication across fields | Custom hashing / `Set` plumbing wrapped around the new client | Use the existing `LinkedHashSet<String>` pattern from current `SuggestionService` — the migration KEEPS this logic untouched | The dedup logic isn't ES-version-specific; only the request/response calls swap. |
| HikariCP defaults | Custom pool monitoring or sizing math | `HikariConfig` setters mirroring `AutosysDataSourceConfig.java` (lines 50-59): `maximumPoolSize`, `minimumIdle`, `connectionTimeout`, `idleTimeout`, `maxLifetime`. Use existing values 5/2/30000/600000/1800000 as defaults; planner can tune via properties. | Already proven in `AutosysDataSourceConfig`; planner does not need to research defaults. |
| JSON-to-Map mapping for ES hits | Custom Jackson type tokens | `SearchResponse<Map> response = esClient.search(s -> …, Map.class)` — pass `Map.class` as the document type | New client accepts any Jackson-deserializable type; Map is the equivalent of `getSourceAsMap()`. `[CITED: Context7 /elastic/elasticsearch-java]` |
| `WebSecurityConfigurerAdapter` migration shim | Subclass-bridging utilities | Just write the `SecurityFilterChain` bean directly (Pattern 1 above). Repo currently has zero `WebSecurityConfigurerAdapter` — no migration step needed, just add new bean. | `[VERIFIED: grep zero hits]` |
| Citi-portal header validation | A `OncePerRequestFilter` rejecting requests without `x-citiportal-loginid` | **DEFERRED to Phase 9 SEC-01**. Phase 1's permit-all filter is intentional. | D-1.9 lock. |

**Key insight:** The migration's value comes from *deleting* code (V3 trio, RestHighLevelClient call sites, `printStackTrace`, `show_sql`), not from adding new abstractions. The new `ElasticsearchClient` is a 1:1 replacement at the service-method level. The new `SecurityConfig` is a single bean. Beyond that, every dep stays BOM-managed.

## Runtime State Inventory

Phase 1 is a code/config-only change. The "runtime state" question still warrants explicit answers per the researcher protocol:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | None — no DB row, no ES doc, no Mem0 key, no Redis key references the string "rectrace 2.7" / "Boot 2.7" / "javax". Oracle schema names (`RECTRACE`, `AUTOSYS`, `RECONMGMT`, `RECPORTAL`) are unchanged. ES index name `rectrace_core_index` is unchanged. | None |
| **Live service config** | None — no n8n / Datadog / Cloudflare config references Boot version. The `application.properties` and `application-prod.properties` / `application-uat.properties` files in git ARE the live config; they're updated as part of the phase (3 properties files edited per § Migration Inventory). | Edit `application.properties` (Oracle12cDialect → OracleDialect; show-sql=true → false) and `application-local.properties` (Oracle12cDialect → OracleDialect). `application-uat.properties` / `application-prod.properties` inherit and do not override the dialect; verified by grep. |
| **OS-registered state** | None — no Windows Task Scheduler / launchd / systemd / pm2 process references this app today (Phase 0 D-03 explicitly deferred CI / process-supervisor work to Phase 8 / backlog). | None |
| **Secrets and env vars** | `${LOCAL_DB_USER}` / `${LOCAL_DB_PASSWORD}` env-var placeholders may be introduced (Discretion call); current `application-local.properties` uses plaintext non-secret defaults (`rectrace/rectrace_pwd`, `autosys/autosys_pwd`, `reconmgmt/reconmgmt_pwd`, `recportal/recportal_pwd`). No secret name CHANGES — only the dialect string and the `show-sql` flag change. SOPS / Vault not in scope. | None for this phase |
| **Build artifacts / installed packages** | Each module's `target/` directory contains a fat JAR built on Boot 2.7.16; running `mvn clean install` after the upgrade rebuilds them. No globally-installed package carries the old name. | Run `mvn clean install` in each module after migration; output JAR file name `rectrace-0.0.1-SNAPSHOT.jar` and `tlm-stats-0.0.1-SNAPSHOT.jar` are unchanged (artifactIds unchanged). |

## Javax → Jakarta Migration Inventory

Complete grep of `^import javax\.` across both modules' `src/main/java`. **This is the migration checklist — every line below changes.** Lines marked `[KEEP]` are JDK API (not JEE) and stay `javax.*`.

### backend/rectrace (14 lines, 9 files)

| File | Line | Current Import | Replacement | Category |
|------|------|----------------|-------------|----------|
| `config/AutosysDataSourceConfig.java` | 10 | `javax.sql.DataSource` | `jakarta.sql.DataSource` | sql (note: `javax.sql` IS in the Jakarta rename set despite the name — `javax.sql.DataSource` is bundled with Jakarta EE 9+; Boot 3 ships Jakarta-namespaced) |
| `config/DataSourceConfig.java` | 3 | `javax.sql.DataSource` | `jakarta.sql.DataSource` | sql |
| `config/DataSourceConfig.java` | 4 | `javax.persistence.EntityManagerFactory` | `jakarta.persistence.EntityManagerFactory` | persistence |
| `config/ElasticsearchDevConfiguration.java` | 3 | `javax.net.ssl.SSLContext` | **[KEEP `javax.net.ssl`]** — JDK API, not JEE; not in Jakarta rename set | net.ssl |
| `controller/SearchController.java` | 4 | `javax.servlet.http.HttpServletRequest` | `jakarta.servlet.http.HttpServletRequest` | servlet |
| `controller/UserController.java` | 3 | `javax.servlet.http.HttpServletRequest` | `jakarta.servlet.http.HttpServletRequest` | servlet |
| `controller/v4/SearchControllerV4.java` | 12 | `javax.servlet.http.HttpServletResponse` | `jakarta.servlet.http.HttpServletResponse` | servlet |
| `service/ExecutionOrderService.java` | 12 | `javax.persistence.EntityManager` | `jakarta.persistence.EntityManager` | persistence |
| `service/ExecutionOrderService.java` | 13 | `javax.persistence.PersistenceContext` | `jakarta.persistence.PersistenceContext` | persistence |
| `service/ExecutionOrderService.java` | 14 | `javax.persistence.Query` | `jakarta.persistence.Query` | persistence |
| `service/JobStatusService.java` | 14 | `javax.sql.DataSource` | `jakarta.sql.DataSource` | sql |
| `service/SearchConfigServiceV3.java` | 8 | `javax.annotation.PostConstruct` | `jakarta.annotation.PostConstruct` | annotation (**OR file is deleted entirely** per planner Discretion — see § Architecture note) |
| `service/v3/OracleSearchProviderV3.java` | 12 | `javax.sql.DataSource` | **DELETED with v3/ dir** (D-1.5) | sql |
| `service/v4/SearchConfigServiceV4.java` | 13 | `javax.annotation.PostConstruct` | `jakarta.annotation.PostConstruct` | annotation |

### rectrace-tlm-stats (1 line, 1 file)

| File | Line | Current Import | Replacement | Category |
|------|------|----------------|-------------|----------|
| `tlmstats/config/DatabaseConfig.java` | 9 | `javax.sql.DataSource` | `jakarta.sql.DataSource` | sql |

### Summary

- **15 total imports**, **14 to rewrite** (1 stays `javax.net.ssl` — JDK), **1 evaporates with v3/ deletion** (`OracleSearchProviderV3`).
- **0 hits** for `javax.validation`, `javax.transaction`, `javax.ws.rs`, `javax.inject`, `javax.crypto`, `javax.xml.*`. Migration surface is narrow.
- **No hits** for `javax.servlet.Filter`, `javax.servlet.ServletException`, `javax.servlet.http.HttpSession` — controller-only usage of servlet API.
- All 14 rewrites are mechanical 1:1 package renames. No API method signatures changed.

## Hibernate 6 Dialect Migration

`Oracle12cDialect` was deprecated in Hibernate 6.0 and **removed in Hibernate 6.4** (the version that ships in Boot 3.3.x BOM is 6.5.x — so the class is gone). Replacement: `org.hibernate.dialect.OracleDialect` (no version suffix). The new class auto-detects Oracle version from the JDBC connection and produces 12c-equivalent SQL for any Oracle 12c+ database; no `(12)` version parameter is needed in `hibernate.dialect` property values. `[CITED: discourse.hibernate.org/t/oracle12cdialect-missing-when-upgrading-from-6-3-2-to-6-4-0/8687 + github.com/spring-projects/spring-boot/issues/39044]`

### Three references in the repo (all change):

| File | Line | Current | Replacement |
|------|------|---------|-------------|
| `backend/rectrace/src/main/resources/application.properties` | 4 | `spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.Oracle12cDialect` | `spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.OracleDialect` |
| `backend/rectrace/src/main/resources/application-local.properties` | 21 | `spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.Oracle12cDialect` | `spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.OracleDialect` |
| `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/DataSourceConfig.java` | 64 | `properties.setProperty("hibernate.dialect", "org.hibernate.dialect.Oracle12cDialect");` | `properties.setProperty("hibernate.dialect", "org.hibernate.dialect.OracleDialect");` |

**Note:** `application-prod.properties` and `application-uat.properties` do not override the dialect — verified by grep — so the default applies and propagates the fix.

**Stronger recommendation:** Since `spring.jpa.properties.hibernate.dialect` in properties files takes precedence and the in-Java setProperty is redundant, **delete line 64 of `DataSourceConfig.java`** as part of the BOOT-08 cleanup (it duplicates the properties-file value and the BOOT-08 #2 item already deletes `properties.setProperty("hibernate.show_sql", "true")` on the very next line). Make this two-line deletion atomic with the dialect rename.

## ES Client Migration

### Targets (D-1.6)

- `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/SuggestionService.java` — used by `/api/search/suggest` (V5 frontend autocomplete). **Migrate.**
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v4/ElasticsearchServiceV4.java` — used by `SearchServiceV4.performSearch`. **Migrate.**

### Deletions (D-1.5)

- `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v3/ElasticsearchSearchProviderV3.java`
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v3/OracleSearchProviderV3.java`
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v3/SearchServiceV3.java`
- (Recommendation) `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/SearchConfigServiceV3.java` — no remaining callers post-v3/-deletion; V4 has its own `SearchConfigServiceV4`.

### Boot autoconfig provides ElasticsearchClient (no bean wiring needed)

In Boot 3.3 with `spring-boot-starter-data-elasticsearch` on the classpath, the `ElasticsearchClient` (and underlying transport + `JacksonJsonpMapper`) is auto-configured from `spring.elasticsearch.uris`, `spring.elasticsearch.username`, `spring.elasticsearch.password`. Replace `@Autowired RestHighLevelClient` with `@Autowired ElasticsearchClient` and update the call sites per Pattern 3/4 above. No `@Configuration` bean is required for the basic case. `[CITED: spring-boot-starter-data-elasticsearch ElasticsearchClientAutoConfiguration in Spring Boot 3.3 reference]`

### SSL handling

The current `@Profile("dev") ElasticsearchDevConfiguration.java` uses `RestClientBuilderCustomizer` to install a noop trust manager. That class' API path in Boot 3.3 routes through the new client's transport. **The local profile uses plain HTTP (`http://localhost:9200`) per Phase 0.1 D-0.1.16** — no SSL bypass needed locally. The dev SSL bypass is needed only against a self-signed prod-shaped ES cluster, and Phase 9 (SEC-03, SEC-04) owns removing it entirely. **Recommendation: delete `ElasticsearchDevConfiguration.java` in Phase 1** and let Phase 9 add the proper truststore path (no functional regression — dev profile is not exercised in BOOT-09 smoke; local is).

### Call-graph safety check (D-1.5 dependency)

Grep confirms `SearchServiceV3` / `OracleSearchProviderV3` / `ElasticsearchSearchProviderV3` are referenced only by themselves (cross-imports within v3/) and by `SearchController.java`:

- `SearchController.java:12-13, 26-27, 31-32` — constructor injection of `SearchServiceV3` + `OracleSearchProviderV3`. **Removed when V3 endpoints go.**

Frontend grep confirms:
- `frontend/rectrace/src/app/services/search.service.ts:115, 131, 157` — calls `/v3/search/keyword`, `/v3/search/expand`, `/v3/search/ssrm/{category}`. **No other frontend file imports `SearchService` from this path** (grep verified). Deleting the file plus its spec is safe.

**No blockers surfaced.** Deletion is clean.

## BOOT-08 Cleanup Quartet — Concrete File:Line Diffs

### Item 1 — `printStackTrace` / `System.err` → SLF4J

**File: `backend/rectrace/src/main/java/com/citi/gru/rectrace/util/ScriptExecutor.java`**

Currently has NO SLF4J logger and uses `e.printStackTrace()` on line 22. Diff:
```java
// ADD at top of class (imports + field):
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
// …
public class ScriptExecutor {
    private static final Logger logger = LoggerFactory.getLogger(ScriptExecutor.class);
    // …
}

// REPLACE line 21-23:
//   } catch (Exception e) {
//       e.printStackTrace();
//   }
// WITH:
   } catch (Exception e) {
       logger.error("Failed to execute password script {} for service {} schema {}", scriptPath, serviceName, dbSchema, e);
   }
```

**File: `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/ExecutionOrderService.java`**

REPLACE line 154-156:
```java
        } catch (Exception e) {
            System.err.println("Error reading CLOB");
            return "";
        }
```
WITH:
```java
        } catch (Exception e) {
            logger.error("Error reading CLOB", e);
            return "";
        }
```

(`logger` field already declared at line 31.)

**Grep confirmed:** these are the only two `printStackTrace`/`System.err` survivors across both modules' `src/main` trees. `rectrace-tlm-stats/.../util/ScriptExecutor.java` already uses SLF4J correctly (line 17, 34, 61-67) — no change.

### Item 2 — `show_sql=true` removal

**File: `backend/rectrace/src/main/resources/application.properties`**

REPLACE line 3:
```
spring.jpa.show-sql=true
```
WITH:
```
spring.jpa.show-sql=false
```

**File: `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/DataSourceConfig.java`**

DELETE line 65 entirely:
```java
        properties.setProperty("hibernate.show_sql", "true");
```

(Note: the property-file value alone governs Hibernate's logging; the inline `setProperty` was redundant. With it removed, `spring.jpa.show-sql=false` from properties takes effect.)

**Grep confirmed:**
- `application-prod.properties` / `application-uat.properties` — no `show_sql` / `show-sql` keys, so they inherit `false` after the change. No additional edits.
- `application-local.properties` already has `spring.jpa.show-sql=false` (line 20) — no change.

### Item 3 — Explicit HikariCP pool config

**File: `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/DataSourceConfig.java`**

Currently uses Spring's `DataSourceBuilder.create()` (lines 44-50) which falls back to Boot's default — but Boot 3.3 default IS HikariCP, and the defaults are aggressive (max pool 10, no minimum-idle pinning). The CONCERNS HIGH #7 fix: mirror `AutosysDataSourceConfig`'s explicit `HikariConfig` shape.

Replacement `dataSource()` method:
```java
// Note: keeps the KNOWN GAP from STATE.md (unconditional script-executor call on lines 41-43).
// Phase 1 BOOT-08 widens the fix to MAKE the call conditional on datasource.password being unset.
// The unconditional script-executor call IS a STATE.md KNOWN GAP — fix per planner Discretion;
// recommended fix shown below.
@Bean
@Primary
public DataSource dataSource() {
    String password;
    if (datasourcePassword != null && !datasourcePassword.isBlank()) {
        password = datasourcePassword;
    } else {
        ScriptExecutor scriptExecutor = new ScriptExecutor();
        password = scriptExecutor.executeScript("/opt/rectify/control/scripts/get_password.sh",
                serviceName.toUpperCase(), dbschema.toUpperCase());
    }

    HikariConfig config = new HikariConfig();
    config.setJdbcUrl(jdbcUrl);
    config.setUsername(username);
    config.setPassword(password);
    config.setDriverClassName(driverClassName);
    config.setMaximumPoolSize(rectracMaximumPoolSize);
    config.setMinimumIdle(rectracMinimumIdle);
    config.setConnectionTimeout(rectracConnectionTimeout);
    config.setIdleTimeout(rectracIdleTimeout);
    config.setMaxLifetime(rectracMaxLifetime);
    config.setPoolName("Rectrace-HikariCP");
    config.addDataSourceProperty("oracle.jdbc.ReadTimeout", "60000");
    config.addDataSourceProperty("oracle.net.CONNECT_TIMEOUT", "10000");

    return new HikariDataSource(config);
}
```

Add the corresponding `@Value`-injected fields. Suggested defaults (mirror `AutosysDataSourceConfig` shape; low-traffic internal app):

```
datasource.password=${DATASOURCE_PASSWORD:}
datasource.hikari.maximum-pool-size=10
datasource.hikari.minimum-idle=2
datasource.hikari.connection-timeout=30000
datasource.hikari.idle-timeout=600000
datasource.hikari.max-lifetime=1800000
```

with corresponding `@Value("${datasource.password:}")` etc. fields in `DataSourceConfig`.

**Note on the STATE.md KNOWN GAP:** Phase 00.1 P07 surfaced two parallel bugs — `backend/rectrace DataSourceConfig.java:41-42` and `rectrace-tlm-stats DatabaseConfig.java:80,108,190` — both call `scriptExecutor.executeScript("/opt/rectify/control/scripts/get_password.sh", ...)` unconditionally, ignoring `datasource.password`. The conditional `if (datasourcePassword.isBlank())` pattern above resolves both gaps; apply the same pattern to all three call sites in `DatabaseConfig.java` (lines 80, 108, 190). Both fixes belong in BOOT-08 per STATE.md mapping; planner shapes the exact commit boundary.

**File: `rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/config/DatabaseConfig.java`**

Apply the same HikariCP-explicit + password-conditional shape to:
- `reconmgmtDataSource()` (lines 75-90)
- `recportalDataSource()` (lines 102-118)
- `TlmJdbcTemplateFactory.getJdbcTemplate(String)` (lines 182-205) — note this is dynamic per TLM instance; the script-executor call at line 190 is unavoidable today (no per-instance properties hook). **Leave the per-instance dynamic call as-is** for Phase 1; CONCERNS LOW #2 (TLM hardcoded script path) is explicitly deferred to Phase 8 / backlog per CONTEXT.md Deferred Ideas.

### Item 4 — `AppConstants.java` populate or delete

Current state: empty class with private constructor. Grep `AppConstants\.` returns **zero hits** across the repo. Per D-1.13 lock: **populate**.

```java
// File: backend/rectrace/src/main/java/com/citi/gru/rectrace/constants/AppConstants.java
package com.citi.gru.rectrace.constants;

public class AppConstants {
    private AppConstants() {
        throw new UnsupportedOperationException("This is a utility class and cannot be instantiated");
    }

    public static final String CITI_PORTAL_LOGIN_ID_HEADER = "x-citiportal-loginid";
}
```

Then replace the duplicated string literal in:

| File | Line | Replacement |
|------|------|-------------|
| `SearchController.java` | 22 | DELETE the local `private static final String CITI_PORTAL_LOGIN_ID_HEADER = "x-citiportal-loginid";` |
| `SearchController.java` | 48, 70, 88 | `request.getHeader(AppConstants.CITI_PORTAL_LOGIN_ID_HEADER)` |
| `UserController.java` | 19 | DELETE the local constant |
| `UserController.java` | 23 | `request.getHeader(AppConstants.CITI_PORTAL_LOGIN_ID_HEADER)` |
| `SearchControllerV4.java` | 29, 52, 92 | Currently `@RequestHeader(value = "x-citiportal-loginid", ...)` — replace string literal with `AppConstants.CITI_PORTAL_LOGIN_ID_HEADER` if the planner is willing to add an `@RequestHeader(value = AppConstants.CITI_PORTAL_LOGIN_ID_HEADER, …)` (legal — annotation attribute is `String` and the constant is `public static final String`). |

Add `import com.citi.gru.rectrace.constants.AppConstants;` to all three controllers.

> **Discretion alternative:** Delete `AppConstants.java` and leave the duplicated literals. Defensible if planner judges a class with a single string constant is YAGNI; the cost is three duplicated string literals across V4 controllers. CONTEXT.md D-1.13 prefers populate; documenting both paths for the planner.

## ROADMAP.md Update (deliverable)

Two specific edits in `.planning/ROADMAP.md`:

| Line area | Current | Updated |
|-----------|---------|---------|
| Phase 1 bullet (top of file, line ~15) | "Spring Boot 2.7 → 3.2, Java 17/21, …" | "Spring Boot 2.7 → 3.3.x LTS, Java 21, …" |
| Phase 1 Goal (line ~60) | "Both backend modules run on Spring Boot 3.2.x and Java 17/21 …" | "Both backend modules run on Spring Boot 3.3.x LTS and Java 21 …" |
| Phase 1 success criterion #1 | "build and boot on Spring Boot 3.2.x and Java 17 (or 21 if Citi VM supports) on both dev laptop and target VM." | "build and boot on Spring Boot 3.3.x LTS and Java 21 on both dev laptop and target VM." |

Plus the matching note in `.planning/PROJECT.md` Key Decisions table (if it pins the older "3.2.x" wording — planner verifies during execution).

## Common Pitfalls

### Pitfall 1: Spring Boot 3.3 OSS support already ended; commercial support ends in ~6 weeks

**What goes wrong:** The phase ships an upgrade onto a Boot line that is about to receive no further public security patches.
**Why it happens:** CONCERNS.md HIGH #3 wrote "3.3.x LTS" when 3.3 was current; the calendar moved.
**How to avoid:** Surface the fact to the user at plan-discuss time. Pivot to 3.5.x is a one-line POM change with zero additional migration work (Hibernate 6, Jakarta, ES Java API Client are all common to 3.3, 3.4, 3.5). Three options to surface to user: (a) ship on 3.3.13 and revisit; (b) ship on 3.5.x with extended support to 2032; (c) target Boot 4.0 (released April 2026 per search results) — but 4.0 brings Spring Framework 7 and Java 17 baseline becomes Java 21 only, larger surface. Recommendation if user pivots: **3.5.x** (mid-risk, longest extended support).
**Warning signs:** Citi security review flagging EOL OSS versions; `mvn dependency:tree` showing transitive deps without recent security patches.
`[VERIFIED: endoflife.date/spring-boot, herodevs.com Spring Boot Versions April 2026, spring.io/blog/2025/02/13/support-policy-updates]`

### Pitfall 2: Lombok 1.18.30 incompatibility with newer JDKs

**What goes wrong:** Build fails with cryptic javac errors on Lombok-annotated classes when toolchain JDK is 21+ but Lombok bundled by Boot 2.7 BOM is 1.18.30.
**Why it happens:** Lombok intercepts annotation processing using internal javac APIs; each Lombok patch tracks JDK changes. 1.18.30 supports JDK ≤ 21; 1.18.34+ adds JDK 23/25 support.
**How to avoid:** Boot 3.3 BOM pins Lombok 1.18.34 — confirmed via Maven Central. **Do not override.** This phase RESOLVES the Phase 00.1 KNOWN GAP automatically by letting the BOM pull 1.18.34.
**Warning signs:** `cannot find symbol log` in `@Slf4j`-annotated classes (`SearchServiceV4`, `ElasticsearchServiceV4`); `class file has wrong version` errors in `target/`.
`[VERIFIED: STATE.md Phase 00.1 P07 KNOWN GAP + Maven Central Lombok versions]`

### Pitfall 3: `Oracle12cDialect` removed in Hibernate 6.4

**What goes wrong:** App startup fails with `java.lang.ClassNotFoundException: org.hibernate.dialect.Oracle12cDialect`. (Verified by GH issue spring-projects/spring-boot#39044 — Boot 3.2.1 surfaced this exact failure.)
**Why it happens:** Hibernate 6.4 removed the per-version `OracleNNNDialect` classes in favor of a single auto-detecting `OracleDialect`. Boot 3.3 BOM ships Hibernate 6.5.x.
**How to avoid:** Three concrete renames in this repo's properties + Java — see § Hibernate 6 Dialect Migration. Add an inline comment so future devs don't reintroduce the old name from copy-paste.
**Warning signs:** First Spring context-load test failure post-upgrade with `ClassNotFoundException`.
`[VERIFIED: discourse.hibernate.org/t/oracle12cdialect-missing-when-upgrading-from-6-3-2-to-6-4-0]`

### Pitfall 4: `RestHighLevelClient` half-migrated leaves transitive dependency on dead client

**What goes wrong:** Code compiles because Boot 3.3 transitively still resolves the old `elasticsearch-rest-high-level-client` 7.17.x jar; one forgotten `@Autowired RestHighLevelClient` survives and silently injects a null/orphaned bean.
**Why it happens:** Boot's `spring-boot-starter-data-elasticsearch` 5.x no longer auto-configures HLRC — but jars can be on the classpath via legacy deps.
**How to avoid:** After migration, `grep -rn "RestHighLevelClient\|org.elasticsearch.client.RestHighLevelClient" backend/rectrace/src` MUST return zero hits. Confirm `mvn dependency:tree | grep rest-high-level` is empty. The D-1.5 deletion of v3/ removes the only other call sites.
**Warning signs:** `NullPointerException` on first ES query; `NoSuchBeanDefinitionException: RestHighLevelClient` in context-load test.
`[VERIFIED: Context7 + grep]`

### Pitfall 5: `spring-boot-starter-validation` not transitive in Boot 3

**What goes wrong:** Code using `javax.validation.constraints.*` annotations (e.g. `@NotNull` on DTOs) silently stops being validated after upgrade.
**Why it happens:** Boot 3.x dropped `spring-boot-starter-validation` from `spring-boot-starter-web`; must be explicit.
**How to avoid:** Grep `javax.validation\|jakarta.validation\|@NotNull\|@NotBlank\|@Valid` across both `src/main` trees. **Verified: zero hits in this repo.** No action needed. Surfaced for future reference because Boot 3 migrations regularly miss this.
`[CITED: Boot 3.0 release notes]`

### Pitfall 6: `spring-boot-starter-security` adds a default user/password if not configured

**What goes wrong:** Without `SecurityFilterChain`, Boot's auto-config secures everything with `user` / random-password. With our permit-all bean: fine. But if the bean ordering breaks or the bean class isn't found, every endpoint returns 401.
**How to avoid:** ContextLoadsTest must pass post-upgrade in BOTH modules. Smoke test must hit `/api/search/suggest` and confirm 200 (not 401) — see § Validation Architecture.
**Warning signs:** "Using generated security password: …" log line on startup. If you see it, the `SecurityConfig.java` bean isn't being picked up.

### Pitfall 7: `@MockBean` deprecation in Boot 3.4+

**Status:** Boot 3.3 still supports `@MockBean` (the replacement `@MockitoBean` lands in Boot 3.4 / Spring Framework 6.2). `TlmStatsApplicationTests.java` uses three `@MockBean` annotations (lines 19-26).
**How to avoid:** Keep `@MockBean` for now — no warning yet on 3.3.x. Document the deprecation as a Phase 8 cleanup item if the user pivots to 3.4+ / 3.5.x.
`[CITED: spring-projects/spring-framework Boot 3.4 migration notes]`

### Pitfall 8: `spring.elasticsearch.rest.uris` (non-issue, surfaced for verification)

**Status:** Boot 2.7+ already uses `spring.elasticsearch.uris` (no `.rest.` infix). Grep across `application*.properties` confirms current state is already on the modern key. **No rename needed.**
`[VERIFIED: grep]`

### Pitfall 9: AG-Grid license env-var (out of scope but watch for break)

**Status:** AG-Grid Enterprise license key lives in frontend `environment.ts`. Not touched by this phase. Tracked in CONCERNS MEDIUM, deferred to Phase 2 / backlog per Deferred Ideas.

## Code Examples

(Major examples already provided in § Architecture Patterns. Two additional snippets for completeness.)

### Adding `spring-boot-starter-security` dep without breaking startup

```xml
<!-- Both pom.xml files — add after spring-boot-starter-web -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-security</artifactId>
</dependency>
```

Plus the `SecurityConfig.java` bean (Pattern 1 above). Without the bean, Boot auto-config secures every endpoint with a generated password — which would break the BOOT-09 smoke. With the bean, the smoke continues to work unchanged.

### Verifying `Oracle12cDialect` removal end-to-end

```bash
# After parent bump + dialect rename:
grep -rn "Oracle12cDialect" backend/rectrace rectrace-tlm-stats
# Expected: zero hits

# After context-load test:
cd backend/rectrace && mvn test -pl . -Dtest=ContextLoadsTest -Dspring.profiles.active=test
# Expected: BUILD SUCCESS, no ClassNotFoundException in logs

# Confirm dialect class is reachable at runtime (with `local` profile + actual Oracle):
cd backend/rectrace && mvn spring-boot:run -Dspring-boot.run.profiles=local
# Expected: startup log includes "HHH000400: Using dialect: org.hibernate.dialect.OracleDialect"
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `WebSecurityConfigurerAdapter` subclass | `@Bean SecurityFilterChain` lambda | Spring Security 5.7 deprecated; SS 6.0 removed | Mandatory for Boot 3.x |
| `Oracle12cDialect`, `Oracle10gDialect`, etc. | Single `OracleDialect` with auto-detection | Hibernate 6.0 deprecated; 6.4 removed per-version classes | Required rename |
| `RestHighLevelClient` (Java High-Level REST Client) | `co.elastic.clients.elasticsearch.ElasticsearchClient` | ES 7.15 deprecated; 8.0 removed from default starter | Forces API rewrite |
| `javax.servlet.*`, `javax.persistence.*`, `javax.annotation.*` | `jakarta.*` | Jakarta EE 9 namespace move (2020); Boot 3.0 adopted | Mechanical package rename |
| `e.printStackTrace()` to stderr | SLF4J `logger.error("msg", e)` | Standard since SLF4J 1.0 (2004); BOOT-08 cleanup catches stragglers | Code hygiene |
| `spring.elasticsearch.rest.uris` | `spring.elasticsearch.uris` | Boot 2.7 (already done in this repo) | N/A |
| Boot 2.x's spring-boot-starter-web includes validation | Boot 3.x: must add `spring-boot-starter-validation` explicitly | Boot 3.0 | Not relevant here (no validation use) |
| `@MockBean` (Spring) | `@MockitoBean` (Spring 6.2 / Boot 3.4+) | Boot 3.4 | Out-of-scope until Boot pivot |

**Deprecated/outdated in this repo's current state:**
- Boot 2.7.16 — EOL OSS for 18 months (since November 2023); CONCERNS.md HIGH #3 is the primary motivation for this phase.
- `RestHighLevelClient` — dead upstream; D-1.4 closes.
- `Oracle12cDialect` — replaced; § Hibernate 6 Dialect Migration closes.
- V3 search API — D-1.5 closes.
- `frontend/.../services/search.service.ts` — D-1.7 closes.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Boot 3.3.13's BOM pins Hibernate 6.5.x (not 6.4.x or 6.6.x). | Standard Stack table | Hibernate 6.6 added a few Boot-side API hooks; if Boot 3.3.13 actually pins 6.5.x, this is fine. Risk: zero — verifiable with `mvn dependency:tree` post-upgrade. Planner should run that command as a verification step in the parent-bump wave. |
| A2 | Boot 3.3.13's BOM pins Micrometer 1.13.x. | Standard Stack table | Micrometer 1.12 / 1.13 / 1.14 all expose the same Tracing API used by Phase 7 OBS-08. Risk: low. Same verification path. |
| A3 | The Boot 3.3.x `spring-boot-starter-data-elasticsearch` auto-configures `ElasticsearchClient` from `spring.elasticsearch.*` properties without needing a custom `@Configuration` bean for non-SSL cases. | Architecture Patterns / Pattern 2 | If auto-config doesn't bind, planner must add a manual `@Bean ElasticsearchClient`. Verifiable in first wave by injecting `ElasticsearchClient` in a smoke service and confirming Spring resolves the bean. |
| A4 | The user is comfortable with Boot 3.3 OSS support being formally ended; CONCERNS HIGH #3 was written when 3.3 was current. | Pitfall 1 / Summary | If user wants a still-OSS-supported line, pivot to 3.5.x is the planner's call; migration mechanics are identical. **Surface this explicitly to user before plan execution starts.** |
| A5 | `oraclepki` / `osdt_core` / `osdt_cert` 21.5.0.0 work on Java 21 without a version bump. | Standard Stack table | Oracle's compatibility matrix confirms 21.x JDBC on JDK 21; CONTEXT.md Deferred Ideas explicitly says "only spin up a spike if Phase 1 surfaces a JDBC connection failure on Java 21." Acceptable risk per locked decision. |
| A6 | `SearchConfigServiceV3` has zero callers post-v3/-deletion and can be deleted. | Architecture Patterns / project structure note | If `SearchConfigServiceV3` is referenced from elsewhere (e.g. an unexpected V4 fallback path), deletion breaks build. Verifiable by `grep -rn "SearchConfigServiceV3"` after v3/ deletion — should return zero. Planner Discretion item. |
| A7 | `ElasticsearchDevConfiguration.java` can be deleted in Phase 1 because the `local` profile uses `http://` and the `dev` profile isn't exercised in BOOT-09 smoke. | ES Client Migration / SSL handling | If a developer relies on the `dev` profile for local testing against a self-signed cert, deleting the class breaks that flow. CONTEXT.md says the `local` profile is the canonical local-dev path (D-1.14); Phase 9 owns prod SSL. Reasonable risk. |
| A8 | Spring Security 6.3.x permit-all `SecurityFilterChain` does not strip `x-citiportal-loginid` headers. | Architecture Patterns / Pattern 1 | Verified in Spring Security 6.5 reference docs (`authorizeHttpRequests((authz) -> authz.anyRequest().permitAll())` — headers passed through unmodified). Risk: zero. |
| A9 | The latest Boot 3.3.x patch (3.3.13) is what we ship, not an earlier patch. | Standard Stack table | Verifiable on Maven Central; if a later 3.3.14 lands before plan execution, planner picks the newest. |

**Total assumed claims: 9.** A4 is the user-confirmation item (Boot 3.3 EOL). Others are minor and self-verifiable during execution.

## Open Questions (RESOLVED)

> Resolved during plan-phase orchestration on 2026-05-12. Q1 → 3.5.14 lock per Addendum at the top of this file; Q2/Q3/Q4 → planner adopted the researcher's recommendations (see PLAN.md "Open Questions for Plan Checker" for the closure notes).


1. **Boot line: 3.3.13 vs 3.5.x — does the user want to revisit the locked D-1.2 given the EOL fact?**
   - What we know: D-1.2 locks 3.3.x LTS based on CONCERNS HIGH #3 wording. Boot 3.3 OSS support ended 2025-06-30; commercial support ends 2026-06-30 (six weeks from today).
   - What's unclear: Whether the user weighed the EOL window when locking 3.3.x. The "LTS" label has shifted meaning since the support-policy update in February 2025.
   - Recommendation: 30-second user check at plan-start. "ROADMAP says 3.2.x, CONTEXT.md locks 3.3.x, but 3.3 OSS support has actually ended and commercial ends 6 weeks from now — keep 3.3.13 or pivot to 3.5.3?" If pivot: change `<version>3.3.13</version>` to `<version>3.5.3</version>` (or latest 3.5.x patch at execution time); everything else in this research stays correct.

2. **`SearchConfigServiceV3` — delete or keep?**
   - What we know: V3 trio in `service/v3/` is the only user (verified by grep). V4 has its own `SearchConfigServiceV4`. The class loads `search-config.json` which currently lives alongside `search-config-v4.json` in resources.
   - What's unclear: Whether keeping the v3 JSON config file (even unloaded) has value — planner Discretion.
   - Recommendation: Delete `SearchConfigServiceV3.java` and the `search-config.location-old=file:src/main/resources/search-config.json` property in `application*.properties` (BOOT-08 dead-code item). Keep `search-config.json` itself if planner wants a "what shipped on 2.7" reference; otherwise delete it.

3. **`AppConstants` populate vs delete — single-constant class is borderline YAGNI.**
   - What we know: D-1.13 prefers populate, allows delete.
   - What's unclear: Whether a constants class with a single string entry buys enough over an inline literal to justify three `import` lines.
   - Recommendation: Populate (per D-1.13). Three `imports` is a cost of three lines; the upside is the literal "x-citiportal-loginid" is grep-able to exactly one definition site — useful for Phase 9 SEC-01 which will likely add more login-related constants.

4. **`ElasticsearchDevConfiguration.java` — delete now or keep as no-op `@Profile("dev")` placeholder?**
   - What we know: Phase 9 owns prod SSL truststore (SEC-03/04). Local profile uses plain HTTP; dev profile is no longer exercised by BOOT-09 smoke.
   - What's unclear: Whether any developer's `.gitignore`d local launch config sets `-Dspring.profiles.active=dev`.
   - Recommendation: Delete in Phase 1. If a regression appears, the executor adds it back with a one-liner before plan completion.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Apache Maven | Build (both modules) | ✓ | 3.9.14 | — |
| JDK 21 | Compile/run target | ✓ | OpenJDK 25.0.2 currently active; JDK 21 needs to be confirmed | Set `JAVA_HOME` to JDK 21 install before plan execution (STATE.md notes Lombok 1.18.30 broke on JDK 25 — Boot 3.3 BOM pulls Lombok 1.18.34 which fixes this; either JDK works post-upgrade) |
| Oracle FREEPDB1 (local) | BOOT-09 smoke (search, execution-order, suggestions) | Phase 00.1 confirmed live | gvenzl/oracle-free 23-slim via sibling repo's docker stack | None — BOOT-09 manual smoke is blocked without Phase 00.1's stack running |
| Elasticsearch (local) | BOOT-09 smoke (search, suggestions) | Phase 00.1 confirmed live | docker.elastic.co/elasticsearch/elasticsearch:8.13.4 via sibling repo | None — see above |
| Internet access for Maven Central | Initial dep download post-bump | ✓ (dev laptop) | n/a | On Citi VM, Phase 9 SEC-06 covers internal Nexus mirror — out of scope here |
| Git | Source control | ✓ | (working branch `milestone/modernization` per Phase 0 D-15) | — |
| Node.js / npm | Frontend dead-code removal verification (delete + spec delete) | ✓ (only used for verification, not build in this phase) | — | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** JDK 21 may need a `JAVA_HOME` swap if the shell defaults to JDK 25 — note for the planner.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | JUnit 5 (Jupiter) + Spring Boot Test, both pulled by `spring-boot-starter-test` (BOM-managed under Boot 3.3.13) |
| Config file | `backend/rectrace/src/test/resources/application-test.properties`; `rectrace-tlm-stats/src/test/resources/application-test.properties` (Phase 0 D-05) |
| Quick run command | `mvn -pl backend/rectrace test -Dtest=ContextLoadsTest`; `mvn -pl rectrace-tlm-stats test -Dtest=TlmStatsApplicationTests` |
| Full suite command | `mvn -f backend/rectrace/pom.xml clean test`; `mvn -f rectrace-tlm-stats/pom.xml clean test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BOOT-01 | Java 21 toolchain compiles both modules | build | `mvn -f backend/rectrace/pom.xml -q -DskipTests compile && mvn -f rectrace-tlm-stats/pom.xml -q -DskipTests compile` | ✅ (compile target) |
| BOOT-02 | Boot 3.3.13 BOM resolves cleanly | build | `mvn -f backend/rectrace/pom.xml dependency:tree -q | grep 'spring-boot.*3.3.13'` (presence assertion) | ✅ |
| BOOT-03 | No `javax.*` imports remain (excluding `javax.net.ssl` and other JDK packages) | grep | `! grep -rn "^import javax\.\(servlet\|persistence\|annotation\|sql\|transaction\|validation\|ws\|inject\)" backend/rectrace/src/main rectrace-tlm-stats/src/main` | ✅ (one-liner) |
| BOOT-04 | `SecurityFilterChain` bean loads; permit-all passes anonymous calls | integration | `ContextLoadsTest` boots with `spring-boot-starter-security` on classpath. Smoke: `curl -s -o /dev/null -w "%{http_code}" http://localhost:6088/rectrace/api/search/suggest?prefix=ABC` returns `200`. | ✅ (existing + smoke) |
| BOOT-05 | Hibernate 6 / Spring Data JPA 3 context loads against new dialect | unit | `ContextLoadsTest` (test profile bypasses Oracle); live smoke against `local` profile boots without `ClassNotFoundException`. | ✅ |
| BOOT-06 | `SuggestionService` returns suggestions on new client | integration (manual smoke) | `curl -s http://localhost:6088/rectrace/api/search/suggest?prefix=SET` returns JSON array (may be empty on test data) with HTTP 200. | ✅ |
| BOOT-07 | No version overrides; BOM resolves | build | `! grep -A1 dependencyManagement backend/rectrace/pom.xml` (assertion: no override section); `mvn dependency:tree -q | grep -E 'lombok|micrometer|hibernate-core'` shows BOM-managed versions. | ✅ |
| BOOT-08 | No `printStackTrace`, `show_sql=true`, dead V3 code | grep | `! grep -rn "printStackTrace\|System\.err" backend/rectrace/src/main rectrace-tlm-stats/src/main`; `! grep -rn "show-sql=true\|hibernate.show_sql.*true" backend/rectrace/src/main rectrace-tlm-stats/src/main`; `! find backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v3 -type f`; `! find frontend/rectrace/src/app/services -name 'search.service.ts' -o -name 'search.service.spec.ts'` | ✅ |
| BOOT-09 | All Phase 0 tests pass + manual smoke green | full suite + manual | `mvn -f backend/rectrace/pom.xml clean test && mvn -f rectrace-tlm-stats/pom.xml clean test` + `01-SMOKE-CHECKLIST.md` execution against `local` profile. | ✅ (existing tests; smoke checklist authored by planner) |

### BOOT-09 manual smoke (curl + browser; against `local` profile)

The Phase 00.1 D-0.1.23 smoke (5/5 automatable PASS, 3 UI deferred) is the template. Adapt the steps to post-3.3.x build:

```bash
# Pre-flight: sibling repo stack up
cd ../rectrace-local-dev && docker compose ps  # both containers running
./bin/apply.py --verify                        # 5 rows in Oracle + 5 ES docs

# 1. backend/rectrace boots on local profile
cd ../autosys-job-explorer/backend/rectrace
JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn spring-boot:run -Dspring-boot.run.profiles=local
# Expected: log line "Tomcat started on port 6088" + "Using dialect: org.hibernate.dialect.OracleDialect"
# Expected: NO "Using generated security password" line (would mean SecurityConfig didn't load)

# 2. V4 keyword search returns SAMPLE_* rows
curl -s 'http://localhost:6088/rectrace/api/v4/search/initial?searchTerm=SAMPLE&category=rectrace_core' \
  -H 'x-citiportal-loginid: smoke-test' | jq '.results | length'
# Expected: 3 (per Phase 00.1 P07 smoke result)

# 3. /api/search/suggest endpoint responds 200
curl -s -o /dev/null -w "%{http_code}\n" \
  'http://localhost:6088/rectrace/api/search/suggest?prefix=SET'
# Expected: 200

# 4. Hyphenated keyword path still works (Phase 8 dry-run prerequisite)
curl -s 'http://localhost:6088/rectrace/api/v4/search/initial?searchTerm=SET-ABC-123&category=rectrace_core' \
  -H 'x-citiportal-loginid: smoke-test' | jq '.results | length'
# Expected: 1

# 5. SecurityFilterChain permit-all passes anonymous requests
curl -s -o /dev/null -w "%{http_code}\n" \
  'http://localhost:6088/rectrace/api/search/suggest?prefix=AB'
# Expected: 200 (NOT 401)

# 6. execution-order endpoint returns sequence
curl -s 'http://localhost:6088/rectrace/api/execution-order/LOAD-ABC-123' \
  -H 'x-citiportal-loginid: smoke-test' | jq '.executionSequence | length'
# Expected: >= 1

# 7. printStackTrace / show_sql absent from startup log
JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn spring-boot:run -Dspring-boot.run.profiles=local 2>&1 | grep -E "show_sql|printStackTrace"
# Expected: empty output

# 8. rectrace-tlm-stats boots on local profile
cd ../../rectrace-tlm-stats
JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn spring-boot:run -Dspring-boot.run.profiles=local
# Expected: log line "Tomcat started on port 8080"

# 9. tlm-stats actuator health
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/actuator/health
# Expected: 200

# (UI smoke deferred to user — same 3 items as Phase 00.1 P07: execution-order graph, TLM-stats modal, QuickRec modal)
```

### Sampling Rate

- **Per task commit:** `mvn -pl <module> test -Dtest=ContextLoadsTest` (or `TlmStatsApplicationTests`) — ~15-20 s each module.
- **Per wave merge:** `mvn -f backend/rectrace/pom.xml clean test && mvn -f rectrace-tlm-stats/pom.xml clean test` — full Phase 0 context-load coverage.
- **Phase gate:** Full suite green in both modules + manual smoke checklist passed (steps 1-9 above, plus 3 UI items deferred to user verification).

### Wave 0 Gaps

- [ ] `backend/rectrace/src/test/java/com/citi/gru/rectrace/ContextLoadsTest.java` — already exists (Phase 0 plan 00-01). Verify still passes post-upgrade.
- [ ] `rectrace-tlm-stats/src/test/java/com/citi/gru/rectrace/tlmstats/TlmStatsApplicationTests.java` — already exists (Phase 0 plan 00-02). Verify `@MockBean` still works on Boot 3.3.13.
- [ ] `.planning/phases/01-backend-platform-upgrade/01-SMOKE-CHECKLIST.md` — planner authors (Discretion call per CONTEXT.md).

*(No new test framework install needed; both modules already have `spring-boot-starter-test` pulled by Boot BOM.)*

## Security Domain

> CONTEXT.md explicitly defers all real security work to Phase 9 (D-1.9). Phase 1's security surface is intentionally minimal: a permit-all `SecurityFilterChain` to satisfy BOOT-04 without coupling auth-mechanism choice to a version-bump phase. The following table catalogues which ASVS categories Phase 1 touches incidentally vs. defers.

### Applicable ASVS Categories (Phase 1 incidental)

| ASVS Category | Applies in Phase 1 | Standard Control | Phase 1 Action |
|---------------|---------------------|-----------------|----------------|
| V2 Authentication | No (deferred Phase 9 SEC-01) | Spring Security filter chain w/ identity provider | None — permit-all bean |
| V3 Session Management | No | Stateless REST | None |
| V4 Access Control | No (deferred Phase 9) | `authorizeHttpRequests` rules | `permitAll()` only |
| V5 Input Validation | No (no new endpoints; existing controllers use `@RequestParam`, `@RequestHeader(required = false)`) | Spring Boot's `@Valid` + Bean Validation | None |
| V6 Cryptography | No (TLS material deferred Phase 9 SEC-03/04) | Use JVM truststore + standard libraries | None — dev SSL bypass UNCHANGED in this phase |
| V7 Error Handling | Yes (BOOT-08 closure) | SLF4J logging instead of stderr | `printStackTrace`/`System.err` → `logger.error` |
| V14 Configuration | Yes (BOOT-08 closure) | Don't log SQL in non-debug; disable verbose stack traces | `show-sql=false`; explicit Hikari pool config |

### Known Threat Patterns for {Spring Boot 3.3 + Java 21}

| Pattern | STRIDE | Standard Mitigation | Phase 1 Status |
|---------|--------|---------------------|----------------|
| Default user/password from `spring-boot-starter-security` w/o `SecurityFilterChain` | Spoofing | Always provide an explicit `SecurityFilterChain` bean | D-1.8 satisfies — `SecurityConfig.java` per module |
| Plaintext password in `application.properties` | Information Disclosure | Externalize via Vault / SOPS / env | **DEFERRED to Phase 9 SEC-02** (D-1.9 carryover) |
| ES SSL trust-all bypass in `@Profile("dev")` | Tampering / MITM | JVM truststore with internal Citi CA | **DEFERRED to Phase 9 SEC-03/04**; local profile uses plain HTTP, dev profile recommended for deletion this phase |
| `x-citiportal-loginid` accepted unvalidated | Spoofing | Server-side validation against identity provider | **DEFERRED to Phase 9 SEC-01** |
| Maven dependency from external repository (vs internal Nexus) | Tampering (supply chain) | Citi internal Nexus mirror | **DEFERRED to Phase 9 SEC-06**; dev laptop uses Maven Central directly |

## Sources

### Primary (HIGH confidence)

- **Maven Central solrsearch** (queried 2026-05-12) — confirmed `spring-boot-starter-parent:3.3.13` as latest 3.3.x patch (release timestamp 1750322481000 = 2025-06-19), `elasticsearch-java:8.18.3` latest, `lombok:1.18.38` latest, but Boot 3.3.13 BOM pins `lombok:1.18.34`.
- **Context7** `/elastic/elasticsearch-java` — ElasticsearchClient builder pattern, SSLContext via TransportUtils, search request pattern with bool/wildcard/collapse/sort, suggester pattern via `FieldSuggester` + `Suggester`, Jackson mapper integration.
- **Context7** `/websites/spring_io_spring-security_reference_6_5` — `SecurityFilterChain` bean shape with `csrf().disable()` and `authorizeHttpRequests((authz) -> authz.anyRequest().permitAll())`.
- **endoflife.date/spring-boot** — Boot 3.3 OSS support ended 2025-06-30; commercial support ends 2026-06-30; latest patch 3.3.13 released 2025-06-19.
- **Repo grep audit** — 15 `javax.*` import lines across both modules (14 to rewrite, 1 stays JDK); 2 `printStackTrace`/`System.err` survivors; 3 `Oracle12cDialect` references; zero `WebSecurityConfigurerAdapter`; zero `AppConstants\.` callers; V3 trio callers confined to `SearchController.java` + within v3/.
- **STATE.md Phase 00.1 P07 closing note** — Lombok 1.18.30 ↔ JDK 25 incompatibility + KNOWN GAPS (DataSourceConfig.java:41-42 + DatabaseConfig.java unconditional scriptExecutor calls).

### Secondary (MEDIUM confidence)

- **GitHub spring-projects/spring-boot#39044** — confirms `Oracle12cDialect` `ClassNotFoundException` after Boot 3.2.1 upgrade with Hibernate 6.4+; confirms `OracleDialect` is the replacement.
- **discourse.hibernate.org/t/oracle12cdialect-missing-when-upgrading-from-6-3-2-to-6-4-0/8687** — Hibernate 6.4 removed per-version dialect classes; `OracleDialect` is the consolidated replacement (auto-detects via JDBC connection).
- **spring.io/blog/2025/02/13/support-policy-updates** — clarifies Boot's "no formal LTS" model; every minor has 12-month OSS + commercial extension.
- **herodevs.com Spring Boot Versions April 2026** — current state of Boot version support windows.

### Tertiary (LOW confidence — needs validation during execution)

- Exact Boot 3.3.13 transitive versions for Hibernate, Micrometer, ES client. **Verifiable in plan execution by `mvn dependency:tree`** before authoring the migration commits. Documented as Assumption A1/A2/A3 in Assumptions Log.
- Whether `spring-boot-starter-data-elasticsearch` auto-config produces a usable `ElasticsearchClient` bean for our local plain-HTTP setup without a custom `@Bean` override. **Verifiable in the ES migration wave by injecting `ElasticsearchClient` and observing whether `ContextLoadsTest` resolves it.**
- Whether `ElasticsearchDevConfiguration`'s `RestClientBuilderCustomizer` API survives intact on Boot 3.3 or needs reshape. **Verifiable by `mvn compile` immediately post-bump.**

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Boot 3.3.13 + Java 21 + ES Java API Client 8.13.x all directly verified.
- Architecture (jakarta sweep, dialect, security bean): HIGH — concrete file:line list grep-confirmed; replacement patterns Context7-verified.
- ES client migration: MEDIUM — pattern verified, but the exact response shape for completion suggesters in client 8.13.x is a one-line reconfirmation away (see Pitfall 4 / Assumption A3).
- BOOT-08 cleanup quartet: HIGH — every file:line is grep-confirmed; diffs are mechanical.
- Pitfalls (esp. Pitfall 1 Boot 3.3 EOL): HIGH — multiple authoritative sources align.

**Research date:** 2026-05-12
**Valid until:** 2026-05-19 — recommended re-verify Boot 3.3.13 patch version (or pivot to 3.5.x) at plan-start. The rest is stable for 30 days.

## RESEARCH COMPLETE
