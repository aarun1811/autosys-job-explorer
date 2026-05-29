# Local TLM-Instance Seed — Implementation Plan (Plan 3 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seed a local per-TLM-instance Oracle schema (the `bank`/`message_feed`/`item`/`tlm_bdr_relationship_header` tables) into `FREEPDB1`, and register it as a RecViz connection, so the TLM dashboard's dynamic-routed automatch dataset and the cross-DB merge path (set_id + 1-day) are demoable/testable locally end-to-end.

**Architecture:** The legacy TLM automatch query (`TlmStatsV2Service.buildAutomatchQuery`, lines 451-491) and breaks query (`buildBreaksQuery`, 388-448) read four tables from a per-instance TLM database. Locally those instances are unreachable. This plan creates a new Oracle schema user (`tcosprd`, the DB_NAME form of friendly instance `TLMP_CONSUMER`) owning those four tables, generates row data whose merge keys overlap the existing `reconmgmt` data (so the outer-join merge produces matched rows), and registers a `conn-tcosprd` RecViz connection that Plan 4's dynamic-routing mapping (`{TLMP_CONSUMER: conn-tcosprd}`) resolves to.

**Tech Stack:** Oracle 23c (`rectrace-local-dev` Docker stack), Python seed driver (`apply.py` + `volume.py`), RecViz seed (`seed-oracle.py`).

**Prerequisite:** Plan 1 (the recportal connection task established the RecViz-connection seed idiom). Independent of Plan 2.

**Repos & branches:**
- Seed (Tasks 1-3): `rectrace-local-dev` repo, on `feature/tlm-instance-seed`.
- RecViz connection (Task 4): RecViz repo, on `feature/tlm-dashboard` (the branch Plan 4 will use), branched off `feature/embed-foundation`.

**Spec:** §7, §12.2, §12.4.

**Column source of truth:** `rectrace-tlm-stats/.../TlmStatsV2Service.java` — `buildBreaksQuery` (388-448) and `buildAutomatchQuery` (451-491). The existing `rectrace-local-dev/schema/03-reconmgmt.sql` was authored the same way (it cites the service lines).

**Apply/verify command:** `cd /Users/aarun/Workspace/Projects/rectrace-local-dev && python apply.py --volume <N>` (idempotent driver; `--volume` triggers `volume.py` generators that actually populate the new tables — without `--volume`, only the static `data/*-inserts.sql` rows are applied). Schema-user changes require a volume wipe (`docker compose down -v` then up) per the repo's Pitfall note, because `init/01-create-schema-users.sql` only runs on first boot.

---

## File Structure

- Modify `rectrace-local-dev/init/01-create-schema-users.sql` — add the `tcosprd` user.
- Create `rectrace-local-dev/schema/05-tlm-instance.sql` — the four tables.
- Modify `rectrace-local-dev/volume.py` — add the `tcosprd` schema to `conns_by_schema` + row generators.
- Modify `rectrace-local-dev/README.md` — list the new tables (the repo documents seeded tables there).
- Modify `recviz/scripts/seed-oracle.py` — register the `conn-tcosprd` connection.

---

### Task 1: Add the TLM-instance schema user + DDL

**Files:**
- Modify `rectrace-local-dev/init/01-create-schema-users.sql`
- Create `rectrace-local-dev/schema/05-tlm-instance.sql`

- [ ] **Step 1: Create the branch**

```bash
cd /Users/aarun/Workspace/Projects/rectrace-local-dev
git checkout -b feature/tlm-instance-seed
```

- [ ] **Step 2: Add the `tcosprd` user** to `init/01-create-schema-users.sql` (after the `recportal` user, mirroring the exact pattern):

```sql
CREATE USER tcosprd IDENTIFIED BY tcosprd_pwd
  DEFAULT TABLESPACE USERS QUOTA UNLIMITED ON USERS;
GRANT CONNECT, RESOURCE TO tcosprd;
```

- [ ] **Step 3: Create `schema/05-tlm-instance.sql`** (columns derived verbatim from `TlmStatsV2Service.java` automatch/breaks queries; same drop-if-exists idiom as `03-reconmgmt.sql`):

```sql
-- Source: TlmStatsV2Service.java buildBreaksQuery (388-448) + buildAutomatchQuery (451-491).
-- Owned by the TCOSPRD schema user (DB_NAME form of friendly instance TLMP_CONSUMER).

BEGIN
  EXECUTE IMMEDIATE 'DROP TABLE bank CASCADE CONSTRAINTS';
EXCEPTION WHEN OTHERS THEN IF SQLCODE != -942 THEN RAISE; END IF;
END;
/
CREATE TABLE bank (
  agent_code    VARCHAR2(4000),
  local_acc_no  VARCHAR2(4000),
  corr_acc_no   VARCHAR2(4000)
);
/

BEGIN
  EXECUTE IMMEDIATE 'DROP TABLE message_feed CASCADE CONSTRAINTS';
EXCEPTION WHEN OTHERS THEN IF SQLCODE != -942 THEN RAISE; END IF;
END;
/
CREATE TABLE message_feed (
  mlnv             VARCHAR2(4000),
  sub_acc_no       VARCHAR2(4000),
  short_code       VARCHAR2(4000),
  latest_stmt_date DATE,
  latest_stmt_no   VARCHAR2(4000),
  corr_acc_no      VARCHAR2(4000)
);
/

BEGIN
  EXECUTE IMMEDIATE 'DROP TABLE item CASCADE CONSTRAINTS';
EXCEPTION WHEN OTHERS THEN IF SQLCODE != -942 THEN RAISE; END IF;
END;
/
CREATE TABLE item (
  corr_acc_no     VARCHAR2(4000),
  short_no        VARCHAR2(4000),
  stmt_date       DATE,
  bran_code       VARCHAR2(4000),
  flag_2          NUMBER(10),
  relationship_id VARCHAR2(4000)
);
/

BEGIN
  EXECUTE IMMEDIATE 'DROP TABLE tlm_bdr_relationship_header CASCADE CONSTRAINTS';
EXCEPTION WHEN OTHERS THEN IF SQLCODE != -942 THEN RAISE; END IF;
END;
/
CREATE TABLE tlm_bdr_relationship_header (
  relationship_id   VARCHAR2(4000),
  last_action_owner VARCHAR2(4000)
);
/
```

- [ ] **Step 4: Recreate the stack and confirm the schema/tables exist**

Run: `cd /Users/aarun/Workspace/Projects/rectrace-local-dev && docker compose down -v && docker compose up -d` (wait for healthy), then confirm:
Run: `cd /Users/aarun/Workspace/Projects/rectrace-local-dev && python -c "import oracledb; c=oracledb.connect(user='tcosprd', password='tcosprd_pwd', dsn='localhost:1521/FREEPDB1'); cur=c.cursor(); cur.execute(\"SELECT table_name FROM user_tables ORDER BY 1\"); print([r[0] for r in cur])"`
Expected: `['BANK', 'ITEM', 'MESSAGE_FEED', 'TLM_BDR_RELATIONSHIP_HEADER']`.

- [ ] **Step 5: Commit**

```bash
cd /Users/aarun/Workspace/Projects/rectrace-local-dev
git add init/01-create-schema-users.sql schema/05-tlm-instance.sql
git commit -m "feat(seed): TLM-instance schema (tcosprd) + bank/message_feed/item/relationship tables

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 2: Generate coherent row data in `volume.py`

**Files:** Modify `rectrace-local-dev/volume.py`.

The data MUST be merge-coherent: the automatch rows derivable from `bank`/`message_feed`/`item`/`tlm_bdr_relationship_header` (grouped by `agent_code, local_acc_no→setid, stmt_date, bran_code, corr_acc_no`) must share those key tuples with the existing `reconmgmt.mr_csum_man_match_details`/`mr_csum_netting_hist` manual rows, so the Plan-4 outer-join merge on `(tlm_instance, agent_code, setid, stmt_date, bran_code, corr_acc_no)` produces matched rows (not all-disjoint). Reuse the same recon/agent/set/date fixtures `gen_recon_bank` and the `mr_csum_*` generators already use.

- [ ] **Step 1: Wire `tcosprd` everywhere `apply.py` + `volume.py` enumerate schemas.** The dict at `volume.py:125-146` is **`expected_counts()`** (used by tests and volume seeding); the *real* schema list `apply.py` iterates is `SCHEMAS` (`apply.py:71-76`), with `EXPECTED` (`apply.py:96-118`) and `.env` for the password. Touch all four:

  - In `rectrace-local-dev/.env.example` add `TCOSPRD_PWD=tcosprd_pwd` (and your dev `.env`).
  - In `rectrace-local-dev/apply.py:71-76` (`SCHEMAS`), append `("tcosprd", "TCOSPRD_PWD", "05-tlm-instance")`.
  - In `rectrace-local-dev/apply.py:96-118` (`EXPECTED`), add an entry for `("tcosprd","TCOSPRD_PWD")` matching the row counts you set in `expected_counts()` below.
  - In `rectrace-local-dev/volume.py:125-146` (`expected_counts`), after the `recportal` entry add:

    ```python
            ("tcosprd", "TCOSPRD_PWD"): {
                "bank": 5 + rc,
                "message_feed": 5 + rc,
                "item": 50 + rc * TLM_DAYS * DETAILS_PER_DAY,
                "tlm_bdr_relationship_header": 5 + rc,
            },
    ```

  - Define `TCOSPRD_PWD = "tcosprd_pwd"` alongside the other `*_PWD` constants at the top of `volume.py`.
  - Create `rectrace-local-dev/data/05-tlm-instance-inserts.sql` (canonical static rows) — `apply_oracle` unconditionally reads `data/{prefix}-inserts.sql` (`apply.py:241,247`) and will fail on a missing file. Stub (matches the static-row counts encoded in `expected_counts()`'s `5/5/50/5`; uses the `TRUNCATE`+`INSERT` idiom of `data/03-reconmgmt-inserts.sql:5-12`):

    ```sql
    -- Source: TlmStatsV2Service.buildAutomatchQuery (451-491) + buildBreaksQuery (388-448).
    -- Canonical static rows for the TCOSPRD schema; volume.py adds more on --volume.
    -- Join shape: bank.corr_acc_no = message_feed.corr_acc_no = item.corr_acc_no;
    --             message_feed.short_code = item.short_no;
    --             item.relationship_id = tlm_bdr_relationship_header.relationship_id.
    -- Merge keys for Plan 4: (agent_code, local_acc_no→setid, stmt_date, bran_code, corr_acc_no).
    -- Pick the same 5 (agent_code, local_acc_no, corr_acc_no) tuples that the reconmgmt seed
    -- (TLMP_CONSUMER rows) uses so the cross-DB outer-join produces matched rows.

    TRUNCATE TABLE bank;
    TRUNCATE TABLE message_feed;
    TRUNCATE TABLE item;
    TRUNCATE TABLE tlm_bdr_relationship_header;

    -- 5 bank rows: one per recon, sharing keys with reconmgmt TLMP_CONSUMER recons.
    INSERT INTO bank (agent_code, local_acc_no, corr_acc_no) VALUES ('AGENT_NA',   'SETID_001', 'CORR_001');
    INSERT INTO bank (agent_code, local_acc_no, corr_acc_no) VALUES ('AGENT_EU',   'SETID_002', 'CORR_002');
    INSERT INTO bank (agent_code, local_acc_no, corr_acc_no) VALUES ('AGENT_APAC', 'SETID_003', 'CORR_003');
    INSERT INTO bank (agent_code, local_acc_no, corr_acc_no) VALUES ('AGENT_LATAM','SETID_004', 'CORR_004');
    INSERT INTO bank (agent_code, local_acc_no, corr_acc_no) VALUES ('AGENT_EMEA', 'SETID_005', 'CORR_005');

    -- 5 message_feed rows: one per corr_acc_no; mlnv must NOT be in '9060','9066'.
    INSERT INTO message_feed (mlnv, sub_acc_no, short_code, latest_stmt_date, latest_stmt_no, corr_acc_no)
      VALUES ('1000', 'SUB_001', 'SHORT_001', SYSDATE, 'STMT_001', 'CORR_001');
    INSERT INTO message_feed (mlnv, sub_acc_no, short_code, latest_stmt_date, latest_stmt_no, corr_acc_no)
      VALUES ('1001', 'SUB_002', 'SHORT_002', SYSDATE, 'STMT_002', 'CORR_002');
    INSERT INTO message_feed (mlnv, sub_acc_no, short_code, latest_stmt_date, latest_stmt_no, corr_acc_no)
      VALUES ('1002', 'SUB_003', 'SHORT_003', SYSDATE, 'STMT_003', 'CORR_003');
    INSERT INTO message_feed (mlnv, sub_acc_no, short_code, latest_stmt_date, latest_stmt_no, corr_acc_no)
      VALUES ('1003', 'SUB_004', 'SHORT_004', SYSDATE, 'STMT_004', 'CORR_004');
    INSERT INTO message_feed (mlnv, sub_acc_no, short_code, latest_stmt_date, latest_stmt_no, corr_acc_no)
      VALUES ('1004', 'SUB_005', 'SHORT_005', SYSDATE, 'STMT_005', 'CORR_005');

    -- 5 relationship_header rows (referenced by item.relationship_id).
    INSERT INTO tlm_bdr_relationship_header (relationship_id, last_action_owner) VALUES ('REL_001', 'SYSTEM');
    INSERT INTO tlm_bdr_relationship_header (relationship_id, last_action_owner) VALUES ('REL_002', 'AUTONET');
    INSERT INTO tlm_bdr_relationship_header (relationship_id, last_action_owner) VALUES ('REL_003', 'SYSTEM');
    INSERT INTO tlm_bdr_relationship_header (relationship_id, last_action_owner) VALUES ('REL_004', 'USER_X');
    INSERT INTO tlm_bdr_relationship_header (relationship_id, last_action_owner) VALUES ('REL_005', 'SYSTEM');

    -- 50 item rows: 10 per corr_acc_no, mixed flag_2 ∈ {0,1,11} and dates within the last 7 days.
    -- (Loop unrolled — show the pattern for CORR_001; repeat the block 4 more times with CORR_002..CORR_005.)
    INSERT INTO item (corr_acc_no, short_no, stmt_date, bran_code, flag_2, relationship_id) VALUES ('CORR_001','SHORT_001',SYSDATE  ,'BR_01',1, 'REL_001');
    INSERT INTO item (corr_acc_no, short_no, stmt_date, bran_code, flag_2, relationship_id) VALUES ('CORR_001','SHORT_001',SYSDATE-1,'BR_01',1, 'REL_001');
    INSERT INTO item (corr_acc_no, short_no, stmt_date, bran_code, flag_2, relationship_id) VALUES ('CORR_001','SHORT_001',SYSDATE-2,'BR_01',0, 'REL_001');
    INSERT INTO item (corr_acc_no, short_no, stmt_date, bran_code, flag_2, relationship_id) VALUES ('CORR_001','SHORT_001',SYSDATE-3,'BR_01',11,'REL_001');
    INSERT INTO item (corr_acc_no, short_no, stmt_date, bran_code, flag_2, relationship_id) VALUES ('CORR_001','SHORT_001',SYSDATE-4,'BR_01',1, 'REL_001');
    INSERT INTO item (corr_acc_no, short_no, stmt_date, bran_code, flag_2, relationship_id) VALUES ('CORR_001','SHORT_001',SYSDATE-5,'BR_01',1, 'REL_001');
    INSERT INTO item (corr_acc_no, short_no, stmt_date, bran_code, flag_2, relationship_id) VALUES ('CORR_001','SHORT_001',SYSDATE-6,'BR_01',0, 'REL_001');
    INSERT INTO item (corr_acc_no, short_no, stmt_date, bran_code, flag_2, relationship_id) VALUES ('CORR_001','SHORT_001',SYSDATE  ,'BR_02',1, 'REL_001');
    INSERT INTO item (corr_acc_no, short_no, stmt_date, bran_code, flag_2, relationship_id) VALUES ('CORR_001','SHORT_001',SYSDATE-1,'BR_02',1, 'REL_001');
    INSERT INTO item (corr_acc_no, short_no, stmt_date, bran_code, flag_2, relationship_id) VALUES ('CORR_001','SHORT_001',SYSDATE-2,'BR_02',0, 'REL_001');
    -- ... repeat the 10-row block for CORR_002 (relationship_id=REL_002), CORR_003 (REL_003), CORR_004 (REL_004), CORR_005 (REL_005).
    ```

    A handful of joinable rows is sufficient; volume rows come from `volume.py` when `--volume <N>` is set. **Set `EXPECTED[("tcosprd","TCOSPRD_PWD")] = {"bank": 5, "message_feed": 5, "item": 50, "tlm_bdr_relationship_header": 5}` to match these static counts**, so `expected_counts()` returns `{base + volume}` on top.

- [ ] **Step 2: Add row generators** mirroring the existing `gen_recon_bank` (`volume.py:319`) and the `mr_csum_*` generators (which already iterate the shared recon/agent/set/date fixtures). Create `gen_tlm_bank`, `gen_tlm_message_feed`, `gen_tlm_item`, `gen_tlm_relationship_header` that:
  - draw `agent_code`, `local_acc_no` (= setid), `corr_acc_no`, `stmt_date`, `bran_code` from the **same** fixture lists the `mr_csum_man_match_details` generator uses (so keys overlap);
  - set `item.flag_2` across `{0, 1, 11}` (the automatch query counts `flag_2 IN (0,1,11)` as total and `flag_2 = 1` + `last_action_owner IN ('SYSTEM','system','AUTONET')` as automatch — include both matched and break rows);
  - join consistently: `bank.corr_acc_no = message_feed.corr_acc_no = item.corr_acc_no`, `message_feed.short_code = item.short_no`, `item.relationship_id = tlm_bdr_relationship_header.relationship_id`, and `message_feed.mlnv NOT IN ('9060','9066')` for the rows that should count.

  Wire them into the `_executemany` driver block (mirror `volume.py:532-542`) and add any needed indexes to the index list (mirror `volume.py:425-427`).

  (Follow the exact generator/driver idiom of the existing functions — same `_executemany(conn, table, cols, rows)` signature and the same `conns_by_schema`-driven loop. The row *content* above is the spec; the Python plumbing mirrors the existing TLM/reconmgmt generators one-for-one.)

- [ ] **Step 2b: Normalize `tlm_instance` to a single canonical friendly name in the reconmgmt seed (D2 — the "both" reconciliation).** Today the reconmgmt seed writes placeholder `TLM1/TLM2/TLM3/TLM4/TLM5/TLM6` (`volume.py:50` constant `TLM_INSTANCES`, consumed by `gen_recon_entities` line 84 and emitted via `r.tlm_instance` from `gen_mr_stats_hist` line 338, `gen_mr_details` line 360, and `gen_mr_netting` line ~375). None of these are in `TLM_INSTANCE_MAP` (`TlmStatsV2Service.java:38-50`).

  **Scope decision (re-review):** we seed only ONE TLM-instance schema (`tcosprd`), so restrict normalization to ONE friendly name — **`TLMP_CONSUMER`** — for the rows that need to overlap with the new schema's automatch data. Other reconmgmt rows can remain (or be renamed to other real friendly names from the map: `TLMP_ASIA`, `TLMP_IND`, `TLMP_FEM`, `TLMP_FNM`, `TLMP_INT`, `TLMP_INV`, `TLMP_LAT`, `TLMP_OPS`, `TLMP_PFSS`, `TLMP_PNS`, `TLMP_SNPB` — the full set from `TlmStatsV2Service.java:38-50`), but rows tagged with anything other than `TLMP_CONSUMER` will be manual-only (no automatch partner) in Plan 4, which is acceptable for local testing.

  Recommended minimal change: change `volume.py:50` to `TLM_INSTANCES = ["TLMP_CONSUMER", "TLMP_FEM", "TLMP_OPS", "TLMP_INV", "TLMP_LAT", "TLMP_INT"]` (all real friendly names). The `r.tlm_instance` propagation through gen_mr_stats_hist / gen_mr_details / gen_mr_netting already picks from this list, so no further generator edits needed.

  In **`data/03-reconmgmt-inserts.sql`**, replace **every** literal `'TLM1'/'TLM2'/'TLM3'` across the WHOLE file (~150 occurrences across the `recon_bank`, `mr_csum_man_match_stats_hist`, `mr_csum_man_match_details`, `mr_csum_netting_hist` INSERT blocks) — not just lines 32-40. **Also touch `recon_bank.recon_engine_env` (lines 17-25)** which carries the same placeholders; without this, `recon_bank.recon_engine_env` and the `mr_csum_*.tlm_instance` columns will be inconsistent within the same recon. Use a global sed-style replacement: `TLM1 → TLMP_CONSUMER`, `TLM2 → TLMP_FEM`, `TLM3 → TLMP_OPS` (matches the first 3 entries in the new `TLM_INSTANCES` list).

  Plan 4 will additionally normalize on the dataset-SQL read side (belt-and-braces). **This Step 2b is the seed-side half** of the "Both" reconciliation.

- [ ] **Step 3: Update `README.md`** to include the new TCOSPRD schema + four tables. Touch all three places that count: the seeded-tables list (~lines 78-80), the `--verify`-block table count (~line 76, currently "11 expected tables"), and the schema/table summary (~line 155, currently "4 schemas, 11 tables"). New numbers: 5 schemas, 15 tables.

- [ ] **Step 4: Apply (with volume) and verify data + merge-key overlap**

Run: `cd /Users/aarun/Workspace/Projects/rectrace-local-dev && python apply.py --volume 10`
Expected: completes; report shows non-zero row counts for the four new tables.

Verify automatch produces grouped rows AND keys overlap reconmgmt manual rows:
Run: `cd /Users/aarun/Workspace/Projects/rectrace-local-dev && python -c "import oracledb; c=oracledb.connect(user='tcosprd',password='tcosprd_pwd',dsn='localhost:1521/FREEPDB1'); cur=c.cursor(); cur.execute('SELECT COUNT(*) FROM bank'); print('bank', cur.fetchone()[0]); cur.execute('SELECT COUNT(*) FROM item'); print('item', cur.fetchone()[0])"`
Expected: non-zero counts.

(Full merge-overlap verification happens in Plan 4 when the automatch dataset + merge panel exist; this step confirms the data is present and joinable.)

- [ ] **Step 5: Commit**

```bash
cd /Users/aarun/Workspace/Projects/rectrace-local-dev
git add volume.py README.md
git commit -m "feat(seed): generate merge-coherent TLM-instance volume data

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 3: Seed tests (if the repo has them)

**Files:** `rectrace-local-dev/tests/` (the repo has a `tests/` dir + `conftest.py`).

- [ ] **Step 1: Mirror `test_volume_integration.py`** (the live-stack integration test, NOT `test_autosys_runtime_seed.py` which is a string-level SQL guard with no DB). The volume test auto-iterates `expected_counts()`, so once Task 2 wires `tcosprd` into that dict, `test_volume_apply_produces_expected_counts` exercises the new tables for free. Add a focused `test_tlm_instance_seeded_merge_overlap` that connects as `tcosprd`, asserts each of the four tables has rows, and that at least one `(agent_code, local_acc_no, stmt_date, bran_code, corr_acc_no)` tuple from `bank`⋈`item` also exists in `reconmgmt.mr_csum_man_match_details` with the matching `tlm_instance = 'TLMP_CONSUMER'` (the merge-overlap + tlm_instance normalization guarantee from Step 2b).

- [ ] **Step 2: Run the seed tests**

Run: `cd /Users/aarun/Workspace/Projects/rectrace-local-dev && python -m pytest tests/ -v`
Expected: pass (including the new test).

- [ ] **Step 3: Commit**

```bash
cd /Users/aarun/Workspace/Projects/rectrace-local-dev
git add tests/
git commit -m "test(seed): assert TLM-instance data seeded + merge-key overlap with reconmgmt

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 4: Register the `conn-tcosprd` RecViz connection

**Files:** Modify `recviz/scripts/seed-oracle.py` (`seed_connection`).

- [ ] **Step 1: Create/switch to the TLM-dashboard RecViz branch**

```bash
cd /Users/aarun/Workspace/Projects/recviz
git checkout feature/embed-foundation
git checkout -b feature/tlm-dashboard
```

- [ ] **Step 2: Add the connection** to `seed_connection` (mirror the `recportal` insert added in Plan 1 Task 8; schema owner `TCOSPRD`, password from `rectrace-local-dev`):

```python
    cur.execute(
        "INSERT INTO recviz_connections "
        "(id, name, display_name, backend, host, port, database_name, username, "
        "encrypted_password, schema_name, status, extra_params, created_at, updated_at) "
        "VALUES (:1, :2, :3, 'oracle', 'localhost', 1521, :4, :5, :6, :7, 'active', :8, "
        "SYSTIMESTAMP, SYSTIMESTAMP)",
        (
            "conn-tcosprd", "tcosprd", "TLMP_CONSUMER (TCOSPRD)",
            "FREEPDB1", "tcosprd", _encrypt("tcosprd_pwd"), "TCOSPRD",
            _jb({"timeout": 30}),
        ),
    )
```

(`conn-tcosprd` is the id Plan 4's `tlm_automatch` dynamic-routing mapping references: `{"TLMP_CONSUMER": "conn-tcosprd"}`.)

- [ ] **Step 3: Re-seed RecViz and verify the connection introspects the TLM tables**

Run: `cd /Users/aarun/Workspace/Projects/recviz/backend && PYTHONPATH=. python ../scripts/seed-oracle.py`
With the server up:
Run: `curl -s "http://localhost:8000/api/databases/conn-tcosprd/tables" | python -c "import sys,json; t=json.load(sys.stdin); names=[x.lower() for x in (t if isinstance(t,list) else t.get('tables',[]))]; print(all(n in names for n in ['bank','item','message_feed','tlm_bdr_relationship_header']))"`
Expected: `True`.

- [ ] **Step 4: Commit**

```bash
cd /Users/aarun/Workspace/Projects/recviz
git add scripts/seed-oracle.py
git commit -m "feat(seed): register conn-tcosprd TLM-instance connection for dynamic routing

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Done criteria for Plan 3

- A `tcosprd` schema owns `bank`/`message_feed`/`item`/`tlm_bdr_relationship_header` in `FREEPDB1` with merge-coherent data (keys overlap `reconmgmt` manual rows).
- `conn-tcosprd` RecViz connection exists and can introspect those tables.
- Seed test asserts data + merge-key overlap.
- Seed commits on `feature/tlm-instance-seed`; the RecViz connection on `feature/tlm-dashboard`.

This unblocks **Plan 4 (TLM dashboard)** — whose `tlm_automatch` dataset dynamic-routes to `conn-tcosprd` and merges with the reconmgmt manual dataset.

## Self-review notes
- **Spec coverage:** §7 (Tasks 1-2 tables + data), §12.4 data-freshness/merge-coherence (Task 2 key overlap + Task 3 test), §12.2/§12.5 connection + friendly↔DB_NAME (Task 4: `conn-tcosprd` = DB_NAME `TCOSPRD` ↔ friendly `TLMP_CONSUMER`).
- **DDL exactness:** all four tables' columns are taken verbatim from `buildBreaksQuery`/`buildAutomatchQuery` (cited). `flag_2` is `NUMBER` because the query compares it to integers; dates are `DATE`; everything else `VARCHAR2(4000)` per the repo's `03-reconmgmt.sql` convention.
- **Verify-at-execution flags (not placeholders):** the `volume.py` generator functions mirror the existing `gen_*`/`_executemany` idiom (Task 2 specifies the row *content* + join coherence, which is the non-obvious part; the Python plumbing is a one-for-one mirror). `_encrypt`/`_jb` names + the local `tcosprd` password are confirmed against the seed/`init` at execution.
