---
phase: 05-config-driven-select
plan: 02
subsystem: backend, local-dev
tags: [SQL-03, readonly-oracle, application-local, ddl, idempotent, phase5-wave1]
dependency_graph:
  requires: []
  provides:
    - "Live rectrace_readonly Oracle account (CREATE SESSION + QUOTA 0 + SELECT on rectrace.rectrace_core only)"
    - "datasource.readonly.* + sql-search-config.location keys in application-local.properties"
  affects:
    - "Phase 5 Wave 2 ReadonlyDataSourceConfig — can now bind @Value(\"${datasource.readonly.*}\") against a real Oracle principal"
    - "Phase 5 Wave 3 sql-search-config-v4.json — referenced by classpath: location"
tech_stack:
  added:
    - "Oracle 23c user rectrace_readonly (rectrace-local-dev container)"
  patterns:
    - "PL/SQL anonymous block with EXCEPTION WHEN OTHERS / SQLCODE != -1920 for idempotent CREATE USER"
    - "Bare GRANT after CREATE TABLE relies on apply.py --reset's drop+recreate cycle for idempotency"
    - "camelCase suffix-as-units property naming (queryTimeoutSeconds, fetchSize, maxRows)"
key_files:
  created: []
  modified:
    - "../rectrace-local-dev/init/01-create-schema-users.sql (sibling repo)"
    - "../rectrace-local-dev/schema/01-rectrace.sql (sibling repo)"
    - "backend/rectrace/src/main/resources/application-local.properties"
decisions:
  - "rectrace_readonly is structurally read-only: CREATE SESSION + QUOTA 0 ON USERS + GRANT SELECT only. No CONNECT/RESOURCE roles, no *ANY TABLE/DBA grants."
  - "GRANT SELECT lives in schema/01-rectrace.sql (not init/) so apply.py --reset re-applies it after drop+recreate."
  - "Bare GRANT (no PL/SQL idempotency wrapper) chosen over wrapped GRANT because the table is dropped+recreated each --reset cycle."
  - "sql-search-config.location uses classpath: (not file:) so the JSON ships in the JAR — matches Wave 3's planned JSON location."
metrics:
  duration: "~6 minutes"
  completed_date: "2026-05-17"
  tasks_completed: 2
  files_modified: 3
  commits:
    - repo: "rectrace-local-dev (sibling)"
      hash: "8050cb3"
      message: "feat(rectrace_readonly): add SELECT-only Oracle user for Config-driven SELECT tab"
    - repo: "autosys-job-explorer"
      hash: "2fd4805"
      message: "feat(05-02): add datasource.readonly.* + sql-search-config.location to application-local.properties"
---

# Phase 5 Plan 02: Local-dev DDL — rectrace_readonly + application-local.properties Summary

Stood up a dedicated, structurally read-only Oracle account (`rectrace_readonly`) in local-dev and wired the matching Spring properties so Phase 5 Wave 2's `ReadonlyDataSourceConfig` can bind against a real, live, SELECT-only principal from day one.

## Tasks Completed

### Task 1: Local-dev DDL — rectrace_readonly + GRANT SELECT

**Files modified (sibling repo `rectrace-local-dev`):**

- `init/01-create-schema-users.sql` — appended idempotent PL/SQL block creating `rectrace_readonly` with `QUOTA 0 ON USERS` and granting `CREATE SESSION`. Wrapped in `EXCEPTION WHEN OTHERS THEN IF SQLCODE != -1920 THEN RAISE` ("user already exists" suppression).
- `schema/01-rectrace.sql` — appended bare `GRANT SELECT ON rectrace.rectrace_core TO rectrace_readonly` separated by the `\n/\n` statement terminator convention enforced by `apply.py:apply_sql_file`.

**Sibling-repo commit:** `8050cb3` on `main` of `/Users/aarun/Workspace/Projects/rectrace-local-dev`.

**Live probe outputs (after `docker compose down -v && docker compose up -d && ./.venv/bin/python apply.py`):**

Positive probe — `SELECT COUNT(*) FROM rectrace.rectrace_core` as `rectrace_readonly`:
```
RECTRACE_CORE_ROWS
------------------
                 5
```

Negative probe — `INSERT INTO rectrace.rectrace_core (recon) VALUES ('test')` as `rectrace_readonly`:
```
INSERT INTO rectrace.rectrace_core (recon) VALUES ('test')
                     *
ERROR at line 1:
ORA-41900: missing INSERT privilege on "RECTRACE"."RECTRACE_CORE"
```

ORA-41900 is the Oracle 23c-specific equivalent of ORA-01031 ("insufficient privileges") — a stricter, more diagnostic deny outcome. Plan acceptance allows either ORA-01031 or ORA-00942; ORA-41900 is the actual stricter form and is treated as equivalent.

Privilege audit:
```
PRIVILEGE         -> CREATE SESSION  (only system priv)
OWNER  TABLE         PRIVILEGE
RECTRACE  RECTRACE_CORE   SELECT
SYS       RECTRACE_READONLY  INHERIT PRIVILEGES  (standard Oracle 23c self-inherit; not a security concern)
```

No roles granted (`user_role_privs` empty). Defense-in-depth: even if a future grant accidentally permits INSERT, `QUOTA 0 ON USERS` makes mutation in tablespace USERS structurally impossible (ORA-01536).

### Task 2: application-local.properties — datasource.readonly.* + sql-search-config.location

**File modified (this repo):** `backend/rectrace/src/main/resources/application-local.properties`

**13 new keys (all appended at file end, preserving every existing key verbatim):**

```
datasource.readonly.url=jdbc:oracle:thin:@localhost:1521/FREEPDB1
datasource.readonly.username=rectrace_readonly
datasource.readonly.password=rectrace_readonly_pwd
datasource.readonly.driver-class-name=oracle.jdbc.OracleDriver
datasource.readonly.service-name=FREEPDB1
datasource.readonly.db-schema=RECTRACE
datasource.readonly.hikari.maximum-pool-size=5
datasource.readonly.hikari.minimum-idle=1
datasource.readonly.hikari.connection-timeout=20000
datasource.readonly.queryTimeoutSeconds=30
datasource.readonly.fetchSize=500
datasource.readonly.maxRows=10000
sql-search-config.location=classpath:sql-search-config-v4.json
```

Property-name suffixes carry units (`queryTimeoutSeconds`, `fetchSize`, `maxRows`) per RESEARCH Pitfall 3.

**Compile verification:** `mvn -DskipTests compile` → `BUILD SUCCESS`.

**This-repo commit:** `2fd4805` on `worktree-agent-aff934afa9f8731ff` (branched from `milestone/modernization` @ `3d18345`).

**`rectrace-tlm-stats/src/main/resources/application-local.properties`:** byte-identical to its pre-edit state (`git diff` returns empty). Phase 5 changes are confined to `backend/rectrace`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking issue] Worktree base out of date**
- **Found during:** Task 2 (after Task 1 was complete)
- **Issue:** Worktree was created from commit `90d22c9` ("docs: map existing codebase"), which predates Phases 0.1 / 1 / 2 and therefore does not contain `backend/rectrace/src/main/resources/application-local.properties`. The plan presumes the file exists.
- **Fix:** `git reset --hard milestone/modernization` per the executor prompt's explicit recovery instruction (`<worktree_setup>` block: "If files MISSING → `git reset --hard milestone/modernization`"). New base: `3d18345`.
- **Files affected:** None destructively — the worktree had no in-progress changes (Task 1 lived in the sibling repo).
- **Commit:** None — recovery operation, not a code change.

**2. [Rule 3 — DDL parsing] Statement separator missing between CREATE TABLE and GRANT**
- **Found during:** Task 1 first `apply.py` run
- **Issue:** Appending `GRANT SELECT ... ;` directly after `CREATE TABLE ... );` in `schema/01-rectrace.sql` produced a single chunk after `apply.py:apply_sql_file` splits on `\n/\n`. Oracle rejected the combined statement with ORA-03405 ("End of query reached; no additional text should follow").
- **Fix:** Inserted `\n/\n` between the two statements so each runs as a separate `cursor.execute()` call. Dropped trailing `;` from both since `apply.py` accepts either form.
- **Files affected:** `../rectrace-local-dev/schema/01-rectrace.sql`.
- **Commit:** Included in sibling-repo `8050cb3` (single commit at end of Task 1).

### Observations (not deviations)

- **ORA-41900 vs ORA-01031:** The plan's acceptance_criteria lists ORA-01031 or ORA-00942 as deny outcomes. Oracle 23c returns the more specific ORA-41900 ("missing INSERT privilege") instead. This is a stricter, more diagnostic deny — semantically identical to ORA-01031 — and is treated as satisfying the criterion.

## Threat Model Mitigations Applied

- **T-05-03 (Elevation of Privilege):** `grep -E "GRANT (RESOURCE|DBA|.*ANY TABLE) TO rectrace_readonly"` across both DDL files returns 0 matches. Defense-in-depth: `QUOTA 0 ON USERS` prevents mutation in the only tablespace the user defaults to.
- **T-05-04 (Information Disclosure — plaintext password):** Accepted per plan disposition. Matches existing primary datasource pattern committed in Phase 0.1. Production hardening deferred to Phase 9 via ScriptExecutor.
- **T-05-05 (Tampering — INSERT/UPDATE/DELETE through readonly account):** Mitigated. INSERT probe returns ORA-41900. No DML privileges granted.

## Self-Check: PASSED

**Files exist:**
- `/Users/aarun/Workspace/Projects/rectrace-local-dev/init/01-create-schema-users.sql` → FOUND (3 mentions of `rectrace_readonly`)
- `/Users/aarun/Workspace/Projects/rectrace-local-dev/schema/01-rectrace.sql` → FOUND (2 mentions of `rectrace_readonly`)
- `backend/rectrace/src/main/resources/application-local.properties` → FOUND (12 `datasource.readonly.*` keys + 1 `sql-search-config.location`)

**Commits exist:**
- Sibling-repo `8050cb3` → FOUND (`git -C /Users/aarun/Workspace/Projects/rectrace-local-dev log --oneline | grep 8050cb3`)
- This-repo `2fd4805` → FOUND (`git log --oneline | grep 2fd4805`)

**Live probes (Oracle 23c local container):**
- SELECT count `>= 5` → PASS (5 rows)
- INSERT deny → PASS (ORA-41900)
- Privilege audit → PASS (CREATE SESSION + SELECT on RECTRACE.RECTRACE_CORE only)

**Negative gates:**
- No over-privileged grants in DDL → PASS (`grep -E "GRANT (RESOURCE|DBA|.*ANY TABLE) TO rectrace_readonly"` empty)
- tlm-stats unchanged → PASS (`git diff --stat rectrace-tlm-stats/src/main/resources/application-local.properties` empty)
- No production Java touched → PASS (`git diff --name-only HEAD~1 HEAD -- 'backend/rectrace/src/main/java/**'` empty)
