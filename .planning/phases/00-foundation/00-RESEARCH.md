# Phase 0: Foundation — Research

**Researched:** 2026-05-12
**Domain:** Spring Boot 2.7 test configuration (profile-based auto-config exclusion) + Angular→React parity matrix inventory
**Confidence:** HIGH — all findings verified against actual source files in this repo; auto-config class names verified against Spring Boot 2.7.16 canonical package structure.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**CI / test gate**
- D-01: CI engine target when wired is **TeamCity** (not Lightspeed, not uDeploy).
- D-02: Phase 0 keeps the test gate **local-only** — removing `maven.test.skip=true` is the gate. `mvn install` fails on test red automatically. No extra Maven plugin or pre-commit hook required in Phase 0.
- D-03: Wiring `mvn test` into a TeamCity job is **deferred** to Phase 8 (Ops Hardening) or a backlog item.
- D-04: Test gate scope is **backend only** — `backend/rectrace` and `rectrace-tlm-stats`. Angular Karma stays as-is.

**Test fixtures (FOUND-03)**
- D-05: Use a `test` Spring profile with `src/test/resources/application-test.properties` per module setting `spring.autoconfigure.exclude=...`. One `@SpringBootTest @ActiveProfiles("test")` test per module with a single `contextLoads()` assertion.
- D-06: **No Testcontainers** — Citi VM typically does not have Docker.
- D-07: **No H2** — H2 ≠ Oracle; would create false safety.
- D-08: Richer fixture strategies (real DB tests, integration tests) deferred to the phase that needs them.

**Parity matrix (FOUND-04)**
- D-09: Matrix lives at `.planning/parity-matrix.md` (top-level, not under a phase dir).
- D-10: **Granularity: tab/route rollup** — one row per current Angular route or top-level tab.
- D-11: **Five-valued target vocabulary:** `port` / `replace-content-with-recviz` / `replace-fully-with-recviz` / `drop` / `tbd`
- D-12: Day-0 fill-in scope: every route/tab gets a row with compact renderer list and a target verb (or `tbd`). Priority and Notes may be `tbd`.
- D-13: Matrix is a **living document** — edited as React phases land.
- D-14: **Gating rule:** React phase can start once every row has a non-`tbd` target.

**Branching strategy**
- D-15: Single milestone branch `milestone/modernization` — all 10 phases commit here.
- D-16: Phase 0 docs that pre-date the branch landed on `main` and stay there.
- D-17: Future phases verify working branch is `milestone/modernization` before any commit.

### Claude's Discretion

- Exact `spring.autoconfigure.exclude=` list per module — planner inspects each `pom.xml` to determine which auto-configs to exclude.
- Whether to add a pre-commit hook in Phase 0 (alongside the un-skipped Maven build).
- Format of the `parity-matrix.md` table (column ordering, Markdown layout).
- How to discover the day-0 row set (likely `grep`/inventory of Angular routes + `search-config-v4.json` categories).

### Deferred Ideas (OUT OF SCOPE)

- TeamCity pipeline job
- Lightspeed / uDeploy deploy automation
- Vitest gate for the new React app
- Real-database test fixtures (Testcontainers, H2, `@MockBean`)
- Pre-commit hook (planner may include or skip)
- Filling the parity matrix Priority and Notes columns
- `/gsd-settings` branching-strategy config key improvement
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOUND-01 | Remove `maven.test.skip=true` from both `pom.xml` files; switch to `-DskipTests` for manual override only | Two-line property deletion; verified exact location in each pom.xml |
| FOUND-02 | Add CI gate that fails on `mvn test` failure for both backend modules | Achieved automatically once FOUND-01 is done — `mvn install` fails on test red. No extra plumbing in Phase 0. |
| FOUND-03 | Bootstrap minimum test scaffolding — at least one passing Spring context-load test per Maven module | Concrete `application-test.properties` exclusion recipes + `ContextLoadsTest.java` body below |
| FOUND-04 | Commit React↔Angular parity matrix at `.planning/parity-matrix.md` | Day-0 row set inventoried; renderer map and column schema provided below |
</phase_requirements>

---

## Summary

Phase 0 has two independent work streams: (1) un-skip the Maven test gate and bootstrap a passing context-load test in each module, and (2) produce the parity matrix at `.planning/parity-matrix.md`. Neither depends on the other. Each can be a separate plan.

**Backend test stream:** Both `backend/rectrace` and `rectrace-tlm-stats` declare `<maven.test.skip>true</maven.test.skip>` at line 31 and line 18 respectively. `backend/rectrace` has zero test source files; `rectrace-tlm-stats` has one existing test file (`TlmStatsApplicationTests.java`) but no `test/resources`. The critical blocker for making `@SpringBootTest` pass without live databases is that **both modules have custom `@Configuration` beans (DataSourceConfig, AutosysDataSourceConfig, DatabaseConfig) that call `ScriptExecutor` at startup** — they try to run `/opt/rectify/control/scripts/get_password.sh`, fail silently (catching the exception), and return an empty password, which causes connection creation to fail. These are not Spring autoconfiguration classes; they are `@Configuration` beans that will always fire unless excluded by profile or by `@ConditionalOnProfile`. The solution is a `test` Spring profile that prevents these custom beans from creating DataSources at startup. The cleanest approach is `@Profile("!test")` on each custom DataSource config class, combined with `spring.autoconfigure.exclude` to disable Spring Boot's own auto-configured database wiring in `application-test.properties`.

**Parity matrix stream:** The Angular app has exactly one user-visible route (`/search`) backed by `SearchV5Component`, which renders tabs for 13 search categories from `search-config-v4.json`. The tab-level granularity mandated by D-10 means 13 search-tab rows plus cross-cutting rows for execution order, TLM stats, and QuickRec modals — roughly 16–18 rows total. Six distinct `cellRenderer` string keys are registered in the grid: `appIDCellRenderer`, `supportEmailCellRenderer`, `executionOrderButtonRenderer`, `setIdV2Renderer`, `reconV2Renderer`, `tlmInstanceV2Renderer`, `reconIdRenderer`, `recPortalIdRenderer`. Not all are referenced by `search-config-v4.json`; some (`setIdV2Renderer`, `reconV2Renderer`) are registered in the grid component but the current `search-config-v4.json` does not reference them directly — they may be referenced by legacy `search-config.json` or by dynamic category config.

**Primary recommendation:** Split into three plans — (a) `backend/rectrace` test gate, (b) `rectrace-tlm-stats` test gate, (c) parity matrix day-0 inventory and commit. Plans (a) and (b) can run in parallel; plan (c) is independent of both.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Remove maven.test.skip | Build config | — | `pom.xml` property deletion, no runtime impact |
| Test profile auto-config exclusion | Backend Config | — | `application-test.properties` in `src/test/resources/`; profile-driven Spring wiring |
| ContextLoads test | Backend Test | — | JUnit 5 + SpringBootTest in `src/test/java/`; validates Spring context boots |
| Parity matrix document | Planning artifact | — | Markdown file at `.planning/parity-matrix.md`; no code, no runtime impact |

---

## Standard Stack

### Core — already on classpath, no new dependencies needed

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `spring-boot-starter-test` | 2.7.16 (BOM-managed) | JUnit 5, Mockito, AssertJ, SpringBootTest | Already declared scope `test` in both `pom.xml` files [VERIFIED: pom.xml] |
| `junit-jupiter` | 5.9.x (via starter) | Test runner | Pulled transitively by `spring-boot-starter-test` 2.7.16 [VERIFIED: pom.xml] |

**No new Maven dependencies required for Phase 0.** `spring-boot-starter-test` is already present in both modules.

---

## Architecture Patterns

### System Architecture Diagram

```
Phase 0 — no runtime code changes

  backend/rectrace/pom.xml         rectrace-tlm-stats/pom.xml
       [remove maven.test.skip]         [remove maven.test.skip]
              |                                  |
              v                                  v
  src/test/resources/                src/test/resources/
  application-test.properties        application-test.properties
  (exclude DataSource + ES auto-configs)  (exclude DataSource auto-configs)
              |                                  |
              v                                  v
  src/test/java/.../                src/test/java/.../
  ContextLoadsTest.java              TlmStatsApplicationTests.java
  @SpringBootTest                    @SpringBootTest
  @ActiveProfiles("test")            @ActiveProfiles("test")
  contextLoads() -> pass             contextLoads() -> pass
              |                                  |
              v                                  v
         mvn test GREEN              mvn test GREEN


  Angular routes + search-config-v4.json + grid component
              |
              v grep / static analysis
  .planning/parity-matrix.md (day-0 snapshot)
  ~16-18 rows, 5-valued target vocab
```

### Recommended Project Structure (new files only)

```
backend/rectrace/
└── src/test/
    ├── java/com/citi/gru/rectrace/
    │   └── ContextLoadsTest.java        # NEW
    └── resources/
        └── application-test.properties  # NEW

rectrace-tlm-stats/
└── src/test/
    ├── java/com/citi/gru/rectrace/tlmstats/
    │   └── TlmStatsApplicationTests.java  # EXISTS — add @ActiveProfiles("test")
    └── resources/
        └── application-test.properties    # NEW

.planning/
└── parity-matrix.md                       # NEW
```

---

## Spring Profile-Based Test Exclusion — Concrete Recipe

### Why `spring.autoconfigure.exclude` alone is NOT enough

[VERIFIED: reading DataSourceConfig.java, AutosysDataSourceConfig.java, DatabaseConfig.java]

Both modules have **custom `@Configuration` beans** that create DataSources by running the `ScriptExecutor` shell script at startup. These are NOT Spring Boot auto-configuration classes — they are user-defined `@Bean` definitions that fire regardless of `spring.autoconfigure.exclude`. Excluding `DataSourceAutoConfiguration` only prevents Spring Boot's own datasource wiring; it does NOT prevent `DataSourceConfig.dataSource()` or `AutosysDataSourceConfig.autosysDataSource()` from running.

Specifically:
- `backend/rectrace`: `DataSourceConfig.dataSource()` calls `ScriptExecutor.executeScript("/opt/rectify/control/scripts/get_password.sh", ...)` at bean creation time. `AutosysDataSourceConfig.autosysDataSource()` reads `autosys.db.*` properties and calls HikariCP. Both fire unconditionally.
- `rectrace-tlm-stats`: `DatabaseConfig.reconmgmtDataSource()`, `DatabaseConfig.recportalDataSource()`, and `TlmJdbcTemplateFactory` all run shell scripts at startup. `TlmJdbcTemplateFactory` also loads `tlm-instances.json` and creates JDBC connections lazily per instance.

**The test profile solution must prevent these custom `@Configuration` beans from running.** Two viable approaches:

**Approach A (recommended — no source code change to production config):** Add `@Profile("!test")` to each custom DataSource `@Configuration` class. This is a one-line annotation on 2 classes in `backend/rectrace` and 1 class in `rectrace-tlm-stats`.

**Approach B (alternative — only test config changes):** Use `@MockBean` for `DataSource` and `EntityManagerFactory` in the test class. This prevents Spring from trying to create them. However, for a pure context-load test with no mocking setup, `@Profile("!test")` is cleaner.

**Recommended: Approach A** — annotate the custom datasource config classes, then combine with `spring.autoconfigure.exclude` in `application-test.properties` to suppress Spring Boot's own wiring. [ASSUMED - that adding @Profile("!test") to production config classes is acceptable; confirm with user if they want to avoid touching production source files]

### Per-Module: `application-test.properties` content

#### `backend/rectrace/src/test/resources/application-test.properties`

[VERIFIED: backend/rectrace/pom.xml has spring-boot-starter-data-jpa + spring-boot-starter-data-elasticsearch + no H2/embedded DB]

```properties
# Disable Spring Boot's own DB/ES auto-configuration for context-load tests.
# Note: DataSourceConfig and AutosysDataSourceConfig also need @Profile("!test")
# because they are user-defined @Configuration beans (not auto-configs).
spring.autoconfigure.exclude=\
  org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,\
  org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration,\
  org.springframework.boot.autoconfigure.jdbc.DataSourceTransactionManagerAutoConfiguration,\
  org.springframework.boot.autoconfigure.data.elasticsearch.ElasticsearchDataAutoConfiguration,\
  org.springframework.boot.autoconfigure.data.elasticsearch.ElasticsearchRepositoriesAutoConfiguration,\
  org.springframework.boot.autoconfigure.data.elasticsearch.ReactiveElasticsearchRepositoriesAutoConfiguration

# Prevent Spring Boot from trying to resolve datasource properties at startup
spring.datasource.url=
datasource.url=jdbc:oracle:thin:@test-placeholder
datasource.username=test
datasource.service-name=TEST
datasource.db-schema=TEST
datasource.driver-class-name=oracle.jdbc.OracleDriver

# Disable JPA entirely in test profile
spring.jpa.hibernate.ddl-auto=none

# Suppress ES connection
spring.elasticsearch.uris=http://localhost:9200
```

**Required source changes alongside this properties file:**

Add `@Profile("!test")` to the following classes:
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/DataSourceConfig.java`
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/AutosysDataSourceConfig.java`

These classes call `ScriptExecutor` at bean creation time. Without `@Profile("!test")`, they run in the test context even when auto-configs are excluded.

> **Why `ElasticsearchDevConfiguration` is a separate concern:** That class creates a `RestClientBuilderCustomizer` bean. During tests, if `ElasticsearchDataAutoConfiguration` is excluded, no ES client is created, so the customizer bean fires but has nothing to customize — it causes no failure. However, it is still good practice to add `@Profile("!test")` to `ElasticsearchDevConfiguration` to prevent the misleading "bypass SSL" warning logs during test runs.

#### `rectrace-tlm-stats/src/test/resources/application-test.properties`

[VERIFIED: rectrace-tlm-stats/pom.xml has spring-boot-starter-data-jpa + ojdbc8 (runtime) + no ES dependency]

```properties
# Disable Spring Boot's own DB auto-configuration.
# Note: DatabaseConfig also needs @Profile("!test") because it is a user-defined
# @Configuration bean that calls ScriptExecutor and reads tlm-instances.json at startup.
spring.autoconfigure.exclude=\
  org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,\
  org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration,\
  org.springframework.boot.autoconfigure.jdbc.DataSourceTransactionManagerAutoConfiguration

# Provide placeholder values to satisfy @Value-injected fields in DatabaseConfig
# when the profile guard prevents the bean from running but Spring still resolves
# the class for scanning. (If @Profile("!test") is added to DatabaseConfig,
# these placeholders become optional but are harmless to include.)
reconmgmt.datasource.url=jdbc:oracle:thin:@test-placeholder
reconmgmt.datasource.username=test
reconmgmt.datasource.service-name=TEST
reconmgmt.datasource.db-schema=TEST
reconmgmt.datasource.driver-class-name=oracle.jdbc.OracleDriver
recportal.datasource.url=jdbc:oracle:thin:@test-placeholder
recportal.datasource.username=test
recportal.datasource.service-name=TEST
recportal.datasource.db-schema=TEST

# Suppress password script path resolution
password.script.path=/dev/null
```

**Required source change alongside this properties file:**

Add `@Profile("!test")` to:
- `rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/config/DatabaseConfig.java`

`DatabaseConfig` creates 2 DataSource beans + 1 `TlmJdbcTemplateFactory` bean at startup, all of which run `ScriptExecutor` and try to connect to Oracle. [VERIFIED: DatabaseConfig.java lines 74–200]

> **About `recportal.datasource.url` missing from application.properties:** CONCERNS.md HIGH item correctly flags that `recportal.datasource.url` is required by `DatabaseConfig` but not in `application.properties`. The existing `TlmStatsApplicationTests` would fail even after un-skipping because of this missing property. The placeholder values in `application-test.properties` resolve this for the test context. The production issue (missing value in `application.properties`) is a Phase 1 concern.

---

## Per-Module Test Fixture File Paths and ContextLoadsTest Body

### `backend/rectrace` (no test files exist today)

**File paths to create:**
```
backend/rectrace/src/test/java/com/citi/gru/rectrace/ContextLoadsTest.java
backend/rectrace/src/test/resources/application-test.properties
```

**Java package:** `com.citi.gru.rectrace` (mirrors `RectraceApplication.java` package) [VERIFIED: RectraceApplication.java package declaration]

**`ContextLoadsTest.java` body:**
```java
package com.citi.gru.rectrace;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class ContextLoadsTest {

    @Test
    void contextLoads() {
        // Asserts that the Spring application context loads without errors
        // when Oracle and Elasticsearch are excluded via the "test" profile.
    }

}
```

### `rectrace-tlm-stats` (one test file exists, needs profile + resources dir)

**File paths:**
```
rectrace-tlm-stats/src/test/java/com/citi/gru/rectrace/tlmstats/TlmStatsApplicationTests.java   # EXISTS — modify
rectrace-tlm-stats/src/test/resources/application-test.properties                                # NEW
```

**Modified `TlmStatsApplicationTests.java`:**
```java
package com.citi.gru.rectrace.tlmstats;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class TlmStatsApplicationTests {

    @Test
    void contextLoads() {
        // Asserts that the Spring application context loads without errors
        // when Oracle is excluded via the "test" profile.
    }

}
```

---

## Parity Matrix Day-0 Inventory — Source Commands and Findings

### Source commands to discover the row set

**Step 1: Angular routes (verified)**
```bash
# Top-level routing:
cat frontend/rectrace/src/app/app-routing.module.ts
# Result: one route — path 'search' -> SearchV5Module
# plus redirect '' -> '/search'

# Search-level routing:
cat frontend/rectrace/src/app/search-v5/search-v5-routing.module.ts
# Result: path '' -> SearchV5Component
```

**Step 2: Search tabs from search-config-v4.json**
```bash
python3 -c "
import json
with open('backend/rectrace/src/main/resources/search-config-v4.json') as f:
    d = json.load(f)
for c in d['categories']:
    renderers = sorted({col['cellRenderer'] for col in c['columns'] if 'cellRenderer' in col})
    print(c['key'], '-', c['label'], '|', renderers)
"
```

**Step 3: Cross-cutting UI capabilities (modals and toolbar features)**
```bash
find frontend/rectrace/src/app/custom-interactions/components/modals -mindepth 1 -maxdepth 1 -type d
```

**Step 4: Registered renderer keys in the grid component**
```bash
grep -n "components:" frontend/rectrace/src/app/search-v5/components/search-v5-grid/search-v5-grid.component.ts
```

### Day-0 findings (verified against codebase)

**Route inventory:** [VERIFIED: app-routing.module.ts]
- Only one Angular route: `/search` → `SearchV5Component`
- `SearchV5Component` renders a tab bar where each tab corresponds to one category from `search-config-v4.json`

**13 search categories from `search-config-v4.json`:** [VERIFIED: reading search-config-v4.json]

| Category key | Label | Renderers in this category |
|---|---|---|
| fileName | File Name | `appIDCellRenderer`, `supportEmailCellRenderer`, `executionOrderButtonRenderer` |
| reconName | Recon Name | `executionOrderButtonRenderer` |
| boxName | Box Name | `executionOrderButtonRenderer` |
| setId | Set ID | `executionOrderButtonRenderer` |
| subAcc | Sub Account | `executionOrderButtonRenderer` |
| loadFileName | Load File Name | `executionOrderButtonRenderer` |
| jobName | Job Name | `appIDCellRenderer`, `supportEmailCellRenderer`, `executionOrderButtonRenderer` |
| machineName | Machine Name | (none) |
| runCalendar | Run Calendar | (none) |
| excludeCalendar | Exclude Calendar | (none) |
| tlmInstance | TLM Instance | (none) |
| reconId | Recon ID | (none) |
| reconPortalId | Recon Portal ID | (none) |

**Registered cellRenderer keys in `SearchV5GridComponent.gridOptions.components`:** [VERIFIED: search-v5-grid.component.ts lines 181–189]
- `appIDCellRenderer` → `AppIDCellRendererComponent`
- `supportEmailCellRenderer` → `AppSupportCellRendererComponent`
- `executionOrderButtonRenderer` → `ExecutionOrderButtonComponent` (opens execution order modal)
- `setIdV2Renderer` → `SetIdV2RendererComponent`
- `reconV2Renderer` → `ReconV2RendererComponent`
- `tlmInstanceV2Renderer` → `TlmInstanceV2RendererComponent`
- `reconIdRenderer` → `ReconIdRendererComponent`
- `recPortalIdRenderer` → `RecPortalIdRendererComponent`

Note: `setIdV2Renderer`, `reconV2Renderer`, `tlmInstanceV2Renderer`, `reconIdRenderer`, `recPortalIdRenderer` are **registered but not referenced in `search-config-v4.json`**. They may be used in legacy `search-config.json` (V3) or are candidates for `drop` in the parity matrix.

**Modal inventory (cross-cutting capabilities):** [VERIFIED: STRUCTURE.md + component file list]
- Execution Order Modal (opens Cytoscape.js graph) — triggered by `ExecutionOrderButtonComponent`
- TLM Stats Modal V1 (legacy, 545 lines, dead code per CONCERNS.md)
- TLM Stats Modal V2 (active — triggered by `TlmInstanceV2RendererComponent`)
- QuickRec Stats Modal (triggered by separate renderer/button)

---

## Parity Matrix Markdown Table Shape

### Recommended column set

```markdown
| Angular Feature | Type | Current Location | Renderers / Components | Target | Priority | Notes |
|---|---|---|---|---|---|---|
```

| Column | Purpose |
|---|---|
| Angular Feature | Human-readable name (e.g., "File Name search tab") |
| Type | `search-tab`, `modal`, `grid-feature`, `toolbar-feature`, `app-shell` |
| Current Location | Angular source path or config key |
| Renderers / Components | Compact list of Angular component names this feature uses |
| Target | `port` / `replace-content-with-recviz` / `replace-fully-with-recviz` / `drop` / `tbd` |
| Priority | `P1` / `P2` / `P3` / `tbd` — fill during React phase planning |
| Notes | Free text — fill during React phase planning |

### Gating rule (top of parity-matrix.md)

```markdown
> **Gate:** The React Foundation phase (Phase 2) can begin once every row in this table
> has a non-`tbd` value in the **Target** column. Priority and Notes may remain `tbd`
> at that point — they are filled during each React phase's planning.
```

### Example rows (day-0 state)

```markdown
| File Name search tab | search-tab | search-config-v4.json#fileName | `appIDCellRenderer`, `supportEmailCellRenderer`, `executionOrderButtonRenderer` | tbd | tbd | tbd |
| Recon Name search tab | search-tab | search-config-v4.json#reconName | `executionOrderButtonRenderer` | tbd | tbd | tbd |
| TLM Instance search tab | search-tab | search-config-v4.json#tlmInstance | `tlmInstanceV2Renderer` (registered, not in config) | tbd | tbd | tbd |
| Execution Order Modal | modal | custom-interactions/components/modals/execution-order-graph/ | `ExecutionOrderButtonComponent`, Cytoscape.js | tbd | tbd | tbd |
| TLM Stats Modal V2 | modal | custom-interactions/components/modals/tlm-stats-modal-v2/ | `TlmInstanceV2RendererComponent` | replace-content-with-recviz | tbd | TLM stats shown inside recviz dashboard; renderer that opens modal stays in rectrace |
| TLM Stats Modal V1 | modal | custom-interactions/components/modals/tlm-stats-modal/ | `SetIdCellRendererComponent` (v1, dead code) | drop | tbd | Dead code per CONCERNS.md — V1 renderer and modal unused by V5 grid |
| QuickRec Stats Modal | modal | custom-interactions/components/modals/quickrec-stats-modal/ | QuickRec renderer | tbd | tbd | tbd |
| Dark / Light mode toggle | app-shell | services/theme.service.ts | `ThemeService` | port | tbd | tbd |
| AG-Grid SSRM + group expansion | grid-feature | search-v5-grid.component.ts | `SearchV5GridComponent` | port | tbd | tbd |
| AG-Grid column/filter sidebar | grid-feature | search-v5-grid.component.ts | AG-Grid side bar config | port | tbd | tbd |
| Excel export | toolbar-feature | search-v5-grid.component.ts | AG-Grid export API | port | tbd | tbd |
| Recent searches / typeahead | toolbar-feature | search-v5.component.ts | SearchV5Component | port | tbd | Not in Angular today — to be built in React |
```

> The TLM-stats modal example is the canonical illustration of `replace-content-with-recviz` per D-11: "the entire tlm-stat-modal can be implemented in recviz, but the renderer still has to be in rectrace which renders the modal on click showing recviz's embedded dashboard."

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Disable Oracle connection in tests | Custom test runner, in-memory Oracle substitute | `@Profile("!test")` on config classes + `spring.autoconfigure.exclude` in properties | Spring's profile system is the canonical pattern; no extra deps needed |
| Test Spring context load | Custom context initialization logic | `@SpringBootTest @ActiveProfiles("test")` (JUnit 5, already on classpath) | Built-in; `spring-boot-starter-test` already declared |
| Parallel execution of both test gates | Manually coordinating two Maven commands | `mvn test` in each module separately (they are independent Maven projects, not a multi-module POM) | Two independent `mvn` commands is the correct approach |

---

## Common Pitfalls

### Pitfall 1: `spring.autoconfigure.exclude` is not enough — custom `@Configuration` beans still fire

**What goes wrong:** The planner writes `application-test.properties` with `spring.autoconfigure.exclude=...DataSourceAutoConfiguration,...` and assumes the test will pass. It doesn't. The test fails with `java.lang.RuntimeException: Script execution failed with exit code: 1` because `DataSourceConfig.dataSource()` still runs — it calls the shell script, the script doesn't exist on the dev machine or CI, and the datasource creation fails.

**Why it happens:** `spring.autoconfigure.exclude` only prevents **Spring Boot auto-configuration classes**. `DataSourceConfig`, `AutosysDataSourceConfig`, and `DatabaseConfig` are user-defined `@Configuration` classes — they are not auto-configurations and are not affected by this property.

**How to avoid:** Add `@Profile("!test")` to `DataSourceConfig`, `AutosysDataSourceConfig`, and `DatabaseConfig`. This prevents the beans from being created when the `test` profile is active.

**Warning signs:** Test fails with `Script execution failed`, `RuntimeException: Failed to configure permissive SSL`, or `Cannot load driver class: oracle.jdbc.OracleDriver`.

**Source:** [VERIFIED: DataSourceConfig.java line 39-41, AutosysDataSourceConfig.java, DatabaseConfig.java lines 74-100]

---

### Pitfall 2: `RectraceApplication` already excludes `DataSourceAutoConfiguration` — double-exclude is fine

**What goes wrong:** Developer sees that `RectraceApplication.java` already excludes `DataSourceAutoConfiguration` and `JpaRepositoriesAutoConfiguration`, and assumes no properties file is needed.

**Why it matters:** The `@SpringBootApplication(exclude = {...})` on the main class applies to the `@SpringBootTest` context too, so those two classes are already excluded. However, `HibernateJpaAutoConfiguration`, `DataSourceTransactionManagerAutoConfiguration`, and the Elasticsearch auto-configs are NOT excluded by the main class. The `application-test.properties` handles the remaining ones. Duplicate entries in `spring.autoconfigure.exclude` are harmless — Spring deduplicates them.

**Source:** [VERIFIED: RectraceApplication.java lines 11-13]

---

### Pitfall 3: `rectrace-tlm-stats` has a missing `recportal.datasource.url` property — existing test would fail even after un-skipping

**What goes wrong:** The planner un-skips tests and runs `mvn test` in `rectrace-tlm-stats`. The existing `TlmStatsApplicationTests` fails with `IllegalStateException: Could not resolve placeholder 'recportal.datasource.url' in value "${recportal.datasource.url}"` before any connection is even attempted.

**Why it happens:** `DatabaseConfig` injects `@Value("${recportal.datasource.url}")` with no default. This property is missing from `application.properties`. Without `@Profile("!test")` on `DatabaseConfig` or a value in `application-test.properties`, the injection fails.

**How to avoid:** Two-pronged fix: (a) add `@Profile("!test")` to `DatabaseConfig` so it doesn't scan in test mode, AND (b) add `recportal.datasource.url=jdbc:oracle:thin:@test-placeholder` to `application-test.properties` as a belt-and-suspenders safeguard.

**Source:** [VERIFIED: DatabaseConfig.java line 52 (`@Value("${recportal.datasource.url}")`), rectrace-tlm-stats/application.properties (property absent)]

---

### Pitfall 4: `setIdV2Renderer`, `reconV2Renderer`, `tlmInstanceV2Renderer` are registered in grid but not in search-config-v4.json

**What goes wrong:** Parity matrix author scans `search-config-v4.json` for `cellRenderer` keys and gets only `appIDCellRenderer`, `supportEmailCellRenderer`, and `executionOrderButtonRenderer`. Three renderers are missing from the inventory.

**Why it happens:** `search-config-v4.json` does not reference these renderers. They are registered in `SearchV5GridComponent.gridOptions.components` for potential use (possibly by legacy search-config.json V3 or dynamic tab configs) but are not wired via the current V4 config.

**How to avoid:** Build the parity matrix renderer inventory from the grid `components` map (`search-v5-grid.component.ts` lines 181–189), not from `search-config-v4.json` alone. Cross-reference against `search-config.json` (V3 legacy) to verify whether any of the orphaned renderer keys are still in active use.

**Source:** [VERIFIED: search-v5-grid.component.ts lines 181-189; search-config-v4.json confirmed no `setIdV2Renderer`, `reconV2Renderer`, `recPortalIdRenderer`, `reconIdRenderer` references]

---

### Pitfall 5: `mvn clean install` vs `mvn test` — the right command after removing maven.test.skip

**What goes wrong:** Developer removes `maven.test.skip=true` and runs `mvn clean install` expecting tests to run. They do run now (correct!) — but the developer also expected `mvn clean install -DskipTests` to still work for the rare "I need to skip tests" case. The property `-DskipTests` is the Maven Surefire plugin property (separate from `maven.test.skip`) and continues to work as a command-line override.

**How to avoid:** After removing `<maven.test.skip>true</maven.test.skip>` from `<properties>`, document that `-DskipTests` is the approved manual override (FOUND-01 states this explicitly). Both `mvn test` and `mvn clean install` will now run tests by default.

---

### Pitfall 6: Pre-commit hook decision

Per D-02, no pre-commit hook is required in Phase 0. The user explicitly decided: "we can have the test gate locally and move the actual CI pipeline implementation to last phase." The `mvn install` failure on test red is the gate — it fires on every normal build automatically. A pre-commit hook would provide faster feedback but is a deferred nice-to-have (listed in Deferred Ideas). The planner should NOT include a pre-commit hook in Phase 0 plans unless explicitly choosing to exercise Claude's Discretion to add it.

---

## Plan-Task Breakdown Sketch

Phase 0 splits naturally into **three plans**:

### Plan A: `backend/rectrace` test gate (FOUND-01, FOUND-02, FOUND-03 for this module)

Tasks:
1. Remove `<maven.test.skip>true</maven.test.skip>` from `backend/rectrace/pom.xml` (1 line deletion)
2. Add `@Profile("!test")` to `DataSourceConfig.java` and `AutosysDataSourceConfig.java`
3. (Optional) Add `@Profile("!test")` or `@Profile("dev")` to `ElasticsearchDevConfiguration.java` (suppresses warning logs in tests; also closes CONCERNS.md CRITICAL item about missing `@Profile("dev")`)
4. Create `backend/rectrace/src/test/resources/application-test.properties`
5. Create `backend/rectrace/src/test/java/com/citi/gru/rectrace/ContextLoadsTest.java`
6. Verify: `cd backend/rectrace && mvn test` passes
7. Verify: `cd backend/rectrace && mvn test -Dspring.profiles.active=test` equivalent behavior

### Plan B: `rectrace-tlm-stats` test gate (FOUND-01, FOUND-02, FOUND-03 for this module)

Tasks:
1. Remove `<maven.test.skip>true</maven.test.skip>` from `rectrace-tlm-stats/pom.xml` (1 line deletion)
2. Add `@Profile("!test")` to `DatabaseConfig.java`
3. Create `rectrace-tlm-stats/src/test/resources/application-test.properties`
4. Modify `TlmStatsApplicationTests.java` to add `@ActiveProfiles("test")`
5. Verify: `cd rectrace-tlm-stats && mvn test` passes

Plans A and B are **independent** — they touch different modules and can be executed in parallel or sequentially.

### Plan C: Parity matrix day-0 inventory (FOUND-04)

Tasks:
1. Inventory Angular routes (`app-routing.module.ts`, `search-v5-routing.module.ts`)
2. Inventory search categories from `search-config-v4.json` (13 categories, renderer keys per category)
3. Inventory registered renderer keys from `SearchV5GridComponent.gridOptions.components`
4. Inventory modals from `custom-interactions/components/modals/`
5. Inventory legacy `search-config.json` categories (V3) — tag candidates as `drop`
6. Create `.planning/parity-matrix.md` with all rows and `tbd` targets, except TLM Stats V2 modal (`replace-content-with-recviz`) and TLM Stats V1 modal (`drop`) which have known targets from D-11 and CONCERNS.md
7. Verify: every row has a Target value (may be `tbd`) and a Type value

Plan C is independent of Plans A and B.

**Argument for 3 plans instead of 1:** Plans A and B are purely mechanical (property deletion + file creation) and can be verified in under 2 minutes each. Plan C involves static analysis of the Angular codebase and human judgment about target verbs. Mixing them creates a large plan that mixes concerns. Three small plans each with a clear verification step is easier to execute and roll back if needed.

---

## Code Examples

### Pattern 1: @Profile("!test") on a DataSource config class

```java
// Source: Spring Framework @Profile annotation — standard Spring profile guard
// Apply to DataSourceConfig.java, AutosysDataSourceConfig.java (backend/rectrace)
// Apply to DatabaseConfig.java (rectrace-tlm-stats)

import org.springframework.context.annotation.Profile;

@Configuration
@Profile("!test")   // <-- Add this line
public class DataSourceConfig {
    // ... existing code unchanged ...
}
```

### Pattern 2: Minimal ContextLoadsTest.java (backend/rectrace)

```java
// Source: Spring Boot testing documentation — standard context load test pattern
// [CITED: https://docs.spring.io/spring-boot/docs/2.7.16/reference/html/features.html#features.testing]

package com.citi.gru.rectrace;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class ContextLoadsTest {

    @Test
    void contextLoads() {
        // Spring context loaded without errors = test passes
    }

}
```

### Pattern 3: Parity matrix header and gating rule

```markdown
# React↔Angular Parity Matrix

**Last updated:** 2026-05-12
**Status:** Day-0 snapshot — target vocab in progress

> **Gate:** The React Foundation phase (Phase 2) can begin once every row in this table
> has a non-`tbd` value in the **Target** column. Priority and Notes may remain `tbd`.

> **Target vocabulary:**
> - `port` — build the capability in React natively
> - `replace-content-with-recviz` — React owns the renderer/modal shell; content inside is a recviz iframe
> - `replace-fully-with-recviz` — capability removed from rectrace entirely; lives in recviz
> - `drop` — not needed in React; delete from inventory
> - `tbd` — decide during that capability's React phase planning

| Angular Feature | Type | Current Location | Renderers / Components | Target | Priority | Notes |
|---|---|---|---|---|---|---|
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| `<maven.test.skip>true</maven.test.skip>` in `<properties>` | Remove property; use `-DskipTests` CLI flag only | Phase 0 | Tests run on every `mvn install`; CI fails on red |
| `TlmStatsApplicationTests` without `@ActiveProfiles` | Add `@ActiveProfiles("test")` + test resources | Phase 0 | Existing test actually passes without live Oracle |
| No test source tree in `backend/rectrace` | `ContextLoadsTest.java` + `application-test.properties` | Phase 0 | Establishes the pattern for all future backend tests |
| No parity matrix (feature parity tracked informally) | `.planning/parity-matrix.md` day-0 snapshot | Phase 0 | Gates React phase from starting before parity is mapped |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | Adding `@Profile("!test")` to production `@Configuration` classes is acceptable. The alternative (Approach B: `@MockBean` in test class) is also viable but more verbose. | Spring Profile Recipe | If production config classes cannot be touched in Phase 0, use `@MockBean DataSource` approach instead. Test class becomes slightly more complex. |
| A2 | `setIdV2Renderer`, `reconV2Renderer`, `reconIdRenderer`, `recPortalIdRenderer` are not referenced in `search-config-v4.json` and should be inventoried as "registered but possibly orphaned" — candidate for `drop` in parity matrix | Parity Matrix Inventory | If these renderers are loaded dynamically (e.g. from a database-driven config not visible in the JSON files), they would need `port` not `drop`. Verify against runtime behavior before assigning `drop`. |
| A3 | The TLM Stats V1 modal (`tlm-stats-modal/`) is dead code (CONCERNS.md MEDIUM item confirms this) and should be `drop` in the parity matrix. | Parity Matrix example rows | If V1 modal is still reachable via some code path not visible in static analysis, it would need `port` or `replace-content-with-recviz`. |

---

## Open Questions

1. **Should `ElasticsearchDevConfiguration` get `@Profile("dev")` in Phase 0?**
   - What we know: The class is annotated `@Configuration` with no `@Profile`. It fires in all environments including production (CONCERNS.md CRITICAL). Adding `@Profile("dev")` is the documented fix.
   - What's unclear: Is Phase 0 the right place for this security fix, or should it land in Phase 1 (Boot Upgrade) or Phase 9 (Security)?
   - Recommendation: Include it in Plan A as a one-line change. It prevents the SSL bypass from firing in test context and closes a CRITICAL CONCERNS.md item at near-zero cost. Mark it as an opportunistic fix per CONTEXT.md.

2. **Which renderer keys in `search-config.json` (V3) are still actively used?**
   - What we know: The V5 grid is the only active UI; it reads `search-config-v4.json`. `search-config.json` (V3) is kept "for reference." The V3 controllers are still active beans.
   - What's unclear: Whether any internal tooling or manual test still exercises the V3 API. If yes, `setIdCellRenderer` and `reconCellRenderer` (V1 keys) may still be in active use via V3 endpoints.
   - Recommendation: In the parity matrix, mark the V3-specific renderers as `drop` with a note "verify no active V3 API consumer before final drop." Fills the row; does not block Phase 2.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Java 17 JDK | `mvn test` | ✓ (configured in both pom.xml files) | 17 | — |
| Maven 3.x | Build tool | ✓ (assumed — project has existing `mvn` usage) | Unknown | — |
| `/opt/rectify/control/scripts/get_password.sh` | Runtime only — NOT needed in test profile | N/A — excluded by `@Profile("!test")` | — | — |
| Oracle DB | Runtime only — NOT needed in test profile | N/A — excluded by profile + auto-config exclusions | — | — |
| Elasticsearch | Runtime only — NOT needed in test profile | N/A — excluded by auto-config exclusions | — | — |

**Missing dependencies with no fallback:** None — Phase 0 test gate requires only the JDK and Maven, both of which are already required by the existing build.

**Note:** The `@Profile("!test")` approach eliminates all runtime dependency requirements for the context-load tests. No Docker, no H2, no Oracle wallet, no ES cluster needed. [VERIFIED: D-06, D-07 from CONTEXT.md]

---

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | JUnit 5 (via `spring-boot-starter-test` 2.7.16) |
| Config file | None — `pom.xml` is the config (no separate `surefire` config needed) |
| Quick run command (backend) | `cd backend/rectrace && mvn test` |
| Quick run command (tlm-stats) | `cd rectrace-tlm-stats && mvn test` |
| Full suite command | Run both sequentially (no multi-module POM) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FOUND-01 | `maven.test.skip` removed from both pom.xml | build-verification | `grep -c maven.test.skip backend/rectrace/pom.xml rectrace-tlm-stats/pom.xml` should return 0 | ❌ Wave 0 — verification command |
| FOUND-02 | `mvn test` fails when a test is red | build-verification | `cd backend/rectrace && mvn test` (passes = gate works) | ❌ Wave 0 |
| FOUND-03 | Context loads in `backend/rectrace` | spring-context | `cd backend/rectrace && mvn test` | ❌ Wave 0 — `ContextLoadsTest.java` to create |
| FOUND-03 | Context loads in `rectrace-tlm-stats` | spring-context | `cd rectrace-tlm-stats && mvn test` | ✅ exists (`TlmStatsApplicationTests.java`) — needs `@ActiveProfiles("test")` |
| FOUND-04 | Parity matrix committed | manual-verify | `ls .planning/parity-matrix.md && grep -c "port\|replace\|drop\|tbd" .planning/parity-matrix.md` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** Run the relevant module's `mvn test` (< 30 seconds per module with no DB/ES)
- **Per wave merge:** Both `cd backend/rectrace && mvn test` and `cd rectrace-tlm-stats && mvn test`
- **Phase gate:** Both test suites green + `.planning/parity-matrix.md` committed with all rows populated before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `backend/rectrace/src/test/java/com/citi/gru/rectrace/ContextLoadsTest.java` — covers FOUND-03 (backend module)
- [ ] `backend/rectrace/src/test/resources/application-test.properties` — required for context load test to pass
- [ ] `rectrace-tlm-stats/src/test/resources/application-test.properties` — required for existing context load test to pass
- [ ] `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/DataSourceConfig.java` — add `@Profile("!test")`
- [ ] `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/AutosysDataSourceConfig.java` — add `@Profile("!test")`
- [ ] `rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/config/DatabaseConfig.java` — add `@Profile("!test")`
- [ ] `.planning/parity-matrix.md` — covers FOUND-04

---

## Security Domain

> `security_enforcement` is absent from `.planning/config.json` — treating as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | No — Phase 0 adds no user-facing auth surface | — |
| V3 Session Management | No — Phase 0 adds no session handling | — |
| V4 Access Control | No — Phase 0 adds no new endpoints | — |
| V5 Input Validation | No — Phase 0 adds no input handling | — |
| V6 Cryptography | No — Phase 0 adds no crypto | — |

**Security note:** Phase 0 includes an **opportunistic security fix** (CONCERNS.md CRITICAL item): adding `@Profile("dev")` to `ElasticsearchDevConfiguration`. This class currently has no profile guard and disables SSL validation in ALL environments including production. Fixing it in Phase 0 Plan A costs one line and closes a critical exposure. It is not a new security control — it is removing an existing misconfiguration that lets Phase 0 test contexts boot cleanly without triggering the SSL bypass warning.

---

## Sources

### Primary (HIGH confidence)
- `backend/rectrace/pom.xml` — Spring Boot 2.7.16 parent, dependencies, `maven.test.skip` property [VERIFIED: line 31]
- `rectrace-tlm-stats/pom.xml` — Spring Boot 2.7.16 parent, dependencies, `maven.test.skip` property [VERIFIED: line 18]
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/RectraceApplication.java` — existing `@SpringBootApplication(exclude = {DataSourceAutoConfiguration.class, JpaRepositoriesAutoConfiguration.class})` [VERIFIED]
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/DataSourceConfig.java` — `ScriptExecutor` called at bean creation [VERIFIED: lines 39-41]
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/AutosysDataSourceConfig.java` — custom HikariCP DataSource [VERIFIED]
- `rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/config/DatabaseConfig.java` — `ScriptExecutor` called for 2 DataSources + `TlmJdbcTemplateFactory` [VERIFIED: lines 74-200]
- `rectrace-tlm-stats/src/test/java/com/citi/gru/rectrace/tlmstats/TlmStatsApplicationTests.java` — existing test file, no profile, no test resources [VERIFIED]
- `backend/rectrace/src/main/resources/search-config-v4.json` — 13 categories, renderer keys per category [VERIFIED: full file read]
- `frontend/rectrace/src/app/search-v5/components/search-v5-grid/search-v5-grid.component.ts` — `components` map with 8 renderer registrations [VERIFIED: lines 181-189]
- `frontend/rectrace/src/app/app-routing.module.ts` — single `/search` route [VERIFIED]
- `.planning/config.json` — `nyquist_validation: true` [VERIFIED]
- Context7 `/spring-projects/spring-boot` — `spring.autoconfigure.exclude` documentation, `@SpringBootTest @ActiveProfiles` patterns [CITED: Context7 query results]

### Secondary (MEDIUM confidence)
- `.planning/codebase/TESTING.md` — backend test posture, existing TLM stats test, frontend test state
- `.planning/codebase/CONCERNS.md` — CRITICAL: `ElasticsearchDevConfiguration` missing `@Profile`; HIGH: `maven.test.skip`; MEDIUM: TLM stats missing `recportal.datasource.url`
- `.planning/research/PITFALLS.md` Pitfall #10 — `maven.test.skip` regression risk rationale

### Tertiary (LOW confidence)
- None — all claims in this research are verified or cited from official sources.

---

## Metadata

**Confidence breakdown:**
- Spring profile exclusion recipe: HIGH — verified by reading actual source files in this repo
- Auto-config class names for SB 2.7.16: HIGH — canonical package names confirmed via Context7 + training data for Spring Boot 2.7.x
- Parity matrix row set: HIGH — verified by reading all relevant Angular source files and JSON config
- Plan task breakdown: HIGH — derived directly from verified file locations

**Research date:** 2026-05-12
**Valid until:** 2026-06-12 (stable — Phase 0 is purely mechanical, no fast-moving dependencies)
