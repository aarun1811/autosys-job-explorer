import { useMemo } from 'react'
import { AgGridReact } from 'ag-grid-react'
import type { IServerSideDatasource, ColDef } from 'ag-grid-community'
import { apiFetch, reportRequestFailure } from '@/lib/queryClient'

const columnDefs: ColDef[] = [
  { field: 'jobName', headerName: 'Job Name', width: 200 },
  { field: 'fileName', headerName: 'File Name', width: 200 },
  { field: 'machine', headerName: 'Machine', width: 150 },
  { field: 'status', headerName: 'Status', width: 120 },
]

const NoRowsOverlay = () => <span>No seed data found</span>

export function SmokeGrid() {
  // Datasource is created per-instance so each grid mount gets its own AbortController.
  // The destroy() hook aborts in-flight fetches when the grid unmounts, preventing
  // params.success() from being called on a detached SSRM context.
  const datasource = useMemo<IServerSideDatasource>(() => {
    const controller = new AbortController()
    return {
      getRows: async (params) => {
        try {
          const body = {
            category: 'fileName',
            initialFilter: null,
            rowGroupCols: [],
            groupKeys: [],
            sortModel: params.request.sortModel ?? [],
            filterModel: params.request.filterModel ?? {},
            startRow: params.request.startRow,
            endRow: params.request.endRow,
            visibleColumns: [],
          }
          const res = await apiFetch('/rectrace/api/v4/search/ssrm/fileName', {
            method: 'POST',
            body: JSON.stringify(body),
            signal: controller.signal,
          })
          const data = await res.json() as { rows: Record<string, unknown>[]; lastRow: number }
          params.success({ rowData: data.rows, rowCount: data.lastRow })
        } catch (err) {
          if ((err as { name?: string }).name !== 'AbortError') {
            console.error('SSRM fail', err)
            // The AG-Grid SSRM datasource bypasses React Query, so the QueryClient
            // queryCache onError handler does not fire. Surface the failure (and
            // the corr-id, when present on the error) via the same Sonner toast
            // path so users can quote the reference in a bug report.
            //
            // The deferral via setTimeout(0) prevents a Sonner 2.x race: AG-Grid's
            // initial getRows fires inside the same commit/effect cascade as the
            // Toaster's own mount, and Sonner silently drops toasts dispatched
            // before its subscriber attaches. Pushing this to the next macrotask
            // guarantees the Toaster is live when toast.error() runs.
            setTimeout(() => reportRequestFailure(err), 0)
            params.fail()
          }
        }
      },
      destroy: () => controller.abort(),
    }
  }, [])

  return (
    <div className="ag-theme-quartz h-[calc(100vh-6rem)]">
      <AgGridReact
        rowModelType="serverSide"
        serverSideDatasource={datasource}
        columnDefs={columnDefs}
        noRowsOverlayComponent={NoRowsOverlay}
      />
    </div>
  )
}
