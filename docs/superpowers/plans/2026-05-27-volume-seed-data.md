# Volume Seed Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in `apply.py --volume [N]` path that deterministically generates a large, coherent volume of seed data across all four Oracle schemas + Elasticsearch, so the Rectrace React search surface and the TLM/QuickRec modals can be evaluated at scale.

**Architecture:** A new focused module `volume.py` holds value pools, deterministic entity generators (recon spine, load-job spine, core rows, downstream rows), pure SQL builders, and an append layer (`executemany` + `helpers.bulk` + idempotent index DDL). `apply.py` gains a `--volume` arg that runs the normal canonical apply first, then calls `volume.append(...)`. The volume multiplier functions live once in `volume.py` and are imported by both the generator and `apply.py`'s `verify()`. Generation uses a fixed RNG seed (determinism) and parameterized binds (no dynamic SQL).

**Tech Stack:** Python 3.12, `oracledb` 4.x (thin), `elasticsearch` 8.13, `python-dotenv`, `pytest` (added by Task 1). Live Oracle 23c Free + ES 8.13 stack on localhost.

**Repo:** All code in sibling repo `/Users/aarun/Workspace/Projects/rectrace-local-dev/` on branch `feature/volume-seed-data`. Run all `git` commands with `git -C /Users/aarun/Workspace/Projects/rectrace-local-dev` to avoid committing to the wrong repo. Run all python/pytest with the repo venv: `/Users/aarun/Workspace/Projects/rectrace-local-dev/.venv/bin/python` and `.../.venv/bin/pytest`.

**Spec:** `/Users/aarun/Workspace/Projects/autosys-job-explorer/docs/superpowers/specs/2026-05-27-volume-seed-data-design.md`

**Key reference facts (verified):**
- `rectrace_core` columns, in schema order (`schema/01-rectrace.sql`): `file_name_pattern, ok_file_name, job_name, recon_engine, app_name, app_id, support_email, support_hotline, receive_path, recon, set_id, sub_acc, load_job, box_name, load_file_name, load_file_name_pattern, tlm_instance, machine, run_calendar, exclude_calendar, recon_id, recon_portal_id`.
- `ujo_job(joid NUMBER, job_name VARCHAR2)`; `ujo_job_status(joid NUMBER, status NUMBER, next_start NUMBER)`.
- `autosys_tlm_recon_sequences(job_name, load_job, exec_order NUMBER)`.
- `autosys_all_jobs_data(insert_job, job_type VARCHAR2(64), machine, run_calendar, exclude_calendar, box_name, command CLOB, description CLOB)`.
- `recon_bank(agent_code, local_acc_no, recon_engine_env, recon_engine, corr_acc_no)`.
- `mr_csum_man_match_stats_hist(tlm_instance, agent_code, setid, stmt_date DATE, bran_code, corr_acc_no, total_item NUMBER, automatch_items NUMBER, manualmatch_items NUMBER)`.
- `mr_csum_man_match_details(agent_code, setid, corr_acc_no, bran_code, tlm_instance, stmt_date DATE)`.
- `mr_csum_netting_hist(agent_code, local_acc_no, corr_acc_no, bran_code, tlm_instance, stmt_date DATE)`.
- `quickrec_stats_table(reconname, recon_id, rec_portal_id, left_record_count, right_record_count, left_break_count, right_break_count, left_match_count, right_match_count, load_date DATE)`.
- `recportal_manual_match_table(rec_portal_id, cob DATE, updated_date DATE, left_manual_matches NUMBER, right_manual_matches NUMBER)`.
- Env (`.env.example`): `ORACLE_DSN=localhost:1521/FREEPDB1`, `ORACLE_PASSWORD=oracle`, `RECTRACE_PWD=rectrace_pwd`, `AUTOSYS_PWD=autosys_pwd`, `RECONMGMT_PWD=reconmgmt_pwd`, `RECPORTAL_PWD=recportal_pwd`, `ES_URL=http://localhost:9200`.
- apply.py constants reused by volume: `ES_INDEX = "rectrace_core_index"`, `SCHEMAS` list, the `suggest_source` map (currently local to `apply_elasticsearch`).
- Canonical reserved joids: `1001..1005`. Volume joids start at `100000`.

---

## File Structure

- **Create `volume.py`** — one cohesive module (matches the repo's single-file `apply.py` style). Sections: constants & reserved set; multiplier functions; value pools; entity dataclasses; generators; ES doc adapter; SQL builders; append layer (Oracle + indexes + ES). Public surface consumed by `apply.py`: `DEFAULT_VOLUME`, `RNG_SEED`, `expected_counts(n)`, `expected_es_count(n)`, `append(...)`.
- **Modify `apply.py`** — add `--volume` arg; volume phase after apply; volume-aware `verify()`. Extract the inline `suggest_source` dict in `apply_elasticsearch` to a module-level `SUGGEST_SOURCE` constant so both `apply_elasticsearch` and the volume phase use one source of truth.
- **Create `tests/test_volume_unit.py`** — pure, DB-free unit tests (Tasks 1–6).
- **Create `tests/test_volume_integration.py`** — live-stack integration tests (Task 7).
- **Modify `requirements.txt`** — add `pytest`.
- **Modify `README.md`, `data/scenarios.md`** — document the flag (Task 8).

---

### Task 1: Test tooling + module skeleton + multiplier math

**Files:**
- Modify: `requirements.txt`
- Create: `volume.py`
- Create: `tests/test_volume_unit.py`

- [ ] **Step 1: Add pytest to requirements and install**

Append to `requirements.txt`:
```
pytest>=8,<9
```
Run: `/Users/aarun/Workspace/Projects/rectrace-local-dev/.venv/bin/pip install 'pytest>=8,<9'`
Expected: pytest installs successfully.

- [ ] **Step 2: Write the failing test**

Create `tests/test_volume_unit.py`:
```python
import volume


def test_default_volume():
    assert volume.DEFAULT_VOLUME == 200_000


def test_cardinality_floors():
    # small N still yields usable cardinalities
    assert volume.recon_count(100) == 50
    assert volume.load_job_count(100) == 50


def test_cardinalities_at_200k():
    assert volume.recon_count(200_000) == 2_000
    assert volume.load_job_count(200_000) == 5_000


def test_expected_counts_at_200k():
    ec = volume.expected_counts(200_000)
    assert ec[("rectrace", "RECTRACE_PWD")]["rectrace_core"] == 5 + 200_000
    autosys = ec[("autosys", "AUTOSYS_PWD")]
    assert autosys["ujo_job"] == 5 + 5_000
    assert autosys["ujo_job_status"] == 5 + 5_000
    assert autosys["autosys_tlm_recon_sequences"] == 15 + 5_000 * 3
    assert autosys["autosys_all_jobs_data"] == 20 + 5_000 * 4
    recon = ec[("reconmgmt", "RECONMGMT_PWD")]
    assert recon["recon_bank"] == 5 + 2_000
    assert recon["mr_csum_man_match_stats_hist"] == 50 + 2_000 * 30
    assert recon["mr_csum_man_match_details"] == 50 + 2_000 * 30 * 5
    assert recon["mr_csum_netting_hist"] == 50 + 2_000 * 30 * 5
    portal = ec[("recportal", "RECPORTAL_PWD")]
    assert portal["quickrec_stats_table"] == 10 + 2_000 * 5
    assert portal["recportal_manual_match_table"] == 5 + 2_000


def test_expected_es_count():
    assert volume.expected_es_count(200_000) == 5 + 200_000
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd /Users/aarun/Workspace/Projects/rectrace-local-dev && .venv/bin/pytest tests/test_volume_unit.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'volume'`.

- [ ] **Step 4: Write minimal implementation**

Create `volume.py`:
```python
"""
volume.py — opt-in, deterministic large-volume seed generator for the rectrace
local-dev stack. Imported by apply.py when `--volume [N]` is passed.

Generates coherent synthetic entities (recon spine + load-job spine) and fans
related rows across all four Oracle schemas + Elasticsearch. All generation is
seeded (RNG_SEED) for byte-identical re-runs, uses parameterized binds (no
dynamic SQL), and is hard-blocked from emitting any of the 5 canonical anchor
identifiers so the hyphen-search regression probes stay exact.

Multiplier functions are the single source of truth for both generation and
apply.py's volume-aware --verify.
"""
from __future__ import annotations

RNG_SEED = 20260527
DEFAULT_VOLUME = 200_000

# Per-recon date-window depth and fan-out for the heavy TLM/quickrec tables.
TLM_DAYS = 30
DETAILS_PER_DAY = 5
QUICKREC_WINDOW = 5


def recon_count(n: int) -> int:
    """Distinct recon entities. ~1 recon per 100 core rows; floor 50."""
    return max(50, n // 100)


def load_job_count(n: int) -> int:
    """Distinct load-jobs (shared across core rows). ~1 per 40 rows; floor 50."""
    return max(50, n // 40)


def expected_counts(n: int) -> dict:
    """Total expected Oracle row counts after a `--volume N` apply: canonical
    base + the volume delta this module appends. Keyed (schema, pwd_env) to
    match apply.py's EXPECTED structure so verify() can merge them."""
    rc = recon_count(n)
    lj = load_job_count(n)
    return {
        ("rectrace", "RECTRACE_PWD"): {"rectrace_core": 5 + n},
        ("autosys", "AUTOSYS_PWD"): {
            "ujo_job": 5 + lj,
            "ujo_job_status": 5 + lj,
            "autosys_tlm_recon_sequences": 15 + lj * 3,
            "autosys_all_jobs_data": 20 + lj * 4,
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


def expected_es_count(n: int) -> int:
    return 5 + n
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Users/aarun/Workspace/Projects/rectrace-local-dev && .venv/bin/pytest tests/test_volume_unit.py -q`
Expected: PASS (5 passed).

- [ ] **Step 6: Commit**

```bash
git -C /Users/aarun/Workspace/Projects/rectrace-local-dev add requirements.txt volume.py tests/test_volume_unit.py
git -C /Users/aarun/Workspace/Projects/rectrace-local-dev commit -m "feat(volume): test tooling + multiplier math for volume seed

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 2: Reserved-identifier set + value pools + recon entity generator

**Files:**
- Modify: `volume.py`
- Modify: `tests/test_volume_unit.py`

- [ ] **Step 1: Write the failing test**

Append to `tests/test_volume_unit.py`:
```python
import random


def test_reserved_identifiers_include_anchors():
    for ident in ["SET-ABC-123", "RECON-XYZ-42", "LOAD-ABC-123",
                  "SAMPLE_TRADE_RECON_001", "TRADE_RECON_NA", "RID-ABC-123"]:
        assert ident in volume.RESERVED_IDENTIFIERS


def test_gen_recon_entities_count_and_determinism():
    a = volume.gen_recon_entities(20_000, random.Random(volume.RNG_SEED))
    b = volume.gen_recon_entities(20_000, random.Random(volume.RNG_SEED))
    assert len(a) == volume.recon_count(20_000)
    assert [e.recon for e in a] == [e.recon for e in b]  # deterministic
    assert [e.recon_id for e in a] == [e.recon_id for e in b]


def test_gen_recon_entities_unique_and_clean():
    recons = volume.gen_recon_entities(20_000, random.Random(volume.RNG_SEED))
    names = [e.recon for e in recons]
    assert len(set(names)) == len(names)  # recon names unique
    rids = [e.recon_id for e in recons]
    assert len(set(rids)) == len(rids)  # recon_id unique
    for e in recons:
        for field in (e.recon, e.recon_id, e.recon_portal_id, e.agent_code):
            assert field not in volume.RESERVED_IDENTIFIERS
        assert e.agent_code == e.recon
        assert e.tlm_instance in volume.TLM_INSTANCES


def test_gen_recon_entities_has_hyphenated_subset():
    recons = volume.gen_recon_entities(20_000, random.Random(volume.RNG_SEED))
    hyphenated = [e for e in recons if "-" in e.recon]
    # roughly a third are hyphenated; assert a healthy non-trivial fraction
    assert 0.15 < len(hyphenated) / len(recons) < 0.55
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/aarun/Workspace/Projects/rectrace-local-dev && .venv/bin/pytest tests/test_volume_unit.py -q`
Expected: FAIL — `AttributeError: module 'volume' has no attribute 'RESERVED_IDENTIFIERS'`.

- [ ] **Step 3: Write minimal implementation**

Add to `volume.py` (after the constants block, before `recon_count`):
```python
import random
from dataclasses import dataclass

# The 5 canonical anchor identifiers across all categories. The generator must
# never emit any of these so the hyphen-search regression probes stay exact
# (apply.py --verify expects exactly 1 hit each).
RESERVED_IDENTIFIERS = frozenset({
    "SAMPLE_TRADE_RECON_001", "LOAD-ABC-123", "SAMPLE_FX_RECON_003",
    "RECON-XYZ-42", "SAMPLE_COMMOD_RECON_005",
    "LOAD_TRADE_RECON_001", "LOAD_FX_RECON_003", "LOAD_COMMOD_RECON_005",
    "SETID_001", "SET-ABC-123", "SETID_003", "SET-XYZ-42", "SETID_005",
    "TRADE_RECON_NA", "RECON-XYZ-CASH", "FX_SPOT_APAC", "CROSS_ASSET_GBL", "COMMOD_MONTHLY",
    "RID-001-NA", "RID-ABC-123", "RID-003-APAC", "RID-XYZ-42", "RID-005-COMMOD",
    "RPID-001-NA", "RPID-ABC-123", "RPID-003-APAC", "RPID-XYZ-42", "RPID-005-COMMOD",
    "BOX_TRADE_RECON_001", "BOX-ABC-123", "BOX_FX_RECON_003", "BOX-XYZ-42", "BOX_COMMOD_RECON_005",
})

# Fictional value pools (no real Citi terminology, per data/scenarios.md).
REGIONS = ["NA", "EMEA", "APAC", "LATAM", "GBL"]
THEMES = ["TRADE", "FX_SPOT", "FX_FWD", "COMMOD", "CROSS_ASSET", "RATES",
          "CREDIT", "EQUITY", "REPO", "MM", "OTC", "LISTED_DERIV"]
RECON_ENGINES = ["TLM", "TLM", "TLM", "GENERIC_ENGINE"]  # TLM dominant
TLM_INSTANCES = ["TLM1", "TLM2", "TLM3", "TLM4", "TLM5", "TLM6"]
REGION_DIAL = {"NA": "1", "EMEA": "44", "APAC": "65", "LATAM": "55", "GBL": "1"}


@dataclass(frozen=True)
class ReconEntity:
    recon: str
    recon_id: str
    recon_portal_id: str
    recon_engine: str
    tlm_instance: str
    agent_code: str  # == recon
    region: str
    theme: str
    seq: int  # 1-based ordinal, used to build stable unique identifiers


def _clean(*values, rng: random.Random) -> bool:
    """True iff none of the values collide with a reserved anchor."""
    return all(v not in RESERVED_IDENTIFIERS for v in values)


def gen_recon_entities(n: int, rng: random.Random) -> list:
    """recon_count(n) distinct, deterministic recon entities. ~1/3 hyphenated.

    Identifiers are built from a stable ordinal so uniqueness is guaranteed by
    construction; the RNG only chooses region/theme/engine/instance attributes.
    """
    count = recon_count(n)
    entities = []
    for i in range(1, count + 1):
        region = rng.choice(REGIONS)
        theme = rng.choice(THEMES)
        engine = rng.choice(RECON_ENGINES)
        instance = rng.choice(TLM_INSTANCES)
        hyphenated = rng.random() < 0.33
        if hyphenated:
            recon = f"RECON-{theme}-{region}-{i:06d}".replace("_", "-")
            recon_id = f"RID-{region}-{i:06d}"
            portal_id = f"RPID-{region}-{i:06d}"
        else:
            recon = f"{theme}_RECON_{region}_{i:06d}"
            recon_id = f"RID_{region}_{i:06d}"
            portal_id = f"RPID_{region}_{i:06d}"
        assert _clean(recon, recon_id, portal_id, rng=rng), recon
        entities.append(ReconEntity(
            recon=recon, recon_id=recon_id, recon_portal_id=portal_id,
            recon_engine=engine, tlm_instance=instance, agent_code=recon,
            region=region, theme=theme, seq=i,
        ))
    return entities
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/aarun/Workspace/Projects/rectrace-local-dev && .venv/bin/pytest tests/test_volume_unit.py -q`
Expected: PASS (9 passed).

- [ ] **Step 5: Commit**

```bash
git -C /Users/aarun/Workspace/Projects/rectrace-local-dev add volume.py tests/test_volume_unit.py
git -C /Users/aarun/Workspace/Projects/rectrace-local-dev commit -m "feat(volume): reserved-id set, value pools, recon entity generator

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 3: Load-job spine + autosys row generators

**Files:**
- Modify: `volume.py`
- Modify: `tests/test_volume_unit.py`

- [ ] **Step 1: Write the failing test**

Append to `tests/test_volume_unit.py`:
```python
def _recons(n=20_000):
    return volume.gen_recon_entities(n, random.Random(volume.RNG_SEED))


def test_gen_load_jobs_count_unique_clean():
    recons = _recons()
    jobs = volume.gen_load_jobs(20_000, recons)
    assert len(jobs) == volume.load_job_count(20_000)
    assert len({j.load_job for j in jobs}) == len(jobs)
    assert len({j.joid for j in jobs}) == len(jobs)
    for j in jobs:
        assert j.joid >= 100_000  # never clashes with canonical 1001..1005
        assert j.load_job not in volume.RESERVED_IDENTIFIERS
        assert j.box_name not in volume.RESERVED_IDENTIFIERS
        assert j.status in {1, 2, 3, 4, 5, 7}
        assert j.recon in {r.recon for r in recons}


def test_gen_ujo_rows():
    recons = _recons()
    jobs = volume.gen_load_jobs(20_000, recons)
    ujo = list(volume.gen_ujo_job_rows(jobs))
    ujo_status = list(volume.gen_ujo_job_status_rows(jobs))
    assert len(ujo) == len(jobs)
    assert len(ujo_status) == len(jobs)
    assert set(ujo[0].keys()) == {"joid", "job_name"}
    assert set(ujo_status[0].keys()) == {"joid", "status", "next_start"}


def test_gen_sequence_rows_is_three_step_chain():
    recons = _recons()
    jobs = volume.gen_load_jobs(20_000, recons)
    seqs = list(volume.gen_sequence_rows(jobs))
    assert len(seqs) == len(jobs) * 3
    first_three = seqs[:3]
    assert [s["exec_order"] for s in first_three] == [1, 2, 3]
    assert first_three[0]["job_name"].startswith("PRE")
    assert first_three[1]["job_name"].startswith("MAIN")
    assert first_three[2]["job_name"].startswith("POST")
    assert all(s["load_job"] == first_three[0]["load_job"] for s in first_three)


def test_gen_all_jobs_rows_box_plus_three_cmd():
    recons = _recons()
    jobs = volume.gen_load_jobs(20_000, recons)
    rows = list(volume.gen_all_jobs_rows(jobs))
    assert len(rows) == len(jobs) * 4
    block = rows[:4]
    assert block[0]["job_type"] == "BOX"
    assert [r["job_type"] for r in block[1:]] == ["CMD", "CMD", "CMD"]
    assert all(r["box_name"] == block[0]["insert_job"] for r in block[1:])
    assert set(rows[0].keys()) == {
        "insert_job", "job_type", "machine", "run_calendar",
        "exclude_calendar", "box_name", "command", "description"}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/aarun/Workspace/Projects/rectrace-local-dev && .venv/bin/pytest tests/test_volume_unit.py -q`
Expected: FAIL — `AttributeError: module 'volume' has no attribute 'gen_load_jobs'`.

- [ ] **Step 3: Write minimal implementation**

Add to `volume.py`:
```python
STATUS_MIX = [1, 1, 1, 2, 4, 3, 5, 7]  # SUCCESS-heavy, all states represented
JOID_BASE = 100_000


@dataclass(frozen=True)
class LoadJob:
    load_job: str
    box_name: str
    recon: str
    joid: int
    status: int
    next_start: int
    machine: str
    run_calendar: str
    exclude_calendar: str


def gen_load_jobs(n: int, recons: list) -> list:
    """load_job_count(n) distinct load-jobs, each tied to a recon (round-robin
    so every recon gets jobs). Fully deterministic from the ordinal `i` (no rng)."""
    count = load_job_count(n)
    jobs = []
    for i in range(1, count + 1):
        recon = recons[(i - 1) % len(recons)]
        hyphenated = "-" in recon.recon
        if hyphenated:
            load_job = f"LOAD-{recon.theme}-{recon.region}-{i:06d}".replace("_", "-")
            box_name = f"BOX-{recon.theme}-{recon.region}-{i:06d}".replace("_", "-")
        else:
            load_job = f"LOAD_{recon.theme}_{recon.region}_{i:06d}"
            box_name = f"BOX_{recon.theme}_{recon.region}_{i:06d}"
        assert load_job not in RESERVED_IDENTIFIERS and box_name not in RESERVED_IDENTIFIERS
        status = STATUS_MIX[(i - 1) % len(STATUS_MIX)]
        machine = f"{recon.region.lower()}-{recon.theme.lower().replace('_', '')}{i % 90 + 1:02d}"
        jobs.append(LoadJob(
            load_job=load_job, box_name=box_name, recon=recon.recon,
            joid=JOID_BASE + i, status=status,
            next_start=1_747_000_000 + i * 60,
            machine=machine,
            run_calendar=f"DAILY_{recon.region}",
            exclude_calendar=f"{recon.region}_HOLIDAYS",
        ))
    return jobs


def gen_ujo_job_rows(jobs: list):
    for j in jobs:
        yield {"joid": j.joid, "job_name": j.load_job}


def gen_ujo_job_status_rows(jobs: list):
    for j in jobs:
        yield {"joid": j.joid, "status": j.status, "next_start": j.next_start}


def gen_sequence_rows(jobs: list):
    """3-row PRE/MAIN/POST chain per load-job (exec_order 1/2/3)."""
    for j in jobs:
        for order, prefix in ((1, "PRE"), (2, "MAIN"), (3, "POST")):
            sep = "-" if "-" in j.load_job else "_"
            yield {
                "job_name": f"{prefix}{sep}{j.load_job}",
                "load_job": j.load_job,
                "exec_order": order,
            }


def gen_all_jobs_rows(jobs: list):
    """1 BOX row (the load_job) + 3 CMD rows per load-job."""
    for j in jobs:
        yield {
            "insert_job": j.load_job, "job_type": "BOX", "machine": j.machine,
            "run_calendar": j.run_calendar, "exclude_calendar": j.exclude_calendar,
            "box_name": "", "command": "",
            "description": f"Box job for {j.recon}",
        }
        for step in ("PRE", "MAIN", "POST"):
            sep = "-" if "-" in j.load_job else "_"
            yield {
                "insert_job": f"{step}{sep}{j.load_job}", "job_type": "CMD",
                "machine": j.machine, "run_calendar": j.run_calendar,
                "exclude_calendar": j.exclude_calendar, "box_name": j.load_job,
                "command": f"/apps/recon/bin/{step.lower()}_load.sh {j.recon}",
                "description": f"{step} step for {j.load_job}",
            }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/aarun/Workspace/Projects/rectrace-local-dev && .venv/bin/pytest tests/test_volume_unit.py -q`
Expected: PASS (13 passed).

- [ ] **Step 5: Commit**

```bash
git -C /Users/aarun/Workspace/Projects/rectrace-local-dev add volume.py tests/test_volume_unit.py
git -C /Users/aarun/Workspace/Projects/rectrace-local-dev commit -m "feat(volume): load-job spine + autosys row generators

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 4: rectrace_core row generator + ES doc adapter

**Files:**
- Modify: `volume.py`
- Modify: `tests/test_volume_unit.py`

- [ ] **Step 1: Write the failing test**

Append to `tests/test_volume_unit.py`:
```python
def test_gen_core_dicts_count_and_keys():
    recons = _recons()
    jobs = volume.gen_load_jobs(20_000, recons)
    rows = list(volume.gen_core_dicts(20_000, recons, jobs))
    assert len(rows) == 20_000
    assert set(rows[0].keys()) == set(volume.RECTRACE_CORE_COLUMNS)


def test_gen_core_dicts_unique_jobnames_and_coherent_refs():
    recons = _recons()
    jobs = volume.gen_load_jobs(20_000, recons)
    rows = list(volume.gen_core_dicts(20_000, recons, jobs))
    job_names = [r["job_name"] for r in rows]
    assert len(set(job_names)) == len(job_names)  # ES _id uniqueness
    valid_recons = {r.recon for r in recons}
    valid_load_jobs = {j.load_job for j in jobs}
    for r in rows:
        assert r["recon"] in valid_recons
        assert r["load_job"] in valid_load_jobs
        assert r["job_name"] not in volume.RESERVED_IDENTIFIERS


def test_gen_core_dicts_grouping_cardinality_band():
    recons = _recons()
    jobs = volume.gen_load_jobs(20_000, recons)
    rows = list(volume.gen_core_dicts(20_000, recons, jobs))
    # tlm_instance is a small fixed pool -> fat groups
    assert len({r["tlm_instance"] for r in rows}) <= len(volume.TLM_INSTANCES)
    # recon groups are many but far fewer than rows -> meaningful grouping
    assert 1 < len({r["recon"] for r in rows}) <= volume.recon_count(20_000)


def test_core_dict_to_es_has_id_and_suggest():
    recons = _recons()
    jobs = volume.gen_load_jobs(20_000, recons)
    row = next(iter(volume.gen_core_dicts(20_000, recons, jobs)))
    suggest_source = {"recon_suggest": "recon", "job_name_suggest": "job_name"}
    doc = volume.core_dict_to_es(row, ES_INDEX="rectrace_core_index",
                                 suggest_source=suggest_source)
    assert doc["_id"] == row["job_name"]
    assert doc["_index"] == "rectrace_core_index"
    assert doc["_source"]["recon_suggest"] == row["recon"]
    assert doc["_source"]["job_name_suggest"] == row["job_name"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/aarun/Workspace/Projects/rectrace-local-dev && .venv/bin/pytest tests/test_volume_unit.py -q`
Expected: FAIL — `AttributeError: module 'volume' has no attribute 'RECTRACE_CORE_COLUMNS'`.

- [ ] **Step 3: Write minimal implementation**

Add to `volume.py`:
```python
RECTRACE_CORE_COLUMNS = [
    "file_name_pattern", "ok_file_name", "job_name", "recon_engine", "app_name",
    "app_id", "support_email", "support_hotline", "receive_path", "recon",
    "set_id", "sub_acc", "load_job", "box_name", "load_file_name",
    "load_file_name_pattern", "tlm_instance", "machine", "run_calendar",
    "exclude_calendar", "recon_id", "recon_portal_id",
]


def gen_core_dicts(n: int, recons: list, jobs: list):
    """N rectrace_core rows distributed across recons (~n/recon_count each),
    each with a unique job_name (ES _id) and a load_job from the shared pool.

    Fully deterministic from the ordinal `i` (NO rng): this is what lets append()
    stream the rows twice — once for Oracle, once for ES — and get byte-identical
    rows for the same job_name, so every Oracle row stays coherent with its ES doc.

    Yields dicts keyed by RECTRACE_CORE_COLUMNS. Group-column cardinalities are
    bounded so grouping/SSRM is meaningful (fat groups, not all-distinct)."""
    # Pre-bucket load-jobs by recon so a row's load_job is coherent with its recon.
    jobs_by_recon: dict = {}
    for j in jobs:
        jobs_by_recon.setdefault(j.recon, []).append(j)
    # Bounded sub_acc / set_id pools, derived from N for stable group sizes.
    set_pool = [f"SETV_{k:06d}" for k in range(max(1, n // 70))]
    sub_pool = [f"SUBACCV_{k:05d}" for k in range(max(1, n // 250))]
    for i in range(1, n + 1):
        recon = recons[(i - 1) % len(recons)]
        rjobs = jobs_by_recon.get(recon.recon) or jobs
        job = rjobs[(i - 1) % len(rjobs)]
        sep = "-" if "-" in recon.recon else "_"
        job_name = f"JOBV{sep}{recon.theme}{sep}{recon.region}{sep}{i:07d}"
        set_id = set_pool[(i - 1) % len(set_pool)]
        sub_acc = sub_pool[(i - 1) % len(sub_pool)]
        file_pat = f"{recon.theme.lower()}{sep}{recon.region.lower()}{sep}*.csv"
        yield {
            "file_name_pattern": file_pat,
            "ok_file_name": f"{recon.theme.lower()}_{recon.region.lower()}.ok",
            "job_name": job_name,
            "recon_engine": recon.recon_engine,
            "app_name": f"{recon.theme.title()} {recon.region}",
            "app_id": f"APP_{recon.theme}_{recon.region}",
            "support_email": f"{recon.theme.lower()}-{recon.region.lower()}-support@example.local",
            "support_hotline": f"+{REGION_DIAL[recon.region]}-555-0{i % 900 + 100}",
            "receive_path": f"/in/{recon.region.lower()}/{recon.theme.lower()}/",
            "recon": recon.recon,
            "set_id": set_id,
            "sub_acc": sub_acc,
            "load_job": job.load_job,
            "box_name": job.box_name,
            "load_file_name": f"{recon.theme.lower()}_{recon.region.lower()}_20260512.csv",
            "load_file_name_pattern": file_pat,
            "tlm_instance": recon.tlm_instance,
            "machine": job.machine,
            "run_calendar": job.run_calendar,
            "exclude_calendar": job.exclude_calendar,
            "recon_id": recon.recon_id,
            "recon_portal_id": recon.recon_portal_id,
        }


def core_dict_to_es(row: dict, ES_INDEX: str, suggest_source: dict) -> dict:
    """Adapt a core row dict to an ES bulk action with _id=job_name and the
    completion-suggester enrichment (same shape as apply.py's loader)."""
    source = dict(row)
    for suggest_field, src_col in suggest_source.items():
        val = row.get(src_col)
        if isinstance(val, str) and val.strip():
            source[suggest_field] = val
    return {"_index": ES_INDEX, "_id": row["job_name"], "_source": source}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/aarun/Workspace/Projects/rectrace-local-dev && .venv/bin/pytest tests/test_volume_unit.py -q`
Expected: PASS (17 passed).

- [ ] **Step 5: Commit**

```bash
git -C /Users/aarun/Workspace/Projects/rectrace-local-dev add volume.py tests/test_volume_unit.py
git -C /Users/aarun/Workspace/Projects/rectrace-local-dev commit -m "feat(volume): rectrace_core row generator + ES doc adapter

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 5: reconmgmt + recportal generators + date helper

**Files:**
- Modify: `volume.py`
- Modify: `tests/test_volume_unit.py`

- [ ] **Step 1: Write the failing test**

Append to `tests/test_volume_unit.py`:
```python
import datetime


def test_days_ago_returns_past_date():
    d0 = volume.days_ago(0)
    d5 = volume.days_ago(5)
    assert isinstance(d0, datetime.date)
    assert (d0 - d5).days == 5


def test_gen_recon_bank():
    recons = _recons()
    rows = list(volume.gen_recon_bank(recons))
    assert len(rows) == len(recons)
    valid = {r.recon for r in recons}
    for row in rows:
        assert row["agent_code"] in valid
        assert set(row.keys()) == {"agent_code", "local_acc_no",
                                   "recon_engine_env", "recon_engine", "corr_acc_no"}


def test_gen_mr_csum_stats_hist_counts_and_dates():
    recons = _recons()
    rows = list(volume.gen_mr_stats_hist(recons))
    assert len(rows) == len(recons) * volume.TLM_DAYS
    valid = {r.recon for r in recons}
    for row in rows:
        assert row["agent_code"] in valid
        assert row["total_item"] == row["automatch_items"] + row["manualmatch_items"]
        # within the date window
        assert 0 <= (volume.days_ago(0) - row["stmt_date"]).days < volume.TLM_DAYS


def test_gen_mr_details_and_netting_counts():
    recons = _recons()
    details = list(volume.gen_mr_details(recons))
    netting = list(volume.gen_mr_netting(recons))
    assert len(details) == len(recons) * volume.TLM_DAYS * volume.DETAILS_PER_DAY
    assert len(netting) == len(recons) * volume.TLM_DAYS * volume.DETAILS_PER_DAY


def test_gen_quickrec_and_manual_match():
    recons = _recons()
    qr = list(volume.gen_quickrec_stats(recons))
    mm = list(volume.gen_recportal_manual(recons))
    assert len(qr) == len(recons) * volume.QUICKREC_WINDOW
    assert len(mm) == len(recons)
    valid_portal = {r.recon_portal_id for r in recons}
    assert all(row["rec_portal_id"] in valid_portal for row in mm)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/aarun/Workspace/Projects/rectrace-local-dev && .venv/bin/pytest tests/test_volume_unit.py -q`
Expected: FAIL — `AttributeError: module 'volume' has no attribute 'days_ago'`.

- [ ] **Step 3: Write minimal implementation**

Add to `volume.py` (add `import datetime` near the top imports):
```python
import datetime


def days_ago(offset: int) -> datetime.date:
    """TRUNC(SYSDATE) - offset, as a real date relative to today."""
    return datetime.date.today() - datetime.timedelta(days=offset)


def gen_recon_bank(recons: list):
    for r in recons:
        yield {
            "agent_code": r.recon,
            "local_acc_no": f"LACC_{r.seq:06d}",
            "recon_engine_env": r.tlm_instance,
            "recon_engine": r.recon_engine,
            "corr_acc_no": f"CORR_{r.seq:06d}",
        }


def gen_mr_stats_hist(recons: list):
    """1 row per recon per day over TLM_DAYS. Deterministic synthetic volumes."""
    for r in recons:
        for d in range(TLM_DAYS):
            total = 100 + (r.seq * 7 + d * 13) % 900
            manual = (r.seq + d) % 40
            yield {
                "tlm_instance": r.tlm_instance,
                "agent_code": r.recon,
                "setid": f"LACC_{r.seq:06d}",
                "stmt_date": days_ago(d),
                "bran_code": f"BR{r.seq % 50:03d}",
                "corr_acc_no": f"CORR_{r.seq:06d}",
                "total_item": total,
                "automatch_items": total - manual,
                "manualmatch_items": manual,
            }


def gen_mr_details(recons: list):
    """DETAILS_PER_DAY rows per recon per day over TLM_DAYS."""
    for r in recons:
        for d in range(TLM_DAYS):
            for _ in range(DETAILS_PER_DAY):
                yield {
                    "agent_code": r.recon,
                    "setid": f"LACC_{r.seq:06d}",
                    "corr_acc_no": f"CORR_{r.seq:06d}",
                    "bran_code": f"BR{r.seq % 50:03d}",
                    "tlm_instance": r.tlm_instance,
                    "stmt_date": days_ago(d),
                }


def gen_mr_netting(recons: list):
    """DETAILS_PER_DAY rows per recon per day over TLM_DAYS."""
    for r in recons:
        for d in range(TLM_DAYS):
            for _ in range(DETAILS_PER_DAY):
                yield {
                    "agent_code": r.recon,
                    "local_acc_no": f"LACC_{r.seq:06d}",
                    "corr_acc_no": f"CORR_{r.seq:06d}",
                    "bran_code": f"BR{r.seq % 50:03d}",
                    "tlm_instance": r.tlm_instance,
                    "stmt_date": days_ago(d),
                }


def gen_quickrec_stats(recons: list):
    """QUICKREC_WINDOW rows per recon (one per recent day)."""
    for r in recons:
        for d in range(QUICKREC_WINDOW):
            left = 500 + (r.seq * 11 + d * 7) % 1500
            right = left + ((r.seq + d) % 11) - 5
            lbreak = (r.seq + d) % 30
            rbreak = (r.seq + d * 2) % 30
            yield {
                "reconname": r.recon,
                "recon_id": r.recon_id,
                "rec_portal_id": r.recon_portal_id,
                "left_record_count": left,
                "right_record_count": right,
                "left_break_count": lbreak,
                "right_break_count": rbreak,
                "left_match_count": left - lbreak,
                "right_match_count": right - rbreak,
                "load_date": days_ago(d),
            }


def gen_recportal_manual(recons: list):
    for r in recons:
        yield {
            "rec_portal_id": r.recon_portal_id,
            "cob": days_ago(0),
            "updated_date": days_ago(0),
            "left_manual_matches": r.seq % 25,
            "right_manual_matches": (r.seq + 3) % 25,
        }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/aarun/Workspace/Projects/rectrace-local-dev && .venv/bin/pytest tests/test_volume_unit.py -q`
Expected: PASS (22 passed).

- [ ] **Step 5: Commit**

```bash
git -C /Users/aarun/Workspace/Projects/rectrace-local-dev add volume.py tests/test_volume_unit.py
git -C /Users/aarun/Workspace/Projects/rectrace-local-dev commit -m "feat(volume): reconmgmt + recportal generators + date helper

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 6: SQL builders + append layer (Oracle executemany + indexes + ES bulk)

**Files:**
- Modify: `volume.py`
- Modify: `tests/test_volume_unit.py`

- [ ] **Step 1: Write the failing test (pure SQL builders only)**

Append to `tests/test_volume_unit.py`:
```python
def test_insert_sql_named_binds():
    sql = volume.insert_sql("ujo_job", ["joid", "job_name"])
    assert sql == "INSERT INTO ujo_job (joid, job_name) VALUES (:joid, :job_name)"


def test_index_ddl_pairs():
    drop, create = volume.index_ddl("rectrace_core", "vol_rc_recon_ix", ["recon"])
    assert "DROP INDEX vol_rc_recon_ix" in drop
    assert "-1418" in drop  # tolerate "index does not exist"
    assert create == "CREATE INDEX vol_rc_recon_ix ON rectrace_core (recon)"


def test_batched_splits_evenly():
    assert list(volume.batched(range(5), 2)) == [[0, 1], [2, 3], [4]]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/aarun/Workspace/Projects/rectrace-local-dev && .venv/bin/pytest tests/test_volume_unit.py -q`
Expected: FAIL — `AttributeError: module 'volume' has no attribute 'insert_sql'`.

- [ ] **Step 3: Write minimal implementation**

Add to `volume.py` (add `import oracledb` near top imports):
```python
import oracledb
from elasticsearch.helpers import bulk as es_bulk

ORACLE_BATCH = 5_000
ES_CHUNK = 2_000

# Volume-supporting indexes: (schema_key, table, index_name, [columns]).
VOLUME_INDEXES = [
    ("rectrace", "rectrace_core", "vol_rc_recon_ix", ["recon"]),
    ("rectrace", "rectrace_core", "vol_rc_box_ix", ["box_name"]),
    ("rectrace", "rectrace_core", "vol_rc_setid_ix", ["set_id"]),
    ("rectrace", "rectrace_core", "vol_rc_job_ix", ["job_name"]),
    ("rectrace", "rectrace_core", "vol_rc_loadjob_ix", ["load_job"]),
    ("rectrace", "rectrace_core", "vol_rc_machine_ix", ["machine"]),
    ("rectrace", "rectrace_core", "vol_rc_subacc_ix", ["sub_acc"]),
    ("reconmgmt", "mr_csum_man_match_stats_hist", "vol_mr_stats_ix", ["agent_code", "stmt_date"]),
    ("reconmgmt", "mr_csum_man_match_details", "vol_mr_det_ix", ["agent_code", "stmt_date"]),
    ("reconmgmt", "mr_csum_netting_hist", "vol_mr_net_ix", ["agent_code", "stmt_date"]),
]


def insert_sql(table: str, columns: list) -> str:
    cols = ", ".join(columns)
    binds = ", ".join(f":{c}" for c in columns)
    return f"INSERT INTO {table} ({cols}) VALUES ({binds})"


def index_ddl(table: str, name: str, columns: list):
    """Return (drop_plsql, create_sql). Drop tolerates ORA-01418 (index missing)."""
    drop = (
        f"BEGIN EXECUTE IMMEDIATE 'DROP INDEX {name}'; "
        f"EXCEPTION WHEN OTHERS THEN IF SQLCODE != -1418 THEN RAISE; END IF; END;"
    )
    create = f"CREATE INDEX {name} ON {table} ({', '.join(columns)})"
    return drop, create


def batched(iterable, size: int):
    """Yield lists of up to `size` items from any iterable (Py3.11-safe)."""
    batch = []
    for item in iterable:
        batch.append(item)
        if len(batch) >= size:
            yield batch
            batch = []
    if batch:
        yield batch


def _executemany(conn, table: str, columns: list, rows_iter, *, clob_cols=()):
    """Batched parameterized executemany. clob_cols forces CLOB bind type."""
    sql = insert_sql(table, columns)
    cur = conn.cursor()
    total = 0
    for batch in batched(rows_iter, ORACLE_BATCH):
        if clob_cols:
            cur.setinputsizes(**{c: oracledb.DB_TYPE_CLOB for c in clob_cols})
        cur.executemany(sql, batch)
        total += len(batch)
    conn.commit()
    return total


def create_indexes(conns_by_schema: dict):
    """Idempotently (re)create the volume-supporting indexes."""
    for schema_key, table, name, columns in VOLUME_INDEXES:
        conn = conns_by_schema[schema_key]
        drop, create = index_ddl(table, name, columns)
        cur = conn.cursor()
        cur.execute(drop)
        cur.execute(create)
        conn.commit()


def append(n: int, *, conns_by_schema: dict, es, es_index: str,
           suggest_source: dict, rng_seed: int = RNG_SEED) -> dict:
    """Generate and append n rectrace_core rows + coherent downstream rows
    across all schemas + ES. Returns a {label: count} report. Deterministic."""
    rng = random.Random(rng_seed)
    recons = gen_recon_entities(n, rng)  # gen_recon_entities is the only rng consumer
    jobs = gen_load_jobs(n, recons)
    report = {}

    rc = conns_by_schema["rectrace"]
    report["rectrace_core"] = _executemany(
        rc, "rectrace_core", RECTRACE_CORE_COLUMNS,
        gen_core_dicts(n, recons, jobs))

    au = conns_by_schema["autosys"]
    report["ujo_job"] = _executemany(au, "ujo_job", ["joid", "job_name"],
                                      gen_ujo_job_rows(jobs))
    report["ujo_job_status"] = _executemany(
        au, "ujo_job_status", ["joid", "status", "next_start"],
        gen_ujo_job_status_rows(jobs))
    report["autosys_tlm_recon_sequences"] = _executemany(
        au, "autosys_tlm_recon_sequences", ["job_name", "load_job", "exec_order"],
        gen_sequence_rows(jobs))
    report["autosys_all_jobs_data"] = _executemany(
        au, "autosys_all_jobs_data",
        ["insert_job", "job_type", "machine", "run_calendar",
         "exclude_calendar", "box_name", "command", "description"],
        gen_all_jobs_rows(jobs), clob_cols=("command", "description"))

    rm = conns_by_schema["reconmgmt"]
    report["recon_bank"] = _executemany(
        rm, "recon_bank",
        ["agent_code", "local_acc_no", "recon_engine_env", "recon_engine", "corr_acc_no"],
        gen_recon_bank(recons))
    report["mr_csum_man_match_stats_hist"] = _executemany(
        rm, "mr_csum_man_match_stats_hist",
        ["tlm_instance", "agent_code", "setid", "stmt_date", "bran_code",
         "corr_acc_no", "total_item", "automatch_items", "manualmatch_items"],
        gen_mr_stats_hist(recons))
    report["mr_csum_man_match_details"] = _executemany(
        rm, "mr_csum_man_match_details",
        ["agent_code", "setid", "corr_acc_no", "bran_code", "tlm_instance", "stmt_date"],
        gen_mr_details(recons))
    report["mr_csum_netting_hist"] = _executemany(
        rm, "mr_csum_netting_hist",
        ["agent_code", "local_acc_no", "corr_acc_no", "bran_code", "tlm_instance", "stmt_date"],
        gen_mr_netting(recons))

    rp = conns_by_schema["recportal"]
    report["quickrec_stats_table"] = _executemany(
        rp, "quickrec_stats_table",
        ["reconname", "recon_id", "rec_portal_id", "left_record_count",
         "right_record_count", "left_break_count", "right_break_count",
         "left_match_count", "right_match_count", "load_date"],
        gen_quickrec_stats(recons))
    report["recportal_manual_match_table"] = _executemany(
        rp, "recportal_manual_match_table",
        ["rec_portal_id", "cob", "updated_date", "left_manual_matches", "right_manual_matches"],
        gen_recportal_manual(recons))

    create_indexes(conns_by_schema)

    es_docs = (core_dict_to_es(r, es_index, suggest_source)
               for r in gen_core_dicts(n, recons, jobs))
    es_success, _ = es_bulk(es, es_docs, chunk_size=ES_CHUNK, refresh="wait_for")
    report["es_docs"] = es_success
    return report
```

> **Implementer note:** `gen_core_dicts` is rng-free (every value derives from the ordinal `i` + the recon/load-job entities), so the two passes (Oracle, then ES) yield byte-identical rows for the same `job_name` — keeping each Oracle row coherent with its ES doc. Only `gen_recon_entities` consumes `rng`. Re-runs are deterministic because `append()` seeds one `random.Random(rng_seed)` for `gen_recon_entities`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/aarun/Workspace/Projects/rectrace-local-dev && .venv/bin/pytest tests/test_volume_unit.py -q`
Expected: PASS (25 passed). (The append layer itself is exercised live in Task 7.)

- [ ] **Step 5: Commit**

```bash
git -C /Users/aarun/Workspace/Projects/rectrace-local-dev add volume.py tests/test_volume_unit.py
git -C /Users/aarun/Workspace/Projects/rectrace-local-dev commit -m "feat(volume): SQL builders + Oracle/ES append layer + index DDL

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 7: apply.py wiring (`--volume` flag, volume phase, volume-aware verify) + live integration tests

**Files:**
- Modify: `apply.py`
- Create: `tests/test_volume_integration.py`

- [ ] **Step 1: Write the failing integration test**

Create `tests/test_volume_integration.py`:
```python
"""Live-stack integration tests. Require the local Oracle + ES Docker stack up.
Run explicitly: .venv/bin/pytest tests/test_volume_integration.py -q
Each test does a full `apply.py --volume N` (small N) so it rebuilds the seed."""
import os
import subprocess
import sys
from pathlib import Path

import oracledb
from dotenv import load_dotenv
from elasticsearch import Elasticsearch

import volume

ROOT = Path(__file__).resolve().parent.parent
PY = sys.executable
N = 500  # small, fast; ratios still hold via floors


def _run(*args):
    return subprocess.run([PY, str(ROOT / "apply.py"), *args],
                          cwd=ROOT, capture_output=True, text=True)


def _load_env():
    env = ROOT / ".env"
    load_dotenv(env if env.exists() else ROOT / ".env.example")


def test_volume_apply_produces_expected_counts():
    r = _run("--volume", str(N))
    assert r.returncode == 0, r.stderr + r.stdout
    _load_env()
    dsn = os.environ["ORACLE_DSN"]
    expected = volume.expected_counts(N)
    pwd_by_env = {e: os.environ[e] for (_, e) in expected}
    for (schema, pwd_env), tables in expected.items():
        with oracledb.connect(user=schema, password=pwd_by_env[pwd_env], dsn=dsn) as conn:
            cur = conn.cursor()
            for table, exp in tables.items():
                cur.execute(f"SELECT COUNT(*) FROM {table}")
                (actual,) = cur.fetchone()
                assert actual == exp, f"{schema}.{table}: {actual} != {exp}"
    es = Elasticsearch(os.environ.get("ES_URL", "http://localhost:9200"))
    assert es.count(index="rectrace_core_index")["count"] == volume.expected_es_count(N)


def test_volume_apply_is_deterministic():
    _run("--volume", str(N))
    _load_env()
    es = Elasticsearch(os.environ.get("ES_URL", "http://localhost:9200"))
    c1 = es.count(index="rectrace_core_index")["count"]
    _run("--volume", str(N))
    c2 = es.count(index="rectrace_core_index")["count"]
    assert c1 == c2 == volume.expected_es_count(N)


def test_anchors_preserved_after_volume():
    _run("--volume", str(N))
    _load_env()
    es = Elasticsearch(os.environ.get("ES_URL", "http://localhost:9200"))
    for field, value in [("set_id.keyword", "SET-ABC-123"),
                         ("job_name.keyword", "RECON-XYZ-42")]:
        hits = es.search(index="rectrace_core_index",
                         body={"query": {"term": {field: value}}})["hits"]["total"]["value"]
        assert hits == 1, f"anchor {field}={value} returned {hits}"


def test_verify_volume_flag_reports_volume_tables_ok():
    _run("--volume", str(N))
    r = _run("--verify", "--volume", str(N))
    out = r.stdout
    for table in ["rectrace.rectrace_core", "autosys.ujo_job",
                  "reconmgmt.mr_csum_man_match_details", "recportal.quickrec_stats_table"]:
        line = next((ln for ln in out.splitlines() if ln.startswith(table)), None)
        assert line is not None and line.rstrip().endswith("ok"), f"{table}: {line}"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/aarun/Workspace/Projects/rectrace-local-dev && .venv/bin/pytest tests/test_volume_integration.py -q`
Expected: FAIL — `apply.py: error: unrecognized arguments: --volume` (non-zero returncode).

- [ ] **Step 3: Implement apply.py changes**

In `apply.py`:

(a) Add near the top imports: `import volume`.

(b) Extract the inline `suggest_source` dict from `apply_elasticsearch` to a module-level constant `SUGGEST_SOURCE` (same keys/values), and reference `SUGGEST_SOURCE` inside `apply_elasticsearch`.

(c) Add the argparse argument in `main()`:
```python
    parser.add_argument(
        "--volume",
        nargs="?",
        const=volume.DEFAULT_VOLUME,
        type=int,
        default=None,
        metavar="N",
        help=f"Append N synthetic rows (default {volume.DEFAULT_VOLUME}) across all "
             f"schemas + ES after the canonical apply. Opt-in volume seed.",
    )
```

(d) Make `verify()` volume-aware. Change its signature to `def verify(volume_n=None) -> int:` and, when `volume_n` is not None, merge `volume.expected_counts(volume_n)` over the base `EXPECTED` (volume tables override base counts) and use `volume.expected_es_count(volume_n)` for the ES count check. The hyphen `.keyword` probes stay exact `== 1`. Concretely, near the top of `verify`:
```python
    expected = {sk: dict(tables) for sk, tables in EXPECTED.items()}
    es_expected = 5
    if volume_n is not None:
        for sk, tables in volume.expected_counts(volume_n).items():
            expected.setdefault(sk, {}).update(tables)
        es_expected = volume.expected_es_count(volume_n)
```
Then iterate `expected` (instead of `EXPECTED`) for the Oracle counts, and use `es_expected` (instead of the literal `5`) in the ES `_count` probe line.

(e) In `main()`, route verify and add the volume phase:
```python
    if args.verify:
        return verify(volume_n=args.volume)

    load_env()
    if args.reset:
        print("Resetting all data...")

    t0 = time.time()
    if not args.es_only:
        apply_oracle(reset=args.reset)
    if not args.oracle_only:
        apply_elasticsearch()

    if args.volume is not None:
        _apply_volume(args.volume)

    elapsed = time.time() - t0
    print(f"Done. Stack ready in {elapsed:.1f}s.")
    return 0
```

(f) Add the `_apply_volume` helper (opens one connection per schema, calls `volume.append`, prints the report):
```python
def _apply_volume(n: int):
    dsn = os.environ["ORACLE_DSN"]
    print(f"[volume] appending {n} synthetic rectrace_core rows + downstream "
          f"(recons={volume.recon_count(n)}, load_jobs={volume.load_job_count(n)}) ...")
    conns = {}
    try:
        for schema, pwd_env, _prefix in SCHEMAS:
            conns[schema] = oracledb.connect(
                user=schema, password=os.environ[pwd_env], dsn=dsn)
        es = Elasticsearch(os.environ.get("ES_URL", "http://localhost:9200"))
        report = volume.append(
            n, conns_by_schema=conns, es=es,
            es_index=ES_INDEX, suggest_source=SUGGEST_SOURCE)
        for label, count in report.items():
            print(f"  [volume] {label}: +{count}")
    finally:
        for c in conns.values():
            c.close()
```

> **Implementer note:** `SCHEMAS` tuples are `(schema, pwd_env, prefix)`; unpack the prefix as `_prefix`. `Elasticsearch` and `oracledb` are already imported in apply.py.

- [ ] **Step 4: Run integration tests to verify they pass**

Run: `cd /Users/aarun/Workspace/Projects/rectrace-local-dev && .venv/bin/pytest tests/test_volume_integration.py -q`
Expected: PASS (4 passed). If a CLOB bind error appears on `autosys_all_jobs_data`, confirm `setinputsizes(command=DB_TYPE_CLOB, description=DB_TYPE_CLOB)` is applied (Task 6 `_executemany clob_cols`).

- [ ] **Step 5: Confirm the no-flag default is unchanged**

Run: `cd /Users/aarun/Workspace/Projects/rectrace-local-dev && .venv/bin/python apply.py && .venv/bin/python apply.py --verify`
Expected: `rectrace.rectrace_core` shows `5  5  ok`, `es...._count` shows `5  5  ok`, both hyphen probes `ok`. (`shedlock`/`loader_run_history` may show as `FAIL` only if the backend wrote to them since this apply — that is pre-existing runtime drift, not a volume regression.)

- [ ] **Step 6: Run the full unit suite (no regressions)**

Run: `cd /Users/aarun/Workspace/Projects/rectrace-local-dev && .venv/bin/pytest tests/test_volume_unit.py -q`
Expected: PASS (25 passed).

- [ ] **Step 7: Commit**

```bash
git -C /Users/aarun/Workspace/Projects/rectrace-local-dev add apply.py tests/test_volume_integration.py
git -C /Users/aarun/Workspace/Projects/rectrace-local-dev commit -m "feat(volume): apply.py --volume flag, volume phase, volume-aware verify

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 8: Documentation

**Files:**
- Modify: `README.md`
- Modify: `data/scenarios.md`

- [ ] **Step 1: Document the flag in README.md**

Add a section to `README.md` describing the opt-in volume seed. Required content:
- `python apply.py --volume` loads the default 200,000 `rectrace_core` rows (+ coherent downstream rows across autosys / reconmgmt / recportal + ES) on top of the canonical 5 scenarios.
- `python apply.py --volume 50000` overrides the count.
- It is deterministic (fixed seed) and idempotent (the canonical apply truncates first, so re-running replaces prior volume).
- `python apply.py --verify --volume 200000` verifies the expected post-volume counts.
- Volume sizing note: per-recon TLM/quickrec history is bounded to recon-cardinality × a 30-day window (not ×N) — sized to what those modals render, and kept inside Oracle Free's envelope.

Example block to include:
```bash
# Load a realistic large volume for performance / look-and-feel testing
python apply.py --volume            # 200,000 rectrace_core rows (default)
python apply.py --volume 50000      # custom size
python apply.py --verify --volume 200000
```

- [ ] **Step 2: Document the model in data/scenarios.md**

Add a short "Volume seed (opt-in)" section to `data/scenarios.md` noting:
- The 5 canonical scenarios above are always present and are the verify/regression anchors.
- `--volume N` layers deterministic synthetic entities on top: ~N/100 recon entities (the recon spine), ~N/40 load-jobs (the autosys spine), N `rectrace_core` rows with unique `job_name`s, and coherent `recon_bank` / `mr_csum_*` / `quickrec` / `recportal_manual` / `ujo_*` / execution-order rows fanned out from those spines.
- The generator never emits any reserved anchor identifier, so the hyphen probes stay exact.

- [ ] **Step 3: Commit**

```bash
git -C /Users/aarun/Workspace/Projects/rectrace-local-dev add README.md data/scenarios.md
git -C /Users/aarun/Workspace/Projects/rectrace-local-dev commit -m "docs(volume): document opt-in --volume seed flag

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Post-Implementation (controller, after all tasks + final review)

1. Run the full unit suite once more: `.venv/bin/pytest tests/test_volume_unit.py -q` → all pass.
2. Load the full headline volume so the user returns to a populated grid:
   `cd /Users/aarun/Workspace/Projects/rectrace-local-dev && time .venv/bin/python apply.py --volume 200000`
   Expected: completes (report prints per-table `+counts`), elapsed reported.
3. `.venv/bin/python apply.py --verify --volume 200000` → volume tables `ok`, hyphen probes `ok`.
4. Spot-check the React grid against the volume (manual / Playwright): broad search returns many rows, scrollbar reflects volume, grouping by `tlm_instance` (fat groups) and `recon` (many groups) works, SSRM pages.

---

## Self-Review

**Spec coverage:**
- Opt-in `--volume` flag, append-after-canonical → Task 7. ✓
- Coherent entity generation (recon spine, load-job spine) → Tasks 2, 3, 4. ✓
- Value pools / fictional conventions → Task 2. ✓
- Distribution & multiplier dials → Task 1 (math), Tasks 2–5 (generators). ✓
- Bounded TLM/quickrec sizing → Task 5 (per-recon × window). ✓
- Indexes for grid speed → Task 6 (`VOLUME_INDEXES`, `create_indexes`). ✓
- `--verify` volume-awareness → Task 7 (step 3d). ✓
- ES `_id` uniqueness + suggest enrichment → Task 4 (`core_dict_to_es`), Task 6 (bulk). ✓
- Reserved-anchor blocklist → Task 2 (`RESERVED_IDENTIFIERS`), tested Tasks 2–4, 7. ✓
- Determinism (fixed seed) → tested Tasks 2, 7. ✓
- Idempotency (truncate-first) → relies on existing apply behavior; verified by Task 7 determinism test. ✓
- Files touched (volume.py, apply.py, README, scenarios.md) → all covered. ✓
- Parameterized binds, no dynamic SQL → Task 6 (`insert_sql` named binds, `executemany`). ✓

**Type/name consistency:** `ReconEntity`/`LoadJob` fields, `gen_*` signatures, `RECTRACE_CORE_COLUMNS`, `expected_counts`/`expected_es_count`, `append(...)` kwargs (`conns_by_schema`, `es`, `es_index`, `suggest_source`), and `core_dict_to_es(row, ES_INDEX, suggest_source)` are used consistently across tasks and the apply.py wiring. `conns_by_schema` keys are schema names (`rectrace`/`autosys`/`reconmgmt`/`recportal`) matching `SCHEMAS` and `VOLUME_INDEXES`'s `schema_key`.

**Placeholder scan:** No TBD/TODO/"handle errors" placeholders; every code step has complete code; every test has concrete assertions.
