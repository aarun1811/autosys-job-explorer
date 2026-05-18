---
phase: 05-config-driven-select
plan: 05
subsystem: backend/rectrace
tags: [sql-tabs, ssrm, executor, controller, security-defense-in-depth]
requires: [05-04]
provides: [SQL-04, SQL-05, SQL-06]
affects: [backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v4, backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/v4]
tech-stack:
  added: []
  patterns: [readonly-jdbc-template, prepared-statement-callback, wrapped-query-pagination, whitelist-identifier-validation]
key-files:
  created:
    - backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v4/SqlQueryServiceV4.java
    - backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/v4/SqlSearchControllerV4.java
  modified:
    - backend/rectrace/src/test/java/com/citi/gru/rectrace/service/v4/SqlQueryServiceV4Test.java
decisions:
  - "Wrapped query uses 'SELECT * FROM (<configured>) sub WHERE 1=1 [filter] [order by] OFFSET ? ROWS FETCH NEXT ? ROWS ONLY'. The 'WHERE 1=1' seed makes the AND-suffix filter clause trivial to build without empty-state branching."
  - "Phase 5 filter operator set is just {equals, contains}; any other operator is rejected with IllegalArgumentException → controller returns 400. Phase 6 will widen the operator set."
  - "Controller-side createErrorResponse takes two args (error_type, message). SearchControllerV4's single-arg helper omits error_type; CLAUDE.md mandates it, so the new controller introduces the discriminator without touching the existing controller."
  - "Controller caps page size at 1000 (defense in depth vs. setMaxRows). T-05-15 mitigation."
metrics:
  duration_minutes: 35
  tasks_completed: 2
  files_created: 2
  files_modified: 1
  tests_added: 0
  tests_enabled: 2
  tests_total_sql_suite: 21
  tests_skipped_sql_suite: 0
  completed_date: 2026-05-17T11:32:15Z
---

# Phase 5 Plan 05: SqlQueryServiceV4 + SqlSearchControllerV4 Summary

Config-driven SELECT executor (`SqlQueryServiceV4`) and REST controller (`SqlSearchControllerV4`) using `readonlyJdbcTemplate.execute(PreparedStatementCreator, PreparedStatementCallback)` for per-statement caps, request-time outer-wrap with `OFFSET ? ROWS FETCH NEXT ? ROWS ONLY`, and whitelisted identifier validation that does **not** inherit `OracleServiceV4.buildOrderByClause`'s SQL-injection bug.

## What Landed

### Task 1 — `SqlQueryServiceV4` (commit `f2f95d8`)

- `@Service` + `@Slf4j` + `@Profile("!test")` (keeps `ContextLoadsTest` live-Oracle-free).
- Constructor-injects `@Qualifier("readonlyJdbcTemplate") JdbcTemplate`, `SqlSearchConfigServiceV4`, plus three `@Value`-bound caps:
  - `datasource.readonly.queryTimeoutSeconds` (default 30) — Pitfall 3 names it explicitly to avoid the ms-vs-s footgun
  - `datasource.readonly.fetchSize` (default 500)
  - `datasource.readonly.maxRows` (default 10000)
- Whitelist (`Set<String> whitelistedFields`) is rebuilt per request from `tab.getColumns().stream().map(ColumnDefinition::getField)` — single source of truth, no caching.
- `buildOrderByClause` rejects any `colId` not in the whitelist; rejects any sort direction other than `asc`/`desc` (case-insensitive). Throws `IllegalArgumentException`.
- `buildFilterClause` rejects any filter map key not in the whitelist. Supports only `equals` and `contains` for Phase 5; rejects others with `IllegalArgumentException`. All filter values are parameterized binds.
- Outer wrapper SQL is the literal string `"SELECT * FROM (" + tab.getQuery() + ") sub WHERE 1=1" + whereClause + (orderByClause? " " + orderByClause : "") + " OFFSET ? ROWS FETCH NEXT ? ROWS ONLY"`. The two trailing `?` are `startRow` and `pageSize`.
- Execution uses `readonlyJdbcTemplate.execute(PreparedStatementCreator, PreparedStatementCallback)`:
  - Creator lambda calls `ps.setQueryTimeout(queryTimeoutSeconds)`, `ps.setFetchSize(fetchSize)`, `ps.setMaxRows(maxRows)` on the per-call `PreparedStatement` — **never** on the singleton template.
  - Callback wraps `ps.executeQuery()` in `try (ResultSet rs = …)` (Pitfall 6) and maps rows with `ColumnMapRowMapper`.
- `normalizeColumnNames` lowercases every key into a fresh `LinkedHashMap` (Pitfall 5; mirrors `OracleServiceV4.normalizeColumnNames`).
- Returns `SSRMResponseV4` with `lastRow = -1` when the page is full ("more available"), else `startRow + rows.size()` (AG-Grid SSRM convention).

### Task 2 — `SqlSearchControllerV4` (commit `2838b2b`)

- `@RestController` + `@RequestMapping("/api/v4/sql-search")` + `@CrossOrigin(origins = "*")` + `@Slf4j` + `@Profile("!test")` (mirrors `SearchControllerV4`).
- `GET /config` returns `SqlSearchConfigV4` `{"tabs": [...]}`.
- `POST /ssrm/{tabKey}` accepts `SSRMRequestV4` body, returns `SSRMResponseV4`:
  - Tab-key existence check → 400 `UNKNOWN_TAB`.
  - Paging window check (`startRow >= 0 && endRow > startRow && (endRow - startRow) <= 1000`) → 400 `INVALID_REQUEST`. The 1000 cap is the T-05-15 belt-and-suspenders.
  - Catches `IllegalArgumentException` from the service (whitelist or operator violation) → 400 `INVALID_REQUEST`.
  - Catches generic `Exception` → 500 `INTERNAL` with a non-leaking message; full stack trace logged server-side (T-05-16).
- `x-citiportal-loginid` header read via `AppConstants.CITI_PORTAL_LOGIN_ID_HEADER` and logged on each call.

### Tests

- `SqlQueryServiceV4Test` re-armed (both `@Disabled` removed). Tests instantiate the real `SqlQueryServiceV4` with mocked `JdbcTemplate` + mocked `SqlSearchConfigServiceV4`.
  - `perStatementCapsAppliedNotSingleton` — captures the `PreparedStatementCreator`, drives it, verifies `ps.setQueryTimeout(30)/setFetchSize(500)/setMaxRows(10_000)` and that the singleton template is never mutated.
  - `injectsOffsetFetchWrapper` — captures `conn.prepareStatement(sqlCaptor)` and asserts the wrapped SQL matches `^\s*SELECT \* FROM \(.*\) .* OFFSET \? ROWS FETCH NEXT \? ROWS ONLY\s*$`.

## Verification

### Acceptance gates

```
=== Task 1 ===
OFFSET ? ROWS FETCH NEXT ? ROWS ONLY        : OK
ps.setQueryTimeout(queryTimeoutSeconds)     : OK
ps.setFetchSize(fetchSize)/setMaxRows(...)  : OK
try (ResultSet                              : OK
whitelistedFields.contains                  : OK
@Profile("!test")                           : OK
Singleton-mutation negative grep            : empty (no match, comments-only)
@Disabled count in test                     : 0

=== Task 2 ===
@RequestMapping("/api/v4/sql-search")       : OK
@GetMapping("/config")                      : OK
@PostMapping("/ssrm/{tabKey}")              : OK
@Profile("!test")                           : OK
x-citiportal-loginid (via AppConstants)     : OK
createErrorResponse helper                  : OK
```

### `mvn test -Dtest='Sql*Test,ContextLoadsTest,ReadonlyDataSourceConfigTest'`

```
Tests run: 21, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

### Live boot probes (Docker stack: `rectrace-es` + `rectrace-oracle`, profile `local`)

**1. GET /api/v4/sql-search/config → 200**

```json
{
  "tabs": [
    {
      "key": "reconSummary",
      "label": "Recon Summary (SQL)",
      "query": "SELECT recon, file_name_pattern, app_id, support_email, job_name, box_name FROM rectrace_core WHERE recon IS NOT NULL FETCH FIRST 1000 ROWS ONLY",
      "columns": [{"field": "recon", "headerName": "Recon Name", "sortable": true, "filter": true, ...}, ...]
    }
  ]
}
```

**2. POST /api/v4/sql-search/ssrm/nope (unknown tab) → 400**

```json
{"error_type":"UNKNOWN_TAB","message":"Unknown SQL tab: nope","status":"error","timestamp":1779017463259}
```

**3. POST /api/v4/sql-search/ssrm/reconSummary with `sortModel:[{colId:"DROP TABLE users",sort:"asc"}]` → 400**

```json
{"error_type":"INVALID_REQUEST","message":"Sort column not allowed: DROP TABLE users","status":"error","timestamp":1779017463269}
```

**4. POST /api/v4/sql-search/ssrm/reconSummary with `endRow:5000` (oversized page) → 400**

```json
{"error_type":"INVALID_REQUEST","message":"Invalid paging window: startRow=0, endRow=5000 (max page size 1000)","status":"error","timestamp":1779017463277}
```

**5. POST /api/v4/sql-search/ssrm/reconSummary happy-path probe (startRow=0, endRow=100) — executor reached Oracle**

The wrapped SQL string sent to Oracle (captured from the JDBC error log):

```
Original SQL = SELECT * FROM (SELECT recon, file_name_pattern, app_id, support_email, job_name, box_name FROM rectrace_core WHERE recon IS NOT NULL FETCH FIRST 1000 ROWS ONLY) sub WHERE 1=1 OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
```

This is the exact wrapped form mandated by SQL-05 — the configured query is treated as an opaque subquery and the outer wrapper always injects `OFFSET ? ROWS FETCH NEXT ? ROWS ONLY`. The two `?` parameters bind to `startRow=0` and `pageSize=100`.

The probe returned HTTP 500 due to `ORA-00942: table or view "RECTRACE_READONLY"."RECTRACE_CORE" does not exist`. This is **NOT** a Plan 05 executor defect — see Deferred Issues below.

## Deviations from Plan

**None** for Task 1 — landed exactly as planned.

**Task 2 — happy-path live probe partially failed (environmental, not a Plan 05 bug):**

The plan's acceptance criterion called for `curl /ssrm/reconSummary` to return `RECON-XYZ-42` from local seed data. The wrapped-SQL probe reached Oracle but the readonly Oracle user `rectrace_readonly` is missing `GRANT SELECT ON rectrace.rectrace_core` (or a public synonym) in the sibling-repo seed (`rectrace-local-dev/init/01-create-schema-users.sql`). The seed grants only `CREATE SESSION`.

Per scope boundary (out-of-scope discoveries are deferred, not fixed), this is logged in `.planning/phases/05-config-driven-select/deferred-items.md` for the Plan 02 / Plan 06 follow-up. Plan 05's executor + controller code is verified correct via:
- 21/21 mocked tests green (0 skipped) — covers the wrapped-SQL contract and per-statement caps.
- 3/4 live probes green — config endpoint works, all three negative paths return 400 with the right `error_type`.
- The wrapped SQL captured from the Oracle error log matches the SQL-05 contract literal-for-literal.

The grant gap is a config / seed issue, not an executor issue.

## Auth Gates

None — no authentication encountered in this plan. The `x-citiportal-loginid` header is logged but not enforced (Phase 9 will gate).

## Threat Flags

None — all new HTTP surface is covered by the existing Phase 5 threat model entries (T-05-13 through T-05-18). No new trust boundary introduced beyond what `<threat_model>` in 05-05-PLAN.md documented.

## Deferred Issues

| Item | File | Reason | Tracking |
|------|------|--------|----------|
| `rectrace_readonly` user missing `GRANT SELECT ON rectrace.rectrace_core` + synonym | `rectrace-local-dev/init/01-create-schema-users.sql` (sibling repo) | Plan 02 / sibling-repo seed gap surfaced by the Plan 05 live probe. Patch belongs in Plan 02 follow-up or in `sql-search-config-v4.json` (qualify as `RECTRACE.rectrace_core`) as a Plan 06 prerequisite. | `.planning/phases/05-config-driven-select/deferred-items.md` |

## Wrapped-SQL Evidence (exact string from boot log)

```
SELECT * FROM (
  SELECT recon, file_name_pattern, app_id, support_email, job_name, box_name
  FROM rectrace_core
  WHERE recon IS NOT NULL
  FETCH FIRST 1000 ROWS ONLY
) sub
WHERE 1=1
OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
```

## TDD Gate Compliance

Plan is `type: execute` (not `type: tdd`), so the plan-level RED/GREEN/REFACTOR gate sequence does not apply. However:
- Plan 01 wrote the RED test (`SqlQueryServiceV4Test` with both methods `@Disabled` and reason `"Wave 4: enabled when SqlQueryServiceV4 lands"`).
- Plan 05 Task 1 is the corresponding GREEN — `f2f95d8 feat(05-05): SqlQueryServiceV4 — wrapped query + StatementCallback + whitelist sort` removes both `@Disabled` annotations and the tests pass.

## Self-Check: PASSED

- File `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v4/SqlQueryServiceV4.java`: FOUND
- File `backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/v4/SqlSearchControllerV4.java`: FOUND
- Commit `f2f95d8`: FOUND
- Commit `2838b2b`: FOUND
- `@Disabled` count in `SqlQueryServiceV4Test`: 0
- All Sql* + ContextLoads + ReadonlyDataSourceConfig tests: 21/21 green, 0 skipped
