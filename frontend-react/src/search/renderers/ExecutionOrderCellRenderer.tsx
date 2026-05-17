import { useState } from 'react'
import type { ICellRendererParams } from 'ag-grid-community'
import { GitBranchIcon, Loader2Icon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { apiFetch, reportRequestFailure } from '@/lib/queryClient'

/**
 * ExecutionOrderCellRenderer — React port of ExecutionOrderButtonComponent.
 *
 * Behavioral parity with Angular source:
 *   frontend/rectrace/src/app/custom-interactions/components/renderers/execution-order-button.component.ts
 *
 * - Renders null when the jobName field is undefined / empty / whitespace-only.
 * - jobName field is read from colDef.cellRendererParams.jobNameField; defaults
 *   to 'load_job' to mirror the Angular default.
 * - On click, fetches /rectrace/api/execution-order/{encodeURIComponent(jobName)}
 *   via the Phase 2 apiFetch (which attaches X-Correlation-Id).
 * - While in-flight, the button is disabled and shows Loader2Icon (animate-spin).
 * - On success, a placeholder Dialog opens with the raw JSON response in a <pre>.
 * - On failure, reportRequestFailure(err) surfaces a Sonner toast with the
 *   32-hex correlation id (SEARCH-06). Dialog is NOT opened on failure.
 *
 * NO deferred-macrotask wrapper around reportRequestFailure — the SmokeGrid
 * Sonner-mount race only affects SSRM initial getRows. By the time a user
 * clicks an in-row button, the Toaster is already mounted (03-PATTERNS.md
 * §"Sonner-mount race workaround" Pitfall 3).
 *
 * TODO(Phase 4): replace the placeholder <pre>{JSON.stringify(data)}</pre> Dialog
 * body with the Cytoscape ExecutionOrderModal — see Phase 4 plan. Phase 4 will
 * grep for this exact "TODO(Phase 4)" comment to find the placeholder.
 */
export function ExecutionOrderCellRenderer(params: ICellRendererParams) {
  const colDef = params.colDef as { cellRendererParams?: { jobNameField?: string } } | undefined
  const jobNameField = colDef?.cellRendererParams?.jobNameField ?? 'load_job'
  const data = params.data as Record<string, unknown> | undefined
  const rawJobName = data?.[jobNameField]
  const jobName = typeof rawJobName === 'string' ? rawJobName : undefined

  const [isLoading, setIsLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [responseData, setResponseData] = useState<unknown>(null)

  if (!jobName || jobName.trim().length === 0) {
    return null
  }

  const handleClick = async () => {
    setIsLoading(true)
    try {
      const res = await apiFetch(`/rectrace/api/execution-order/${encodeURIComponent(jobName)}`)
      const json = (await res.json()) as unknown
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
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Execution Order — {jobName}</DialogTitle>
          </DialogHeader>
          {/* TODO(Phase 4): replace placeholder with ExecutionOrderModal (Cytoscape) */}
          <pre className="text-xs font-mono overflow-auto max-h-[60vh]">
            {JSON.stringify(responseData, null, 2)}
          </pre>
        </DialogContent>
      </Dialog>
    </>
  )
}
