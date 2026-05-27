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
