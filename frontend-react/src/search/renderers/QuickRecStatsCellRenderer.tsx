import { useState } from 'react'
import type { ICellRendererParams } from 'ag-grid-community'
import { SparklesIcon, Loader2Icon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useTheme } from '@/components/layout/theme-provider'
import { buildEmbedUrl } from '@/search/recviz/buildEmbedUrl'
import { getRecvizOrigin } from '@/search/recviz/recvizConfig'
import { RecvizDashboardModal } from '@/search/recviz/RecvizDashboardModal'

const DASHBOARD_ID = 'dash-quickrec-stats'

/**
 * QuickRecStatsCellRenderer — React port of Angular's `reconIdRenderer` /
 * `recPortalIdRenderer`. The cell value is rendered as text always; on rows
 * where `tlm_instance === 'QuickRec'` it becomes a clickable link (insights
 * icon + the value) that opens the embedded RecViz QuickRec dashboard.
 *
 * Wired via `cellRenderer: "quickRecStatsButtonRenderer"` on both `recon_id`
 * and `recon_portal_id` columns; `cellRendererParams.entryPoint` (recon_id |
 * rec_portal_id) decides which filter is locked when the modal opens.
 */
export function QuickRecStatsCellRenderer(params: ICellRendererParams) {
  const colDef = params.colDef as { cellRendererParams?: { entryPoint?: 'recon_id' | 'rec_portal_id' } } | undefined
  const entryPoint = colDef?.cellRendererParams?.entryPoint ?? 'recon_id'
  const data = params.data as Record<string, unknown> | undefined
  const { resolvedTheme } = useTheme()
  const [open, setOpen] = useState(false)

  const rawValue = typeof params.value === 'string' ? params.value : ''
  const value = rawValue.trim()
  if (!value || value === '-') return null

  const isClickable = data?.tlm_instance === 'QuickRec'

  // Plain text for non-QuickRec rows — preserves the cell's data display.
  if (!isClickable) {
    return <span className="text-foreground">{value}</span>
  }

  // QuickRec row → render as a clickable link with insights icon.
  const reconId = typeof data?.recon_id === 'string' ? data.recon_id : undefined
  const recPortalId = typeof data?.recon_portal_id === 'string' ? data.recon_portal_id : undefined
  if (!reconId && !recPortalId) {
    // Defensive: tlm_instance==='QuickRec' but no id fields — shouldn't happen,
    // but fall back to plain text rather than a broken link.
    return <span className="text-foreground">{value}</span>
  }

  const url = buildEmbedUrl({
    origin: getRecvizOrigin(),
    dashboardId: DASHBOARD_ID,
    filters: { recon_id: reconId, rec_portal_id: recPortalId },
    lock: [entryPoint],
    theme: resolvedTheme,
  })

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`View QuickRec stats for ${value}`}
        className={cn(
          'inline-flex items-center gap-1 text-primary hover:underline',
          'cursor-pointer text-[12px] font-normal',
        )}
      >
        <SparklesIcon className="size-3.5 opacity-70" aria-hidden />
        <span className="font-mono">{value}</span>
        {open && <Loader2Icon className="size-3 animate-spin opacity-60" aria-hidden />}
      </button>
      <RecvizDashboardModal open={open} onOpenChange={setOpen} title="QuickRec Statistics" url={url} />
    </>
  )
}
