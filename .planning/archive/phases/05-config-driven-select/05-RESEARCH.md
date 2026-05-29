# Phase 5: Config-driven SELECT — Research

**Researched:** 2026-05-17
**Domain:** Spring Boot 3.5.14 / Java 21 backend; config-driven JDBC against Oracle with parser-validated query shape, dedicated read-only datasource, per-statement resource caps, and AG-Grid SSRM response shape.
**Confidence:** HIGH (Phase 5 is purely additive on top of an in-repo codebase with strong precedents; the one externally-pinned dependency — JSqlParser — was version-checked live.)

## Summary

Phase 5 ships a brand-new backend slice — `SqlSearchControllerV4` + `SqlQueryServiceV4` + `SqlSearchConfigServiceV4` — that lets devs/admins author search tabs as arbitrary `SELECT` / `WITH ... SELECT` queries in `sql-search-config-v4.json`, validated at startup with **JSqlParser 5.3** and executed against a dedicated read-only Oracle account (`rectrace_readonly`) using a separate `HikariDataSource` and a per-call `JdbcTemplate`-from-`StatementCallback` idiom that never mutates the singleton primary `JdbcTemplate`. The example tab is a hyphen-friendly `recon` query over the existing `rectrace_core` seed (5 rows, 2 hyphenated identifiers) so the new endpoint is consumable by the existing Angular V5 grid via a one-line URL swap and provable via `curl` evidence.

**Primary recommendation:** Mirror `SearchControllerV4` + `SearchServiceV4` + `SearchConfigServiceV4` patterns end-to-end (these are existing in-repo precedents; same conventions, same DTO shapes), add JSqlParser 5.3 as a single new dependency, lift the read-only datasource from `AutosysDataSourceConfig.java` as a clone-and-edit template, and implement the per-statement caps via `jdbcTemplate.execute(StatementCallback)` rather than per-call `NamedParameterJdbcTemplate` instantiation. Defense-in-depth at both startup (boot fails) and request-time (rejects on parse/inject).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**From ROADMAP / REQUIREMENTS (D-5.1 through D-5.7) — load-bearing:**

- **D-5.1**: Search tabs may be defined as arbitrary `SELECT` (or `WITH ... SELECT`) queries in a backend JSON config (SQL-01). The existing `search-config-v4.json` is the conceptual model; new tabs of type `sql` reference a query string + name + column schema.
- **D-5.2**: Startup validation via JSqlParser. Boot fails if any configured query is not `SELECT`/`WITH` or violates shape rules (SQL-02).
- **D-5.3**: Dedicated read-only Oracle account, separate from the existing primary datasource (SQL-03). New `DataSource` bean wired in a new config class; the primary datasource is left untouched.
- **D-5.4**: Per-statement `setQueryTimeout`, `fetchSize`, `maxRows` enforced in `SqlQueryServiceV4`. NEVER mutate the singleton `JdbcTemplate` — use a `StatementCallback` (or a per-request `NamedParameterJdbcTemplate` instance) so caps apply to one statement only (SQL-04).
- **D-5.5**: WHERE / FETCH FIRST guard at the executor level — rejected at startup validation AND at request time as defense in depth (SQL-05).
- **D-5.6**: `SqlSearchControllerV4` exposes SSRM-shaped responses compatible with the existing AG-Grid SSRM datasource shape — mirroring `SearchControllerV4.fetchSsrm` body/response pattern (SQL-06).
- **D-5.7**: At least one example configured SELECT-tab wired end-to-end as evidence. Consumable by Angular (existing v5 grid) since Angular's SSRM datasource is already config-driven (SQL-07).

### Claude's Discretion (NEEDS USER REVIEW on return)

- **D-5.8**: SQL tab config file at `backend/rectrace/src/main/resources/sql-search-config-v4.json`, loaded by a new `SqlSearchConfigServiceV4` at `@PostConstruct`. Schema: `{ tabs: [{ key, label, query, columns: [...] }] }`.
- **D-5.9**: Read-only Oracle account credentials use the same `${datasource.password:}`-with-`ScriptExecutor`-fallback pattern as the existing primary datasource (per BOOT-08 KNOWN GAP closure in `DataSourceConfig.java`). New account name lives in `datasource.readonly.username`. `[NEEDS USER REVIEW]` if Citi already mandates a specific account name.
- **D-5.10**: WHERE-clause check accepts ANY presence of a WHERE in the parsed query tree (top-level or inside a subquery / CTE / set-operation member). Stricter approaches deferred.
- **D-5.11**: `FETCH FIRST N ROWS ONLY` upper-bound: 10,000 rows. Configurable via `datasource.readonly.maxRows`. Per-query override possible if a config field is present.
- **D-5.12**: `setQueryTimeout` default: 30 seconds. Configurable via `datasource.readonly.queryTimeoutSeconds`.
- **D-5.13**: `fetchSize` default: 500. Configurable via `datasource.readonly.fetchSize`.
- **D-5.14**: Example SQL tab over `rectrace_core` (already seeded), specific query proposed below in §7.
- **D-5.15**: Two endpoints: `GET /api/v4/sql-search/config` and `POST /api/v4/sql-search/ssrm/{tabKey}`. Path namespaced to avoid colliding with `/api/v4/search/...`.
- **D-5.16**: Validation errors at startup throw `IllegalStateException` from `@PostConstruct` — Spring boot fails with a clear cause chain. Each rejected query logs its key + reason at ERROR before the exception.
- **D-5.17**: Plans must carry SQL-01..07 frontmatter.
- **D-5.18**: No frontend changes in Phase 5. React app's CategoryTabBar has a Phase 4 TODO; React consumption deferred. Evidence is curl against the live endpoint; Angular's existing v5 grid can consume the new endpoint with a one-line URL constant swap, documented but not implemented in plans.

### Deferred Ideas (OUT OF SCOPE)

- React frontend consumption of SQL tabs — deferred.
- Live SQL editor / admin UI — explicitly NOT in scope per SQL-01.
- Cross-tab SQL joins or stateful sessions — out of scope.
- Connection pool tuning specific to the read-only account beyond a small default — revisit in Phase 7.
- AuthZ on the new endpoint — deferred to Phase 9 Domain Security.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SQL-01 | Tab defined via arbitrary `SELECT` authored by devs/admins; no in-app SQL editor surface. | New `sql-search-config-v4.json` + `SqlSearchConfigServiceV4`. Config-driven principle (CLAUDE.md MEMORY) — query is config, not code. |
| SQL-02 | JSqlParser startup validation — boot fails on non-`SELECT`/`WITH` or shape violations. | JSqlParser 5.3 + `CCJSqlParserUtil.parse()` + visitor pattern at `@PostConstruct` (§1); `IllegalStateException` propagates and fails Spring context init. |
| SQL-03 | Dedicated read-only Oracle account. | New `ReadonlyDataSourceConfig.java` cloned from `AutosysDataSourceConfig.java` shape (§3). Local-dev DDL adds `rectrace_readonly` user + SELECT grants (§6). |
| SQL-04 | Per-statement `setQueryTimeout`/`fetchSize`/`maxRows` enforced in service; NEVER set on the singleton `JdbcTemplate`. | `jdbcTemplate.execute(StatementCallback)` pattern — caps applied to the per-call `PreparedStatement`, not the bean (§2). |
| SQL-05 | Mandatory `WHERE` clause OR `FETCH FIRST N ROWS ONLY`; runaway scans rejected. | JSqlParser AST check at both startup AND request-time (§5). Defense in depth: always-injected `OFFSET/FETCH NEXT` wrapper around the user's query at request time. |
| SQL-06 | SSRM-shaped responses identical to `SearchControllerV4.fetchSsrm`. | `{ rows: [...], lastRow: number }` shape — mirror `SSRMResponseV4` (§4). |
| SQL-07 | Example configured tab end-to-end consumable by an existing grid. | `recon` tab over `rectrace_core` (§7). Evidence: curl against live endpoint + manual Angular URL swap. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| SQL tab discovery (`/config`) | API / Backend | — | Read-only metadata; mirrors existing `/api/v4/search/config` exactly. |
| SQL tab data fetch (`/ssrm/{key}`) | API / Backend | Database (Oracle read-only) | Parsing + execution lives entirely in backend; DB is the data source only. |
| Query shape validation | API / Backend | — | JSqlParser AST inspection; never executed on DB. |
| Per-statement resource caps | API / Backend | Database (JDBC layer) | `setQueryTimeout` / `setFetchSize` / `setMaxRows` are JDBC API calls applied per-`PreparedStatement`. |
| Credentials retrieval | API / Backend | OS (Citi VMs) / config (local) | Same dual-source pattern as primary DS: property on local, `ScriptExecutor` on Citi VM. |
| Frontend consumption | Browser / Client (Angular existing) | API / Backend | Out of scope for this phase; Phase 5 produces the API; one-line URL swap in Angular is documented but not implemented. |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | JUnit 5 + Spring Boot Test 3.5.14 (already on classpath via `spring-boot-starter-test`) |
| Config file | `backend/rectrace/src/test/resources/application-test.properties` (exists; created in Phase 0) |
| Quick run command | `cd backend/rectrace && mvn -q -DfailIfNoTests=false -Dtest='SqlSearch*Test' test` |
| Full suite command | `cd backend/rectrace && mvn -q test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SQL-01 | `sql-search-config-v4.json` loads at startup; `/api/v4/sql-search/config` returns the tab list. | integration | `mvn -Dtest='SqlSearchConfigServiceV4Test#loadsTabs' test` | Wave 0 |
| SQL-02a | A non-`SELECT` statement (e.g. `INSERT INTO foo VALUES (1)`) configured in JSON → app **fails to boot** with `IllegalStateException` naming the offending tab key. | integration (`@SpringBootTest` with bad config injected) | `mvn -Dtest='SqlValidationBootFailureTest#rejectsInsertStatement' test` | Wave 0 |
| SQL-02b | A valid `SELECT ... WHERE ... FETCH FIRST 100 ROWS ONLY` → app boots cleanly. | integration | `mvn -Dtest='SqlValidationBootFailureTest#acceptsValidSelect' test` | Wave 0 |
| SQL-02c | A `WITH cte AS (SELECT ...) SELECT * FROM cte WHERE x = 1` (CTE) → app boots cleanly. | integration | `mvn -Dtest='SqlValidationBootFailureTest#acceptsValidCte' test` | Wave 0 |
| SQL-03 | Read-only DataSource bean exists and is named `readonlyDataSource`; primary bean still resolves with `@Primary`. | unit (Spring context inspection) | `mvn -Dtest='ReadonlyDataSourceConfigTest' test` | Wave 0 |
| SQL-04 | After executing a SQL tab, the singleton `JdbcTemplate.getQueryTimeout()` returns its default (0); per-call `setQueryTimeout` was applied to a temporary `Statement` only. | unit (mocked `JdbcTemplate` + `StatementCallback` interception verifying `Statement.setQueryTimeout` was called with configured value) | `mvn -Dtest='SqlQueryServiceV4Test#perStatementCapsAppliedNotSingleton' test` | Wave 0 |
| SQL-05a | A configured `SELECT * FROM rectrace_core` (no WHERE, no FETCH) → boot fails. | integration | `mvn -Dtest='SqlValidationBootFailureTest#rejectsUnboundedSelect' test` | Wave 0 |
| SQL-05b | At request time, even with a valid configured query, the executed SQL has `OFFSET ? ROWS FETCH NEXT ? ROWS ONLY` injected — verified by `JdbcTemplate` spy capturing the final SQL. | unit | `mvn -Dtest='SqlQueryServiceV4Test#injectsOffsetFetchWrapper' test` | Wave 0 |
| SQL-06 | Live POST to `/api/v4/sql-search/ssrm/recon` returns JSON shape `{ rows: [...], lastRow: <number> }`. | smoke (curl against running backend) | `scripts/smoke-sql-search.sh` (new) | Wave 0 |
| SQL-07 | The example `recon` tab over `rectrace_core` returns ≥3 rows from the local seed with the hyphenated `RECON-XYZ-42` value present. | smoke | `scripts/smoke-sql-search.sh` (asserts `RECON-XYZ-42` in response body) | Wave 0 |

Unit test of the JSqlParser visitor on a battery of queries (CTE, UNION, nested subqueries, mixed cases) — covered by `SqlShapeValidatorTest` with one `@ParameterizedTest`.

### Sampling Rate
- **Per task commit:** `mvn -Dtest='SqlSearch*Test,SqlValidation*Test,SqlQueryServiceV4Test,SqlShapeValidatorTest,ReadonlyDataSourceConfigTest' test` (~few seconds)
- **Per wave merge:** full `mvn test` on `backend/rectrace` (includes ContextLoadsTest)
- **Phase gate:** Full suite green + `scripts/smoke-sql-search.sh` green against the local Docker stack before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `backend/rectrace/src/test/java/com/citi/gru/rectrace/service/v4/SqlShapeValidatorTest.java` — `@ParameterizedTest` against the JSqlParser visitor (covers SQL-02a/c, SQL-05a).
- [ ] `backend/rectrace/src/test/java/com/citi/gru/rectrace/service/v4/SqlQueryServiceV4Test.java` — covers SQL-04, SQL-05b (mock-based, no live DB).
- [ ] `backend/rectrace/src/test/java/com/citi/gru/rectrace/service/v4/SqlValidationBootFailureTest.java` — `@SpringBootTest` with `@TestPropertySource` swapping `sql-search-config.location` to a per-test bad-config file (covers SQL-02a/b/c, SQL-05a).
- [ ] `backend/rectrace/src/test/java/com/citi/gru/rectrace/service/v4/SqlSearchConfigServiceV4Test.java` — covers SQL-01.
- [ ] `backend/rectrace/src/test/java/com/citi/gru/rectrace/config/ReadonlyDataSourceConfigTest.java` — `@SpringBootTest` asserts bean name + type (covers SQL-03; uses `@Profile("test")` swap to in-memory H2 OR `@MockBean` to avoid live Oracle in unit tests).
- [ ] `scripts/smoke-sql-search.sh` — new sibling to `scripts/smoke-ssrm.sh`; asserts `{ rows, lastRow }` shape and `RECON-XYZ-42` presence (covers SQL-06, SQL-07).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `com.github.jsqlparser:jsqlparser` | **5.3** | SQL AST parsing for shape validation | The de-facto Java SQL parser; used by Hibernate, Spring Data JPA, JOOQ tooling; minimum runtime JDK 17 (JDK 21 supported). [VERIFIED: Maven Central; published 2025-05-17 per official changelog] |
| `spring-boot-starter-jdbc` | 3.5.14 (managed by parent) | `JdbcTemplate`, `DataSource` autoconfig | Already transitively on classpath via `spring-boot-starter-data-jpa`; explicit add is harmless and makes intent clear. [VERIFIED: in pom.xml line 36] |
| `com.zaxxer:HikariCP` | (managed by Boot parent) | Read-only DataSource pool | Already used for primary + autosys datasources; same pattern. [VERIFIED: `DataSourceConfig.java` and `AutosysDataSourceConfig.java`] |
| `com.oracle.database.jdbc:ojdbc8` | (managed) | Oracle JDBC driver | Already on classpath (pom.xml line 55). [VERIFIED] |

**Installation (delta vs. current `pom.xml`):**
```xml
<dependency>
    <groupId>com.github.jsqlparser</groupId>
    <artifactId>jsqlparser</artifactId>
    <version>5.3</version>
</dependency>
```

**Version verification:** JSqlParser 5.3 released 2025-05-17 per the official changelog [CITED: jsqlparser.github.io/JSqlParser/changelog.html]. The 5.x branch requires JDK 17 at runtime; Phase 1 already moved this codebase to Java 21, so compatibility is HIGH-confidence.

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `spring-boot-starter-test` | 3.5.14 (managed) | JUnit 5, Mockito, AssertJ, `@SpringBootTest` | Wave 0 tests. Already on classpath. |
| `org.springframework.jdbc.core.StatementCallback` | n/a (core Spring) | Per-call statement configuration | Use to apply `setQueryTimeout` / `setFetchSize` / `setMaxRows` without mutating the singleton. |
| Existing `OracleServiceV4` helpers (`buildFilterClause`, `buildOrderByClause`, `normalizeColumnNames`) | n/a (in-repo) | Reuse pattern, NOT direct call — copy minimally into `SqlQueryServiceV4` adapted for the wrapped-query model | Avoid hand-rolling sort/filter SQL — pattern is proven. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| JSqlParser 5.3 | Apache Calcite | Calcite is a full query planner — far heavier than needed and pulls in dozens of transitive deps. JSqlParser is purpose-built for parse-and-walk. |
| `StatementCallback` for caps | Per-call `new NamedParameterJdbcTemplate(readonlyDataSource)` with setters | Works but allocates a new template per call (cheap but wasteful), and the setters still mutate that instance's state — they just don't escape the call frame. Both satisfy SQL-04; the `StatementCallback` path keeps a single template bean and is the spring-projects-recommended idiom per GitHub issue #26326. |
| Wrapped-query injection for paging | Rewrite the user's parsed AST and append a `Fetch`/`Offset` node | More precise but couples the validator and the executor tightly; the wrapping approach (`SELECT * FROM (<user query>) sub ORDER BY ... OFFSET ? ROWS FETCH NEXT ? ROWS ONLY`) is simpler, works on Oracle 12c+, and is also what `OracleServiceV4` does today for SSRM paging. |
| Separate JPA `EntityManagerFactory` for read-only | None — JPA is not used here | We use plain JDBC against an arbitrary `SELECT`. JPA adds zero value and adds bean wiring complexity. |

## Architecture Patterns

### System Architecture Diagram

```
[Angular V5 Grid (existing)] / [curl evidence]
            │
            │  POST /api/v4/sql-search/ssrm/{tabKey}    { startRow, endRow, sortModel, filterModel }
            │  GET  /api/v4/sql-search/config
            ▼
┌──────────────────────────────────────────────────────────────────────┐
│  SqlSearchControllerV4   (new — @Profile("!test"))                   │
│  - input header: x-citiportal-loginid (carry forward, used for logs) │
│  - delegate to SqlQueryServiceV4                                     │
└──────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────────────────────────────────────────┐
│  SqlQueryServiceV4   (new)                                           │
│  - validates tabKey against SqlSearchConfigServiceV4                 │
│  - WRAPS the configured SELECT:                                      │
│      SELECT * FROM (<configured query>) ORDER BY ? ?                 │
│      OFFSET ? ROWS FETCH NEXT ? ROWS ONLY                            │
│  - executes via readonlyJdbcTemplate.execute(StatementCallback)      │
│  - sets per-statement queryTimeout / fetchSize / maxRows             │
│  - normalizes column names → lowercase (mirror OracleServiceV4)      │
└──────────────────────────────────────────────────────────────────────┘
            │                                       ▲
            ▼                                       │ @PostConstruct
┌────────────────────────────┐    ┌─────────────────────────────────────┐
│  readonlyJdbcTemplate      │    │  SqlSearchConfigServiceV4 (new)     │
│  (new bean; wraps          │    │  - reads sql-search-config-v4.json  │
│  readonlyDataSource)       │    │  - SqlShapeValidator.validate(q)    │
│                            │    │      uses CCJSqlParserUtil.parse    │
└────────────────────────────┘    │      + visitor checks SELECT/WITH,  │
            │                     │      WHERE present, FETCH present   │
            ▼                     │  - throws IllegalStateException →   │
┌────────────────────────────┐    │      Spring context init fails      │
│  readonlyDataSource        │    └─────────────────────────────────────┘
│  (new HikariDataSource     │
│  bean; rectrace_readonly   │
│  user; SELECT grants only) │
└────────────────────────────┘
            │
            ▼
       [Oracle 23c local / Oracle Exadata on Citi VM]
       USER: rectrace_readonly  (GRANT SELECT ON rectrace.rectrace_core TO rectrace_readonly)
```

### Recommended Project Structure (delta vs. existing)
```
backend/rectrace/src/main/java/com/citi/gru/rectrace/
├── config/
│   └── ReadonlyDataSourceConfig.java          # NEW — sibling to DataSourceConfig.java / AutosysDataSourceConfig.java
├── controller/v4/
│   └── SqlSearchControllerV4.java             # NEW
├── service/v4/
│   ├── SqlSearchConfigServiceV4.java          # NEW — @PostConstruct, JSqlParser validation
│   ├── SqlQueryServiceV4.java                 # NEW — wraps query, runs StatementCallback
│   └── SqlShapeValidator.java                 # NEW — pure-function helper, JSqlParser visitor
├── dto/v4/
│   ├── SqlSearchConfigV4.java                 # NEW — { tabs: [SqlTabConfigV4] }
│   ├── SqlTabConfigV4.java                    # NEW — { key, label, query, columns }
│   └── SqlSsrmRequestV4.java                  # NEW (or alias SSRMRequestV4 — see note below)
└── ...
backend/rectrace/src/main/resources/
└── sql-search-config-v4.json                  # NEW
backend/rectrace/src/test/java/com/citi/gru/rectrace/
├── service/v4/
│   ├── SqlShapeValidatorTest.java
│   ├── SqlSearchConfigServiceV4Test.java
│   ├── SqlValidationBootFailureTest.java
│   └── SqlQueryServiceV4Test.java
└── config/
    └── ReadonlyDataSourceConfigTest.java
scripts/
└── smoke-sql-search.sh                        # NEW
```

> **Note on DTO reuse:** `SSRMRequestV4` already carries `category`/`initialFilter`/`startRow`/`endRow`/`sortModel`/`filterModel`/`visibleColumns` — most of which we need. The `initialFilter` (ES pre-filter values) is meaningless for an SQL tab. Two options: (a) reuse `SSRMRequestV4` and tolerate the unused `initialFilter` field, (b) introduce `SqlSsrmRequestV4` without `initialFilter`. **Recommend (a)** for Angular compatibility — the existing Angular SSRM datasource builds `SSRMRequestV4` bodies and we want zero-change consumption.

### Pattern 1: JSqlParser visitor for shape validation
**What:** Parse each configured query at `@PostConstruct`; reject if not `Select` (which covers both PlainSelect and `WITH ... SELECT` — JSqlParser models `WITH` as a `Select.withItemsList` wrapping a body); reject if no WHERE present AND no FETCH/LIMIT present anywhere in the tree.

**When to use:** Once per configured tab, at startup. Never at request time on the user-authored query (the same query is reused).

**Example:**
```java
// Source: jsqlparser.github.io/JSqlParser/usage.html (5.x visitor pattern)
import net.sf.jsqlparser.parser.CCJSqlParserUtil;
import net.sf.jsqlparser.statement.Statement;
import net.sf.jsqlparser.statement.select.*;

public final class SqlShapeValidator {

    public static void validate(String key, String sql) {
        final Statement stmt;
        try {
            stmt = CCJSqlParserUtil.parse(sql);
        } catch (Exception e) {
            throw new IllegalStateException(
                "SQL tab [" + key + "] failed to parse: " + e.getMessage(), e);
        }

        if (!(stmt instanceof Select select)) {
            throw new IllegalStateException(
                "SQL tab [" + key + "] is not a SELECT / WITH statement");
        }

        ShapeProbe probe = new ShapeProbe();
        select.accept(probe, null);

        if (!probe.hasWhere && !probe.hasLimitOrFetch) {
            throw new IllegalStateException(
                "SQL tab [" + key + "] is missing both WHERE and FETCH FIRST/LIMIT — " +
                "runaway scans rejected (SQL-05)");
        }
    }

    private static final class ShapeProbe extends SelectVisitorAdapter<Void> {
        boolean hasWhere;
        boolean hasLimitOrFetch;

        @Override
        public <S> Void visit(PlainSelect plainSelect, S ctx) {
            if (plainSelect.getWhere() != null) hasWhere = true;
            if (plainSelect.getLimit() != null || plainSelect.getFetch() != null) hasLimitOrFetch = true;
            // Recurse into FROM-clause subqueries, JOIN subqueries, WITH items —
            // visitor pattern walks these via getFromItem().accept(...) etc.
            // For Phase 5 we accept ANY presence (D-5.10) so a single positive flag suffices.
            return null;
        }

        @Override
        public <S> Void visit(SetOperationList setOpList, S ctx) {
            // UNION / INTERSECT / EXCEPT — visit each member
            for (Select member : setOpList.getSelects()) member.accept(this, ctx);
            if (setOpList.getLimit() != null || setOpList.getFetch() != null) hasLimitOrFetch = true;
            return null;
        }

        @Override
        public <S> Void visit(WithItem withItem, S ctx) {
            // CTE body — recurse
            withItem.getSelect().accept(this, ctx);
            return null;
        }
    }
}
```

### Pattern 2: Per-statement caps via `StatementCallback` (the SQL-04 path)
**What:** Get a connection / build a `PreparedStatement` from the singleton `readonlyJdbcTemplate`, set `setQueryTimeout(seconds)` + `setFetchSize(rows)` + `setMaxRows(rows)` on that statement, execute, return rows. The singleton's defaults are never mutated.

**When to use:** Every SQL tab data fetch.

**Example:**
```java
// Source: spring-projects/spring-framework Issue #26326 (per-statement caps idiom)
//         JdbcTemplate Javadoc — execute(PreparedStatementCreator, PreparedStatementCallback)

public List<Map<String, Object>> execute(String wrappedSql, Object[] params,
                                          int queryTimeoutSec, int fetchSize, int maxRows) {
    return readonlyJdbcTemplate.execute(
        (PreparedStatementCreator) conn -> {
            PreparedStatement ps = conn.prepareStatement(wrappedSql);
            ps.setQueryTimeout(queryTimeoutSec);  // SECONDS, not ms — Pitfall 3
            ps.setFetchSize(fetchSize);
            ps.setMaxRows(maxRows);
            for (int i = 0; i < params.length; i++) ps.setObject(i + 1, params[i]);
            return ps;
        },
        (PreparedStatementCallback<List<Map<String, Object>>>) ps -> {
            try (ResultSet rs = ps.executeQuery()) {
                ColumnMapRowMapper mapper = new ColumnMapRowMapper();
                List<Map<String, Object>> rows = new ArrayList<>();
                int n = 0;
                while (rs.next()) rows.add(mapper.mapRow(rs, n++));
                return rows;
            }
        });
}
```

The singleton `readonlyJdbcTemplate` bean has its own `setQueryTimeout()` / `setFetchSize()` / `setMaxRows()` NEVER called from Phase 5 code. Per-call caps apply only to the `PreparedStatement` inside the `execute()` lambda.

### Pattern 3: Request-time injection of paging caps
**What:** Wrap the validated query in a derived-table that adds sort + paging:
```sql
SELECT * FROM ( <configured query> ) WHERE ROWNUM <= ? -- no, use ANSI
-- Preferred (Oracle 12c+):
SELECT * FROM ( <configured query> ) sub
ORDER BY <validated colId> <ASC|DESC>
OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
```
The outer `FETCH NEXT` is **always** present at request time regardless of what the config author wrote. This is the SQL-05 defense-in-depth layer — even if a sloppy reviewer lets a less-restrictive query land in config, the executor still caps it.

**Sort/filter injection safety:** `sortModel[i].colId` MUST be validated against the configured `columns[].field` list before string-interpolation into the ORDER BY. Same for filter column names. Filter values pass as `?` parameters. This mirrors `OracleServiceV4.buildOrderByClause` (which has a CONCERNS.md CRITICAL flagged for Phase 9 — Phase 5 should NOT inherit that bug; validate `colId` against the schema whitelist explicitly).

### Pattern 4: Read-only DataSource wiring
**What:** Sibling of `AutosysDataSourceConfig.java`. New `@ConfigurationProperties` prefix `datasource.readonly.*`. Bean name `readonlyDataSource`. Companion `readonlyJdbcTemplate` bean.

**When to use:** All SQL tab execution. Primary `DataSource` (`@Primary`) is left untouched so JPA, search-v4, execution-order, etc. continue using it.

**Example:**
```java
// Source: AutosysDataSourceConfig.java (in-repo) — clone-and-edit template
@Profile("!test")
@Configuration
public class ReadonlyDataSourceConfig {

    @Value("${datasource.readonly.url}")              private String url;
    @Value("${datasource.readonly.username}")         private String username;
    @Value("${datasource.readonly.password:}")        private String password;
    @Value("${datasource.readonly.service-name}")     private String serviceName;
    @Value("${datasource.readonly.db-schema}")        private String dbSchema;
    @Value("${datasource.readonly.driver-class-name}") private String driverClassName;
    // pool sizing — small; SQL tabs are low-volume
    @Value("${datasource.readonly.hikari.maximum-pool-size:5}") private int maxPoolSize;
    @Value("${datasource.readonly.hikari.minimum-idle:1}")      private int minIdle;
    @Value("${datasource.readonly.hikari.connection-timeout:20000}") private long connectionTimeout;

    @Bean(name = "readonlyDataSource")
    public DataSource readonlyDataSource() {
        // Mirror DataSourceConfig.java's BOOT-08 dual-source password closure:
        String pwd;
        if (password != null && !password.isBlank()) {
            pwd = password;
        } else {
            pwd = new ScriptExecutor().executeScript(
                "/opt/rectify/control/scripts/get_password.sh",
                serviceName.toUpperCase(), dbSchema.toUpperCase());
        }
        HikariConfig cfg = new HikariConfig();
        cfg.setJdbcUrl(url);
        cfg.setUsername(username);
        cfg.setPassword(pwd);
        cfg.setDriverClassName(driverClassName);
        cfg.setMaximumPoolSize(maxPoolSize);
        cfg.setMinimumIdle(minIdle);
        cfg.setConnectionTimeout(connectionTimeout);
        cfg.setPoolName("Rectrace-Readonly-HikariCP");
        // Belt-and-suspenders read-only hint to Oracle:
        cfg.setReadOnly(true);
        cfg.addDataSourceProperty("oracle.jdbc.ReadTimeout", "60000");
        cfg.addDataSourceProperty("oracle.net.CONNECT_TIMEOUT", "10000");
        return new HikariDataSource(cfg);
    }

    @Bean(name = "readonlyJdbcTemplate")
    public JdbcTemplate readonlyJdbcTemplate(@Qualifier("readonlyDataSource") DataSource ds) {
        return new JdbcTemplate(ds);
        // NOTE: deliberately DO NOT call setQueryTimeout/setFetchSize/setMaxRows here —
        // SQL-04 enforces per-statement application.
    }
}
```

### Anti-Patterns to Avoid
- **Calling `readonlyJdbcTemplate.setQueryTimeout(...)`/`setFetchSize(...)`/`setMaxRows(...)` anywhere.** SQL-04 forbids it; do it on the `PreparedStatement` inside the callback.
- **Concatenating user-config column names into the wrapped query's `ORDER BY` without whitelist check.** Even though config is dev-authored, this is the exact pattern flagged CRITICAL in CONCERNS.md for `OracleServiceV4.buildOrderByClause` — fix it forward in `SqlQueryServiceV4` rather than inheriting the bug.
- **Concatenating filter values into SQL.** Bind every value as a `?` parameter.
- **Loading credentials at boot but never having a fallback.** Mirror the `DataSourceConfig.java` dual-source pattern (property-first, script-fallback) so local-dev and Citi-VM both work.
- **Running the parser at request time on the configured query.** It's already validated at boot. Parse only once, cache the result if needed (Phase 5 doesn't need to — we just re-wrap the raw string).
- **Returning UPPERCASE column names to AG-Grid.** Mirror `OracleServiceV4.normalizeColumnNames` — lowercase keys so the frontend `columnDefs[].field` matches.
- **Allowing `category` from the URL path to leak unvalidated into SQL.** Map `tabKey` → `SqlTabConfigV4` from the in-memory map; reject unknown keys with 400. Never let the path component touch SQL.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SQL statement classification (SELECT vs INSERT vs UPDATE vs DDL) | Regex on the first keyword | `CCJSqlParserUtil.parse()` + `instanceof Select` | Regex misses `WITH`, mishandles leading comments, fails on multi-statement strings. |
| WHERE clause detection | Substring search for `" WHERE "` | `PlainSelect.getWhere() != null` via visitor | Substring matches inside string literals, CTE bodies, etc. |
| LIMIT/FETCH detection | Substring search for `"FETCH FIRST"` | `PlainSelect.getLimit() != null \|\| getFetch() != null` | Same reason — false positives. |
| Per-statement timeout/fetchSize | Mutating the singleton `JdbcTemplate` bean | `StatementCallback` / `PreparedStatementCreator` | Mutation is racy across concurrent requests and leaks state. |
| Pagination wrapping | Manual `ROWNUM` arithmetic | `OFFSET ? ROWS FETCH NEXT ? ROWS ONLY` (Oracle 12c+ ANSI) | Cleaner, parameterized, matches what `OracleServiceV4` already does. |
| Excel export (not in scope here) | Re-implementing `XSSFWorkbook` glue | Refer to `SearchServiceV4.exportToExcel` if asked later | Out of scope for Phase 5; do not add. |

**Key insight:** Every one of these has an in-repo precedent in `OracleServiceV4` / `SearchControllerV4` / `SearchConfigServiceV4` / `DataSourceConfig`. Phase 5 is mostly *copy the pattern, change two strings, add the parser*.

## Runtime State Inventory

Phase 5 is **greenfield within an existing codebase** — net-new files only, no rename/refactor/migration. No runtime state inventory required.

| Category | Items Found |
|----------|-------------|
| Stored data | None — Phase 5 adds no new persistence. |
| Live service config | None — new endpoint paths; nothing to re-register externally. |
| OS-registered state | None. |
| Secrets/env vars | One **new** secret: `datasource.readonly.password` (or the `get_password.sh` script's account name for the read-only user). Local-dev: plaintext in `application-local.properties` per the existing pattern. Citi VM: script entry must be added. `[NEEDS USER REVIEW]` — confirm Citi has a read-only Oracle account convention. |
| Build artifacts | None — `mvn clean install` rebuilds everything. |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Maven | Build | ✓ | 3.9.14 | — |
| Java 21 JDK | Build + runtime | ✓ | OpenJDK 21.0.10 (via `/opt/homebrew/opt/openjdk@21`) | — |
| Docker | Local Oracle + ES stack (sibling repo `rectrace-local-dev/`) | ✓ | 29.4.3 | — |
| Oracle 23c (local) | SQL tab live test | ✓ via `rectrace-local-dev` docker stack | gvenzl/oracle-free:23-slim | — |
| `curl` | Smoke test script | ✓ | 8.7.1 | — |
| `rectrace_readonly` Oracle user | SQL-03 | ✗ — not yet created in local seed | — | DDL must be added to `../rectrace-local-dev/init/01-create-schema-users.sql` (with companion `GRANT SELECT ON rectrace.rectrace_core TO rectrace_readonly;` in `../rectrace-local-dev/schema/01-rectrace.sql`); Phase 5 plan must include this as a task. |

**Missing dependencies with no fallback:** None — local stack is complete except for the read-only user, which a single plan task creates.

**Missing dependencies with fallback:** The Citi-VM read-only Oracle account is **out of local-dev scope**; document it as a deployment prerequisite for Phase 9 / production deploy. Phase 5 ships against local Docker; the existing `application-local.properties` is the proof-of-life harness.

## Common Pitfalls

### Pitfall 1: JSqlParser API breakage between 4.x and 5.x
**What goes wrong:** Old tutorials show `select.getSelectBody().accept(...)` returning `void` and adapter classes without generics; 5.x changed visitor signatures to be parameterized (`<S> Void visit(PlainSelect, S)`) and removed `getSelectBody()` (`Select` is itself the body now).
**Why it happens:** JSqlParser 5.0 was a major refactor (per CITED changelog: "remove `Parenthesis` in favor of `ParenthesedExpressionList`", "generify `SelectItem`...").
**How to avoid:** Pin **5.3** exactly and follow the 5.x usage doc; do not copy code from blog posts older than 2024. Test against the live API in `SqlShapeValidatorTest`.
**Warning signs:** Compile errors mentioning `SelectBody`, `ItemsList`, or non-generic `visit()` signatures.

### Pitfall 2: WITH (CTE) statements look "not a SELECT" if you check `instanceof PlainSelect`
**What goes wrong:** `CCJSqlParserUtil.parse("WITH cte AS (SELECT 1) SELECT * FROM cte WHERE x=1")` returns a `Select` whose body has `withItemsList` populated. If validator only checks `instanceof PlainSelect`, CTEs are rejected — violating D-5.1/SQL-01.
**Why it happens:** `WITH ... SELECT` is structurally a `Select` with `WithItem`s plus a body that is itself a `PlainSelect` or `SetOperationList`.
**How to avoid:** Check `instanceof Select` (the parent type covers both), then use `SelectVisitorAdapter` to visit `PlainSelect` / `SetOperationList` / `WithItem` recursively. The visitor in Pattern 1 above handles this.
**Warning signs:** SQL-02c test (CTE acceptance) fails while SQL-02b passes.

### Pitfall 3: `setQueryTimeout` is SECONDS, `connectionTimeout` is MILLISECONDS
**What goes wrong:** Devs assume both timeouts are ms and configure `setQueryTimeout(30000)` thinking 30 seconds — actually 30,000 seconds (8.3 hours).
**Why it happens:** JDBC API consistency across decades; `java.sql.Statement.setQueryTimeout(int seconds)` is the canonical signature.
**How to avoid:** Name the config property `datasource.readonly.queryTimeoutSeconds` (suffix-as-units) and assert in `SqlQueryServiceV4Test` that a value of `30` produces a captured `Statement.setQueryTimeout(30)` call.
**Warning signs:** Slow query test (Wave 0 / extended) hangs indefinitely instead of timing out.

### Pitfall 4: `setMaxRows` is JDBC truncation, NOT a query plan optimization
**What goes wrong:** Author thinks `setMaxRows(10_000)` is a substitute for `FETCH FIRST 10000 ROWS ONLY` in the SQL itself. It's not — Oracle still produces a full plan and may scan the entire underlying table; `setMaxRows` just discards rows after they cross the JDBC boundary.
**Why it happens:** Conflating JDBC client-side caps with database-side row limits.
**How to avoid:** Always inject `FETCH NEXT ? ROWS ONLY` in the request-time wrapper (Pattern 3) AND set `setMaxRows` as belt-and-suspenders. Document this in code comments.
**Warning signs:** Oracle session shows long-running execution despite quick row-count return.

### Pitfall 5: AG-Grid SSRM expects column-name keys to match `colDef.field` exactly (case-sensitive)
**What goes wrong:** JDBC `ResultSetMetaData.getColumnLabel()` returns `FILE_NAME_PATTERN` (uppercase) by default for Oracle. AG-Grid's `colDef.field: "file_name_pattern"` won't match, so cells render blank.
**Why it happens:** Oracle stores unquoted identifiers in uppercase.
**How to avoid:** Lowercase column names in the response mapper. `OracleServiceV4.normalizeColumnNames()` already does this — port the same helper into `SqlQueryServiceV4`.
**Warning signs:** Smoke test reports `rows: [{}]` (empty objects) — keys present but values null on the client side.

### Pitfall 6: Connection leak when query timeout fires
**What goes wrong:** `SQLException` from a timeout in the `StatementCallback` may leave the `PreparedStatement` or `Connection` un-closed if the callback throws before reaching `try-finally`.
**Why it happens:** Spring's `JdbcTemplate.execute(PreparedStatementCreator, PreparedStatementCallback)` handles connection lifecycle correctly only if the callback returns or throws normally; manual `executeQuery()` inside the callback must use try-with-resources for the `ResultSet`.
**How to avoid:** Use `try (ResultSet rs = ps.executeQuery())` inside the callback (Pattern 2 above shows this); let `JdbcTemplate` handle `Connection`/`PreparedStatement` closure.
**Warning signs:** HikariCP log warns "Connection leak detection triggered" after a timeout.

### Pitfall 7: Hyphen-sensitive Oracle column does NOT need an `ignore_above` workaround (that's an ES concern)
**What goes wrong:** Author conflates the Phase 8 hyphen bug (ES `.keyword` analyzer) with Oracle behavior. Oracle handles hyphens in string literals natively when bound as `?` parameters.
**Why it happens:** Phase 0.1 / Phase 8 framing emphasizes hyphens; carryover to a non-ES context.
**How to avoid:** The example tab in §7 uses `WHERE recon LIKE :term` with `:term` bound as `%hyphenated%` — works directly. No ES involvement.
**Warning signs:** Plan tasks reference `ignore_above` or `.keyword` in SQL-tab context.

### Pitfall 8: `@Profile("test")` excludes config classes from `@SpringBootTest` — the test config must provide alternatives
**What goes wrong:** Existing `DataSourceConfig.java`, `AutosysDataSourceConfig.java` all have `@Profile("!test")`. The new `ReadonlyDataSourceConfig.java` MUST follow the same pattern, AND `SqlSearchControllerV4` / `SqlQueryServiceV4` / `SqlSearchConfigServiceV4` must be wired so that under the `test` profile either they're omitted or their dependencies are mocked.
**Why it happens:** Phase 0 established the `@Profile("!test")` convention to keep `ContextLoadsTest` from needing live Oracle / ES.
**How to avoid:** Annotate all new production beans with `@Profile("!test")`. The `SqlValidationBootFailureTest` integration test uses `@SpringBootTest(properties = "spring.profiles.active=production-like")` plus its own bad-config injection — or, more pragmatically, instantiates `SqlSearchConfigServiceV4` directly with a hand-crafted bad-config file and calls `@PostConstruct` manually (avoids needing live Oracle in the unit-style test).
**Warning signs:** `ContextLoadsTest` starts failing after Phase 5 plans land — read-only DataSource bean tried to connect to Oracle during test context init.

## Code Examples

### Example 1: The example SQL tab in `sql-search-config-v4.json` (§7 implementation)
```json
{
  "tabs": [
    {
      "key": "reconSummary",
      "label": "Recon Summary (SQL)",
      "query": "SELECT recon, file_name_pattern, app_id, support_email, job_name, box_name FROM rectrace_core WHERE recon IS NOT NULL FETCH FIRST 1000 ROWS ONLY",
      "columns": [
        {"field": "recon",              "headerName": "Recon Name",       "sortable": true, "filter": true},
        {"field": "file_name_pattern",  "headerName": "File Name",        "sortable": true, "filter": true},
        {"field": "app_id",             "headerName": "App ID",           "sortable": true, "filter": true},
        {"field": "support_email",      "headerName": "Support Email",    "sortable": true, "filter": true},
        {"field": "job_name",           "headerName": "Job Name",         "sortable": true, "filter": true},
        {"field": "box_name",           "headerName": "Box Name",         "sortable": true, "filter": true}
      ]
    }
  ]
}
```
- WHERE clause: `WHERE recon IS NOT NULL` → satisfies the WHERE part of SQL-05.
- FETCH FIRST: `FETCH FIRST 1000 ROWS ONLY` → satisfies the FETCH part of SQL-05 (belt-and-suspenders; request-time wrapper also caps).
- Hyphen-friendly: `RECON-XYZ-42` (scenario 2 of the seed) is one of the 5 rows returned. Verifiable via `scripts/smoke-sql-search.sh`.

### Example 2: Smoke script skeleton
```bash
#!/usr/bin/env bash
# scripts/smoke-sql-search.sh — sibling to scripts/smoke-ssrm.sh
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:6088/rectrace}"

# 1. /config exposes the example tab
curl -fsS "${BASE_URL}/api/v4/sql-search/config" \
  | grep -q '"key":"reconSummary"' \
  || { echo "FAIL: reconSummary tab not in /config"; exit 1; }

# 2. /ssrm/reconSummary returns SSRM-shaped body with the hyphenated value
RESP=$(curl -fsS -X POST "${BASE_URL}/api/v4/sql-search/ssrm/reconSummary" \
  -H 'Content-Type: application/json' \
  -d '{"startRow":0,"endRow":100,"sortModel":[],"filterModel":{}}')

echo "$RESP" | grep -q '"rows"' && echo "$RESP" | grep -q '"lastRow"' \
  || { echo "FAIL: shape missing rows / lastRow"; exit 1; }
echo "$RESP" | grep -q 'RECON-XYZ-42' \
  || { echo "FAIL: hyphenated recon value missing from result"; exit 1; }

echo "OK: SQL search smoke green"
```

### Example 3: Local-dev DDL delta (§6)
```sql
-- ADD to ../rectrace-local-dev/init/01-create-schema-users.sql:
CREATE USER rectrace_readonly IDENTIFIED BY rectrace_readonly_pwd
  DEFAULT TABLESPACE USERS QUOTA 0 ON USERS;
GRANT CREATE SESSION TO rectrace_readonly;

-- ADD to ../rectrace-local-dev/schema/01-rectrace.sql (after CREATE TABLE rectrace_core):
GRANT SELECT ON rectrace.rectrace_core TO rectrace_readonly;
-- Repeat for any other tables a future SQL tab references.
```
Note `QUOTA 0` and absence of `RESOURCE` role — read-only by structure, not just by convention.

### Example 4: `application-local.properties` delta
```properties
# Read-only Oracle (rectrace_readonly schema user; SELECT-only grants)
datasource.readonly.url=jdbc:oracle:thin:@localhost:1521/FREEPDB1
datasource.readonly.username=rectrace_readonly
datasource.readonly.password=rectrace_readonly_pwd
datasource.readonly.driver-class-name=oracle.jdbc.OracleDriver
datasource.readonly.service-name=FREEPDB1
datasource.readonly.db-schema=RECTRACE
datasource.readonly.hikari.maximum-pool-size=5
datasource.readonly.hikari.minimum-idle=1

# SQL search resource caps
datasource.readonly.queryTimeoutSeconds=30
datasource.readonly.fetchSize=500
datasource.readonly.maxRows=10000

# SQL search config location
sql-search-config.location=file:src/main/resources/sql-search-config-v4.json
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| JSqlParser 4.x `SelectBody` + non-generic visitors | 5.x `Select` is the body; generic `<S> Void visit(...)` adapters | JSqlParser 5.0 (2024) | Phase 5 must use 5.x API — older code samples don't compile. |
| Mutate `JdbcTemplate` setters on the singleton bean | `StatementCallback` / `PreparedStatementCreator` per call | Spring Framework GitHub #26326 (Dec 2020 acknowledged) | The idiom is officially recommended; alternative proposals are still open. |
| Oracle ROWNUM-based paging | `OFFSET n ROWS FETCH NEXT m ROWS ONLY` (ANSI) | Oracle 12c (2013) | Codebase already uses ANSI paging in `OracleServiceV4`; Phase 5 inherits. |
| `WebSecurityConfigurerAdapter` | `SecurityFilterChain` bean | Spring Boot 3.x | Phase 1 already migrated. `SqlSearchControllerV4` inherits the permit-all chain. Auth lands in Phase 9. |

**Deprecated/outdated:**
- JSqlParser ≤ 4.9 — runtime fine on JDK 11 only; pre-5.x visitor signatures.
- `setQueryTimeout` documentation that uses ms — always seconds.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | JSqlParser 5.3 handles Oracle-flavored `FETCH FIRST N ROWS ONLY` and CTE syntax cleanly under the default dialect. | Pattern 1, §5 | Parse failures at startup → boot fails on perfectly valid queries. Mitigation: `SqlShapeValidatorTest` parameterizes representative shapes; if any fail, swap to `CCJSqlParserUtil.parse(sql, parser -> parser.withSquareBracketQuotation(false))` or use the `OracleConditionalParser` config. |
| A2 | Read-only `QUOTA 0` + `GRANT SELECT` is sufficient to prevent DDL/DML in Oracle 23c local-dev — no `READ` system privilege needed. | §6, Example 3 | A configured query that issues an unexpected DDL would fail with `ORA-01031` at execution time. This is actually the *desired* outcome (additional defense layer). |
| A3 | The Angular V5 SSRM datasource (`search-v5-grid.component.ts`) can consume the new endpoint with only a URL-constant change, since the SSRM request body shape is reused. | D-5.18, §System Architecture | If Angular requires the `category` query param or `initialFilter` to be non-null, a tiny Angular shim is needed. We document but do not plan that change — out of scope per D-5.18. |
| A4 | `Statement.setQueryTimeout(int)` on Oracle JDBC actually fires within the configured seconds — Oracle's implementation respects it. | Pattern 2, Pitfall 3 | If it doesn't, a slow query hangs the request thread. Verifiable extension test (not Wave 0): a `SELECT /*+ SLEEP_TIMER */ ...` that exceeds the timeout. Local Oracle 23c supports `DBMS_SESSION.SLEEP` for this. |
| A5 | `[NEEDS USER REVIEW] D-5.9`: Citi has (or can provision) a dedicated read-only Oracle account for production. | §3, D-5.9 | If not, Phase 9 deployment is blocked. Phase 5 itself ships against local-dev where we control the seed. |

## Open Questions

1. **Does Angular's existing V5 grid datasource send a non-null `initialFilter`?** — RESOLVED — yes (see `SearchV5GridComponent.createSSRMDatasource()` in the Angular sources); the `OracleServiceV4.fetchFlatData` path *requires* it. For SQL tabs we ignore the field server-side. If Angular sends nothing, the controller treats `initialFilter == null` as valid for SQL tabs. Plan must add a small ignore-when-sql branch.

2. **Should the request-time wrapper always inject a `FETCH NEXT`, even when the configured query already has one?** — RESOLVED — YES (Pattern 3). The outer wrapper's `FETCH NEXT ?` always caps to the page size from `endRow - startRow`. The configured query's `FETCH FIRST` may yield a larger upper bound; the wrapper's `FETCH NEXT` clamps to the page. Both layers coexist safely.

3. **Should the validator probe subquery WHERE clauses or only the outermost?** — RESOLVED via D-5.10: any WHERE anywhere in the tree counts. Tighter rules are a Phase-9 / Phase-6 follow-up if a runaway pattern emerges.

4. **Should `SqlQueryServiceV4` ever call the JSqlParser at request time?** — RESOLVED — NO. The configured query is validated once at boot; re-parsing on every request is wasted CPU and risks a different result if the parser is upgraded mid-deploy. Wrap the *string* at request time; do not re-parse.

5. **Does `setQueryTimeout` interrupt an Oracle JDBC query mid-stream, or only between fetch batches?** — RESOLVED via JDBC spec: Oracle Thin driver checks the timeout between round-trips; for very long single-row fetches it may overrun. Acceptable for Phase 5 — not a precision deadline, just a runaway-scan kill.

6. **Should the example tab use a GROUP BY or a flat projection?** — RESOLVED — flat projection (§7 / Example 1). Aggregate queries surface more failure modes (sortModel against grouped output, distinct-count semantics) that are not required by SQL-07 ("at least one example end-to-end").

7. **Do we expose a Phase-5 dummy renderer for SQL tabs, or rely on the existing renderer registry?** — RESOLVED — the example tab uses plain columns (no `cellRenderer`); existing Angular code paths render them as text. The `cellRenderer` field in the JSON schema is supported (mirrors `search-config-v4.json`) but unused in the seed tab.

8. **How is `ContextLoadsTest` kept green when a new mandatory bean (`readonlyDataSource`) is added?** — RESOLVED — annotate `ReadonlyDataSourceConfig`, `SqlSearchControllerV4`, `SqlQueryServiceV4` with `@Profile("!test")`, exactly matching the precedent in `DataSourceConfig.java` and `SearchControllerV4`. `SqlSearchConfigServiceV4` can stay active during tests (no DB dependency) IF the validator's bad-config exception path is covered by a dedicated `@SpringBootTest` with `@TestPropertySource` swapping the config-location property.

9. **Is `oracle.jdbc.ReadTimeout` (per-connection, ms) sufficient instead of `setQueryTimeout` (per-statement, seconds)?** — RESOLVED — NO. `ReadTimeout` covers TCP socket reads; `setQueryTimeout` covers logical query execution. SQL-04 mandates the latter; we keep `ReadTimeout` as belt-and-suspenders (already present in `AutosysDataSourceConfig`).

10. **Should the `WITH cte ... SELECT` validator also accept multiple top-level statements separated by semicolons?** — RESOLVED — NO. JSqlParser's `CCJSqlParserUtil.parse()` accepts a single statement; multi-statement input throws. We deliberately do not call `parseStatements()`. One config entry = one statement.

## Project Constraints (from CLAUDE.md)

- **Config-driven principle** [MEMORY]: search/grid behavior MUST be driven by JSON config + `/api/v?/.../config` endpoints. Phase 5 adds `sql-search-config-v4.json` + `/api/v4/sql-search/config` mirroring this pattern exactly. **No hardcoded tab definitions, no hardcoded queries in Java.**
- **Tech stack — backend**: Spring Boot 3.5.14 / Java 21 / `jakarta.*` namespaces (post-Phase-1, locked).
- **All APIs expect `x-citiportal-loginid` header for user context** — propagate to `SqlSearchControllerV4` for logging parity even though authZ is deferred to Phase 9.
- **`server.servlet.context-path=/rectrace`** — endpoints land at `/rectrace/api/v4/sql-search/...`.
- **AG-Grid SSRM is the row model** — response shape `{ rows, lastRow }` is non-negotiable.
- **Error response format**: `{ status: "error", error_type, message, timestamp }` — mirror `SearchControllerV4.createErrorResponse`.
- **Logging via SLF4J + `@Slf4j`** (V4 convention) — not `LoggerFactory.getLogger(...)`.
- **`@Profile("!test")` on production beans** — convention from Phase 0.
- **GSD workflow enforcement**: file changes go through GSD commands; this RESEARCH.md is consumed by `/gsd-plan-phase 5` next.

## Sources

### Primary (HIGH confidence)
- In-repo precedents — `SearchControllerV4.java`, `SearchServiceV4.java`, `OracleServiceV4.java`, `SearchConfigServiceV4.java`, `DataSourceConfig.java`, `AutosysDataSourceConfig.java`, `ScriptExecutor.java`, `search-config-v4.json`, `application.properties`, `application-local.properties`, `pom.xml`
- In-repo planning artifacts — `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/phases/05-config-driven-select/05-CONTEXT.md`
- Sibling repo seed — `../rectrace-local-dev/init/01-create-schema-users.sql`, `../rectrace-local-dev/schema/01-rectrace.sql`
- JSqlParser 5.3 official changelog — https://jsqlparser.github.io/JSqlParser/changelog.html (release date 2025-05-17, JDK 17 minimum)
- JSqlParser 5.x usage guide — https://jsqlparser.github.io/JSqlParser/usage.html (visitor pattern, generic `<S> Void visit(...)`)

### Secondary (MEDIUM confidence)
- Spring Framework GitHub Issue #26326 — per-statement `queryTimeout` discussion (https://github.com/spring-projects/spring-framework/issues/26326) — corroborated the `StatementCallback` idiom
- JSqlParser GitHub README — https://github.com/JSQLParser/JSqlParser
- Maven Central artifact page — https://central.sonatype.com/artifact/com.github.jsqlparser/jsqlparser

### Tertiary (LOW confidence)
- Tabnine / SourceForge code-example snippets — used only to triangulate API surface; the live 5.3 API is the source of truth for the validator implementation.

## Metadata

**Confidence breakdown:**
- Standard stack (JSqlParser 5.3 + Spring JDBC): **HIGH** — version live-verified against changelog dated within the past year; runtime JDK matches.
- Architecture (controller/service/config/datasource): **HIGH** — every layer has a working in-repo precedent.
- Per-statement caps (SQL-04): **HIGH** — `StatementCallback` is the documented Spring idiom; verifiable in unit tests with a `JdbcTemplate` spy.
- Read-only Oracle account (SQL-03): **HIGH for local-dev** (DDL is straightforward), **MEDIUM for Citi VM** (account-name convention is `[NEEDS USER REVIEW]`).
- Example tab (§7 / SQL-07): **HIGH** — query targets seeded `rectrace_core` rows including known hyphenated value `RECON-XYZ-42`.
- Pitfalls: **HIGH** — each tied to a documented behavior or in-repo CONCERNS item.

**Research date:** 2026-05-17
**Valid until:** 2026-06-17 (30 days — stable area; only watch is a hypothetical JSqlParser 5.4 release with another API refactor, which would only matter if the project upgrades that dependency.)

## RESEARCH COMPLETE
