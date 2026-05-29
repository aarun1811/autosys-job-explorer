# Execution Order — Part A: Seed Schema Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the two execution-order staging tables (`autosys_tlm_recon_sequences`, `autosys_all_jobs_data`) from the `autosys` schema into the `rectrace` schema so the backend's rectrace-bound `EntityManager` can read them, fixing the `ORA-00942` that 500s the "View" button.

**Architecture:** Seed-only change in the sibling repo `../rectrace-local-dev/` (folds into the existing `feature/volume-seed-data` branch). The DDL + canonical inserts relocate from the `02-autosys` files to the `01-rectrace` files; both count maps (`apply.py EXPECTED`, `volume.expected_counts`) re-file the two tables under the rectrace key; `volume.append()` writes their generated rows on the rectrace connection. `ujo_job` / `ujo_job_status` (genuinely-live Autosys tables read via `autosysDataSource`) stay in `autosys`.

**Tech Stack:** Python 3.12, `oracledb` (thin), `pytest`, Oracle 23c Free + Elasticsearch 8.13 via the local Docker stack.

**Working directory for all tasks:** `/Users/aarun/Workspace/Projects/rectrace-local-dev`
**Branch:** `feature/volume-seed-data` (already exists; confirm checked out before starting).
**Run tests with:** `./.venv/bin/python -m pytest <path> -v`

---

### Task 1: Relocate canonical DDL + inserts to the rectrace schema

**Files:**
- Modify: `schema/02-autosys.sql` (remove the two tables' DDL)
- Modify: `schema/01-rectrace.sql` (add the two tables' DDL)
- Modify: `data/02-autosys-inserts.sql` (remove the two tables' TRUNCATE + INSERTs)
- Modify: `data/01-rectrace-inserts.sql` (add the two tables' TRUNCATE + INSERTs)
- Test: `tests/test_schema_layout.py` (new)

- [ ] **Step 1: Write the failing structural test**

Create `tests/test_schema_layout.py`:

```python
"""Structural guard: the two execution-order staging tables must live in the
rectrace schema (read by the backend's rectrace EntityManager), not autosys."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _read(rel: str) -> str:
    return (ROOT / rel).read_text().lower()


def test_exec_order_ddl_lives_in_rectrace_not_autosys():
    rectrace_ddl = _read("schema/01-rectrace.sql")
    autosys_ddl = _read("schema/02-autosys.sql")
    assert "create table autosys_tlm_recon_sequences" in rectrace_ddl
    assert "create table autosys_all_jobs_data" in rectrace_ddl
    assert "create table autosys_tlm_recon_sequences" not in autosys_ddl
    assert "create table autosys_all_jobs_data" not in autosys_ddl
    # The genuinely-live Autosys tables stay put.
    assert "create table ujo_job " in autosys_ddl
    assert "create table ujo_job_status " in autosys_ddl


def test_exec_order_inserts_live_in_rectrace_not_autosys():
    rectrace_data = _read("data/01-rectrace-inserts.sql")
    autosys_data = _read("data/02-autosys-inserts.sql")
    assert "insert into autosys_tlm_recon_sequences" in rectrace_data
    assert "insert into autosys_all_jobs_data" in rectrace_data
    assert "insert into autosys_tlm_recon_sequences" not in autosys_data
    assert "insert into autosys_all_jobs_data" not in autosys_data
    # ujo_* inserts stay in autosys.
    assert "insert into ujo_job " in autosys_data
    assert "insert into ujo_job_status " in autosys_data
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `./.venv/bin/python -m pytest tests/test_schema_layout.py -v`
Expected: FAIL — the tables are still defined/inserted under autosys.

- [ ] **Step 3: Remove the two tables' DDL from `schema/02-autosys.sql`**

Delete the four PL/SQL blocks for `autosys_tlm_recon_sequences` and `autosys_all_jobs_data` (the two `BEGIN ... DROP ... EXCEPTION ... END; /` blocks and the two `CREATE TABLE ... /` blocks — current lines 35–65). After the edit, `schema/02-autosys.sql` ends at the `ujo_job_status` CREATE block. Also update the header comment (lines 1–5) to drop the references to the two moved tables, leaving:

```sql
-- Source: ujo_job + ujo_job_status from JobStatusService.java lines 46-50 (LEFT JOIN ON joid);
--   status is Integer (line 64), next_start is Long (line 65).
-- Owned by the AUTOSYS schema user.
```

- [ ] **Step 4: Add the two tables' DDL to the end of `schema/01-rectrace.sql`**

Append (after the `loader_run_history_recent_ix` block, keeping the `\n/\n` statement-separator convention):

```sql

-- Execution-order staging tables. Despite the AUTOSYS_ name prefix (an Autosys
-- DOMAIN label), these are read by ExecutionOrderService through the rectrace
-- EntityManager (ExecutionOrderService.java:59,100), so they live in the rectrace
-- schema. The genuinely-live Autosys tables (ujo_job/ujo_job_status) stay in the
-- autosys schema and are read via autosysDataSource (JobStatusService).
BEGIN
  EXECUTE IMMEDIATE 'DROP TABLE autosys_tlm_recon_sequences CASCADE CONSTRAINTS';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -942 THEN RAISE; END IF;
END;
/

CREATE TABLE autosys_tlm_recon_sequences (
  job_name    VARCHAR2(4000),
  load_job    VARCHAR2(4000),
  exec_order  NUMBER(10)
)
/

BEGIN
  EXECUTE IMMEDIATE 'DROP TABLE autosys_all_jobs_data CASCADE CONSTRAINTS';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -942 THEN RAISE; END IF;
END;
/

CREATE TABLE autosys_all_jobs_data (
  insert_job        VARCHAR2(4000),
  job_type          VARCHAR2(64),
  machine           VARCHAR2(4000),
  run_calendar      VARCHAR2(4000),
  exclude_calendar  VARCHAR2(4000),
  box_name          VARCHAR2(4000),
  command           CLOB,
  description       CLOB
)
/
```

- [ ] **Step 5: Move the two tables' TRUNCATE + INSERTs out of `data/02-autosys-inserts.sql`**

In `data/02-autosys-inserts.sql`: delete the two `TRUNCATE TABLE autosys_tlm_recon_sequences /` and `TRUNCATE TABLE autosys_all_jobs_data /` lines (current lines 12–15), and delete every `INSERT INTO autosys_tlm_recon_sequences ...` and `INSERT INTO autosys_all_jobs_data ...` block plus their section-header comments (current lines 46–216). After the edit the file retains only: the header comment, the `ujo_job_status` + `ujo_job` truncates, and the 10 `ujo_*` INSERTs (current lines 1–44).

- [ ] **Step 6: Add the two tables' TRUNCATE + INSERTs to the end of `data/01-rectrace-inserts.sql`**

Append after the last `rectrace_core` INSERT (keep the `\n/\n` convention). This is the exact content removed in Step 5 (15 sequence rows + 20 jobs-data rows), preceded by their truncates:

```sql

-- =====================================================================
-- autosys_tlm_recon_sequences: 3 rows per scenario = 15 rows
-- chain: PRE_<load_job> (exec_order=1) -> MAIN_<load_job> (2) -> POST_<load_job> (3)
-- Relocated from data/02-autosys-inserts.sql: read via the rectrace EntityManager.
-- =====================================================================
TRUNCATE TABLE autosys_tlm_recon_sequences
/
INSERT INTO autosys_tlm_recon_sequences (job_name, load_job, exec_order) VALUES (
  'PRE_LOAD_TRADE_RECON_001', 'LOAD_TRADE_RECON_001', 1
)
/
INSERT INTO autosys_tlm_recon_sequences (job_name, load_job, exec_order) VALUES (
  'MAIN_LOAD_TRADE_RECON_001', 'LOAD_TRADE_RECON_001', 2
)
/
INSERT INTO autosys_tlm_recon_sequences (job_name, load_job, exec_order) VALUES (
  'POST_LOAD_TRADE_RECON_001', 'LOAD_TRADE_RECON_001', 3
)
/
INSERT INTO autosys_tlm_recon_sequences (job_name, load_job, exec_order) VALUES (
  'PRE-LOAD-ABC-123', 'LOAD-ABC-123', 1
)
/
INSERT INTO autosys_tlm_recon_sequences (job_name, load_job, exec_order) VALUES (
  'MAIN-LOAD-ABC-123', 'LOAD-ABC-123', 2
)
/
INSERT INTO autosys_tlm_recon_sequences (job_name, load_job, exec_order) VALUES (
  'POST-LOAD-ABC-123', 'LOAD-ABC-123', 3
)
/
INSERT INTO autosys_tlm_recon_sequences (job_name, load_job, exec_order) VALUES (
  'PRE_LOAD_FX_RECON_003', 'LOAD_FX_RECON_003', 1
)
/
INSERT INTO autosys_tlm_recon_sequences (job_name, load_job, exec_order) VALUES (
  'MAIN_LOAD_FX_RECON_003', 'LOAD_FX_RECON_003', 2
)
/
INSERT INTO autosys_tlm_recon_sequences (job_name, load_job, exec_order) VALUES (
  'POST_LOAD_FX_RECON_003', 'LOAD_FX_RECON_003', 3
)
/
INSERT INTO autosys_tlm_recon_sequences (job_name, load_job, exec_order) VALUES (
  'PRE-RECON-XYZ-42', 'RECON-XYZ-42', 1
)
/
INSERT INTO autosys_tlm_recon_sequences (job_name, load_job, exec_order) VALUES (
  'MAIN-RECON-XYZ-42', 'RECON-XYZ-42', 2
)
/
INSERT INTO autosys_tlm_recon_sequences (job_name, load_job, exec_order) VALUES (
  'POST-RECON-XYZ-42', 'RECON-XYZ-42', 3
)
/
INSERT INTO autosys_tlm_recon_sequences (job_name, load_job, exec_order) VALUES (
  'PRE_LOAD_COMMOD_RECON_005', 'LOAD_COMMOD_RECON_005', 1
)
/
INSERT INTO autosys_tlm_recon_sequences (job_name, load_job, exec_order) VALUES (
  'MAIN_LOAD_COMMOD_RECON_005', 'LOAD_COMMOD_RECON_005', 2
)
/
INSERT INTO autosys_tlm_recon_sequences (job_name, load_job, exec_order) VALUES (
  'POST_LOAD_COMMOD_RECON_005', 'LOAD_COMMOD_RECON_005', 3
)
/

-- =====================================================================
-- autosys_all_jobs_data: 4 rows per scenario = 20 rows
-- 1 BOX row (the load_job itself, command=NULL) + 3 CMD rows (PRE/MAIN/POST)
-- Relocated from data/02-autosys-inserts.sql: read via the rectrace EntityManager.
-- =====================================================================
TRUNCATE TABLE autosys_all_jobs_data
/
INSERT INTO autosys_all_jobs_data (insert_job, job_type, machine, run_calendar, exclude_calendar, box_name, command, description) VALUES (
  'LOAD_TRADE_RECON_001', 'BOX', 'na-trade01', 'DAILY_NA', 'NA_HOLIDAYS', 'BOX_TRADE_RECON_001', NULL, 'NA trade recon load box'
)
/
INSERT INTO autosys_all_jobs_data (insert_job, job_type, machine, run_calendar, exclude_calendar, box_name, command, description) VALUES (
  'PRE_LOAD_TRADE_RECON_001', 'CMD', 'na-trade01', 'DAILY_NA', 'NA_HOLIDAYS', 'BOX_TRADE_RECON_001', '/scripts/run_pre.sh', 'NA trade recon pre step'
)
/
INSERT INTO autosys_all_jobs_data (insert_job, job_type, machine, run_calendar, exclude_calendar, box_name, command, description) VALUES (
  'MAIN_LOAD_TRADE_RECON_001', 'CMD', 'na-trade01', 'DAILY_NA', 'NA_HOLIDAYS', 'BOX_TRADE_RECON_001', '/scripts/run_main.sh', 'NA trade recon main step'
)
/
INSERT INTO autosys_all_jobs_data (insert_job, job_type, machine, run_calendar, exclude_calendar, box_name, command, description) VALUES (
  'POST_LOAD_TRADE_RECON_001', 'CMD', 'na-trade01', 'DAILY_NA', 'NA_HOLIDAYS', 'BOX_TRADE_RECON_001', '/scripts/run_post.sh', 'NA trade recon post step'
)
/
INSERT INTO autosys_all_jobs_data (insert_job, job_type, machine, run_calendar, exclude_calendar, box_name, command, description) VALUES (
  'LOAD-ABC-123', 'BOX', 'emea-eq01', 'DAILY_EMEA', 'EMEA_HOLIDAYS', 'BOX-ABC-123', NULL, 'EMEA cash equities load box'
)
/
INSERT INTO autosys_all_jobs_data (insert_job, job_type, machine, run_calendar, exclude_calendar, box_name, command, description) VALUES (
  'PRE-LOAD-ABC-123', 'CMD', 'emea-eq01', 'DAILY_EMEA', 'EMEA_HOLIDAYS', 'BOX-ABC-123', '/scripts/run_pre.sh', 'EMEA cash equities pre step'
)
/
INSERT INTO autosys_all_jobs_data (insert_job, job_type, machine, run_calendar, exclude_calendar, box_name, command, description) VALUES (
  'MAIN-LOAD-ABC-123', 'CMD', 'emea-eq01', 'DAILY_EMEA', 'EMEA_HOLIDAYS', 'BOX-ABC-123', '/scripts/run_main.sh', 'EMEA cash equities main step'
)
/
INSERT INTO autosys_all_jobs_data (insert_job, job_type, machine, run_calendar, exclude_calendar, box_name, command, description) VALUES (
  'POST-LOAD-ABC-123', 'CMD', 'emea-eq01', 'DAILY_EMEA', 'EMEA_HOLIDAYS', 'BOX-ABC-123', '/scripts/run_post.sh', 'EMEA cash equities post step'
)
/
INSERT INTO autosys_all_jobs_data (insert_job, job_type, machine, run_calendar, exclude_calendar, box_name, command, description) VALUES (
  'LOAD_FX_RECON_003', 'BOX', 'apac-fx01', 'DAILY_APAC', 'APAC_HOLIDAYS', 'BOX_FX_RECON_003', NULL, 'APAC FX spot load box'
)
/
INSERT INTO autosys_all_jobs_data (insert_job, job_type, machine, run_calendar, exclude_calendar, box_name, command, description) VALUES (
  'PRE_LOAD_FX_RECON_003', 'CMD', 'apac-fx01', 'DAILY_APAC', 'APAC_HOLIDAYS', 'BOX_FX_RECON_003', '/scripts/run_pre.sh', 'APAC FX spot pre step'
)
/
INSERT INTO autosys_all_jobs_data (insert_job, job_type, machine, run_calendar, exclude_calendar, box_name, command, description) VALUES (
  'MAIN_LOAD_FX_RECON_003', 'CMD', 'apac-fx01', 'DAILY_APAC', 'APAC_HOLIDAYS', 'BOX_FX_RECON_003', '/scripts/run_main.sh', 'APAC FX spot main step'
)
/
INSERT INTO autosys_all_jobs_data (insert_job, job_type, machine, run_calendar, exclude_calendar, box_name, command, description) VALUES (
  'POST_LOAD_FX_RECON_003', 'CMD', 'apac-fx01', 'DAILY_APAC', 'APAC_HOLIDAYS', 'BOX_FX_RECON_003', '/scripts/run_post.sh', 'APAC FX spot post step'
)
/
INSERT INTO autosys_all_jobs_data (insert_job, job_type, machine, run_calendar, exclude_calendar, box_name, command, description) VALUES (
  'RECON-XYZ-42', 'BOX', 'gbl-cross01', 'DAILY_GBL', 'GLOBAL_HOLIDAYS', 'BOX-XYZ-42', NULL, 'Cross-asset recon load box'
)
/
INSERT INTO autosys_all_jobs_data (insert_job, job_type, machine, run_calendar, exclude_calendar, box_name, command, description) VALUES (
  'PRE-RECON-XYZ-42', 'CMD', 'gbl-cross01', 'DAILY_GBL', 'GLOBAL_HOLIDAYS', 'BOX-XYZ-42', '/scripts/run_pre.sh', 'Cross-asset recon pre step'
)
/
INSERT INTO autosys_all_jobs_data (insert_job, job_type, machine, run_calendar, exclude_calendar, box_name, command, description) VALUES (
  'MAIN-RECON-XYZ-42', 'CMD', 'gbl-cross01', 'DAILY_GBL', 'GLOBAL_HOLIDAYS', 'BOX-XYZ-42', '/scripts/run_main.sh', 'Cross-asset recon main step'
)
/
INSERT INTO autosys_all_jobs_data (insert_job, job_type, machine, run_calendar, exclude_calendar, box_name, command, description) VALUES (
  'POST-RECON-XYZ-42', 'CMD', 'gbl-cross01', 'DAILY_GBL', 'GLOBAL_HOLIDAYS', 'BOX-XYZ-42', '/scripts/run_post.sh', 'Cross-asset recon post step'
)
/
INSERT INTO autosys_all_jobs_data (insert_job, job_type, machine, run_calendar, exclude_calendar, box_name, command, description) VALUES (
  'LOAD_COMMOD_RECON_005', 'BOX', 'gbl-commod01', 'MONTHLY_GBL', 'GLOBAL_HOLIDAYS', 'BOX_COMMOD_RECON_005', NULL, 'Commodities monthly load box'
)
/
INSERT INTO autosys_all_jobs_data (insert_job, job_type, machine, run_calendar, exclude_calendar, box_name, command, description) VALUES (
  'PRE_LOAD_COMMOD_RECON_005', 'CMD', 'gbl-commod01', 'MONTHLY_GBL', 'GLOBAL_HOLIDAYS', 'BOX_COMMOD_RECON_005', '/scripts/run_pre.sh', 'Commodities monthly pre step'
)
/
INSERT INTO autosys_all_jobs_data (insert_job, job_type, machine, run_calendar, exclude_calendar, box_name, command, description) VALUES (
  'MAIN_LOAD_COMMOD_RECON_005', 'CMD', 'gbl-commod01', 'MONTHLY_GBL', 'GLOBAL_HOLIDAYS', 'BOX_COMMOD_RECON_005', '/scripts/run_main.sh', 'Commodities monthly main step'
)
/
INSERT INTO autosys_all_jobs_data (insert_job, job_type, machine, run_calendar, exclude_calendar, box_name, command, description) VALUES (
  'POST_LOAD_COMMOD_RECON_005', 'CMD', 'gbl-commod01', 'MONTHLY_GBL', 'GLOBAL_HOLIDAYS', 'BOX_COMMOD_RECON_005', '/scripts/run_post.sh', 'Commodities monthly post step'
)
/
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `./.venv/bin/python -m pytest tests/test_schema_layout.py -v`
Expected: PASS (2 passed).

- [ ] **Step 8: Commit**

```bash
git add schema/01-rectrace.sql schema/02-autosys.sql data/01-rectrace-inserts.sql data/02-autosys-inserts.sql tests/test_schema_layout.py
git commit -m "fix(seed): relocate execution-order tables to rectrace schema

ExecutionOrderService reads autosys_tlm_recon_sequences / autosys_all_jobs_data
via the rectrace EntityManager, but the seed created them under the autosys
schema -> ORA-00942 on the View button. Move DDL + canonical inserts to the
01-rectrace files. ujo_job/ujo_job_status stay in autosys (read via
autosysDataSource).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 2: Re-file the two tables under rectrace in both count maps

**Files:**
- Modify: `apply.py:96-116` (the `EXPECTED` dict)
- Modify: `volume.py:113-144` (`expected_counts`)
- Test: `tests/test_volume_unit.py` (add cases)

- [ ] **Step 1: Write the failing tests**

Append to `tests/test_volume_unit.py`:

```python
def test_expected_counts_files_exec_order_tables_under_rectrace():
    ec = volume.expected_counts(200_000)
    rectrace = ec[("rectrace", "RECTRACE_PWD")]
    autosys = ec[("autosys", "AUTOSYS_PWD")]
    lj = volume.load_job_count(200_000)
    assert rectrace["autosys_tlm_recon_sequences"] == 15 + lj * 3
    assert rectrace["autosys_all_jobs_data"] == 20 + lj * 4
    assert "autosys_tlm_recon_sequences" not in autosys
    assert "autosys_all_jobs_data" not in autosys
    # ujo_* volume counts stay under autosys.
    assert autosys["ujo_job"] == 5 + lj
    assert autosys["ujo_job_status"] == 5 + lj


def test_apply_expected_files_exec_order_tables_under_rectrace():
    import apply
    rectrace = apply.EXPECTED[("rectrace", "RECTRACE_PWD")]
    autosys = apply.EXPECTED[("autosys", "AUTOSYS_PWD")]
    assert rectrace["autosys_tlm_recon_sequences"] == 15
    assert rectrace["autosys_all_jobs_data"] == 20
    assert "autosys_tlm_recon_sequences" not in autosys
    assert "autosys_all_jobs_data" not in autosys
    assert autosys["ujo_job"] == 5
    assert autosys["ujo_job_status"] == 5
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `./.venv/bin/python -m pytest tests/test_volume_unit.py -k "files_exec_order" -v`
Expected: FAIL — both tables are still keyed under autosys.

- [ ] **Step 3: Move the two tables in `volume.py:expected_counts`**

Edit the `return` dict so the rectrace entry carries the two tables and the autosys entry drops them:

```python
    return {
        ("rectrace", "RECTRACE_PWD"): {
            "rectrace_core": 5 + n,
            "autosys_tlm_recon_sequences": 15 + lj * 3,
            "autosys_all_jobs_data": 20 + lj * 4,
        },
        ("autosys", "AUTOSYS_PWD"): {
            "ujo_job": 5 + lj,
            "ujo_job_status": 5 + lj,
        },
        ("reconmgmt", "RECONMGMT_PWD"): {
            "recon_bank": 5 + rc,
            "mr_csum_man_match_stats_hist": 50 + rc * TLM_DAYS,
            "mr_csum_man_match_details": 50 + rc * TLM_DAYS * DETAILS_PER_DAY,
            "mr_csum_netting_hist": 50 + rc * TLM_DAYS * DETAILS_PER_DAY,
        },
        ("recportal", "RECPORTAL_PWD"): {
            "quickrec_stats_table": 10 + rc * QUICKREC_WINDOW,
            "recportal_manual_match_table": 5 + rc,
        },
    }
```

- [ ] **Step 4: Move the two tables in `apply.py:EXPECTED`**

Edit the `EXPECTED` dict's rectrace + autosys entries:

```python
    ("rectrace",  "RECTRACE_PWD"):  {
        "rectrace_core": 5, "shedlock": 0, "loader_run_history": 0,
        "autosys_tlm_recon_sequences": 15,
        "autosys_all_jobs_data": 20,
    },
    ('autosys',   'AUTOSYS_PWD'):   {
        'ujo_job': 5,
        'ujo_job_status': 5,
    },
```

- [ ] **Step 5: Update the existing `test_expected_counts_at_200k`**

`tests/test_volume_unit.py:22-37` currently reads the two relocated tables from the autosys entry (lines 28-29: `autosys["autosys_tlm_recon_sequences"]` / `autosys["autosys_all_jobs_data"]`), so it raises `KeyError` after Step 3. Relocate those two assertions into the rectrace block. Replace the whole `test_expected_counts_at_200k` body with:

```python
def test_expected_counts_at_200k():
    ec = volume.expected_counts(200_000)
    rectrace = ec[("rectrace", "RECTRACE_PWD")]
    assert rectrace["rectrace_core"] == 5 + 200_000
    assert rectrace["autosys_tlm_recon_sequences"] == 15 + 5_000 * 3
    assert rectrace["autosys_all_jobs_data"] == 20 + 5_000 * 4
    autosys = ec[("autosys", "AUTOSYS_PWD")]
    assert autosys["ujo_job"] == 5 + 5_000
    assert autosys["ujo_job_status"] == 5 + 5_000
    assert "autosys_tlm_recon_sequences" not in autosys
    assert "autosys_all_jobs_data" not in autosys
    recon = ec[("reconmgmt", "RECONMGMT_PWD")]
    assert recon["recon_bank"] == 5 + 2_000
    assert recon["mr_csum_man_match_stats_hist"] == 50 + 2_000 * 30
    assert recon["mr_csum_man_match_details"] == 50 + 2_000 * 30 * 5
    assert recon["mr_csum_netting_hist"] == 50 + 2_000 * 30 * 5
    portal = ec[("recportal", "RECPORTAL_PWD")]
    assert portal["quickrec_stats_table"] == 10 + 2_000 * 5
    assert portal["recportal_manual_match_table"] == 5 + 2_000
```

- [ ] **Step 6: Run the new + relocated tests to verify they pass**

Run: `./.venv/bin/python -m pytest tests/test_volume_unit.py -k "files_exec_order or expected_counts_at_200k" -v`
Expected: PASS.

- [ ] **Step 7: Run the full unit suite for no regressions**

Run: `./.venv/bin/python -m pytest tests/test_volume_unit.py tests/test_schema_layout.py -v`
Expected: PASS (all green — the existing suite with `test_expected_counts_at_200k` updated, plus the new cases).

- [ ] **Step 8: Commit**

```bash
git add apply.py volume.py tests/test_volume_unit.py
git commit -m "fix(seed): count exec-order tables under rectrace in EXPECTED + expected_counts

Mirror the schema relocation in both --verify count maps so verification
checks the two tables on the rectrace connection.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 3: Route the two tables through the rectrace connection in `volume.append()`

**Files:**
- Modify: `volume.py:493-568` (`append` — the autosys block)
- Test: `tests/test_volume_unit.py` (add a routing test)

- [ ] **Step 1: Write the failing test**

Append to `tests/test_volume_unit.py`:

```python
class _RecordingCursor:
    def __init__(self, sink, schema):
        self._sink = sink
        self._schema = schema

    def executemany(self, sql, batch):
        self._sink.append((self._schema, sql))

    def execute(self, sql):
        pass  # create_indexes drop/create — irrelevant to routing

    def setinputsizes(self, **kwargs):
        pass


class _RecordingConn:
    def __init__(self, sink, schema):
        self._sink = sink
        self._schema = schema

    def cursor(self):
        return _RecordingCursor(self._sink, self._schema)

    def commit(self):
        pass


def test_append_routes_exec_order_tables_through_rectrace(monkeypatch):
    # Avoid a real ES round-trip: count the docs the generator yields.
    monkeypatch.setattr(
        volume, "es_bulk",
        lambda es, docs, **kwargs: (sum(1 for _ in docs), []),
    )
    sink = []
    conns = {s: _RecordingConn(sink, s)
             for s in ("rectrace", "autosys", "reconmgmt", "recportal")}
    volume.append(5000, conns_by_schema=conns, es=object(),
                  es_index="ix", suggest_source={})

    def schemas_for(table):
        return {schema for (schema, sql) in sink if f"INTO {table} " in sql}

    assert schemas_for("autosys_tlm_recon_sequences") == {"rectrace"}
    assert schemas_for("autosys_all_jobs_data") == {"rectrace"}
    # ujo_* still routed through autosys (trailing space disambiguates ujo_job
    # from ujo_job_status).
    assert schemas_for("ujo_job") == {"autosys"}
    assert schemas_for("ujo_job_status") == {"autosys"}
    assert schemas_for("rectrace_core") == {"rectrace"}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `./.venv/bin/python -m pytest tests/test_volume_unit.py -k "routes_exec_order" -v`
Expected: FAIL — `schemas_for("autosys_tlm_recon_sequences")` is `{"autosys"}`.

- [ ] **Step 3: Move the two `_executemany` calls onto the rectrace connection**

In `volume.py:append`, the `rc = conns_by_schema["rectrace"]` block currently inserts only `rectrace_core`. Extend it to also insert the two relocated tables, and remove them from the `au = conns_by_schema["autosys"]` block. The rectrace block becomes:

```python
    rc = conns_by_schema["rectrace"]
    report["rectrace_core"] = _executemany(
        rc, "rectrace_core", RECTRACE_CORE_COLUMNS,
        gen_core_dicts(n, recons, jobs))
    report["autosys_tlm_recon_sequences"] = _executemany(
        rc, "autosys_tlm_recon_sequences", ["job_name", "load_job", "exec_order"],
        gen_sequence_rows(jobs))
    report["autosys_all_jobs_data"] = _executemany(
        rc, "autosys_all_jobs_data",
        ["insert_job", "job_type", "machine", "run_calendar",
         "exclude_calendar", "box_name", "command", "description"],
        gen_all_jobs_rows(jobs), clob_cols=("command", "description"))
```

And the autosys block becomes (only `ujo_*` remain):

```python
    au = conns_by_schema["autosys"]
    report["ujo_job"] = _executemany(au, "ujo_job", ["joid", "job_name"],
                                      gen_ujo_job_rows(jobs))
    report["ujo_job_status"] = _executemany(
        au, "ujo_job_status", ["joid", "status", "next_start"],
        gen_ujo_job_status_rows(jobs))
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `./.venv/bin/python -m pytest tests/test_volume_unit.py -k "routes_exec_order" -v`
Expected: PASS.

- [ ] **Step 5: Run the full unit suite**

Run: `./.venv/bin/python -m pytest tests/test_volume_unit.py tests/test_schema_layout.py -v`
Expected: PASS (all green).

- [ ] **Step 6: Commit**

```bash
git add volume.py tests/test_volume_unit.py
git commit -m "fix(seed): write exec-order volume rows on the rectrace connection

volume.append() now inserts autosys_tlm_recon_sequences / autosys_all_jobs_data
through conns_by_schema['rectrace']; ujo_* stay on the autosys connection.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 4: Live end-to-end verification against the running stack

**Files:** none (verification only). Requires the Docker stack up (`docker compose up -d` in `../rectrace-local-dev/`) and the backend running on `:6088` (`mvn spring-boot:run -Dspring-boot.run.profiles=local` in `backend/rectrace`).

- [ ] **Step 1: Reset + canonical apply, then verify the baseline**

```bash
./.venv/bin/python apply.py --reset
./.venv/bin/python apply.py --verify
```
Expected: the verify table prints `rectrace.autosys_tlm_recon_sequences  15  15  ok`, `rectrace.autosys_all_jobs_data  20  20  ok`, and `autosys.ujo_job` / `autosys.ujo_job_status` at 5; all checks pass, exit 0.

- [ ] **Step 2: Confirm the rectrace connection can now read the tables**

```bash
./.venv/bin/python - <<'PY'
import oracledb
c = oracledb.connect(user="rectrace", password="rectrace_pwd", dsn="localhost:1521/FREEPDB1")
cur = c.cursor()
for t in ("autosys_tlm_recon_sequences", "autosys_all_jobs_data"):
    cur.execute(f"SELECT COUNT(*) FROM {t}")
    print(t, cur.fetchone()[0])
PY
```
Expected: `autosys_tlm_recon_sequences 15` and `autosys_all_jobs_data 20` (no ORA-00942).

- [ ] **Step 3: Hit the backend endpoint that previously 500'd**

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:6088/rectrace/api/execution-order/LOAD-ABC-123"
curl -s "http://localhost:6088/rectrace/api/execution-order/LOAD-ABC-123" | head -c 400; echo
```
Expected: HTTP `200`, and a JSON body whose `executionSequence` contains `PRE-LOAD-ABC-123`, `MAIN-LOAD-ABC-123`, `POST-LOAD-ABC-123`.

- [ ] **Step 4: Volume apply + volume-aware verify**

```bash
./.venv/bin/python apply.py --reset --volume 200000
./.venv/bin/python apply.py --verify --volume 200000
```
Expected: all checks pass (exit 0). `rectrace.autosys_tlm_recon_sequences` = `15 + load_job_count(200000)*3`, `rectrace.autosys_all_jobs_data` = `20 + load_job_count(200000)*4`, ES doc count = `5 + 200000`, and both hyphen `.keyword` probes return exactly 1.

- [ ] **Step 5: Confirm a volume-generated load job also resolves end-to-end**

```bash
./.venv/bin/python - <<'PY'
import oracledb
c = oracledb.connect(user="rectrace", password="rectrace_pwd", dsn="localhost:1521/FREEPDB1")
cur = c.cursor()
cur.execute("SELECT load_job FROM autosys_tlm_recon_sequences "
            "WHERE load_job LIKE 'LOAD%' AND ROWNUM = 1")
print(cur.fetchone()[0])
PY
```
Then `curl` the printed load job against `/rectrace/api/execution-order/<that>` and confirm HTTP 200 with a 3-node sequence. (A 404 here would indicate the controller mapping/base path, not the seed move — don't treat it as a seed BLOCKER.)

- [ ] **Step 6: No commit (verification task).** If any check fails, STOP and treat it as a `BLOCKED` status — the seed move is wrong somewhere; do not patch forward.

---

## Self-Review

**Spec coverage:**
- Move DDL `02-autosys` → `01-rectrace` → Task 1 ✅
- Move canonical inserts `02` → `01` → Task 1 ✅
- `volume.py` emits on rectrace conn → Task 3 ✅
- `apply.py` verify re-points counts → Task 2 ✅
- Verification (rectrace SELECT, counts, hyphen anchors, endpoint 200) → Task 4 ✅
- `ujo_*` stay in autosys → asserted in Tasks 1, 2, 3 ✅

**Placeholder scan:** No TBD/TODO/"handle errors" — every step has exact content or commands. ✅

**Type consistency:** Table names, schema keys (`("rectrace","RECTRACE_PWD")`), and count formulas (`15 + lj*3`, `20 + lj*4`) match across `volume.expected_counts`, `apply.EXPECTED`, and the `append()` generators. The routing test's `f"INTO {table} "` substring (trailing space) correctly disambiguates `ujo_job` from `ujo_job_status`. ✅
