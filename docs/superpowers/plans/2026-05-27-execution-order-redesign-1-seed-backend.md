# Execution-Order Redesign — Plan 1: Seed + Backend (data contract)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This is one of two plans for the execution-order redesign (Slice 1); the frontend redesign is a separate plan. **This plan DEFINES the wire contract** (the extended `JobStatusInfo` shape, spec §6.2) that the frontend plan consumes — finish this plan first.

**Goal:** Surface the Autosys last-run "runtime gold" (last_start / last_end / exit_code / run_num / ntry / run_machine) plus `owner` through the existing `/api/execution-order/{job}` payload, so the redesigned modal can answer incident questions ("it failed — why? how long? did it retry?"). Concretely: extend the local seed (sibling repo) to carry the new columns and at least one FAILED job; extend the `JobStatusInfo` DTO with nine new fields mirroring the existing `nextStartEpoch`/`nextStartFormatted` pair; extend the `JobStatusService` SELECT + row mapper to thread the new columns through, null-tolerantly; and lock all of it with unit tests.

**Architecture:** The seed (sibling repo `../rectrace-local-dev`) is the **local contract** — it defines the column shape the backend reads, so it lands first. The backend change is two-layered: (1) the `JobStatusInfo.fromDatabase(...)` factory grows from 3 args to a richer overload that threads the seven runtime values, with epoch→formatted conversion reusing the existing `Instant.ofEpochSecond(...)` + IST (`ZoneId.systemDefault()`) formatter; (2) the inline `RowMapper` lambda inside `JobStatusService.getBatchJobStatus` is **extracted to a named package-private static `RowMapper<JobStatusInfo>`** so the column→DTO mapping is unit-testable against a mocked `ResultSet` without a live Oracle. `ExecutionOrderService` needs **no change** — it already calls `jobStatusService.getBatchJobStatus(...)` and stuffs the map into the DTO, so the richer `JobStatusInfo` flows straight through to the JSON. Duration is **not** a backend field — the frontend derives `lastEndEpoch − lastStartEpoch`; this plan returns epochs (seconds) only.

**Tech Stack:** Spring Boot 3.5.14, Java 21, Lombok (backend/rectrace), Spring JDBC `NamedParameterJdbcTemplate` + `RowMapper`, JUnit 5 + Mockito + spring-test (`spring-boot-starter-test`). Sibling seed: Oracle 23c DDL/DML SQL (SQL*Plus `/`-terminated, idempotent), Python 3.12 + pytest 8, bash 3.2-portable.

---

## File Structure

### Sibling repo — `/Users/aarun/Workspace/Projects/rectrace-local-dev` (branch `feature/execution-order-runtime-seed`)

| File | Create/Modify | Responsibility |
|---|---|---|
| `schema/02-autosys.sql` | Modify | Add `ujo_job.owner VARCHAR2(80)`; add `ujo_job_status` columns `last_start NUMBER(19)`, `last_end NUMBER(19)`, `run_num NUMBER(10)`, `ntry NUMBER(10)`, `exit_code NUMBER(10)`, `run_machine VARCHAR2(80)`. Idempotent DROP/CREATE pattern unchanged. |
| `data/02-autosys-inserts.sql` | Modify | Reseed the 5 `ujo_job` rows with `owner`, and the 5 `ujo_job_status` rows with the new runtime columns folded in. Fix the status-code comment AND reseed so ≥1 job resolves to FAILED (status `5` + non-zero `exit_code`) for smart-focus / "Attention — N failed" demoability. |
| `tests/test_schema_layout.py` | Modify | Add structural assertions: the new columns are declared on the right tables (string-level, no live DB). |
| `tests/test_autosys_runtime_seed.py` | Create | New string-level guard test: the seed populates the new columns and at least one FAILED (status 5, non-zero exit_code) row exists. |

`apply.py` / `volume.py` / `EXPECTED` need **no change** — the new columns are nullable, the volume insert lists (`["joid","status","next_start"]`, `["joid","job_name"]`) stay valid (volume rows simply leave new columns NULL — null-tolerant by design), and the canonical row counts (`ujo_job`:5, `ujo_job_status`:5) are unchanged. A guard step confirms this rather than editing them.

### Main repo — `/Users/aarun/Workspace/Projects/autosys-job-explorer` (branch `milestone/modernization`)

| File | Create/Modify | Responsibility |
|---|---|---|
| `backend/rectrace/src/main/java/com/citi/gru/rectrace/dto/JobStatusInfo.java` | Modify | Add 9 fields (`lastStartEpoch/lastStartFormatted`, `lastEndEpoch/lastEndFormatted`, `exitCode`, `runNum`, `retries`, `runMachine`, `owner`) + getters/setters + builder methods; add a richer `fromDatabase(...)` overload that threads the runtime values and formats the two new epoch pairs via the existing `formatNextStart`-style helper. Keep the 3-arg `fromDatabase` delegating to it (back-compat). |
| `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/JobStatusService.java` | Modify | Extend the SELECT to fetch the 6 `ujo_job_status` runtime columns + `uj.owner`; **extract the inline lambda into a named package-private static `JobStatusRowMapper implements RowMapper<JobStatusInfo>`** and use it in `getBatchJobStatus`. `createDefaultStatus` unchanged (builder leaves new fields null). |
| `backend/rectrace/src/test/java/com/citi/gru/rectrace/service/JobStatusServiceTest.java` | Create | Plain JUnit5 + Mockito, no Spring context. Tests the extracted `JobStatusRowMapper.mapRow(rs, n)` against a mocked `ResultSet`: full row maps all fields; null runtime columns map to null fields (null tolerance); the FAILED case (status 5) resolves `visualState=FAILED`. |

`ExecutionOrderService.java` is **unchanged** (confirmed in Task 6) — it merges the richer `JobStatusInfo` without code changes.

---

## Task 0: Branches and baselines

**Files:** none (setup + baseline verification).

- [ ] **Step 1: Create the sibling-repo feature branch**

```bash
git -C /Users/aarun/Workspace/Projects/rectrace-local-dev checkout -b feature/execution-order-runtime-seed
```
Expected: `Switched to a new branch 'feature/execution-order-runtime-seed'`. (The sibling repo has no git remote; this branch is local-only.)

- [ ] **Step 2: Confirm the main repo is on the modernization branch**

```bash
git -C /Users/aarun/Workspace/Projects/autosys-job-explorer rev-parse --abbrev-ref HEAD
```
Expected: `milestone/modernization`. Backend tasks (5–7) commit here directly per CLAUDE.md (no new feature branch for the backend half).

- [ ] **Step 3: Baseline the backend test suite (green before we start)**

```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer/backend/rectrace && mvn -q test
```
Expected: `BUILD SUCCESS`, all existing tests pass (including `ExecutionOrderServiceTest`). If this is red, stop and fix the baseline before proceeding.

- [ ] **Step 4: Baseline the sibling-repo python tests (green before we start)**

```bash
cd /Users/aarun/Workspace/Projects/rectrace-local-dev && .venv/bin/python -m pytest tests/test_schema_layout.py tests/test_volume_unit.py -q
```
Expected: all tests pass (no failures). These are string/unit tests — no live Oracle needed.

---

## Task 1: Seed schema — add the runtime columns (sibling repo)

**Files:**
- Modify: `schema/02-autosys.sql`
- Modify: `tests/test_schema_layout.py`

- [ ] **Step 1: Write the failing structural test**

In `/Users/aarun/Workspace/Projects/rectrace-local-dev/tests/test_schema_layout.py`, append this test (it reuses the existing `_read` helper at the top of the file):

```python
def test_autosys_runtime_columns_declared():
    """Spec §7: ujo_job_status grows six runtime columns and ujo_job grows owner.
    String-level guard — no live DB. Matches the lower-cased DDL."""
    ddl = _read("schema/02-autosys.sql")
    # ujo_job_status runtime columns
    for col in ("last_start", "last_end", "run_num", "ntry", "exit_code", "run_machine"):
        assert col in ddl, f"missing ujo_job_status column: {col}"
    # ujo_job.owner
    assert "owner" in ddl, "missing ujo_job.owner column"
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd /Users/aarun/Workspace/Projects/rectrace-local-dev && .venv/bin/python -m pytest tests/test_schema_layout.py::test_autosys_runtime_columns_declared -q
```
Expected: FAIL — `AssertionError: missing ujo_job_status column: last_start` (the columns are not declared yet).

- [ ] **Step 3: Add the columns to `schema/02-autosys.sql`**

Replace the two `CREATE TABLE` blocks (lines 20–31 of the current file) with the extended definitions. The DROP/idempotency blocks above them stay exactly as they are.

```sql
CREATE TABLE ujo_job (
  joid       NUMBER(10),
  job_name   VARCHAR2(4000),
  owner      VARCHAR2(80)
);
/

CREATE TABLE ujo_job_status (
  joid         NUMBER(10),
  status       NUMBER(10),
  next_start   NUMBER(19),
  last_start   NUMBER(19),
  last_end     NUMBER(19),
  run_num      NUMBER(10),
  ntry         NUMBER(10),
  exit_code    NUMBER(10),
  run_machine  VARCHAR2(80)
);
/
```

Also update the header comment block at the top of the file (lines 1–3) to note the new columns. Replace it with:

```sql
-- Source: ujo_job + ujo_job_status from JobStatusService.java (LEFT JOIN ON joid);
--   status is Integer, next_start is Long (epoch SECONDS).
-- Runtime gold (spec §6/§7): ujo_job_status.last_start/last_end (epoch SECONDS),
--   run_num, ntry (retries used), exit_code, run_machine; ujo_job.owner.
--   All new columns are NULLABLE — jobs with no run history return null runtime fields.
-- Owned by the AUTOSYS schema user.
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd /Users/aarun/Workspace/Projects/rectrace-local-dev && .venv/bin/python -m pytest tests/test_schema_layout.py -q
```
Expected: PASS — all tests in the file pass (the existing `ujo_job`/`ujo_job_status` `create table` assertions still match because the table names are unchanged).

- [ ] **Step 5: Commit (sibling repo)**

```bash
git -C /Users/aarun/Workspace/Projects/rectrace-local-dev add schema/02-autosys.sql tests/test_schema_layout.py
git -C /Users/aarun/Workspace/Projects/rectrace-local-dev commit -m "feat(seed): add ujo runtime columns + owner to autosys DDL

last_start/last_end/run_num/ntry/exit_code/run_machine on ujo_job_status,
owner on ujo_job. All nullable (null-tolerant runtime contract, spec §7).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: Seed data — populate runtime + a FAILED job (sibling repo)

**Files:**
- Modify: `data/02-autosys-inserts.sql`
- Create: `tests/test_autosys_runtime_seed.py`

The status mix maps via `JobStatusInfo.mapStatusCodeToVisualState`: `1/2→RUNNING`, `4→COMPLETED`, `5/6→FAILED`, `3/7/12→WAITING`, else `INACTIVE`. The current seed used `1,2,1,4,7` (no FAILED — `4` is COMPLETED, not FAILURE as the old comment wrongly claimed). New mix: `4` (COMPLETED, exit 0), `1` (RUNNING), `4` (COMPLETED, exit 0), **`5` (FAILED, exit 1)**, `7` (WAITING/On Hold). joid `1004` (`RECON-XYZ-42`) becomes the demoable failure.

Epochs are **seconds**. Anchor base `1747084800` = 2025-05-12 (the same base the old `next_start` used). `last_start`/`last_end` are set so durations are sensible (e.g. 35 min, 1 h 12 m), with `last_end` slightly before `next_start`.

- [ ] **Step 1: Write the failing seed-data guard test**

Create `/Users/aarun/Workspace/Projects/rectrace-local-dev/tests/test_autosys_runtime_seed.py`:

```python
"""Spec §7: the autosys seed data populates the runtime columns and exercises
the FAILED path so smart-focus / 'Attention — N failed' is demoable locally.
String-level guard — no live DB."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _read(rel: str) -> str:
    return (ROOT / rel).read_text()


def test_ujo_job_status_inserts_carry_runtime_columns():
    data = _read("data/02-autosys-inserts.sql")
    # The extended column list must appear on the ujo_job_status inserts.
    assert "INSERT INTO ujo_job_status (joid, status, next_start, last_start, last_end, run_num, ntry, exit_code, run_machine)" in data


def test_ujo_job_inserts_carry_owner():
    data = _read("data/02-autosys-inserts.sql")
    assert "INSERT INTO ujo_job (joid, job_name, owner)" in data


def test_seed_has_at_least_one_failed_job():
    """A FAILED row (status 5) with a non-zero exit_code must exist so the
    frontend smart-focus ('first FAILED') and rollup ('Attention — N failed')
    are exercisable against the local seed."""
    data = _read("data/02-autosys-inserts.sql")
    lines = [ln for ln in data.splitlines() if ln.strip().startswith("INSERT INTO ujo_job_status")]
    # find the status-5 row and confirm a non-zero exit code on the same line
    failed = [ln for ln in lines if ", 5, " in ln]
    assert failed, "no ujo_job_status row with status 5 (FAILED)"
    # the failed row must carry a non-zero exit_code (i.e. not ', 0,' for exit_code slot)
    assert any("VALUES (1004" in ln for ln in failed), "expected joid 1004 to be the FAILED row"
    assert not any(ln.rstrip().endswith(", 0, NULL)") for ln in failed), "FAILED row should have a non-zero exit_code"
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd /Users/aarun/Workspace/Projects/rectrace-local-dev && .venv/bin/python -m pytest tests/test_autosys_runtime_seed.py -q
```
Expected: FAIL — the current inserts use the 3-column form `(joid, status, next_start)`, so the extended-column-list assertions fail.

- [ ] **Step 3: Rewrite the inserts in `data/02-autosys-inserts.sql`**

Replace the entire file with the version below. The `TRUNCATE` idempotency blocks stay; the `ujo_job` inserts gain `owner`; the `ujo_job_status` inserts gain the six runtime columns; the status-mix comment is corrected; joid `1004` is now FAILED (status 5, exit_code 1).

```sql
-- ujo_job and ujo_job_status are SEPARATE TABLES joined on joid per
-- JobStatusService.java (LEFT JOIN ujs ON uj.joid = ujs.joid).
-- status (per JobStatusInfo.mapStatusCodeToVisualState):
--   1/2 -> RUNNING, 4 -> COMPLETED, 5/6 -> FAILED, 3/7/12 -> WAITING, else INACTIVE.
-- next_start / last_start / last_end are epoch SECONDS (NUMBER(19)).
-- Runtime gold (spec §6/§7): run_num, ntry (retries used), exit_code, run_machine.
-- joid 1004 (RECON-XYZ-42) is the demoable FAILED job (status 5, exit_code 1).
-- Owned by the AUTOSYS schema user.

-- Truncate child first, then parents (idempotency).
TRUNCATE TABLE ujo_job_status
/
TRUNCATE TABLE ujo_job
/

-- =====================================================================
-- ujo_job (5 parent rows, joid 1001..1005) — now with owner.
-- =====================================================================
INSERT INTO ujo_job (joid, job_name, owner) VALUES (1001, 'LOAD_TRADE_RECON_001', 'svc_trade_recon')
/
INSERT INTO ujo_job (joid, job_name, owner) VALUES (1002, 'LOAD-ABC-123', 'svc_abc_batch')
/
INSERT INTO ujo_job (joid, job_name, owner) VALUES (1003, 'LOAD_FX_RECON_003', 'svc_fx_recon')
/
INSERT INTO ujo_job (joid, job_name, owner) VALUES (1004, 'RECON-XYZ-42', 'svc_xyz_recon')
/
INSERT INTO ujo_job (joid, job_name, owner) VALUES (1005, 'LOAD_COMMOD_RECON_005', 'svc_commod_recon')
/

-- =====================================================================
-- ujo_job_status (5 matching status rows, joined on joid).
-- Status mix: 4=COMPLETED, 1=RUNNING, 4=COMPLETED, 5=FAILED, 7=WAITING(On Hold).
-- Columns: joid, status, next_start, last_start, last_end, run_num, ntry, exit_code, run_machine.
-- Durations: 1001 ~35m, 1003 ~1h12m, 1004 ~8m (failed fast); 1002 RUNNING has
-- last_start but NULL last_end (still running); 1005 WAITING has NULL run history.
-- =====================================================================
INSERT INTO ujo_job_status (joid, status, next_start, last_start, last_end, run_num, ntry, exit_code, run_machine) VALUES (1001, 4, 1747084800, 1746998400, 1747000500, 412, 0, 0, 'na-trade01')
/
INSERT INTO ujo_job_status (joid, status, next_start, last_start, last_end, run_num, ntry, exit_code, run_machine) VALUES (1002, 1, 1747171200, 1747170000, NULL, 88, 0, NULL, 'na-abc02')
/
INSERT INTO ujo_job_status (joid, status, next_start, last_start, last_end, run_num, ntry, exit_code, run_machine) VALUES (1003, 4, 1747257600, 1747166400, 1747170720, 1290, 1, 0, 'eu-fx05')
/
INSERT INTO ujo_job_status (joid, status, next_start, last_start, last_end, run_num, ntry, exit_code, run_machine) VALUES (1004, 5, 1747344000, 1747252800, 1747253280, 37, 2, 1, 'ap-xyz07')
/
INSERT INTO ujo_job_status (joid, status, next_start, last_start, last_end, run_num, ntry, exit_code, run_machine) VALUES (1005, 7, 1747430400, NULL, NULL, NULL, NULL, NULL, NULL)
/
```

- [ ] **Step 4: Run the new test + the existing layout test to verify pass**

```bash
cd /Users/aarun/Workspace/Projects/rectrace-local-dev && .venv/bin/python -m pytest tests/test_autosys_runtime_seed.py tests/test_schema_layout.py -q
```
Expected: PASS — all assertions hold. (`test_schema_layout.py` still passes: `insert into ujo_job ` and `insert into ujo_job_status ` substrings remain present — note the existing assertions match the lower-cased text with a trailing space, which our `INSERT INTO ujo_job (` and `INSERT INTO ujo_job_status (` lines still satisfy after the `_read` lower-casing.)

- [ ] **Step 5: Confirm the volume path is unaffected (no edit needed, just a guard run)**

```bash
cd /Users/aarun/Workspace/Projects/rectrace-local-dev && .venv/bin/python -m pytest tests/test_volume_unit.py -q
```
Expected: PASS unchanged. The volume inserts list only `["joid","status","next_start"]` / `["joid","job_name"]`; the new columns are nullable so volume rows insert fine leaving them NULL, and `EXPECTED` counts (`ujo_job`:5, `ujo_job_status`:5) are unchanged. No edit to `volume.py` / `apply.py` / `EXPECTED` is required.

- [ ] **Step 6: Commit (sibling repo)**

```bash
git -C /Users/aarun/Workspace/Projects/rectrace-local-dev add data/02-autosys-inserts.sql tests/test_autosys_runtime_seed.py
git -C /Users/aarun/Workspace/Projects/rectrace-local-dev commit -m "feat(seed): populate ujo runtime columns + owner; add a FAILED job

joid 1004 (RECON-XYZ-42) now resolves to FAILED (status 5, exit_code 1) so
smart-focus + 'Attention — N failed' are demoable locally. Corrected the
status-code comment (4=COMPLETED, 5=FAILED — matches the Java mapping).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: Apply the seed against the live local stack (sibling repo — verification)

**Files:** none (live verification only). Requires the local Docker stack up (`docker compose up -d` in the sibling repo) per CLAUDE.md "Local Docker Stack". If the stack is not running, **skip the live apply** and record that the apply step is deferred to whoever has the stack — the string-level tests above are the gating evidence; this step is the end-to-end confirmation.

- [ ] **Step 1: Apply the autosys schema + data against the running Oracle**

```bash
cd /Users/aarun/Workspace/Projects/rectrace-local-dev && .venv/bin/python apply.py --oracle-only
```
Expected: log lines `[autosys] applying DDL: 02-autosys.sql`, `[autosys] applying data: 02-autosys-inserts.sql`, then `  autosys.ujo_job: 5 rows` and `  autosys.ujo_job_status: 5 rows`. No errors.

- [ ] **Step 2: Verify row counts still match the contract**

```bash
cd /Users/aarun/Workspace/Projects/rectrace-local-dev && .venv/bin/python apply.py --verify
```
Expected: the `autosys.ujo_job` and `autosys.ujo_job_status` checks both report `5 / 5 ok`; overall `N/N checks passed`, exit 0. (The new columns don't change counts.)

- [ ] **Step 3: Spot-check the FAILED row landed**

```bash
cd /Users/aarun/Workspace/Projects/rectrace-local-dev && .venv/bin/python -c "import os, oracledb; from dotenv import load_dotenv; load_dotenv('.env'); load_dotenv('.env.example'); c=oracledb.connect(user='autosys', password=os.environ['AUTOSYS_PWD'], dsn=os.environ['ORACLE_DSN']); cur=c.cursor(); cur.execute('SELECT joid, status, exit_code, run_machine FROM ujo_job_status WHERE status=5'); print(cur.fetchall()); c.close()"
```
Expected: `[(1004, 5, 1, 'ap-xyz07')]` — exactly one FAILED row with a non-zero exit_code.

- [ ] **Step 4: No commit** (verification only — nothing changed on disk).

---

## Task 4: DTO — add the nine runtime fields to `JobStatusInfo` (main repo)

**Files:**
- Modify: `backend/rectrace/src/main/java/com/citi/gru/rectrace/dto/JobStatusInfo.java`
- (test added in Task 7 — the DTO is exercised through the row mapper; this task is a pure field/factory expansion verified by `mvn test` staying green plus a focused factory test added here)

This task adds the fields, builder methods, getters/setters, a `formatEpoch` helper (mirroring `formatNextStart`), and a richer `fromDatabase(...)` overload. We **TDD the factory directly** with a new test class so the formatting/threading is locked before the service layer uses it.

- [ ] **Step 1: Write the failing factory test**

Create `backend/rectrace/src/test/java/com/citi/gru/rectrace/dto/JobStatusInfoTest.java`:

```java
package com.citi.gru.rectrace.dto;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Assertions;

/**
 * Locks the extended {@link JobStatusInfo#fromDatabase} runtime-column factory
 * (spec §6.2): the seven runtime values thread through, epochs are SECONDS,
 * the two new epoch pairs format like next_start (IST), and nulls stay null.
 * Plain unit test — no Spring context, no DB.
 */
class JobStatusInfoTest {

    @Test
    void fullRowThreadsAllRuntimeFields() {
        JobStatusInfo info = JobStatusInfo.fromDatabase(
                "RECON-XYZ-42", 5, 1747344000L,
                1747252800L, 1747253280L, 37, 2, 1, "ap-xyz07", "svc_xyz_recon");

        Assertions.assertEquals("RECON-XYZ-42", info.getJobName());
        Assertions.assertEquals(JobStatusInfo.VisualState.FAILED, info.getVisualState());
        Assertions.assertEquals(1747252800L, info.getLastStartEpoch());
        Assertions.assertEquals(1747253280L, info.getLastEndEpoch());
        Assertions.assertEquals(37, info.getRunNum());
        Assertions.assertEquals(2, info.getRetries());
        Assertions.assertEquals(1, info.getExitCode());
        Assertions.assertEquals("ap-xyz07", info.getRunMachine());
        Assertions.assertEquals("svc_xyz_recon", info.getOwner());
        // Epoch -> formatted is non-null (formatted like next_start; IST).
        Assertions.assertNotNull(info.getLastStartFormatted());
        Assertions.assertNotNull(info.getLastEndFormatted());
    }

    @Test
    void nullRuntimeColumnsStayNull() {
        // A WAITING job with no run history: all runtime epochs/values null.
        JobStatusInfo info = JobStatusInfo.fromDatabase(
                "LOAD_COMMOD_RECON_005", 7, 1747430400L,
                null, null, null, null, null, null, "svc_commod_recon");

        Assertions.assertEquals(JobStatusInfo.VisualState.WAITING, info.getVisualState());
        Assertions.assertNull(info.getLastStartEpoch());
        Assertions.assertNull(info.getLastStartFormatted());
        Assertions.assertNull(info.getLastEndEpoch());
        Assertions.assertNull(info.getLastEndFormatted());
        Assertions.assertNull(info.getRunNum());
        Assertions.assertNull(info.getRetries());
        Assertions.assertNull(info.getExitCode());
        Assertions.assertNull(info.getRunMachine());
        Assertions.assertEquals("svc_commod_recon", info.getOwner());
    }

    @Test
    void threeArgFactoryStillWorksAndLeavesRuntimeNull() {
        // Back-compat: the original 3-arg factory keeps working; new fields null.
        JobStatusInfo info = JobStatusInfo.fromDatabase("LOAD-ABC-123", 4, 1747171200L);
        Assertions.assertEquals(JobStatusInfo.VisualState.COMPLETED, info.getVisualState());
        Assertions.assertNull(info.getLastStartEpoch());
        Assertions.assertNull(info.getOwner());
        Assertions.assertNull(info.getExitCode());
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer/backend/rectrace && mvn -q -Dtest=JobStatusInfoTest test
```
Expected: COMPILATION FAILURE — the 10-arg `fromDatabase` overload and the new getters (`getLastStartEpoch`, etc.) do not exist yet.

- [ ] **Step 3: Add the fields + formatter helper to `JobStatusInfo.java`**

In `backend/rectrace/src/main/java/com/citi/gru/rectrace/dto/JobStatusInfo.java`, add the nine fields after the existing `private VisualState visualState;` field (line 31):

```java
    private VisualState visualState;

    // Runtime gold (spec §6.2) — epochs are SECONDS, formatted like next_start (IST).
    private Long lastStartEpoch;
    private String lastStartFormatted;
    private Long lastEndEpoch;
    private String lastEndFormatted;
    private Integer exitCode;
    private Integer runNum;
    private Integer retries; // from ujo_job_status.ntry (retries used)
    private String runMachine;
    private String owner; // from ujo_job.owner
```

- [ ] **Step 4: Add the richer `fromDatabase` overload + delegate the 3-arg one**

Replace the existing `fromDatabase` method (lines 42–64) with both overloads. The 3-arg form delegates to the 10-arg form with nulls so the YET_TO_RUN logic lives in one place:

```java
    /**
     * Factory method to create JobStatusInfo from database values (status only).
     * Back-compat 3-arg form — delegates to the richer overload with null runtime.
     */
    public static JobStatusInfo fromDatabase(String jobName, Integer statusCode, Long nextStart) {
        return fromDatabase(jobName, statusCode, nextStart,
                null, null, null, null, null, null, null);
    }

    /**
     * Factory method including the runtime gold (spec §6.2). All runtime args are
     * null-tolerant: a job with no run history passes nulls and gets null runtime
     * fields (not errors). Epochs are SECONDS; the two new epoch pairs format via
     * the same {@link #formatNextStart} path used by next_start (IST).
     */
    public static JobStatusInfo fromDatabase(
            String jobName, Integer statusCode, Long nextStart,
            Long lastStart, Long lastEnd, Integer runNum, Integer ntry,
            Integer exitCode, String runMachine, String owner) {
        Builder builder = builder().jobName(jobName).status(statusCode);

        String statusName = mapStatusCodeToName(statusCode);
        VisualState visualState = mapStatusCodeToVisualState(statusCode);
        boolean scheduledToday = isScheduledForToday(nextStart);
        boolean isInactiveOrActivated = statusCode != null && (statusCode == 8 || statusCode == 3);

        // YET_TO_RUN logic: if scheduled today AND job is inactive/activated
        if (scheduledToday && isInactiveOrActivated) {
            statusName = "Yet to Run";
            visualState = VisualState.WAITING;
        }

        builder.statusName(statusName)
                .visualState(visualState)
                .nextStartEpoch(nextStart)
                .nextStartFormatted(formatNextStart(nextStart))
                .isScheduledToday(scheduledToday)
                .isCurrentlyActive(isActiveStatus(statusCode))
                .lastStartEpoch(lastStart)
                .lastStartFormatted(formatNextStart(lastStart))
                .lastEndEpoch(lastEnd)
                .lastEndFormatted(formatNextStart(lastEnd))
                .runNum(runNum)
                .retries(ntry)
                .exitCode(exitCode)
                .runMachine(runMachine)
                .owner(owner);

        return builder.build();
    }
```

Note: `formatNextStart` (lines 148–159) already returns `null` for null/≤0 epochs, so it is the correct shared formatter for `last_start`/`last_end` — no new helper method is needed. Reusing it keeps the "formatted like next_start (IST)" contract literal.

- [ ] **Step 5: Add getters/setters for the nine new fields**

Add after the existing `setVisualState(...)` setter (line 231), before the `// Builder pattern` comment:

```java
    public Long getLastStartEpoch() {
        return lastStartEpoch;
    }

    public void setLastStartEpoch(Long lastStartEpoch) {
        this.lastStartEpoch = lastStartEpoch;
    }

    public String getLastStartFormatted() {
        return lastStartFormatted;
    }

    public void setLastStartFormatted(String lastStartFormatted) {
        this.lastStartFormatted = lastStartFormatted;
    }

    public Long getLastEndEpoch() {
        return lastEndEpoch;
    }

    public void setLastEndEpoch(Long lastEndEpoch) {
        this.lastEndEpoch = lastEndEpoch;
    }

    public String getLastEndFormatted() {
        return lastEndFormatted;
    }

    public void setLastEndFormatted(String lastEndFormatted) {
        this.lastEndFormatted = lastEndFormatted;
    }

    public Integer getExitCode() {
        return exitCode;
    }

    public void setExitCode(Integer exitCode) {
        this.exitCode = exitCode;
    }

    public Integer getRunNum() {
        return runNum;
    }

    public void setRunNum(Integer runNum) {
        this.runNum = runNum;
    }

    public Integer getRetries() {
        return retries;
    }

    public void setRetries(Integer retries) {
        this.retries = retries;
    }

    public String getRunMachine() {
        return runMachine;
    }

    public void setRunMachine(String runMachine) {
        this.runMachine = runMachine;
    }

    public String getOwner() {
        return owner;
    }

    public void setOwner(String owner) {
        this.owner = owner;
    }
```

- [ ] **Step 6: Add the nine builder methods**

Add inside the `Builder` static class, after the existing `visualState(...)` builder method (line 283), before `public JobStatusInfo build()`:

```java
        public Builder lastStartEpoch(Long lastStartEpoch) {
            jobStatusInfo.lastStartEpoch = lastStartEpoch;
            return this;
        }

        public Builder lastStartFormatted(String lastStartFormatted) {
            jobStatusInfo.lastStartFormatted = lastStartFormatted;
            return this;
        }

        public Builder lastEndEpoch(Long lastEndEpoch) {
            jobStatusInfo.lastEndEpoch = lastEndEpoch;
            return this;
        }

        public Builder lastEndFormatted(String lastEndFormatted) {
            jobStatusInfo.lastEndFormatted = lastEndFormatted;
            return this;
        }

        public Builder exitCode(Integer exitCode) {
            jobStatusInfo.exitCode = exitCode;
            return this;
        }

        public Builder runNum(Integer runNum) {
            jobStatusInfo.runNum = runNum;
            return this;
        }

        public Builder retries(Integer retries) {
            jobStatusInfo.retries = retries;
            return this;
        }

        public Builder runMachine(String runMachine) {
            jobStatusInfo.runMachine = runMachine;
            return this;
        }

        public Builder owner(String owner) {
            jobStatusInfo.owner = owner;
            return this;
        }
```

- [ ] **Step 7: Run the factory test to verify it passes**

```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer/backend/rectrace && mvn -q -Dtest=JobStatusInfoTest test
```
Expected: PASS — 3 tests pass (`fullRowThreadsAllRuntimeFields`, `nullRuntimeColumnsStayNull`, `threeArgFactoryStillWorksAndLeavesRuntimeNull`). (Cosmetic `Unsafe::objectFieldOffset` warnings from Lombok on Java 21 are expected and not failures.)

- [ ] **Step 8: Commit (main repo)**

```bash
git -C /Users/aarun/Workspace/Projects/autosys-job-explorer add backend/rectrace/src/main/java/com/citi/gru/rectrace/dto/JobStatusInfo.java backend/rectrace/src/test/java/com/citi/gru/rectrace/dto/JobStatusInfoTest.java
git -C /Users/aarun/Workspace/Projects/autosys-job-explorer commit -m "feat(backend): extend JobStatusInfo with runtime gold + owner (spec §6.2)

Adds lastStart/lastEnd epoch+formatted pairs, exitCode, runNum, retries (ntry),
runMachine, owner. New 10-arg fromDatabase overload threads them null-tolerantly;
the 3-arg form delegates with nulls. Epochs are SECONDS; new epoch pairs format
via the existing next_start formatter (IST).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: Service — extend the SELECT + extract a named RowMapper (main repo)

**Files:**
- Modify: `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/JobStatusService.java`

This task extends the SQL and refactors the inline lambda into a named package-private static `RowMapper` so Task 7 can unit-test the column→DTO mapping against a mocked `ResultSet`. No test is added in this task (it's a refactor that keeps the suite green); Task 7 adds the targeted mapper tests. Verification here is the full suite staying green.

- [ ] **Step 1: Extend the SELECT in `getBatchJobStatus`**

In `JobStatusService.java`, replace the `String sql = String.format(...)` block (lines 46–51) with the extended column list. Same `LEFT JOIN`, same `WHERE`:

```java
        String sql = String.format(
                "SELECT uj.job_name, uj.owner, ujs.status, ujs.next_start, "
                        + "ujs.last_start, ujs.last_end, ujs.run_num, ujs.ntry, "
                        + "ujs.exit_code, ujs.run_machine "
                        + "FROM %s.ujo_job uj "
                        + "LEFT JOIN %s.ujo_job_status ujs ON uj.joid = ujs.joid "
                        + "WHERE UPPER(uj.job_name) IN (:jobNames)",
                schema, schema);
```

- [ ] **Step 2: Replace the inline lambda with the named mapper**

Replace the `jdbcTemplate.query(sql, parameters, (rs, rowNum) -> { ... });` call (lines 62–68) with a reference to the extracted mapper:

```java
            List<JobStatusInfo> statusList = jdbcTemplate.query(sql, parameters, JOB_STATUS_ROW_MAPPER);
```

- [ ] **Step 3: Add the package-private static RowMapper**

Add the import near the top (after the existing `org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate` import, line 11):

```java
import org.springframework.jdbc.core.RowMapper;
```

Add the mapper as a `static final` field + a package-private static class, inserted after the constructor (after line 34, before `getBatchJobStatus`):

```java
    /**
     * Maps a ujo_job (+ owner) LEFT JOIN ujo_job_status row to JobStatusInfo.
     * Package-private + static so it is unit-testable against a mocked ResultSet
     * (see JobStatusServiceTest) without a live Oracle. rs.getObject(col, T.class)
     * returns null for SQL NULL, so runtime columns are null-tolerant.
     */
    static final RowMapper<JobStatusInfo> JOB_STATUS_ROW_MAPPER = new JobStatusRowMapper();

    static final class JobStatusRowMapper implements RowMapper<JobStatusInfo> {
        @Override
        public JobStatusInfo mapRow(java.sql.ResultSet rs, int rowNum) throws java.sql.SQLException {
            String jobName = rs.getString("job_name");
            String owner = rs.getString("owner");
            Integer status = rs.getObject("status", Integer.class);
            Long nextStart = rs.getObject("next_start", Long.class);
            Long lastStart = rs.getObject("last_start", Long.class);
            Long lastEnd = rs.getObject("last_end", Long.class);
            Integer runNum = rs.getObject("run_num", Integer.class);
            Integer ntry = rs.getObject("ntry", Integer.class);
            Integer exitCode = rs.getObject("exit_code", Integer.class);
            String runMachine = rs.getString("run_machine");

            return JobStatusInfo.fromDatabase(
                    jobName, status, nextStart,
                    lastStart, lastEnd, runNum, ntry, exitCode, runMachine, owner);
        }
    }
```

(Using fully-qualified `java.sql.ResultSet` / `java.sql.SQLException` in the mapper signature avoids adding two more top-level imports; the existing `import java.util.*;` does not cover `java.sql`. Either approach is fine — fully-qualifying keeps the import block minimal.)

- [ ] **Step 4: Run the full suite to confirm the refactor is green**

```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer/backend/rectrace && mvn -q test
```
Expected: `BUILD SUCCESS`. All existing tests still pass (the service behaviour is unchanged; only the SQL and mapper shape changed). `JobStatusInfoTest` from Task 4 also passes.

- [ ] **Step 5: Commit (main repo)**

```bash
git -C /Users/aarun/Workspace/Projects/autosys-job-explorer add backend/rectrace/src/main/java/com/citi/gru/rectrace/service/JobStatusService.java
git -C /Users/aarun/Workspace/Projects/autosys-job-explorer commit -m "feat(backend): fetch ujo runtime columns + owner; extract named RowMapper

Extends the JobStatusService SELECT to read last_start/last_end/run_num/ntry/
exit_code/run_machine + uj.owner (same LEFT JOIN). Extracts the inline mapper
lambda into a package-private static JobStatusRowMapper so the column->DTO
mapping is unit-testable against a mocked ResultSet.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: Confirm `ExecutionOrderService` needs no change (main repo — guard)

**Files:** none (read-only confirmation).

- [ ] **Step 1: Re-read the merge point**

Open `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/ExecutionOrderService.java` and confirm the only `JobStatusInfo` touch point is:

```java
Map<String, JobStatusInfo> jobStatuses = jobStatusService.getBatchJobStatus(jobNames);
result.setJobStatuses(jobStatuses);
```

(around line 124). It stores the map verbatim into `ExecutionOrderDTO` — the richer `JobStatusInfo` (now carrying the runtime fields) serializes through unchanged. There is no per-field handling in `ExecutionOrderService`, so **no edit is required**.

- [ ] **Step 2: Confirm the existing `ExecutionOrderServiceTest` still passes (regression guard)**

```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer/backend/rectrace && mvn -q -Dtest=ExecutionOrderServiceTest test
```
Expected: PASS — both `toleratesIntegerExecOrderFromNativeQuery` and `mapsCommandAndDescriptionFromDetailsQuery` pass (these use `jobStatusService = null`, so the live-status branch is skipped — unaffected by the DTO/service change).

- [ ] **Step 3: No commit** (nothing changed).

---

## Task 7: Service-layer test — `JobStatusServiceTest` against a mocked ResultSet (main repo)

**Files:**
- Create: `backend/rectrace/src/test/java/com/citi/gru/rectrace/service/JobStatusServiceTest.java`

This is the new test the spec calls out (§8: "JobStatusServiceTest (Create — does not exist today)"). It mirrors the `ExecutionOrderServiceTest` style: plain JUnit5 + Mockito, no Spring context. It tests the **extracted `JobStatusRowMapper`** directly against a mocked `ResultSet`, which is the unit-testable column→DTO seam (no live DB, no `NamedParameterJdbcTemplate` wiring needed).

- [ ] **Step 1: Write the failing test**

Create `backend/rectrace/src/test/java/com/citi/gru/rectrace/service/JobStatusServiceTest.java`:

```java
package com.citi.gru.rectrace.service;

import static org.mockito.Mockito.when;

import java.sql.ResultSet;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Assertions;
import org.mockito.Mockito;

import com.citi.gru.rectrace.dto.JobStatusInfo;

/**
 * Locks the column->DTO mapping done by the extracted
 * {@link JobStatusService.JobStatusRowMapper}: the six ujo_job_status runtime
 * columns + uj.owner thread into JobStatusInfo, nulls are tolerated (jobs with
 * no run history), and the FAILED path (status 5) resolves correctly.
 *
 * <p>Plain unit test — no Spring context, no live Oracle. The mapper is exercised
 * against a Mockito-mocked {@link ResultSet}, which is exactly what
 * NamedParameterJdbcTemplate would hand it row-by-row.
 */
class JobStatusServiceTest {

    @Test
    void mapsAllRuntimeColumnsAndOwner() throws Exception {
        ResultSet rs = Mockito.mock(ResultSet.class);
        when(rs.getString("job_name")).thenReturn("RECON-XYZ-42");
        when(rs.getString("owner")).thenReturn("svc_xyz_recon");
        when(rs.getObject("status", Integer.class)).thenReturn(5);
        when(rs.getObject("next_start", Long.class)).thenReturn(1747344000L);
        when(rs.getObject("last_start", Long.class)).thenReturn(1747252800L);
        when(rs.getObject("last_end", Long.class)).thenReturn(1747253280L);
        when(rs.getObject("run_num", Integer.class)).thenReturn(37);
        when(rs.getObject("ntry", Integer.class)).thenReturn(2);
        when(rs.getObject("exit_code", Integer.class)).thenReturn(1);
        when(rs.getString("run_machine")).thenReturn("ap-xyz07");

        JobStatusInfo info = JobStatusService.JOB_STATUS_ROW_MAPPER.mapRow(rs, 0);

        Assertions.assertEquals("RECON-XYZ-42", info.getJobName());
        Assertions.assertEquals("svc_xyz_recon", info.getOwner());
        Assertions.assertEquals(JobStatusInfo.VisualState.FAILED, info.getVisualState());
        Assertions.assertEquals(1747252800L, info.getLastStartEpoch());
        Assertions.assertEquals(1747253280L, info.getLastEndEpoch());
        Assertions.assertEquals(37, info.getRunNum());
        Assertions.assertEquals(2, info.getRetries());
        Assertions.assertEquals(1, info.getExitCode());
        Assertions.assertEquals("ap-xyz07", info.getRunMachine());
        Assertions.assertNotNull(info.getLastStartFormatted());
        Assertions.assertNotNull(info.getLastEndFormatted());
    }

    @Test
    void tolerantOfNullRuntimeColumns() throws Exception {
        // A WAITING job (status 7) with no run history: every runtime column is
        // SQL NULL, which rs.getObject(col, T.class) returns as Java null.
        ResultSet rs = Mockito.mock(ResultSet.class);
        when(rs.getString("job_name")).thenReturn("LOAD_COMMOD_RECON_005");
        when(rs.getString("owner")).thenReturn("svc_commod_recon");
        when(rs.getObject("status", Integer.class)).thenReturn(7);
        when(rs.getObject("next_start", Long.class)).thenReturn(1747430400L);
        when(rs.getObject("last_start", Long.class)).thenReturn(null);
        when(rs.getObject("last_end", Long.class)).thenReturn(null);
        when(rs.getObject("run_num", Integer.class)).thenReturn(null);
        when(rs.getObject("ntry", Integer.class)).thenReturn(null);
        when(rs.getObject("exit_code", Integer.class)).thenReturn(null);
        when(rs.getString("run_machine")).thenReturn(null);

        JobStatusInfo info = JobStatusService.JOB_STATUS_ROW_MAPPER.mapRow(rs, 0);

        Assertions.assertEquals(JobStatusInfo.VisualState.WAITING, info.getVisualState());
        Assertions.assertNull(info.getLastStartEpoch());
        Assertions.assertNull(info.getLastStartFormatted());
        Assertions.assertNull(info.getLastEndEpoch());
        Assertions.assertNull(info.getLastEndFormatted());
        Assertions.assertNull(info.getRunNum());
        Assertions.assertNull(info.getRetries());
        Assertions.assertNull(info.getExitCode());
        Assertions.assertNull(info.getRunMachine());
        Assertions.assertEquals("svc_commod_recon", info.getOwner());
    }

    @Test
    void mapsCompletedRowWithZeroExitCode() throws Exception {
        // A COMPLETED job (status 4) with a clean run: exit_code 0 is a real
        // value (must not be coerced to null).
        ResultSet rs = Mockito.mock(ResultSet.class);
        when(rs.getString("job_name")).thenReturn("LOAD_TRADE_RECON_001");
        when(rs.getString("owner")).thenReturn("svc_trade_recon");
        when(rs.getObject("status", Integer.class)).thenReturn(4);
        when(rs.getObject("next_start", Long.class)).thenReturn(1747084800L);
        when(rs.getObject("last_start", Long.class)).thenReturn(1746998400L);
        when(rs.getObject("last_end", Long.class)).thenReturn(1747000500L);
        when(rs.getObject("run_num", Integer.class)).thenReturn(412);
        when(rs.getObject("ntry", Integer.class)).thenReturn(0);
        when(rs.getObject("exit_code", Integer.class)).thenReturn(0);
        when(rs.getString("run_machine")).thenReturn("na-trade01");

        JobStatusInfo info = JobStatusService.JOB_STATUS_ROW_MAPPER.mapRow(rs, 0);

        Assertions.assertEquals(JobStatusInfo.VisualState.COMPLETED, info.getVisualState());
        Assertions.assertEquals(0, info.getExitCode());
        Assertions.assertEquals(0, info.getRetries());
        Assertions.assertEquals(412, info.getRunNum());
    }
}
```

- [ ] **Step 2: Run the test — characterization lock (expect PASS)**

```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer/backend/rectrace && mvn -q -Dtest=JobStatusServiceTest test
```
Expected: **PASS** — 3 tests pass (`mapsAllRuntimeColumnsAndOwner`, `tolerantOfNullRuntimeColumns`, `mapsCompletedRowWithZeroExitCode`). This is intentional, **not** a missed red gate: `JobStatusRowMapper` already exists from Task 5, so this test is the regression / characterization lock for the column→DTO mapping that the spec requires (`JobStatusServiceTest` Create). The failing-first evidence for the mapping logic was captured in Task 4 Step 2 (`JobStatusInfoTest` showed COMPILATION FAILURE before the `fromDatabase` factory existed). Do **not** rename the mapper to force an artificial red — that leaves an uncommitted source edit that Task 8's `git status --short` clean-check would flag as drift.

- [ ] **Step 3: Commit (main repo)**

```bash
git -C /Users/aarun/Workspace/Projects/autosys-job-explorer add backend/rectrace/src/test/java/com/citi/gru/rectrace/service/JobStatusServiceTest.java
git -C /Users/aarun/Workspace/Projects/autosys-job-explorer commit -m "test(backend): JobStatusServiceTest locks the runtime-column row mapping

Exercises the extracted JobStatusRowMapper against a mocked ResultSet: full row
maps all runtime fields + owner; SQL-NULL columns stay null (no run history);
exit_code 0 / retries 0 are preserved (not coerced to null); FAILED (status 5)
resolves to VisualState.FAILED.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 8: Full backend verification (main repo)

**Files:** none (verification only).

- [ ] **Step 1: Full backend test suite**

```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer/backend/rectrace && mvn -q test
```
Expected: `BUILD SUCCESS` — every suite green: the new `JobStatusInfoTest` (3), `JobStatusServiceTest` (3), the unchanged `ExecutionOrderServiceTest` (2), and all pre-existing tests. (Cosmetic `Unsafe::objectFieldOffset` Lombok/Java-21 warnings are expected and are not failures.)

- [ ] **Step 2: Confirm no source-tree drift outside the planned files**

```bash
git -C /Users/aarun/Workspace/Projects/autosys-job-explorer status --short backend/rectrace
```
Expected: clean (everything committed). If anything is unstaged, it means a step was missed — reconcile before claiming done.

- [ ] **Step 3: Confirm the sibling-repo branch is clean and committed**

```bash
git -C /Users/aarun/Workspace/Projects/rectrace-local-dev status --short && git -C /Users/aarun/Workspace/Projects/rectrace-local-dev log --oneline -3
```
Expected: clean working tree; the last two commits are the seed schema + seed data commits from Tasks 1–2.

- [ ] **Step 4: (If the stack is running) end-to-end payload check**

With the backend running against the local stack (`ops/rectrace-ops.sh start backend`, after `apply.py --oracle-only` from Task 3) and a known load job seeded, hit the endpoint and confirm the runtime fields appear:

```bash
curl -s "http://localhost:6088/rectrace/api/execution-order/RECON-XYZ-42" | python3 -m json.tool | grep -A2 -i "exitCode\|lastStart\|owner\|runMachine" | head -20
```
Expected: the JSON `jobStatuses` entries now include `lastStartEpoch`, `lastStartFormatted`, `lastEndEpoch`, `lastEndFormatted`, `exitCode`, `runNum`, `retries`, `runMachine`, `owner` (with the FAILED job showing `"exitCode": 1`). If the stack is not running, skip — the unit tests are the gating evidence.

- [ ] **Step 5: No commit** (verification only).

---

## Self-Review

**Spec §6 (Backend & data contract) coverage:**
- §6 change 1 — `JobStatusService` SELECT extended to the six runtime columns + `uj.owner`, same `LEFT JOIN` → Task 5 ✅
- §6 change 1 — `fromDatabase(...)` factory grows to thread the seven new values; `createDefaultStatus` (builder) leaves new fields null with no extra work → Task 4 (overload) + Task 5 (mapper calls it) ✅
- §6 change 1 — row mapper tolerates nulls → Task 5 (`rs.getObject(col, T.class)` returns null) + Task 7 (`tolerantOfNullRuntimeColumns`) ✅
- §6 change 2 — DTO gains `lastStartEpoch/lastStartFormatted`, `lastEndEpoch/lastEndFormatted`, `exitCode`, `runNum`, `retries`, `runMachine`, `owner`, mirroring the `nextStart*` pair → Task 4 ✅
- §6 change 2 — epoch→formatted reuses `formatNextStart` (`Instant.ofEpochSecond`, IST `ZoneId.systemDefault()`); **epochs are SECONDS**; **no duration field** (frontend derives it) → Task 4 (reuses existing formatter; nine fields, none named duration) ✅
- §6 change 3 — `ExecutionOrderService` no query change; richer DTO flows through → Task 6 (read-only confirmation + regression test) ✅
- §6 change 4 (frontend `types.ts` + `formatDuration` + `rollup`) — **out of scope for this plan** (frontend plan) — correctly excluded ✅
- §6 graceful degradation — `statusAvailable === false` path untouched; `createDefaultStatus` still produces INACTIVE with null runtime → unchanged in Task 5/6 ✅

**Spec §7 (Sibling-repo seed) coverage:**
- Schema columns: `ujo_job.owner VARCHAR2(80)`, `ujo_job_status` `last_start/last_end NUMBER(19)`, `run_num/ntry/exit_code NUMBER(10)`, `run_machine VARCHAR2(80)` → Task 1 ✅
- Data populated; formerly-ephemeral step-status rows folded into the persistent `data/02-autosys-inserts.sql` (survives `apply.py --reset` because that file is replayed every apply) → Task 2 ✅
- Status-code mapping fixed (4=COMPLETED, 5=FAILED — matches `mapStatusCodeToVisualState`); ≥1 job (joid 1004) resolves to FAILED with non-zero `exit_code` so smart-focus + "Attention — N failed" are exercisable → Task 2 ✅
- Sibling tests updated (mirrors the existing `test_schema_layout.py` string-guard style) + new `test_autosys_runtime_seed.py` → Tasks 1–2 ✅
- Separate branch in `../rectrace-local-dev` (`feature/execution-order-runtime-seed`), mirroring the Part-A pattern → Task 0 ✅

**Spec §8/§9 (backend slice) coverage:**
- §8 — `JobStatusServiceTest` (Create — did not exist) added; inline lambda extracted to a named package-private `RowMapper` for testability → Tasks 5 + 7 ✅
- §9 — backend test of the six runtime columns + owner mapping, null tolerance, not-found default path nulls (the not-found path uses `createDefaultStatus` which the builder leaves null — covered by `threeArgFactoryStillWorksAndLeavesRuntimeNull` in Task 4 and unchanged in Task 5) → Tasks 4, 7 ✅
- §9 — existing execution-order tests kept green → Task 6 + Task 8 ✅

**Sequencing:** seed/DDL+data first (Tasks 1–3, the local contract) → DTO (Task 4) → service query+mapper (Task 5) → confirm `ExecutionOrderService` unchanged (Task 6) → mapper test (Task 7) → full verification (Task 8). Matches the required order.

**Two git contexts:** sibling-repo commits (Tasks 1, 2) use `git -C /Users/aarun/Workspace/Projects/rectrace-local-dev` on `feature/execution-order-runtime-seed`; backend commits (Tasks 4, 5, 7) use `git -C /Users/aarun/Workspace/Projects/autosys-job-explorer` on `milestone/modernization`. Working directory is explicit in every commit step. ✅

**Placeholder scan:** every code step shows complete SQL/Java/Python with exact file paths; every run step has an exact command + expected output. No TBD / "similar to Task N" / hand-waving. The one nuance — Task 7's red-green ordering (the mapper is a thin adapter already TDD'd via the factory in Task 4) — is called out explicitly with a concrete "rename to force red" fallback rather than glossed over. ✅

**Contract handshake to the frontend plan:** the extended `JobStatusInfo` wire shape (nine new fields, `@JsonInclude(NON_NULL)` so null runtime fields are omitted from JSON) is defined here in Task 4; the frontend `types.ts` mirror + `formatDuration`/`rollup` helpers consume it in the separate frontend plan. Epochs are seconds; duration is NOT a backend field. ✅
