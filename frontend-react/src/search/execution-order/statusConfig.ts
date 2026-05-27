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
