# Phase 01: Backend Platform Upgrade - Pattern Map

**Mapped:** 2026-05-12
**Files analyzed:** 30 modify / 2 create / 8 delete
**Analogs found:** 30 / 30 (100%) for modify+create

All new/modified files have strong in-repo analogs. No file needs to fall back to RESEARCH.md generic patterns.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/rectrace/pom.xml` | Maven manifest | n/a | (self — Boot parent bump) | self-update |
| `rectrace-tlm-stats/pom.xml` | Maven manifest | n/a | `backend/rectrace/pom.xml` (post-bump) | exact |
| `backend/rectrace/.../controller/SearchController.java` | controller | request-response | `controller/v4/SearchControllerV4.java` (post-jakarta) | exact |
| `backend/rectrace/.../controller/v4/SearchControllerV4.java` | controller | request-response | (self — mechanical javax→jakarta) | self-update |
| `backend/rectrace/.../controller/UserController.java` | controller | request-response | `SearchControllerV4.java` (post-jakarta) | exact |
| `backend/rectrace/.../service/v4/SearchServiceV4.java` | service | CRUD/streaming | `service/v4/SearchServiceV4.java` (self) | self-update |
| `backend/rectrace/.../service/SearchConfigServiceV3.java` | service (config loader) | startup-batch | `service/v4/SearchConfigServiceV4.java` | exact (mechanical) |
| `backend/rectrace/.../service/v4/SearchConfigServiceV4.java` | service (config loader) | startup-batch | (self — javax→jakarta) | self-update |
| `backend/rectrace/.../service/ExecutionOrderService.java` | service | request-response | (self — javax→jakarta + SLF4J fix) | self-update |
| `backend/rectrace/.../service/JobStatusService.java` | service | request-response | (self — javax→jakarta) | self-update |
| `backend/rectrace/.../service/SuggestionService.java` | service | request-response (ES) | RESEARCH.md Pattern 4 (ES Java API Client) | role-match (full rewrite) |
| `backend/rectrace/.../service/v4/ElasticsearchServiceV4.java` | service | request-response (ES) | RESEARCH.md Pattern 3 (ES Java API Client) | role-match (full rewrite) |
| `backend/rectrace/.../config/DataSourceConfig.java` | config | startup | `config/AutosysDataSourceConfig.java` (canonical HikariCP shape) | exact |
| `backend/rectrace/.../config/AutosysDataSourceConfig.java` | config | startup | (self — single javax→jakarta line) | self-update |
| `rectrace-tlm-stats/.../config/DatabaseConfig.java` | config | startup | `backend/rectrace/.../AutosysDataSourceConfig.java` | exact (HikariCP shape) |
| `backend/rectrace/.../util/ScriptExecutor.java` | utility | request-response (process) | `rectrace-tlm-stats/.../util/ScriptExecutor.java` | exact (SLF4J pattern already there) |
| `backend/rectrace/.../constants/AppConstants.java` | constants utility | n/a | (self — populate empty class) | self-update |
| `backend/rectrace/src/main/resources/application.properties` | properties | n/a | (self — dialect rename + show-sql flip) | self-update |
| `backend/rectrace/.../config/SecurityConfig.java` **(NEW)** | config | request-filter | `config/AsyncConfig.java` (small @Configuration shape) + RESEARCH.md Pattern 1 | role-match |
| `rectrace-tlm-stats/.../config/SecurityConfig.java` **(NEW)** | config | request-filter | `backend/rectrace/.../config/SecurityConfig.java` (sibling) + RESEARCH.md Pattern 1 | role-match |

## Pattern Assignments

### `pom.xml` (both modules) — Maven manifest

**Analog:** `backend/rectrace/pom.xml` (self).

**Pattern excerpt** (`backend/rectrace/pom.xml:5-32`):
```xml
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>2.7.16</version>
    <relativePath/>
</parent>
...
<properties>
    <java.version>17</java.version>
    <maven.compiler.release>17</maven.compiler.release>
</properties>
```

**Required change (D-1.1, D-1.2, D-1.3):**
```xml
<version>3.5.14</version>          <!-- was 2.7.16 -->
<java.version>21</java.version>     <!-- was 17 -->
<maven.compiler.release>21</maven.compiler.release>  <!-- was 17 -->
```

**Divergence:** Both modules' POMs must end up byte-identical on the three version values (D-1.3 — no drift). `rectrace-tlm-stats/pom.xml` has the same shape; apply the same three-line diff there.

---

### `SecurityConfig.java` (NEW — both modules)

**Analog:** `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/AsyncConfig.java` for the package/class shell shape (small `@Configuration` with one `@Bean`); body content comes from RESEARCH.md Pattern 1.

**Shell pattern excerpt** (`AsyncConfig.java:1-22`):
```java
package com.citi.gru.rectrace.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
// imports of body types...

@Configuration
public class AsyncConfig {

    @Bean(name = "taskExecutor")
    public Executor taskExecutor() {
        // body — direct instantiation, no @Value injection
        ...
        return executor;
    }
}
```

**Body** (RESEARCH.md § Pattern 1, lines 351-382):
```java
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

**Divergence vs AsyncConfig:** Adds `@EnableWebSecurity` annotation; requires three Spring Security imports (`HttpSecurity`, `EnableWebSecurity`, `SecurityFilterChain`). No `@Profile("!test")` guard (Phase 0 test profile excludes via `spring.autoconfigure.exclude` — verify with VALIDATION.md that this still holds after `spring-boot-starter-security` is added; if Spring Security autoconfig is NOT in the test-profile exclude list, planner adds `@Profile("!test")` or extends the exclude list).

**tlm-stats variant:** Package becomes `com.citi.gru.rectrace.tlmstats.config`; body identical. Both files exist (D-1.8 — one filter chain per module).

---

### `DataSourceConfig.java` — HikariCP pool addition (BOOT-08 #3 + STATE.md KNOWN GAP)

**Analog:** `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/AutosysDataSourceConfig.java` — canonical in-repo HikariConfig pattern.

**Pattern excerpt** (`AutosysDataSourceConfig.java:43-62`):
```java
@Bean(name = "autosysDataSource")
public DataSource autosysDataSource() {
    HikariConfig config = new HikariConfig();
    config.setJdbcUrl(url);
    config.setUsername(username);
    config.setPassword(password);
    config.setDriverClassName(driverClassName);
    config.setMaximumPoolSize(maximumPoolSize);
    config.setMinimumIdle(minimumIdle);
    config.setConnectionTimeout(connectionTimeout);
    config.setIdleTimeout(idleTimeout);
    config.setMaxLifetime(maxLifetime);
    config.setPoolName("AutoSys-HikariCP");
    config.addDataSourceProperty("oracle.jdbc.ReadTimeout", "60000");
    config.addDataSourceProperty("oracle.net.CONNECT_TIMEOUT", "10000");
    return new HikariDataSource(config);
}
```

**`@Value`-field pattern excerpt** (`AutosysDataSourceConfig.java:28-41`):
```java
@Value("${autosys.db.hikari.maximum-pool-size:5}")
private int maximumPoolSize;
@Value("${autosys.db.hikari.minimum-idle:2}")
private int minimumIdle;
@Value("${autosys.db.hikari.connection-timeout:30000}")
private long connectionTimeout;
@Value("${autosys.db.hikari.idle-timeout:600000}")
private long idleTimeout;
@Value("${autosys.db.hikari.max-lifetime:1800000}")
private long maxLifetime;
```

**Divergence (per RESEARCH.md § Item 3 lines 784-822):**
1. Property prefix is `datasource.hikari.*` (not `autosys.db.hikari.*`); pool name `Rectrace-HikariCP`.
2. Password resolution **must wrap** the existing `scriptExecutor.executeScript(...)` (lines 41-43) in `if (datasourcePassword == null || datasourcePassword.isBlank())` — closes STATE.md KNOWN GAP from Phase 00.1 P07. Add `@Value("${datasource.password:}")` field.
3. **Also delete** line 64 (`Oracle12cDialect` setProperty) and line 65 (`hibernate.show_sql=true` setProperty) per BOOT-08 items #1+#2 + RESEARCH.md note line 673 (two-line atomic delete).
4. javax→jakarta on lines 3-4 (`javax.sql.DataSource` → `jakarta.sql.DataSource`; `javax.persistence.EntityManagerFactory` → `jakarta.persistence.EntityManagerFactory`).

---

### `rectrace-tlm-stats/.../config/DatabaseConfig.java` — Hikari + javax→jakarta + KNOWN GAP

**Analog:** Same `AutosysDataSourceConfig.java` HikariCP pattern (above).

**Current state excerpt** (`DatabaseConfig.java:75-90`):
```java
@Bean(name = "reconmgmtDataSource")
public DataSource reconmgmtDataSource() {
    logger.info("Creating reconmgmt DataSource for service: {} and schema: {}", ...);
    String decryptedPassword = scriptExecutor.executeScript(passwordScriptPath,
            reconmgmtServiceName.toUpperCase(), reconmgmtDbSchema.toUpperCase());
    return DataSourceBuilder
            .create()
            .url(reconmgmtUrl)
            .username(reconmgmtUsername)
            .driverClassName(reconmgmtDriverClassName)
            .password(decryptedPassword)
            .build();
}
```

**Required (RESEARCH.md lines 839-844):** Apply `AutosysDataSourceConfig` HikariCP shape to `reconmgmtDataSource()` (lines 75-90) and `recportalDataSource()` (lines 102-118). For each: add `@Value("${reconmgmt.datasource.password:}")` / `@Value("${recportal.datasource.password:}")` and wrap `scriptExecutor.executeScript(...)` in `if (password.isBlank())`. `TlmJdbcTemplateFactory.getJdbcTemplate(String)` per-instance call at line 190 **stays unchanged** (CONCERNS LOW #2 deferred). javax→jakarta on line 9.

---

### `ScriptExecutor.java` — SLF4J migration (BOOT-08 #1)

**Analog:** `rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/util/ScriptExecutor.java` — already uses SLF4J correctly.

**Pattern excerpt** (`tlmstats/util/ScriptExecutor.java:14-17, 65-68`):
```java
@Component
public class ScriptExecutor {

    private static final Logger logger = LoggerFactory.getLogger(ScriptExecutor.class);
    ...
        } catch (IOException | InterruptedException e) {
            logger.error("Failed to execute script: {}", scriptPath, e);
            throw new RuntimeException("Script execution failed", e);
        }
```

**Required change in `backend/rectrace/.../util/ScriptExecutor.java` line 21-23:**
```java
// REPLACE:
} catch (Exception e) {
    e.printStackTrace();
}
// WITH:
} catch (Exception e) {
    logger.error("Failed to execute password script {} for service {} schema {}",
                 scriptPath, serviceName, dbSchema, e);
}
```
Plus add SLF4J `Logger` field at class top (mirroring tlm-stats line 17).

**Divergence:** Backend rectrace's `ScriptExecutor` is **not** annotated `@Component` (used via `new ScriptExecutor()` in `DataSourceConfig.java:41`). Do NOT add `@Component` here — that's a wider refactor; just add the SLF4J field and replace the printStackTrace.

---

### `ExecutionOrderService.java:154-156` — SLF4J fix (BOOT-08 #1)

**Analog:** Self — `logger` field already exists at `ExecutionOrderService.java:31`.

**Pattern excerpt** (`ExecutionOrderService.java:31`):
```java
private static final Logger logger = LoggerFactory.getLogger(ExecutionOrderService.class);
```

**Required change at line 154-156:**
```java
// REPLACE:
} catch (Exception e) {
    System.err.println("Error reading CLOB");
    return "";
}
// WITH:
} catch (Exception e) {
    logger.error("Error reading CLOB", e);
    return "";
}
```

**Divergence:** None. Also apply javax→jakarta on lines 12-14 in this same file (persistence imports).

---

### `application.properties` — dialect rename + show-sql flip (BOOT-08 #2)

**Analog:** Self.

**Required edits:**
- Line 3: `spring.jpa.show-sql=true` → `spring.jpa.show-sql=false`
- Line 4: `org.hibernate.dialect.Oracle12cDialect` → `org.hibernate.dialect.OracleDialect`

**Divergence vs `application-local.properties` (line 20-21):** Local profile already has `show-sql=false`; only the dialect string at line 21 changes. `application-prod.properties` and `application-uat.properties` do not override either — verified per RESEARCH.md lines 671, 778-780.

---

### `AppConstants.java` — populate (BOOT-08 #4, D-1.13)

**Analog:** Self (existing private-constructor utility-class shape).

**Pattern excerpt** (`AppConstants.java:1-7`):
```java
package com.citi.gru.rectrace.constants;

public class AppConstants {
    private AppConstants() {
        throw new UnsupportedOperationException("This is a utility class and cannot be instantiated");
    }
}
```

**Required addition (RESEARCH.md lines 851-861):**
```java
public static final String CITI_PORTAL_LOGIN_ID_HEADER = "x-citiportal-loginid";
```

Then replace the duplicated literal in three controllers — see next three rows.

---

### `SearchController.java` — V3 removal + jakarta + AppConstants reference

**Analog:** Self (post-V3-trio-deletion shape).

**Current excerpt** (`SearchController.java:1-22`):
```java
package com.citi.gru.rectrace.controller;
import java.util.*;
import javax.servlet.http.HttpServletRequest;
...
import com.citi.gru.rectrace.service.v3.OracleSearchProviderV3;
import com.citi.gru.rectrace.service.v3.SearchServiceV3;

@Profile("!test")
@RestController
@RequestMapping("/api")
public class SearchController {
    private static final String CITI_PORTAL_LOGIN_ID_HEADER = "x-citiportal-loginid";
    private final SuggestionService suggestionService;
    private final SearchServiceV3 searchServiceV3;
    private final OracleSearchProviderV3 oracleSearchProviderV3;
```

**Required changes:**
1. Line 4: `javax.servlet.http.HttpServletRequest` → `jakarta.servlet.http.HttpServletRequest`.
2. Lines 12-13: delete V3 service imports.
3. Lines 22, 26-27, 31-32, 34-35: delete the local `CITI_PORTAL_LOGIN_ID_HEADER` constant, the V3 fields, and the V3 constructor params.
4. Lines 43-end (the three V3 endpoint methods `keywordSearchV3`, `expandGroupV3`, `ssrmDataV3`): delete entirely.
5. Lines 48, 70, 88 (or whatever lines remain after V3 endpoint deletion): replace `request.getHeader(CITI_PORTAL_LOGIN_ID_HEADER)` with `request.getHeader(AppConstants.CITI_PORTAL_LOGIN_ID_HEADER)`.
6. Add `import com.citi.gru.rectrace.constants.AppConstants;`.

**Discretion (CONTEXT.md line 90):** Planner may move the surviving `/api/search/suggest` endpoint into `SearchControllerV4` and delete `SearchController.java` entirely. Either shape is acceptable.

---

### `UserController.java` — jakarta + AppConstants

**Analog:** Self (same shape as SearchController, smaller surface).

**Current excerpt** (`UserController.java:1-23`):
```java
import javax.servlet.http.HttpServletRequest;
...
public class UserController {
    private static final String CITI_PORTAL_LOGIN_ID_HEADER = "x-citiportal-loginid";
    @GetMapping("/info")
    public ResponseEntity<UserInfoDTO> getUserInfo(HttpServletRequest request) {
        String loginId = request.getHeader(CITI_PORTAL_LOGIN_ID_HEADER);
```

**Required:**
- Line 3: `javax.` → `jakarta.`
- Line 19: delete local constant
- Line 23: `request.getHeader(AppConstants.CITI_PORTAL_LOGIN_ID_HEADER)`
- Add `import com.citi.gru.rectrace.constants.AppConstants;`

---

### `SearchControllerV4.java` — jakarta + AppConstants

**Analog:** Self.

**Current excerpt** (`SearchControllerV4.java:12, 27-29`):
```java
import javax.servlet.http.HttpServletResponse;
...
public ResponseEntity<?> performInitialSearch(
        @RequestParam String keyword,
        @RequestHeader(value = "x-citiportal-loginid", required = false) String userId) {
```

**Required:**
- Line 12: `javax.servlet.http.HttpServletResponse` → `jakarta.servlet.http.HttpServletResponse`
- Lines 29, 52, 92 (per RESEARCH.md line 871): `@RequestHeader(value = "x-citiportal-loginid", ...)` → `@RequestHeader(value = AppConstants.CITI_PORTAL_LOGIN_ID_HEADER, ...)`
- Add `import com.citi.gru.rectrace.constants.AppConstants;`

**Divergence vs `SearchController.java`:** This file uses `@RequestHeader` annotation attribute (not `request.getHeader()`); the constant-as-annotation-attribute pattern is legal because `public static final String` satisfies the compile-time-constant requirement.

---

### Javax→jakarta sweep (remaining files, mechanical)

**Analog:** Any of the controllers above showing the pattern. Each file in the table below is a 1:1 package rename only.

| File | Line(s) | Replacement |
|------|---------|-------------|
| `config/AutosysDataSourceConfig.java` | 10 | `jakarta.sql.DataSource` |
| `config/ElasticsearchDevConfiguration.java` | 3 | **KEEP** `javax.net.ssl.SSLContext` (JDK API) |
| `service/JobStatusService.java` | 14 | `jakarta.sql.DataSource` |
| `service/SearchConfigServiceV3.java` | 8 | `jakarta.annotation.PostConstruct` (OR file is deleted entirely — see Deletions) |
| `service/v4/SearchConfigServiceV4.java` | 13 | `jakarta.annotation.PostConstruct` |
| `service/v4/SearchServiceV4.java` | (verify on read) | `jakarta.servlet.http.HttpServletResponse`, `jakarta.sql.DataSource` |
| `rectrace-tlm-stats/.../config/DatabaseConfig.java` | 9 | `jakarta.sql.DataSource` |

**Pattern is mechanical.** No method signatures change.

---

### `SuggestionService.java` — RestHighLevelClient → ElasticsearchClient (full rewrite)

**Analog:** RESEARCH.md § Pattern 4 (lines 518-587). No in-repo analog — this is the **first** use of the new ES Java API Client.

**Current state excerpt** (`SuggestionService.java:7-30`):
```java
import org.elasticsearch.action.search.SearchRequest;
import org.elasticsearch.client.RestHighLevelClient;
import org.elasticsearch.search.suggest.SuggestBuilder;
import org.elasticsearch.search.suggest.completion.CompletionSuggestionBuilder;
...
@Service
public class SuggestionService {
    private final RestHighLevelClient restHighLevelClient;
```

**Replacement pattern** (RESEARCH.md Pattern 4, lines 540-587):
```java
import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.elasticsearch.core.search.FieldSuggester;
import co.elastic.clients.elasticsearch.core.search.Suggester;
import co.elastic.clients.elasticsearch.core.search.Suggestion;
import co.elastic.clients.elasticsearch.core.search.CompletionSuggestOption;

Map<String, FieldSuggester> namedSuggesters = new LinkedHashMap<>();
for (String fieldName : suggestionFields) {
    namedSuggesters.put(fieldName, FieldSuggester.of(fs -> fs
        .prefix(prefix)
        .completion(c -> c.field(fieldName).skipDuplicates(true).size(SUGGESTIONS_PER_FIELD))));
}
SearchResponse<Void> response = esClient.search(s -> s
    .index(esIndexName)
    .suggest(sg -> sg.suggesters(namedSuggesters))
    .source(src -> src.fetch(false))
    .size(0), Void.class);
```

**Divergence:** Constructor injection of `ElasticsearchClient` (Boot 3.5 auto-config provides bean — no @Configuration needed). URL contract `/api/search/suggest` must return identical JSON shape (D-1.6 — V5 frontend depends on it).

---

### `ElasticsearchServiceV4.java` — RestHighLevelClient → ElasticsearchClient (full rewrite)

**Analog:** RESEARCH.md § Pattern 3 (lines 420-516). Same migration story as `SuggestionService` but for search + SSRM paths.

**Pattern excerpt — see RESEARCH.md lines 466-516** for the full before/after of `getUniqueValues(...)`. The pattern is: replace `SearchSourceBuilder` + `BoolQueryBuilder.should(...)` with `esClient.search(s -> s.query(q -> q.bool(b -> b.should(shoulds))).collapse(...).size(...).sort(...), Map.class)`.

**Divergence vs SuggestionService:** Uses `Map.class` typed response (not `Void`); has additional SSRM paginated calls beyond the basic search. Field injection `@Autowired(required = false)` preserved (matches current shape — required=false because the test profile excludes ES autoconfig).

---

### `application-local.properties` (both modules)

**Status:** Already exists in both modules per Phase 0.1 P07. **No new file creation needed** — RESEARCH.md confirms. Only post-upgrade tweak per RESEARCH.md line 668:
- `backend/rectrace/src/main/resources/application-local.properties:21` — `Oracle12cDialect` → `OracleDialect`.

`rectrace-tlm-stats/src/main/resources/application-local.properties` — verify with a quick grep; if no dialect override, no change.

---

## Shared Patterns

### Permit-all SecurityFilterChain
**Source:** RESEARCH.md § Pattern 1 (one file per module).
**Apply to:** new `SecurityConfig.java` in both modules (no in-repo analog because Spring Security is being introduced).

### SLF4J `LoggerFactory.getLogger(...)` field
**Source:** `backend/rectrace/.../service/ExecutionOrderService.java:31` — `private static final Logger logger = LoggerFactory.getLogger(ExecutionOrderService.class);`
**Apply to:** `ScriptExecutor.java` (the only file missing this field).

### HikariCP `HikariConfig` shape
**Source:** `backend/rectrace/.../config/AutosysDataSourceConfig.java:43-62`.
**Apply to:** Primary `DataSourceConfig.dataSource()` (rectrace), `reconmgmtDataSource()` + `recportalDataSource()` (tlm-stats DatabaseConfig).

### Conditional script-executor (closes STATE.md KNOWN GAP)
**Source:** RESEARCH.md § Item 3 (lines 791-805).
**Apply to:** `DataSourceConfig.java:41-43`, `DatabaseConfig.java:80, 108`. (Line 190 — `TlmJdbcTemplateFactory` — explicitly stays as-is per CONCERNS LOW #2 defer.)

### `@Profile("!test")` guard
**Source:** Already present on `DataSourceConfig`, `AutosysDataSourceConfig`, `ExecutionOrderService`, `SearchController`, `SearchControllerV4`, `DatabaseConfig` etc. (Phase 0 D-05).
**Apply to:** Preserve on every file touched; do NOT remove during the javax→jakarta sweep. Verify on `SecurityConfig.java` whether the new file needs one — if Phase 0's `application-test.properties` `spring.autoconfigure.exclude` already covers `org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration`, no `@Profile("!test")` is needed; otherwise add it.

### Cross-module version lockstep (D-1.3)
**Source:** This phase establishes the convention.
**Apply to:** `backend/rectrace/pom.xml` and `rectrace-tlm-stats/pom.xml` — identical `<version>3.5.14</version>`, `<java.version>21</java.version>`, `<maven.compiler.release>21</maven.compiler.release>`. No drift permitted.

---

## Deletions (D-1.5, D-1.7, and planner Discretion)

One-line confirmations — no pattern needed:

| File | Reason |
|------|--------|
| `backend/rectrace/.../service/v3/SearchServiceV3.java` | D-1.5 — V3 trio deletion |
| `backend/rectrace/.../service/v3/OracleSearchProviderV3.java` | D-1.5 |
| `backend/rectrace/.../service/v3/ElasticsearchSearchProviderV3.java` | D-1.5 |
| `backend/rectrace/.../service/SearchConfigServiceV3.java` | Planner Discretion (RESEARCH.md Open Q #2) — orphaned post-V3-trio |
| `backend/rectrace/.../config/ElasticsearchDevConfiguration.java` | Planner Discretion (RESEARCH.md Open Q #4) — local profile uses HTTP, Phase 9 owns prod SSL |
| `backend/rectrace/src/main/resources/search-config.json` | Legacy V3 config — verify zero readers (search-config-v4.json is canonical) |
| The three V3 endpoint methods inside `SearchController.java` | D-1.5 (endpoint removal, file shrinks but stays) |
| `frontend/rectrace/src/app/services/search.service.ts` | D-1.7 — frontend dead code |
| `frontend/rectrace/src/app/services/search.service.spec.ts` | D-1.7 — companion spec |

---

## No Analog Found

| File | Reason | Fallback |
|------|--------|----------|
| `SecurityConfig.java` (both modules) | Spring Security is brand new — first introduction in this phase | RESEARCH.md Pattern 1 verbatim (lines 351-382) |
| `SuggestionService.java` post-rewrite | First use of `co.elastic.clients.elasticsearch.ElasticsearchClient` in the repo | RESEARCH.md Pattern 4 (lines 518-587) |
| `ElasticsearchServiceV4.java` post-rewrite | Same — first ES Java API Client usage | RESEARCH.md Pattern 3 (lines 420-516) |

All other files have strong in-repo analogs.

---

## Metadata

**Analog search scope:**
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/{config,controller,service,util,constants}/`
- `rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/{config,controller,service,util}/`
- `backend/rectrace/src/main/resources/`
- `rectrace-tlm-stats/src/main/resources/`

**Files read for pattern extraction:** 12 in-repo files plus targeted ranges of RESEARCH.md (lines 351-587, 623-876).

**Pattern extraction date:** 2026-05-12.

## PATTERN MAPPING COMPLETE
