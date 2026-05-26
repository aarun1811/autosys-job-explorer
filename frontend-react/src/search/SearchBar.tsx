import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { SearchIcon, XIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { useRecentSearches } from '@/search/hooks/useRecentSearches'
import { buildSuggestItems } from '@/search/lib/buildSuggestItems'
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
 * - `suggestions`: live typeahead results supplied by the parent.
 * - `rollingPlaceholder`: when set AND the input is empty, render an animated
 *   placeholder overlay — a fixed `prefix` plus a `words` carousel where the
 *   trailing word rolls up vertically. Native placeholder is suppressed so the
 *   two don't overlap. (Native placeholders can't be animated.)
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
  /**
   * How the submit affordance is rendered:
   * - 'full' (default) = a separate "Search" button beside the input.
   * - 'icon' = no separate button; a leading magnifier button lives INSIDE the
   *   input (Google-style). Submitting is Enter or clicking the magnifier.
   */
  submitButton?: 'full' | 'icon'
  rollingPlaceholder?: { prefix: string; words: string[] }
}

export function SearchBar({
  value,
  onChange,
  onSubmit,
  onClear,
  suggestions,
  placeholder = 'Search…',
  variant = 'bar',
  submitButton = 'full',
  rollingPlaceholder,
}: SearchBarProps) {
  const { recents, remove: removeRecent, clear: clearRecents } = useRecentSearches()
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [wordIdx, setWordIdx] = useState(0)
  const listboxId = useId()
  const optionId = (i: number) => `${listboxId}-opt-${i}`

  const hero = variant === 'hero'
  const iconSubmit = submitButton === 'icon'
  const items = useMemo(
    () => buildSuggestItems(recents, suggestions, value),
    [recents, suggestions, value],
  )
  const hasContent = items.length > 0
  const open = isOpen && hasContent
  // Derived clamp: `suggestions` is a DEBOUNCED prop — it can rebuild `items`
  // (shrink it) ~300ms after the last keystroke with NO onChange to reset
  // activeIndex. Reading a clamped value everywhere keeps the highlight + Enter
  // honest without a set-state-in-effect (which the lint forbids).
  const safeActiveIndex = activeIndex >= 0 && activeIndex < items.length ? activeIndex : -1

  // Rolling-word carousel timer (only when a rolling placeholder is supplied
  // and motion is allowed). The CSS keyframe handles the per-word roll.
  const words = rollingPlaceholder?.words
  useEffect(() => {
    if (!words || words.length < 2) return
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    if (reduced) return
    const id = setInterval(() => setWordIdx((i) => (i + 1) % words.length), 1800)
    return () => clearInterval(id)
  }, [words])

  const showOverlay = Boolean(rollingPlaceholder) && value === ''

  const close = () => {
    setIsOpen(false)
    setActiveIndex(-1)
  }
  const pick = (term: string) => {
    close()
    onSubmit(term)
  }
  const submit = () => {
    const t = value.trim()
    if (t) {
      close()
      onSubmit(t)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (open && safeActiveIndex >= 0) {
        e.preventDefault()
        pick(items[safeActiveIndex].text)
      } else {
        submit()
      }
      return
    }
    if (e.key === 'Escape') {
      close()
      return
    }
    if (!hasContent) return
    // Arrow math is based on the CLAMPED index so a stale out-of-range value
    // (from a debounced suggestions update) self-corrects on the next press.
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIsOpen(true)
      setActiveIndex(Math.min(safeActiveIndex + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(Math.max(safeActiveIndex - 1, -1))
    } else if (e.key === 'Home') {
      e.preventDefault()
      setActiveIndex(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setActiveIndex(items.length - 1)
    }
  }

  return (
    <div ref={rootRef} className={`flex items-center ${hero ? 'gap-2.5' : 'gap-2'}`}>
      <Popover open={open} onOpenChange={setIsOpen}>
        <PopoverAnchor asChild>
          <div
            className={
              hero
                ? 'relative flex-1 rounded-2xl bg-background/80 backdrop-blur-sm rectrace-search-elevated'
                : 'relative flex-1'
            }
          >
            <Input
              ref={inputRef}
              role="combobox"
              aria-expanded={open}
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-activedescendant={open && safeActiveIndex >= 0 ? optionId(safeActiveIndex) : undefined}
              aria-label={rollingPlaceholder ? 'Search' : undefined}
              className={
                hero
                  ? 'h-13 rounded-2xl border-transparent bg-transparent pl-5 pr-11 text-base shadow-none focus-visible:ring-0'
                  : `rectrace-search-bar-input h-9 pr-8 ${iconSubmit ? 'pl-9' : ''}`
              }
              placeholder={rollingPlaceholder ? '' : placeholder}
              value={value}
              onChange={(e) => {
                onChange(e.target.value)
                setIsOpen(true)
                setActiveIndex(-1)
              }}
              onFocus={() => setIsOpen(true)}
              onBlur={() => {
                if (blurTimer.current) clearTimeout(blurTimer.current)
                blurTimer.current = setTimeout(() => close(), 150)
              }}
              onKeyDown={handleKeyDown}
            />
            {iconSubmit && (
              // Decorative leading lens (Google-style): a dull, non-interactive
              // magnifier. It is NOT a submit affordance — Enter (or picking a
              // suggestion) runs the search.
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-2.5 top-1/2 flex -translate-y-1/2 items-center text-muted-foreground"
              >
                <SearchIcon className="size-4" />
              </span>
            )}
            {showOverlay && rollingPlaceholder && (
              <div
                aria-hidden="true"
                className={`pointer-events-none absolute inset-y-0 left-5 flex items-center ${hero ? 'text-base' : 'text-sm'} text-muted-foreground`}
              >
                <span>{rollingPlaceholder.prefix}&nbsp;</span>
                <span className="relative inline-block h-[1.5em] overflow-hidden leading-[1.5em]">
                  <span key={wordIdx} className="block rectrace-word-roll">
                    {rollingPlaceholder.words[wordIdx]}
                  </span>
                </span>
              </div>
            )}
            {value !== '' && (
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label="Clear search"
                className={`absolute top-1/2 -translate-y-1/2 ${hero ? 'right-2.5' : 'right-1'}`}
                onClick={() => {
                  onClear()
                  // Keep the caret in the box for immediate re-typing (Google-style)
                  // instead of letting focus escape.
                  inputRef.current?.focus()
                }}
              >
                <XIcon className="size-3.5" />
              </Button>
            )}
          </div>
        </PopoverAnchor>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-xl p-0 shadow-lg"
          align="start"
          sideOffset={8}
          // The Input owns focus; keep it there (don't autofocus the content)
          // and don't let Radix's dismiss layer steal/close on that focus.
          onOpenAutoFocus={(e) => e.preventDefault()}
          // Interactions WITHIN the search row (clicking/focusing the input,
          // the clear-X, the Search button) must not dismiss the panel — closing
          // is driven by blur (focus truly leaving) + Escape + picking an item.
          // This is what makes "click into the input" keep recents open instead
          // of the open→dismiss flicker.
          onInteractOutside={(e) => {
            if (rootRef.current?.contains(e.target as Node)) e.preventDefault()
          }}
          onFocusOutside={(e) => {
            if (rootRef.current?.contains(e.target as Node)) e.preventDefault()
          }}
        >
          <SearchSuggestDropdown
            items={items}
            query={value}
            activeIndex={safeActiveIndex}
            recentsHeader={value.trim() === ''}
            onPick={pick}
            onRemoveRecent={removeRecent}
            onClearRecents={() => {
              clearRecents()
              close()
            }}
            onActiveIndexChange={setActiveIndex}
            listboxId={listboxId}
            optionId={optionId}
          />
        </PopoverContent>
      </Popover>
      {!iconSubmit && (
        <Button
          type="button"
          size={hero ? 'lg' : 'sm'}
          variant="default"
          onClick={submit}
          className={`group rectrace-search-btn ${hero ? 'h-13 rounded-2xl px-6 text-base' : ''}`}
        >
          <SearchIcon className={`transition-transform duration-200 group-hover:scale-110 ${hero ? 'size-4 mr-1.5' : 'size-4 mr-1'}`} />
          Search
        </Button>
      )}
    </div>
  )
}
