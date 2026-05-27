# Execution Order — Part B: React Flow Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder JSON `<pre>` in the Execution Order "View" dialog with a premium React Flow graph modal — a dagre top-to-bottom job-sequence graph plus a job-details side panel — matching the Angular Cytoscape modal's functionality in the React app's shadcn/oklch design language.

**Architecture:** A new, self-contained `src/search/execution-order/` feature folder. Pure functions (`buildGraphFromData`, `findJobStatus`) are unit-tested directly; React Flow rendering is kept behind a thin `ExecutionOrderGraph` wrapper so tests mock `@xyflow/react` rather than fighting jsdom layout. Status colors are five new oklch CSS tokens consumed via `eo-*` utility classes (no hex literals — the ESLint rule forbids them). The cell renderer keeps its existing fetch/loading/error logic and swaps only the dialog body.

**Tech Stack:** React 19, `@xyflow/react` v12, `dagre`, shadcn `Dialog`, Tailwind v4 (oklch tokens), lucide-react, vitest + @testing-library/react.

**Working directory for all tasks:** `/Users/aarun/Workspace/Projects/autosys-job-explorer/frontend-react`
**Branch:** create `feature/execution-order-modal` off the current branch before Task 1.
**Commands:** `pnpm test`, `pnpm typecheck`, `pnpm lint` (run single test file via `pnpm exec vitest run <path>`).

**Prerequisite:** Part A (seed fix) must be applied so `GET /rectrace/api/execution-order/{job}` returns 200 with a real sequence. Unit tests do not need the backend; the final manual check does.

---

### Task 1: Add dependencies and create the branch

**Files:**
- Modify: `package.json` (deps via pnpm)

- [ ] **Step 1: Create the feature branch**

```bash
git checkout -b feature/execution-order-modal
```

- [ ] **Step 2: Install React Flow + dagre**

```bash
pnpm add @xyflow/react dagre
pnpm add -D @types/dagre
```
Expected: `package.json` gains `@xyflow/react`, `dagre` (deps) and `@types/dagre` (devDeps); `pnpm-lock.yaml` updates.

- [ ] **Step 3: Verify the install builds**

Run: `pnpm typecheck`
Expected: exit 0 (no type errors introduced by the new deps).

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "build(react): add @xyflow/react + dagre for the execution-order modal

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 2: Add the five status color tokens

**Files:**
- Modify: `src/index.css` (`:root`, `.dark`, and a new `eo-*` class block)
- Modify: `src/lib/theme.ts` (token mirror)
- Modify: `../.planning/STATE.md` (record the deferred data-viz tokens are now introduced)
- Test: `src/search/__tests__/statusTokens.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `src/search/__tests__/statusTokens.test.ts`:

```ts
import { describe, test, expect } from 'vitest'
import { tokens } from '@/lib/theme'

describe('execution-order status tokens', () => {
  test('theme.ts exposes the five status tokens as var(--status-*) refs', () => {
    const keys = [
      'statusCompleted', 'statusFailed', 'statusRunning',
      'statusWaiting', 'statusInactive',
    ] as const
    for (const k of keys) {
      expect(tokens[k]).toMatch(/^var\(--status-[a-z]+\)$/)
    }
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/search/__tests__/statusTokens.test.ts`
Expected: FAIL — `tokens.statusCompleted` is `undefined` (TS error / assertion fail).

- [ ] **Step 3: Add the oklch tokens to `src/index.css`**

In the `:root` block (after `--sidebar-ring`), add:

```css
  /* Execution-order graph status palette (first data-viz component — see the
   * RECTRACE EXTENSIONS note above). green / red / azure / amber / gray. */
  --status-completed: oklch(0.62 0.15 150);
  --status-failed: oklch(0.585 0.214 25.5);
  --status-running: oklch(0.515 0.176 256);
  --status-waiting: oklch(0.72 0.15 75);
  --status-inactive: oklch(0.6 0.02 256);
```

In the `.dark` block (after `--sidebar-ring`), add the lifted variants:

```css
  --status-completed: oklch(0.72 0.16 152);
  --status-failed: oklch(0.704 0.19 22.5);
  --status-running: oklch(0.7 0.16 254);
  --status-waiting: oklch(0.8 0.14 80);
  --status-inactive: oklch(0.7 0.02 256);
```

- [ ] **Step 4: Add the `eo-*` status classes to `src/index.css`**

Append at the end of the file (after the `prefers-reduced-motion` block), token-driven via `color-mix` — no hex:

```css
/* ================================================================
 * Execution-order graph — status-tinted node / legend-dot / badge classes.
 * Token-driven (color-mix over the --status-* palette), theme-aware.
 * ================================================================ */
.eo-node { background: var(--card); border-color: var(--border); color: var(--card-foreground); }
.eo-node-completed { background: color-mix(in oklab, var(--status-completed) 12%, var(--card)); border-color: color-mix(in oklab, var(--status-completed) 42%, var(--border)); }
.eo-node-failed    { background: color-mix(in oklab, var(--status-failed) 12%, var(--card));    border-color: color-mix(in oklab, var(--status-failed) 42%, var(--border)); }
.eo-node-running   { background: color-mix(in oklab, var(--status-running) 12%, var(--card));   border-color: color-mix(in oklab, var(--status-running) 42%, var(--border)); }
.eo-node-waiting   { background: color-mix(in oklab, var(--status-waiting) 12%, var(--card));   border-color: color-mix(in oklab, var(--status-waiting) 42%, var(--border)); }
.eo-node-inactive  { background: color-mix(in oklab, var(--status-inactive) 8%, var(--card));   border-color: color-mix(in oklab, var(--status-inactive) 30%, var(--border)); }

.eo-dot-completed { background: var(--status-completed); }
.eo-dot-failed    { background: var(--status-failed); }
.eo-dot-running   { background: var(--status-running); }
.eo-dot-waiting   { background: var(--status-waiting); }
.eo-dot-inactive  { background: var(--status-inactive); }

.eo-badge-completed { background: color-mix(in oklab, var(--status-completed) 16%, transparent); color: var(--status-completed); }
.eo-badge-failed    { background: color-mix(in oklab, var(--status-failed) 16%, transparent);    color: var(--status-failed); }
.eo-badge-running   { background: color-mix(in oklab, var(--status-running) 16%, transparent);   color: var(--status-running); }
.eo-badge-waiting   { background: color-mix(in oklab, var(--status-waiting) 18%, transparent);   color: var(--status-waiting); }
.eo-badge-inactive  { background: color-mix(in oklab, var(--status-inactive) 16%, transparent);  color: var(--status-inactive); }

/* React Flow edges + arrowheads — token-driven, theme-aware (no hex). */
.react-flow__edge-path { stroke: color-mix(in oklab, var(--foreground) 28%, transparent); }
.react-flow__arrowhead { fill: color-mix(in oklab, var(--foreground) 28%, transparent); }
```

- [ ] **Step 5: Add the token mirror to `src/lib/theme.ts`**

Replace the `// RECTRACE EXTENSIONS (empty ...)` comment line in the `tokens` object with:

```ts
  // RECTRACE EXTENSIONS — execution-order status palette (first data-viz component).
  statusCompleted: 'var(--status-completed)',
  statusFailed: 'var(--status-failed)',
  statusRunning: 'var(--status-running)',
  statusWaiting: 'var(--status-waiting)',
  statusInactive: 'var(--status-inactive)',
```

- [ ] **Step 6: Record the token introduction in `../.planning/STATE.md`**

The deferred chart/data-viz tokens entry is a **row inside the Deferred Items GFM table** — do NOT insert a bullet between rows (it breaks the table). Instead, update that row's Status/Notes cell to read:

```
Partially closed 2026-05-27 — status palette (--status-completed/-failed/-running/-waiting/-inactive) introduced by the execution-order modal (first data-viz component); chart/series/ramp tokens still deferred.
```

If that cell is too narrow to stay readable, instead add the same note as a prose line immediately **after** the Deferred Items table rather than inside it.

- [ ] **Step 7: Run the test + lint to verify pass + no hex**

Run: `pnpm exec vitest run src/search/__tests__/statusTokens.test.ts`
Expected: PASS.
Run: `pnpm lint`
Expected: exit 0 (no `no-restricted-syntax` hex violations — tokens are oklch in CSS, TS uses `var(--…)` strings only).

- [ ] **Step 8: Commit**

```bash
git add src/index.css src/lib/theme.ts ../.planning/STATE.md src/search/__tests__/statusTokens.test.ts
git commit -m "feat(react): add five oklch status tokens for the execution-order graph

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 3: Data contract types + empty-sequence guard

**Files:**
- Create: `src/search/execution-order/types.ts`
- Test: `src/search/execution-order/__tests__/types.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/search/execution-order/__tests__/types.test.ts`:

```ts
import { describe, test, expect } from 'vitest'
import { isEmptyExecutionOrder, type ExecutionOrderData } from '../types'

function data(seq: ExecutionOrderData['executionSequence']): ExecutionOrderData {
  return { loadJob: 'L', executionSequence: seq, jobDetails: {}, jobStatuses: null, statusAvailable: false }
}

describe('isEmptyExecutionOrder', () => {
  test('true for null / undefined / missing sequence', () => {
    expect(isEmptyExecutionOrder(null)).toBe(true)
    expect(isEmptyExecutionOrder(undefined)).toBe(true)
    expect(isEmptyExecutionOrder({} as ExecutionOrderData)).toBe(true)
  })
  test('true for an empty sequence array', () => {
    expect(isEmptyExecutionOrder(data([]))).toBe(true)
  })
  test('false when the sequence has at least one node', () => {
    expect(isEmptyExecutionOrder(data([{ jobName: 'A', loadJob: 'L', executionOrder: 1 }]))).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/search/execution-order/__tests__/types.test.ts`
Expected: FAIL — module `../types` does not exist.

- [ ] **Step 3: Create `src/search/execution-order/types.ts`**

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
  isScheduledToday: boolean
  isCurrentlyActive: boolean
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/search/execution-order/__tests__/types.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/search/execution-order/types.ts src/search/execution-order/__tests__/types.test.ts
git commit -m "feat(react): execution-order DTO types + empty-sequence guard

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 4: Status config map + case-insensitive status lookup

**Files:**
- Create: `src/search/execution-order/statusConfig.ts`
- Test: `src/search/execution-order/__tests__/statusConfig.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/search/execution-order/__tests__/statusConfig.test.ts`:

```ts
import { describe, test, expect } from 'vitest'
import { STATUS_CONFIG, VISUAL_STATES, findJobStatus } from '../statusConfig'
import type { JobStatusInfo } from '../types'

describe('STATUS_CONFIG', () => {
  test('covers all five visual states with label + class names', () => {
    expect(VISUAL_STATES).toEqual(['COMPLETED', 'FAILED', 'RUNNING', 'WAITING', 'INACTIVE'])
    for (const s of VISUAL_STATES) {
      const c = STATUS_CONFIG[s]
      expect(c.label.length).toBeGreaterThan(0)
      expect(c.nodeClassName).toBe(`eo-node-${s.toLowerCase()}`)
      expect(c.dotClassName).toBe(`eo-dot-${s.toLowerCase()}`)
      expect(c.badgeClassName).toBe(`eo-badge-${s.toLowerCase()}`)
    }
  })
})

describe('findJobStatus', () => {
  const statuses: Record<string, JobStatusInfo> = {
    'PRE-LOAD-ABC-123': {
      jobName: 'PRE-LOAD-ABC-123', status: 4, statusName: 'Success',
      nextStartEpoch: null, nextStartFormatted: null,
      isScheduledToday: false, isCurrentlyActive: false, visualState: 'COMPLETED',
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
Expected: FAIL — module `../statusConfig` does not exist.

- [ ] **Step 3: Create `src/search/execution-order/statusConfig.ts`**

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
}

export const STATUS_CONFIG: Record<VisualState, StatusConfig> = {
  COMPLETED: { label: 'Completed', icon: CheckCircle2Icon, nodeClassName: 'eo-node-completed', dotClassName: 'eo-dot-completed', badgeClassName: 'eo-badge-completed' },
  FAILED:    { label: 'Failed',    icon: XCircleIcon,      nodeClassName: 'eo-node-failed',    dotClassName: 'eo-dot-failed',    badgeClassName: 'eo-badge-failed' },
  RUNNING:   { label: 'Running',   icon: PlayCircleIcon,   nodeClassName: 'eo-node-running',   dotClassName: 'eo-dot-running',   badgeClassName: 'eo-badge-running' },
  WAITING:   { label: 'Waiting',   icon: ClockIcon,        nodeClassName: 'eo-node-waiting',   dotClassName: 'eo-dot-waiting',   badgeClassName: 'eo-badge-waiting' },
  INACTIVE:  { label: 'Inactive',  icon: PauseCircleIcon,  nodeClassName: 'eo-node-inactive',  dotClassName: 'eo-dot-inactive',  badgeClassName: 'eo-badge-inactive' },
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
git commit -m "feat(react): execution-order status config + case-insensitive status lookup

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 5: Dagre graph builder

**Files:**
- Create: `src/search/execution-order/layout.ts`
- Test: `src/search/execution-order/__tests__/layout.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/search/execution-order/__tests__/layout.test.ts`:

```ts
import { describe, test, expect } from 'vitest'
import { buildGraphFromData } from '../layout'
import type { ExecutionOrderData } from '../types'

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
      'PRE-LOAD-ABC-123': { jobName: 'PRE-LOAD-ABC-123', status: 4, statusName: 'Success', nextStartEpoch: null, nextStartFormatted: null, isScheduledToday: false, isCurrentlyActive: false, visualState: 'COMPLETED' },
    },
    statusAvailable: true,
  }
}

describe('buildGraphFromData', () => {
  test('produces one node per sequence entry and chains edges i -> i+1', () => {
    const { nodes, edges } = buildGraphFromData(makeData())
    expect(nodes.map((n) => n.id)).toEqual(['PRE-LOAD-ABC-123', 'MAIN-LOAD-ABC-123', 'POST-LOAD-ABC-123'])
    expect(edges.map((e) => e.id)).toEqual(['PRE-LOAD-ABC-123__MAIN-LOAD-ABC-123', 'MAIN-LOAD-ABC-123__POST-LOAD-ABC-123'])
    expect(edges.every((e) => e.type === 'smoothstep')).toBe(true)
  })

  test('lays out top-to-bottom (monotonically increasing y in sequence order)', () => {
    const { nodes } = buildGraphFromData(makeData())
    expect(nodes[0].position.y).toBeLessThan(nodes[1].position.y)
    expect(nodes[1].position.y).toBeLessThan(nodes[2].position.y)
  })

  test('resolves node data: status, label, jobType, isLoadJob, statusLabel', () => {
    const { nodes } = buildGraphFromData(makeData())
    const pre = nodes[0]
    expect(pre.data.visualState).toBe('COMPLETED')
    expect(pre.data.statusLabel).toBe('Success')
    expect(pre.data.jobType).toBe('CMD')
    expect(pre.data.label).toBe('PRE-LOAD-ABC-123')
    expect(pre.data.isLoadJob).toBe(false)
    // Jobs without a status default to INACTIVE with no status label.
    expect(nodes[1].data.visualState).toBe('INACTIVE')
    expect(nodes[1].data.statusLabel).toBe('')
  })

  test('handles an empty sequence without throwing', () => {
    const empty: ExecutionOrderData = { loadJob: 'L', executionSequence: [], jobDetails: {}, jobStatuses: null, statusAvailable: false }
    expect(buildGraphFromData(empty)).toEqual({ nodes: [], edges: [] })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/search/execution-order/__tests__/layout.test.ts`
Expected: FAIL — module `../layout` does not exist.

- [ ] **Step 3: Create `src/search/execution-order/layout.ts`**

```ts
import dagre from 'dagre'
import { Position, type Node, type Edge } from '@xyflow/react'
import type { ExecutionOrderData, VisualState } from './types'
import { findJobStatus } from './statusConfig'

export interface JobNodeData extends Record<string, unknown> {
  label: string
  jobType: string | undefined
  visualState: VisualState
  statusLabel: string
  isLoadJob: boolean
}

export type FlowNode = Node<JobNodeData, 'job'>

const NODE_WIDTH = 200
const NODE_HEIGHT = 56

/**
 * Build React Flow nodes (with dagre-computed top-to-bottom positions) + edges
 * from the execution-order DTO. The sequence is a strict linear chain, so edges
 * connect job[i] -> job[i+1]. Pure — no DOM, safe to unit-test directly.
 */
export function buildGraphFromData(
  data: ExecutionOrderData,
): { nodes: FlowNode[]; edges: Edge[] } {
  const sequence = data.executionSequence ?? []

  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'TB', nodesep: 30, ranksep: 50, marginx: 16, marginy: 16 })
  g.setDefaultEdgeLabel(() => ({}))

  for (const job of sequence) {
    g.setNode(job.jobName, { width: NODE_WIDTH, height: NODE_HEIGHT })
  }

  const edges: Edge[] = []
  for (let i = 0; i < sequence.length - 1; i++) {
    const source = sequence[i].jobName
    const target = sequence[i + 1].jobName
    g.setEdge(source, target)
    edges.push({ id: `${source}__${target}`, source, target, type: 'smoothstep' })
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
        jobType: data.jobDetails?.[job.jobName]?.jobType,
        visualState,
        statusLabel: data.statusAvailable && status ? status.statusName : '',
        isLoadJob: job.jobName === data.loadJob,
      },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    }
  })

  return { nodes, edges }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/search/execution-order/__tests__/layout.test.ts`
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**

```bash
git add src/search/execution-order/layout.ts src/search/execution-order/__tests__/layout.test.ts
git commit -m "feat(react): dagre graph builder for the execution-order sequence

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 6: Custom React Flow node

**Files:**
- Create: `src/search/execution-order/JobFlowNode.tsx`
- Test: `src/search/execution-order/__tests__/JobFlowNode.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/search/execution-order/__tests__/JobFlowNode.test.tsx`. `@xyflow/react` is mocked so `Handle` (which needs the RF store) is inert:

```tsx
import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@xyflow/react', () => ({
  Handle: () => null,
  Position: { Top: 'top', Bottom: 'bottom' },
}))

import { JobFlowNode } from '../JobFlowNode'
import type { JobNodeData } from '../layout'

function renderNode(data: Partial<JobNodeData>, selected = false) {
  const full: JobNodeData = {
    label: 'PRE-LOAD-ABC-123', jobType: 'CMD', visualState: 'RUNNING',
    statusLabel: 'Running', isLoadJob: false, ...data,
  }
  // NodeProps has many fields the node never reads; cast the minimal shape.
  return render(<JobFlowNode {...({ data: full, selected } as never)} />)
}

describe('JobFlowNode', () => {
  test('renders the job name and the status label', () => {
    renderNode({})
    expect(screen.getByText('PRE-LOAD-ABC-123')).toBeInTheDocument()
    expect(screen.getByText('(Running)')).toBeInTheDocument()
  })

  test('applies the status node class', () => {
    renderNode({ visualState: 'COMPLETED', statusLabel: 'Success' })
    expect(screen.getByTestId('eo-node')).toHaveClass('eo-node-completed')
  })

  test('omits the status line when statusLabel is empty', () => {
    renderNode({ statusLabel: '' })
    expect(screen.queryByText(/\(.*\)/)).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/search/execution-order/__tests__/JobFlowNode.test.tsx`
Expected: FAIL — module `../JobFlowNode` does not exist.

- [ ] **Step 3: Create `src/search/execution-order/JobFlowNode.tsx`**

```tsx
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { CodeIcon, FolderIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { STATUS_CONFIG } from './statusConfig'
import type { FlowNode } from './layout'

/** Custom React Flow node: a shadcn-styled card tinted by live job status. */
export function JobFlowNode({ data, selected }: NodeProps<FlowNode>) {
  const status = STATUS_CONFIG[data.visualState]
  const TypeIcon = data.jobType === 'BOX' ? FolderIcon : CodeIcon
  return (
    <div
      data-testid="eo-node"
      className={cn(
        'eo-node flex w-[200px] flex-col gap-0.5 rounded-md border px-3 py-2 text-xs shadow-sm transition-colors',
        status.nodeClassName,
        selected && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
      )}
    >
      <Handle type="target" position={Position.Top} className="!size-1.5 !bg-border" />
      <div className="flex items-center gap-1.5">
        <TypeIcon className="size-3.5 shrink-0 opacity-70" />
        <span className="truncate font-mono font-medium">{data.label}</span>
      </div>
      {data.statusLabel && (
        <span className="pl-5 text-[11px] opacity-80">({data.statusLabel})</span>
      )}
      <Handle type="source" position={Position.Bottom} className="!size-1.5 !bg-border" />
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/search/execution-order/__tests__/JobFlowNode.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/search/execution-order/JobFlowNode.tsx src/search/execution-order/__tests__/JobFlowNode.test.tsx
git commit -m "feat(react): status-tinted custom React Flow node

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 7: Status legend

**Files:**
- Create: `src/search/execution-order/StatusLegend.tsx`
- Test: `src/search/execution-order/__tests__/StatusLegend.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/search/execution-order/__tests__/StatusLegend.test.tsx`:

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
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/search/execution-order/__tests__/StatusLegend.test.tsx`
Expected: FAIL — module `../StatusLegend` does not exist.

- [ ] **Step 3: Create `src/search/execution-order/StatusLegend.tsx`**

```tsx
import { cn } from '@/lib/utils'
import { STATUS_CONFIG, VISUAL_STATES } from './statusConfig'

/** Five token-colored dots keyed to the node status tints. */
export function StatusLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1" data-testid="eo-legend">
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
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/search/execution-order/__tests__/StatusLegend.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/search/execution-order/StatusLegend.tsx src/search/execution-order/__tests__/StatusLegend.test.tsx
git commit -m "feat(react): execution-order status legend

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 8: Job details side panel

**Files:**
- Create: `src/search/execution-order/JobDetailsPanel.tsx`
- Test: `src/search/execution-order/__tests__/JobDetailsPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/search/execution-order/__tests__/JobDetailsPanel.test.tsx`:

```tsx
import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { JobDetailsPanel } from '../JobDetailsPanel'
import type { JobDetails, JobStatusInfo } from '../types'

const details: JobDetails = {
  jobType: 'CMD', machine: 'na-trade01', runCalendar: 'DAILY_NA',
  excludeCalendar: 'NA_HOLIDAYS', boxName: 'BOX_TRADE_RECON_001', command: '', description: '',
}
const status: JobStatusInfo = {
  jobName: 'PRE_LOAD_TRADE_RECON_001', status: 4, statusName: 'Success',
  nextStartEpoch: 1747084800, nextStartFormatted: 'May 12, 8:00 AM',
  isScheduledToday: true, isCurrentlyActive: false, visualState: 'COMPLETED',
}

describe('JobDetailsPanel', () => {
  test('shows the empty hint when no job is selected', () => {
    render(<JobDetailsPanel jobName={null} details={undefined} status={null} statusAvailable />)
    expect(screen.getByText(/click on any job/i)).toBeInTheDocument()
  })

  test('renders job fields when a job is selected', () => {
    render(<JobDetailsPanel jobName="PRE_LOAD_TRADE_RECON_001" details={details} status={status} statusAvailable />)
    expect(screen.getByText('PRE_LOAD_TRADE_RECON_001')).toBeInTheDocument()
    expect(screen.getByText('na-trade01')).toBeInTheDocument()
    expect(screen.getByText('DAILY_NA')).toBeInTheDocument()
    expect(screen.getByText('BOX_TRADE_RECON_001')).toBeInTheDocument()
    expect(screen.getByText('Success')).toBeInTheDocument()
    expect(screen.getByText(/May 12, 8:00 AM/)).toBeInTheDocument()
  })

  test('hides the status badge when statusAvailable is false', () => {
    render(<JobDetailsPanel jobName="PRE_LOAD_TRADE_RECON_001" details={details} status={status} statusAvailable={false} />)
    expect(screen.queryByText('Success')).toBeNull()
    // Job fields still render.
    expect(screen.getByText('na-trade01')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/search/execution-order/__tests__/JobDetailsPanel.test.tsx`
Expected: FAIL — module `../JobDetailsPanel` does not exist.

- [ ] **Step 3: Create `src/search/execution-order/JobDetailsPanel.tsx`** — uses `m.*` from `motion/react` (the codebase's LazyMotion convention; never `motion.*`). The slide-in is reduced-motion gated globally by `<MotionConfig reducedMotion="user">` in `src/components/layout/motion-provider.tsx`, so no per-component gate is needed; under `render()` in tests `m.div` renders as a plain element (no LazyMotion ancestor), so the text assertions still pass.

```tsx
import { CodeIcon, FolderIcon, CalendarIcon, CalendarOffIcon, ServerIcon, BoxIcon, CalendarClockIcon, MousePointerClickIcon } from 'lucide-react'
import { m } from 'motion/react'

import { cn } from '@/lib/utils'
import { STATUS_CONFIG } from './statusConfig'
import type { JobDetails, JobStatusInfo } from './types'

interface Props {
  jobName: string | null
  details: JobDetails | undefined
  status: JobStatusInfo | null
  statusAvailable: boolean
}

function Row({ icon: Icon, label, value }: { icon: typeof ServerIcon; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5 border-b px-4 py-2.5 last:border-b-0">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="truncate text-sm">{value || 'N/A'}</div>
      </div>
    </div>
  )
}

/** Right-hand details pane: selected job's metadata + (when available) live status. */
export function JobDetailsPanel({ jobName, details, status, statusAvailable }: Props) {
  if (!jobName || !details) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-10 text-center" data-testid="eo-details-empty">
        <MousePointerClickIcon className="size-8 text-muted-foreground opacity-60" />
        <p className="text-sm text-muted-foreground">Click on any job in the graph to view its details</p>
      </div>
    )
  }

  const TypeIcon = details.jobType === 'BOX' ? FolderIcon : CodeIcon
  const showStatus = statusAvailable && status

  return (
    <m.div
      key={jobName}
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="flex flex-col"
    >
      <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-3">
        <TypeIcon className="size-4 shrink-0 text-primary" />
        <span className="truncate font-mono text-sm font-medium">{jobName}</span>
      </div>

      {showStatus && (
        <div className="flex items-center gap-2 border-b px-4 py-2.5">
          <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium', STATUS_CONFIG[status.visualState].badgeClassName)}>
            {status.statusName}
          </span>
          {status.nextStartFormatted && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarClockIcon className="size-3.5" />
              Next Run: {status.nextStartFormatted}
            </span>
          )}
        </div>
      )}

      <Row icon={ServerIcon} label="Machine" value={details.machine} />
      <Row icon={CalendarIcon} label="Run Calendar" value={details.runCalendar} />
      <Row icon={CalendarOffIcon} label="Exclude Calendar" value={details.excludeCalendar} />
      {details.boxName && <Row icon={BoxIcon} label="Box Name" value={details.boxName} />}
    </m.div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/search/execution-order/__tests__/JobDetailsPanel.test.tsx`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add src/search/execution-order/JobDetailsPanel.tsx src/search/execution-order/__tests__/JobDetailsPanel.test.tsx
git commit -m "feat(react): execution-order job details side panel

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 9: React Flow graph wrapper

**Files:**
- Create: `src/search/execution-order/ExecutionOrderGraph.tsx`
- Test: `src/search/execution-order/__tests__/ExecutionOrderGraph.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/search/execution-order/__tests__/ExecutionOrderGraph.test.tsx`. The whole `@xyflow/react` surface is mocked (jsdom has no layout, so the real `<ReactFlow>` renders nothing); the mock captures the `nodes` prop so we assert the data was adapted. The mock must also export `Position` because `layout.ts` imports it:

```tsx
import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ nodes }: { nodes: unknown[] }) => (
    <div data-testid="rf" data-node-count={nodes.length} />
  ),
  Background: () => null,
  BackgroundVariant: { Dots: 'dots' },
  Controls: () => null,
  MiniMap: () => null,
  MarkerType: { ArrowClosed: 'arrowclosed' },
  Position: { Top: 'top', Bottom: 'bottom' },
}))

import { ExecutionOrderGraph } from '../ExecutionOrderGraph'
import type { ExecutionOrderData } from '../types'

const data: ExecutionOrderData = {
  loadJob: 'LOAD-ABC-123',
  executionSequence: [
    { jobName: 'PRE-LOAD-ABC-123', loadJob: 'LOAD-ABC-123', executionOrder: 1 },
    { jobName: 'MAIN-LOAD-ABC-123', loadJob: 'LOAD-ABC-123', executionOrder: 2 },
    { jobName: 'POST-LOAD-ABC-123', loadJob: 'LOAD-ABC-123', executionOrder: 3 },
  ],
  jobDetails: {}, jobStatuses: null, statusAvailable: false,
}

describe('ExecutionOrderGraph', () => {
  test('adapts the DTO into React Flow nodes (one per sequence entry)', () => {
    render(<ExecutionOrderGraph data={data} onSelect={vi.fn()} />)
    expect(screen.getByTestId('rf').getAttribute('data-node-count')).toBe('3')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/search/execution-order/__tests__/ExecutionOrderGraph.test.tsx`
Expected: FAIL — module `../ExecutionOrderGraph` does not exist.

- [ ] **Step 3: Create `src/search/execution-order/ExecutionOrderGraph.tsx`**

```tsx
import { useMemo } from 'react'
import {
  ReactFlow, Background, BackgroundVariant, Controls, MiniMap, MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { buildGraphFromData } from './layout'
import { JobFlowNode } from './JobFlowNode'
import type { ExecutionOrderData } from './types'

const nodeTypes = { job: JobFlowNode }

interface Props {
  data: ExecutionOrderData
  onSelect: (jobName: string | null) => void
}

/** Thin React Flow wrapper. All graph data is precomputed by buildGraphFromData
 * (unit-tested) so this component stays declarative and easy to reason about. */
export function ExecutionOrderGraph({ data, onSelect }: Props) {
  const { nodes, edges } = useMemo(() => buildGraphFromData(data), [data])
  return (
    <div className="size-full" data-testid="eo-graph">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        defaultEdgeOptions={{ type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } }}
        onNodeClick={(_event, node) => onSelect(node.id)}
        onPaneClick={() => onSelect(null)}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/search/execution-order/__tests__/ExecutionOrderGraph.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/search/execution-order/ExecutionOrderGraph.tsx src/search/execution-order/__tests__/ExecutionOrderGraph.test.tsx
git commit -m "feat(react): React Flow graph wrapper for the execution-order modal

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 10: The modal shell

**Files:**
- Create: `src/search/execution-order/ExecutionOrderModal.tsx`
- Test: `src/search/execution-order/__tests__/ExecutionOrderModal.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/search/execution-order/__tests__/ExecutionOrderModal.test.tsx`. `ExecutionOrderGraph` is mocked so no React Flow renders:

```tsx
import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../ExecutionOrderGraph', () => ({
  ExecutionOrderGraph: () => <div data-testid="eo-graph-mock" />,
}))

import { ExecutionOrderModal } from '../ExecutionOrderModal'
import type { ExecutionOrderData } from '../types'

function base(overrides: Partial<ExecutionOrderData> = {}): ExecutionOrderData {
  return {
    loadJob: 'LOAD-ABC-123',
    executionSequence: [
      { jobName: 'PRE-LOAD-ABC-123', loadJob: 'LOAD-ABC-123', executionOrder: 1 },
    ],
    jobDetails: {}, jobStatuses: null, statusAvailable: true, ...overrides,
  }
}

describe('ExecutionOrderModal', () => {
  test('renders the header with the load job and the graph', () => {
    render(<ExecutionOrderModal data={base()} jobName="LOAD-ABC-123" open onOpenChange={vi.fn()} />)
    expect(screen.getByText('Job Execution Order')).toBeInTheDocument()
    expect(screen.getByText('LOAD-ABC-123')).toBeInTheDocument()
    expect(screen.getByTestId('eo-graph-mock')).toBeInTheDocument()
  })

  test('shows the legend when statusAvailable is true', () => {
    render(<ExecutionOrderModal data={base({ statusAvailable: true })} jobName="LOAD-ABC-123" open onOpenChange={vi.fn()} />)
    expect(screen.getByTestId('eo-legend')).toBeInTheDocument()
  })

  test('shows the "live status unavailable" note (no legend) when statusAvailable is false', () => {
    render(<ExecutionOrderModal data={base({ statusAvailable: false })} jobName="LOAD-ABC-123" open onOpenChange={vi.fn()} />)
    expect(screen.getByTestId('eo-status-unavailable')).toBeInTheDocument()
    expect(screen.queryByTestId('eo-legend')).toBeNull()
  })

  test('shows the empty state when the sequence is empty', () => {
    render(<ExecutionOrderModal data={base({ executionSequence: [] })} jobName="LOAD-ABC-123" open onOpenChange={vi.fn()} />)
    expect(screen.getByTestId('eo-empty')).toBeInTheDocument()
    expect(screen.queryByTestId('eo-graph-mock')).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/search/execution-order/__tests__/ExecutionOrderModal.test.tsx`
Expected: FAIL — module `../ExecutionOrderModal` does not exist.

- [ ] **Step 3: Create `src/search/execution-order/ExecutionOrderModal.tsx`** — note the `sm:max-w-[min(95vw,1100px)]` on `DialogContent`: shadcn's base `DialogContent` (`src/components/ui/dialog.tsx:62`) bakes in `sm:max-w-lg` (32rem), and an *unprefixed* `max-w-[…]` does NOT override a `sm:`-prefixed class under tailwind-merge — so the `sm:`-prefixed override is required or the modal caps at 32rem on ≥640px viewports.

```tsx
import { useState } from 'react'
import { NetworkIcon } from 'lucide-react'

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { ExecutionOrderGraph } from './ExecutionOrderGraph'
import { JobDetailsPanel } from './JobDetailsPanel'
import { StatusLegend } from './StatusLegend'
import { findJobStatus } from './statusConfig'
import { isEmptyExecutionOrder, type ExecutionOrderData } from './types'

interface Props {
  data: ExecutionOrderData
  jobName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** The execution-order graph modal — graph pane + job-details side panel. */
export function ExecutionOrderModal({ data, jobName, open, onOpenChange }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const empty = isEmptyExecutionOrder(data)
  const selectedDetails = selected ? data.jobDetails?.[selected] : undefined
  const selectedStatus = selected ? findJobStatus(data.jobStatuses, selected) : null

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
          <DialogDescription className="sr-only">Execution sequence for {jobName}</DialogDescription>
        </DialogHeader>

        {empty ? (
          <div className="flex flex-1 items-center justify-center p-16 text-sm text-muted-foreground" data-testid="eo-empty">
            No execution sequence found for {jobName}.
          </div>
        ) : (
          <div className="flex min-h-0 flex-1">
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex shrink-0 items-center border-b px-4 py-2">
                {data.statusAvailable ? (
                  <StatusLegend />
                ) : (
                  <span className="text-[11px] text-muted-foreground" data-testid="eo-status-unavailable">
                    Live status unavailable
                  </span>
                )}
              </div>
              <div className="min-h-0 flex-1">
                <ExecutionOrderGraph data={data} onSelect={setSelected} />
              </div>
            </div>
            <div className="w-[360px] shrink-0 overflow-y-auto border-l">
              <JobDetailsPanel
                jobName={selected}
                details={selectedDetails}
                status={selectedStatus}
                statusAvailable={data.statusAvailable}
              />
            </div>
          </div>
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
git commit -m "feat(react): execution-order modal shell (graph + details panel)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 11: Wire the modal into the cell renderer

**Files:**
- Modify: `src/search/renderers/ExecutionOrderCellRenderer.tsx`
- Modify: `src/search/__tests__/ExecutionOrderCellRenderer.test.tsx` (replace placeholder-era assertions)

- [ ] **Step 1: Update the renderer test to expect the modal (write the new assertions first)**

In `src/search/__tests__/ExecutionOrderCellRenderer.test.tsx`:

(a) Add a hoisted mock for the modal directly below the existing `vi.mock('@/lib/queryClient', …)` block:

```tsx
vi.mock('@/search/execution-order/ExecutionOrderModal', () => ({
  ExecutionOrderModal: ({ open, jobName }: { open: boolean; jobName: string }) =>
    open ? <div data-testid="eo-modal">modal:{jobName}</div> : null,
}))
```

(b) Replace the success-path test (the `'on success, opens Dialog with title …'` test) with:

```tsx
  test('on success, opens the ExecutionOrderModal with the job name', async () => {
    const mockApi = apiFetch as unknown as ReturnType<typeof vi.fn>
    const responsePayload = { loadJob: 'JOB-1', executionSequence: [{ jobName: 'A', executionOrder: 1, loadJob: 'JOB-1' }], jobDetails: {}, jobStatuses: null, statusAvailable: true }
    mockApi.mockResolvedValue({ json: () => Promise.resolve(responsePayload) })

    render(
      <ExecutionOrderCellRenderer {...makeParams({ data: { load_job: 'JOB-1' } })} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /view/i }))

    await waitFor(() => {
      expect(screen.getByTestId('eo-modal')).toHaveTextContent('modal:JOB-1')
    })
  })
```

(c) Replace the `'source file contains literal "TODO(Phase 4)" marker'` test with its inverse — the placeholder is now gone:

```tsx
  test('source no longer contains the Phase 4 placeholder marker or a JSON <pre>', async () => {
    const mod = await import('../renderers/ExecutionOrderCellRenderer.tsx?raw')
    expect(mod.default.includes('TODO(Phase 4)')).toBe(false)
    expect(mod.default.includes('JSON.stringify')).toBe(false)
  })
```

(d) The failure-path test asserts `screen.queryByText(/Execution Order/)` is null on failure. The modal is mocked and only renders when `open`, so it stays null on failure — leave that test as-is.

- [ ] **Step 2: Run the renderer test to verify the new assertions fail**

Run: `pnpm exec vitest run src/search/__tests__/ExecutionOrderCellRenderer.test.tsx`
Expected: FAIL — the renderer still renders the `<pre>` placeholder and still contains `TODO(Phase 4)`.

- [ ] **Step 3: Rewrite `src/search/renderers/ExecutionOrderCellRenderer.tsx`**

Replace the whole file with (keeps the button + fetch/loading/error logic; swaps the dialog body for the modal; drops the placeholder + TODO comments; types the response as `ExecutionOrderData`):

```tsx
import { useState } from 'react'
import type { ICellRendererParams } from 'ag-grid-community'
import { GitBranchIcon, Loader2Icon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { apiFetch, reportRequestFailure } from '@/lib/queryClient'
import { ExecutionOrderModal } from '@/search/execution-order/ExecutionOrderModal'
import type { ExecutionOrderData } from '@/search/execution-order/types'

/**
 * ExecutionOrderCellRenderer — React port of ExecutionOrderButtonComponent.
 *
 * - Renders null when the jobName field is undefined / empty / whitespace-only.
 * - jobName field is read from colDef.cellRendererParams.jobNameField; defaults
 *   to 'load_job' to mirror the Angular default.
 * - On click, fetches /rectrace/api/execution-order/{encodeURIComponent(jobName)}
 *   via apiFetch (which attaches X-Correlation-Id).
 * - While in-flight, the button is disabled and shows Loader2Icon (animate-spin).
 * - On success, opens the ExecutionOrderModal (React Flow graph + details panel).
 * - On failure, reportRequestFailure(err) surfaces a Sonner toast; modal stays closed.
 */
export function ExecutionOrderCellRenderer(params: ICellRendererParams) {
  const colDef = params.colDef as { cellRendererParams?: { jobNameField?: string } } | undefined
  const jobNameField = colDef?.cellRendererParams?.jobNameField ?? 'load_job'
  const data = params.data as Record<string, unknown> | undefined
  const rawJobName = data?.[jobNameField]
  const jobName = typeof rawJobName === 'string' ? rawJobName : undefined

  const [isLoading, setIsLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [responseData, setResponseData] = useState<ExecutionOrderData | null>(null)

  if (!jobName || jobName.trim().length === 0) {
    return null
  }

  const handleClick = async () => {
    setIsLoading(true)
    try {
      const res = await apiFetch(`/rectrace/api/execution-order/${encodeURIComponent(jobName)}`)
      const json = (await res.json()) as ExecutionOrderData
      setResponseData(json)
      setOpen(true)
    } catch (err) {
      reportRequestFailure(err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => { void handleClick() }}
        disabled={isLoading}
        aria-label="View Execution Order"
        className="h-6 min-w-[80px] px-2 text-primary text-[12px] font-normal hover:bg-accent"
      >
        {isLoading ? (
          <Loader2Icon className="size-3.5 animate-spin" />
        ) : (
          <span className="inline-flex items-center gap-1">
            <GitBranchIcon className="size-3.5 opacity-70" />
            View
          </span>
        )}
      </Button>
      {responseData && (
        <ExecutionOrderModal
          data={responseData}
          jobName={jobName}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </>
  )
}
```

- [ ] **Step 4: Run the renderer test to verify it passes**

Run: `pnpm exec vitest run src/search/__tests__/ExecutionOrderCellRenderer.test.tsx`
Expected: PASS (all cases, including the new modal + inverted-marker tests).

- [ ] **Step 5: Commit**

```bash
git add src/search/renderers/ExecutionOrderCellRenderer.tsx src/search/__tests__/ExecutionOrderCellRenderer.test.tsx
git commit -m "feat(react): wire ExecutionOrderModal into the View button, drop placeholder

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 12: Full verification + manual smoke

**Files:** none (verification only).

- [ ] **Step 1: Full test suite**

Run: `pnpm test`
Expected: all suites pass (the new execution-order suites + the existing ones — `registry.test.ts` and `configToColDefs.test.ts` still pass since `ExecutionOrderCellRenderer` is still exported with the same name).

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 3: Lint (hex rule)**

Run: `pnpm lint`
Expected: exit 0 — no `no-restricted-syntax` hex violations (all color comes from `var(--…)` / `eo-*` classes / oklch CSS tokens).

- [ ] **Step 4: Manual smoke against the running stack**

With Part A applied, backend on `:6088`, and `pnpm dev` on `:5173`: open the search grid, run a query that returns rows with a `load_job` (e.g. search for `LOAD-ABC-123` or browse the volume data), click **View** in the Execution Order column. Confirm:
- the modal opens with a top-to-bottom graph (PRE → MAIN → POST),
- nodes are status-tinted and the legend shows five states,
- clicking a node populates the right-hand details panel (Machine / Run Calendar / Exclude Calendar / Box Name, + status badge),
- light/dark toggle recolors the graph,
- closing and reopening works.

- [ ] **Step 5: Dispatch the final whole-implementation code review**

Per `superpowers:subagent-driven-development`, after all tasks dispatch a final code reviewer over the full diff (`git diff main...feature/execution-order-modal`). Address Critical/Important findings before considering Part B done.

- [ ] **Step 6: No extra commit** beyond Task 11 unless review fixes are needed.

---

## Self-Review

**Spec coverage:**
- Deps `@xyflow/react` + `dagre` → Task 1 ✅
- 5 status tokens (index.css + theme.ts + STATE.md) → Task 2 ✅
- `types.ts` mirror + empty guard → Task 3 ✅
- `statusConfig.ts` + case-insensitive lookup → Task 4 ✅
- `layout.ts` dagre TB, i→i+1 edges → Task 5 ✅
- `JobFlowNode` (status tint, type icon, selected ring) → Task 6 ✅
- `StatusLegend` → Task 7 ✅
- `JobDetailsPanel` (fields, empty, degraded) → Task 8 ✅
- `ExecutionOrderGraph` (RF + Background/Controls/MiniMap) → Task 9 ✅
- `ExecutionOrderModal` (Dialog, two-pane, empty + degraded gating) → Task 10 ✅
- Renderer wiring + placeholder removal → Task 11 ✅
- Token-colored edges + arrowheads (markerEnd) → Task 9 `defaultEdgeOptions` + Task 2 edge CSS ✅
- Details-panel Motion slide-in (reduced-motion gated by the app's `MotionConfig reducedMotion="user"`) → Task 8 ✅
- Empty / status-degraded / fetch-failure states → Tasks 10 + 11 ✅
- Testing (vitest units + manual) → every task + Task 12 ✅

**Placeholder scan:** No TBD/TODO/"handle errors" — every code step shows complete code; every run step has an exact command + expected result. (The only "TODO" mentioned is the literal `TODO(Phase 4)` string being *removed* in Task 11.) ✅

**Type consistency:** `ExecutionOrderData`/`JobNode`/`JobDetails`/`JobStatusInfo`/`VisualState` (Task 3) are used identically in Tasks 4–11. `FlowNode`/`JobNodeData` (Task 5) are consumed by `JobFlowNode` (Task 6) and `ExecutionOrderGraph` (Task 9). `STATUS_CONFIG` class names (`eo-node-*`/`eo-dot-*`/`eo-badge-*`, Task 4) match the CSS classes defined in Task 2 and the `statusConfig.test.ts` assertions. `findJobStatus` (Task 4) is used by `layout.ts` (Task 5) and `ExecutionOrderModal` (Task 10). `buildGraphFromData` (Task 5) is the single graph-building entry consumed by Task 9. Modal props (`data`/`jobName`/`open`/`onOpenChange`) match the renderer's usage (Task 11) and the modal mock (Task 11 test). ✅

**Out of scope (per spec):** `command`/`description` CLOBs stay empty (the panel only renders Machine/Run/Exclude/Box, mirroring the empty backend fields); no branching graphs; no backend change. ✅
