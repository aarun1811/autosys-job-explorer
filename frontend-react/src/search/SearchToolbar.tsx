import { DownloadIcon, Loader2Icon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/**
 * SearchToolbar — single row between the category tab bar and the grid.
 *
 * Composition contract (per 03-06-PLAN.md interfaces):
 * - `resultCount`: locale-formatted into a secondary-variant Badge when a number
 *   greater than zero. Hidden when null/undefined (pre-search) AND when 0
 *   (empty state; SearchPage owns the empty-state UI).
 * - `onExport()`: invoked when the user selects "Download Excel (.xlsx)" in the
 *   Export DropdownMenu. SearchPage (Plan 07) owns the gridApi ref and supplies
 *   a closure that calls `gridApi.exportDataAsExcel({ fileName, columnKeys })`
 *   with `buildExportFilename(cat, q)` and the columnKeys set that excludes
 *   `execution_order` and includes the hidden columns `app_name`, `set_id`,
 *   `sub_acc` (UI-SPEC §"Excel Export", D-3.10).
 * - `isExporting`: when true, the trigger Button is disabled and the leading
 *   icon swaps from DownloadIcon to Loader2Icon with `animate-spin`. SearchPage
 *   manages this flag.
 *
 * NOTE — Excel-export business logic lives in SearchPage, not here. SearchToolbar
 * is a pure UI shell so it can be unit-tested without an AG-Grid harness. See
 * the plan §Action note for the closure shape SearchPage will provide.
 *
 * Layout: `flex items-center gap-2 border-b px-4 h-10 bg-background` per
 * UI-SPEC §"Toolbar". The Badge cluster is left-aligned; the Export dropdown is
 * right-aligned via `flex-1` spacer.
 */
export interface SearchToolbarProps {
  resultCount: number | null
  onExport: () => void
  isExporting?: boolean
}

function formatCount(count: number): string {
  const formatted = count.toLocaleString()
  return `${formatted} ${count === 1 ? 'result' : 'results'}`
}

export function SearchToolbar({
  resultCount,
  onExport,
  isExporting = false,
}: SearchToolbarProps) {
  const showBadge =
    typeof resultCount === 'number' && resultCount > 0
  return (
    <div className="flex items-center gap-2 border-b px-4 h-10 bg-background">
      {showBadge && (
        <Badge variant="secondary">{formatCount(resultCount)}</Badge>
      )}
      <div className="flex-1" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isExporting}
          >
            {isExporting ? (
              <Loader2Icon
                className="size-4 mr-1 animate-spin"
                aria-label="Exporting..."
              />
            ) : (
              <DownloadIcon className="size-4 mr-1" />
            )}
            Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onExport()}>
            Download Excel (.xlsx)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
