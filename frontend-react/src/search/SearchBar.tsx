import { useRef, useState } from 'react'
import { ClockIcon, SearchIcon, XIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { useRecentSearches } from '@/search/hooks/useRecentSearches'

/**
 * SearchBar — controlled input + clear-X + Search button + recent-searches Popover.
 *
 * Composition contract (per 03-06-PLAN.md interfaces):
 * - `value` / `onChange`: controlled input wiring; parent (SearchPage, Plan 07) owns the term.
 * - `onSubmit(term)`: invoked on Enter or click of the Search button, AND when the user
 *   selects a recent-search item. Whitespace-only / empty values are ignored.
 * - `onClear()`: invoked when the user clicks the X inside the input. Parent should
 *   reset the controlled value AND the URL `q` param (SEARCH-03).
 *
 * Recent-searches Popover behavior (UI-SPEC §"Recent Searches Popover"):
 * - Opens on Input focus when (value is empty AND recents.length > 0).
 * - Closes on Input blur with a 150ms delay (so item clicks register before unmount).
 * - Closes immediately when the user starts typing (live-typing closes the popover).
 * - Top 10 entries come from {@link useRecentSearches} (Plan 02, D-3.11).
 * - "Clear" button inside the popover invokes useRecentSearches().clear() and closes
 *   the popover. No confirmation dialog — non-destructive (local history only).
 *
 * No live `/api/search/suggest` calls in Phase 3 — recent-searches only (per UI-SPEC).
 */
export interface SearchBarProps {
  value: string
  onChange: (next: string) => void
  onSubmit: (term: string) => void
  onClear: () => void
}

export function SearchBar({ value, onChange, onSubmit, onClear }: SearchBarProps) {
  const { recents, clear: clearRecents } = useRecentSearches()
  const [isOpen, setIsOpen] = useState(false)
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const submitIfNonEmpty = () => {
    const trimmed = value.trim()
    if (trimmed) onSubmit(trimmed)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      submitIfNonEmpty()
    }
  }

  const handleFocus = () => {
    if (value === '' && recents.length > 0) {
      setIsOpen(true)
    }
  }

  const handleBlur = () => {
    // 150ms delay lets popover item onClick handlers fire before the popover unmounts.
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current)
    blurTimerRef.current = setTimeout(() => {
      setIsOpen(false)
    }, 150)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value
    onChange(next)
    // Live typing closes popover so it doesn't occlude future live-suggestion UI (Phase 8+).
    if (next !== '' && isOpen) {
      setIsOpen(false)
    }
  }

  const handleRecentClick = (term: string) => {
    setIsOpen(false)
    onSubmit(term)
  }

  const handlePopoverClear = () => {
    clearRecents()
    setIsOpen(false)
  }

  const handleClearX = () => {
    onClear()
  }

  return (
    <div className="flex items-center gap-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <div className="relative flex-1">
            <Input
              className="h-9 pr-8"
              placeholder="Search by file name..."
              value={value}
              onChange={handleChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
            />
            {value !== '' && (
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label="Clear search"
                className="absolute right-1 top-1/2 -translate-y-1/2"
                onClick={handleClearX}
              >
                <XIcon className="size-3.5" />
              </Button>
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] p-0"
          align="start"
          sideOffset={4}
          // The Input owns focus; do not let Radix steal it from the trigger.
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Recent</span>
            {recents.length > 0 && (
              <Button
                type="button"
                size="xs"
                variant="ghost"
                className="text-muted-foreground"
                onClick={handlePopoverClear}
              >
                Clear
              </Button>
            )}
          </div>
          <Separator />
          <Command>
            <CommandList className="max-h-[320px]">
              {recents.length === 0 ? (
                <CommandEmpty>No recent searches</CommandEmpty>
              ) : (
                recents.map((term) => (
                  <CommandItem
                    key={term}
                    value={term}
                    onSelect={() => handleRecentClick(term)}
                  >
                    <ClockIcon className="size-3.5 mr-2 text-muted-foreground" />
                    {term}
                  </CommandItem>
                ))
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Button type="button" size="sm" variant="default" onClick={submitIfNonEmpty}>
        <SearchIcon className="size-4 mr-1" />
        Search
      </Button>
    </div>
  )
}
