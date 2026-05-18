# Phase 1: Backend Platform Upgrade - Context

**Gathered:** 2026-05-12
**Status:** Ready for planning (after Phase 0.1 — local dev seed bootstrap — is inserted and complete)

<domain>
## Phase Boundary

Both Maven modules — `backend/rectrace` and `rectrace-tlm-stats` — are upgraded from Spring Boot 2.7.16 + Java 17 to **Spring Boot 3.5.14 + Java 21**, with `javax.*` → `jakarta.*` namespaces migrated, a permit-all `SecurityFilterChain` bean configured per module (no auth mechanism change — Phase 9 owns that), and the Elasticsearch client migrated to the new Java API Client (`co.elastic.clients.elasticsearch.ElasticsearchClient`) on the live ES code paths. The phase exits when both modules build green on Boot 3.5.14 + Java 21, all existing tests pass (Phase 0's context-load tests on the `test` profile), and a manual smoke against a local Oracle + ES (via the new `local` Spring profile) confirms search, execution-order, TLM-stats, and the `/api/search/suggest` autocomplete still work end-to-end.

**In scope:**
- Boot parent POM bump (2.7.16 → 3.5.14) and Java target bump (17 → 21) in both modules' `pom.xml`, identical version properties in both.
- `javax.*` → `jakarta.*` namespace sweep (servlet, persistence, annotation, sql packages — full list from the `javax.` grep below).
- `Oracle12cDialect` → `OracleDialect` (Hibernate 6 deprecation), both in `DataSourceConfig` Java code and in `application.properties`.
- `RestHighLevelClient` → `ElasticsearchClient` migration for `SuggestionService` and `ElasticsearchServiceV4` only.
- Removal of V3 search trio: `SearchServiceV3`, `OracleSearchProviderV3`, `ElasticsearchSearchProviderV3`, plus the three V3 endpoints in `SearchController` (`/v3/search/keyword`, `/v3/search/expand`, `/v3/search/ssrm/{category}`).
- Removal of frontend dead code: `frontend/rectrace/src/app/services/search.service.ts` and its spec (CONCERNS MEDIUM #4).
- New per-module `SecurityFilterChain` bean: permits everything, disables CSRF. CORS stays as-is (Phase 9 territory).
- Dependency-pin refresh aligned with the Boot 3.5 BOM (Hibernate 6.6.x, ES client 8.15.x, Micrometer 1.14.x — versions resolved transitively from `spring-boot-starter-parent:3.5.14`, never overridden). Exact transitive versions are confirmed at plan-time by the planner.
- BOOT-08 cleanup quartet (all four folded in): replace `printStackTrace` + `System.err.println` with SLF4J across `ScriptExecutor` and `ExecutionOrderService.clobToString`; remove `show_sql=true` from default profile (Java + properties); add explicit `HikariCP` pool config to primary rectrace `DataSourceConfig.dataSource()`; either delete `AppConstants.java` or populate it with `CITI_PORTAL_LOGIN_ID_HEADER` (planner picks).
- New `application-local.properties` in both modules pointing to `localhost:1521` Oracle and `localhost:9200` ES, used via `-Dspring.profiles.active=local` for laptop-side smoke testing.
- All `@Profile("!test")` guards added in Phase 0 preserved across the migration.
- ROADMAP.md updated to reflect actual locked versions: Spring Boot **3.5.14** (replacing the previously-written "3.2.x" — and superseding the briefly-locked "3.3.x LTS" — per amended D-1.2) and Java 21 (not "17 or 21 if VM supports").

**Out of scope for Phase 1:**
- Auth mechanism choice and `x-citiportal-loginid` header validation — Phase 9 (SEC-01).
- CORS lock-down — Phase 9 (SEC-05).
- ES SSL truststore work and removal of the dev-only SSL bypass code path — Phase 9 (SEC-03, SEC-04).
- AG-Grid Enterprise license env-var wiring (CONCERNS MEDIUM) — out of phase; frontend-side and tied to the React Foundation rollout.
- Long-file refactors / splitting `SearchServiceV4`, `OracleServiceV4`, `ExecutionOrderService` into smaller classes — captured as deferred-ideas Round 2 cleanup phase.
- Parent aggregator POM at repo root for shared dependency management — deferred to a build-hygiene phase.
- Renaming Angular `search-v5/` to `search-v4/` — Angular is on the decommission path; alignment happens by attrition via the new React frontend using V4 nomenclature from Phase 2 onward.
- TeamCity / Lightspeed / uDeploy CI wiring — Phase 0 D-03 deferred to Phase 8 / backlog.
- New integration tests against real Oracle / ES (e.g. Testcontainers) — deferred; smoke against local Oracle/ES via the `local` profile is the verification path for BOOT-09.
- Schema migrations / Liquibase / Flyway — not introduced in this phase.

</domain>

<decisions>
## Implementation Decisions

### Version targets

- **D-1.1:** Java target is **Java 21** for both modules. `<java.version>21</java.version>` and `<maven.compiler.release>21</maven.compiler.release>` in both `pom.xml`. Planner must verify the deployment VM has JDK 21+ before the upgrade ships (success criterion #1 in ROADMAP.md).
- **D-1.2:** Spring Boot version is **3.5.14** (pin exactly). **Amended 2026-05-12** during plan-phase research after verifying current support state at endoflife.date: Boot 3.3 OSS support ended 2025-06-30 and commercial support ends 2026-06-30 (~6 weeks from the amendment date), making the originally-locked 3.3.x line effectively dead. Boot 3.5 is the **current OSS line with the longest commercial-support window** (2032-06-30 — six years), matching CONCERNS.md HIGH #3's "commercial LTS line" intent. Boot 4.0 (GA Nov 2025) was considered but rejected: it pulls in Spring Framework 7 and additional migration surface beyond what this phase scopes. The 2.7.16 → 3.5.14 migration mechanics are **identical** to those for 3.3.x per the gsd-phase-researcher pass — zero rework vs the original lock. ROADMAP.md is updated in this phase to reflect **3.5.14** (replacing the previously-written "3.2.x" / "3.3.x LTS").
- **D-1.3:** Both modules pin **identical** `spring-boot.version` and `java.version` properties. Any future bump must be applied to both. No drift permitted — cross-module version alignment is a maintenance-cost reduction the user explicitly called out.

### Elasticsearch client strategy

- **D-1.4:** Migrate to the new **Java API Client** (`co.elastic.clients.elasticsearch.ElasticsearchClient`) for the live ES code paths. `RestHighLevelClient` is dropped from the codebase entirely — no compat dep added.
- **D-1.5:** `SearchServiceV3`, `OracleSearchProviderV3`, `ElasticsearchSearchProviderV3` are **deleted**. The three V3 endpoints in `SearchController` (`/v3/search/keyword`, `/v3/search/expand`, `/v3/search/ssrm/{category}`) are **removed**.
- **D-1.6:** **Kept and migrated** to the new client: `SuggestionService` (preserving the `/api/search/suggest` URL contract — V5 frontend autocomplete depends on it) and `ElasticsearchServiceV4`. Planner decides whether to move the surviving `/api/search/suggest` endpoint from `SearchController` into `SearchControllerV4` or leave it as a slimmed-down `SearchController`.
- **D-1.7:** Frontend dead code removed in lockstep: `frontend/rectrace/src/app/services/search.service.ts` and `search.service.spec.ts` are deleted (CONCERNS MEDIUM #4). Removal verified by grep — no remaining import / dynamic load.

### Spring Security scope

- **D-1.8:** One `SecurityFilterChain` bean per module — both **permit all** and **disable CSRF** (REST API, stateless). No header validation, no CORS change, no auth filter. This satisfies BOOT-04 mechanically without coupling a behavior change to a version-bump phase.
- **D-1.9:** Header validation for `x-citiportal-loginid` (CONCERNS HIGH) is **explicitly deferred to Phase 9** (SEC-01). Controllers continue reading the header via `@RequestHeader(required = false)` exactly as they do today.

### BOOT-08 cleanup scope

All four "cheap during the upgrade" items folded in:

- **D-1.10:** `e.printStackTrace()` in `ScriptExecutor.java` and `System.err.println("Error reading CLOB")` in `ExecutionOrderService.clobToString` are replaced with `logger.error("...", e)` using the existing SLF4J facade. The CLOB-to-string code path stays as-is functionally (still commented out per CONCERNS MEDIUM "clobToString fields commented out"); the logging fix is the only behavior change. Whether to uncomment the CLOB lines is **out of scope** — Phase 8 territory if it ever lands.
- **D-1.11:** `spring.jpa.show-sql=false` set in `application.properties`. The redundant `properties.setProperty("hibernate.show_sql", "true")` in `DataSourceConfig` is removed entirely. `application-prod.properties` / `application-uat.properties` already inherit; verify no override.
- **D-1.12:** Explicit `HikariCP` pool config added to primary rectrace `DataSourceConfig.dataSource()`, mirroring the `AutosysDataSourceConfig` pattern (HikariConfig with `maximumPoolSize`, `connectionTimeout`, `idleTimeout`, `maxLifetime`). Default values come from the AutosysDataSourceConfig defaults; planner can tune. The two TLM-stats DataSources (reconmgmt, recportal) in `rectrace-tlm-stats/.../DatabaseConfig.java` get the same treatment.
- **D-1.13:** `AppConstants.java` is **populated** with `public static final String CITI_PORTAL_LOGIN_ID_HEADER = "x-citiportal-loginid"` (and any other strings that are duplicated across `SearchController` / `UserController` / `SearchControllerV4`); the duplicated literals in those controllers are replaced with the constant. (Deletion is the alternative — planner picks if the constant is the only entry that surfaces; populating is slightly cleaner since it prevents future duplication.)

### Local dev profile (laptop-side smoke for BOOT-09)

- **D-1.14:** A new `application-local.properties` is created in both modules. Connection strings point to `localhost:1521` Oracle and `localhost:9200` ES. Credentials use plaintext non-secret defaults (e.g. `system/oracle` for Oracle Free) or `${LOCAL_DB_USER}` / `${LOCAL_DB_PASSWORD}` env-var placeholders — planner picks based on what `application-prod.properties` / `application-uat.properties` already pattern.
- **D-1.15:** **Nothing Docker-shaped** lands in the repo. No `docker-compose.yml`, no `Dockerfile`, no Testcontainers test dependency, no seed-data SQL files inside `backend/rectrace/` or `rectrace-tlm-stats/`. The local Oracle + ES infrastructure and sample data are environmental — set up via the prerequisite Phase 0.1 in a sibling directory `../rectrace-local-dev/` that does not ship to Citi.
- **D-1.16:** Tests stay at Phase 0's context-load level. No integration tests added in this phase. BOOT-09 verification is the user's manual smoke against the `local` profile.
- **D-1.17:** All `@Profile("!test")` annotations added in Phase 0 (on `DataSourceConfig`, `AutosysDataSourceConfig`, `ElasticsearchDevConfiguration`, the V4 controllers, and the V4/V3 services) are **preserved** across the migration. Migrating to `jakarta.*` namespaces does not require removing or re-applying these guards.

### Project-level convention (cross-cutting, affects Phase 2+)

- **D-1.18:** The **new React frontend (Phase 2 onward) uses V4 nomenclature** to match backend URL contracts (`/api/v4/search/*`, `search-config-v4.json`). The legacy Angular `search-v5/` directory stays unchanged until Angular decommission deletes it. Alignment between frontend and backend version labels is achieved by attrition, not by refactor. This convention is referenced in REQUIREMENTS.md SEARCH-01 (which currently says "v3/v4") and should be reflected in Phase 2's CONTEXT.md.

### Phase ordering implication

- **D-1.19:** **Phase 0.1 (Local Dev Seed Bootstrap)** must be inserted into ROADMAP.md before this phase executes. Phase 0.1 produces `../rectrace-local-dev/` (a sibling directory, NOT inside this repo) with Oracle DDL per schema (rectrace primary, autosys, reconmgmt, recportal), sample-row INSERT scripts that exercise V4 search / execution-order graph / TLM-stats modal flows, and ES index templates + bulk-load JSON for the indexes `ElasticsearchServiceV4` and `SuggestionService` hit. Phase 1's BOOT-09 smoke test depends on Phase 0.1 being complete. Roadmap mutation: insert "Phase 0.1: Local Dev Seed Bootstrap" between current Phase 0 and Phase 1 via `/gsd-phase` after this CONTEXT.md is committed.

### Claude's Discretion (planner decides)

- **Commit shape**: incremental staged commits (parent bump → jakarta sweep → Hibernate dialect → ES client migration → V3 removal → SecurityFilterChain → BOOT-08 cleanup → frontend dead-code removal → ROADMAP.md edit) vs a smaller number of larger commits. Bias toward bisectable atomic commits per BOOT-NN requirement; the wave model from Phase 0 worked well and is the default unless a step is provably entangled with another.
- **BOOT-09 smoke definition**: written checklist in `.planning/phases/01-backend-platform-upgrade/01-SMOKE-CHECKLIST.md` covering: app starts on `local` profile → V4 keyword search returns rows → V4 SSRM page loads → suggestion endpoint returns results → execution-order graph for a known job renders → TLM-stats modal opens against the `rectrace-tlm-stats` sibling service → no `printStackTrace` / `show_sql` lines in the local run's stdout. Planner shapes the exact step list.
- **Connection credential strategy** for `application-local.properties`: plaintext non-secret defaults vs env-var placeholders. Pick whichever is consistent with the existing profile-properties pattern.
- **`AppConstants` populate vs delete**: prefer populate (D-1.13) but allow delete if the only constant is `CITI_PORTAL_LOGIN_ID_HEADER` and planner judges a dedicated constants class is over-engineering.
- **`SearchController` post-V3-removal shape**: keep as a single-endpoint controller hosting `/api/search/suggest`, or fold the endpoint into `SearchControllerV4`. Planner picks based on package hygiene.
- **Per-module Maven build order**: both modules can upgrade independently (no inter-module dependency); planner picks ordering (likely `backend/rectrace` first since it's the larger surface, then `rectrace-tlm-stats`).
- **Concrete Hibernate 6 / Spring Data JPA 3 breakages**: any specific entity-manager or repository signature breakage discovered during the upgrade is the planner/executor's call to fix in place.

### Folded Todos

None — no pending todos matched this phase at discuss time.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project context
- `.planning/PROJECT.md` — Rectrace modernization milestone scope, constraints, tech-stack lock (Spring Boot 3.2.x LTS-style — superseded by amended D-1.2 to **3.5.14**).
- `.planning/REQUIREMENTS.md` §"Backend platform upgrade" — BOOT-01..09 (the nine Phase 1 requirements).
- `.planning/ROADMAP.md` §"Phase 1: Backend Platform Upgrade" — phase goal + success criteria. Will be edited in this phase to reflect locked versions.
- `.planning/STATE.md` — current milestone state.

### Prior phase decisions (carry-forward)
- `.planning/phases/00-foundation/00-CONTEXT.md` — Phase 0 decisions. Specifically: D-05 (`application-test.properties` + `spring.autoconfigure.exclude` for Oracle + ES), D-15 (single `milestone/modernization` branch), D-17 (verify working branch before commit).
- `.planning/phases/00-foundation/00-VERIFICATION.md` — Phase 0 exit state. Confirms `@Profile("!test")` guards in place and context-load tests passing pre-upgrade.

### Research findings
- `.planning/research/PITFALLS.md` Pitfall #10 — "`maven.test.skip=true` lets silent regressions ship" (Phase 0 closed this; Phase 1 must keep tests passing post-upgrade).
- `.planning/research/PITFALLS.md` Pitfall #7 (partially) — "Observability misconfig" (relevant to: do NOT add per-component Micrometer version overrides; let the Boot 3.5 BOM resolve transitively).
- `.planning/research/SUMMARY.md` — note: "Phase 1: React foundation" in SUMMARY.md is **stale** roadmap nomenclature; the current Phase 1 in ROADMAP.md is Backend Platform Upgrade. Research notes for the upgrade are scattered across PITFALLS.md and CONCERNS.md.

### Codebase facts
- `.planning/codebase/STACK.md` — current Spring Boot 2.7.16 / Java 17 setup and dependency baseline.
- `.planning/codebase/STRUCTURE.md` — module layout (`backend/rectrace`, `rectrace-tlm-stats`), package paths, where V3/V4 services live.
- `.planning/codebase/CONCERNS.md` HIGH #3 ("Spring Boot 2.7.x — OSS EOL") — primary motivation for this phase; lists key migrations (javax→jakarta, Oracle12cDialect→OracleDialect, RestClientBuilderCustomizer ES 3.x API).
- `.planning/codebase/CONCERNS.md` MEDIUM #2 — V3/V4 parallel APIs both active (closed by D-1.5).
- `.planning/codebase/CONCERNS.md` MEDIUM #4 — Legacy frontend `SearchService` orphaned (closed by D-1.7).
- `.planning/codebase/CONCERNS.md` MEDIUM #5..#7, #9 — `hibernate.show_sql=true`, `printStackTrace`/`System.err.println`, `AppConstants` empty (closed by D-1.10..1.13).
- `.planning/codebase/CONCERNS.md` HIGH #7 — primary rectrace DataSource missing HikariCP pool (closed by D-1.12).
- `.planning/codebase/CONVENTIONS.md` — package naming, controller/service patterns; new code follows existing patterns.

### Files to touch in Phase 1 (illustrative — planner finalizes)

**Module `backend/rectrace`:**
- `pom.xml` — parent version 2.7.16 → **3.5.14**; `<java.version>` 17 → 21; `<maven.compiler.release>` 17 → 21.
- `src/main/java/com/citi/gru/rectrace/RectraceApplication.java` — verify still works; no changes expected.
- `src/main/java/com/citi/gru/rectrace/config/DataSourceConfig.java` — `javax.sql` → `jakarta.sql`; `javax.persistence` → `jakarta.persistence`; `Oracle12cDialect` → `OracleDialect`; add HikariConfig pool sizing; remove `properties.setProperty("hibernate.show_sql","true")`.
- `src/main/java/com/citi/gru/rectrace/config/AutosysDataSourceConfig.java` — `javax.sql` → `jakarta.sql`.
- `src/main/java/com/citi/gru/rectrace/config/ElasticsearchDevConfiguration.java` — `javax.net.ssl` stays (`javax.net.ssl` is NOT in the JEE→Jakarta rename set; it's `java.net` JDK API); `RestClientBuilderCustomizer` 3.x API changes (verify import path); `@Profile("dev")` already present.
- `src/main/java/com/citi/gru/rectrace/config/CorsConfig.java` — no Boot-3 specific change (CORS lock-down deferred to Phase 9); verify still works.
- `src/main/java/com/citi/gru/rectrace/config/` — **new** `SecurityConfig.java` with one `@Bean SecurityFilterChain` per D-1.8; permit-all + CSRF disabled.
- `src/main/java/com/citi/gru/rectrace/controller/SearchController.java` — `javax.servlet.http` → `jakarta.servlet.http`; remove `/v3/search/keyword`, `/v3/search/expand`, `/v3/search/ssrm/{category}` endpoints; replace inline `"x-citiportal-loginid"` with `AppConstants.CITI_PORTAL_LOGIN_ID_HEADER`.
- `src/main/java/com/citi/gru/rectrace/controller/v4/SearchControllerV4.java` — `javax.servlet.http` → `jakarta.servlet.http`; same constant replacement.
- `src/main/java/com/citi/gru/rectrace/controller/UserController.java` — same.
- `src/main/java/com/citi/gru/rectrace/controller/ExecutionOrderController.java` — verify; minor.
- `src/main/java/com/citi/gru/rectrace/service/ExecutionOrderService.java` — `javax.persistence` → `jakarta.persistence`; replace `System.err.println(...)` with `logger.error(...)`.
- `src/main/java/com/citi/gru/rectrace/service/JobStatusService.java` — `javax.sql` → `jakarta.sql`.
- `src/main/java/com/citi/gru/rectrace/service/SuggestionService.java` — `RestHighLevelClient` → `ElasticsearchClient` (full rewrite of the search call).
- `src/main/java/com/citi/gru/rectrace/service/SearchConfigServiceV3.java` — `javax.annotation.PostConstruct` → `jakarta.annotation.PostConstruct`.
- `src/main/java/com/citi/gru/rectrace/service/v3/` — **delete entire directory** (`SearchServiceV3`, `OracleSearchProviderV3`, `ElasticsearchSearchProviderV3`).
- `src/main/java/com/citi/gru/rectrace/service/v4/SearchConfigServiceV4.java` — `javax.annotation.PostConstruct` → `jakarta.annotation.PostConstruct`.
- `src/main/java/com/citi/gru/rectrace/service/v4/ElasticsearchServiceV4.java` — `RestHighLevelClient` → `ElasticsearchClient` (full rewrite of the search/SSRM calls).
- `src/main/java/com/citi/gru/rectrace/service/v4/SearchServiceV4.java` — re-verify; mostly delegation, may need ES-client-aware fix-up.
- `src/main/java/com/citi/gru/rectrace/service/v4/OracleServiceV4.java` — no namespace migration expected; verify Spring Data JPA 3 / Hibernate 6 breakages.
- `src/main/java/com/citi/gru/rectrace/util/ScriptExecutor.java` — replace `e.printStackTrace()` with `logger.error(...)`; add SLF4J logger field.
- `src/main/java/com/citi/gru/rectrace/constants/AppConstants.java` — populate with `CITI_PORTAL_LOGIN_ID_HEADER` (or delete; planner picks).
- `src/main/resources/application.properties` — `spring.jpa.show-sql=true` → `false`; `hibernate.dialect=Oracle12cDialect` → `OracleDialect`.
- `src/main/resources/application-local.properties` — **new** file; `localhost:1521` Oracle + `localhost:9200` ES per D-1.14.

**Module `rectrace-tlm-stats`:**
- `pom.xml` — same parent + Java bump.
- `src/main/java/com/citi/gru/rectrace/tlmstats/TlmStatsApplication.java` — verify; no changes expected.
- `src/main/java/com/citi/gru/rectrace/tlmstats/config/DatabaseConfig.java` — `javax.sql` → `jakarta.sql`; add HikariCP pool config to reconmgmt + recportal datasources; `TlmJdbcTemplateFactory` keeps the hardcoded script path (CONCERNS LOW #2 is out of scope).
- `src/main/java/com/citi/gru/rectrace/tlmstats/config/CorsConfig.java` — no change.
- `src/main/java/com/citi/gru/rectrace/tlmstats/config/` — **new** `SecurityConfig.java` with permit-all `SecurityFilterChain`.
- Any `javax.*` imports found by grep in `tlmstats/` or `quickrec/` packages → `jakarta.*`.
- `src/main/resources/application.properties` — same `hibernate.dialect` rename; `spring.jpa.show-sql` not currently set, no change needed.
- `src/main/resources/application-local.properties` — **new** file.

**Frontend cleanup:**
- `frontend/rectrace/src/app/services/search.service.ts` — **delete** (D-1.7).
- `frontend/rectrace/src/app/services/search.service.spec.ts` — **delete**.

**Planning documents:**
- `.planning/ROADMAP.md` — Phase 1 description: replace "Spring Boot 2.7 → 3.2" / "Java 17 (or 21 if Citi VM supports)" with the locked values.
- `.planning/STATE.md` — updated by `/gsd-discuss-phase` workflow finalization.

### External references (Boot 3 migration playbooks)
- Spring Boot 3.5 Release Notes — https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-3.5-Release-Notes (planner may fetch at plan time). The 3.3 and 3.4 release notes are also relevant since the project crosses 2.7 → 3.5 (and therefore inherits every interim breaking change).
- Spring Security 6 migration guide — `WebSecurityConfigurerAdapter` → `SecurityFilterChain` (https://docs.spring.io/spring-security/reference/6.0/migration/index.html).
- Elasticsearch Java API Client docs — https://www.elastic.co/guide/en/elasticsearch/client/java-api-client/current/index.html (HLRC → new client migration).
- Hibernate 6 deprecations: `Oracle12cDialect` → `OracleDialect`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`AutosysDataSourceConfig`'s HikariCP pattern** is the template for D-1.12. It already declares `maximumPoolSize`, `minimumIdle`, `connectionTimeout`, `idleTimeout`, `maxLifetime` via `HikariConfig`. Primary `DataSourceConfig` and the two `rectrace-tlm-stats` datasources copy this shape.
- **Existing Spring profile pattern** (`application.properties` / `application-prod.properties` / `application-uat.properties` / `application-test.properties`) — adding `application-local.properties` follows the same convention. No code changes to enable the new profile.
- **`@Profile("!test")` guards from Phase 0** — already prove the test profile cleanly excludes DB/ES beans. The same guards work post-upgrade; planner verifies, no re-application needed.
- **Phase 0's `ContextLoadsTest.java` in both modules** — the regression-detector for "did the upgrade break Spring context loading?" These tests MUST still pass after every commit in Phase 1.
- **`AutosysDataSourceConfig`'s `oraclepki` / `osdt_core` / `osdt_cert` dep set** — already pinned at 21.5.0.0 in `pom.xml`; verify these still work with Java 21 (Oracle docs confirm compatibility).
- **`environment-prod.properties`**'s pattern of inheriting defaults and overriding selectively — `application-local.properties` does the same.

### Established Patterns

- **Multi-datasource per module**: rectrace has rectrace + autosys; tlm-stats has reconmgmt + recportal + per-instance dynamic. Each Phase 1 namespace migration touches all datasource configs in lockstep.
- **`@PostConstruct` config loading** in `SearchConfigServiceV3` and `SearchConfigServiceV4` — namespace migration is the only change; behavior preserved.
- **`@Async("taskExecutor")` in V3 SearchServiceV3 vs `CompletableFuture.runAsync` in V4 SearchServiceV4** — V3 dies with D-1.5; only the V4 `CompletableFuture` pattern survives. No change to V4's threading.
- **SLF4J `LoggerFactory.getLogger(Class.class)` everywhere except in two files** — the two exceptions (`ScriptExecutor`, `ExecutionOrderService.clobToString`) are corrected in D-1.10. Convention preserved.
- **`AppConstants` as utility class with private constructor throwing `UnsupportedOperationException`** — populating it (D-1.13) follows the pattern; constants are `public static final` UPPER_SNAKE_CASE.

### Integration Points

- **Frontend `search-v5.service.ts:137`** calls `/api/search/suggest` — must continue returning the same JSON shape after `SuggestionService` is rewritten on `ElasticsearchClient`. The endpoint URL contract is preserved (D-1.6).
- **Frontend `search-v5.service.ts`** calls `/api/v4/search/initial`, `/api/v4/search/ssrm/{category}`, `/api/v4/search/export` — all live; must continue working through V4 service rewrite on the new ES client.
- **Frontend execution-order graph component** calls `/api/execution-order/{jobName}` (`ExecutionOrderController`) — namespace migration only; behavior preserved.
- **Frontend TLM-stats modal v2** calls `rectrace-tlm-stats` service on port 8080 — both modules upgrade in this phase; the cross-module contract is HTTP (JSON), not class-level, so as long as both stay green on Boot 3.5 the contract holds.
- **Local Oracle / ES** (Phase 0.1 prerequisite) — the contract Phase 1 needs from the local stack: Oracle listening on `localhost:1521` accepting `system/oracle` (or env-var creds), with schemas matching `application.properties`'s expectations; ES listening on `localhost:9200` with the indexes V4 + Suggestion query. Schema details flow into Phase 0.1's planning.

</code_context>

<specifics>
## Specific Ideas

- User explicitly asked for **cross-module version alignment** to reduce maintenance cost: "we will make the version number same across for easier future maintenance bro." Both modules pin identical Boot + Java versions. Drift is not allowed.
- User clarified that **frontend-backend version label alignment** (V5 vs V4) is best handled by **convention going forward**, not by Angular refactor: "currently frontend says v5 and backend service says v4. i meant to make that consistent bro." Resolution: new React frontend uses V4; Angular V5 dies as-is (D-1.18).
- User explicitly wants **everything testable on the laptop before code moves to Citi**: "i will be more confortable if everything is tested thoroughly in local once before i move the code to citi." This is the motivation for D-1.14..1.17 (local profile) and for Phase 0.1 (seed data prerequisite).
- User explicitly excluded **all Docker-shaped artifacts** from the codebase: "we don't have to write docker compose files bro. we will just start it manually and then use it for our testing purpose. lets not have any mention about docker in the code." Codified in D-1.15.
- User wants the seed-data folder **outside the project workspace** so it doesn't ship to Citi: "we can keep it in a folder outside the project workspace as well... when I move the code to citi, i will just skip that folder." → Phase 0.1 produces `../rectrace-local-dev/`, a sibling directory.
- User flagged a **future Round 2 cleanup phase** for long-term maintainability: "we will go one more round a later phase to make code more robust and long term maintainable bro." Captured as a deferred idea.

</specifics>

<deferred>
## Deferred Ideas

- **Round 2 cleanup phase** — long-file splits (`SearchServiceV4` ~750 lines, `OracleServiceV4` ~550 lines, `ExecutionOrderService` ~500 lines, `SearchV5GridComponent` ~655 lines), deeper code hygiene, structural refactors for long-term maintainability. Lands after Boot 3.5.x is stable. Out of scope for the upgrade phase because mixing structural refactors into a version-bump phase makes regression bisection harder.
- **Parent aggregator POM at repo root** — share `dependencyManagement` across both modules so dependency versions live in one place. Real maintenance win but a structural refactor coupled to a version bump. Defer to a build-hygiene / repo-structure phase.
- **Angular `search-v5/` → `search-v4/` rename** — alignment via Angular refactor. Rejected because Angular is on the decommission path; effort would be discarded. Alignment achieved via D-1.18 (React frontend uses V4 from Phase 2).
- **Backend V4 → V5 rename** — would align with Angular's V5 naming, but propagates to URL contracts, search-config-v4.json filename, every frontend HTTP call, every test. Largest blast radius; also locks V5 nomenclature forward forever (Phase 5 SELECT, Phase 6 Loader, etc. all inherit V5). Rejected.
- **AG-Grid Enterprise license env-var wiring** (CONCERNS MEDIUM) — frontend-side, tied to React Foundation rollout in Phase 2, not the backend upgrade phase.
- **Header validation for `x-citiportal-loginid`** (CONCERNS HIGH) — Phase 9 (SEC-01) owns the real auth mechanism; defer header rejection logic to land alongside it, not as a placeholder in Phase 1.
- **CORS lock-down** (CONCERNS CRITICAL #4) — Phase 9 (SEC-05).
- **ES SSL truststore + removal of dev-only SSL bypass** (CONCERNS CRITICAL #2) — Phase 9 (SEC-03, SEC-04).
- **Plaintext DB password in `application.properties`** (CONCERNS CRITICAL #1) — Phase 9 (SEC-02 service-auth) since service-auth mechanism (Kerberos keytab / Vault) is the right solution.
- **Uncomment `clobToString` lines in `ExecutionOrderService`** (CONCERNS MEDIUM #6) — Phase 8 polish, not the upgrade phase.
- **`TlmJdbcTemplateFactory` hardcoded script path** (CONCERNS LOW #2) — Phase 8 or backlog.
- **`statusses` typo in log message** (CONCERNS LOW) — Phase 8 polish.
- **Frontend `console.log` removal** (CONCERNS LOW) — Phase 8 frontend polish.
- **Frontend `any` type cleanup** (CONCERNS LOW) — Phase 2 React Foundation will use typed AG-Grid APIs from day one; Angular cleanup is wasted effort.
- **Dark mode TODO in TLM filters SCSS** (CONCERNS LOW) — Phase 8.
- **Testcontainers / integration tests against real Oracle/ES in `mvn test`** — explicitly rejected for Phase 1; tests stay at context-load level. Reconsider per-phase if a future phase's requirements demand integration coverage (likely Phase 5 SQL or Phase 6 Loader).
- **TeamCity / Lightspeed / uDeploy CI pipeline wiring** — Phase 0 D-03; Phase 8 Ops Hardening or backlog.
- **Spike to verify `oraclepki` 21.5.0.0 works on Java 21** — only spin up a spike if Phase 1 execution surfaces a JDBC connection failure on Java 21. Oracle docs claim compat; no a-priori spike needed.

### Reviewed Todos (not folded)

None — no pending todos were reviewed at discuss time.

</deferred>

---

*Phase: 01-backend-platform-upgrade*
*Context gathered: 2026-05-12*
