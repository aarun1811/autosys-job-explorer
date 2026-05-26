// src/search/RowDetailSheet.tsx
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import type { ColumnDefinitionV4 } from '@/search/types'

/**
 * RowDetailSheet — a right-side Sheet listing every field of one leaf row as
 * label/value pairs (headers from the category columns). Opened on row
 * double-click; great for the wide metadata records where most columns are
 * scrolled off or hidden. Presentational only.
 */
export interface RowDetailSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  row: Record<string, unknown> | null
  columns: ColumnDefinitionV4[]
}

export function RowDetailSheet({ open, onOpenChange, row, columns }: RowDetailSheetProps): React.ReactElement {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="gap-0">
        <SheetHeader>
          <SheetTitle>Row details</SheetTitle>
          <SheetDescription>Every field of the selected record.</SheetDescription>
        </SheetHeader>
        {row && (
          <dl className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
            {columns.map((c) => {
              const raw = row[c.field]
              const displayable =
                raw === undefined || raw === null || raw === ''
                  ? null
                  : typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean' || typeof raw === 'bigint'
                    ? String(raw)
                    : JSON.stringify(raw)
              const value = displayable ?? '—'
              return (
                <div key={c.field} className="grid grid-cols-[minmax(0,9rem)_1fr] gap-3 text-sm">
                  <dt className="truncate text-muted-foreground">{c.headerName}</dt>
                  <dd className="break-words font-medium text-foreground">{value}</dd>
                </div>
              )
            })}
          </dl>
        )}
      </SheetContent>
    </Sheet>
  )
}
