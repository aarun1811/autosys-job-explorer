import { useState } from 'react'
import type { ICellRendererParams } from 'ag-grid-community'
import { SparklesIcon, Loader2Icon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useTheme } from '@/components/layout/theme-provider'
import { buildEmbedUrl } from '@/search/recviz/buildEmbedUrl'
import { getRecvizOrigin } from '@/search/recviz/recvizConfig'
import { RecvizDashboardModal } from '@/search/recviz/RecvizDashboardModal'

const DASHBOARD_ID = 'dash-tlm-stats'

type TlmEntryPoint = 'set_id' | 'recon' | 'tlm_instance'

/**
 * Compute the filter-lock list for the TLM stats modal. Matches Angular
 * `TlmStatsModalV2Component.initializeFilterState` (96-137):
 *  - set_id entry: locks tlm_instance + recon + set_id
 *  - recon  entry: locks tlm_instance + recon
 *  - tlm_instance entry: locks tlm_instance only
 * Lock order matters — the embed URL renders the lock-icon row in the
 * order the names appear in filter.lock.
 */
function computeLockList(entry: TlmEntryPoint): string[] {
  switch (entry) {
    case 'set_id':
      return ['tlm_instance', 'recon', 'set_id']
    case 'recon':
      return ['tlm_instance', 'recon']
    case 'tlm_instance':
    default:
      return ['tlm_instance']
  }
}

/**
 * TlmStatsCellRenderer — React port of Angular's tlm-stats cell-click flow.
 * Renders the cell value as a clickable link (sparkles icon + value) that
 * opens the embedded RecViz TLM dashboard. Mirrors QuickRecStatsCellRenderer
 * shape exactly (same component signature, same modal-owned-internally
 * pattern, same return-null-for-empty behavior).
 *
 * Wired via `cellRenderer: "tlmStatsButtonRenderer"` in search-config-v4.json
 * on tlm_instance / set_id / recon columns. `cellRendererParams.entryPoint`
 * (one of those three) decides which filters are locked when the modal opens.
 *
 * Returns null when the value is empty (so AG-Grid renders nothing — the
 * cell falls back to its default text rendering of params.value, which is
 * also empty in that case). Returns plain text when tlm_instance is null
 * — without an instance value the dynamic-routing resolver can't pick a
 * connection, so the link is dead and we render text instead.
 */
export function TlmStatsCellRenderer(params: ICellRendererParams) {
  const colDef = params.colDef as { cellRendererParams?: { entryPoint?: TlmEntryPoint } } | undefined
  const entryPoint = colDef?.cellRendererParams?.entryPoint ?? 'tlm_instance'
  const data = params.data as Record<string, unknown> | undefined
  const { resolvedTheme } = useTheme()
  const [open, setOpen] = useState(false)

  const rawValue = typeof params.value === 'string' ? params.value : ''
  const value = rawValue.trim()
  if (!value || value === '-') return null

  const tlmInstance = typeof data?.tlm_instance === 'string' ? data.tlm_instance : undefined
  if (!tlmInstance) {
    // Dynamic routing needs tlm_instance — render plain text, not a dead link.
    return <span className="text-foreground">{value}</span>
  }

  const recon = typeof data?.recon === 'string' ? data.recon : undefined
  const setId = typeof data?.set_id === 'string' ? data.set_id : undefined

  const url = buildEmbedUrl({
    origin: getRecvizOrigin(),
    dashboardId: DASHBOARD_ID,
    filters: { tlm_instance: tlmInstance, recon, set_id: setId },
    lock: computeLockList(entryPoint),
    theme: resolvedTheme,
  })

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`View TLM stats for ${value}`}
        className={cn(
          'inline-flex items-center gap-1 text-primary hover:underline',
          'cursor-pointer text-[12px] font-normal',
        )}
      >
        <SparklesIcon className="size-3.5 opacity-70" aria-hidden />
        <span className="font-mono">{value}</span>
        {open && <Loader2Icon className="size-3 animate-spin opacity-60" aria-hidden />}
      </button>
      <RecvizDashboardModal open={open} onOpenChange={setOpen} title="TLM Statistics" url={url} />
    </>
  )
}
