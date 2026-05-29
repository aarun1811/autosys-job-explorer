import { MousePointerClickIcon, LayersIcon, TimerIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { findJobStatus } from './statusConfig'
import { rollup, formatDuration, type ExecutionOrderData, type JobStatusInfo } from './types'

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
  const r = rollup(data)
  // Longest run is computed over the sequence NODES only (resolved
  // case-insensitively) — not raw jobStatuses, which includes the parent load
  // box and would otherwise win as the "longest" non-node run.
  const longest = data.executionSequence
    .map((j) => findJobStatus(data.jobStatuses, j.jobName))
    .filter((s): s is JobStatusInfo => s != null)
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
