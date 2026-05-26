// src/search/RowDetailSheet.tsx
import { CopyIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import type { ColumnDefinitionV4 } from '@/search/types'

/**
 * RowDetailSheet — a right-side Sheet listing every field of one leaf row as
 * label/value pairs (headers from the category columns). Opened on row
 * double-click; great for the wide metadata records where most columns are
 * scrolled off or hidden.
 *
 * The title is the record's primary identifier (the rowGroup/search column
 * value); the description names the category. Empty fields are de-emphasized,
 * and each populated field gets a hover-revealed copy button.
 */
export interface RowDetailSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  row: Record<string, unknown> | null
  columns: ColumnDefinitionV4[]
  categoryLabel: string
}

/** Stringify a cell value; returns null for empty (undefined/null/''). */
function formatCell(raw: unknown): string | null {
  if (raw === undefined || raw === null || raw === '') return null
  if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean' || typeof raw === 'bigint') {
    return String(raw)
  }
  return JSON.stringify(raw)
}

export function RowDetailSheet({
  open,
  onOpenChange,
  row,
  columns,
  categoryLabel,
}: RowDetailSheetProps): React.ReactElement {
  const primaryField = columns.find((c) => c.rowGroup)?.field ?? columns[0]?.field
  const primaryValue = primaryField ? (formatCell(row?.[primaryField]) ?? '') : ''

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="gap-0">
        <SheetHeader>
          <SheetTitle>{primaryValue || 'Record details'}</SheetTitle>
          <SheetDescription>{`${categoryLabel} record`}</SheetDescription>
        </SheetHeader>
        {row && (
          <dl className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
            {columns.map((c) => {
              const displayable = formatCell(row[c.field])
              const value = displayable ?? '—'
              const isEmpty = displayable === null
              return (
                <div
                  key={c.field}
                  className="group grid grid-cols-[minmax(0,9rem)_1fr] gap-3 text-sm"
                >
                  <dt className="truncate text-muted-foreground">{c.headerName}</dt>
                  <dd
                    className={
                      isEmpty
                        ? 'flex min-w-0 items-start gap-2 break-words italic text-muted-foreground/70'
                        : 'flex min-w-0 items-start gap-2 break-words font-medium text-foreground'
                    }
                  >
                    <span className="min-w-0 break-words">{value}</span>
                    {!isEmpty && (
                      <button
                        type="button"
                        aria-label={`Copy ${c.headerName}`}
                        className="mt-0.5 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                        onClick={() => {
                          void navigator.clipboard.writeText(value)
                          toast.success('Copied')
                        }}
                      >
                        <CopyIcon className="size-3.5" />
                      </button>
                    )}
                  </dd>
                </div>
              )
            })}
          </dl>
        )}
      </SheetContent>
    </Sheet>
  )
}
