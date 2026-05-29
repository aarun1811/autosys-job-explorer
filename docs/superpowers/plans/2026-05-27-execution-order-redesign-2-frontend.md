# Execution-Order Modal Redesign — Plan 2: Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Run the *exact* verification command in each step and read its output before checking the box.

**Goal:** Reimagine the execution-order "View" modal (`frontend-react/src/search/execution-order/`) into a premium, intuitive "persistent-inspector" experience: a top-to-bottom ordered job *rail* (neutral non-arrow spine, **crosshair eliminated**) + an always-present inspector rail led by the last-run story, a header pipeline-state pill, a segmented summary strip, quick-find with auto-center, smart initial focus on the first failed/running job, and hover runtime popovers. All within the existing shadcn/oklch token system (no raw hex), light + dark, Motion under the app's `LazyMotion`/`reducedMotion="user"`.

**Architecture:** Evolves the existing self-contained `src/search/execution-order/` feature folder. Pure logic (`types.ts` helpers, `statusConfig.ts`, `layout.ts`) is built and unit-tested FIRST so React rendering can stay declarative. React Flow stays behind the `ExecutionOrderGraph` wrapper (tests mock `@xyflow/react` rather than fight jsdom layout). A new `<ReactFlowProvider>` wraps the graph body so a child can drive `setCenter`/`fitView` via `useReactFlow()` (those hooks throw without the provider — none exists today). The data contract (`JobStatusInfo` extended with the runtime gold) is **consumed**, not defined here — it is delivered by the seed+backend plan; this plan only mirrors the wire shape in `types.ts` and derives `duration = lastEndEpoch − lastStartEpoch` on the frontend. All color flows through CSS variables / oklch / `color-mix` (`--status-*` tokens + new accent-bar / popover-surface / neutral-spine tokens + pulse keyframes); the cell renderer (`renderers/ExecutionOrderCellRenderer.tsx`) is unchanged — it already passes fetched data into the modal.

**Tech Stack:** React 19, `@xyflow/react` v12.10.2, `dagre` 0.8.5, shadcn `Dialog`/`Popover`/`Tooltip` (Tailwind v4, oklch tokens), `lucide-react`, `motion` v12 (`m.*` under `LazyMotion`/`MotionConfig reducedMotion="user"`), vitest 4 + @testing-library/react 16 (jsdom, `fireEvent` — no `user-event` in the repo).

**Working directory for all tasks:** `/Users/aarun/Workspace/Projects/autosys-job-explorer/frontend-react`
**Branch:** `milestone/modernization` (the current branch — commit directly here; do NOT create a new branch and do NOT push).
**Commands:** `pnpm test`, `pnpm typecheck`, `pnpm lint` (single test file: `pnpm exec vitest run <path>`).

**Prerequisite:** The seed+backend plan (Plan 1) lands the extended `JobStatusInfo` wire shape (`lastStartEpoch`, `lastStartFormatted`, `lastEndEpoch`, `lastEndFormatted`, `exitCode`, `runNum`, `retries`, `runMachine`, `owner`) and at least one seeded `FAILED` job. This plan's unit tests do **not** need the backend (they construct fixtures); only the final manual smoke (Task 16) does. If Plan 1 has not merged when execution starts, the frontend types/helpers/tests still pass against fixtures — the contract field names are fixed by the spec (§6.2) and treated as authoritative here.

**Data-contract facts baked into this plan (spec §6.2, fixed):**
- Epochs are **SECONDS** (the in-repo `next_start` convention).
- **Duration is derived on the frontend**: `lastEndEpoch − lastStartEpoch` (seconds), formatted by `formatDuration`.
- `owner` arrives on the `JobStatusInfo` / status object — **NOT** on `JobDetails` (`JobDetailsDTO` has no `owner`). The inspector groups `owner` visually with definition fields but reads it from `status`.
- Wire keys for the booleans stay `scheduledToday` / `currentlyActive` (Jackson strips the `is` prefix — verified against the existing `types.ts`).

---

## File Structure

All paths relative to `frontend-react/`. Pure logic first, then leaf components, then composites, then the shell, then CSS polish, then existing-test updates.

| File | Action | Responsibility |
|---|---|---|
| `src/search/execution-order/types.ts` | **Modify** | Extend `JobStatusInfo` with the nine runtime-gold fields; add pure helpers `formatDuration`, `rollup`, `findMatches`, `pickFocusNodeId`. The single source of the wire shape. |
| `src/search/execution-order/statusConfig.ts` | **Modify** | Five `VisualState` configs — keep `label`/`icon`/`nodeClassName`/`dotClassName`/`badgeClassName`; add `accentClassName` (left accent bar) and `pulse` flag (RUNNING only). |
| `src/search/execution-order/layout.ts` | **Modify** | `buildGraphFromData` (dagre TB) — emit **non-arrow neutral spine** edges (`type:'spine'`, `selectable:false`, `focusable:false`, no `markerEnd`), pass `ordinal` + runtime gold into node data, and emit `focusNodeId` (first FAILED → RUNNING → top) via `pickFocusNodeId`. Stays pure. |
| `src/search/execution-order/JobFlowNode.tsx` | **Modify** | Redesigned node: left accent bar, quiet ordinal `#n`, type glyph, mono name (truncate + title), status icon, RUNNING pulse, dim/highlight/selected, hover → `NodeRuntimePopover`. **Crosshair fix:** `<Handle isConnectable={false}>` + `pointer-events-none`. |
| `src/search/execution-order/NodeRuntimePopover.tsx` | **Create** | Hover card rendering the runtime gold: status + exit code, duration, ended-at, retries, run machine. Overlay (no layout shift). |
| `src/search/execution-order/RunOverview.tsx` | **Create** | Inspector empty-state: load job, total count, rollup state pill, longest-running job, "select a job" prompt. |
| `src/search/execution-order/StatusLegend.tsx` | **Modify** | Restyle to match; still five states + the "↕ order · color = last run" honesty hint. |
| `src/search/execution-order/JobInspector.tsx` | **Modify (rename from `JobDetailsPanel.tsx`)** | Identity → last-run card → definition (incl. `owner` from status) → command → description; copy affordances; empty state → `RunOverview`; Motion slide-in keyed by job name. |
| `src/search/execution-order/PipelineSummaryStrip.tsx` | **Create** | Segmented proportion bar + counts + rollup state pill; hosts `QuickFind`; collapses to a quiet note when `statusAvailable === false`. |
| `src/search/execution-order/QuickFind.tsx` | **Create** | Case-insensitive substring match input; match counter "2 / 5"; `↑`/`↓`/`Enter` cycle, `Esc`/clear restore; reports match-set + active id upward. |
| `src/search/execution-order/ExecutionOrderGraph.tsx` | **Modify** | Wrap body in `<ReactFlowProvider>`; `panOnScroll`; `fitView`+`maxZoom`; controls (zoom/fit/recenter); minimap gate (`>12`); neutral non-interactive spine + edge `spine` type; dim/highlight derived from selected/hovered/match; smart-focus + quick-find centering driven from an inner `<GraphView>` child via `useReactFlow()`. |
| `src/search/execution-order/ExecutionOrderModal.tsx` | **Modify** | Shell: header (network icon, title, mono load-job chip, **pipeline-state pill**, close), `PipelineSummaryStrip` (with QuickFind), body split graph ‖ `JobInspector`. Threads selection + hover + find state. |
| `src/index.css` | **Modify** | New token-driven classes: `.eo-accent-*` (4px left accent bar), `.eo-spine` edge path (neutral, no arrow), `.eo-popover-surface`, running-pulse `@keyframes eo-pulse` + `.eo-pulse` (reduced-motion stilled), node hover-lift. No raw hex. |
| `src/search/execution-order/JobDetailsPanel.tsx` | **Delete (renamed)** | Replaced by `JobInspector.tsx`. |
| `src/search/renderers/ExecutionOrderCellRenderer.tsx` | **Unchanged** | Still fetches + passes `ExecutionOrderData` into the modal — verified, no edit needed. |
| `src/search/execution-order/__tests__/*` | **Modify/Create** | New unit suites for the helpers, popover, run-overview, quick-find, strip; updated suites for node, inspector (renamed), graph, modal, legend. |

**Test files** (mirror the existing vitest + @testing-library style; `@xyflow/react` mocked per `__tests__/ExecutionOrderGraph.test.tsx`):
- Modify: `types.test.ts`, `statusConfig.test.ts`, `layout.test.ts`, `JobFlowNode.test.tsx`, `StatusLegend.test.tsx`, `ExecutionOrderGraph.test.tsx`, `ExecutionOrderModal.test.tsx`
- Rename: `JobDetailsPanel.test.tsx` → `JobInspector.test.tsx`
- Create: `NodeRuntimePopover.test.tsx`, `RunOverview.test.tsx`, `PipelineSummaryStrip.test.tsx`, `QuickFind.test.tsx`

---

### Task 1: Extend `JobStatusInfo` + add pure helpers (`formatDuration`, `rollup`, `findMatches`, `pickFocusNodeId`)

**Files:**
- Modify: `src/search/execution-order/types.ts`
- Modify: `src/search/execution-order/__tests__/types.test.ts`

- [ ] **Step 1: Add the failing tests for the extended shape + helpers**

Append to `src/search/execution-order/__tests__/types.test.ts` (keep the existing `isEmptyExecutionOrder` block; add imports + new describe blocks):

```ts
import { describe, test, expect } from 'vitest'
import {
  isEmptyExecutionOrder,
  formatDuration,
  rollup,
  findMatches,
  pickFocusNodeId,
  type ExecutionOrderData,
  type JobStatusInfo,
} from '../types'

function status(over: Partial<JobStatusInfo>): JobStatusInfo {
  return {
    jobName: 'J', status: null, statusName: '',
    nextStartEpoch: null, nextStartFormatted: null,
    lastStartEpoch: null, lastStartFormatted: null,
    lastEndEpoch: null, lastEndFormatted: null,
    exitCode: null, runNum: null, retries: null, runMachine: null, owner: null,
    scheduledToday: false, currentlyActive: false, visualState: 'INACTIVE',
    ...over,
  }
}

function order(seq: string[], statuses: Record<string, JobStatusInfo> | null): ExecutionOrderData {
  return {
    loadJob: 'L',
    executionSequence: seq.map((jobName, i) => ({ jobName, loadJob: 'L', executionOrder: i + 1 })),
    jobDetails: {}, jobStatuses: statuses, statusAvailable: statuses !== null,
  }
}

describe('formatDuration', () => {
  test('returns null when either epoch is null', () => {
    expect(formatDuration(null, 100)).toBeNull()
    expect(formatDuration(100, null)).toBeNull()
  })
  test('returns null for a negative or zero-length span', () => {
    expect(formatDuration(200, 100)).toBeNull()
  })
  test('formats seconds, minutes, and hours (epochs are SECONDS)', () => {
    expect(formatDuration(0, 45)).toBe('45s')
    expect(formatDuration(0, 90)).toBe('1m 30s')
    expect(formatDuration(0, 3600)).toBe('1h 0m')
    expect(formatDuration(0, 3661)).toBe('1h 1m')
  })
})

describe('rollup', () => {
  test('counts per visual state and reports overall FAILED first', () => {
    const r = rollup({
      a: status({ visualState: 'COMPLETED' }),
      b: status({ visualState: 'RUNNING' }),
      c: status({ visualState: 'FAILED' }),
    })
    expect(r.counts.FAILED).toBe(1)
    expect(r.counts.RUNNING).toBe(1)
    expect(r.counts.COMPLETED).toBe(1)
    expect(r.total).toBe(3)
    expect(r.overall).toBe('ATTENTION')
    expect(r.failedCount).toBe(1)
  })
  test('RUNNING when no failures but a run is in flight', () => {
    expect(rollup({ a: status({ visualState: 'RUNNING' }), b: status({ visualState: 'COMPLETED' }) }).overall).toBe('RUNNING')
  })
  test('HEALTHY when everything completed', () => {
    expect(rollup({ a: status({ visualState: 'COMPLETED' }) }).overall).toBe('HEALTHY')
  })
  test('IDLE when only waiting/inactive', () => {
    expect(rollup({ a: status({ visualState: 'WAITING' }), b: status({ visualState: 'INACTIVE' }) }).overall).toBe('IDLE')
  })
  test('null jobStatuses → zeroed rollup, IDLE', () => {
    const r = rollup(null)
    expect(r.total).toBe(0)
    expect(r.overall).toBe('IDLE')
  })
})

describe('findMatches', () => {
  const data = order(['PRE-LOAD-ABC', 'MAIN-LOAD-ABC', 'POST-XYZ'], null)
  test('case-insensitive substring on job name, in sequence order', () => {
    expect(findMatches(data, 'load')).toEqual(['PRE-LOAD-ABC', 'MAIN-LOAD-ABC'])
  })
  test('empty / whitespace query → no matches', () => {
    expect(findMatches(data, '')).toEqual([])
    expect(findMatches(data, '   ')).toEqual([])
  })
  test('no substring hit → empty', () => {
    expect(findMatches(data, 'zzz')).toEqual([])
  })
})

describe('pickFocusNodeId', () => {
  test('first FAILED wins over later RUNNING and the top node', () => {
    const data = order(['A', 'B', 'C'], {
      A: status({ visualState: 'COMPLETED' }),
      B: status({ visualState: 'FAILED' }),
      C: status({ visualState: 'RUNNING' }),
    })
    expect(pickFocusNodeId(data)).toBe('B')
  })
  test('first RUNNING when there is no FAILED', () => {
    const data = order(['A', 'B', 'C'], {
      A: status({ visualState: 'COMPLETED' }),
      B: status({ visualState: 'RUNNING' }),
    })
    expect(pickFocusNodeId(data)).toBe('B')
  })
  test('falls back to the top node when nothing failed or running', () => {
    const data = order(['A', 'B'], { A: status({ visualState: 'COMPLETED' }) })
    expect(pickFocusNodeId(data)).toBe('A')
  })
  test('null for an empty sequence', () => {
    expect(pickFocusNodeId(order([], null))).toBeNull()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/search/execution-order/__tests__/types.test.ts`
Expected: FAIL — `formatDuration`, `rollup`, `findMatches`, `pickFocusNodeId` are not exported; `lastStartEpoch` etc. are not on `JobStatusInfo` (TS errors in the fixture).

- [ ] **Step 3: Extend `JobStatusInfo` and add the helpers in `src/search/execution-order/types.ts`**

Replace the `JobStatusInfo` interface (lines 24–36) with the extended shape, and append the four helpers + `Rollup`/`OverallState` types at the end of the file. Full file:

```ts
/**
 * TypeScript mirror of the backend ExecutionOrderDTO
 * (com.citi.gru.rectrace.dto.ExecutionOrderDTO + JobStatusInfo).
 * The /rectrace/api/execution-order/{job} endpoint serializes exactly this shape.
 */
export type VisualState = 'COMPLETED' | 'FAILED' | 'RUNNING' | 'WAITING' | 'INACTIVE'

export interface JobNode {
  jobName: string
  loadJob: string
  executionOrder: number
}

export interface JobDetails {
  jobType: string
  machine: string
  runCalendar: string
  excludeCalendar: string
  boxName: string
  command: string
  description: string
}

export interface JobStatusInfo {
  jobName: string
  status: number | null
  statusName: string
  nextStartEpoch: number | null
  nextStartFormatted: string | null
  // --- Runtime gold (Plan 1 / spec §6.2). Epochs are SECONDS. Nullable: jobs
  // with no run history return null runtime fields, never errors. Duration is
  // NOT on the wire — it is derived on the frontend via formatDuration(). owner
  // arrives HERE (sourced from ujo_job), not on JobDetails. ---
  lastStartEpoch: number | null
  lastStartFormatted: string | null
  lastEndEpoch: number | null
  lastEndFormatted: string | null
  exitCode: number | null
  runNum: number | null
  retries: number | null
  runMachine: string | null
  owner: string | null
  // Jackson serializes the backend's boolean getters without the `is` prefix,
  // so the wire keys are `scheduledToday` / `currentlyActive` (verified against
  // the live payload).
  scheduledToday: boolean
  currentlyActive: boolean
  visualState: VisualState
}

export interface ExecutionOrderData {
  loadJob: string
  executionSequence: JobNode[]
  jobDetails: Record<string, JobDetails>
  jobStatuses: Record<string, JobStatusInfo> | null
  statusAvailable: boolean
}

/** True when the backend returned no sequence (empty DTO — no rows for the job). */
export function isEmptyExecutionOrder(
  data: ExecutionOrderData | null | undefined,
): boolean {
  return !data || !Array.isArray(data.executionSequence) || data.executionSequence.length === 0
}

/**
 * Format a run duration from two epoch-SECOND timestamps. Returns null when
 * either bound is missing or the span is non-positive (so callers render
 * nothing rather than "0s" / "NaN"). Duration is derived here — never on the
 * wire (spec §6.2).
 */
export function formatDuration(
  startEpoch: number | null | undefined,
  endEpoch: number | null | undefined,
): string | null {
  if (startEpoch == null || endEpoch == null) return null
  const secs = endEpoch - startEpoch
  if (secs <= 0) return null
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export type OverallState = 'ATTENTION' | 'RUNNING' | 'HEALTHY' | 'IDLE'

export interface Rollup {
  counts: Record<VisualState, number>
  total: number
  failedCount: number
  /** ATTENTION (any FAILED) → RUNNING (any RUNNING) → HEALTHY (any COMPLETED, none pending) → IDLE. */
  overall: OverallState
}

/** Pure status rollup for the summary strip + run overview. Null-tolerant. */
export function rollup(
  jobStatuses: Record<string, JobStatusInfo> | null | undefined,
): Rollup {
  const counts: Record<VisualState, number> = {
    COMPLETED: 0, FAILED: 0, RUNNING: 0, WAITING: 0, INACTIVE: 0,
  }
  const values = jobStatuses ? Object.values(jobStatuses) : []
  for (const v of values) counts[v.visualState] += 1
  const total = values.length
  let overall: OverallState
  if (counts.FAILED > 0) overall = 'ATTENTION'
  else if (counts.RUNNING > 0) overall = 'RUNNING'
  else if (counts.COMPLETED > 0) overall = 'HEALTHY'
  else overall = 'IDLE'
  return { counts, total, failedCount: counts.FAILED, overall }
}

/**
 * Case-insensitive substring match on job name, returned in execution order.
 * Empty / whitespace queries match nothing (the quick-find resting state).
 */
export function findMatches(
  data: ExecutionOrderData | null | undefined,
  query: string,
): string[] {
  const q = query.trim().toLowerCase()
  if (!q || !data) return []
  return data.executionSequence
    .filter((j) => j.jobName.toLowerCase().includes(q))
    .map((j) => j.jobName)
}

/**
 * Smart initial focus: the first FAILED job (incident lands on screen), else the
 * first RUNNING, else the top node. Null for an empty sequence.
 */
export function pickFocusNodeId(
  data: ExecutionOrderData | null | undefined,
): string | null {
  const seq = data?.executionSequence ?? []
  if (seq.length === 0) return null
  const stateOf = (name: string): VisualState =>
    data?.jobStatuses?.[name]?.visualState ?? 'INACTIVE'
  const failed = seq.find((j) => stateOf(j.jobName) === 'FAILED')
  if (failed) return failed.jobName
  const running = seq.find((j) => stateOf(j.jobName) === 'RUNNING')
  if (running) return running.jobName
  return seq[0].jobName
}
```

> Note: `pickFocusNodeId`/`rollup` index `jobStatuses` by the exact wire key for purity/simplicity in tests. The runtime case-insensitive lookup stays in `findJobStatus` (`statusConfig.ts`), which `layout.ts` uses to resolve node status — fixtures key statuses by exact job name, so both agree.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/search/execution-order/__tests__/types.test.ts`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add src/search/execution-order/types.ts src/search/execution-order/__tests__/types.test.ts
git commit -m "feat(react): extend JobStatusInfo with runtime gold + pure eo helpers

formatDuration / rollup / findMatches / pickFocusNodeId — all pure, unit-tested.
Duration derived on the frontend (lastEndEpoch - lastStartEpoch, seconds).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 2: Extend `statusConfig` with accent-bar class + pulse flag

**Files:**
- Modify: `src/search/execution-order/statusConfig.ts`
- Modify: `src/search/execution-order/__tests__/statusConfig.test.ts`

- [ ] **Step 1: Update the test to assert the two new config fields**

Replace the `STATUS_CONFIG` describe block in `src/search/execution-order/__tests__/statusConfig.test.ts` (keep the `findJobStatus` block + its fixture exactly as-is — the fixture already carries the runtime fields as optional via the extended interface, but add the runtime nulls so it typechecks). Full file:

```ts
import { describe, test, expect } from 'vitest'
import { STATUS_CONFIG, VISUAL_STATES, findJobStatus } from '../statusConfig'
import type { JobStatusInfo } from '../types'

describe('STATUS_CONFIG', () => {
  test('covers all five visual states with label + class names + accent + pulse', () => {
    expect(VISUAL_STATES).toEqual(['COMPLETED', 'FAILED', 'RUNNING', 'WAITING', 'INACTIVE'])
    for (const s of VISUAL_STATES) {
      const c = STATUS_CONFIG[s]
      expect(c.label.length).toBeGreaterThan(0)
      expect(c.nodeClassName).toBe(`eo-node-${s.toLowerCase()}`)
      expect(c.dotClassName).toBe(`eo-dot-${s.toLowerCase()}`)
      expect(c.badgeClassName).toBe(`eo-badge-${s.toLowerCase()}`)
      expect(c.accentClassName).toBe(`eo-accent-${s.toLowerCase()}`)
    }
  })
  test('only RUNNING pulses', () => {
    expect(STATUS_CONFIG.RUNNING.pulse).toBe(true)
    for (const s of VISUAL_STATES.filter((x) => x !== 'RUNNING')) {
      expect(STATUS_CONFIG[s].pulse).toBe(false)
    }
  })
})

describe('findJobStatus', () => {
  const statuses: Record<string, JobStatusInfo> = {
    'PRE-LOAD-ABC-123': {
      jobName: 'PRE-LOAD-ABC-123', status: 4, statusName: 'Success',
      nextStartEpoch: null, nextStartFormatted: null,
      lastStartEpoch: null, lastStartFormatted: null,
      lastEndEpoch: null, lastEndFormatted: null,
      exitCode: null, runNum: null, retries: null, runMachine: null, owner: null,
      scheduledToday: false, currentlyActive: false, visualState: 'COMPLETED',
    },
  }
  test('matches case-insensitively', () => {
    expect(findJobStatus(statuses, 'pre-load-abc-123')?.visualState).toBe('COMPLETED')
  })
  test('returns null when absent or when jobStatuses is null', () => {
    expect(findJobStatus(statuses, 'NOPE')).toBeNull()
    expect(findJobStatus(null, 'PRE-LOAD-ABC-123')).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/search/execution-order/__tests__/statusConfig.test.ts`
Expected: FAIL — `c.accentClassName` / `c.pulse` are `undefined`.

- [ ] **Step 3: Add `accentClassName` + `pulse` to `src/search/execution-order/statusConfig.ts`**

Replace the `StatusConfig` interface and `STATUS_CONFIG` map (keep `VISUAL_STATES` + `findJobStatus` unchanged):

```ts
import {
  CheckCircle2Icon, XCircleIcon, PlayCircleIcon, ClockIcon, PauseCircleIcon,
  type LucideIcon,
} from 'lucide-react'
import type { VisualState, JobStatusInfo } from './types'

export interface StatusConfig {
  label: string
  icon: LucideIcon
  /** All reference the eo-* token classes defined in src/index.css (no hex). */
  nodeClassName: string
  dotClassName: string
  badgeClassName: string
  /** Left accent-bar tint (4px rail) — eo-accent-* in index.css. */
  accentClassName: string
  /** RUNNING is the one moving thing on the canvas; everything else is still. */
  pulse: boolean
}

export const STATUS_CONFIG: Record<VisualState, StatusConfig> = {
  COMPLETED: { label: 'Completed', icon: CheckCircle2Icon, nodeClassName: 'eo-node-completed', dotClassName: 'eo-dot-completed', badgeClassName: 'eo-badge-completed', accentClassName: 'eo-accent-completed', pulse: false },
  FAILED:    { label: 'Failed',    icon: XCircleIcon,      nodeClassName: 'eo-node-failed',    dotClassName: 'eo-dot-failed',    badgeClassName: 'eo-badge-failed',    accentClassName: 'eo-accent-failed',    pulse: false },
  RUNNING:   { label: 'Running',   icon: PlayCircleIcon,   nodeClassName: 'eo-node-running',   dotClassName: 'eo-dot-running',   badgeClassName: 'eo-badge-running',   accentClassName: 'eo-accent-running',   pulse: true  },
  WAITING:   { label: 'Waiting',   icon: ClockIcon,        nodeClassName: 'eo-node-waiting',   dotClassName: 'eo-dot-waiting',   badgeClassName: 'eo-badge-waiting',   accentClassName: 'eo-accent-waiting',   pulse: false },
  INACTIVE:  { label: 'Inactive',  icon: PauseCircleIcon,  nodeClassName: 'eo-node-inactive',  dotClassName: 'eo-dot-inactive',  badgeClassName: 'eo-badge-inactive',  accentClassName: 'eo-accent-inactive',  pulse: false },
}

export const VISUAL_STATES: VisualState[] = ['COMPLETED', 'FAILED', 'RUNNING', 'WAITING', 'INACTIVE']

/** Look up a job's live status by name, case-insensitively (mirrors Angular). */
export function findJobStatus(
  jobStatuses: Record<string, JobStatusInfo> | null | undefined,
  jobName: string,
): JobStatusInfo | null {
  if (!jobStatuses) return null
  const lower = jobName.toLowerCase()
  for (const key of Object.keys(jobStatuses)) {
    if (key.toLowerCase() === lower) return jobStatuses[key]
  }
  return null
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/search/execution-order/__tests__/statusConfig.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/search/execution-order/statusConfig.ts src/search/execution-order/__tests__/statusConfig.test.ts
git commit -m "feat(react): add accent-bar class + pulse flag to eo statusConfig

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 3: Rework `layout.ts` — ordinal + runtime data, neutral spine edges, focus node

**Files:**
- Modify: `src/search/execution-order/layout.ts`
- Modify: `src/search/execution-order/__tests__/layout.test.ts`

- [ ] **Step 1: Update the layout test for ordinal, spine edges, runtime data, and focusNodeId**

Replace `src/search/execution-order/__tests__/layout.test.ts` (the fixture gains the runtime-gold nulls + one FAILED job so `focusNodeId` is exercised):

```ts
import { describe, test, expect } from 'vitest'
import { buildGraphFromData } from '../layout'
import type { ExecutionOrderData, JobStatusInfo } from '../types'

function status(over: Partial<JobStatusInfo>): JobStatusInfo {
  return {
    jobName: 'J', status: null, statusName: '',
    nextStartEpoch: null, nextStartFormatted: null,
    lastStartEpoch: null, lastStartFormatted: null,
    lastEndEpoch: null, lastEndFormatted: null,
    exitCode: null, runNum: null, retries: null, runMachine: null, owner: null,
    scheduledToday: false, currentlyActive: false, visualState: 'INACTIVE',
    ...over,
  }
}

function makeData(): ExecutionOrderData {
  return {
    loadJob: 'LOAD-ABC-123',
    executionSequence: [
      { jobName: 'PRE-LOAD-ABC-123', loadJob: 'LOAD-ABC-123', executionOrder: 1 },
      { jobName: 'MAIN-LOAD-ABC-123', loadJob: 'LOAD-ABC-123', executionOrder: 2 },
      { jobName: 'POST-LOAD-ABC-123', loadJob: 'LOAD-ABC-123', executionOrder: 3 },
    ],
    jobDetails: {
      'PRE-LOAD-ABC-123': { jobType: 'CMD', machine: 'm', runCalendar: '', excludeCalendar: '', boxName: 'BOX-ABC-123', command: '', description: '' },
    },
    jobStatuses: {
      'PRE-LOAD-ABC-123': status({ jobName: 'PRE-LOAD-ABC-123', status: 4, statusName: 'Success', visualState: 'COMPLETED' }),
      'MAIN-LOAD-ABC-123': status({ jobName: 'MAIN-LOAD-ABC-123', statusName: 'Failure', visualState: 'FAILED', exitCode: 1 }),
    },
    statusAvailable: true,
  }
}

describe('buildGraphFromData', () => {
  test('produces one node per sequence entry and chains spine edges i -> i+1', () => {
    const { nodes, edges } = buildGraphFromData(makeData())
    expect(nodes.map((n) => n.id)).toEqual(['PRE-LOAD-ABC-123', 'MAIN-LOAD-ABC-123', 'POST-LOAD-ABC-123'])
    expect(edges.map((e) => e.id)).toEqual(['PRE-LOAD-ABC-123__MAIN-LOAD-ABC-123', 'MAIN-LOAD-ABC-123__POST-LOAD-ABC-123'])
  })

  test('spine edges are neutral + non-interactive (no arrowhead, not selectable/focusable)', () => {
    const { edges } = buildGraphFromData(makeData())
    for (const e of edges) {
      expect(e.type).toBe('spine')
      expect(e.selectable).toBe(false)
      expect(e.focusable).toBe(false)
      expect(e.markerEnd).toBeUndefined()
    }
  })

  test('lays out top-to-bottom (monotonically increasing y in sequence order)', () => {
    const { nodes } = buildGraphFromData(makeData())
    expect(nodes[0].position.y).toBeLessThan(nodes[1].position.y)
    expect(nodes[1].position.y).toBeLessThan(nodes[2].position.y)
  })

  test('resolves node data: ordinal, label, jobType, isLoadJob, visualState, statusLabel, runtime', () => {
    const { nodes } = buildGraphFromData(makeData())
    const pre = nodes[0]
    expect(pre.data.ordinal).toBe(1)
    expect(pre.data.visualState).toBe('COMPLETED')
    expect(pre.data.statusLabel).toBe('Success')
    expect(pre.data.jobType).toBe('CMD')
    expect(pre.data.label).toBe('PRE-LOAD-ABC-123')
    expect(pre.data.isLoadJob).toBe(false)
    // The FAILED node threads its status object (runtime gold) for the popover.
    expect(nodes[1].data.status?.exitCode).toBe(1)
    expect(nodes[1].data.ordinal).toBe(2)
    // Jobs without a status default to INACTIVE with no status label + null status.
    expect(nodes[2].data.visualState).toBe('INACTIVE')
    expect(nodes[2].data.statusLabel).toBe('')
    expect(nodes[2].data.status).toBeNull()
  })

  test('focusNodeId is the first FAILED node', () => {
    expect(buildGraphFromData(makeData()).focusNodeId).toBe('MAIN-LOAD-ABC-123')
  })

  test('handles an empty sequence without throwing', () => {
    const empty: ExecutionOrderData = { loadJob: 'L', executionSequence: [], jobDetails: {}, jobStatuses: null, statusAvailable: false }
    expect(buildGraphFromData(empty)).toEqual({ nodes: [], edges: [], focusNodeId: null })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/search/execution-order/__tests__/layout.test.ts`
Expected: FAIL — `data.ordinal` / `data.status` / `edge.type === 'spine'` / `focusNodeId` not present.

- [ ] **Step 3: Rewrite `src/search/execution-order/layout.ts`**

```ts
import dagre from 'dagre'
import { Position, type Node, type Edge } from '@xyflow/react'
import type { ExecutionOrderData, VisualState, JobStatusInfo } from './types'
import { findJobStatus } from './statusConfig'
import { pickFocusNodeId } from './types'

export interface JobNodeData extends Record<string, unknown> {
  label: string
  ordinal: number
  jobType: string | undefined
  visualState: VisualState
  statusLabel: string
  isLoadJob: boolean
  /** Full status object (runtime gold) for the hover popover; null when no live status. */
  status: JobStatusInfo | null
}

export type FlowNode = Node<JobNodeData, 'job'>

const NODE_WIDTH = 240
const NODE_HEIGHT = 60

/**
 * Build React Flow nodes (dagre TB positions) + edges from the execution-order
 * DTO. The sequence is a topological flattening, so edges connect job[i] ->
 * job[i+1] as a NEUTRAL ORDER RAIL — not causal arrows: no markerEnd, and
 * selectable/focusable false so the spine is never an interaction surface
 * (spec §5.3). Also returns the smart-focus node id (first FAILED -> RUNNING ->
 * top). Pure — no DOM, safe to unit-test directly.
 */
export function buildGraphFromData(
  data: ExecutionOrderData,
): { nodes: FlowNode[]; edges: Edge[]; focusNodeId: string | null } {
  const sequence = data.executionSequence ?? []

  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'TB', nodesep: 28, ranksep: 44, marginx: 16, marginy: 16 })
  g.setDefaultEdgeLabel(() => ({}))

  for (const job of sequence) {
    g.setNode(job.jobName, { width: NODE_WIDTH, height: NODE_HEIGHT })
  }

  const edges: Edge[] = []
  for (let i = 0; i < sequence.length - 1; i++) {
    const source = sequence[i].jobName
    const target = sequence[i + 1].jobName
    g.setEdge(source, target)
    edges.push({
      id: `${source}__${target}`,
      source,
      target,
      type: 'spine',
      selectable: false,
      focusable: false,
      // No markerEnd — a neutral rail communicates ORDER, not causation.
    })
  }

  if (sequence.length > 0) {
    dagre.layout(g)
  }

  const nodes: FlowNode[] = sequence.map((job) => {
    const pos = g.node(job.jobName)
    const status = findJobStatus(data.jobStatuses, job.jobName)
    const visualState: VisualState = status?.visualState ?? 'INACTIVE'
    return {
      id: job.jobName,
      type: 'job',
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
      data: {
        label: job.jobName,
        ordinal: job.executionOrder,
        jobType: data.jobDetails?.[job.jobName]?.jobType,
        visualState,
        statusLabel: data.statusAvailable && status ? status.statusName : '',
        isLoadJob: job.jobName === data.loadJob,
        status: data.statusAvailable ? status : null,
      },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    }
  })

  return { nodes, edges, focusNodeId: pickFocusNodeId(data) }
}

/** Node/edge geometry exported for centering math (setCenter offset). */
export const NODE_SIZE = { width: NODE_WIDTH, height: NODE_HEIGHT }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/search/execution-order/__tests__/layout.test.ts`
Expected: PASS (6 passed).

- [ ] **Step 5: Commit**

```bash
git add src/search/execution-order/layout.ts src/search/execution-order/__tests__/layout.test.ts
git commit -m "feat(react): eo layout — ordinal + runtime data, neutral non-arrow spine, focus node

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 4: `index.css` — accent bars, neutral spine, popover surface, running pulse, node lift

**Files:**
- Modify: `src/index.css`

This task is CSS-only (config/styling — the TDD exception). It is sequenced before the components that consume the classes so their tests render against real styles. Verification is `pnpm lint` (the hex rule is the gate) + `pnpm build` (CSS parses).

- [ ] **Step 1: Append the new token-driven classes to `src/index.css`**

Append at the very end of the file (after the `.react-flow__controls { ... }` block), all token-driven (oklch / `color-mix` / RF `--xy-*` vars) — no raw hex:

```css
/* ================================================================
 * Execution-order redesign (Slice 1) — accent bars, neutral order-rail,
 * runtime popover surface, running pulse, hover lift. Token-driven, theme-aware,
 * reduced-motion stilled. No raw hex.
 * ================================================================ */

/* Left status accent bar (4px rail) — solid status token. */
.eo-accent-completed { background: var(--status-completed); }
.eo-accent-failed    { background: var(--status-failed); }
.eo-accent-running   { background: var(--status-running); }
.eo-accent-waiting   { background: var(--status-waiting); }
.eo-accent-inactive  { background: var(--status-inactive); }

/* Neutral order-rail (spine) edge — muted, NOT status-tinted, no arrowhead.
   Drives the custom `spine` edge type rendered by ExecutionOrderGraph. */
.eo-spine-path {
  stroke: color-mix(in oklab, var(--foreground) 18%, transparent);
  stroke-width: 1.5;
  fill: none;
  pointer-events: none; /* belt-and-suspenders: spine is a passive guide (spec §5.3) */
}
/* Adjacent-to-selection emphasis: passive highlight of the rail next to the
   active node; non-adjacent rails dim. Both derived from selected/hovered id. */
.eo-spine-path-active { stroke: color-mix(in oklab, var(--primary) 55%, transparent); }
.eo-spine-path-dim    { stroke: color-mix(in oklab, var(--foreground) 8%, transparent); }

/* Runtime hover popover surface — sits above the canvas, no layout shift. */
.eo-popover-surface {
  background: var(--popover);
  color: var(--popover-foreground);
  border: 1px solid var(--border);
  box-shadow:
    0 0 0 1px color-mix(in oklab, var(--foreground) 5%, transparent),
    0 10px 30px -12px color-mix(in oklab, var(--foreground) 28%, transparent);
}

/* Node hover lift — soft shadow toward the user (overlay popover handles content). */
.eo-node-lift { transition: box-shadow 180ms ease, transform 180ms ease; }
.eo-node-lift:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 22px -10px color-mix(in oklab, var(--foreground) 30%, transparent);
}

/* Find/select dimming — the spine stays intact; non-matches recede. */
.eo-node-dim { opacity: 0.42; transition: opacity 180ms ease; }

/* RUNNING glow + gentle pulse — the one moving thing is the one thing happening
   now. Stilled under prefers-reduced-motion by the global clamp in this file. */
@keyframes eo-pulse {
  0%, 100% { box-shadow: 0 0 0 0 color-mix(in oklab, var(--status-running) 42%, transparent); }
  50%      { box-shadow: 0 0 0 5px color-mix(in oklab, var(--status-running) 0%, transparent); }
}
.eo-pulse {
  animation: eo-pulse 2.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  box-shadow: 0 0 0 0 color-mix(in oklab, var(--status-running) 42%, transparent);
}

/* Segmented summary bar fills (proportions) — reuse the status palette. */
.eo-seg-completed { background: var(--status-completed); }
.eo-seg-failed    { background: var(--status-failed); }
.eo-seg-running   { background: var(--status-running); }
.eo-seg-waiting   { background: var(--status-waiting); }
.eo-seg-inactive  { background: var(--status-inactive); }
```

- [ ] **Step 2: Lint (hex rule + global) — no violations**

Run: `pnpm lint`
Expected: exit 0 — the new CSS uses only oklch/`color-mix`/`var(--…)`; no hex literals reach TS/TSX.

- [ ] **Step 3: Build to confirm the CSS parses**

Run: `pnpm build`
Expected: exit 0 (`tsc -b && vite build` — Tailwind v4 compiles the new rules; no PostCSS/parse error).

- [ ] **Step 4: Commit**

```bash
git add src/index.css
git commit -m "style(react): eo redesign tokens — accent bars, neutral spine, popover, pulse, lift

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 5: `NodeRuntimePopover` — the hover runtime-gold card (leaf)

**Files:**
- Create: `src/search/execution-order/NodeRuntimePopover.tsx`
- Create: `src/search/execution-order/__tests__/NodeRuntimePopover.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/search/execution-order/__tests__/NodeRuntimePopover.test.tsx`:

```tsx
import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NodeRuntimePopover } from '../NodeRuntimePopover'
import type { JobStatusInfo } from '../types'

function status(over: Partial<JobStatusInfo>): JobStatusInfo {
  return {
    jobName: 'MAIN-LOAD-ABC-123', status: 5, statusName: 'Failure',
    nextStartEpoch: null, nextStartFormatted: null,
    lastStartEpoch: 1_700_000_000, lastStartFormatted: 'Nov 14, 8:00 PM',
    lastEndEpoch: 1_700_000_125, lastEndFormatted: 'Nov 14, 8:02 PM',
    exitCode: 1, runNum: 42, retries: 2, runMachine: 'na-trade07', owner: 'svc_recon',
    scheduledToday: false, currentlyActive: false, visualState: 'FAILED',
    ...over,
  }
}

describe('NodeRuntimePopover', () => {
  test('renders the runtime gold: status, exit code, duration, ended-at, retries, run machine', () => {
    render(<NodeRuntimePopover status={status({})} />)
    expect(screen.getByText('Failure')).toBeInTheDocument()
    expect(screen.getByText(/exit 1/i)).toBeInTheDocument()
    // duration = 1_700_000_125 - 1_700_000_000 = 125s = "2m 5s"
    expect(screen.getByText('2m 5s')).toBeInTheDocument()
    expect(screen.getByText(/Nov 14, 8:02 PM/)).toBeInTheDocument()
    expect(screen.getByText(/2 retries/i)).toBeInTheDocument()
    expect(screen.getByText('na-trade07')).toBeInTheDocument()
  })

  test('omits rows whose data is null (no run history)', () => {
    render(
      <NodeRuntimePopover
        status={status({ lastStartEpoch: null, lastEndEpoch: null, lastEndFormatted: null, exitCode: null, retries: null, runMachine: null })}
      />,
    )
    expect(screen.queryByText(/exit/i)).toBeNull()
    expect(screen.queryByText(/retries/i)).toBeNull()
    expect(screen.getByTestId('eo-runtime-popover')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/search/execution-order/__tests__/NodeRuntimePopover.test.tsx`
Expected: FAIL — module `../NodeRuntimePopover` does not exist.

- [ ] **Step 3: Create `src/search/execution-order/NodeRuntimePopover.tsx`**

```tsx
import { TimerIcon, FlagTriangleRightIcon, RepeatIcon, ServerIcon, CircleDotIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { STATUS_CONFIG } from './statusConfig'
import { formatDuration, type JobStatusInfo } from './types'

interface Props {
  status: JobStatusInfo
}

function Line({ icon: Icon, children }: { icon: typeof TimerIcon; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 truncate">{children}</span>
    </div>
  )
}

/**
 * Hover runtime-gold card (overlay — no layout shift). Renders only the rows
 * whose data exists; jobs with no run history show just the status line. The
 * card surface + theming live in .eo-popover-surface (index.css). Duration is
 * derived here (formatDuration), never on the wire.
 */
export function NodeRuntimePopover({ status }: Props) {
  const cfg = STATUS_CONFIG[status.visualState]
  const duration = formatDuration(status.lastStartEpoch, status.lastEndEpoch)
  return (
    <div
      data-testid="eo-runtime-popover"
      className="eo-popover-surface w-60 rounded-md p-3 text-xs"
    >
      <div className="mb-2 flex items-center gap-1.5">
        <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium', cfg.badgeClassName)}>
          <cfg.icon className="size-3" />
          {status.statusName || cfg.label}
        </span>
        {status.exitCode != null && (
          <span className="font-mono text-[11px] text-muted-foreground">exit {status.exitCode}</span>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        {duration && <Line icon={TimerIcon}>Ran for <span className="font-medium">{duration}</span></Line>}
        {status.lastEndFormatted && <Line icon={FlagTriangleRightIcon}>Ended {status.lastEndFormatted}</Line>}
        {status.retries != null && status.retries > 0 && <Line icon={RepeatIcon}>{status.retries} retries used</Line>}
        {status.runMachine && <Line icon={ServerIcon}>{status.runMachine}</Line>}
        {status.runNum != null && <Line icon={CircleDotIcon}>Run #{status.runNum}</Line>}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/search/execution-order/__tests__/NodeRuntimePopover.test.tsx`
Expected: PASS (2 passed). (The `2 retries` row is exercised; the null-tolerant test hides exit/retries/machine.)

- [ ] **Step 5: Commit**

```bash
git add src/search/execution-order/NodeRuntimePopover.tsx src/search/execution-order/__tests__/NodeRuntimePopover.test.tsx
git commit -m "feat(react): NodeRuntimePopover — hover runtime-gold card

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 6: Redesign `JobFlowNode` — accent bar, ordinal, glyph, pulse, dim/highlight, crosshair fix

**Files:**
- Modify: `src/search/execution-order/JobFlowNode.tsx`
- Modify: `src/search/execution-order/__tests__/JobFlowNode.test.tsx`

- [ ] **Step 1: Rewrite the node test for the new structure + crosshair regression**

The `@xyflow/react` mock now captures `Handle` props so we can assert `isConnectable={false}` (the crosshair root-cause fix). Replace `src/search/execution-order/__tests__/JobFlowNode.test.tsx`:

```tsx
import type { ComponentProps } from 'react'
import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Capture Handle props so the crosshair regression can assert isConnectable=false.
const handleSpy = vi.fn()
vi.mock('@xyflow/react', () => ({
  Handle: (props: Record<string, unknown>) => {
    handleSpy(props)
    return null
  },
  Position: { Top: 'top', Bottom: 'bottom' },
}))

// NodeRuntimePopover is exercised in its own suite; render it inert here so the
// node test focuses on the resting node + hover trigger wiring.
vi.mock('../NodeRuntimePopover', () => ({
  NodeRuntimePopover: () => <div data-testid="eo-runtime-popover-mock" />,
}))

import { JobFlowNode } from '../JobFlowNode'
import type { JobNodeData } from '../layout'

function renderNode(data: Partial<JobNodeData>, selected = false) {
  handleSpy.mockClear()
  const full: JobNodeData = {
    label: 'PRE-LOAD-ABC-123', ordinal: 3, jobType: 'CMD', visualState: 'RUNNING',
    statusLabel: 'Running', isLoadJob: false, status: null, ...data,
  }
  const props = { data: full, selected } as unknown as ComponentProps<typeof JobFlowNode>
  return render(<JobFlowNode {...props} />)
}

describe('JobFlowNode', () => {
  test('renders the ordinal, job name, and applies the status node class', () => {
    renderNode({ visualState: 'COMPLETED', statusLabel: 'Success' })
    expect(screen.getByText('#3')).toBeInTheDocument()
    expect(screen.getByText('PRE-LOAD-ABC-123')).toBeInTheDocument()
    expect(screen.getByTestId('eo-node')).toHaveClass('eo-node-completed')
  })

  test('renders a left accent bar tinted by status', () => {
    renderNode({ visualState: 'FAILED' })
    expect(screen.getByTestId('eo-accent')).toHaveClass('eo-accent-failed')
  })

  test('pulses only when RUNNING', () => {
    renderNode({ visualState: 'RUNNING' })
    expect(screen.getByTestId('eo-node')).toHaveClass('eo-pulse')
    renderNode({ visualState: 'COMPLETED' })
    expect(screen.getByTestId('eo-node')).not.toHaveClass('eo-pulse')
  })

  test('applies the selected ring when selected', () => {
    renderNode({}, true)
    expect(screen.getByTestId('eo-node')).toHaveClass('ring-2')
  })

  test('dims when data.dimmed is set (quick-find non-match)', () => {
    renderNode({ dimmed: true } as Partial<JobNodeData>)
    expect(screen.getByTestId('eo-node')).toHaveClass('eo-node-dim')
  })

  // Crosshair root-cause regression (spec §5.7): Handles MUST be non-connectable,
  // otherwise React Flow advertises the connection (crosshair) affordance even
  // under nodesConnectable={false}.
  test('renders both handles as NON-connectable (no crosshair affordance)', () => {
    renderNode({})
    expect(handleSpy).toHaveBeenCalledTimes(2)
    for (const call of handleSpy.mock.calls) {
      expect(call[0].isConnectable).toBe(false)
    }
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/search/execution-order/__tests__/JobFlowNode.test.tsx`
Expected: FAIL — `#3` / `eo-accent` / `eo-pulse` / `isConnectable` not present in the current node.

- [ ] **Step 3: Rewrite `src/search/execution-order/JobFlowNode.tsx`**

`JobNodeData` gains an optional `dimmed` flag set by `ExecutionOrderGraph` (quick-find / select-emphasis). The node uses shadcn `Tooltip` for the truncated-name title and `HoverCard` semantics via `Popover` would need a controlled open; to keep the hover overlay cheap and test-friendly we render the popover via a native CSS-driven `group-hover` overlay (no Radix portal needed, no layout shift). Add `dimmed?: boolean` to `JobNodeData` in `layout.ts` first:

In `src/search/execution-order/layout.ts`, add `dimmed?: boolean` to the `JobNodeData` interface (it is set later by the graph, never by `buildGraphFromData`):

```ts
export interface JobNodeData extends Record<string, unknown> {
  label: string
  ordinal: number
  jobType: string | undefined
  visualState: VisualState
  statusLabel: string
  isLoadJob: boolean
  status: JobStatusInfo | null
  /** Set by ExecutionOrderGraph for quick-find / select-emphasis dimming (not by buildGraphFromData). */
  dimmed?: boolean
}
```

Then write `src/search/execution-order/JobFlowNode.tsx`:

```tsx
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { CodeIcon, FolderIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { STATUS_CONFIG } from './statusConfig'
import { NodeRuntimePopover } from './NodeRuntimePopover'
import type { FlowNode } from './layout'

/**
 * Redesigned execution-order node — one scannable line:
 *   [4px status accent bar] · #ordinal · type glyph · job name (mono, truncate) · status icon
 * Subtle status-tinted body; RUNNING glows + pulses; hover lifts and reveals the
 * runtime popover (overlay, no layout shift); selected shows a focus ring; quick-
 * find non-matches dim. Color AND icon both encode status (colorblind-safe).
 *
 * Crosshair fix (spec §5.7): the <Handle>s are isConnectable={false} +
 * pointer-events-none, kept ONLY as edge anchors — so React Flow never advertises
 * the connection/crosshair affordance (nodesConnectable={false} alone does not).
 */
export function JobFlowNode({ data, selected }: NodeProps<FlowNode>) {
  const cfg = STATUS_CONFIG[data.visualState]
  const TypeIcon = data.jobType === 'BOX' ? FolderIcon : CodeIcon
  const hasRuntime = data.status != null

  return (
    <div className={cn('group relative', data.dimmed && 'eo-node-dim')}>
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={false}
        className="!pointer-events-none !size-1 !border-0 !bg-transparent !opacity-0"
      />

      <div
        data-testid="eo-node"
        title={data.label}
        className={cn(
          'eo-node eo-node-lift relative flex w-[240px] items-center gap-2 overflow-hidden rounded-lg border py-2 pl-3 pr-2.5 text-xs shadow-sm',
          cfg.nodeClassName,
          cfg.pulse && 'eo-pulse',
          selected && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
        )}
      >
        <span
          data-testid="eo-accent"
          className={cn('absolute inset-y-0 left-0 w-1', cfg.accentClassName)}
          aria-hidden
        />
        <span className="ml-1 shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
          #{data.ordinal}
        </span>
        <TypeIcon className="size-3.5 shrink-0 opacity-70" aria-hidden />
        <span className="min-w-0 flex-1 truncate font-mono font-medium">{data.label}</span>
        <cfg.icon
          className={cn('size-3.5 shrink-0', `${cfg.dotClassName.replace('eo-dot-', 'text-')}`)}
          aria-label={cfg.label}
        />
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={false}
        className="!pointer-events-none !size-1 !border-0 !bg-transparent !opacity-0"
      />

      {hasRuntime && (
        <div className="pointer-events-none absolute left-1/2 top-full z-20 hidden -translate-x-1/2 translate-y-1.5 group-hover:block">
          <NodeRuntimePopover status={data.status!} />
        </div>
      )}
    </div>
  )
}
```

> Note on the status-icon color: `cfg.dotClassName` is `eo-dot-<state>`; `replace('eo-dot-', 'text-')` yields `text-<state>`, which is NOT a real Tailwind class — to keep this token-driven and avoid a fake class, replace the `cfg.icon` `className` with an inline style referencing the token. Use this instead for the icon (no hex, token via CSS var):

```tsx
        <cfg.icon
          className="size-3.5 shrink-0"
          style={{ color: `var(--status-${data.visualState.toLowerCase()})` }}
          aria-label={cfg.label}
        />
```

(Delete the `${cfg.dotClassName.replace(...)}` line; the inline `style` with `var(--status-*)` is token-driven and passes the hex lint rule, since it is a `var()` reference, not a hex literal.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/search/execution-order/__tests__/JobFlowNode.test.tsx`
Expected: PASS (6 passed) — including the two-handle `isConnectable={false}` regression.

- [ ] **Step 5: Lint the node (token-driven, no hex)**

Run: `pnpm exec eslint src/search/execution-order/JobFlowNode.tsx`
Expected: exit 0 — the only color is `var(--status-*)` (a string ref, not a hex literal).

- [ ] **Step 6: Commit**

```bash
git add src/search/execution-order/JobFlowNode.tsx src/search/execution-order/layout.ts src/search/execution-order/__tests__/JobFlowNode.test.tsx
git commit -m "feat(react): redesign JobFlowNode + crosshair fix (isConnectable=false handles)

Accent bar, ordinal, glyph, status icon, RUNNING pulse, hover runtime popover,
dim/select states. Handles kept only as non-connectable edge anchors.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 7: `RunOverview` — inspector empty-state (leaf)

**Files:**
- Create: `src/search/execution-order/RunOverview.tsx`
- Create: `src/search/execution-order/__tests__/RunOverview.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/search/execution-order/__tests__/RunOverview.test.tsx`:

```tsx
import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RunOverview } from '../RunOverview'
import type { ExecutionOrderData, JobStatusInfo } from '../types'

function status(over: Partial<JobStatusInfo>): JobStatusInfo {
  return {
    jobName: 'J', status: null, statusName: '',
    nextStartEpoch: null, nextStartFormatted: null,
    lastStartEpoch: null, lastStartFormatted: null,
    lastEndEpoch: null, lastEndFormatted: null,
    exitCode: null, runNum: null, retries: null, runMachine: null, owner: null,
    scheduledToday: false, currentlyActive: false, visualState: 'INACTIVE',
    ...over,
  }
}

const data: ExecutionOrderData = {
  loadJob: 'LOAD-ABC-123',
  executionSequence: [
    { jobName: 'A', loadJob: 'LOAD-ABC-123', executionOrder: 1 },
    { jobName: 'B', loadJob: 'LOAD-ABC-123', executionOrder: 2 },
    { jobName: 'C', loadJob: 'LOAD-ABC-123', executionOrder: 3 },
  ],
  jobDetails: {},
  jobStatuses: {
    A: status({ jobName: 'A', visualState: 'COMPLETED', lastStartEpoch: 0, lastEndEpoch: 30 }),
    B: status({ jobName: 'B', visualState: 'FAILED', lastStartEpoch: 0, lastEndEpoch: 600 }),
    C: status({ jobName: 'C', visualState: 'COMPLETED', lastStartEpoch: 0, lastEndEpoch: 90 }),
  },
  statusAvailable: true,
}

describe('RunOverview', () => {
  test('shows load job, total count, rollup state, and the longest-running job', () => {
    render(<RunOverview data={data} />)
    expect(screen.getByText('LOAD-ABC-123')).toBeInTheDocument()
    expect(screen.getByText(/3 jobs/i)).toBeInTheDocument()
    expect(screen.getByText(/attention/i)).toBeInTheDocument() // B is FAILED
    // Longest run = B (600s = 10m).
    expect(screen.getByText('B')).toBeInTheDocument()
    expect(screen.getByText('10m 0s')).toBeInTheDocument()
    expect(screen.getByText(/select a job/i)).toBeInTheDocument()
  })

  test('omits the longest-running row when no run has a duration', () => {
    render(<RunOverview data={{ ...data, jobStatuses: { A: status({ jobName: 'A', visualState: 'WAITING' }) }, statusAvailable: true }} />)
    expect(screen.queryByText(/longest run/i)).toBeNull()
    expect(screen.getByText(/select a job/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/search/execution-order/__tests__/RunOverview.test.tsx`
Expected: FAIL — module `../RunOverview` does not exist.

- [ ] **Step 3: Create `src/search/execution-order/RunOverview.tsx`**

```tsx
import { MousePointerClickIcon, LayersIcon, TimerIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { rollup, formatDuration, type ExecutionOrderData } from './types'

const OVERALL_LABEL: Record<ReturnType<typeof rollup>['overall'], string> = {
  ATTENTION: 'Attention',
  RUNNING: 'Running',
  HEALTHY: 'Healthy',
  IDLE: 'Idle',
}

const OVERALL_BADGE: Record<ReturnType<typeof rollup>['overall'], string> = {
  ATTENTION: 'eo-badge-failed',
  RUNNING: 'eo-badge-running',
  HEALTHY: 'eo-badge-completed',
  IDLE: 'eo-badge-inactive',
}

interface Props {
  data: ExecutionOrderData
}

/**
 * Inspector empty-state — a real run overview (load job · count · rollup state ·
 * longest-running job) plus a quiet "select a job" prompt. Not a dead prompt.
 */
export function RunOverview({ data }: Props) {
  const r = rollup(data.jobStatuses)
  const longest = Object.values(data.jobStatuses ?? {})
    .map((s) => ({ name: s.jobName, dur: formatDuration(s.lastStartEpoch, s.lastEndEpoch), secs: (s.lastEndEpoch ?? 0) - (s.lastStartEpoch ?? 0) }))
    .filter((x) => x.dur !== null)
    .sort((a, b) => b.secs - a.secs)[0]

  return (
    <div className="flex h-full flex-col gap-4 p-5" data-testid="eo-run-overview">
      <div>
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Run overview</div>
        <div className="mt-1 truncate font-mono text-sm font-medium">{data.loadJob}</div>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <LayersIcon className="size-4 text-muted-foreground" />
        <span>{data.executionSequence.length} jobs</span>
        {data.statusAvailable && (
          <span className={cn('ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', OVERALL_BADGE[r.overall])}>
            {OVERALL_LABEL[r.overall]}{r.failedCount > 0 ? ` — ${r.failedCount} failed` : ''}
          </span>
        )}
      </div>

      {longest && (
        <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <TimerIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Longest run</span>
          <span className="ml-auto truncate font-mono text-xs">{longest.name}</span>
          <span className="shrink-0 font-medium">{longest.dur}</span>
        </div>
      )}

      <div className="mt-auto flex items-center gap-2 text-xs text-muted-foreground">
        <MousePointerClickIcon className="size-4 opacity-60" />
        Select a job for full detail.
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/search/execution-order/__tests__/RunOverview.test.tsx`
Expected: PASS (2 passed). (`/longest run/i` is hidden in the second case because every status lacks a duration.)

- [ ] **Step 5: Commit**

```bash
git add src/search/execution-order/RunOverview.tsx src/search/execution-order/__tests__/RunOverview.test.tsx
git commit -m "feat(react): RunOverview — inspector empty-state run overview

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 8: Restyle `StatusLegend` + add the order/color honesty hint

**Files:**
- Modify: `src/search/execution-order/StatusLegend.tsx`
- Modify: `src/search/execution-order/__tests__/StatusLegend.test.tsx`

- [ ] **Step 1: Update the test to assert the five labels + the honesty hint**

Replace `src/search/execution-order/__tests__/StatusLegend.test.tsx`:

```tsx
import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusLegend } from '../StatusLegend'

describe('StatusLegend', () => {
  test('renders all five status labels', () => {
    render(<StatusLegend />)
    for (const label of ['Completed', 'Failed', 'Running', 'Waiting', 'Inactive']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  test('renders the order/color honesty hint', () => {
    render(<StatusLegend />)
    expect(screen.getByTestId('eo-order-hint')).toHaveTextContent(/execution order/i)
    expect(screen.getByTestId('eo-order-hint')).toHaveTextContent(/last run/i)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/search/execution-order/__tests__/StatusLegend.test.tsx`
Expected: FAIL — no `eo-order-hint` element.

- [ ] **Step 3: Rewrite `src/search/execution-order/StatusLegend.tsx`**

```tsx
import { ArrowDownUpIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { STATUS_CONFIG, VISUAL_STATES } from './statusConfig'

/**
 * Five token-colored dots keyed to the node status tints + the one-line honesty
 * hint that color = each job's last run, position = execution order (spec §4) —
 * so a green node below a failed one reads as "different jobs," not a bug.
 */
export function StatusLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5" data-testid="eo-legend">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {VISUAL_STATES.map((s) => {
          const c = STATUS_CONFIG[s]
          return (
            <span key={s} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className={cn('size-2 rounded-full', c.dotClassName)} />
              {c.label}
            </span>
          )
        })}
      </div>
      <span
        data-testid="eo-order-hint"
        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/80"
      >
        <ArrowDownUpIcon className="size-3" aria-hidden />
        execution order · color = each job&apos;s last run
      </span>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/search/execution-order/__tests__/StatusLegend.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/search/execution-order/StatusLegend.tsx src/search/execution-order/__tests__/StatusLegend.test.tsx
git commit -m "feat(react): restyle StatusLegend + order/color honesty hint

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 9: Rename `JobDetailsPanel` → `JobInspector` (triage-first: last-run card → definition → command → description)

**Files:**
- Rename: `src/search/execution-order/JobDetailsPanel.tsx` → `src/search/execution-order/JobInspector.tsx`
- Rename: `src/search/execution-order/__tests__/JobDetailsPanel.test.tsx` → `src/search/execution-order/__tests__/JobInspector.test.tsx`

- [ ] **Step 1: Rename both files via git (preserve history)**

```bash
git mv src/search/execution-order/JobDetailsPanel.tsx src/search/execution-order/JobInspector.tsx
git mv src/search/execution-order/__tests__/JobDetailsPanel.test.tsx src/search/execution-order/__tests__/JobInspector.test.tsx
```

- [ ] **Step 2: Rewrite the test for `JobInspector` (last-run card numbers, run-machine vs machine, owner from status, conditional sections, copy, empty → RunOverview)**

Replace `src/search/execution-order/__tests__/JobInspector.test.tsx`. `RunOverview` is mocked so the empty-state assertion is decoupled; `navigator.clipboard.writeText` is stubbed for the copy affordance:

```tsx
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../RunOverview', () => ({
  RunOverview: () => <div data-testid="eo-run-overview-mock" />,
}))

import { JobInspector } from '../JobInspector'
import type { JobDetails, JobStatusInfo, ExecutionOrderData } from '../types'

const details: JobDetails = {
  jobType: 'CMD', machine: 'na-trade01', runCalendar: 'DAILY_NA',
  excludeCalendar: 'NA_HOLIDAYS', boxName: 'BOX_TRADE_RECON_001', command: '', description: '',
}
const status: JobStatusInfo = {
  jobName: 'PRE_LOAD_TRADE_RECON_001', status: 5, statusName: 'Failure',
  nextStartEpoch: 1747084800, nextStartFormatted: 'May 12, 8:00 AM',
  lastStartEpoch: 1_700_000_000, lastStartFormatted: 'Nov 14, 8:00 PM',
  lastEndEpoch: 1_700_000_125, lastEndFormatted: 'Nov 14, 8:02 PM',
  exitCode: 1, runNum: 42, retries: 2, runMachine: 'na-trade07', owner: 'svc_recon',
  scheduledToday: true, currentlyActive: false, visualState: 'FAILED',
}

const overviewData: ExecutionOrderData = {
  loadJob: 'L', executionSequence: [], jobDetails: {}, jobStatuses: null, statusAvailable: false,
}

beforeEach(() => {
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
})

describe('JobInspector', () => {
  test('empty state renders the RunOverview (not a dead prompt)', () => {
    render(<JobInspector jobName={null} details={undefined} status={null} statusAvailable data={overviewData} />)
    expect(screen.getByTestId('eo-run-overview-mock')).toBeInTheDocument()
  })

  test('last-run card leads with duration · exit code · retries used', () => {
    render(<JobInspector jobName="PRE_LOAD_TRADE_RECON_001" details={details} status={status} statusAvailable data={overviewData} />)
    // duration = 125s = "2m 5s"
    expect(screen.getByText('2m 5s')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()       // exit code
    expect(screen.getByText('2')).toBeInTheDocument()       // retries used
    expect(screen.getByText(/Nov 14, 8:02 PM/)).toBeInTheDocument()
  })

  test('distinguishes run machine (where it ran) from definition machine (where it is defined)', () => {
    render(<JobInspector jobName="PRE_LOAD_TRADE_RECON_001" details={details} status={status} statusAvailable data={overviewData} />)
    expect(screen.getByText('na-trade07')).toBeInTheDocument() // run machine (last-run card)
    expect(screen.getByText('na-trade01')).toBeInTheDocument() // definition machine
  })

  test('owner reads from status (not JobDetails) and renders in the definition group', () => {
    render(<JobInspector jobName="PRE_LOAD_TRADE_RECON_001" details={details} status={status} statusAvailable data={overviewData} />)
    expect(screen.getByText('svc_recon')).toBeInTheDocument()
  })

  test('hides the last-run card when statusAvailable is false; definition fields still render', () => {
    render(<JobInspector jobName="PRE_LOAD_TRADE_RECON_001" details={details} status={status} statusAvailable={false} data={overviewData} />)
    expect(screen.queryByTestId('eo-last-run')).toBeNull()
    expect(screen.getByText('na-trade01')).toBeInTheDocument()
  })

  test('renders Command + Description only when present, and copies the command', () => {
    const withText: JobDetails = { ...details, command: '/scripts/run_pre.sh', description: 'Pre step for X' }
    const { rerender } = render(
      <JobInspector jobName="PRE_LOAD_TRADE_RECON_001" details={withText} status={null} statusAvailable={false} data={overviewData} />,
    )
    expect(screen.getByText('/scripts/run_pre.sh')).toBeInTheDocument()
    expect(screen.getByText('Pre step for X')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /copy command/i }))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('/scripts/run_pre.sh')

    rerender(<JobInspector jobName="PRE_LOAD_TRADE_RECON_001" details={details} status={null} statusAvailable={false} data={overviewData} />)
    expect(screen.queryByText('/scripts/run_pre.sh')).toBeNull()
    expect(screen.queryByText('Pre step for X')).toBeNull()
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm exec vitest run src/search/execution-order/__tests__/JobInspector.test.tsx`
Expected: FAIL — `JobInspector` still has the old `JobDetailsPanel` body/props (no `data` prop, no last-run card, no owner, exports wrong name).

- [ ] **Step 4: Rewrite `src/search/execution-order/JobInspector.tsx`**

```tsx
import {
  CodeIcon, FolderIcon, CalendarIcon, CalendarOffIcon, ServerIcon, BoxIcon,
  CalendarClockIcon, TerminalIcon, InfoIcon, CopyIcon, UserIcon, TimerIcon,
  HashIcon, RepeatIcon, FlagTriangleRightIcon, PlayIcon,
} from 'lucide-react'
import { m } from 'motion/react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import { STATUS_CONFIG } from './statusConfig'
import { RunOverview } from './RunOverview'
import { formatDuration, type JobDetails, type JobStatusInfo, type ExecutionOrderData } from './types'

interface Props {
  jobName: string | null
  details: JobDetails | undefined
  status: JobStatusInfo | null
  statusAvailable: boolean
  /** For the empty-state RunOverview. */
  data: ExecutionOrderData
}

function copy(value: string, label: string) {
  navigator.clipboard
    .writeText(value)
    .then(() => toast.success(`Copied ${label}`))
    .catch(() => toast.error('Copy failed'))
}

function Row({ icon: Icon, label, value }: { icon: typeof ServerIcon; label: string; value: string }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-2.5 border-b px-4 py-2.5 last:border-b-0">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="truncate text-sm">{value}</div>
      </div>
    </div>
  )
}

function Metric({ icon: Icon, label, value }: { icon: typeof TimerIcon; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-md border bg-card px-2 py-2 text-center">
      <Icon className="size-3.5 text-muted-foreground" aria-hidden />
      <div className="font-mono text-sm font-medium tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  )
}

/**
 * Inspector rail — triage-first order (spec §5.6):
 *   Identity → Last-run card (gold) → Definition (incl. owner from STATUS) →
 *   Command → Description. Sections render only when data exists (no "N/A" noise).
 * Empty (nothing selected) → a real RunOverview, not a dead prompt.
 * Slide-in keyed by job name; reduced-motion gated globally by MotionConfig.
 */
export function JobInspector({ jobName, details, status, statusAvailable, data }: Props) {
  if (!jobName || !details) {
    return <RunOverview data={data} />
  }

  const TypeIcon = details.jobType === 'BOX' ? FolderIcon : CodeIcon
  const cfg = status ? STATUS_CONFIG[status.visualState] : null
  const showLastRun = statusAvailable && status
  const duration = status ? formatDuration(status.lastStartEpoch, status.lastEndEpoch) : null

  return (
    <m.div
      key={jobName}
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="flex flex-col"
    >
      {/* Identity */}
      <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-3">
        <TypeIcon className="size-4 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0 flex-1 truncate font-mono text-sm font-medium" title={jobName}>{jobName}</span>
        {showLastRun && cfg && (
          <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', cfg.badgeClassName)}>
            <cfg.icon className="size-3" aria-hidden />
            {status.statusName}
          </span>
        )}
        <button
          type="button"
          aria-label="Copy job name"
          className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => copy(jobName, 'job name')}
        >
          <CopyIcon className="size-3.5" />
        </button>
      </div>

      {showLastRun && status.nextStartFormatted && (
        <div className="flex items-center gap-1.5 border-b px-4 py-2 text-xs text-muted-foreground">
          <CalendarClockIcon className="size-3.5" aria-hidden />
          Next run: {status.nextStartFormatted}
        </div>
      )}

      {/* Last-run card (the gold) — status-tinted left edge, three numbers lead. */}
      {showLastRun && (
        <div
          data-testid="eo-last-run"
          className={cn('relative border-b px-4 py-3', cfg && cfg.nodeClassName)}
        >
          {cfg && <span className={cn('absolute inset-y-0 left-0 w-1', cfg.accentClassName)} aria-hidden />}
          <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <PlayIcon className="size-3.5" aria-hidden />
            Last run
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Metric icon={TimerIcon} label="Duration" value={duration ?? '—'} />
            <Metric icon={FlagTriangleRightIcon} label="Exit code" value={status.exitCode != null ? String(status.exitCode) : '—'} />
            <Metric icon={RepeatIcon} label="Retries" value={status.retries != null ? String(status.retries) : '—'} />
          </div>
          <div className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
            {status.lastStartFormatted && <div className="flex items-center gap-1.5"><PlayIcon className="size-3" />Started {status.lastStartFormatted}</div>}
            {status.lastEndFormatted && <div className="flex items-center gap-1.5"><FlagTriangleRightIcon className="size-3" />Ended {status.lastEndFormatted}</div>}
            {status.runMachine && <div className="flex items-center gap-1.5"><ServerIcon className="size-3" />Ran on {status.runMachine}</div>}
            {status.runNum != null && <div className="flex items-center gap-1.5"><HashIcon className="size-3" />Run #{status.runNum}</div>}
          </div>
        </div>
      )}

      {/* Definition — owner reads from STATUS (not JobDetails); rows self-hide when empty. */}
      <Row icon={UserIcon} label="Owner" value={status?.owner ?? ''} />
      <Row icon={ServerIcon} label="Machine" value={details.machine} />
      <Row icon={BoxIcon} label="Box" value={details.boxName} />
      <Row icon={CalendarIcon} label="Run Calendar" value={details.runCalendar} />
      <Row icon={CalendarOffIcon} label="Exclude Calendar" value={details.excludeCalendar} />

      {/* Command */}
      {details.command && (
        <div className="border-b px-4 py-3 last:border-b-0">
          <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <span className="flex items-center gap-2"><TerminalIcon className="size-3.5" />Command</span>
            <button
              type="button"
              aria-label="Copy command"
              className="text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => copy(details.command, 'command')}
            >
              <CopyIcon className="size-3.5" />
            </button>
          </div>
          <pre className="overflow-x-auto rounded-md bg-muted/50 px-2.5 py-2 font-mono text-xs leading-relaxed whitespace-pre">{details.command}</pre>
        </div>
      )}

      {/* Description */}
      {details.description && (
        <div className="border-b px-4 py-3 last:border-b-0">
          <div className="mb-1.5 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <InfoIcon className="size-3.5" />
            Description
          </div>
          <p className="text-sm leading-relaxed">{details.description}</p>
        </div>
      )}
    </m.div>
  )
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm exec vitest run src/search/execution-order/__tests__/JobInspector.test.tsx`
Expected: PASS (6 passed).

> Note: the `exit code = 1` Metric and the `retries = 2` Metric both render single-digit values; the test uses `getByText('1')` / `getByText('2')`. Because the metric values are rendered as standalone `<div>{value}</div>` nodes and no other bare `1`/`2` text node exists in the inspector (timestamps are inside longer strings, run number is `Run #42`), these match uniquely. If a future change introduces a colliding bare digit, switch these to scoped `within(screen.getByTestId('eo-last-run'))` queries.

- [ ] **Step 6: Commit**

```bash
# `git mv` already staged the renames + deletions; -A captures the rename pair
# and the JobInspector edits cleanly (the JobDetailsPanel.tsx paths no longer
# exist on disk, so listing them explicitly would be a confusing no-op).
git add -A src/search/execution-order/
git commit -m "feat(react): JobInspector (rename JobDetailsPanel) — last-run card + owner + copy

Triage-first order: identity -> last-run card (duration/exit/retries) -> definition
(owner from status) -> command -> description. Empty state -> RunOverview.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 10: `QuickFind` — substring match, counter, cycle, clear (composite leaf)

**Files:**
- Create: `src/search/execution-order/QuickFind.tsx`
- Create: `src/search/execution-order/__tests__/QuickFind.test.tsx`

`QuickFind` is controlled by its parent (`PipelineSummaryStrip` → modal): it owns the query input + active-index state internally but reports the match array and the active match id upward via callbacks so the graph can center + dim.

- [ ] **Step 1: Write the failing test**

Create `src/search/execution-order/__tests__/QuickFind.test.tsx`:

```tsx
import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QuickFind } from '../QuickFind'
import type { ExecutionOrderData } from '../types'

const data: ExecutionOrderData = {
  loadJob: 'L',
  executionSequence: [
    { jobName: 'PRE-LOAD-ABC', loadJob: 'L', executionOrder: 1 },
    { jobName: 'MAIN-LOAD-ABC', loadJob: 'L', executionOrder: 2 },
    { jobName: 'POST-XYZ', loadJob: 'L', executionOrder: 3 },
  ],
  jobDetails: {}, jobStatuses: null, statusAvailable: false,
}

function setup() {
  const onActiveMatch = vi.fn()
  const onMatchesChange = vi.fn()
  render(<QuickFind data={data} onActiveMatch={onActiveMatch} onMatchesChange={onMatchesChange} />)
  return { onActiveMatch, onMatchesChange, input: screen.getByRole('textbox', { name: /find a job/i }) }
}

describe('QuickFind', () => {
  test('shows a live match counter and reports matches + first active match', () => {
    const { onActiveMatch, onMatchesChange, input } = setup()
    fireEvent.change(input, { target: { value: 'load' } })
    expect(screen.getByTestId('eo-find-counter')).toHaveTextContent('1 / 2')
    expect(onMatchesChange).toHaveBeenLastCalledWith(['PRE-LOAD-ABC', 'MAIN-LOAD-ABC'])
    expect(onActiveMatch).toHaveBeenLastCalledWith('PRE-LOAD-ABC')
  })

  test('Enter / ArrowDown cycles to the next match (wraps)', () => {
    const { onActiveMatch, input } = setup()
    fireEvent.change(input, { target: { value: 'load' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByTestId('eo-find-counter')).toHaveTextContent('2 / 2')
    expect(onActiveMatch).toHaveBeenLastCalledWith('MAIN-LOAD-ABC')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(screen.getByTestId('eo-find-counter')).toHaveTextContent('1 / 2') // wrap
  })

  test('no matches → "0 / 0" and reports empty + null active', () => {
    const { onActiveMatch, onMatchesChange, input } = setup()
    fireEvent.change(input, { target: { value: 'zzz' } })
    expect(screen.getByTestId('eo-find-counter')).toHaveTextContent('0 / 0')
    expect(onMatchesChange).toHaveBeenLastCalledWith([])
    expect(onActiveMatch).toHaveBeenLastCalledWith(null)
  })

  test('Escape / clear resets the query and restores the default view', () => {
    const { onActiveMatch, onMatchesChange, input } = setup()
    fireEvent.change(input, { target: { value: 'load' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect((input as HTMLInputElement).value).toBe('')
    expect(onMatchesChange).toHaveBeenLastCalledWith([])
    expect(onActiveMatch).toHaveBeenLastCalledWith(null)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/search/execution-order/__tests__/QuickFind.test.tsx`
Expected: FAIL — module `../QuickFind` does not exist.

- [ ] **Step 3: Create `src/search/execution-order/QuickFind.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react'
import { SearchIcon, XIcon } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { findMatches, type ExecutionOrderData } from './types'

interface Props {
  data: ExecutionOrderData
  /** The active match's job name (or null) — drives graph center + inspector. */
  onActiveMatch: (jobName: string | null) => void
  /** Full ordered match set — drives node dim/highlight. */
  onMatchesChange: (matches: string[]) => void
}

/**
 * Quick-find — case-insensitive substring on job name. Matched nodes get a focus
 * ring; non-matches dim (handled by the graph from the reported match set). A
 * live counter shows "2 / 5"; Enter / ArrowDown / ArrowUp cycle (wrapping);
 * Escape / clear restores the default view. Selecting a match centers + opens it.
 */
export function QuickFind({ data, onActiveMatch, onMatchesChange }: Props) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const matchesRef = useRef<string[]>([])

  // Recompute matches whenever the query (or data) changes; reset active to 0.
  useEffect(() => {
    const matches = findMatches(data, query)
    matchesRef.current = matches
    setActive(0)
    onMatchesChange(matches)
    onActiveMatch(matches.length > 0 ? matches[0] : null)
    // onMatchesChange / onActiveMatch are stable (useCallback in the parent).
  }, [query, data, onMatchesChange, onActiveMatch])

  const cycle = (delta: number) => {
    const matches = matchesRef.current
    if (matches.length === 0) return
    const next = (active + delta + matches.length) % matches.length
    setActive(next)
    onActiveMatch(matches[next])
  }

  const reset = () => {
    setQuery('')
    matchesRef.current = []
    setActive(0)
    onMatchesChange([])
    onActiveMatch(null)
  }

  const count = matchesRef.current.length
  const display = count > 0 ? `${active + 1} / ${count}` : '0 / 0'

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          aria-label="Find a job"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); cycle(1) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); cycle(-1) }
            else if (e.key === 'Escape') { e.preventDefault(); reset() }
          }}
          placeholder="Find a job"
          className="h-8 w-44 pl-7 pr-7 text-xs"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={reset}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <XIcon className="size-3.5" />
          </button>
        )}
      </div>
      {query && (
        <span data-testid="eo-find-counter" className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {display}
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/search/execution-order/__tests__/QuickFind.test.tsx`
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**

```bash
git add src/search/execution-order/QuickFind.tsx src/search/execution-order/__tests__/QuickFind.test.tsx
git commit -m "feat(react): QuickFind — substring match, counter, cycle, clear

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 11: `PipelineSummaryStrip` — segmented bar + counts + rollup pill + hosts QuickFind

**Files:**
- Create: `src/search/execution-order/PipelineSummaryStrip.tsx`
- Create: `src/search/execution-order/__tests__/PipelineSummaryStrip.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/search/execution-order/__tests__/PipelineSummaryStrip.test.tsx`. `QuickFind` is mocked so the strip test is decoupled from find logic:

```tsx
import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../QuickFind', () => ({
  QuickFind: () => <div data-testid="eo-quickfind-mock" />,
}))

import { PipelineSummaryStrip } from '../PipelineSummaryStrip'
import type { ExecutionOrderData, JobStatusInfo } from '../types'

function status(over: Partial<JobStatusInfo>): JobStatusInfo {
  return {
    jobName: 'J', status: null, statusName: '',
    nextStartEpoch: null, nextStartFormatted: null,
    lastStartEpoch: null, lastStartFormatted: null,
    lastEndEpoch: null, lastEndFormatted: null,
    exitCode: null, runNum: null, retries: null, runMachine: null, owner: null,
    scheduledToday: false, currentlyActive: false, visualState: 'INACTIVE',
    ...over,
  }
}

function data(statusAvailable: boolean, statuses: Record<string, JobStatusInfo> | null): ExecutionOrderData {
  return {
    loadJob: 'L',
    executionSequence: [
      { jobName: 'A', loadJob: 'L', executionOrder: 1 },
      { jobName: 'B', loadJob: 'L', executionOrder: 2 },
      { jobName: 'C', loadJob: 'L', executionOrder: 3 },
    ],
    jobDetails: {}, jobStatuses: statuses, statusAvailable,
  }
}

const noop = () => {}

describe('PipelineSummaryStrip', () => {
  test('renders counts and the rollup state pill (Attention — N failed)', () => {
    const d = data(true, {
      A: status({ visualState: 'COMPLETED' }),
      B: status({ visualState: 'RUNNING' }),
      C: status({ visualState: 'FAILED' }),
    })
    render(<PipelineSummaryStrip data={d} onActiveMatch={noop} onMatchesChange={noop} />)
    expect(screen.getByText(/3 jobs/i)).toBeInTheDocument()
    expect(screen.getByText(/1 done/i)).toBeInTheDocument()
    expect(screen.getByText(/1 running/i)).toBeInTheDocument()
    expect(screen.getByText(/1 failed/i)).toBeInTheDocument()
    expect(screen.getByTestId('eo-state-pill')).toHaveTextContent(/attention — 1 failed/i)
    expect(screen.getByTestId('eo-segbar')).toBeInTheDocument()
    expect(screen.getByTestId('eo-quickfind-mock')).toBeInTheDocument()
  })

  test('collapses to a quiet "Live status unavailable" note when statusAvailable is false', () => {
    render(<PipelineSummaryStrip data={data(false, null)} onActiveMatch={noop} onMatchesChange={noop} />)
    expect(screen.getByTestId('eo-status-unavailable')).toBeInTheDocument()
    expect(screen.queryByTestId('eo-segbar')).toBeNull()
    expect(screen.queryByTestId('eo-state-pill')).toBeNull()
    // QuickFind still available even with no live status.
    expect(screen.getByTestId('eo-quickfind-mock')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/search/execution-order/__tests__/PipelineSummaryStrip.test.tsx`
Expected: FAIL — module `../PipelineSummaryStrip` does not exist.

- [ ] **Step 3: Create `src/search/execution-order/PipelineSummaryStrip.tsx`**

```tsx
import { cn } from '@/lib/utils'
import { QuickFind } from './QuickFind'
import { rollup, type ExecutionOrderData, type OverallState, type VisualState } from './types'

const STATE_PILL_LABEL: Record<OverallState, string> = {
  ATTENTION: 'Attention',
  RUNNING: 'Running',
  HEALTHY: 'Healthy',
  IDLE: 'Idle',
}
const STATE_PILL_BADGE: Record<OverallState, string> = {
  ATTENTION: 'eo-badge-failed',
  RUNNING: 'eo-badge-running',
  HEALTHY: 'eo-badge-completed',
  IDLE: 'eo-badge-inactive',
}

// Segment fill class + count-label noun for each state, in display order.
const SEGMENTS: { state: VisualState; seg: string; noun: string }[] = [
  { state: 'COMPLETED', seg: 'eo-seg-completed', noun: 'done' },
  { state: 'RUNNING', seg: 'eo-seg-running', noun: 'running' },
  { state: 'FAILED', seg: 'eo-seg-failed', noun: 'failed' },
  { state: 'WAITING', seg: 'eo-seg-waiting', noun: 'waiting' },
  { state: 'INACTIVE', seg: 'eo-seg-inactive', noun: 'inactive' },
]

interface Props {
  data: ExecutionOrderData
  onActiveMatch: (jobName: string | null) => void
  onMatchesChange: (matches: string[]) => void
}

/**
 * Summary strip: a segmented proportion bar + counts + rollup state pill on the
 * left; quick-find on the right. When live status is unavailable it collapses to
 * a quiet note (the layout never depends on live data — spec §6 graceful degrade).
 */
export function PipelineSummaryStrip({ data, onActiveMatch, onMatchesChange }: Props) {
  const r = rollup(data.jobStatuses)
  const total = data.executionSequence.length
  const present = SEGMENTS.filter((s) => r.counts[s.state] > 0)

  return (
    <div className="flex items-center gap-4 px-5 py-2.5">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {data.statusAvailable ? (
          <>
            <div data-testid="eo-segbar" className="flex h-2 w-40 shrink-0 overflow-hidden rounded-full border bg-muted">
              {present.map((s) => (
                <span
                  key={s.state}
                  className={cn('h-full', s.seg)}
                  style={{ width: `${(r.counts[s.state] / Math.max(total, 1)) * 100}%` }}
                />
              ))}
            </div>
            <div className="min-w-0 truncate text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{total} jobs</span>
              {present.map((s) => (
                <span key={s.state}> · {r.counts[s.state]} {s.noun}</span>
              ))}
            </div>
            <span
              data-testid="eo-state-pill"
              className={cn('ml-1 shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', STATE_PILL_BADGE[r.overall])}
            >
              {STATE_PILL_LABEL[r.overall]}{r.failedCount > 0 ? ` — ${r.failedCount} failed` : ''}
            </span>
          </>
        ) : (
          <span data-testid="eo-status-unavailable" className="text-xs text-muted-foreground">
            Live status unavailable
          </span>
        )}
      </div>
      <QuickFind data={data} onActiveMatch={onActiveMatch} onMatchesChange={onMatchesChange} />
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/search/execution-order/__tests__/PipelineSummaryStrip.test.tsx`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add src/search/execution-order/PipelineSummaryStrip.tsx src/search/execution-order/__tests__/PipelineSummaryStrip.test.tsx
git commit -m "feat(react): PipelineSummaryStrip — segmented bar, counts, rollup pill, quick-find

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 12: Rework `ExecutionOrderGraph` — ReactFlowProvider, panOnScroll, controls, spine edge, dim/highlight, smart-focus + find centering

**Files:**
- Modify: `src/search/execution-order/ExecutionOrderGraph.tsx`
- Modify: `src/search/execution-order/__tests__/ExecutionOrderGraph.test.tsx`

This is the integration seam. The graph wraps its body in `<ReactFlowProvider>` so an inner `<GraphView>` child can call `useReactFlow()` (`setCenter`/`fitView`) — those hooks throw without the provider, and you cannot call `useReactFlow` in the same component that renders `<ReactFlow>` unless that component is itself inside the provider. The custom `spine` edge type renders a neutral `BaseEdge` with the `eo-spine-path` class (no marker). Dim/highlight is derived from `selected`/`hovered`/`matches` and pushed into node `data.dimmed`.

- [ ] **Step 1: Rewrite the graph test (mock the full RF surface incl. ReactFlowProvider + useReactFlow + BaseEdge)**

Replace `src/search/execution-order/__tests__/ExecutionOrderGraph.test.tsx`. The mock provides a `setCenter` spy and exposes it so we can assert smart-focus centering, captures node `data.dimmed` to assert non-match dimming, and renders children so the minimap gate is exercised:

```tsx
import type { ReactNode } from 'react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const setCenter = vi.fn()
const fitView = vi.fn()

vi.mock('@xyflow/react', () => ({
  ReactFlowProvider: ({ children }: { children?: ReactNode }) => <div data-testid="rf-provider">{children}</div>,
  ReactFlow: ({ nodes, children }: { nodes: { id: string; data: { dimmed?: boolean } }[]; children?: ReactNode }) => (
    <div
      data-testid="rf"
      data-node-count={nodes.length}
      data-dimmed={nodes.filter((n) => n.data.dimmed).map((n) => n.id).join(',')}
    >
      {children}
    </div>
  ),
  Background: () => null,
  BackgroundVariant: { Dots: 'dots' },
  Controls: ({ children }: { children?: ReactNode }) => <div data-testid="eo-controls">{children}</div>,
  ControlButton: ({ children, ...rest }: { children?: ReactNode }) => <button type="button" {...rest}>{children}</button>,
  MiniMap: () => <div data-testid="eo-minimap" />,
  BaseEdge: () => null,
  getSmoothStepPath: () => ['', 0, 0],
  Position: { Top: 'top', Bottom: 'bottom' },
  useReactFlow: () => ({ setCenter, fitView, getNode: (id: string) => ({ id, position: { x: 0, y: 0 }, width: 240, height: 60 }) }),
}))

import { ExecutionOrderGraph } from '../ExecutionOrderGraph'
import type { ExecutionOrderData, JobStatusInfo } from '../types'

function status(over: Partial<JobStatusInfo>): JobStatusInfo {
  return {
    jobName: 'J', status: null, statusName: '',
    nextStartEpoch: null, nextStartFormatted: null,
    lastStartEpoch: null, lastStartFormatted: null,
    lastEndEpoch: null, lastEndFormatted: null,
    exitCode: null, runNum: null, retries: null, runMachine: null, owner: null,
    scheduledToday: false, currentlyActive: false, visualState: 'INACTIVE',
    ...over,
  }
}

const data: ExecutionOrderData = {
  loadJob: 'LOAD-ABC-123',
  executionSequence: [
    { jobName: 'PRE-LOAD-ABC-123', loadJob: 'LOAD-ABC-123', executionOrder: 1 },
    { jobName: 'MAIN-LOAD-ABC-123', loadJob: 'LOAD-ABC-123', executionOrder: 2 },
    { jobName: 'POST-LOAD-ABC-123', loadJob: 'LOAD-ABC-123', executionOrder: 3 },
  ],
  jobDetails: {}, jobStatuses: { 'MAIN-LOAD-ABC-123': status({ jobName: 'MAIN-LOAD-ABC-123', visualState: 'FAILED' }) },
  statusAvailable: true,
}

const longData: ExecutionOrderData = {
  loadJob: 'L',
  executionSequence: Array.from({ length: 13 }, (_, i) => ({ jobName: `J${i}`, loadJob: 'L', executionOrder: i + 1 })),
  jobDetails: {}, jobStatuses: null, statusAvailable: false,
}

beforeEach(() => { setCenter.mockClear(); fitView.mockClear() })

describe('ExecutionOrderGraph', () => {
  test('wraps the body in a ReactFlowProvider and adapts the DTO into nodes', () => {
    render(<ExecutionOrderGraph data={data} selected={null} matches={[]} onSelect={vi.fn()} />)
    expect(screen.getByTestId('rf-provider')).toBeInTheDocument()
    expect(screen.getByTestId('rf').getAttribute('data-node-count')).toBe('3')
  })

  test('hides the MiniMap for short sequences (<= 12 nodes)', () => {
    render(<ExecutionOrderGraph data={data} selected={null} matches={[]} onSelect={vi.fn()} />)
    expect(screen.queryByTestId('eo-minimap')).toBeNull()
  })

  test('shows the MiniMap for long sequences (> 12 nodes)', () => {
    render(<ExecutionOrderGraph data={longData} selected={null} matches={[]} onSelect={vi.fn()} />)
    expect(screen.getByTestId('eo-minimap')).toBeInTheDocument()
  })

  test('smart-focus centers on the first FAILED node on mount', () => {
    render(<ExecutionOrderGraph data={data} selected={null} matches={[]} onSelect={vi.fn()} />)
    expect(setCenter).toHaveBeenCalled()
  })

  test('quick-find non-matches are dimmed via node data.dimmed', () => {
    render(<ExecutionOrderGraph data={data} selected={null} matches={['MAIN-LOAD-ABC-123']} onSelect={vi.fn()} />)
    // PRE + POST are non-matches → dimmed; MAIN (the match) is not.
    expect(screen.getByTestId('rf').getAttribute('data-dimmed')).toBe('PRE-LOAD-ABC-123,POST-LOAD-ABC-123')
  })

  test('renders zoom / fit / recenter controls', () => {
    render(<ExecutionOrderGraph data={data} selected={null} matches={[]} onSelect={vi.fn()} />)
    expect(screen.getByTestId('eo-controls')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /fit all/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /re-center/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/search/execution-order/__tests__/ExecutionOrderGraph.test.tsx`
Expected: FAIL — the current graph has no `ReactFlowProvider`, no `selected`/`matches` props, no `setCenter`, no extra control buttons, no `data.dimmed`.

- [ ] **Step 3: Rewrite `src/search/execution-order/ExecutionOrderGraph.tsx`**

```tsx
import { useEffect, useMemo, useRef } from 'react'
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Controls, ControlButton,
  MiniMap, BaseEdge, getSmoothStepPath, useReactFlow,
  type EdgeProps, type EdgeTypes, type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { MaximizeIcon, CrosshairIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { buildGraphFromData, NODE_SIZE, type FlowNode } from './layout'
import { JobFlowNode } from './JobFlowNode'
import type { ExecutionOrderData } from './types'

const nodeTypes: NodeTypes = { job: JobFlowNode }

/** Neutral order-rail edge — no markerEnd; class drives the muted/active/dim stroke. */
function SpineEdge({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }: EdgeProps) {
  const [path] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
  const state = (data as { state?: 'active' | 'dim' } | undefined)?.state
  return (
    <BaseEdge
      path={path}
      className={cn('eo-spine-path', state === 'active' && 'eo-spine-path-active', state === 'dim' && 'eo-spine-path-dim')}
    />
  )
}
const edgeTypes: EdgeTypes = { spine: SpineEdge }

interface Props {
  data: ExecutionOrderData
  /** Currently selected job (drives select-emphasis + inspector). */
  selected: string | null
  /** Quick-find match set (non-matches dim; the active match is centered by the parent via `selected`). */
  matches: string[]
  onSelect: (jobName: string | null) => void
}

/**
 * Inner view — lives INSIDE <ReactFlowProvider>, so it can call useReactFlow()
 * for smart-focus + match centering (those hooks throw without the provider, and
 * cannot run in the component that renders <ReactFlow> unless it's inside one).
 */
function GraphView({ data, selected, matches, onSelect }: Props) {
  const { setCenter, fitView, getNode } = useReactFlow()
  const { nodes, edges, focusNodeId } = useMemo(() => buildGraphFromData(data), [data])
  const didInitialFocus = useRef(false)

  const matchSet = useMemo(() => new Set(matches), [matches])

  // Decorate nodes with dim/select state derived from selection + quick-find.
  const decoratedNodes: FlowNode[] = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        selected: n.id === selected,
        data: {
          ...n.data,
          dimmed: matchSet.size > 0 ? !matchSet.has(n.id) : false,
        },
      })),
    [nodes, selected, matchSet],
  )

  // Adjacent-edge emphasis: highlight edges touching the selected node, dim the rest.
  const decoratedEdges = useMemo(
    () =>
      edges.map((e) => {
        if (!selected) return e
        const adjacent = e.source === selected || e.target === selected
        return { ...e, data: { state: adjacent ? 'active' : 'dim' } }
      }),
    [edges, selected],
  )

  const center = (id: string | null) => {
    if (!id) return
    const node = getNode(id)
    if (!node) return
    const x = node.position.x + NODE_SIZE.width / 2
    const y = node.position.y + NODE_SIZE.height / 2
    void setCenter(x, y, { zoom: 1.1, duration: 350 })
  }

  // Smart initial focus — center on the first FAILED -> RUNNING -> top node once.
  useEffect(() => {
    if (didInitialFocus.current) return
    if (focusNodeId) { center(focusNodeId); didInitialFocus.current = true }
    // center/getNode/setCenter identities are stable for the provider's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNodeId])

  // Re-center on the active quick-find match (parent passes it through `selected`).
  useEffect(() => {
    if (selected) center(selected)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])

  return (
    <ReactFlow
      nodes={decoratedNodes}
      edges={decoratedEdges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      fitViewOptions={{ padding: 0.2, maxZoom: nodes.length <= 5 ? 1 : 1.5 }}
      minZoom={0.3}
      maxZoom={2}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable
      panOnScroll
      zoomOnScroll={false}
      onNodeClick={(_e, node) => onSelect(node.id)}
      onPaneClick={() => onSelect(null)}
      proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Dots} gap={18} size={1} />
      <Controls showInteractive={false}>
        <ControlButton aria-label="Fit all" title="Fit all" onClick={() => { void fitView({ padding: 0.2, duration: 350 }) }}>
          <MaximizeIcon className="size-3.5" />
        </ControlButton>
        <ControlButton aria-label="Re-center on focus" title="Re-center on focus" onClick={() => center(focusNodeId)}>
          <CrosshairIcon className="size-3.5" />
        </ControlButton>
      </Controls>
      {/* MiniMap only earns its place on long sequences (existing gate). */}
      {nodes.length > 12 && <MiniMap pannable zoomable />}
    </ReactFlow>
  )
}

/**
 * Public wrapper — provides the ReactFlowProvider context that GraphView's
 * useReactFlow() requires (smart-focus + quick-find centering). All graph data
 * is precomputed by buildGraphFromData (unit-tested) so this stays declarative.
 */
export function ExecutionOrderGraph(props: Props) {
  return (
    <div className="size-full" data-testid="eo-graph">
      <ReactFlowProvider>
        <GraphView {...props} />
      </ReactFlowProvider>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/search/execution-order/__tests__/ExecutionOrderGraph.test.tsx`
Expected: PASS (6 passed).

- [ ] **Step 5: Typecheck the graph + lint (RF v12 API + token-driven, no hex)**

Run: `pnpm typecheck`
Expected: exit 0 — `panOnScroll`, `fitViewOptions.maxZoom`, `EdgeProps`, `getSmoothStepPath`, `useReactFlow().setCenter/fitView/getNode`, `ControlButton`, `BaseEdge` all resolve against `@xyflow/react` v12.10.2.
Run: `pnpm exec eslint src/search/execution-order/ExecutionOrderGraph.tsx`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/search/execution-order/ExecutionOrderGraph.tsx src/search/execution-order/__tests__/ExecutionOrderGraph.test.tsx
git commit -m "feat(react): eo graph — ReactFlowProvider, panOnScroll, controls, neutral spine, dim, smart-focus

ReactFlowProvider wraps an inner GraphView so useReactFlow (setCenter/fitView)
works for smart-focus + quick-find centering. Custom non-arrow spine edge type;
adjacent-edge emphasis; non-match dimming; fit-all / re-center controls.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 13: Rework `ExecutionOrderModal` shell — header + state pill, summary strip, body split graph ‖ JobInspector

**Files:**
- Modify: `src/search/execution-order/ExecutionOrderModal.tsx`
- Modify: `src/search/execution-order/__tests__/ExecutionOrderModal.test.tsx`

The modal owns the cross-cutting state: `selected` (clicked OR active quick-find match), `matches` (for dimming). It renders the header pipeline-state pill (from `rollup`), the `PipelineSummaryStrip` (which hosts QuickFind and reports match changes), the graph, and the `JobInspector`. The summary-strip callbacks are wrapped in `useCallback` so `QuickFind`'s effect deps stay stable.

- [ ] **Step 1: Rewrite the modal test (state pill, strip, graph, inspector, empty + degraded gating)**

Replace `src/search/execution-order/__tests__/ExecutionOrderModal.test.tsx`. The graph + strip + inspector children are mocked so the shell test is decoupled:

```tsx
import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../ExecutionOrderGraph', () => ({
  ExecutionOrderGraph: () => <div data-testid="eo-graph-mock" />,
}))
vi.mock('../PipelineSummaryStrip', () => ({
  PipelineSummaryStrip: ({ data }: { data: { statusAvailable: boolean } }) => (
    <div data-testid="eo-strip-mock" data-status-available={String(data.statusAvailable)} />
  ),
}))
vi.mock('../JobInspector', () => ({
  JobInspector: ({ jobName }: { jobName: string | null }) => (
    <div data-testid="eo-inspector-mock">{jobName ?? 'EMPTY'}</div>
  ),
}))

import { ExecutionOrderModal } from '../ExecutionOrderModal'
import type { ExecutionOrderData, JobStatusInfo } from '../types'

function status(over: Partial<JobStatusInfo>): JobStatusInfo {
  return {
    jobName: 'J', status: null, statusName: '',
    nextStartEpoch: null, nextStartFormatted: null,
    lastStartEpoch: null, lastStartFormatted: null,
    lastEndEpoch: null, lastEndFormatted: null,
    exitCode: null, runNum: null, retries: null, runMachine: null, owner: null,
    scheduledToday: false, currentlyActive: false, visualState: 'INACTIVE',
    ...over,
  }
}

function base(overrides: Partial<ExecutionOrderData> = {}): ExecutionOrderData {
  return {
    loadJob: 'LOAD-ABC-123',
    executionSequence: [{ jobName: 'PRE-LOAD-ABC-123', loadJob: 'LOAD-ABC-123', executionOrder: 1 }],
    jobDetails: {}, jobStatuses: null, statusAvailable: true, ...overrides,
  }
}

describe('ExecutionOrderModal', () => {
  test('renders the header with the load job, the strip, graph, and inspector', () => {
    render(<ExecutionOrderModal data={base()} jobName="LOAD-ABC-123" open onOpenChange={vi.fn()} />)
    expect(screen.getByText('Job Execution Order')).toBeInTheDocument()
    expect(screen.getByText('LOAD-ABC-123')).toBeInTheDocument()
    expect(screen.getByTestId('eo-strip-mock')).toBeInTheDocument()
    expect(screen.getByTestId('eo-graph-mock')).toBeInTheDocument()
    // Nothing selected → inspector shows the empty (RunOverview) state.
    expect(screen.getByTestId('eo-inspector-mock')).toHaveTextContent('EMPTY')
  })

  test('header pipeline-state pill rolls up the run ("Attention — N failed")', () => {
    const data = base({
      executionSequence: [
        { jobName: 'A', loadJob: 'LOAD-ABC-123', executionOrder: 1 },
        { jobName: 'B', loadJob: 'LOAD-ABC-123', executionOrder: 2 },
      ],
      jobStatuses: { A: status({ visualState: 'COMPLETED' }), B: status({ visualState: 'FAILED' }) },
      statusAvailable: true,
    })
    render(<ExecutionOrderModal data={data} jobName="LOAD-ABC-123" open onOpenChange={vi.fn()} />)
    expect(screen.getByTestId('eo-pipeline-pill')).toHaveTextContent(/attention — 1 failed/i)
  })

  test('pipeline-state pill is hidden when statusAvailable is false', () => {
    render(<ExecutionOrderModal data={base({ statusAvailable: false })} jobName="LOAD-ABC-123" open onOpenChange={vi.fn()} />)
    expect(screen.queryByTestId('eo-pipeline-pill')).toBeNull()
    // Strip still renders (it shows its own "unavailable" note).
    expect(screen.getByTestId('eo-strip-mock').getAttribute('data-status-available')).toBe('false')
  })

  test('shows the empty state (no strip / graph) when the sequence is empty', () => {
    render(<ExecutionOrderModal data={base({ executionSequence: [] })} jobName="LOAD-ABC-123" open onOpenChange={vi.fn()} />)
    expect(screen.getByTestId('eo-empty')).toBeInTheDocument()
    expect(screen.queryByTestId('eo-graph-mock')).toBeNull()
    expect(screen.queryByTestId('eo-strip-mock')).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/search/execution-order/__tests__/ExecutionOrderModal.test.tsx`
Expected: FAIL — the current modal renders `StatusLegend`/`JobDetailsPanel`, has no pipeline-state pill, no `PipelineSummaryStrip`, and passes the wrong props to the graph/inspector.

- [ ] **Step 3: Rewrite `src/search/execution-order/ExecutionOrderModal.tsx`**

```tsx
import { useCallback, useState } from 'react'
import { NetworkIcon } from 'lucide-react'

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { ExecutionOrderGraph } from './ExecutionOrderGraph'
import { JobInspector } from './JobInspector'
import { PipelineSummaryStrip } from './PipelineSummaryStrip'
import { StatusLegend } from './StatusLegend'
import { findJobStatus } from './statusConfig'
import {
  isEmptyExecutionOrder, rollup, type ExecutionOrderData, type OverallState,
} from './types'

const PILL_LABEL: Record<OverallState, string> = {
  ATTENTION: 'Attention', RUNNING: 'Running', HEALTHY: 'Healthy', IDLE: 'Idle',
}
const PILL_BADGE: Record<OverallState, string> = {
  ATTENTION: 'eo-badge-failed', RUNNING: 'eo-badge-running', HEALTHY: 'eo-badge-completed', IDLE: 'eo-badge-inactive',
}

interface Props {
  data: ExecutionOrderData
  jobName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Execution-order modal shell (spec §5.1):
 *   Header (network icon · title · mono load-job chip · pipeline-state pill) →
 *   PipelineSummaryStrip (segmented bar + counts + quick-find) →
 *   body split: graph canvas ‖ persistent JobInspector rail.
 * Owns the cross-cutting selection + quick-find match state; the active match is
 * threaded through `selected` so the graph centers it and the inspector opens it.
 */
export function ExecutionOrderModal({ data, jobName, open, onOpenChange }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [matches, setMatches] = useState<string[]>([])

  const empty = isEmptyExecutionOrder(data)
  const r = rollup(data.jobStatuses)
  const selectedDetails = selected ? data.jobDetails?.[selected] : undefined
  const selectedStatus = selected ? findJobStatus(data.jobStatuses, selected) : null

  // Stable callbacks so QuickFind's effect deps don't re-fire each render.
  const handleActiveMatch = useCallback((name: string | null) => setSelected(name), [])
  const handleMatchesChange = useCallback((m: string[]) => setMatches(m), [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] w-[min(95vw,1100px)] max-w-[min(95vw,1100px)] sm:max-w-[min(95vw,1100px)] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="flex shrink-0 flex-row items-center gap-3 space-y-0 border-b px-5 py-4">
          <NetworkIcon className="size-5 text-primary" />
          <div className="flex items-baseline gap-3">
            <DialogTitle>Job Execution Order</DialogTitle>
            <span className="rounded-full bg-muted px-2.5 py-0.5 font-mono text-xs text-muted-foreground">
              {data.loadJob || jobName}
            </span>
          </div>
          {!empty && data.statusAvailable && (
            <span
              data-testid="eo-pipeline-pill"
              className={cn('ml-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', PILL_BADGE[r.overall])}
            >
              {PILL_LABEL[r.overall]}{r.failedCount > 0 ? ` — ${r.failedCount} failed` : ''}
            </span>
          )}
          <DialogDescription className="sr-only">Execution sequence for {jobName}</DialogDescription>
        </DialogHeader>

        {empty ? (
          <div className="flex flex-1 items-center justify-center p-16 text-sm text-muted-foreground" data-testid="eo-empty">
            No execution sequence found for {jobName}.
          </div>
        ) : (
          <>
            <div className="shrink-0 border-b">
              <PipelineSummaryStrip
                data={data}
                onActiveMatch={handleActiveMatch}
                onMatchesChange={handleMatchesChange}
              />
            </div>
            <div className="flex min-h-0 flex-1">
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="min-h-0 flex-1">
                  <ExecutionOrderGraph
                    data={data}
                    selected={selected}
                    matches={matches}
                    onSelect={setSelected}
                  />
                </div>
                <div className="flex shrink-0 items-center border-t px-4 py-2">
                  {data.statusAvailable ? (
                    <StatusLegend />
                  ) : (
                    <span className="text-[11px] text-muted-foreground" data-testid="eo-status-unavailable">
                      Live status unavailable
                    </span>
                  )}
                </div>
              </div>
              <div className="w-[42%] min-w-[340px] max-w-[440px] shrink-0 overflow-y-auto border-l">
                <JobInspector
                  jobName={selected}
                  details={selectedDetails}
                  status={selectedStatus}
                  statusAvailable={data.statusAvailable}
                  data={data}
                />
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/search/execution-order/__tests__/ExecutionOrderModal.test.tsx`
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**

```bash
git add src/search/execution-order/ExecutionOrderModal.tsx src/search/execution-order/__tests__/ExecutionOrderModal.test.tsx
git commit -m "feat(react): eo modal shell — header pipeline pill, summary strip, graph ‖ inspector

Owns selection + quick-find match state; threads the active match through
`selected` so graph centers + inspector opens. Persistent ~42% inspector rail.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 14: Confirm the cell renderer is unchanged + the renderer suite stays green

**Files:**
- Verify (no edit): `src/search/renderers/ExecutionOrderCellRenderer.tsx`
- Verify (no edit): `src/search/__tests__/ExecutionOrderCellRenderer.test.tsx`

The renderer already fetches `ExecutionOrderData` and passes `data`/`jobName`/`open`/`onOpenChange` into `ExecutionOrderModal` — the modal's public prop shape is unchanged by this redesign, so no edit is needed. This task is a guard: prove it still compiles + passes against the reworked modal.

- [ ] **Step 1: Confirm no renderer edit is required**

Run: `git diff --stat src/search/renderers/ExecutionOrderCellRenderer.tsx`
Expected: empty (no changes) — the renderer is untouched.

- [ ] **Step 2: Run the renderer test suite (still green against the reworked modal)**

Run: `pnpm exec vitest run src/search/__tests__/ExecutionOrderCellRenderer.test.tsx`
Expected: PASS — the suite mocks `@/search/execution-order/ExecutionOrderModal` and asserts only `open`/`jobName`, which the new modal still accepts; the `?raw` inverse-marker test (`no TODO(Phase 4)` / `no JSON.stringify`) stays true.

- [ ] **Step 3: No commit** (nothing changed). If Step 1 shows an accidental diff, `git checkout -- src/search/renderers/ExecutionOrderCellRenderer.tsx` to restore it, then re-run Step 2.

---

### Task 15: Full verification — suite, typecheck, lint

**Files:** none (verification only).

- [ ] **Step 1: Full test suite**

Run: `pnpm test`
Expected: all suites pass — the reworked execution-order suites (`types`, `statusConfig`, `layout`, `NodeRuntimePopover`, `JobFlowNode`, `RunOverview`, `StatusLegend`, `QuickFind`, `PipelineSummaryStrip`, `JobInspector`, `ExecutionOrderGraph`, `ExecutionOrderModal`) + every pre-existing suite (`ExecutionOrderCellRenderer`, `registry`, `configToColDefs`, etc.). Read the summary line and confirm 0 failed.

- [ ] **Step 2: Confirm no stale `JobDetailsPanel` references remain**

Run: `git grep -n "JobDetailsPanel" -- 'src/**' || echo "clean"`
Expected: `clean` (or only the renamed test file's git-history note — there should be NO live import of `JobDetailsPanel`). If any import survives, fix it to `JobInspector` and re-run Step 1.

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 4: Lint (hex rule + full)**

Run: `pnpm lint`
Expected: exit 0 — all color comes from `var(--…)` / oklch CSS tokens / `eo-*` classes / `color-mix`; no `no-restricted-syntax` hex violations in any TS/TSX. (The only inline color is `var(--status-${state})` in `JobFlowNode`, which is a `var()` ref, not a hex literal.)

- [ ] **Step 5: Production build (CSS + bundle parse)**

Run: `pnpm build`
Expected: exit 0 (`tsc -b && vite build`).

- [ ] **Step 6: No commit** unless a fix was needed (then commit the fix with the standard footer).

---

### Task 16: Manual smoke against the running stack + final code review

**Files:** none (verification only).

- [ ] **Step 1: Manual smoke (requires Plan 1's seed+backend applied)**

With the seed+backend plan merged (extended payload + one seeded `FAILED` job), backend on `:6088`, and `pnpm dev` on `:5173`: open the search grid, run a query returning rows with a `load_job`, click **View** in the Execution Order column. Confirm against spec §5:
- Modal opens with the header pipeline-state pill ("Attention — N failed" when a job is FAILED), the segmented summary strip + counts, and quick-find.
- The graph opens **centered on the first FAILED node** (smart focus) at a readable zoom — not ballooned for a 3-node graph.
- **No crosshair** appears anywhere on/around nodes when hovering near their mid-edges (the §5.7 fix).
- The spine is a neutral, non-arrow rail; the RUNNING node pulses (still under reduced-motion), others are still.
- Hovering a node reveals the runtime popover (status + exit, duration, ended-at, retries, run machine) with no layout shift.
- Clicking a node opens the inspector with the **last-run card leading** (duration · exit · retries), then definition (incl. owner), command (copy works), description; `run machine` vs definition `machine` read distinctly.
- Nothing selected → the inspector shows the **RunOverview** (load job, count, rollup, longest run), not a dead prompt.
- Quick-find: typing dims non-matches, centers the active match, counter shows "k / n", `↑`/`↓`/`Enter` cycle, `Esc`/clear restores.
- `panOnScroll` pans the tall list; ⌘/pinch zooms; fit-all + re-center controls work; minimap appears only beyond 12 nodes.
- Light/dark toggle recolors nodes, accent bars, spine, popover, and minimap/controls via tokens.
- Closing and reopening works; reopening resets selection/find.

- [ ] **Step 2: Dispatch the final whole-implementation code review**

Per `superpowers:subagent-driven-development`, after all tasks dispatch a final code reviewer over the full frontend diff for this plan (`git log --oneline` since the plan started; `git diff` the touched `src/search/execution-order/` + `src/index.css`). Verify: no raw hex, Motion under `m.*`/`LazyMotion`, RF v12 API usage correct, `useReactFlow` only inside the provider, `getRowId`-style stability not regressed (N/A here — no SSRM datasource touched), spec §5/§8/§9 coverage. Address Critical/Important findings before considering the frontend slice done.

- [ ] **Step 3: No extra commit** beyond the per-task commits unless review fixes are needed.

---

## Self-Review

**Spec §5 (The Design) coverage:**
- §5.1 Modal shell (header + state pill, summary strip, graph ‖ inspector ~42%) → Task 13 ✅
- §5.2 Pipeline summary strip + rollup state pill + graceful unavailable collapse → `rollup` (Task 1) + `PipelineSummaryStrip` (Task 11) + header pill (Task 13) ✅
- §5.3 Graph canvas: dagre TB (Task 3), neutral non-arrow spine `selectable/focusable:false`/`pointer-events`/no markerEnd (Task 3 layout + Task 12 SpineEdge + Task 4 CSS), select-emphasis adjacent-edge highlight + dim (Task 12), dotted background, fit-to-width + maxZoom cap + smart-focus center (Task 12), `panOnScroll` + pinch zoom (Task 12), controls zoom/fit/re-center (Task 12), minimap gate `>12` (Task 12), `--xy-*` theming (already in index.css) ✅
- §5.4 The node: accent bar + ordinal + glyph + name + status icon, tint AND icon, five states, RUNNING pulse (reduced-motion), hover lift + runtime popover, selected ring, non-interactive handles → Tasks 6 + 5 + 2 + 4 ✅
- §5.5 Quick-find: case-insensitive substring, dim non-matches (never hide), auto-center, ↑/↓/Enter cycle, "2 / 5" counter, Esc/clear, opens in inspector → Task 10 (`QuickFind`) + Task 1 (`findMatches`) + Task 12 (centering/dim) + Task 13 (threading) ✅
- §5.6 Inspector: identity → last-run card (duration · exit · retries; started/ended/run-machine/run#) → definition (owner from STATUS, machine, box, calendars; rows self-hide) → command (copy) → description; run-machine vs machine distinct; empty → RunOverview; Motion slide-in keyed by job name → Task 9 (`JobInspector`) + Task 7 (`RunOverview`) ✅
- §5.7 Crosshair fix (root cause): `<Handle isConnectable={false}>` + `pointer-events-none` on the node (Task 6), spine `pointer-events`/`selectable:false` (Tasks 3/4/12), **regression test** asserts both handles non-connectable (Task 6) ✅
- §5.8 Motion: stagger/lift/pulse/select/find under `LazyMotion` + `MotionConfig reducedMotion="user"` (inspector uses `m.*`; pulse is a CSS keyframe stilled by the global reduced-motion clamp) → Tasks 4 + 9 ✅
- §5.9 Theming: all color via tokens/oklch/`color-mix`; new accent-bar / spine / popover-surface / pulse classes; no raw hex (lint-gated); RF via `--xy-*` → Task 4 + lint in Tasks 6/12/15 ✅

**Spec §8 (Component architecture) coverage — every row:**
- `ExecutionOrderModal.tsx` Modify → Task 13 ✅
- `PipelineSummaryStrip.tsx` Create → Task 11 ✅
- `QuickFind.tsx` Create → Task 10 ✅
- `ExecutionOrderGraph.tsx` Modify (+ **ReactFlowProvider**) → Task 12 ✅
- `JobFlowNode.tsx` Modify (redesign + crosshair) → Task 6 ✅
- `NodeRuntimePopover.tsx` Create → Task 5 ✅
- `JobInspector.tsx` Modify (rename from `JobDetailsPanel.tsx`, `git mv`) → Task 9 ✅
- `RunOverview.tsx` Create → Task 7 ✅
- `StatusLegend.tsx` Modify → Task 8 ✅
- `layout.ts` Modify (TB, non-arrow spine, focus pick, rollup/find via types, pure) → Task 3 (+ helpers in Task 1) ✅
- `statusConfig.ts` Modify (five states + accent/pulse) → Task 2 ✅
- `types.ts` Modify (extended `JobStatusInfo` + `formatDuration`/`rollup`/`findMatches`/`pickFocusNodeId`) → Task 1 ✅
- `index.css` Modify (accent/spine/popover/pulse, no hex) → Task 4 ✅
- `renderers/ExecutionOrderCellRenderer.tsx` Unchanged → Task 14 (verified, no edit) ✅

**Spec §9 (TDD testing strategy) coverage:**
- Pure logic heaviest: `buildGraphFromData` nodes/edges/focus (Task 3), `pickFocusNodeId`/`rollup`/`findMatches`/`formatDuration` (Task 1) ✅
- Node: five states, accent + ordinal + glyph + status icon, hover popover content (Task 5 suite), **no crosshair affordance regression** (Task 6) ✅
- Inspector: last-run numbers (duration/exit/retries), run-machine vs machine, conditional sections, empty → RunOverview, copy (Task 9) ✅
- Strip: rollup counts + state pill, `statusAvailable=false` collapse (Task 11) ✅
- QuickFind: count, cycle, clear, dim/highlight wiring via reported matches (Task 10) ✅
- Graph: minimap gate (existing), smart-focus invocation (`setCenter` spy), edges non-interactive (Task 3 spine flags + Task 12) ✅
- Existing execution-order tests updated + kept green; renderer suite green (Tasks 8/9/12/13/14/15) ✅
- Backend `JobStatusServiceTest` is **out of this plan's scope** (it's Plan 1 / seed+backend) — noted, not duplicated ✅

**Data-contract fidelity (spec §6.2):** epochs SECONDS; **duration derived on the frontend** (`formatDuration(lastEndEpoch − lastStartEpoch)`, never on the wire); `owner` read from `status`, not `JobDetails`; the nine new fields mirrored on `JobStatusInfo` exactly by the fixed names → Task 1 + consumed in Tasks 5/7/9 ✅

**Conventions:** branch `milestone/modernization` (no new branch, no push); per-task commits with the `Co-Authored-By: Claude Opus 4.7` footer; `m.*` under existing `LazyMotion`; config-driven principle untouched (no category/column hardcoding — the modal is fed by the renderer which is fed by the config-driven grid); no raw hex (lint-gated each touch); `getRowId` stability rule N/A (no SSRM datasource touched). ✅

**Placeholder scan:** No TBD / "similar to Task N" / vague "handle edge cases" — every code step shows complete TSX/TS/CSS, exact paths, exact commands, and expected output. The one inline-style note (status icon color) replaces a would-be fake Tailwind class with a token `var()` ref and is fully spelled out. ✅

**Sequencing:** pure logic (Tasks 1–3) → CSS tokens (Task 4) → leaf components (5 NodeRuntimePopover, 6 JobFlowNode, 7 RunOverview, 8 StatusLegend) → composites (9 JobInspector, 10 QuickFind, 11 PipelineSummaryStrip, 12 ExecutionOrderGraph) → shell (13 ExecutionOrderModal) → renderer guard (14) → full verification (15) → manual smoke + review (16). Each task is independently testable with its own failing-test-first step. ✅
