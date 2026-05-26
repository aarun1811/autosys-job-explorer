import { useRef, useState } from 'react'
import { SearchIcon, XIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useRecentSearches } from '@/search/hooks/useRecentSearches'
import { SearchSuggestDropdown } from '@/search/SearchSuggestDropdown'

/**
 * SearchBar — controlled input + clear-X + Search button, with a dropdown that
 * delegates entirely to {@link SearchSuggestDropdown}.
 *
 * Visibility: the Popover opens on focus and stays open while there is content
 * to show — recents (empty input) or live suggestions (typing ≥2 chars). Blur
 * closes after 150ms so a dropdown item click registers first.
 *
 * - `value`/`onChange`: controlled wiring (parent owns the term).
 * - `onSubmit(term)`: Enter, Search click, or picking a dropdown item.
 * - `onClear()`: the inline X.
 * - `suggestions`: live typeahead results supplied by the parent (it owns the
 *   debounced fetch via useSuggestions).
 */
export interface SearchBarProps {
  value: string
  onChange: (next: string) => void
  onSubmit: (term: string) => void
  onClear: () => void
  suggestions: string[]
  placeholder?: string
  /** 'bar' (default) = compact navbar input; 'hero' = large elevated landing input. */
  variant?: 'bar' | 'hero'
}

export function SearchBar({
  value,
  onChange,
  onSubmit,
  onClear,
  suggestions,
  placeholder = 'Search…',
  variant = 'bar',
}: SearchBarProps) {
  const { recents, clear: clearRecents } = useRecentSearches()
  const [isOpen, setIsOpen] = useState(false)
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const typing = value.trim().length >= 2
  const hasContent = typing ? suggestions.length > 0 : recents.length > 0
  const hero = variant === 'hero'

  const submit = () => {
    const t = value.trim()
    if (t) onSubmit(t)
  }

  return (
    <div className={`flex items-center ${hero ? 'gap-2.5' : 'gap-2'}`}>
      <Popover open={isOpen && hasContent} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <div
            className={
              hero
                ? 'relative flex-1 rounded-2xl bg-background/80 backdrop-blur-sm rectrace-search-elevated'
                : 'relative flex-1'
            }
          >
            <Input
              className={
                hero
                  ? 'h-13 rounded-2xl border-transparent bg-transparent pl-5 pr-11 text-base shadow-none focus-visible:ring-0'
                  : 'h-9 pr-8'
              }
              placeholder={placeholder}
              value={value}
              onChange={(e) => {
                onChange(e.target.value)
                setIsOpen(true)
              }}
              onFocus={() => setIsOpen(true)}
              onBlur={() => {
                if (blurTimer.current) clearTimeout(blurTimer.current)
                blurTimer.current = setTimeout(() => setIsOpen(false), 150)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit()
              }}
            />
            {value !== '' && (
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label="Clear search"
                className={`absolute top-1/2 -translate-y-1/2 ${hero ? 'right-2.5' : 'right-1'}`}
                onClick={onClear}
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
          // The Input owns focus; don't let Radix steal it from the trigger.
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <SearchSuggestDropdown
            value={value}
            recents={recents}
            suggestions={suggestions}
            onPick={(t) => {
              setIsOpen(false)
              onSubmit(t)
            }}
            onClearRecents={() => {
              clearRecents()
              setIsOpen(false)
            }}
          />
        </PopoverContent>
      </Popover>
      <Button
        type="button"
        size={hero ? 'lg' : 'sm'}
        variant="default"
        onClick={submit}
        className={
          hero
            ? 'h-13 rounded-2xl px-6 text-base shadow-sm transition-transform active:scale-[0.98]'
            : 'transition-transform active:scale-[0.98]'
        }
      >
        <SearchIcon className={hero ? 'size-4 mr-1.5' : 'size-4 mr-1'} />
        Search
      </Button>
    </div>
  )
}
