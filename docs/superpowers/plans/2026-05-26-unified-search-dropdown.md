# Unified Search Dropdown + Keyboard Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge recents + live suggestions into one Google-style dropdown and add ARIA-combobox keyboard navigation (↑/↓/Enter/Esc/Home/End, highlight-only).

**Architecture:** Two pure helpers — `buildSuggestItems` (ordered, deduped, capped merge) and `splitOnPrefix` (prefix bolding). `SearchSuggestDropdown` becomes a single `role="listbox"` of `role="option"`s driven by an `activeIndex`. `SearchBar` owns `activeIndex`, builds the items, wires combobox ARIA + the keyboard handler, and keeps the existing `PopoverAnchor` + interact-outside guards. cmdk is dropped from this component.

**Tech Stack:** React 19, TanStack Router, shadcn/Tailwind v4, Radix Popover (Anchor), Vitest + @testing-library/react (jsdom), Playwright for E2E.

**Spec:** `docs/superpowers/specs/2026-05-26-unified-search-dropdown-design.md`

**Conventions (verified earlier this session):**
- Single test file: `pnpm exec vitest run <path>` · Full: `pnpm test` · `pnpm typecheck` · `pnpm lint`
- Router/hooks mocked with `vi.hoisted` + `vi.mock`; `src/test-setup.ts` polyfills `matchMedia`/`ResizeObserver`/`scrollIntoView`.
- ESLint: no raw hex (token classes only); `react-hooks/set-state-in-effect` is an error (avoid setState in effects).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/search/lib/buildSuggestItems.ts` | Pure merge: recents (prefix-matched while typing) → suggestions, deduped, capped |
| `src/search/lib/splitOnPrefix.ts` | Pure: split a label into `{head, tail}` for prefix bolding |
| `src/search/SearchSuggestDropdown.tsx` | Presentational `role="listbox"`; one flat item list; icons, bolding, remove, hover→active |
| `src/search/SearchBar.tsx` | Build items, own `activeIndex`, combobox ARIA, keyboard handler, drive popover open |
| `src/search/__tests__/buildSuggestItems.test.ts` | NEW |
| `src/search/__tests__/splitOnPrefix.test.ts` | NEW |
| `src/search/__tests__/SearchSuggestDropdown.test.tsx` | Rewrite for the listbox contract |
| `src/search/__tests__/SearchBar.test.tsx` | Update: keyboard nav + `role="option"` selectors |

Run all commands from `frontend-react/`.

---

## Task 1: `buildSuggestItems` pure merge

**Files:** Create `src/search/lib/buildSuggestItems.ts`, `src/search/__tests__/buildSuggestItems.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, test, expect } from 'vitest'
import { buildSuggestItems } from '@/search/lib/buildSuggestItems'

describe('buildSuggestItems', () => {
  test('empty query → recents only (capped at 8), typed as recent', () => {
    const recents = Array.from({ length: 12 }, (_, i) => `r${i}`)
    const out = buildSuggestItems(recents, ['s1'], '')
    expect(out).toHaveLength(8)
    expect(out.every((x) => x.type === 'recent')).toBe(true)
    expect(out[0]).toEqual({ type: 'recent', text: 'r0' })
  })

  test('typing → prefix-matched recents (cap 3) first, then suggestions', () => {
    const recents = ['trade', 'tracker', 'transit', 'travel', 'box']
    const out = buildSuggestItems(recents, ['tradex', 'trade-x'], 'tra')
    // first 3 recents starting with "tra" (newest-first order preserved)
    expect(out.slice(0, 3)).toEqual([
      { type: 'recent', text: 'trade' },
      { type: 'recent', text: 'tracker' },
      { type: 'recent', text: 'transit' },
    ])
    expect(out.slice(3)).toEqual([
      { type: 'suggestion', text: 'tradex' },
      { type: 'suggestion', text: 'trade-x' },
    ])
  })

  test('prefix match is case-insensitive; non-matching recents excluded while typing', () => {
    const out = buildSuggestItems(['TRADE', 'box'], [], 'tr')
    expect(out).toEqual([{ type: 'recent', text: 'TRADE' }])
  })

  test('dedups a recent that also appears as a suggestion (case-insensitive; recent wins)', () => {
    const out = buildSuggestItems(['trade'], ['Trade', 'trades'], 'tr')
    expect(out).toEqual([
      { type: 'recent', text: 'trade' },
      { type: 'suggestion', text: 'trades' },
    ])
  })

  test('caps the total list at 10', () => {
    const suggestions = Array.from({ length: 20 }, (_, i) => `tr${i}`)
    const out = buildSuggestItems([], suggestions, 'tr')
    expect(out).toHaveLength(10)
  })
})
```

- [ ] **Step 2: Run, verify fail** — `pnpm exec vitest run src/search/__tests__/buildSuggestItems.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
export interface SuggestItem {
  type: 'recent' | 'suggestion'
  text: string
}

const MAX_EMPTY_RECENTS = 8
const MAX_TYPING_RECENTS = 3
const MAX_TOTAL = 10

/**
 * Build the unified dropdown list (Google-style): when the query is empty, the
 * most-recent searches only; while typing, recents whose text starts with the
 * query (case-insensitive, newest-first, capped) followed by live suggestions,
 * deduped case-insensitively (a recent that is also a suggestion appears once,
 * as a recent). Pure — no React, no I/O.
 */
export function buildSuggestItems(
  recents: string[],
  suggestions: string[],
  query: string,
): SuggestItem[] {
  const q = query.trim()
  if (q === '') {
    return recents.slice(0, MAX_EMPTY_RECENTS).map((text) => ({ type: 'recent' as const, text }))
  }
  const ql = q.toLowerCase()
  const matchedRecents = recents
    .filter((r) => r.toLowerCase().startsWith(ql))
    .slice(0, MAX_TYPING_RECENTS)
  const seen = new Set(matchedRecents.map((r) => r.toLowerCase()))
  const items: SuggestItem[] = matchedRecents.map((text) => ({ type: 'recent', text }))
  for (const s of suggestions) {
    if (items.length >= MAX_TOTAL) break
    const key = s.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    items.push({ type: 'suggestion', text: s })
  }
  return items
}
```

- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(react): buildSuggestItems — merge recents+suggestions (dedup, caps)"`

---

## Task 2: `splitOnPrefix` pure helper

**Files:** Create `src/search/lib/splitOnPrefix.ts`, `src/search/__tests__/splitOnPrefix.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, test, expect } from 'vitest'
import { splitOnPrefix } from '@/search/lib/splitOnPrefix'

describe('splitOnPrefix', () => {
  test('splits head (typed prefix) and tail when text starts with query', () => {
    expect(splitOnPrefix('trades', 'tra')).toEqual({ head: 'tra', tail: 'des' })
  })
  test('preserves the original casing of the head from the text', () => {
    expect(splitOnPrefix('TRADES', 'tra')).toEqual({ head: 'TRA', tail: 'DES' })
  })
  test('non-prefix match → empty head, whole text as tail', () => {
    expect(splitOnPrefix('box', 'tra')).toEqual({ head: '', tail: 'box' })
  })
  test('empty / whitespace query → empty head', () => {
    expect(splitOnPrefix('trade', '')).toEqual({ head: '', tail: 'trade' })
    expect(splitOnPrefix('trade', '   ')).toEqual({ head: '', tail: 'trade' })
  })
})
```

- [ ] **Step 2: Run, verify fail** → FAIL.

- [ ] **Step 3: Implement** `src/search/lib/splitOnPrefix.ts`

```ts
/**
 * Split a label into the typed-prefix `head` and the remaining `tail`, so the
 * dropdown can render `head` in normal weight and `tail` bold (Google style).
 * `head` is non-empty only when `text` case-insensitively starts with the
 * trimmed query; the head preserves `text`'s original casing.
 */
export function splitOnPrefix(text: string, query: string): { head: string; tail: string } {
  const q = query.trim()
  if (q && text.toLowerCase().startsWith(q.toLowerCase())) {
    return { head: text.slice(0, q.length), tail: text.slice(q.length) }
  }
  return { head: '', tail: text }
}
```

- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(react): splitOnPrefix helper for prefix bolding"`

---

## Task 3: Rewrite `SearchSuggestDropdown` as a listbox

**Files:** Modify `src/search/SearchSuggestDropdown.tsx`, rewrite `src/search/__tests__/SearchSuggestDropdown.test.tsx`

- [ ] **Step 1: Rewrite the test** (full replace)

```tsx
import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SearchSuggestDropdown } from '@/search/SearchSuggestDropdown'
import type { SuggestItem } from '@/search/lib/buildSuggestItems'

const optionId = (i: number) => `opt-${i}`
function setup(props?: Partial<React.ComponentProps<typeof SearchSuggestDropdown>>) {
  const onPick = vi.fn(), onRemoveRecent = vi.fn(), onClearRecents = vi.fn(), onActiveIndexChange = vi.fn()
  const items: SuggestItem[] = props?.items ?? [
    { type: 'recent', text: 'trade' },
    { type: 'suggestion', text: 'trades' },
  ]
  render(
    <SearchSuggestDropdown
      items={items}
      query={props?.query ?? 'tr'}
      activeIndex={props?.activeIndex ?? -1}
      recentsHeader={props?.recentsHeader ?? false}
      onPick={onPick}
      onRemoveRecent={onRemoveRecent}
      onClearRecents={onClearRecents}
      onActiveIndexChange={onActiveIndexChange}
      listboxId="lb"
      optionId={optionId}
      {...props}
    />,
  )
  return { onPick, onRemoveRecent, onClearRecents, onActiveIndexChange }
}

describe('SearchSuggestDropdown', () => {
  test('renders one role=option per item with recent + suggestion text', () => {
    setup()
    const opts = screen.getAllByRole('option')
    expect(opts).toHaveLength(2)
    // Labels are split into {head}<strong>{tail}</strong>, so assert on the
    // option's concatenated text content, not getByText (which matches a single
    // text node and would miss "trades" split as "tr" | "ades").
    expect(opts[1]).toHaveTextContent('trades')
  })

  test('marks the active option aria-selected', () => {
    setup({ activeIndex: 1 })
    const opts = screen.getAllByRole('option')
    expect(opts[0]).toHaveAttribute('aria-selected', 'false')
    expect(opts[1]).toHaveAttribute('aria-selected', 'true')
  })

  test('bolds the non-typed tail of each label', () => {
    setup({ items: [{ type: 'suggestion', text: 'trades' }], query: 'tra' })
    // "tra" normal + "des" bold
    expect(screen.getByText('des').tagName.toLowerCase()).toBe('strong')
  })

  test('clicking an option calls onPick with its text', () => {
    const { onPick } = setup()
    // Click the option element itself (label is split across text nodes).
    fireEvent.click(screen.getAllByRole('option')[1])
    expect(onPick).toHaveBeenCalledWith('trades')
  })

  test('hovering an option reports its index', () => {
    const { onActiveIndexChange } = setup()
    fireEvent.mouseMove(screen.getAllByRole('option')[1])
    expect(onActiveIndexChange).toHaveBeenCalledWith(1)
  })

  test('recent items expose a remove button that calls onRemoveRecent (not onPick)', () => {
    const { onPick, onRemoveRecent } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Remove trade' }))
    expect(onRemoveRecent).toHaveBeenCalledWith('trade')
    expect(onPick).not.toHaveBeenCalled()
  })

  test('recentsHeader shows the Recent/Clear header wired to onClearRecents', () => {
    const { onClearRecents } = setup({ recentsHeader: true, items: [{ type: 'recent', text: 'trade' }], query: '' })
    expect(screen.getByText('Recent')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Clear'))
    expect(onClearRecents).toHaveBeenCalled()
  })

  test('renders nothing when items is empty', () => {
    const { container } = render(
      <SearchSuggestDropdown items={[]} query="" activeIndex={-1} recentsHeader
        onPick={vi.fn()} onRemoveRecent={vi.fn()} onClearRecents={vi.fn()}
        onActiveIndexChange={vi.fn()} listboxId="lb" optionId={optionId} />,
    )
    expect(container.firstChild).toBeNull()
  })
})
```

- [ ] **Step 2: Run, verify fail** → FAIL (old cmdk-based component / props mismatch).

- [ ] **Step 3: Rewrite the component** (full replace)

```tsx
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
```

- [ ] **Step 4: Run → PASS.** `pnpm exec vitest run src/search/__tests__/SearchSuggestDropdown.test.tsx`
- [ ] **Step 5: Commit** — `git add -A && git commit -m "refactor(react): SearchSuggestDropdown — single ARIA listbox, no cmdk"`

---

## Task 4: Wire `SearchBar` — items, activeIndex, keyboard, combobox ARIA

**Files:** Modify `src/search/SearchBar.tsx`, update `src/search/__tests__/SearchBar.test.tsx`

- [ ] **Step 1: Update the SearchBar test** — replace the recents/suggestions assertions with the merged-list + keyboard contract. Full replace of the describe body (keep the `useRecentSearches` mock block at top, ADD `remove` already present). Key cases:

```tsx
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { SearchBar } from '@/search/SearchBar'

const mockClear = vi.fn()
const mockRemove = vi.fn()
let mockRecents: string[] = []
vi.mock('@/search/hooks/useRecentSearches', () => ({
  useRecentSearches: () => ({ recents: mockRecents, push: vi.fn(), remove: mockRemove, clear: mockClear }),
}))

function renderBar(props?: Partial<React.ComponentProps<typeof SearchBar>>) {
  const onChange = vi.fn(), onSubmit = vi.fn(), onClear = vi.fn()
  const utils = render(
    <SearchBar value="" onChange={onChange} onSubmit={onSubmit} onClear={onClear} suggestions={[]} {...props} />,
  )
  return { ...utils, onChange, onSubmit, onClear }
}

describe('SearchBar', () => {
  beforeEach(() => { mockRecents = []; mockClear.mockClear(); mockRemove.mockClear() })

  test('renders an input (role=combobox) + Search button', () => {
    renderBar()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument()
  })

  test('Enter with no highlight submits the trimmed typed value', () => {
    const { onSubmit } = renderBar({ value: '  trade ' })
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledWith('trade')
  })

  test('Search button submits', () => {
    const { onSubmit } = renderBar({ value: 'cash' })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    expect(onSubmit).toHaveBeenCalledWith('cash')
  })

  test('focus opens recents; ArrowDown highlights first option; Enter submits it', () => {
    mockRecents = ['LOAD-ABC-123', 'reconour']
    const { onSubmit } = renderBar({ value: '' })
    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    expect(screen.getByText('LOAD-ABC-123')).toBeInTheDocument()
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    const opts = screen.getAllByRole('option')
    expect(opts[0]).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledWith('LOAD-ABC-123')
  })

  test('typing merges matching recents + suggestions into the list', () => {
    mockRecents = ['trade', 'box']
    renderBar({ value: 'tr', suggestions: ['trades', 'tracking'] })
    fireEvent.focus(screen.getByRole('combobox'))
    const opts = screen.getAllByRole('option')
    // matching recent "trade" first, then suggestions; "box" excluded.
    // Labels are split into {head}<strong>{tail}</strong>, so assert on each
    // option's concatenated text content (getByText matches a single node).
    expect(opts).toHaveLength(3)
    expect(opts[0]).toHaveTextContent('trade')
    expect(opts[2]).toHaveTextContent('tracking')
    expect(opts.some((o) => o.textContent === 'box')).toBe(false)
  })

  test('ArrowUp past the top clears the highlight (returns to typed text)', () => {
    mockRecents = ['a', 'b']
    renderBar({ value: '' })
    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    fireEvent.keyDown(input, { key: 'ArrowDown' }) // index 0
    fireEvent.keyDown(input, { key: 'ArrowUp' })   // back to -1
    expect(screen.getAllByRole('option').every((o) => o.getAttribute('aria-selected') === 'false')).toBe(true)
  })

  test('Escape closes the panel', () => {
    mockRecents = ['a']
    renderBar({ value: '' })
    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  test('clear (X) button shows when non-empty and calls onClear', () => {
    const { onClear } = renderBar({ value: 'abc' })
    fireEvent.click(screen.getByRole('button', { name: /Clear search/i }))
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  test('custom placeholder honored', () => {
    renderBar({ placeholder: 'Search by job name…' })
    expect(screen.getByPlaceholderText('Search by job name…')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run, verify fail** → FAIL (no `role="combobox"`, no keyboard nav, dropdown props mismatch).

- [ ] **Step 3: Edit `SearchBar.tsx`.** Apply these precise changes:

  (a) Imports — add `useId`, `useMemo`; add `buildSuggestItems`; drop nothing else:

```tsx
import { useEffect, useId, useMemo, useRef, useState } from 'react'
// ... existing imports ...
import { buildSuggestItems } from '@/search/lib/buildSuggestItems'
```

  (b) Inside the component, after the `useRecentSearches`/state lines, replace the
  `typing`/`hasContent` block and add items + activeIndex:

```tsx
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [wordIdx, setWordIdx] = useState(0)
  const listboxId = useId()
  const optionId = (i: number) => `${listboxId}-opt-${i}`

  const hero = variant === 'hero'
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
```

  (Delete the old `const typing = …` and `const hasContent = typing ? … : …` lines.)

  (c) Replace `submit` with `pick` + `submit` that also reset state:

```tsx
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
```

  (d) On the `<Input>`: change `aria-label`, add combobox ARIA, reset activeIndex on
  change, and use `handleKeyDown`:

```tsx
            <Input
              role="combobox"
              aria-expanded={open}
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-activedescendant={open && safeActiveIndex >= 0 ? optionId(safeActiveIndex) : undefined}
              aria-label={rollingPlaceholder ? 'Search' : undefined}
              className={ /* unchanged */ }
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
```

  (e) Change the `<Popover open={isOpen && hasContent} …>` to `<Popover open={open} …>`.

  (f) Replace the `<SearchSuggestDropdown … />` props with the new contract:

```tsx
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
```

  (The rolling-placeholder overlay, clear-X button, Search button, and
  PopoverAnchor/PopoverContent guards stay exactly as they are.)

- [ ] **Step 4: Run → PASS.** `pnpm exec vitest run src/search/__tests__/SearchBar.test.tsx`
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(react): unified dropdown + keyboard nav in SearchBar (ARIA combobox)"`

---

## Task 5: Gate + E2E verification

- [ ] **Step 1:** `pnpm typecheck` → exit 0. Fix any residual references (e.g. a leftover `typing` use).
- [ ] **Step 2:** `pnpm lint` on the changed files → clean (no raw hex; no set-state-in-effect).
- [ ] **Step 3:** `pnpm test` → full suite PASS.
- [ ] **Step 4: Playwright E2E** against the running stack (backend :6088, React :5173, ES seeded). Clear the stray Supabase cookie first if present.
  - Seed recents: `localStorage.setItem('rectrace-recent-searches', JSON.stringify(['box','trade','reconour']))`, reload.
  - Empty focus → one list of recents (history icons), "Recent"/"Clear" header.
  - Type `box` → list shows the matching recent `box` first (history icon) then suggestions (BOX-ABC-123 …, magnifier), tails bold.
  - Press ArrowDown twice → highlight moves; the highlighted option has `aria-selected=true`; `aria-activedescendant` on the input matches.
  - Press Enter on a highlighted suggestion → navigates to `/search?q=<that suggestion>`.
  - Type, ArrowDown, Escape → panel closes, typed text intact.
  - Hover an item then arrow → highlight follows mouse then keyboard (shared index).
- [ ] **Step 5: Commit** any fixes: `git commit -am "chore(react): gate green for unified dropdown"`

---

## Self-Review (author)

- **Spec coverage:** §1 merge → Task 1; §2 bolding → Task 2; §3 listbox component → Task 3; §4 state+keyboard+ARIA → Task 4; §5 behavior parity → Tasks 3-4; §6 accessibility (combobox + aria-activedescendant) → Task 4 + E2E; §7 files → all; §8 testing → every task + Task 5 E2E. ✓
- **Placeholders:** none — full code in each step. ✓
- **Type consistency:** `SuggestItem {type,text}` defined in Task 1, consumed in Tasks 3-4; `splitOnPrefix → {head,tail}` (Task 2) used in Task 3; dropdown props (`items/query/activeIndex/recentsHeader/onPick/onRemoveRecent/onClearRecents/onActiveIndexChange/listboxId/optionId`) defined in Task 3 and passed identically in Task 4; `pick/close/submit/handleKeyDown` consistent within Task 4; `open = isOpen && hasContent` used for Popover + ARIA. ✓
- **Known seam:** Task 3 changes the dropdown's prop contract, so SearchBar won't typecheck until Task 4 updates the call site. Each task's own touched test passes; full `pnpm typecheck` is green only after Task 4 (noted in Task 5 Step 1).
