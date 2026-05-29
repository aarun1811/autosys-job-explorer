# Execution Order "View" — Fix + React Flow Modal Design

**Date:** 2026-05-27
**Status:** Approved (design)
**Author:** brainstorming session

## Problem

The "View" button in the React search grid's Execution Order column (`frontend-react`,
`ExecutionOrderCellRenderer`) throws on click. The backend returns **500** because of
`ORA-00942: table or view "RECTRACE"."AUTOSYS_TLM_RECON_SEQUENCES" does not exist`.

On success the modal is also still a placeholder (`<pre>{JSON.stringify(...)}</pre>`)
— the real graph modal was deferred. The Angular app renders a proper Cytoscape
execution-order graph; the React side needs equivalent (and more polished) functionality.

## Root cause (confirmed empirically)

`ExecutionOrderService.getExecutionOrder()` runs two native queries through the JPA
`@PersistenceContext EntityManager em`, which is bound to the **main / rectrace**
datasource:

- `ExecutionOrderService.java:59` → `SELECT ... FROM AUTOSYS_TLM_RECON_SEQUENCES ...`
- `ExecutionOrderService.java:100` → `SELECT ... FROM AUTOSYS_ALL_JOBS_DATA ad LEFT JOIN ... WHERE ad.insert_job IN :jobNames`

The only thing in this service that uses the dedicated `autosysDataSource` is the live
**status** lookup, delegated to `JobStatusService` (`ujo_job` / `ujo_job_status`). So the
two execution-order tables are read over the **rectrace** connection by design.

The local-dev seed, however, creates those two tables under the **autosys** schema
(`schema/02-autosys.sql:5` — *"Owned by the AUTOSYS schema user."*), guessing from the
`AUTOSYS_` name prefix. No grant or synonym bridges them to rectrace.

Live DB confirmation (`localhost:1521/FREEPDB1`):

| Table | Owner | rectrace conn |
|---|---|---|
| `AUTOSYS_TLM_RECON_SEQUENCES` | AUTOSYS | ORA-00942 (reproduced) |
| `AUTOSYS_ALL_JOBS_DATA` | AUTOSYS | ORA-00942 (reproduced) |
| `UJO_JOB`, `UJO_JOB_STATUS` | AUTOSYS | (correct — read via `autosysDataSource`) |
| `RECTRACE_CORE` | RECTRACE | OK |

**The bug is in the local-dev seed, not the backend.** The `AUTOSYS_` prefix is a domain
name, not a schema location; these two are staged copies the app reads from its own
(rectrace) schema. The genuinely-live Autosys tables (`ujo_*`) correctly stay in autosys.

**No production backend change.** Fix is seed-only.

## Decisions

- **Part A fix:** move the two tables into the **RECTRACE** schema (chosen over keeping
  them in autosys with a grant + synonym, which would add moving parts re-issued every
  `--reset`). Model: the app's main schema owns the staging tables it queries.
- **Part B graph library:** **React Flow (`@xyflow/react`) + dagre** (chosen over a 1:1
  Cytoscape port). React Flow nodes are real DOM, so they inherit the app's premium
  shadcn / oklch / Geist design system directly; Cytoscape (canvas) would force the
  Material look to be rebuilt in JS style objects. The data is a short linear chain, so
  React Flow's DOM rendering is comfortably performant and the parity risk is small.
- **`command` / `description`:** stay empty (backend returns `""`; Angular shows them
  empty too). Re-enabling the CLOBs is out of scope — a trivial optional follow-up.
- **Micro-defaults** (easy to flip): wheel = zoom (React Flow standard, not Angular's
  wheel-pan); keep the MiniMap (free, helps long chains).

## Scope & branch strategy

Two parts, one spec. **Part A unblocks Part B** (the modal needs the endpoint returning
data).

- **Part A** folds into the existing `feature/volume-seed-data` branch in
  `../rectrace-local-dev/` — it corrects the same seed and edits the volume generator.
- **Part B** is a new branch in `frontend-react` (main repo).

## Part A — seed correction (move two tables to RECTRACE)

All changes in sibling repo `../rectrace-local-dev/`:

1. **DDL** — move the `CREATE TABLE` (and idempotent `DROP`) for
   `autosys_tlm_recon_sequences` and `autosys_all_jobs_data` from
   `schema/02-autosys.sql` → `schema/01-rectrace.sql` (created as the rectrace user).
   `ujo_job` / `ujo_job_status` stay in `02-autosys.sql`.
2. **Canonical inserts** — move the rows for those two tables from
   `data/02-autosys-inserts.sql` → `data/01-rectrace-inserts.sql`.
3. **`volume.py`** — emit the two tables' generated rows on the **rectrace** connection
   (`conns_by_schema['rectrace']`), not autosys. `ujo_*` volume rows stay on autosys.
4. **`apply.py` verify** — re-point the expected-count checks for those two tables to the
   rectrace schema so `--verify` stays accurate.

**Verification:** `apply.py --reset` then `--volume N` then `--verify --volume N`:
- rectrace connection can `SELECT COUNT(*)` from both tables;
- per-table counts match `expected_counts(N)`;
- hyphen anchors (`SET-ABC-123`, `LOAD-ABC-123`) still return exactly 1;
- `GET /rectrace/api/execution-order/{load_job}` returns HTTP 200 with a non-empty
  `executionSequence` (was 500).

## Part B — React Flow execution-order modal

### Data contract (mirror the backend DTO)

`ExecutionOrderDTO` (unchanged on the backend):

```
loadJob: string
executionSequence: { jobName: string; loadJob: string; executionOrder: number }[]
jobDetails: Record<jobName, {
  jobType: string; machine: string; runCalendar: string;
  excludeCalendar: string; boxName: string; command: string; description: string
}>
jobStatuses: Record<jobName, {
  jobName: string; status: number | null; statusName: string;
  nextStartEpoch: number | null; nextStartFormatted: string | null;
  isScheduledToday: boolean; isCurrentlyActive: boolean;
  visualState: 'COMPLETED' | 'FAILED' | 'RUNNING' | 'WAITING' | 'INACTIVE'
}> | null
statusAvailable: boolean
```

Status lookup by job name is **case-insensitive** (mirror Angular).

### Components — new dir `frontend-react/src/search/execution-order/`

- **`types.ts`** — TypeScript mirror of the DTO above + the `VisualState` union.
- **`layout.ts`** — dagre top-to-bottom layout: `executionSequence` → React Flow nodes
  (with computed x/y) + edges connecting `job[i] → job[i+1]`. Pure function, unit-tested.
- **`JobFlowNode.tsx`** — custom React Flow node: shadcn card with a hairline border, a
  lucide CMD (`code`) / BOX (`folder`) icon, the job name in Geist Mono, an optional
  second line `(StatusName)`, status-tinted background/border via CSS token classes,
  `primary` ring when selected.
- **`ExecutionOrderGraph.tsx`** — `<ReactFlow>` with `nodeTypes={{ job: JobFlowNode }}`,
  `<Background variant="dots">`, `<Controls>`, `<MiniMap>`, `fitView`; emits the selected
  job up via `onSelect(jobName | null)`.
- **`StatusLegend.tsx`** — five token-colored dots (Completed/Failed/Running/Waiting/
  Inactive); rendered only when `statusAvailable`.
- **`JobDetailsPanel.tsx`** — for the selected job: name + type icon, a status badge +
  "Next Run", a list of Machine / Run Calendar / Exclude Calendar / Box Name; empty state
  ("Click on any job…") when nothing is selected.
- **`ExecutionOrderModal.tsx`** — wide `Dialog` (~`min(95vw, 1100px)` × ~85vh) with a
  header (network icon + "Job Execution Order" + the load-job chip) and a two-pane body
  (graph pane + ~360px details pane). Owns the selected-node state and adapts the DTO
  into graph + panel props.

### Modify

- **`ExecutionOrderCellRenderer.tsx`** — replace the placeholder `<pre>` Dialog body with
  `<ExecutionOrderModal data={responseData} jobName={jobName} />`. The existing
  fetch / loading-spinner / `reportRequestFailure` logic is unchanged. Removes the
  `TODO(Phase 4)` placeholder markers.

### Data flow

View click → `apiFetch('/rectrace/api/execution-order/{job}')` (existing, attaches
`X-Correlation-Id`) → DTO → `ExecutionOrderModal` → `layout.ts` builds nodes/edges →
`<ReactFlow>` renders → click a node → `JobDetailsPanel` shows that job's details + status.

### Visual design & tokens

`frontend-react/src/index.css` currently defers chart/data-viz tokens to "the first phase
that introduces a data-viz component" — this modal is it.

- Add five status tokens to `:root` and `.dark` (oklch): **completed** (green),
  **failed** (reuse `--destructive` red), **running** (`--primary` azure), **waiting**
  (amber), **inactive** (muted gray). Node bg/border/text derive from these via
  `color-mix` in component CSS — no hex literals, auto light/dark via the `.dark` cascade.
- Update `STATE.md` and `theme.ts` when adding tokens (required by the `index.css` note).
- React Flow dots background (replaces Angular's dated diagonal stripes); token-colored
  bezier edges with arrowheads; selected node = `primary` ring; details-panel slide-in via
  Motion, gated by `prefers-reduced-motion`.

### Error / empty / status-degraded states

- **Empty sequence** (endpoint returns `{}` — no rows): the modal shows "No execution
  sequence found for {job}" instead of a blank canvas.
- **`statusAvailable: false`** (live status fetch failed): hide the legend and status
  badges, render neutral (inactive-styled) nodes, show a subtle "live status unavailable"
  note. Mirrors Angular's `statusAvailable` gating.
- **Fetch failure:** existing `reportRequestFailure` toast (correlation id surfaced);
  modal does not open. Unchanged.

### Dependencies

Add to `frontend-react`: `@xyflow/react` (v12) and `dagre` (+ `@types/dagre`). No graph
library is present today.

## Testing (TDD)

### Part A — pytest, in `../rectrace-local-dev/`

- **Unit** (`tests/test_volume_unit.py`): the two execution-order generators emit rows
  destined for the **rectrace** schema (not autosys); `ujo_*` generators still target
  autosys.
- **Integration** (`tests/test_volume_integration.py`): after `apply.py`, the rectrace
  connection can `SELECT` both tables; counts match `expected_counts(N)`; a representative
  `load_job` returns a non-empty sequence.
- **End-to-end smoke:** `GET /rectrace/api/execution-order/{job}` → 200 with a non-empty
  `executionSequence` (regression for the 500).

### Part B — vitest, in `frontend-react/`

- `layout.ts`: correct node count; edges are exactly `job[i] → job[i+1]`; y is monotonic
  top-to-bottom.
- Status mapping: `VisualState` → token class; case-insensitive job-name status lookup.
- `JobDetailsPanel`: renders all fields; empty state; `statusAvailable: false` path.
- `ExecutionOrderModal`: adapts DTO → renders graph + legend gated by `statusAvailable`;
  empty-sequence state.
- `ExecutionOrderCellRenderer`: placeholder removed; modal opens with the graph on success;
  failure still toasts and does not open.
- **Optional Playwright:** click View on a real grid row → graph renders → click a node →
  details panel populates.

## Out of scope

- Re-enabling `command` / `description` CLOB reading (backend currently returns `""`).
- Any production datasource / topology change (the fix is local-dev-only).
- Branching execution graphs (the sequence is strictly linear: `job[i] → job[i+1]`).
