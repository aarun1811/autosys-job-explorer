import { HistoryIcon, SearchIcon, XIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Command, CommandItem, CommandList } from '@/components/ui/command'

/**
 * SearchSuggestDropdown — Google-search-inspired recents/suggestions panel.
 *
 * One mode at a time, decided purely by `value`:
 *   - empty input → recent searches, each with a history icon and a
 *     hover-revealed per-item remove (✕) plus a "Clear" all action,
 *   - ≥2 chars   → live typeahead suggestions with a magnifier icon.
 *
 * Airy full-width rows, subtle full-row hover highlight, no dividers — the
 * Google recents feel, rendered in the app's shadcn/token theme. Presentational
 * only: the parent SearchBar owns open-state via its Popover.
 */
export interface SearchSuggestDropdownProps {
  value: string
  recents: string[]
  suggestions: string[]
  onPick: (term: string) => void
  onRemoveRecent: (term: string) => void
  onClearRecents: () => void
}

const ROW = 'group flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-accent data-[selected=true]:bg-accent'

export function SearchSuggestDropdown({
  value,
  recents,
  suggestions,
  onPick,
  onRemoveRecent,
  onClearRecents,
}: SearchSuggestDropdownProps) {
  const typing = value.trim().length >= 2

  if (typing) {
    return (
      <Command shouldFilter={false} className="bg-transparent">
        <CommandList className="max-h-[340px] p-1.5">
          {suggestions.length === 0 ? (
            <EmptyState>No suggestions</EmptyState>
          ) : (
            suggestions.map((s) => (
              <CommandItem key={s} value={s} onSelect={() => onPick(s)} className={ROW}>
                <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate text-foreground">{s}</span>
              </CommandItem>
            ))
          )}
        </CommandList>
      </Command>
    )
  }

  return (
    <Command shouldFilter={false} className="bg-transparent">
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Recent</span>
        {recents.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            className="h-auto px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
            onClick={onClearRecents}
          >
            Clear
          </Button>
        )}
      </div>
      <CommandList className="max-h-[340px] px-1.5 pb-1.5">
        {recents.length === 0 ? (
          <EmptyState>No recent searches</EmptyState>
        ) : (
          recents.map((t) => (
            <CommandItem key={t} value={t} onSelect={() => onPick(t)} className={ROW}>
              <HistoryIcon className="size-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate text-foreground">{t}</span>
              <button
                type="button"
                aria-label={`Remove ${t}`}
                className="shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-foreground/10 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 group-data-[selected=true]:opacity-100"
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation()
                  onRemoveRecent(t)
                }}
              >
                <XIcon className="size-3.5" />
              </button>
            </CommandItem>
          ))
        )}
      </CommandList>
    </Command>
  )
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="px-3 py-6 text-center text-sm text-muted-foreground">{children}</div>
}
