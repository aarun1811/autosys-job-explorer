import { ClockIcon, SearchIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandItem, CommandList } from '@/components/ui/command'
import { Separator } from '@/components/ui/separator'

/**
 * SearchSuggestDropdown — the single dropdown body for the search input.
 *
 * One mode at a time, decided purely by `value`:
 *   - empty input → recent searches (with a Clear action),
 *   - ≥2 chars   → live typeahead suggestions.
 *
 * Presentational only: it owns no open-state (the parent SearchBar controls
 * visibility via its Popover). This replaces the old tangle of recents-popover
 * + a TODO for suggestions with one coherent component.
 */
export interface SearchSuggestDropdownProps {
  value: string
  recents: string[]
  suggestions: string[]
  onPick: (term: string) => void
  onClearRecents: () => void
}

export function SearchSuggestDropdown({
  value,
  recents,
  suggestions,
  onPick,
  onClearRecents,
}: SearchSuggestDropdownProps) {
  const typing = value.trim().length >= 2

  if (typing) {
    return (
      <Command shouldFilter={false}>
        <CommandList className="max-h-[320px]">
          {suggestions.length === 0 ? (
            <CommandEmpty>No suggestions</CommandEmpty>
          ) : (
            suggestions.map((s) => (
              <CommandItem key={s} value={s} onSelect={() => onPick(s)}>
                <SearchIcon className="size-3.5 mr-2 text-muted-foreground" />
                {s}
              </CommandItem>
            ))
          )}
        </CommandList>
      </Command>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between px-2 py-1.5">
        <span className="text-xs font-semibold text-muted-foreground">Recent</span>
        {recents.length > 0 && (
          <Button type="button" size="xs" variant="ghost" className="text-muted-foreground" onClick={onClearRecents}>
            Clear
          </Button>
        )}
      </div>
      <Separator />
      <Command shouldFilter={false}>
        <CommandList className="max-h-[320px]">
          {recents.length === 0 ? (
            <CommandEmpty>No recent searches</CommandEmpty>
          ) : (
            recents.map((t) => (
              <CommandItem key={t} value={t} onSelect={() => onPick(t)}>
                <ClockIcon className="size-3.5 mr-2 text-muted-foreground" />
                {t}
              </CommandItem>
            ))
          )}
        </CommandList>
      </Command>
    </>
  )
}
