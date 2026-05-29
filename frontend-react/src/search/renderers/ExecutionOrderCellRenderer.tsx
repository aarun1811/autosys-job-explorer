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
