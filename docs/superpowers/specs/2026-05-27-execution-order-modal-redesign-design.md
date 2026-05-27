# Execution-Order Modal Redesign — Design Spec

**Date:** 2026-05-27
**Status:** Approved (brainstorm) — pending implementation plan
**Branch:** `milestone/modernization`
**Scope:** Slice 1 of a 3-slice roadmap (see §3)

---

## 1. Context & Problem

The execution-order "View" modal (`frontend-react/src/search/execution-order/`) was ported from the
Angular Cytoscape modal and currently renders the job sequence as a top-to-bottom React Flow graph
with a fixed right-hand details panel. It works, but:

- **It looks generic.** It needs real design conviction — a premium, refined-airy treatment
  (Stripe/Vercel lineage) consistent with the rest of the React surface.
- **A crosshair appears on node edges.** React Flow's connection `<Handle>`s advertise a "draw a
  connection" affordance even though the graph is read-only; the cursor becomes a crosshair near a
  node's mid-edge. This must be eliminated.
- **It under-uses the data.** The modal surfaces 8 static fields + a status tint, but Autosys holds
  far more that production-support and business users would value — most importantly the **last-run
  story** (when it ran, how long, did it fail, why, did it retry).
- **It is not as intuitive as it could be** for triage, navigation of long sequences, or reading the
  run's overall health at a glance.

The redesign reimagines the layout (not a reskin), fixes the crosshair, and surfaces the runtime gold.

## 2. Goals & Non-Goals

**Goals**
- A premium, intuitive, "wow" redesign that still works in light + dark within the existing
  shadcn/oklch CSS-variable token system (no raw hex — ESLint `no-restricted-syntax` is active).
- Eliminate the crosshair-on-edge affordance.
- Surface the last-run runtime data + `owner` so the modal answers incident questions, not just
  "what are this job's static settings."
- Make long (50-job) sequences navigable (quick-find + sensible zoom + smart initial focus).
- Read the run's overall health at a glance.

**Non-Goals (this slice)**
- True dependency-DAG rendering (deferred — see §3, §10).
- Live log content viewing (deferred — see §3, §10).
- SLA/schedule/application/group fields (`max_run_alarm`, `start_times`, `days_of_week`, etc.) — not
  in this slice's data scope.
- Authentication/authorization changes (Phase 9, unrelated).

## 3. Roadmap & Slicing

This redesign is **Slice 1** of a deliberately sequenced program. The order is risk-ordered: ship the
easy, high-value win first; save spike-heavy work for later.

1. **Slice 1 — Modal redesign + runtime gold (THIS SPEC).** Premium visual rebuild, crosshair fix,
   real zoom + smart focus, pipeline summary, quick-find, and the last-run runtime data + owner.
2. **Slice 2 — True dependency DAG.** Render the *actual* dependency graph derived from Autosys
   `condition`, made readable via **transitive reduction** (drops redundant transitive edges — the
   reason raw condition graphs look like hairballs). Requires the backend to expose dependency edges
   (adjacency), not just `exec_order`, and a spike on real production sequences to validate the
   reduced layout before committing. **RecViz integration is sequenced before this.**
3. **Slice 3 — Live log viewing.** Click `std_out_file`/`std_err_file` → fetch and show the actual
   log. Requires an access/security spike (shared mount vs. remote exec vs. `autosyslog` CLI vs. the
   AEWS REST API, which exposes paths but not content) and is best done after Phase 9 security.

**Why linear now, not DAG:** the linear order *is* a topological-sort flattening of the (eventually
reduced) DAG, so nothing built in Slice 1 is wasted when Slice 2 un-flattens it. The user's prior
experience is that raw `condition` graphs are unreadable because of over-specified dependencies;
transitive reduction is the named fix, but it deserves a spike on real data first.

## 4. Key Design Decisions

| Decision | Rationale |
|---|---|
| **Layout: "Persistent inspector" (Direction A)** — TB graph + always-present right inspector rail, with a header + summary strip stacked on top. | Incident triage needs the graph *and* the selected job's detail visible together. TB + vertical scroll fits long sequences. The "wow" comes from craft, not from hiding panels. |
| **Linear sequence, rendered as an ordered *rail*, not causal arrows.** | A topological sort flattens parallel branches into adjacency — so consecutive nodes often have *no* real dependency. Drawing arrowheads would assert a dependency we can't back up in Slice 1. A neutral spine communicates *order*, not causation. |
| **Color = each job's own last-run status; position = execution order.** These are two independent dimensions, stated explicitly to the user. | When statuses diverge (a later node green above/below a failed one) it must read as "different jobs, different last runs," not as a bug. A one-line hint ("↕ execution order · color = each job's last run") + per-job last-run timestamps in the inspector make this honest. |
| **Quiet ordinal (`#3`), not a bold "STEP 3" badge.** | The number is useful for orientation at scale and for referencing "the 14th job," but must not imply strict stepwise causality. |
| **Smart initial focus: open centered on the first FAILED node (else RUNNING, else top).** | In an incident the failure is on screen the instant the modal opens — no hunting through 50 nodes. A "fit-all" control is one click away. |
| **Progressive disclosure on the node: tint+icon always → hover popover (runtime gold) → click (full inspector).** | Keeps nodes scannable at 50 nodes while still making runtime data reachable without a click. |
| **Inspector leads with the Last-run card, not static metadata.** | "It failed — why?" is the first triage question. |
| **Runtime gold from the autosys schema; duration derived on the frontend.** | Reuses the datasource `JobStatusService` already owns; keeps formatting in one place. |

## 5. The Design

### 5.1 Modal shell / layout

Four regions, top to bottom inside the existing shadcn `Dialog` (`~85vh × min(95vw, 1100px)`):

1. **Header** — network icon, title "Job Execution Order", load-job chip (mono), a **pipeline-state
   pill** rolling up the whole run ("Healthy" / "Running" / "Attention — N failed"), close button.
2. **Summary strip** — a segmented progress bar (proportions by status) + counts
   ("7 jobs · 3 done · 1 running · 1 failed · 2 waiting") on the left; **quick-find** on the right.
   When `statusAvailable === false`, the strip collapses to a quiet "Live status unavailable" note.
3. **Graph canvas** — flexible width, fills remaining space (see §5.3).
4. **Inspector rail** — ~42% width (fixed, e.g. `360px`–`42%`), always present, scrolls independently
   (see §5.6).

### 5.2 Pipeline summary strip & state pill

- **Rollup** is derived (pure function) from `jobStatuses`: counts per `VisualState`, plus an overall
  state — `FAILED` present → "Attention — N failed"; else any `RUNNING` → "Running"; else all
  `COMPLETED`/none-pending → "Healthy"; else "Idle".
- The **segmented bar** shows proportions using the same five status tokens as the nodes.
- Hidden gracefully when status is unavailable.

### 5.3 The graph canvas

- **Layout:** dagre `rankdir: TB`, fixed-width colinear nodes (existing approach retained).
- **Spine:** React Flow edges between consecutive nodes (`job[i] → job[i+1]`), styled as a **neutral,
  muted rail** — *no* `markerEnd` arrowhead, `selectable: false`, `focusable: false`,
  `pointer-events: none`. Visually continuous because nodes are colinear. **Not status-tinted**
  (a tinted spine would re-imply status "flows" down the line).
- **Select-emphasis (passive):** when a node is selected/hovered, the edges adjacent to it
  (`source === sel || target === sel`) gently highlight and non-adjacent nodes dim slightly. Derived
  from the selected/hovered id — *not* a new interaction surface. The spine itself is never clickable.
- **Background:** subtle dotted grid.
- **Initial view:** readable zoom (fit-to-width with a `maxZoom` cap so a 3-node graph doesn't
  balloon), auto-centered on the **smart-focus node** (first `FAILED` → else first `RUNNING` → else
  the top node).
- **Gestures:** `panOnScroll` (scroll/trackpad pans — natural for a tall list); pinch / ⌘-wheel zooms.
- **Controls** (bottom-left): zoom in / out / fit-all / re-center-on-focus.
- **MiniMap** (bottom-right): only when `nodes.length > 12` (existing gate retained), themed via the
  `--xy-*` CSS vars already in `index.css`.

### 5.4 The node

- **Resting (one scannable line):** a left **status accent bar** (4px, status color) · quiet ordinal
  `#n` (muted, mono) · type glyph (CMD / BOX) · job name (mono, truncates with title tooltip) · status
  icon. Subtle status-tinted body. Tint **and** icon both encode status (colorblind-safe — never color
  alone).
- **Five states:** `COMPLETED` (success), `RUNNING`, `FAILED`, `WAITING`, `INACTIVE` (also the
  "unknown/no recent run" default). Mapping unchanged from `JobStatusInfo` /`statusConfig`.
- **Running** gets a soft glow + gentle pulse; all other states are still (the one moving thing is the
  one thing happening now). Pulse respects `prefers-reduced-motion`.
- **Hover** lifts the node (shadow) and reveals a **runtime popover** (overlay — no layout shift) with
  the runtime gold: status + exit code, duration, ended-at, retries used, run machine.
- **Selected** = focus ring; opens the inspector. **Click is the only node interaction.**
- **No connection handles are rendered interactive** → no crosshair (see §5.7).

### 5.5 Quick-find

- Lives on the right of the summary strip.
- Case-insensitive **substring** match on job name.
- Matched nodes get a focus ring; non-matches **dim** (never hidden — the spine stays intact).
- Canvas **auto-centers** on the match. `↑`/`↓` or `Enter` cycles multiple matches; a live counter
  shows "2 / 5". `Esc` or a clear button restores the default view.
- Selecting a match still opens it in the inspector.

### 5.6 The inspector rail

Order is triage-first:

1. **Identity** — type glyph + job name (mono, copy affordance) + status pill + next-run time.
2. **Last-run card** (the gold) — status-tinted left edge. Leads with three numbers:
   **duration · exit code · retries used** (`ntry`; the *configured* max `n_retrys` is an SLA field,
   out of scope this slice). Beneath: started/ended timestamps (formatted, IST), **run machine**,
   run number.
3. **Definition** — `owner`, `machine`, `box`, `run calendar`, `exclude calendar`. Sections/rows render
   only when data exists (no "N/A" noise). **Frontend wiring note:** `owner` arrives on the
   `JobStatusInfo`/`status` object (sourced from `ujo_job` via `JobStatusService`), *not* on
   `JobDetails` — `JobDetailsDTO` has no `owner`. Group it visually with definition fields but read it
   from `status`.
4. **Command** — monospace `<pre>`, horizontally scrollable, with a copy affordance.
5. **Description** — prose.

- **`run machine` vs definition `machine`** are shown distinctly when they differ (where it *actually*
  ran vs. where it's *defined* to run).
- **Empty state (nothing selected)** is a real **run overview** — load job, total job count, rollup
  state, and the longest-running job — plus a quiet "select a job for full detail" prompt. Not a dead
  prompt.
- Selection change animates with the existing Motion slide-in (keyed by job name), respecting
  `prefers-reduced-motion`.

### 5.7 Crosshair fix (root cause)

The crosshair is React Flow's connection-handle affordance. `nodesConnectable={false}` does **not**
suppress the per-`<Handle>` hover cursor. Fix:

- Render the node's `<Handle>`s as **non-interactive** (`isConnectable={false}` and/or
  `pointer-events: none`, kept only as edge anchor points), or omit visible handles and anchor edges
  via `sourcePosition`/`targetPosition`.
- Combined with `pointer-events: none` + `selectable: false` on the spine edges (§5.3), there are no
  connection affordances anywhere on the canvas.
- A regression test asserts no handle exposes a connection affordance (no `react-flow__handle`
  connectable element / crosshair class) on the node.

### 5.8 Motion

- Entrance: graph nodes stagger in (fade + small rise); inspector slides in on selection.
- Running-node pulse; hover lift; select ring; find dim/highlight transitions.
- All motion runs under the existing `LazyMotion` + `<MotionConfig reducedMotion="user">`; honors
  `prefers-reduced-motion`.

### 5.9 Theming / tokens

- All color via existing CSS variables / oklch tokens (the five `--status-*` tokens already exist;
  add accent-bar, popover-surface, neutral-spine, and pulse keyframes as needed). **No raw hex in
  TS/TSX** (ESLint enforced). React Flow themed via `--xy-*` vars (already in `index.css`).
- Verified in both light and dark.

## 6. Backend & data contract

**Source** (autosys schema — same `@Qualifier("autosysDataSource")` `JobStatusService` already uses):

- `ujo_job_status` → `last_start`, `last_end`, `run_num`, `ntry` (retries used), `exit_code`,
  `run_machine`
- `ujo_job` → `owner`

**Changes:**

1. **`JobStatusService`** — extend the SELECT (today `uj.job_name, ujs.status, ujs.next_start`) to also
   fetch the six `ujo_job_status` runtime columns + `uj.owner`. Same `LEFT JOIN ujo_job_status ON
   uj.joid = ujs.joid`. **The real coupling point is the `JobStatusInfo.fromDatabase(...)` factory**
   (today 3-arg: `jobName, status, nextStart`, called at `JobStatusService.java:67`) — it must grow
   to thread the seven new columns through (or be supplemented by builder/setters post-construction).
   The row mapper tolerates nulls (jobs with no run history return null runtime fields, not errors).
   `createDefaultStatus` (the not-found path, `JobStatusService.java:111`) uses the builder directly,
   so unset new fields are already null — no extra work there.
2. **`JobStatusInfo` DTO** — add fields, mirroring the existing `nextStartEpoch`/`nextStartFormatted`
   pattern: `lastStartEpoch`/`lastStartFormatted`, `lastEndEpoch`/`lastEndFormatted`, `exitCode`,
   `runNum`, `retries`, `runMachine`, `owner`. Epoch→formatted conversion follows the existing
   `next_start` formatting (`Instant.ofEpochSecond(...)`, IST). **Epochs are seconds, not millis**
   (the in-repo contract — `next_start` is epoch-seconds). **Duration is derived on the frontend** as
   `lastEndEpoch − lastStartEpoch` (seconds) and formatted there.
3. **`ExecutionOrderService`** — no query change; it already merges `JobStatusInfo` per job. The richer
   DTO flows straight through to the existing `/api/execution-order/{job}` payload.
4. **Frontend `types.ts`** — extend the `JobStatusInfo` interface to match the new wire shape; add a
   pure `formatDuration(startEpoch, endEpoch)` helper and a `rollup(jobStatuses)` helper.

**Graceful degradation:** `statusAvailable === false` still works — tints/runtime simply don't render;
the layout does not depend on live data.

## 7. Sibling-repo seed dependency (`../rectrace-local-dev`)

Local seed is minimal: `ujo_job (joid, job_name)`, `ujo_job_status (joid, status, next_start)`. To
exercise the runtime gold locally:

- **Schema (`schema/02-autosys.sql`)** — add columns: `ujo_job.owner VARCHAR2`; `ujo_job_status`
  `last_start NUMBER(19)`, `last_end NUMBER(19)`, `run_num NUMBER(10)`, `ntry NUMBER(10)`,
  `exit_code NUMBER(10)`, `run_machine VARCHAR2(80)`.
- **Data (`data/02-autosys-inserts.sql`)** — populate the new columns, **folding in the previously
  ephemeral step-status rows** so colors + runtime survive `apply.py --reset`. **Fix the status-code
  mapping while reseeding:** the current seed comments say "4=FAILURE" but
  `JobStatusInfo.mapStatusCodeToVisualState` maps `4→COMPLETED` and `5→FAILED` — so today no seeded
  row resolves to `FAILED`. Seed at least one job with status `5` (and a non-zero `exit_code`) so
  smart-focus ("first FAILED") and the "Attention — N failed" rollup are actually exercisable locally.
- Sibling repo tests updated. This mirrors the Part-A pattern (separate branch in
  `../rectrace-local-dev`).

## 8. Component architecture

Evolves the existing 8 files; adds a few focused ones. (Frontend root: `frontend-react/src/search/execution-order/`.)

| File | Create/Modify | Responsibility |
|---|---|---|
| `ExecutionOrderModal.tsx` | Modify | Shell: header + state pill, summary strip, body split (graph ‖ inspector). |
| `PipelineSummaryStrip.tsx` | Create | Segmented bar + counts + rollup state pill; hosts QuickFind. |
| `QuickFind.tsx` | Create | Search input, match cycling, exposes match-set + active match. |
| `ExecutionOrderGraph.tsx` | Modify | RF wrapper: smart-focus init, `panOnScroll`, controls, minimap gate, neutral non-interactive spine, find dim/highlight, crosshair fix. **Must wrap the graph body in `<ReactFlowProvider>`** (none exists today) so smart-focus/quick-find centering can call `setCenter`/`fitView` via `useReactFlow()` from a child — those hooks throw without the provider. |
| `JobFlowNode.tsx` | Modify | Redesigned node: accent bar, ordinal, glyph, status icon, running pulse, hover trigger, dim/highlight/selected states. |
| `NodeRuntimePopover.tsx` | Create | Hover card rendering the runtime gold. |
| `JobInspector.tsx` | Modify (rename from `JobDetailsPanel.tsx`) | Identity → last-run card → definition → command → description; copy affordances. |
| `RunOverview.tsx` | Create | Inspector empty-state (run overview). |
| `StatusLegend.tsx` | Modify | Restyle to match; five states. |
| `layout.ts` | Modify | dagre TB, non-arrow spine edges, focus-node pick, rollup, find-match — all pure. |
| `statusConfig.ts` | Modify | Five-state tokens + accent/pulse class refs. |
| `types.ts` | Modify | Extended `JobStatusInfo`; `formatDuration`, `rollup` helpers. |
| `index.css` | Modify | Accent-bar, popover-surface, neutral-spine tokens, pulse keyframes (no raw hex). |
| `renderers/ExecutionOrderCellRenderer.tsx` | Unchanged | Still passes fetched data into the modal. |

**Backend:** `JobStatusService.java` (query + `fromDatabase` factory), `JobStatusInfo.java` (fields),
**`JobStatusServiceTest.java` (Create — does not exist today).** The row mapper is currently an inline
lambda inside `getBatchJobStatus`; to unit-test the column→DTO mapping cleanly, extract it to a
named/package-private `RowMapper` (or test via the factory). **Sibling:** `schema/02-autosys.sql`,
`data/02-autosys-inserts.sql` (+ tests).

## 9. Testing strategy (TDD)

- **Pure logic (`layout.ts` + helpers)** — heaviest coverage: `buildGraphFromData` nodes/edges,
  focus-node selection (first failed → running → top), `rollup` counts + overall state, find-match
  filtering, `formatDuration`.
- **Node (`JobFlowNode`)** — renders all five states; accent bar + ordinal + glyph + status icon;
  hover reveals popover content; **regression: no connection/crosshair affordance**.
- **Inspector (`JobInspector`)** — last-run card numbers (duration/exit/retries); `run machine` vs
  `machine` distinction; conditional sections; empty-state run overview; copy affordances.
- **Strip (`PipelineSummaryStrip`)** — rollup counts + state pill; `statusAvailable=false` collapse.
- **QuickFind** — match count, cycle, clear, dim/highlight wiring.
- **Graph (`ExecutionOrderGraph`)** — minimap gate (existing), smart-focus invocation, edges
  non-interactive.
- **Backend (`JobStatusServiceTest`)** — mapping of the six runtime columns + owner; null tolerance;
  not-found default path nulls.
- Existing execution-order tests updated and kept green.

## 10. Out of scope / deferred

- **True dependency DAG + transitive reduction** → Slice 2 (after RecViz).
- **Live log content viewing** → Slice 3 (after a access/security spike + Phase 9).
- **SLA fields** (`max_run_alarm`, `min_run_alarm`, `term_run_time`, configured `n_retrys`),
  **schedule** (`start_times`, `days_of_week`, `run_window`, `timezone`), **`application`/`group`**,
  **`permission`**, **`std_out_file`/`std_err_file`** paths → not this slice's data scope.
- **`condition` dependency edges** → required by Slice 2, not fetched here.

## 11. Risks & mitigations

- **Exact autosys column names/types** for `last_start`, `last_end`, `exit_code`, `run_num`, `ntry`,
  `run_machine`, and the location of `owner` must be confirmed against the real Autosys schema (the
  Broadcom `ujo_job_status` reference is the basis but versions differ). *Mitigation:* confirm at
  implementation; the seed defines the local contract; null-tolerant mapping.
- **Long-sequence performance** (50+ nodes, dim/highlight, popovers). *Mitigation:* memoized derived
  data, overlay popover (no reflow), virtualization not needed at these counts.
- **Divergent status confusion** (color vs. order). *Mitigation:* neutral spine, "color = last run"
  hint, per-job last-run timestamps. Fully resolved only in Slice 2 with real edges + divergence
  flagging.
- **Cross-repo coordination** (frontend/backend/seed). *Mitigation:* split plans (§12); seed is the
  local contract.

## 12. Implementation planning note

When transitioning to `superpowers:writing-plans`, split into at least two independently testable
plans:

1. **Seed + backend** — sibling-repo seed columns/data, `JobStatusService` query + mapper,
   `JobStatusInfo` DTO, backend tests. (Unblocks the data contract.)
2. **Frontend redesign** — the component architecture in §8, consuming the extended contract.

Each plan executes via `superpowers:subagent-driven-development` with two-stage review per task.
