# Volume Seed Data Design

**Date:** 2026-05-27
**Status:** Design — approved in brainstorming, pending spec review
**Repo of record for code:** `../rectrace-local-dev/` (sibling). This spec lives in
`autosys-job-explorer` because that is where the project's planning workflow artifacts live.

## Goal

Add an **opt-in** way to load a large, realistic, coherent volume of seed data into the local
Oracle + Elasticsearch stack so the Rectrace React search surface (and the TLM-stats / quickrec
modals) can be evaluated for grid performance, scrollbar behaviour, SSRM pagination, grouping at
scale, and overall look-and-feel. The current seed is 5 hand-crafted scenarios — too small to
gauge any of these.

## Background

The local stack is seeded by `apply.py` in `../rectrace-local-dev/`, an idempotent driver that:
applies per-schema DDL + INSERT `.sql` files to Oracle (Oracle 23c **Free**), then drops/recreates
the `rectrace_core_index` ES index and bulk-loads NDJSON docs. Today it seeds **5 fully-connected
fabricated scenarios** that thread end-to-end across four Oracle schemas + ES:

- **`rectrace`** — `rectrace_core` (the search grid's table; 22 `VARCHAR2(4000)` columns, no PK).
- **`autosys`** — `ujo_job` / `ujo_job_status` (job status), `autosys_tlm_recon_sequences`
  (execution-order chain), `autosys_all_jobs_data` (execution-order box/command rows).
- **`reconmgmt`** — `recon_bank`, `mr_csum_man_match_stats_hist`, `mr_csum_man_match_details`,
  `mr_csum_netting_hist` (TLM-stats modal).
- **`recportal`** — `quickrec_stats_table`, `recportal_manual_match_table` (QuickRec modal).
- **ES** — `rectrace_core_index`, docs keyed `_id = job_name`.

The React **search grid** reads only `rectrace_core` (Oracle, via SSRM) + `rectrace_core_index`
(ES, collapsed-keyword first hop). The other schemas feed the TLM-stats and QuickRec modals.

### Load-bearing facts the design must respect

1. **The 5 anchors are load-bearing.** `apply.py --verify` asserts `rectrace_core == 5` and
   `es._count == 5`; the hyphen-search regression probes `set_id.keyword == "SET-ABC-123"` and
   `job_name.keyword == "RECON-XYZ-42"` for exactly 1 hit. Volume must preserve all five and never
   collide with their reserved identifiers.
2. **`apply.py:apply_sql_file` executes one statement per `cursor.execute` round-trip.** Fine for
   5 rows; far too slow for 200k. Volume must use `executemany` (Oracle) + `helpers.bulk` (ES).
3. **apply.py's stated contract:** "all SQL from files on disk, no dynamic SQL, idempotent re-runs
   produce identical counts." Volume generation must use **parameterized bind variables** (not
   string interpolation) and a **fixed RNG seed** to honor that spirit.
4. **ES `_id = job_name`** ⇒ every generated `job_name` must be unique.
5. **Oracle 23c Free** has a constrained resource envelope (~2GB RAM, 2 CPU threads, 12GB user
   data). Total generated rows must stay well inside that and load in a tolerable time.

## Non-Goals

- Not changing the default `apply.py` behaviour. No-flag apply stays the fast 5-scenario seed.
- Not committing giant generated `.sql`/`.ndjson` files to the sibling repo (data is generated at
  apply time, deterministically).
- Not touching the React frontend, backend, or `search-config-v4.json` (config-driven principle:
  the grid already renders whatever the data + config produce).
- Not building the execution-order modal or RecViz integration (separate tasks).

## Architecture

### Opt-in flag, append-after-canonical

A new module `volume.py` in `../rectrace-local-dev/`, imported by `apply.py`. `apply.py` gains a
`--volume [N]` argument (argparse `nargs='?'`, `const=200000`, `type=int`; default headline
**200,000** `rectrace_core` rows). Flow when `--volume N` is passed:

1. Run the **normal apply unchanged** — Oracle truncate + canonical 5-scenario inserts, ES
   drop/recreate index + load 5 docs.
2. Run the **volume-append phase** (`volume.append(n, oracle_conns, es)`): generate synthetic
   entities deterministically and append them via `executemany` + `helpers.bulk`.
3. Create volume-supporting indexes (idempotent drop-if-exists + create).

**Idempotency falls out for free:** step 1 `TRUNCATE`s every table and ES drops/recreates the
index, so re-running `--volume N` wipes prior volume before re-appending. The fixed RNG seed makes
re-runs byte-identical.

### Coherent entity generation (the spine model)

A "scenario" is a coherent bundle threaded by shared keys, not independent random rows. The
generator builds entities and fans related rows out:

- **Recon spine** — generate `RECON_COUNT = max(50, N // 100)` recon entities (≈2,000 at N=200k),
  each with its own `recon`, `recon_id`, `recon_portal_id`, `recon_engine`, `tlm_instance`,
  `agent_code` (= `recon`), themed from fictional pools. This is the key for `recon_bank`,
  `mr_csum_*`, `quickrec_stats_table`, `recportal_manual_match_table`.
- **Load-job spine** — generate `LOAD_JOB_COUNT = max(50, N // 40)` load-jobs (≈5,000), each tied
  to a recon, each with a 3-row PRE→MAIN→POST `autosys_tlm_recon_sequences` chain, 1 BOX + 3 CMD
  `autosys_all_jobs_data` rows, and a `ujo_job` / `ujo_job_status` pair (status mix drawn from
  `{1,2,3,4,5,7}`). This is the key for the execution-order graph and job status. Load-jobs are
  **shared** across many `rectrace_core` rows (realistic reuse), so the execution-order "View"
  button resolves to a real chain for any row.
- **`rectrace_core` rows** — generate **N** rows distributed across recons (≈100 rows/recon), each
  with a **unique `job_name`** (= ES `_id`) and a `load_job` drawn from the load-job pool. Other
  group columns (`box_name`, `set_id`, `sub_acc`, `machine`, `run_calendar`, `file_name_pattern`,
  `load_file_name_pattern`, `app_id`) drawn so cardinalities give meaningful group sizes (see
  Distribution).

### Value pools (fictional, matching existing conventions)

All identifiers fictional, per `data/scenarios.md` authoring conventions. Pools:

- Regions: `NA`, `EMEA`, `APAC`, `LATAM`, `GBL`.
- Asset-class themes: `TRADE`, `FX_SPOT`, `FX_FWD`, `COMMOD`, `CROSS_ASSET`, `RATES`, `CREDIT`,
  `EQUITY`, `REPO`, `MM`, `OTC`, `LISTED_DERIV`.
- `recon_engine`: `TLM` (dominant) + a small fictional set; `tlm_instance`: `TLM1`..`TLM6`.
- `machine`: `<region-lc>-<theme-lc><NN>`; `run_calendar`: `DAILY_<REGION>` / `WEEKLY_<REGION>` /
  `MONTHLY_GBL`; `exclude_calendar`: `<REGION>_HOLIDAYS`.
- `app_id`: `APP_<THEME>_<REGION>`; `support_email`: `<theme-lc>-<region-lc>-support@example.local`;
  `support_hotline`: `+<cc>-555-0NNN`.
- ~30–40% of generated recons/jobs use **hyphenated** identifier forms (keeps the hyphen surface
  exercised at volume), but the generator is **hard-blocked from emitting the reserved anchor
  values** (`SET-ABC-123`, `RECON-XYZ-42`, `LOAD-ABC-123`, `RID-ABC-123`, `RID-XYZ-42`, etc.).

### Date handling

Per scenarios.md convention, all `stmt_date` / `load_date` / `cob` / `updated_date` values are
`TRUNC(SYSDATE) - offset` computed in Python as real dates relative to "today" at apply time, so
volume TLM/quickrec rows land inside the modal's default date window regardless of apply date.

## Distribution & Volume Dials

Cardinalities derive from N so ratios hold at any N. At **N = 200,000**:

| Store | Keyed by | Approx count at N=200k |
|---|---|---|
| `rectrace_core` + ES docs | per-row | 200,000 (+5 anchors) |
| `recon_bank` | per-recon | ~2,000 (+5) |
| `ujo_job` / `ujo_job_status` | per-load_job | ~5,000 each (+5) |
| `autosys_tlm_recon_sequences` | per-load_job (3 rows) | ~15,000 (+15) |
| `autosys_all_jobs_data` | per-load_job (1 BOX + 3 CMD) | ~20,000 (+20) |
| `mr_csum_man_match_stats_hist` | per-recon × `TLM_DAYS`(30) | ~60,000 (+50) |
| `mr_csum_man_match_details` | per-recon × 30 × `DETAILS_PER_DAY`(~5) | ~300,000 (+50) |
| `mr_csum_netting_hist` | per-recon × 30 × ~5 | ~300,000 (+50) |
| `quickrec_stats_table` | per-recon × window | ~10,000 (+10) |
| `recportal_manual_match_table` | per-recon | ~2,000 (+5) |

Group-column cardinalities for `rectrace_core` (so grouping/SSRM is meaningful):
`recon ≈ N/100`, `box_name ≈ N/40`, `set_id ≈ N/70`, `sub_acc ≈ N/250`, `machine ≈ N/650`,
`run_calendar ≈ 40`, `tlm_instance = 6`, `app_id ≈ N/400`, `job_name = N` (unique).

### Bounded TLM/quickrec sizing (deliberate decision)

The heavy per-day TLM/quickrec tables are bounded to **recon cardinality (~2k) × a date window**,
not literally ×N. Rationale: those modals open **one recon at a time over a date range**, so what
makes them look/feel populated is depth-per-recon (30 days, hundreds of breaks), not millions of
total rows. Naive ×N would exceed Oracle Free's envelope and make the modals *slower* (full
scans), working against the goal. Approved in brainstorming.

## Keeping the Grid Fast

The volume phase creates indexes idempotently (drop-if-exists via `BEGIN EXECUTE IMMEDIATE 'DROP
INDEX...' EXCEPTION WHEN ... -1418` + `CREATE INDEX`) on the columns the SSRM and TLM queries
filter/sort on:

- `rectrace_core`: indexes on the high-traffic group/search columns (`recon`, `box_name`,
  `set_id`, `job_name`, `load_job`, `machine`, `sub_acc`).
- `mr_csum_man_match_stats_hist` / `mr_csum_man_match_details` / `mr_csum_netting_hist`:
  composite `(agent_code, stmt_date)`.

Default (no-volume) applies create **no** indexes — 5 rows don't need them, and the canonical
schema files stay unchanged. Indexes exist only when volume does.

## `--verify` Volume-Awareness

- `--verify` alone: unchanged — exact canonical counts (`rectrace_core == 5`, etc.), `es._count ==
  5`, hyphen probes `== 1`.
- `--verify --volume N`: expected counts recompute as `base + multiplier(N)`, where the multiplier
  functions are **imported from `volume.py`** (one source of truth). Hyphen `.keyword` probes stay
  exact `== 1` in both modes (anchors preserved, volume avoids reserved identifiers).

## ES Specifics

- Each generated doc carries a unique `job_name` ⇒ unique `_id` (no upsert collisions).
- The existing `apply_elasticsearch` completion-suggester enrichment (`*_suggest` fields fed from
  source columns) is applied to volume docs too, via the same `suggest_source` map — volume reuses
  the existing bulk-doc shaping, just sourced from the generator instead of the NDJSON file.
- Bulk in chunks (`chunk_size ≈ 2000`), single `refresh` at the end of the phase.

## Files Touched (all in `../rectrace-local-dev/`)

- **New:** `volume.py` — value pools, deterministic entity generator, Oracle `executemany` +
  ES `helpers.bulk` append, index DDL, and the multiplier constants/functions shared with verify.
- **Modify:** `apply.py` — add `--volume [N]` arg; call `volume.append(...)` after the apply
  phases; make `verify()` volume-aware by importing multipliers from `volume.py`.
- **Modify:** `README.md` and `data/scenarios.md` — document the opt-in flag and the volume model.

## Testing & Verification

1. `apply.py` with **no flag** still produces exactly the canonical counts (run `--verify`, expect
   all `ok`). Regression guard: default behaviour unchanged.
2. `apply.py --volume 2000` (small N, fast) then `--verify --volume 2000`: all counts match the
   computed expectations; hyphen probes return exactly 1.
3. **Determinism:** run `--volume 2000` twice; `rectrace_core` row count and ES doc count identical,
   and a spot-checked sample of generated `job_name`s identical across runs.
4. **Anchor preservation:** after `--volume`, the 5 canonical `job_name`s and the hyphen `.keyword`
   probes still resolve to exactly their original rows.
5. **Full-scale smoke:** `apply.py --volume 200000` completes within a tolerable window on the
   local stack; React search grid renders, scrolls, groups, and paginates against the volume.
6. Existing `scripts/smoke-*.sh` in `autosys-job-explorer` continue to pass against a default
   (no-volume) apply.

## Risks & Mitigations

- **Load time at N=200k** — `executemany` batches (~5k) + bulk chunks keep it to minutes; opt-in
  means you only pay when you ask. Mitigation: report per-table progress + total elapsed.
- **Oracle Free resource pressure** — bounded TLM/quickrec sizing + total ≈1.0–1.3M rows keeps
  well inside the envelope.
- **Verify drift** — multipliers live once in `volume.py`, imported by both the generator and
  verify, so they cannot diverge.
- **Accidental anchor collision** — explicit reserved-identifier blocklist in the generator,
  asserted by test #4.
