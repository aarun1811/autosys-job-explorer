import { useMemo, useState } from 'react'
import { useSearch } from '@tanstack/react-router'
import { DashboardPanel } from '@/search/DashboardPanel'
import { SearchGridPanel } from '@/search/SearchGridPanel'
import { decodeViewState } from '@/search/lib/gridViewState'
import type { CategoryResultV4 } from '@/search/types'

/**
 * ResultSurface — composes the per-category surface: a grid, a recviz dashboard,
 * or both. Branch is config-driven: `dashboard` present + columns present →
 * collapsible dashboard header above the grid; `dashboard` only (no columns) →
 * full-surface dashboard; columns only → grid (today's behavior). Owns the
 * dashboard open/collapse state (seeded from a shared view, then config defaultOpen).
 */
export function ResultSurface({ q, category }: { q: string; category: CategoryResultV4 }): React.ReactElement {
  const { view } = useSearch({ from: '/search' })
  const restored = useMemo(() => (view ? decodeViewState(view) : null), [view])
  const hasGrid = category.columns.length > 0
  const dash = category.dashboard ?? null
  const [dashOpen, setDashOpen] = useState<boolean>(
    () => restored?.dashboardOpen ?? dash?.defaultOpen ?? false,
  )

  if (dash && !hasGrid) {
    return <DashboardPanel variant="full" dashboard={dash} q={q} open onOpenChange={() => {}} />
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {dash && <DashboardPanel variant="header" dashboard={dash} q={q} open={dashOpen} onOpenChange={setDashOpen} />}
      <SearchGridPanel q={q} category={category} dashboardOpen={dash ? dashOpen : undefined} />
    </div>
  )
}
