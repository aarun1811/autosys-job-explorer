# Phase 0: Foundation - Pattern Map

**Mapped:** 2026-05-12
**Files analyzed:** 9 (2 pom.xml modifications, 2 new test Java files, 2 new test properties files, 2 production config class modifications, 1 new planning doc)
**Analogs found:** 8 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `backend/rectrace/pom.xml` | config | — | `rectrace-tlm-stats/pom.xml` | exact (same `<maven.test.skip>` property, same Spring Boot 2.7.16 parent) |
| `rectrace-tlm-stats/pom.xml` | config | — | `backend/rectrace/pom.xml` | exact |
| `backend/rectrace/src/test/resources/application-test.properties` | test-config | — | `backend/rectrace/src/main/resources/application-prod.properties` + `application-uat.properties` | role-match (profile-properties convention) |
| `rectrace-tlm-stats/src/test/resources/application-test.properties` | test-config | — | `rectrace-tlm-stats/src/main/resources/application.properties` | role-match (same module, same property key namespace) |
| `backend/rectrace/src/test/java/com/citi/gru/rectrace/ContextLoadsTest.java` | test | request-response | `rectrace-tlm-stats/src/test/java/com/citi/gru/rectrace/tlmstats/TlmStatsApplicationTests.java` | exact (identical pattern; adds `@ActiveProfiles`) |
| `rectrace-tlm-stats/src/test/java/com/citi/gru/rectrace/tlmstats/TlmStatsApplicationTests.java` | test (modify) | request-response | itself (existing file, no change to structure) | exact |
| `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/DataSourceConfig.java` | config (modify) | — | `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/AutosysDataSourceConfig.java` | exact (same package, same `@Configuration` class shape) |
| `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/AutosysDataSourceConfig.java` | config (modify) | — | `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/DataSourceConfig.java` | exact |
| `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/ElasticsearchDevConfiguration.java` | config (modify) | — | `DataSourceConfig.java` | role-match (`@Configuration` class needing `@Profile` guard) |
| `rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/config/DatabaseConfig.java` | config (modify) | — | `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/DataSourceConfig.java` | role-match (same pattern: `@Configuration` + `ScriptExecutor` at bean creation) |
| `.planning/parity-matrix.md` | planning-doc | — | `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` | role-match (Markdown table conventions in same `.planning/` directory) |

---

## Pattern Assignments

### `backend/rectrace/pom.xml` and `rectrace-tlm-stats/pom.xml` (config — property deletion)

**Analog:** each file is the other's mirror.

**Target line to remove in `backend/rectrace/pom.xml`** (line 31):
```xml
<properties>
    <java.version>17</java.version>
    <maven.test.skip>true</maven.test.skip>   <!-- DELETE this line -->
</properties>
```

**Target line to remove in `rectrace-tlm-stats/pom.xml`** (line 18):
```xml
<properties>
    <java.version>17</java.version>
    <maven.test.skip>true</maven.test.skip>   <!-- DELETE this line -->
</properties>
```

After deletion `<properties>` retains only `<java.version>17</java.version>`. The `-DskipTests` CLI flag remains available as the manual override.

---

### `backend/rectrace/src/test/resources/application-test.properties` (test-config, NEW)

**Analog:** `backend/rectrace/src/main/resources/application-prod.properties` (lines 1–5) — shows the Spring profile-properties file convention: a file named `application-{profile}.properties` is activated when `spring.profiles.active={profile}`.

**Profile convention pattern** from `application-prod.properties` (lines 1–5):
```properties
# Production Profile Configuration
spring.profiles.active=prod

# Inherit common properties from application.properties
spring.config.import=classpath:application.properties
```

**Key difference for `application-test.properties`:** The test profile file does NOT inherit from `application.properties` (which contains Oracle + ES connection strings that would trigger `@Value` injection failures). The test file overrides those values with placeholders.

**Also note:** `RectraceApplication.java` (lines 9) already excludes `DataSourceAutoConfiguration` and `JpaRepositoriesAutoConfiguration` at the `@SpringBootApplication` level — those two need not be re-listed in `spring.autoconfigure.exclude`, but doing so is harmless. The `application-test.properties` must exclude the remaining auto-configs not covered by the main class exclusion.

**`RectraceApplication.java` existing exclusion** (line 9):
```java
@SpringBootApplication(exclude = { DataSourceAutoConfiguration.class, JpaRepositoriesAutoConfiguration.class })
```

---

### `rectrace-tlm-stats/src/test/resources/application-test.properties` (test-config, NEW)

**Analog:** `rectrace-tlm-stats/src/main/resources/application.properties` — provides the property key namespace (`reconmgmt.datasource.*`, `recportal.datasource.*`, `password.script.path`) that `DatabaseConfig.java` injects via `@Value`.

**`@Value` injections in `DatabaseConfig.java`** (lines 34–65) — these are the keys that need placeholder values in `application-test.properties`:
```java
@Value("${reconmgmt.datasource.driver-class-name}")
private String reconmgmtDriverClassName;

@Value("${reconmgmt.datasource.url}")
private String reconmgmtUrl;

@Value("${reconmgmt.datasource.username}")
private String reconmgmtUsername;

@Value("${reconmgmt.datasource.service-name}")
private String reconmgmtServiceName;

@Value("${reconmgmt.datasource.db-schema}")
private String reconmgmtDbSchema;

@Value("${recportal.datasource.driver-class-name:oracle.jdbc.OracleDriver}")  // has default
private String recportalDriverClassName;

@Value("${recportal.datasource.url}")   // NO default — causes injection failure if missing
private String recportalUrl;

@Value("${recportal.datasource.username}")
private String recportalUsername;

@Value("${recportal.datasource.service-name}")
private String recportalServiceName;

@Value("${recportal.datasource.db-schema}")
private String recportalDbSchema;

@Value("${password.script.path:/opt/rectify/control/scripts/get_password.sh}")  // has default
private String passwordScriptPath;
```

**Critical:** `recportal.datasource.url` has no default and is absent from `application.properties` — this will cause `IllegalStateException: Could not resolve placeholder` even if `@Profile("!test")` is applied, unless the properties file provides a placeholder value before Spring resolves `@Value` at scan time. Belt-and-suspenders: provide the value in the test properties file regardless.

---

### `backend/rectrace/src/test/java/com/citi/gru/rectrace/ContextLoadsTest.java` (test, NEW)

**Analog:** `rectrace-tlm-stats/src/test/java/com/citi/gru/rectrace/tlmstats/TlmStatsApplicationTests.java` (lines 1–13) — exact shape; copy this file's structure and add `@ActiveProfiles("test")`.

**Existing `TlmStatsApplicationTests.java`** (full file — 13 lines):
```java
package com.citi.gru.rectrace.tlmstats;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class TlmStatsApplicationTests {

    @Test
    void contextLoads() {
    }

}
```

**New `ContextLoadsTest.java`** copies this pattern exactly; only the package and the addition of `@ActiveProfiles("test")` differ:
- Package: `com.citi.gru.rectrace` (mirrors `RectraceApplication.java` — verified)
- Class name: `ContextLoadsTest`
- Extra import: `org.springframework.test.context.ActiveProfiles`
- Extra annotation: `@ActiveProfiles("test")`
- File path: `backend/rectrace/src/test/java/com/citi/gru/rectrace/ContextLoadsTest.java`

---

### `rectrace-tlm-stats/src/test/java/com/citi/gru/rectrace/tlmstats/TlmStatsApplicationTests.java` (test, MODIFY)

**Analog:** itself — the file already exists with the correct shape; only `@ActiveProfiles("test")` and its import are missing.

**Current file** (full, lines 1–13):
```java
package com.citi.gru.rectrace.tlmstats;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class TlmStatsApplicationTests {

    @Test
    void contextLoads() {
    }

}
```

**Change:** Add `import org.springframework.test.context.ActiveProfiles;` and `@ActiveProfiles("test")` annotation above `@SpringBootTest`. No other changes.

---

### `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/DataSourceConfig.java` (config, MODIFY)

**Analog:** `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/AutosysDataSourceConfig.java` (same package, same `@Configuration` class structure).

**Current class declaration** in `DataSourceConfig.java` (lines 1–19):
```java
package com.citi.gru.rectrace.config;

import javax.sql.DataSource;
import javax.persistence.EntityManagerFactory;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.jdbc.DataSourceBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
// ... more imports ...
import com.citi.gru.rectrace.util.ScriptExecutor;

@Configuration
public class DataSourceConfig {
```

**Change:** Add `import org.springframework.context.annotation.Profile;` to the import block and `@Profile("!test")` on the line immediately before `@Configuration`. The annotation must go on the class, not on individual `@Bean` methods, so that Spring does not instantiate the class at all when the `test` profile is active.

**Where the `ScriptExecutor` call fires** (lines 38–48) — this is why the profile guard must be at the class level:
```java
@Bean
@Primary
public DataSource dataSource() {
    ScriptExecutor scriptExecutor = new ScriptExecutor();
    String decryptedPassword = scriptExecutor.executeScript(
        "/opt/rectify/control/scripts/get_password.sh",
        serviceName.toUpperCase(), dbschema.toUpperCase());
    return DataSourceBuilder.create()
        .url(jdbcUrl)
        .username(username)
        .driverClassName(driverClassName)
        .password(decryptedPassword)
        .build();
}
```

---

### `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/AutosysDataSourceConfig.java` (config, MODIFY)

**Analog:** `DataSourceConfig.java` — same package, same modification pattern.

**Current class declaration** in `AutosysDataSourceConfig.java` (lines 1–12):
```java
package com.citi.gru.rectrace.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.sql.DataSource;

@Configuration
public class AutosysDataSourceConfig {
```

**Change:** same as `DataSourceConfig.java` — add `import org.springframework.context.annotation.Profile;` and `@Profile("!test")` before `@Configuration`.

---

### `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/ElasticsearchDevConfiguration.java` (config, MODIFY)

**Analog:** `DataSourceConfig.java` — same package, same `@Configuration` class without any profile guard.

**Current class declaration** in `ElasticsearchDevConfiguration.java` (lines 1–17):
```java
package com.citi.gru.rectrace.config;

import javax.net.ssl.SSLContext;
// ... imports ...
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ElasticsearchDevConfiguration {
```

**Change:** Add `import org.springframework.context.annotation.Profile;` and `@Profile("dev")` before `@Configuration`. This class disables SSL verification — it must only fire on the `dev` profile. This change closes CONCERNS.md CRITICAL item.

**Note:** This is `@Profile("dev")` not `@Profile("!test")` — the intent is "only run in dev environment," which is the correct security fix. The side effect of not running in `test` context is correct behavior.

---

### `rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/config/DatabaseConfig.java` (config, MODIFY)

**Analog:** `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/DataSourceConfig.java` — same pattern: `@Configuration` class that calls `ScriptExecutor` inside `@Bean` methods at startup.

**Current class declaration** in `DatabaseConfig.java` (lines 29–30):
```java
@Configuration
public class DatabaseConfig {
```

**Where `ScriptExecutor` fires** (lines 74–88 and 103–116) — two separate `@Bean` methods each call `scriptExecutor.executeScript(...)`:
```java
@Bean(name = "reconmgmtDataSource")
public DataSource reconmgmtDataSource() {
    String decryptedPassword = scriptExecutor.executeScript(passwordScriptPath,
            reconmgmtServiceName.toUpperCase(), reconmgmtDbSchema.toUpperCase());
    return DataSourceBuilder.create()
        .url(reconmgmtUrl)
        .username(reconmgmtUsername)
        .driverClassName(reconmgmtDriverClassName)
        .password(decryptedPassword)
        .build();
}
```

**Change:** Add `import org.springframework.context.annotation.Profile;` to the import block (after the existing `org.springframework.context.annotation.Bean` import at line 16) and `@Profile("!test")` on the line immediately before `@Configuration` at line 29.

---

### `.planning/parity-matrix.md` (planning-doc, NEW)

**Analog:** `.planning/REQUIREMENTS.md` and `.planning/ROADMAP.md` — establish the Markdown conventions used in the `.planning/` directory.

**REQUIREMENTS.md header pattern** (lines 1–8):
```markdown
# Requirements: Rectrace — Modernization Milestone

**Defined:** 2026-05-12
**Core Value:** ...

## v1 Requirements

Listed in user-stated priority order. ...
```

**ROADMAP.md table-row pattern** (lines 13–14):
```markdown
- [ ] **Phase 0: Foundation** — Test gate (`maven.test.skip` removed, CI fails on red) + React↔Angular parity matrix committed.
```

**Conventions to copy:**
- `**Bold label:** value` for metadata fields at the top
- `## Section headers` with sentence-case labels
- `| Column | ... |` pipe tables with `|---|---|` separator rows using three dashes (not alignment padding)
- Blockquote (`>`) for callout rules (e.g. gating conditions)
- Checkbox list syntax (`- [ ]`) for actionable items

**Parity matrix header pattern** (from RESEARCH.md §"Parity Matrix Markdown Table Shape"):
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

**Row data source:** The 13 search category rows come from `backend/rectrace/src/main/resources/search-config-v4.json` (key + label per category). The 8 registered renderer keys come from `frontend/rectrace/src/app/search-v5/components/search-v5-grid/search-v5-grid.component.ts` lines 181–189 (grid `components` map). Modal rows come from `frontend/rectrace/src/app/custom-interactions/components/modals/` directory listing.

---

## Shared Patterns

### @Profile Guard Addition
**Source:** Spring Framework `@Profile` annotation — no existing in-codebase example (neither module uses `@Profile` today)
**Apply to:** `DataSourceConfig.java`, `AutosysDataSourceConfig.java`, `ElasticsearchDevConfiguration.java` (backend/rectrace); `DatabaseConfig.java` (rectrace-tlm-stats)

The annotation placement is always on the class declaration line (one line above `@Configuration`), after the import block:
```java
import org.springframework.context.annotation.Profile;

@Profile("!test")        // for DataSource configs — suppress in test context
@Configuration
public class DataSourceConfig {
```
```java
@Profile("dev")          // for ElasticsearchDevConfiguration — activate only in dev
@Configuration
public class ElasticsearchDevConfiguration {
```

### Spring Boot Profile Properties Convention
**Source:** `backend/rectrace/src/main/resources/application-prod.properties` and `application-uat.properties`
**Apply to:** Both new `application-test.properties` files

File naming: `application-{profile}.properties` under `src/test/resources/` (test scope) or `src/main/resources/` (main scope). Spring Boot activates the matching file when `spring.profiles.active={profile}` is set, or when `@ActiveProfiles("{profile}")` is used on a test class.

### @SpringBootTest + @ActiveProfiles Test Class Shape
**Source:** `rectrace-tlm-stats/src/test/java/com/citi/gru/rectrace/tlmstats/TlmStatsApplicationTests.java` (lines 1–13) — add `@ActiveProfiles("test")`
**Apply to:** Both `ContextLoadsTest.java` (new) and `TlmStatsApplicationTests.java` (modify)

```java
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class <ClassName> {

    @Test
    void contextLoads() {
    }

}
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| (none) | — | — | All files have viable analogs in this codebase or a direct cross-module mirror |

---

## Metadata

**Analog search scope:** `backend/rectrace/src/`, `rectrace-tlm-stats/src/`, `.planning/`
**Files read:** 15 (pom.xml ×2, application*.properties ×4, DataSourceConfig.java, AutosysDataSourceConfig.java, ElasticsearchDevConfiguration.java, DatabaseConfig.java, RectraceApplication.java, TlmStatsApplicationTests.java, REQUIREMENTS.md, ROADMAP.md)
**Pattern extraction date:** 2026-05-12
