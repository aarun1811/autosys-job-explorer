# Phase 5: Config-driven SELECT — Context

**Gathered:** 2026-05-17
**Status:** Ready for planning
**Source:** Autonomous mode — `workflow.skip_discuss=true`; ROADMAP phase goal + success criteria are the spec; all judgment calls below are Claude's Discretion (mark `[NEEDS USER REVIEW]` where I had to invent).

<domain>
## Phase Boundary

Phase 5 ships a backend feature that lets devs/admins define a search tab as an arbitrary `SELECT` query in JSON config. The application:
- Validates every configured query at startup with JSqlParser (boots only on success)
- Executes them against a dedicated read-only Oracle account
- Enforces per-statement `setQueryTimeout`, `fetchSize`, `maxRows` (never globally mutating the singleton `JdbcTemplate`)
- Rejects any query without a `WHERE` clause or `FETCH FIRST N ROWS ONLY`
- Exposes results in AG-Grid SSRM shape via a new `SqlSearchControllerV4`
- Ships at least one configured example SELECT-tab end-to-end consumable by an existing grid (Angular is acceptable — frontend wiring is not in scope for this phase)

End users never see SQL — this is a dev/admin authoring surface only.
</domain>

<decisions>
## Implementation Decisions

### Locked from ROADMAP / REQUIREMENTS

- **D-5.1**: Search tabs may be defined as arbitrary `SELECT` (or `WITH ... SELECT`) queries in a backend JSON config (`SQL-01`). The existing `search-config-v4.json` is the conceptual model; new tabs of type `sql` reference a query string + name + column schema.
- **D-5.2**: Startup validation via JSqlParser. Boot fails if any configured query is not `SELECT`/`WITH` or violates shape rules (`SQL-02`).
- **D-5.3**: Dedicated read-only Oracle account, separate from the existing primary datasource (`SQL-03`). New `DataSource` bean wired in a new config class; the primary datasource is left untouched.
- **D-5.4**: Per-statement `setQueryTimeout`, `fetchSize`, `maxRows` enforced in `SqlQueryServiceV4`. NEVER mutate the singleton `JdbcTemplate` — get a `JdbcTemplate` from a `DataSourceUtils` connection per call, or instantiate a `NamedParameterJdbcTemplate` per request and set props on it (`SQL-04`).
- **D-5.5**: WHERE / FETCH FIRST guard at the executor level — rejected at startup validation AND at request time as defense in depth (`SQL-05`).
- **D-5.6**: `SqlSearchControllerV4` exposes SSRM-shaped responses compatible with the existing AG-Grid SSRM datasource shape — mirroring `SearchControllerV4.fetchSsrm` body/response pattern (`SQL-06`).
- **D-5.7**: At least one example configured SELECT-tab wired end-to-end as evidence. Consumable by Angular (existing v5 grid) since Angular's SSRM datasource is already config-driven and reads the same config endpoint shape (`SQL-07`).

### Claude's Discretion (NEEDS USER REVIEW on return)

- **D-5.8** [judgment]: SQL tab config file: place at `backend/rectrace/src/main/resources/sql-search-config-v4.json` (sibling to `search-config-v4.json`). Loaded by a new `SqlSearchConfigServiceV4` at `@PostConstruct`. Schema: `{ tabs: [{ key, label, query, columns: [...] }] }`.
- **D-5.9** [judgment]: Read-only Oracle account credentials managed via the same `ScriptExecutor` pattern as the existing primary datasource (per CLAUDE.md "Password retrieval via external scripts for security"). The new account name is a config property `datasource.readonly.username` — `[NEEDS USER REVIEW]` if Citi already mandates a specific account name.
- **D-5.10** [judgment]: WHERE-clause check accepts ANY presence of a WHERE in the parsed query tree (top-level or inside a subquery). Stricter approaches (only top-level WHERE) deferred to a follow-up if needed.
- **D-5.11** [judgment]: `FETCH FIRST N ROWS ONLY` upper-bound: 10,000 rows. Configurable via `datasource.readonly.maxRows`. Plan tasks can override per query if a config field is present.
- **D-5.12** [judgment]: `setQueryTimeout` default: 30 seconds. Configurable via `datasource.readonly.queryTimeoutSeconds`.
- **D-5.13** [judgment]: `fetchSize` default: 500. Configurable via `datasource.readonly.fetchSize`.
- **D-5.14** [judgment]: Example SQL tab in `sql-search-config-v4.json`: a benign query over `rectrace_core` (already seeded by `rectrace-local-dev`). Exact query and column schema TBD by planner — should align with seed schema.
- **D-5.15** [judgment]: `SqlSearchControllerV4` path: `/api/v4/sql-search/...` to avoid colliding with existing `/api/v4/search/...`. Two endpoints: GET `/api/v4/sql-search/config` (list of SQL tabs) and POST `/api/v4/sql-search/ssrm/{tabKey}` (SSRM body shape matching `SearchControllerV4.fetchSsrm`).
- **D-5.16** [judgment]: Validation errors at startup throw `IllegalStateException` from the `@PostConstruct` so Spring boot fails with a clear cause chain. Each rejected query logs its key + reason at ERROR before the exception.
- **D-5.17** [judgment]: `requirements.md` SQL-01..07 frontmatter must appear across plans.
- **D-5.18** [judgment]: No frontend changes in Phase 5. The React app's CategoryTabBar already has a Phase 4 TODO; SQL tab consumption from React is deferred. Angular consumes the new endpoint as the wire-up evidence.

</decisions>

<canonical_refs>
## Canonical References

Downstream agents MUST read these before planning or implementing.

### Existing patterns to mirror

- `backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/v4/SearchControllerV4.java` — endpoint shape (GET `/initial?keyword=`, POST `/ssrm/{cat}`, GET `/config`)
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v4/SearchServiceV4.java` — SSRM request handling, response assembly
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v4/OracleServiceV4.java` — JDBC + Oracle pattern, pagination, sort/filter
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/SearchConfigServiceV4.java` — `@PostConstruct` config load + validation
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/dto/v4/SSRMRequestV4.java` — request body shape (mirror in SqlSearchRequestV4)
- `backend/rectrace/src/main/resources/search-config-v4.json` — config file conceptual model
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/util/ScriptExecutor.java` — password retrieval shell-out
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/DataSourceConfig.java` — datasource bean wiring (new SQL config class lives next to this)

### External

- JSqlParser (`com.github.jsqlparser:jsqlparser`) — version pinned in pom.xml; visitor pattern for AST walk
- Spring Boot 3.5.x JDBC starter (already on classpath after Phase 1)

</canonical_refs>

<specifics>
## Specific Ideas

- Mirror `SearchControllerV4`'s `/config` endpoint exactly for tab discovery so Angular's existing `SearchConfigService` can fetch SQL tabs with the same code path.
- The example SQL tab should be hyphen-friendly (Phase 8 will test the hyphen bug; if SQL queries hit Oracle differently, tests should still work) — a `SELECT recon, file_name_pattern, count(*) FROM rectrace_core WHERE recon LIKE :term GROUP BY recon, file_name_pattern FETCH FIRST 100 ROWS ONLY` style query is good evidence.
- The read-only Oracle user must exist in the seed. Plan should add a SQL DDL to `rectrace-local-dev/init/` if not already present, OR document the manual setup.

</specifics>

<deferred>
## Deferred Ideas

- React frontend consumption of SQL tabs — deferred (no Phase 5 frontend work).
- Live SQL editor / admin UI — explicitly NOT in scope per `SQL-01` ("not by end users").
- Cross-tab SQL joins or stateful sessions — out of scope.
- Connection pool tuning specific to the read-only account — defaults OK for Phase 5; revisit in Phase 7 observability.

</deferred>

---

*Phase: 05-config-driven-select*
*Context gathered: 2026-05-17 via autonomous mode (skip_discuss=true)*
