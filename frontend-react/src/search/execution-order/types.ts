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
  // Jackson serializes the backend's boolean getters without the `is` prefix,
  // so the wire keys are `scheduledToday` / `currentlyActive` (verified against
  // the live payload). Unused by the modal today, but kept faithful to the wire.
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
