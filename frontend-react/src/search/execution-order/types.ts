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

/**
 * lower(jobName) -> visualState. Mirrors findJobStatus's case-insensitivity
 * (JobStatusService keys jobStatuses UPPERCASE) without importing statusConfig
 * (types.ts must not depend on it — would be an import cycle).
 */
function statesByLowerName(
  data: ExecutionOrderData | null | undefined,
): Map<string, VisualState> {
  const m = new Map<string, VisualState>()
  for (const [key, info] of Object.entries(data?.jobStatuses ?? {})) {
    m.set(key.toLowerCase(), info.visualState)
  }
  return m
}

/**
 * Status rollup over the execution-order NODES (the sequence) — NOT the raw
 * jobStatuses map. The backend includes the parent load "box" in jobStatuses,
 * and it is not a graph node, so counting the map double-counts it (total would
 * exceed "N jobs"). We count each sequence member, resolving its status
 * case-insensitively and defaulting an absent one to INACTIVE, so total always
 * equals the node count. Pure, null-tolerant.
 */
export function rollup(
  data: ExecutionOrderData | null | undefined,
): Rollup {
  const counts: Record<VisualState, number> = {
    COMPLETED: 0, FAILED: 0, RUNNING: 0, WAITING: 0, INACTIVE: 0,
  }
  const seq = data?.executionSequence ?? []
  const states = statesByLowerName(data)
  for (const j of seq) counts[states.get(j.jobName.toLowerCase()) ?? 'INACTIVE'] += 1
  const total = seq.length
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
  // Resolve case-insensitively (JobStatusService keys jobStatuses UPPERCASE) so
  // smart-focus doesn't silently fall back to the top node on a casing mismatch.
  const states = statesByLowerName(data)
  const stateOf = (name: string): VisualState =>
    states.get(name.toLowerCase()) ?? 'INACTIVE'
  const failed = seq.find((j) => stateOf(j.jobName) === 'FAILED')
  if (failed) return failed.jobName
  const running = seq.find((j) => stateOf(j.jobName) === 'RUNNING')
  if (running) return running.jobName
  return seq[0].jobName
}
