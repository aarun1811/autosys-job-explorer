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
