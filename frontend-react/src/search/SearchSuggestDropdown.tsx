import { HistoryIcon, SearchIcon, XIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { splitOnPrefix } from '@/search/lib/splitOnPrefix'
import type { SuggestItem } from '@/search/lib/buildSuggestItems'

/**
 * SearchSuggestDropdown — one Google-style listbox of merged recents +
 * suggestions. Presentational only: the parent SearchBar owns the item list,
 * the active index, and open-state. Recents (history icon) carry a per-item
 * remove; suggestions (magnifier) do not. The non-typed tail of each label is
 * bold. Mouse hover reports the hovered index so mouse + keyboard share one
 * highlight (ARIA combobox: focus stays in the input, options are virtually
 * active via aria-activedescendant).
 */
export interface SearchSuggestDropdownProps {
  items: SuggestItem[]
  query: string
  activeIndex: number
  recentsHeader: boolean
  onPick: (term: string) => void
  onRemoveRecent: (term: string) => void
  onClearRecents: () => void
  onActiveIndexChange: (i: number) => void
  listboxId: string
  optionId: (i: number) => string
}

export function SearchSuggestDropdown({
  items,
  query,
  activeIndex,
  recentsHeader,
  onPick,
  onRemoveRecent,
  onClearRecents,
  onActiveIndexChange,
  listboxId,
  optionId,
}: SearchSuggestDropdownProps) {
  if (items.length === 0) return null

  return (
    <div>
      {recentsHeader && (
        <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Recent</span>
          <Button
            type="button"
            variant="ghost"
            className="h-auto px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
            // mousedown would blur the input before click fires; prevent it.
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClearRecents}
          >
            Clear
          </Button>
        </div>
      )}
      <ul role="listbox" id={listboxId} className="max-h-[340px] overflow-auto p-1.5">
        {items.map((item, i) => {
          const active = i === activeIndex
          const { head, tail } = splitOnPrefix(item.text, query)
          return (
            <li
              key={`${item.type}-${item.text}`}
              id={optionId(i)}
              role="option"
              aria-selected={active}
              // Keep focus in the input on click (no blur-close race).
              onMouseDown={(e) => e.preventDefault()}
              onMouseMove={() => onActiveIndexChange(i)}
              onClick={() => onPick(item.text)}
              className={`group flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${active ? 'bg-accent' : ''}`}
            >
              {item.type === 'recent' ? (
                <HistoryIcon className="size-4 shrink-0 text-muted-foreground" />
              ) : (
                <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
              )}
              <span className="flex-1 truncate text-foreground">
                {head}
                <strong className="font-semibold">{tail}</strong>
              </span>
              {item.type === 'recent' && (
                <button
                  type="button"
                  aria-label={`Remove ${item.text}`}
                  className={`shrink-0 rounded-md p-1 text-muted-foreground transition-opacity hover:bg-foreground/10 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 ${active ? 'opacity-100' : 'opacity-0'}`}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemoveRecent(item.text)
                  }}
                >
                  <XIcon className="size-3.5" />
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
