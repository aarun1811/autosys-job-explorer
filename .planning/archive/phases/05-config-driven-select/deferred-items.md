# Deferred items — Phase 5


## 05-05 — readonly grants missing for live SSRM happy-path probe

**Discovered during:** Plan 05 Task 2 live boot probe.
**Symptom:** `POST /api/v4/sql-search/ssrm/reconSummary` returns HTTP 500 with
`ORA-00942: table or view "RECTRACE_READONLY"."RECTRACE_CORE" does not exist`.
**Root cause:** The sibling repo seed (`rectrace-local-dev/init/01-create-schema-users.sql`)
creates `rectrace_readonly` with `CREATE SESSION` only, but omits:
  - `GRANT SELECT ON rectrace.rectrace_core TO rectrace_readonly;`
  - `CREATE OR REPLACE SYNONYM rectrace_readonly.rectrace_core FOR rectrace.rectrace_core;`
**Scope:** Outside Plan 05 executor scope. Sql controller + service work end-to-end
(positive probe confirmed wrapped SQL hits Oracle; negative probes — unknown tabKey,
bad colId, oversized page — all return 400 with the right `error_type`).
**Resolution path:** Patch the seed (Plan 02 follow-up) OR qualify the configured
query as `RECTRACE.rectrace_core` in `sql-search-config-v4.json` (Plan 06 follow-up).
Track as a Phase 5 wave-5 prerequisite for the Plan 06 smoke phase.
