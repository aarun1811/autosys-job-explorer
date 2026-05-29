# Unified Search Dropdown + Keyboard Navigation — Design

**Date:** 2026-05-26
**Status:** Design approved, pending spec review
**Scope:** `frontend-react` search dropdown (`SearchBar` + `SearchSuggestDropdown`)
**Goal:** Merge recents and live suggestions into a single Google-style dropdown
and add full keyboard navigation (↑/↓/Enter/Esc/Home/End), replacing the current
mode-switched, mouse-only panel.

---

## Background — current state

- `SearchSuggestDropdown` shows **either** recents **or** suggestions, switched on
  `typing = value.trim().length >= 2`. They never appear together.
- It uses cmdk `Command`/`CommandItem` (for `data-slot="command-item"` + hover
  highlight via `data-[selected]`).
- `SearchBar` anchors the dropdown with `PopoverAnchor` (no click-toggle — the
  recent flicker fix). Its `onKeyDown` only handles **Enter → submit**. There is
  **no arrow-key navigation**: the page search input lives *outside* cmdk's
  Command, so cmdk's built-in keyboard model never receives the keystrokes.
- Data sources: `useRecentSearches` (localStorage `string[]`, with
  `push/remove/clear`) and `useSuggestions` (debounced `GET /api/search/suggest`
  → `string[]`).

## Target — Google's model (from reference screenshots)

One unified list:
- **Empty input** → recent searches only (clock icon).
- **Typing** → recents whose text **starts with** the query (clock icon) first,
  then live suggestions (magnifier icon), **deduped**, in a single
  ↑/↓-navigable list. The portion of each item *after* the typed prefix is
  **bold**. Mouse hover and keyboard highlight share one selection.

---

## Decisions (locked in brainstorming)

1. **Merge model:** matching recents first, then suggestions, deduped. Empty →
   recents only.
2. **Arrow keys:** **highlight-only** (the input text does NOT change as you
   arrow). Enter searches the highlighted item, or the typed text if nothing is
   highlighted. (Rejected: Google's preview-fill — more state/edge cases.)
3. **Keyboard architecture:** **manual ARIA combobox** — drop cmdk for this
   component; the input becomes `role="combobox"`, the dropdown a
   `role="listbox"` of `role="option"`s, with a single `activeIndex`.
   (Rejected: moving the input into a cmdk `CommandInput` — breaks the anchored
   page-search model and re-opens the focus/anchor issues just fixed; and a
   combobox library — a dependency for ~40 lines.)

---

## 1. Data — pure merge function

New file `src/search/lib/buildSuggestItems.ts`:

```ts
export interface SuggestItem {
  type: 'recent' | 'suggestion'
  text: string
}

export function buildSuggestItems(
  recents: string[],
  suggestions: string[],
  query: string,
): SuggestItem[]
```

Contract:
- `query.trim()` empty → first `MAX_EMPTY_RECENTS` (8) recents as `recent` items;
  no suggestions consulted.
- typing → recents whose text **startsWith** the query (case-insensitive),
  capped at `MAX_TYPING_RECENTS` (3), as `recent` items first; then `suggestion`
  items from `suggestions`, **excluding any whose lowercased text equals a
  recent already included** (case-insensitive dedup; recents win); total length
  capped at `MAX_TOTAL` (10).
- Order within each group preserves input order (recents are already
  newest-first; suggestions are ES relevance order).
- Pure, no React, no I/O → unit-tested in isolation.

Caps are module constants in this file.

## 2. Highlight helper (prefix bolding)

New file `src/search/lib/splitOnPrefix.ts` — a pure string function (no JSX):

```ts
export function splitOnPrefix(text: string, query: string): { head: string; tail: string }
```

Returns `{ head, tail }` where `head` is the leading `query.trim().length` chars
of `text` **only when** `text` case-insensitively starts with the trimmed query
(else `head=''`, `tail=text`). The dropdown renders `head` in normal weight and
`tail` in bold (Google style): `<span>{head}</span><strong>{tail}</strong>`.
Empty query → `head=''`, so the whole label renders normal (no bolding). Pure →
unit-tested.

## 3. Component — `SearchSuggestDropdown` becomes one listbox

Rewrite to a single flat list, no mode branching. New props:

```ts
interface SearchSuggestDropdownProps {
  items: SuggestItem[]          // from buildSuggestItems (parent owns it)
  query: string                 // for prefix bolding
  activeIndex: number           // -1 = none highlighted
  recentsHeader: boolean        // show the "Recent"/"Clear" header (empty-query state)
  onPick: (term: string) => void
  onRemoveRecent: (term: string) => void
  onClearRecents: () => void
  onActiveIndexChange: (i: number) => void  // mouse hover → highlight
  listboxId: string             // for aria wiring
  optionId: (i: number) => string
}
```

- Root is `role="listbox"` `id={listboxId}`. Each item is a
  `role="option"` `id={optionId(i)}` `aria-selected={i === activeIndex}`,
  highlighted (`bg-accent`) when active.
- Icon: `HistoryIcon` for `recent`, `SearchIcon` for `suggestion`.
- Label: `splitOnPrefix(text, query)` → normal `head` + bold `tail`.
- Recents show the hover/active ✕ remove (`aria-label="Remove <text>"`),
  `onPointerDown`/`onClick` `stopPropagation` so it doesn't trigger pick.
- `onMouseMove`/`onMouseEnter` on a row → `onActiveIndexChange(i)` (mouse and
  keyboard share the highlight).
- Header row ("Recent" + "Clear") shows only when `recentsHeader` is true
  (empty-query state), matching the current recents affordance.
- Empty list → render nothing (parent decides whether the popover opens via
  `hasContent`).

## 4. State + keyboard in `SearchBar`

- Compute `items = buildSuggestItems(recents, suggestions, value)` (memoized).
  `hasContent = items.length > 0` drives the popover `open` (replaces the
  current recents/suggestions branch).
- New state `activeIndex` (−1 default).
- Reset `activeIndex` to −1 whenever `value` changes (typing) or the popover
  closes.
- Input attributes: `role="combobox"`, `aria-expanded={open}`,
  `aria-controls={listboxId}`, `aria-autocomplete="list"`,
  `aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}`.
- `onKeyDown`:
  - `ArrowDown`: open if closed; `activeIndex = min(activeIndex + 1, items.length - 1)`; `preventDefault`.
  - `ArrowUp`: `activeIndex = max(activeIndex - 1, -1)` (−1 returns focus to typed text); `preventDefault`.
  - `Home`/`End`: jump to 0 / last (when open); `preventDefault`.
  - `Enter`: if `activeIndex >= 0` → `onSubmit(items[activeIndex].text)`; else → submit typed value. Close.
  - `Escape`: close the popover, keep typed text; `activeIndex = -1`.
- A picked item (`onPick`) and a typed submit both route through the existing
  `onSubmit` → close + navigate.
- Optional (low-cost, include if clean): `Shift+Delete` while a `recent` is
  highlighted → `onRemoveRecent(items[activeIndex].text)` (Google parity).

## 5. Behavior parity & invariants

- Enter with highlight = search the highlighted item; Enter without = search the
  typed text.
- Mouse hover and keyboard arrows write the **same** `activeIndex`.
- `PopoverAnchor` + `onInteractOutside`/`onFocusOutside` guards (the flicker fix)
  are retained unchanged.
- Recents dedup: case-insensitive; a recent that equals a suggestion shows once
  as a recent.
- Recents-while-typing match is **prefix** (`startsWith`), case-insensitive —
  matching the screenshots.

## 6. Accessibility

ARIA 1.2 combobox-with-listbox pattern: `role="combobox"` input +
`aria-controls` + `aria-activedescendant` (focus stays in the input — DOM focus
never moves to options, so screen readers announce the active option via
`aria-activedescendant`). Options carry `aria-selected`. The remove button has an
`aria-label`.

## 7. Files

| File | Change |
|---|---|
| `src/search/lib/buildSuggestItems.ts` | **NEW** pure merge (recents+suggestions, dedup, caps) |
| `src/search/lib/splitOnPrefix.ts` | **NEW** prefix split for bolding (pure strings) |
| `src/search/SearchSuggestDropdown.tsx` | **Rewrite** — single `role="listbox"`, no cmdk, no mode branch |
| `src/search/SearchBar.tsx` | `activeIndex` state, combobox ARIA, keyboard handler, build items, drive `open` from `items.length` |
| `src/search/__tests__/buildSuggestItems.test.ts` | **NEW** |
| `src/search/__tests__/splitOnPrefix.test.ts` | **NEW** |
| `src/search/__tests__/SearchSuggestDropdown.test.tsx` | **Update** — `role="option"` instead of `data-slot="command-item"`; merged-list assertions |
| `src/search/__tests__/SearchBar.test.tsx` | **Update** — keyboard nav (arrows/Enter/Esc), `role="option"` selectors |

cmdk (`Command`) is no longer imported by `SearchSuggestDropdown`. (It may remain
in the dependency tree if used elsewhere — not removed here.)

## 8. Testing

- **`buildSuggestItems`** (unit): empty query → recents only (capped 8); typing →
  matched recents (prefix, capped 3) before suggestions; case-insensitive dedup
  (recent wins); total cap 10; non-matching recents excluded while typing.
- **`splitOnPrefix`** (unit): prefix match splits head/tail; non-match → `head=''`,
  all tail; case-insensitive; empty/whitespace query → `head=''`.
- **`SearchSuggestDropdown`** (component): renders recents (clock) + suggestions
  (magnifier) in order; `aria-selected` on the active option; bold tail rendered;
  hover fires `onActiveIndexChange`; pick + remove fire their callbacks.
- **`SearchBar`** (integration): ArrowDown highlights first option; ArrowUp past
  top returns to typed text; Enter on a highlighted option submits that item;
  Enter with no highlight submits the typed value; Escape closes; mouse hover and
  arrows share the highlight. Existing behaviors (submit, clear, recents header,
  blur-close, the flicker fix) still pass.

## Out of scope (deferred)

- Google's **preview-fill** of the input as you arrow (chose highlight-only).
- Entity/rich rows (thumbnails, "AI Mode" badges) from the screenshots.
- Server-side ranking that blends recents + suggestions (merge stays client-side).

## Open questions

_None at approval time. Caps (8 empty / 3 typing-recents / 10 total) and the
optional Shift+Delete remove are reasonable defaults chosen here; flag during
review if different values are wanted._
