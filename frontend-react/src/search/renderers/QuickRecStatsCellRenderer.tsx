import { useState } from 'react'
import type { ICellRendererParams } from 'ag-grid-community'
import { BarChart3Icon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useTheme } from '@/components/layout/theme-provider'
import { buildEmbedUrl } from '@/search/recviz/buildEmbedUrl'
import { getRecvizOrigin } from '@/search/recviz/recvizConfig'
import { RecvizDashboardModal } from '@/search/recviz/RecvizDashboardModal'

const DASHBOARD_ID = 'dash-quickrec-stats'

/** Opens the QuickRec RecViz dashboard for a row. Only rendered for QuickRec rows
 * (tlm_instance === 'QuickRec'); entryPoint (recon_id | rec_portal_id) locks that filter. */
export function QuickRecStatsCellRenderer(params: ICellRendererParams) {
  const colDef = params.colDef as { cellRendererParams?: { entryPoint?: 'recon_id' | 'rec_portal_id' } } | undefined
  const entryPoint = colDef?.cellRendererParams?.entryPoint ?? 'recon_id'
  const data = params.data as Record<string, unknown> | undefined
  const { resolvedTheme } = useTheme()
  const [open, setOpen] = useState(false)

  // Gate on tlm_instance only — the sentinel column (quickrec_stats_button) is in
  // FRONTEND_ONLY_COLUMNS so it carries no underlying value. The cross-id fields
  // (recon_id / recon_portal_id) are real columns; both must be present to compose
  // a useful embed URL.
  // Row field is `recon_portal_id` (per rectrace_core schema); RecViz filter id is
  // `rec_portal_id` (per the qr_automatch/qr_manual filter_mappings). Translate at the boundary.
  const reconId = typeof data?.recon_id === 'string' ? data.recon_id : undefined
  const recPortalId = typeof data?.recon_portal_id === 'string' ? data.recon_portal_id : undefined
  if (data?.tlm_instance !== 'QuickRec' || (!reconId && !recPortalId)) return null

  const url = buildEmbedUrl({
    origin: getRecvizOrigin(),
    dashboardId: DASHBOARD_ID,
    filters: { recon_id: reconId, rec_portal_id: recPortalId },
    lock: [entryPoint],
    theme: resolvedTheme,
  })

  return (
    <>
      <Button
        size="sm" variant="ghost" onClick={() => setOpen(true)}
        aria-label="View QuickRec stats"
        className="h-6 min-w-[80px] px-2 text-primary text-[12px] font-normal hover:bg-accent"
      >
        <span className="inline-flex items-center gap-1">
          <BarChart3Icon className="size-3.5 opacity-70" />
          View
        </span>
      </Button>
      <RecvizDashboardModal open={open} onOpenChange={setOpen} title="QuickRec Statistics" url={url} />
    </>
  )
}
