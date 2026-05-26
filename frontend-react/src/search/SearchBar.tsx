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
}

export function SearchBar({ value, onChange, onSubmit, onClear, suggestions, placeholder = 'Search…' }: SearchBarProps) {
  const { recents, clear: clearRecents } = useRecentSearches()
  const [isOpen, setIsOpen] = useState(false)
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const typing = value.trim().length >= 2
  const hasContent = typing ? suggestions.length > 0 : recents.length > 0

  const submit = () => {
    const t = value.trim()
    if (t) onSubmit(t)
  }

  return (
    <div className="flex items-center gap-2">
      <Popover open={isOpen && hasContent} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <div className="relative flex-1">
            <Input
              className="h-9 pr-8"
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
                className="absolute right-1 top-1/2 -translate-y-1/2"
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
      <Button type="button" size="sm" variant="default" onClick={submit}>
        <SearchIcon className="size-4 mr-1" />
        Search
      </Button>
    </div>
  )
}
