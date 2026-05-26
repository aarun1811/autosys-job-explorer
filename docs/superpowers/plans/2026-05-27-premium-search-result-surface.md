# Premium Search-Result Surface — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the React search-result surface premium and refined (Stripe/Vercel "airy"), with Motion microinteractions, migrate AG-Grid to the v33+ Theming API, and reframe a tab into a config-driven `ResultSurface` that composes a grid, a recviz-iframe dashboard, or both.

**Architecture:** A new `ResultSurface` replaces the direct `SearchGridPanel` render in `SearchPage`. It branches on a config-driven `dashboard` field (grid-only / grid+dashboard / dashboard-only). A reusable `RecvizEmbed` iframe primitive powers the dashboard panel now and the deferred stats renderers later. AG-Grid moves off the legacy `ag-theme-quartz` CSS class to a typed `themeQuartz.withParams()` theme wired to the existing oklch tokens. Motion animates the chrome only (never grid rows). A small backend change carries the `dashboard` field from `search-config-v4.json` through `/api/v4/search/initial`.

**Tech Stack:** React 19 + Vite 7 + TanStack Router/Query + shadcn/Tailwind v4 (oklch tokens) + AG-Grid v35.3 (Theming API) + Motion (Framer Motion v11+) + Vitest/RTL; backend Spring Boot 3.5.14 / Java 21 / Jackson / Lombok.

**Spec:** `docs/superpowers/specs/2026-05-27-premium-search-result-surface-design.md`

---

## Conventions for this plan

- **Working dir:** frontend commands run from `frontend-react/`; backend from `backend/rectrace/`. The shell resets cwd between tool calls — always `cd` first.
- **Frontend test:** `pnpm test -- <path>` (vitest). **Typecheck:** `pnpm typecheck`. **Lint:** `pnpm lint`. **Backend test:** `mvn -q test -Dtest=<ClassName>`.
- **Commit trailer (required on every commit):**
  ```
  Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
  ```
- **No raw hex** in TS/TSX (ESLint `no-restricted-syntax`) — use `var(--color-*)` / `color-mix(in oklab, …)`.
- **Aesthetic-value tasks** (marked 🎨): the *structure* and a *contract test* are specified here; the exact palette/spacing/curve values are chosen at execution time using the **`frontend-design` skill**, then verified live with Playwright in **light + dark** against the stated acceptance criteria. These tasks' "test" is structural (the theme exports, the control renders), not a pixel assertion.
- **Live verification** uses the local stack: backend on `:6088`, React dev on `:5173`; real seed terms `recon`, `SUBACC`, `SETID`, `trade`.

## File structure (created / modified)

**Phase 1 — Theming**
- Create: `frontend-react/src/search/lib/gridTheme.ts` — the typed `themeQuartz.withParams()` theme wired to oklch tokens.
- Create: `frontend-react/src/search/__tests__/gridTheme.test.ts`
- Modify: `frontend-react/src/search/SearchGrid.tsx` — pass `theme`, drop `ag-theme-quartz` class, set `data-ag-theme-mode`.
- Modify: `frontend-react/src/index.css` — remove the `.ag-theme-quartz { --ag-* }` block.
- Modify: `frontend-react/src/search/lib/gridConfig.ts` — refined density heights.

**Phase 2 — Motion + chrome**
- Modify: `frontend-react/package.json` — add `motion`.
- Create: `frontend-react/src/components/layout/motion-provider.tsx` — `MotionConfig`+`LazyMotion`.
- Modify: `frontend-react/src/routes/__root.tsx` — wrap tree in `MotionProvider`.
- Modify: `frontend-react/src/search/SearchPage.tsx` — keyed fade-in surface wrapper.
- Modify: `frontend-react/src/search/CategoryTabBar.tsx` — animated active indicator.
- Modify: `frontend-react/src/search/GridToolbar.tsx` — icon-button microinteractions.

**Phase 3 — Grid + renderer polish**
- Modify: `frontend-react/src/search/GridToolbar.tsx` — left-side context (label/count/filter badge).
- Modify: `frontend-react/src/search/SearchGridPanel.tsx` — pass context props to toolbar.
- Modify: `frontend-react/src/search/lib/gridTheme.ts` — group/selection/sort body params (🎨).
- Modify: `frontend-react/src/search/RowDetailSheet.tsx` — title + grouping + copy.
- Modify: `frontend-react/src/search/renderers/AppIDCellRenderer.tsx` — config-driven URL.
- Modify: `frontend-react/src/index.css` — shared `.rectrace-link` hover-expand primitive.

**Phase 4 — Dashboard scaffold (backend + frontend)**
- Create: `backend/rectrace/src/main/java/com/citi/gru/rectrace/dto/v4/DashboardConfig.java`
- Modify: `backend/.../dto/v4/CategoryConfigV4.java`, `CategoryResultV4.java`
- Modify: `backend/.../service/v4/SearchServiceV4.java` — dashboard-only guard + pass-through.
- Modify: `backend/rectrace/src/main/resources/search-config-v4.json` — sample dashboard categories.
- Create: `backend/.../test/.../dto/v4/DashboardConfigBindingTest.java`
- Create: `frontend-react/src/search/RecvizEmbed.tsx`, `DashboardPanel.tsx`, `ResultSurface.tsx` (+ tests)
- Modify: `frontend-react/src/search/types.ts`, `lib/deriveSearchResults.ts`, `lib/gridViewState.ts`, `SearchPage.tsx`, `SearchGridPanel.tsx`, `CategoryTabBar.tsx`.

---

# Phase 1 — AG-Grid Theming API migration

### Task 1.1: Characterize current theming, then create the typed theme

**Files:**
- Create: `frontend-react/src/search/lib/gridTheme.ts`
- Test: `frontend-react/src/search/__tests__/gridTheme.test.ts`

- [ ] **Step 1: Confirm the current theming state (evidence first).**

Run, from repo root:
```bash
grep -rn "ag-grid-community/styles\|ag-theme-\|theme=" frontend-react/src || echo "no legacy css import / theme option found"
```
Expected: the only hits are `className="ag-theme-quartz"` in `SearchGrid.tsx` and the `.ag-theme-quartz { … }` block in `index.css`. **No** `import 'ag-grid-community/styles/…'` and **no** `theme="legacy"` ⇒ the grid is already on the Theming-API default and the CSS block is merely cascading `--ag-*` vars. If a legacy CSS import IS present, note it — it must be removed in Task 1.2.

- [ ] **Step 2: Write the failing test.**

```ts
// frontend-react/src/search/__tests__/gridTheme.test.ts
import { describe, it, expect } from 'vitest'
import { gridTheme } from '@/search/lib/gridTheme'

describe('gridTheme', () => {
  it('is a constructed AG-Grid Theme object (has Theming-API marker methods)', () => {
    // themeQuartz.withParams(...) returns a Theme with chainable withParams/withPart.
    expect(gridTheme).toBeDefined()
    expect(typeof (gridTheme as { withParams?: unknown }).withParams).toBe('function')
  })

  it('wires brand + surface params to oklch CSS tokens (no raw hex)', () => {
    const json = JSON.stringify(gridTheme)
    expect(json).toContain('var(--color-primary)')
    expect(json).toContain('var(--color-background)')
    expect(json).toContain('var(--color-foreground)')
    // no hex literals leaked into the theme params
    expect(json).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})
```

- [ ] **Step 3: Run it — expect FAIL** (`Cannot find module '@/search/lib/gridTheme'`).

Run: `cd frontend-react && pnpm test -- src/search/__tests__/gridTheme.test.ts`

- [ ] **Step 4: Implement `gridTheme.ts`.** Token-driven so light/dark resolve via the `.dark` cascade; `oddRowBackgroundColor: transparent` (no zebra); hover ≠ selected. Numeric values here are the refined/airy starting point — tuned live in Task 1.3 / 3.2 with the frontend-design skill.

```ts
// frontend-react/src/search/lib/gridTheme.ts
import { themeQuartz } from 'ag-grid-community'

/**
 * AG-Grid v33+ Theming API theme for the search grid.
 *
 * Replaces the legacy `.ag-theme-quartz { --ag-* }` overrides (removed from
 * index.css). Params reference the shadcn oklch CSS variables directly — `var()`
 * is supported by the Theming API — so the grid follows light/dark automatically
 * via the `.dark` class cascade (no per-scheme literal values needed). The
 * container also carries `data-ag-theme-mode` (set in SearchGrid) so AG-Grid's
 * own popups/scrollbars pick the right color scheme.
 *
 * Refined & airy: generous spacing, medium-weight headers, a subtle row hover
 * that is DISTINCT from the accent-tinted selected row, visible-but-quiet
 * borders, no zebra striping, tabular numerals.
 */
export const gridTheme = themeQuartz
  .withParams({
    accentColor: 'var(--color-primary)',
    backgroundColor: 'var(--color-background)',
    foregroundColor: 'var(--color-foreground)',
    chromeBackgroundColor: 'var(--color-muted)',
    headerTextColor: 'var(--color-foreground)',
    borderColor: 'var(--color-border)',
    rowHoverColor: 'color-mix(in oklab, var(--color-accent) 55%, transparent)',
    selectedRowBackgroundColor: 'color-mix(in oklab, var(--color-primary) 12%, transparent)',
    oddRowBackgroundColor: 'transparent',
    fontFamily: 'Inter, system-ui, sans-serif',
    headerFontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 13,
    headerFontSize: 12,
    headerFontWeight: 500,
    spacing: 8,
    wrapperBorderRadius: 0,
  })
  .withParams({}, 'dark')
  // tabular numerals across cells (harmless on text). Structural CSS that has no
  // param equivalent goes through withCSS.
  .withCSS(`
    .ag-cell { font-variant-numeric: tabular-nums; }
  `)
```

> Note: `themeQuartz` is exported from `ag-grid-community` in v33+; v35.3 makes the Theming API the default, so no module registration or CSS import is required for it.

- [ ] **Step 5: Run the test — expect PASS.** If `withCSS`/`withParams` chaining types complain, run `pnpm typecheck` and adjust to the installed `ag-grid-community@35` signatures (the chain is `themeQuartz.withParams(...).withParams(..., 'dark').withCSS(...)`).

Run: `cd frontend-react && pnpm test -- src/search/__tests__/gridTheme.test.ts && pnpm typecheck`

- [ ] **Step 6: Commit.**
```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer
git add frontend-react/src/search/lib/gridTheme.ts frontend-react/src/search/__tests__/gridTheme.test.ts
git commit -m "feat(grid): add typed AG-Grid Theming-API theme wired to oklch tokens

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

### Task 1.2: Apply the theme; remove the legacy CSS block

**Files:**
- Modify: `frontend-react/src/search/SearchGrid.tsx:122-123` (wrapper div) and the `<AgGridReact>` props
- Modify: `frontend-react/src/index.css:116-133` (remove `.ag-theme-quartz` block)

- [ ] **Step 1: Pass the theme + theme-mode in `SearchGrid.tsx`.** Import the theme and the ThemeProvider hook; drop the `ag-theme-quartz` class. Replace the wrapper div and add the `theme` prop:

```tsx
// top of SearchGrid.tsx — add imports
import { gridTheme } from '@/search/lib/gridTheme'
import { useTheme } from '@/components/layout/theme-provider'
```

```tsx
// inside SearchGrid(), before return:
const { resolvedTheme } = useTheme() // resolves 'system' → 'light' | 'dark'
const mode = resolvedTheme // drives data-ag-theme-mode
```

```tsx
// wrapper div (was `className="ag-theme-quartz h-full w-full"`):
<div className="h-full w-full" data-ag-theme-mode={mode}>
```

```tsx
// add to <AgGridReact ...> props (near initialState):
theme={gridTheme}
```

> Confirmed: `useTheme()` returns `{ theme, setTheme, resolvedTheme }` and `resolvedTheme` is already `'light' | 'dark'` (resolves `'system'`). Use `resolvedTheme` — using `theme` would render the grid light whenever the user is on `'system'` + OS-dark.

- [ ] **Step 2: Remove the legacy block from `index.css`.** Delete lines 116-133 (the `/* AG Grid token bridge */` comment through the closing `}` of `.ag-theme-quartz`). Leave the rest of the file untouched.

- [ ] **Step 3: Typecheck + run the full grid-related suite.**

Run: `cd frontend-react && pnpm typecheck && pnpm test`
Expected: PASS (existing SearchGrid tests still green; they assert grid options, not the wrapper class — confirm none assert `ag-theme-quartz`; if one does, update it).

- [ ] **Step 4: Live verification.** Start the stack, open `http://localhost:5173/search?q=recon`, switch the active tab to a grouped category. Confirm in **light and dark**: grid renders with the theme, header/rows readable, **row hover differs from selected row**, borders visible in dark. Take before/after screenshots.

- [ ] **Step 5: Commit.**
```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer
git add frontend-react/src/search/SearchGrid.tsx frontend-react/src/index.css
git commit -m "feat(grid): switch grid to Theming API, drop legacy ag-theme-quartz overrides

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

### Task 1.3: Refined/airy density heights 🎨

**Files:**
- Modify: `frontend-react/src/search/lib/gridConfig.ts:7-13`
- Test: `frontend-react/src/search/__tests__/gridConfig.test.ts` (**already exists** and asserts the OLD 24/32 row + 32/36 header values — REPLACE those assertions, don't add a second file)

- [ ] **Step 1: Replace the existing density assertions.** In `gridConfig.test.ts`, delete the current "match Angular (24/32, 32/36)" expectations and add the new presets:

```ts
// frontend-react/src/search/__tests__/gridConfig.test.ts
import { describe, it, expect } from 'vitest'
import { rowHeightForDensity, headerHeightForDensity } from '@/search/lib/gridConfig'

describe('density presets (refined & airy)', () => {
  it('normal is roomier than the old 32px', () => {
    expect(rowHeightForDensity('normal')).toBeGreaterThanOrEqual(40)
    expect(headerHeightForDensity('normal')).toBeGreaterThanOrEqual(44)
  })
  it('compact stays dense', () => {
    expect(rowHeightForDensity('compact')).toBe(32)
    expect(headerHeightForDensity('compact')).toBe(36)
  })
})
```

- [ ] **Step 2: Run — expect FAIL** (normal still 32/36).

Run: `cd frontend-react && pnpm test -- src/search/__tests__/gridConfig.test.ts`

- [ ] **Step 3: Update the presets.**
```ts
export function rowHeightForDensity(density: GridDensity): number {
  return density === 'compact' ? 32 : 40
}
export function headerHeightForDensity(density: GridDensity): number {
  return density === 'compact' ? 36 : 44
}
```

- [ ] **Step 4: Run — expect PASS.** Then live-verify both densities in light+dark; use the frontend-design skill to confirm the airy default *feels* right against a populated grid (adjust the constants if the designer's eye says so, keeping compact ≤ normal).

Run: `cd frontend-react && pnpm test -- src/search/__tests__/gridConfig.test.ts`

- [ ] **Step 5: Commit.**
```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer
git add frontend-react/src/search/lib/gridConfig.ts frontend-react/src/search/__tests__/gridConfig.test.ts
git commit -m "feat(grid): roomier default row/header density (refined & airy)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

# Phase 2 — Motion foundation + chrome microinteractions

### Task 2.1: Add Motion + a reduced-motion-safe provider

**Files:**
- Modify: `frontend-react/package.json`
- Create: `frontend-react/src/components/layout/motion-provider.tsx`
- Modify: `frontend-react/src/routes/__root.tsx`
- Test: `frontend-react/src/components/layout/__tests__/motion-provider.test.tsx`

- [ ] **Step 1: Install Motion.**
```bash
cd frontend-react && pnpm add motion
```
Expected: `motion` appears in `package.json` dependencies.

- [ ] **Step 2: Write the failing test.**
```tsx
// frontend-react/src/components/layout/__tests__/motion-provider.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MotionProvider } from '@/components/layout/motion-provider'

describe('MotionProvider', () => {
  it('renders its children', () => {
    render(<MotionProvider><span>hi</span></MotionProvider>)
    expect(screen.getByText('hi')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run — expect FAIL** (module missing).

Run: `cd frontend-react && pnpm test -- src/components/layout/__tests__/motion-provider.test.tsx`

- [ ] **Step 4: Implement the provider.**
```tsx
// frontend-react/src/components/layout/motion-provider.tsx
import type { ReactNode } from 'react'
import { LazyMotion, domAnimation, MotionConfig } from 'motion/react'

/**
 * App-wide Motion config. `reducedMotion="user"` honours the OS setting
 * (disables transforms, keeps opacity) — WCAG-friendly with zero per-component
 * work. LazyMotion + domAnimation keeps the bundle lean; components use `m.*`
 * (from 'motion/react'), never the full `motion.*`.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domAnimation} strict>
        {children}
      </LazyMotion>
    </MotionConfig>
  )
}
```

- [ ] **Step 5: Wrap the app tree** in `__root.tsx` — place `MotionProvider` just inside `ThemeProvider` (so motion is available everywhere, theme outermost). Add the import and wrap the existing children.

```tsx
import { MotionProvider } from '@/components/layout/motion-provider'
// ... inside the root component's JSX, wrap the existing <QueryClientProvider>…</> subtree:
<MotionProvider>
  {/* existing QueryClientProvider / Toaster / Outlet subtree */}
</MotionProvider>
```

- [ ] **Step 6: Run test + typecheck — expect PASS.**

Run: `cd frontend-react && pnpm test -- src/components/layout/__tests__/motion-provider.test.tsx && pnpm typecheck`

- [ ] **Step 7: Commit.**
```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer
git add frontend-react/package.json frontend-react/pnpm-lock.yaml frontend-react/src/components/layout/motion-provider.tsx frontend-react/src/components/layout/__tests__/motion-provider.test.tsx frontend-react/src/routes/__root.tsx
git commit -m "feat(motion): add Motion with reduced-motion-safe LazyMotion provider

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

### Task 2.2: Keyed fade-in on tab-content switch 🎨

**Files:**
- Modify: `frontend-react/src/search/SearchPage.tsx:175-180`

- [ ] **Step 1: Wrap the active-content block** (currently the `<div className="…animate-in fade-in-0…">` containing `CategoryTabBar` + the active panel) so the *panel* fades in keyed by the active category — **no exit animation**, and the grid's own `key` is untouched. Replace the inner panel render:

```tsx
import { m } from 'motion/react'
// ...
<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
  <CategoryTabBar categories={results} activeKey={activeCategory?.key ?? results[0].key} onSelect={handleSelectTab} />
  {activeCategory && (
    <m.div
      key={activeCategory.key}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <SearchGridPanel q={q ?? ''} category={activeCategory} />
    </m.div>
  )}
</div>
```
(Remove the now-redundant `animate-in fade-in-0 duration-300` on the outer div; the `m.div` owns the entrance. Do **not** wrap with `AnimatePresence`/`mode="wait"` — that would block the incoming grid behind an exit.)

- [ ] **Step 2: Typecheck + full suite.** Update `SearchPage` tests only if they assert the removed `animate-in` class.

Run: `cd frontend-react && pnpm typecheck && pnpm test -- src/search`

- [ ] **Step 3: Live-verify** tab switching feels instant (no blocking delay), and a **shared-view link still restores** columns/grouping/expansion (open a `?view=…` link). Light + dark.

- [ ] **Step 4: Commit.**
```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer
git add frontend-react/src/search/SearchPage.tsx
git commit -m "feat(motion): keyed fade-in on tab-content switch (non-blocking)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

### Task 2.3: Animated active-tab indicator + refined badge 🎨

**Files:**
- Modify: `frontend-react/src/search/CategoryTabBar.tsx`

- [ ] **Step 1: Add a sliding indicator** with Motion `layoutId` shared across tabs, and move the count into a refined pill. Keep the `data-tab-key` / `data-active` attributes (tests + Playwright rely on them). Replace the active 2px border with a `layoutId="cat-tab-underline"` `m.span` rendered only under the active tab:

```tsx
import { m } from 'motion/react'
// inside the map, replace the static border treatment:
className={`relative px-3.5 h-10 flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap transition-colors duration-200 ease-out rounded-t-md ${
  active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
}`}
// ...children:
{c.label}
<span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
  {c.count}{c.hasMore ? '+' : ''}
</span>
{active && (
  <m.span
    layoutId="cat-tab-underline"
    className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-primary"
    transition={{ type: 'spring', stiffness: 500, damping: 38 }}
  />
)}
```
Keep the `tabLabel` export if any test imports it; otherwise inline as above.

- [ ] **Step 2: Update the existing `CategoryTabBar.test.tsx`** — TWO assertions break: (a) the `"<label> (<count>)"` label-string test → split into label-text + count-pill assertions; (b) the "active tab carries the primary border indicator" test asserting `border-primary`/`border-b-2` on the active button → rewrite to assert the new active indicator (the `layoutId` underline element, or keep asserting `data-active="true"`).

Run: `cd frontend-react && pnpm test -- src/search/__tests__/CategoryTabBar.test.tsx && pnpm typecheck`

- [ ] **Step 3: Live-verify** the indicator slides between tabs; reduced-motion disables the slide; light + dark.

- [ ] **Step 4: Commit.**
```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer
git add frontend-react/src/search/CategoryTabBar.tsx frontend-react/src/search/__tests__/CategoryTabBar.test.tsx
git commit -m "feat(motion): sliding active-tab indicator + refined count pill

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

### Task 2.4: Toolbar icon-button microinteractions 🎨

**Files:**
- Modify: `frontend-react/src/search/GridToolbar.tsx` (the `ToolButton` component)

- [ ] **Step 1: Add a subtle hover/press microinteraction** to `ToolButton`. Wrap the icon in an `m.span` with `whileHover`/`whileTap` scale, and tighten `delayDuration` to `200`. Do not change the button API or `aria-*`.

```tsx
import { m } from 'motion/react'
// inside ToolButton, wrap children:
<m.span
  className="inline-flex"
  whileHover={{ scale: 1.08 }}
  whileTap={{ scale: 0.92 }}
  transition={{ type: 'spring', stiffness: 600, damping: 30 }}
>
  {children}
</m.span>
```
Change `<TooltipProvider delayDuration={300}>` → `delayDuration={200}`.

- [ ] **Step 2: Typecheck + existing GridToolbar test** (button callbacks must still fire — the `m.span` is non-interactive, the `Button` still handles `onClick`).

Run: `cd frontend-react && pnpm test -- src/search/__tests__/GridToolbar.test.tsx && pnpm typecheck`

- [ ] **Step 3: Live-verify** hover/press feel; reduced-motion neutralises scale.

- [ ] **Step 4: Commit.**
```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer
git add frontend-react/src/search/GridToolbar.tsx
git commit -m "feat(motion): toolbar icon hover/press microinteractions

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

# Phase 3 — Grid + renderer visual polish

### Task 3.1: Toolbar left-side context (label · count · filter badge)

**Files:**
- Modify: `frontend-react/src/search/GridToolbar.tsx`
- Modify: `frontend-react/src/search/SearchGridPanel.tsx`
- Test: `frontend-react/src/search/__tests__/GridToolbar.test.tsx` (exists — its `setup()` helper must also pass the 3 new **required** props, else `pnpm typecheck` fails on the existing tests)

- [ ] **Step 1: Write failing tests** for the new left context. Add to the GridToolbar test:

```tsx
import { render, screen } from '@testing-library/react'
import { GridToolbar } from '@/search/GridToolbar'

const base = {
  density: 'normal' as const, isDeduplicated: false, isExporting: false,
  onToggleSidebar(){}, onToggleDensity(){}, onAutoSize(){}, onResetView(){},
  onExpandAll(){}, onCollapseAll(){}, onClearFilters(){}, onRefresh(){},
  onToggleDedup(){}, onExportExcel(){}, onCopy(){}, onShare(){},
}

it('shows the category label and result count', () => {
  render(<GridToolbar {...base} categoryLabel="Job Name" resultCount={42} activeFilterCount={0} />)
  expect(screen.getByText('Job Name')).toBeInTheDocument()
  expect(screen.getByText('42')).toBeInTheDocument()
})

it('shows an active-filter badge only when filters are active', () => {
  const { rerender } = render(<GridToolbar {...base} categoryLabel="X" resultCount={1} activeFilterCount={0} />)
  expect(screen.queryByLabelText('active filters')).toBeNull()
  rerender(<GridToolbar {...base} categoryLabel="X" resultCount={1} activeFilterCount={2} />)
  expect(screen.getByLabelText('active filters')).toHaveTextContent('2')
})
```

- [ ] **Step 2: Run — expect FAIL** (props don't exist).

Run: `cd frontend-react && pnpm test -- src/search/__tests__/GridToolbar.test.tsx`

- [ ] **Step 3: Add the props + left context.** Extend `GridToolbarProps`:
```tsx
  categoryLabel: string
  resultCount: number
  activeFilterCount: number
```
Replace the leading `<div className="flex-1" />` with the context block + a flex spacer:
```tsx
<div className="flex min-w-0 items-center gap-2">
  <span className="truncate text-sm font-semibold text-foreground">{props.categoryLabel}</span>
  <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
    {props.resultCount}
  </span>
  {props.activeFilterCount > 0 && (
    <span
      aria-label="active filters"
      className="rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-medium tabular-nums text-primary"
    >
      {props.activeFilterCount}
    </span>
  )}
</div>
<div className="flex-1" />
```

- [ ] **Step 4: Feed the props from `SearchGridPanel`.** It already owns `category` and the `GridApi`. Track an `activeFilterCount` from the grid's filter model. Add state + a filter-changed handler, and pass props:
```tsx
const [activeFilterCount, setActiveFilterCount] = useState(0)
// in onGridReady, after setting apiRef:
e.api.addEventListener('filterChanged', () => {
  setActiveFilterCount(Object.keys(e.api.getFilterModel() ?? {}).length)
})
// in the <GridToolbar .../> usage, add:
categoryLabel={category.label}
resultCount={category.count}
activeFilterCount={activeFilterCount}
```
(Initialise count from a shared-view restore too: after restore, set it from `api.getFilterModel()`.)

- [ ] **Step 5: Run test + typecheck — expect PASS.**

Run: `cd frontend-react && pnpm test -- src/search/__tests__/GridToolbar.test.tsx && pnpm typecheck`

- [ ] **Step 6: Live-verify** the label/count render; apply a column filter → badge appears with the count. Light + dark.

- [ ] **Step 7: Commit.**
```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer
git add frontend-react/src/search/GridToolbar.tsx frontend-react/src/search/SearchGridPanel.tsx frontend-react/src/search/__tests__/GridToolbar.test.tsx
git commit -m "feat(grid): toolbar left-context — category label, count, active-filter badge

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

### Task 3.2: Grid-body polish via theme params 🎨

**Files:**
- Modify: `frontend-react/src/search/lib/gridTheme.ts`

- [ ] **Step 1: Extend `gridTheme`** with the body-level treatment, using the frontend-design skill to choose final values: a left accent border on the selected row + polished group-row background + sort-chevron treatment via `withCSS`, and tuned `rowBorder`/`columnBorder`. Add to the `.withCSS(...)` block (keep `tabular-nums`):
```css
.ag-row-selected { box-shadow: inset 2px 0 0 0 var(--color-primary); }
.ag-row-group { background: color-mix(in oklab, var(--color-muted) 50%, transparent); }
.ag-header-cell-resize::after { opacity: 0; transition: opacity 120ms ease; }
.ag-header-cell:hover .ag-header-cell-resize::after { opacity: 1; }
```
Set `columnBorder: false` and a subtle `rowBorder` in `withParams` (designer picks the exact mix).

- [ ] **Step 2: Run the gridTheme test + typecheck** (the no-hex assertion still guards you).

Run: `cd frontend-react && pnpm test -- src/search/__tests__/gridTheme.test.ts && pnpm typecheck`

- [ ] **Step 3: Live-verify** acceptance criteria in light + dark: selected row has a clear accent left-edge distinct from hover; group rows read as a tier; resize handle appears on header hover; numerals align. Iterate values with the frontend-design eye.

- [ ] **Step 4: Commit.**
```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer
git add frontend-react/src/search/lib/gridTheme.ts
git commit -m "feat(grid): refined body treatment — selection edge, group tier, sort/resize affordances

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

### Task 3.3: RowDetailSheet polish

**Files:**
- Modify: `frontend-react/src/search/RowDetailSheet.tsx`
- Test: `frontend-react/src/search/__tests__/RowDetailSheet.test.tsx`

- [ ] **Step 1: Write failing tests** for the richer title and de-emphasised empties. The title should show the category label + the search/rowGroup column value; empty fields get a muted treatment.

```tsx
import { render, screen } from '@testing-library/react'
import { RowDetailSheet } from '@/search/RowDetailSheet'
import type { ColumnDefinitionV4 } from '@/search/types'

const columns: ColumnDefinitionV4[] = [
  { field: 'job_name', headerName: 'Job Name', rowGroup: true } as ColumnDefinitionV4,
  { field: 'box_name', headerName: 'Box Name' } as ColumnDefinitionV4,
]

it('titles the sheet with the category label and the search-column value', () => {
  render(<RowDetailSheet open onOpenChange={() => {}} categoryLabel="Job Name"
    row={{ job_name: 'JOB_ABC', box_name: '' }} columns={columns} />)
  expect(screen.getByText('JOB_ABC')).toBeInTheDocument()
  expect(screen.getByText('Job Name')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run — expect FAIL** (no `categoryLabel` prop; title is static "Row details").

Run: `cd frontend-react && pnpm test -- src/search/__tests__/RowDetailSheet.test.tsx`

- [ ] **Step 3: Implement.** Add `categoryLabel: string` to props; compute the primary value from the `rowGroup` column (fallback: first column). Title = primary value, description = `${categoryLabel} record`. De-emphasise empty values (muted, italic) and keep the `—` fallback. Add a copy-cell button per row (clipboard write + sonner toast).

```tsx
import { CopyIcon } from 'lucide-react'
import { toast } from 'sonner'
// ...
const primaryField = columns.find((c) => c.rowGroup)?.field ?? columns[0]?.field
const primaryValue = primaryField ? String(row?.[primaryField] ?? '') : ''
// SheetTitle => {primaryValue || 'Record details'}
// SheetDescription => `${categoryLabel} record`
// value cell: if displayable === null → <dd className="italic text-muted-foreground/70">—</dd>
// add a small copy button next to populated values:
<button type="button" aria-label={`Copy ${c.headerName}`} className="opacity-0 group-hover:opacity-100 …"
  onClick={() => { void navigator.clipboard.writeText(value); toast.success('Copied') }}>
  <CopyIcon className="size-3.5" />
</button>
```
(Wrap each row in `className="group …"` for the hover-reveal copy.)

- [ ] **Step 4: Pass `categoryLabel` from `SearchGridPanel`** where `<RowDetailSheet>` is rendered: add `categoryLabel={category.label}`. **Also update the existing `SearchGridPanel.test.tsx`** — it asserts `findByText('Row details')`; the title is now the primary value, so assert the new description (`/record/i`) or the primary value (`SAMPLE_TRADE_RECON_001`, already in that test's data) instead.

- [ ] **Step 5: Run test + typecheck — expect PASS.**

Run: `cd frontend-react && pnpm test -- src/search/__tests__/RowDetailSheet.test.tsx && pnpm typecheck`

- [ ] **Step 6: Live-verify** double-click a row → sheet titled by the job/recon value; copy buttons appear on row hover; empties muted. Light + dark.

- [ ] **Step 7: Commit.**
```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer
git add frontend-react/src/search/RowDetailSheet.tsx frontend-react/src/search/SearchGridPanel.tsx frontend-react/src/search/__tests__/RowDetailSheet.test.tsx
git commit -m "feat(grid): richer row-detail sheet — primary-value title, copy-cell, muted empties

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

### Task 3.4: Config-driven AppID URL + shared link primitive

**Files:**
- Modify: `frontend-react/src/search/renderers/AppIDCellRenderer.tsx`
- Modify: `frontend-react/src/index.css` (append `.rectrace-link` utility)
- Test: `frontend-react/src/search/__tests__/AppIDCellRenderer.test.tsx` (**exists** — its current tests assert the hardcoded `lnkd.in` href, that any truthy value is an anchor, and a `text-primary`/`underline` className; all must be REWRITTEN)

- [ ] **Step 1: Rewrite the existing test file.** Replace the canonical-href / always-anchor / `text-primary` assertions with the template-driven tests below — the URL must come from `cellRendererParams.urlTemplate` (with a `{value}` placeholder), falling back to a plain span when absent (no hardcoded LinkedIn URL):

```tsx
import { render, screen } from '@testing-library/react'
import { AppIDCellRenderer } from '@/search/renderers/AppIDCellRenderer'
import type { ICellRendererParams } from 'ag-grid-community'

function params(over: Partial<ICellRendererParams>): ICellRendererParams {
  return { value: 'APP123', data: { app_name: 'Acme' }, ...over } as ICellRendererParams
}

it('renders an anchor from the configured urlTemplate, substituting {value}', () => {
  render(<AppIDCellRenderer {...params({ colDef: { cellRendererParams: { urlTemplate: 'https://portal/app/{value}' } } } as Partial<ICellRendererParams>)} />)
  const a = screen.getByRole('link', { name: 'APP123' })
  expect(a).toHaveAttribute('href', 'https://portal/app/APP123')
})

it('renders a plain span when no urlTemplate is configured', () => {
  render(<AppIDCellRenderer {...params({})} />)
  expect(screen.queryByRole('link')).toBeNull()
  expect(screen.getByText('APP123')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run — expect FAIL** (current renderer always uses the LinkedIn URL).

Run: `cd frontend-react && pnpm test -- src/search/__tests__/AppIDCellRenderer.test.tsx`

- [ ] **Step 3: Implement the config-driven renderer.**
```tsx
import type { ICellRendererParams } from 'ag-grid-community'

/**
 * AppIDCellRenderer — config-driven app link. The URL comes from
 * cellRendererParams.urlTemplate (with a `{value}` placeholder) declared in
 * search-config-v4.json; no template ⇒ plain text. The real Citi app-portal
 * URL is supplied via config — see search-config-v4.json [NEEDS USER INPUT].
 */
export function AppIDCellRenderer(params: ICellRendererParams) {
  const value = params.value as string | undefined | null
  const data = params.data as Record<string, unknown> | undefined
  const appName = (data?.app_name as string | undefined) ?? ''
  const template = (params.colDef?.cellRendererParams as { urlTemplate?: string } | undefined)?.urlTemplate
  if (!value || !template) return <span>{value}</span>
  const href = template.replace('{value}', encodeURIComponent(value))
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
       title={`View details of ${appName}`} className="rectrace-link">
      {value}
    </a>
  )
}
```

- [ ] **Step 4: Add the shared `.rectrace-link` hover-expand primitive** to `index.css` (the green expand-on-hover treatment from Angular, token-driven — ready for the deferred stats renderers). Append after the other `.rectrace-*` blocks:
```css
/* Clickable cell link — quiet at rest, expands a tinted pill on hover. */
.rectrace-link {
  color: var(--color-primary);
  text-decoration: underline;
  text-underline-offset: 2px;
  border-radius: 3px;
  padding: 2px 0;
  transition: background-color 150ms ease, padding 150ms ease, margin 150ms ease;
}
.rectrace-link:hover {
  text-decoration: none;
  background-color: color-mix(in oklab, var(--color-primary) 8%, transparent);
  padding: 2px 6px;
  margin: 0 -6px;
}
```

- [ ] **Step 5: Add the `urlTemplate` to the config** for `app_id` columns in `search-config-v4.json` (both `fileName` and `jobName` categories). Use a clearly-marked placeholder so it's obvious it needs the real value:
```json
{ "field": "app_id", "headerName": "App ID", "sortable": true, "filter": true,
  "cellRenderer": "appIDCellRenderer",
  "cellRendererParams": { "urlTemplate": "https://REPLACE-WITH-CITI-APP-PORTAL/{value}" } }
```
> `[NEEDS USER INPUT]` — confirm the real app-portal URL with the user before production.

- [ ] **Step 6: Run test + typecheck — expect PASS.**

Run: `cd frontend-react && pnpm test -- src/search/__tests__/AppIDCellRenderer.test.tsx && pnpm typecheck`

- [ ] **Step 7: Commit.**
```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer
git add frontend-react/src/search/renderers/AppIDCellRenderer.tsx frontend-react/src/index.css frontend-react/src/search/__tests__/AppIDCellRenderer.test.tsx backend/rectrace/src/main/resources/search-config-v4.json
git commit -m "feat(renderers): config-driven AppID URL + shared link hover primitive

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

### Task 3.5: Polished grid no-rows overlay 🎨

**Files:**
- Create: `frontend-react/src/search/GridNoRowsOverlay.tsx`
- Modify: `frontend-react/src/search/SearchGrid.tsx` (register `noRowsOverlayComponent`)
- Test: `frontend-react/src/search/__tests__/GridNoRowsOverlay.test.tsx`

- [ ] **Step 1: Write the failing test.**
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GridNoRowsOverlay } from '@/search/GridNoRowsOverlay'

it('renders a calm, helpful no-rows message', () => {
  render(<GridNoRowsOverlay />)
  expect(screen.getByText(/no rows/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run — expect FAIL** (module missing).

Run: `cd frontend-react && pnpm test -- src/search/__tests__/GridNoRowsOverlay.test.tsx`

- [ ] **Step 3: Implement** a token-driven overlay (icon + message + hint; designer tunes spacing/icon with the frontend-design skill):
```tsx
import { SearchXIcon } from 'lucide-react'

/** AG-Grid noRowsOverlayComponent — shown when a category/filter yields zero rows. */
export function GridNoRowsOverlay() {
  return (
    <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
      <SearchXIcon className="size-7 opacity-70" />
      <p className="font-medium text-foreground">No rows to show</p>
      <p className="text-xs">Try clearing filters or refining your search.</p>
    </div>
  )
}
```

- [ ] **Step 4: Register it** on `<AgGridReact>` in `SearchGrid.tsx`: add `noRowsOverlayComponent={GridNoRowsOverlay}` (import it). Confirm the no-rows overlay module is available; if AG-Grid warns it needs a module, register the overlay module in `main.tsx` (license still first).

- [ ] **Step 5: Run test + typecheck — expect PASS;** live-verify by filtering a column to a non-matching value → the overlay shows. Light + dark.

Run: `cd frontend-react && pnpm test -- src/search/__tests__/GridNoRowsOverlay.test.tsx && pnpm typecheck`

- [ ] **Step 6: Commit.**
```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer
git add frontend-react/src/search/GridNoRowsOverlay.tsx frontend-react/src/search/SearchGrid.tsx frontend-react/src/search/__tests__/GridNoRowsOverlay.test.tsx
git commit -m "feat(grid): polished no-rows overlay

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

# Phase 4 — Dashboard scaffold (backend + frontend)

### Task 4.1: Backend `DashboardConfig` DTO + wire into config & result DTOs

**Files:**
- Create: `backend/rectrace/src/main/java/com/citi/gru/rectrace/dto/v4/DashboardConfig.java`
- Modify: `backend/.../dto/v4/CategoryConfigV4.java`, `CategoryResultV4.java`
- Test: `backend/rectrace/src/test/java/com/citi/gru/rectrace/dto/v4/DashboardConfigBindingTest.java`

- [ ] **Step 1: Write the failing binding test** (plain Jackson, no Spring context — mirrors default camelCase serialization):

```java
// backend/rectrace/src/test/java/com/citi/gru/rectrace/dto/v4/DashboardConfigBindingTest.java
package com.citi.gru.rectrace.dto.v4;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class DashboardConfigBindingTest {
    private final ObjectMapper om = new ObjectMapper();

    @Test
    void categoryWithDashboardBindsAllFields() throws Exception {
        String json = """
            {"key":"k","label":"L","searchColumn":"c",
             "dashboard":{"url":"https://x/embed?term={q}","title":"T","defaultOpen":true,"height":320}}
            """;
        CategoryConfigV4 cfg = om.readValue(json, CategoryConfigV4.class);
        assertThat(cfg.getDashboard()).isNotNull();
        assertThat(cfg.getDashboard().getUrl()).isEqualTo("https://x/embed?term={q}");
        assertThat(cfg.getDashboard().getTitle()).isEqualTo("T");
        assertThat(cfg.getDashboard().getDefaultOpen()).isTrue();
        assertThat(cfg.getDashboard().getHeight()).isEqualTo(320);
    }

    @Test
    void categoryWithoutDashboardLeavesItNull() throws Exception {
        CategoryConfigV4 cfg = om.readValue("{\"key\":\"k\",\"label\":\"L\",\"searchColumn\":\"c\"}", CategoryConfigV4.class);
        assertThat(cfg.getDashboard()).isNull();
    }

    @Test
    void resultSerializesDashboardWithCamelCaseKeys() throws Exception {
        CategoryResultV4 r = CategoryResultV4.builder()
            .key("k").label("L")
            .dashboard(DashboardConfig.builder().url("u").title("t").defaultOpen(false).height(200).build())
            .build();
        String out = om.writeValueAsString(r);
        assertThat(out).contains("\"dashboard\"").contains("\"defaultOpen\":false").contains("\"url\":\"u\"");
    }
}
```

- [ ] **Step 2: Run — expect FAIL** (`DashboardConfig` missing; `getDashboard()` undefined).

Run: `cd backend/rectrace && mvn -q test -Dtest=DashboardConfigBindingTest`

- [ ] **Step 3: Create `DashboardConfig.java`** (same Lombok style as the sibling DTOs):
```java
package com.citi.gru.rectrace.dto.v4;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class DashboardConfig {
    private String url;          // recviz embed URL; may contain a {q} placeholder
    private String title;
    private Boolean defaultOpen;
    private Integer height;
}
```

- [ ] **Step 4: Add the field to both DTOs.** In `CategoryConfigV4.java` add `private DashboardConfig dashboard;`. In `CategoryResultV4.java` add `private DashboardConfig dashboard;`. (Lombok `@Data @Builder` regenerate getters/builder automatically.)

- [ ] **Step 5: Run — expect PASS.**

Run: `cd backend/rectrace && mvn -q test -Dtest=DashboardConfigBindingTest`

- [ ] **Step 6: Commit.**
```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer
git add backend/rectrace/src/main/java/com/citi/gru/rectrace/dto/v4/DashboardConfig.java backend/rectrace/src/main/java/com/citi/gru/rectrace/dto/v4/CategoryConfigV4.java backend/rectrace/src/main/java/com/citi/gru/rectrace/dto/v4/CategoryResultV4.java backend/rectrace/src/test/java/com/citi/gru/rectrace/dto/v4/DashboardConfigBindingTest.java
git commit -m "feat(search): add DashboardConfig DTO, wire into V4 config + result

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

### Task 4.2: `/initial` passes dashboard through + skips ES for dashboard-only categories

**Files:**
- Modify: `backend/.../service/v4/SearchServiceV4.java` (the `performInitialSearch` loop, ~lines 51-86)
- Test: `backend/rectrace/src/test/java/com/citi/gru/rectrace/service/v4/SearchServiceV4DashboardTest.java`

- [ ] **Step 1: Read `SearchServiceV4.java` fully** and note its injected fields (the trace shows `configService.getCategories()` and `esService.getUniqueValues(...)`; confirm the exact field names + constructor). Write a Mockito unit test against the real shape (adjust field/ctor names to what you find):

```java
// backend/rectrace/src/test/java/com/citi/gru/rectrace/service/v4/SearchServiceV4DashboardTest.java
package com.citi.gru.rectrace.service.v4;

import com.citi.gru.rectrace.dto.v4.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SearchServiceV4DashboardTest {
    // NOTE: align these mocks + the constructor call with the actual SearchServiceV4 fields.
    @Mock SearchConfigServiceV4 configService;
    @Mock ElasticsearchServiceV4 esService;          // confirm the real ES service type/name
    @InjectMocks SearchServiceV4 service;

    @Test
    void gridCategoryCarriesDashboardThrough() {
        DashboardConfig dash = DashboardConfig.builder().url("u").title("t").build();
        CategoryConfigV4 grid = CategoryConfigV4.builder()
            .key("jobName").label("Job Name")
            .elasticsearch(ElasticsearchConfig.builder().index("i").maxResults(1000).build())
            .dashboard(dash).columns(List.of()).build();
        when(configService.getCategories()).thenReturn(List.of(grid));
        when(esService.getUniqueValues(eq("term"), any())).thenReturn(List.of("A", "B"));

        InitialSearchResponseV4 resp = service.performInitialSearch("term");
        CategoryResultV4 r = resp.getCategoryResults().get("jobName");
        assertThat(r.getDashboard()).isSameAs(dash);
        assertThat(r.getCount()).isEqualTo(2);
    }

    @Test
    void dashboardOnlyCategoryAppearsWithoutEsSearch() {
        CategoryConfigV4 dashOnly = CategoryConfigV4.builder()
            .key("overview").label("Overview")
            .dashboard(DashboardConfig.builder().url("u").build())
            .build(); // no elasticsearch block
        when(configService.getCategories()).thenReturn(List.of(dashOnly));

        InitialSearchResponseV4 resp = service.performInitialSearch("term");
        CategoryResultV4 r = resp.getCategoryResults().get("overview");
        assertThat(r).isNotNull();
        assertThat(r.getDashboard()).isNotNull();
        assertThat(r.getValues()).isEmpty();
        verify(esService, never()).getUniqueValues(anyString(), any());
    }
}
```

- [ ] **Step 2: Run — expect FAIL** (dashboard not passed; ES called for dashboard-only ⇒ `verify never` fails or NPE-to-catch).

Run: `cd backend/rectrace && mvn -q test -Dtest=SearchServiceV4DashboardTest`

- [ ] **Step 3: Edit the assembly loop.** Inside the `CompletableFuture.runAsync` lambda, before the ES call, add the dashboard-only guard; add `.dashboard(category.getDashboard())` to the success and catch builders.

```java
// at the top of the try, before esService.getUniqueValues(...):
if (category.getElasticsearch() == null) {
    categoryResults.put(category.getKey(), CategoryResultV4.builder()
            .key(category.getKey())
            .label(category.getLabel())
            .values(new ArrayList<>())
            .count(0)
            .hasMore(false)
            .columns(category.getColumns() != null ? category.getColumns() : new ArrayList<>())
            .dashboard(category.getDashboard())
            .build());
    return; // skip ES for a dashboard-only category
    // NOTE: coalesce columns null→[] so /initial never emits columns:null —
    // the client's CategoryResultV4Schema.columns is a strict (non-nullable) array.
}
// ... existing success builder: add  .dashboard(category.getDashboard())
// ... existing catch  builder: add  .dashboard(category.getDashboard())
```
(`ArrayList`/`Collections` import as already used in the file.)

- [ ] **Step 4: Run — expect PASS.**

Run: `cd backend/rectrace && mvn -q test -Dtest=SearchServiceV4DashboardTest`

- [ ] **Step 5: Commit.**
```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer
git add backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v4/SearchServiceV4.java backend/rectrace/src/test/java/com/citi/gru/rectrace/service/v4/SearchServiceV4DashboardTest.java
git commit -m "feat(search): /initial carries dashboard config + emits dashboard-only categories

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

### Task 4.3: Sample dashboard categories in config + boot check

**Files:**
- Modify: `backend/rectrace/src/main/resources/search-config-v4.json`

- [ ] **Step 1: Add a `dashboard` block to one existing grid category** (e.g. `jobName`) and **append one dashboard-only category**. Dashboard-only has `dashboard` + minimal keys, **no** `elasticsearch`/`oracle`/`columns`:
```json
{
  "key": "overview",
  "label": "Overview",
  "searchColumn": "",
  "dashboard": {
    "url": "http://localhost:5173/recviz-placeholder.html?term={q}",
    "title": "Search overview",
    "defaultOpen": true,
    "height": 360
  }
}
```
For `jobName`, add a sibling `"dashboard": { "url": "http://localhost:5173/recviz-placeholder.html?term={q}", "title": "Job summary", "defaultOpen": false, "height": 320 }`.
> Placeholder URL points at a local static page (created in Task 4.6 step) so iframe mechanics verify without the real recviz/SSO. Real URLs are config-only later.

- [ ] **Step 2: Run the full backend test suite** (config parses at boot via `SearchConfigServiceV4` `@PostConstruct`; `ContextLoadsTest` exercises it under `test` profile).

Run: `cd backend/rectrace && mvn -q test`
Expected: BUILD SUCCESS (no parse failure from the new category).

- [ ] **Step 3: Commit.**
```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer
git add backend/rectrace/src/main/resources/search-config-v4.json
git commit -m "chore(search): sample grid+dashboard and dashboard-only categories in config

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

### Task 4.4: Frontend Zod schema for `dashboard`

**Files:**
- Modify: `frontend-react/src/search/types.ts`
- Test: `frontend-react/src/search/__tests__/types.dashboard.test.ts`

- [ ] **Step 1: Write failing tests.**
```ts
import { describe, it, expect } from 'vitest'
import { CategoryResultV4Schema } from '@/search/types'

const base = { key: 'k', label: 'L', values: [], count: 0, hasMore: false, columns: [] }

it('accepts a category result with a dashboard', () => {
  const r = CategoryResultV4Schema.parse({ ...base, dashboard: { url: 'https://x/{q}', title: 'T', defaultOpen: true, height: 320 } })
  expect(r.dashboard?.url).toBe('https://x/{q}')
})
it('accepts a category result without a dashboard', () => {
  expect(CategoryResultV4Schema.parse(base).dashboard).toBeUndefined()
})
it('rejects a dashboard with a non-string url', () => {
  expect(() => CategoryResultV4Schema.parse({ ...base, dashboard: { url: 42 } })).toThrow()
})
```

- [ ] **Step 2: Run — expect FAIL.**

Run: `cd frontend-react && pnpm test -- src/search/__tests__/types.dashboard.test.ts`

- [ ] **Step 3: Add the schema + fields** in `types.ts`. After `ColumnDefinitionV4Schema`:
```ts
export const DashboardConfigV4Schema = z.object({
  url: z.string(),
  title: z.string().nullish(),
  defaultOpen: z.boolean().nullish(),
  height: z.number().nullish(),
})
```
Add `dashboard: DashboardConfigV4Schema.nullish(),` to **both** `CategoryConfigV4Schema` and `CategoryResultV4Schema`. Add the inferred type:
```ts
export type DashboardConfigV4 = z.infer<typeof DashboardConfigV4Schema>
```

- [ ] **Step 4: Run — expect PASS** + typecheck.

Run: `cd frontend-react && pnpm test -- src/search/__tests__/types.dashboard.test.ts && pnpm typecheck`

- [ ] **Step 5: Commit.**
```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer
git add frontend-react/src/search/types.ts frontend-react/src/search/__tests__/types.dashboard.test.ts
git commit -m "feat(search): Zod schema for per-category dashboard config

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

### Task 4.5: `deriveSearchResults` keeps dashboard-bearing categories

**Files:**
- Modify: `frontend-react/src/search/lib/deriveSearchResults.ts`
- Test: `frontend-react/src/search/__tests__/deriveSearchResults.test.ts` (extend if present, else create)

- [ ] **Step 1: Write failing test.**
```ts
import { describe, it, expect } from 'vitest'
import { deriveSearchResults } from '@/search/lib/deriveSearchResults'
import type { InitialSearchResponseV4 } from '@/search/types'

const resp = {
  categoryResults: {
    grid:   { key: 'grid', label: 'Grid', values: ['a'], count: 1, hasMore: false, columns: [] },
    empty:  { key: 'empty', label: 'Empty', values: [], count: 0, hasMore: false, columns: [] },
    dash:   { key: 'dash', label: 'Dash', values: [], count: 0, hasMore: false, columns: [], dashboard: { url: 'u' } },
  },
} as unknown as InitialSearchResponseV4

it('keeps count>0 grid categories AND dashboard-bearing categories, drops empty grid categories', () => {
  const keys = deriveSearchResults(resp).map((c) => c.key)
  expect(keys).toContain('grid')
  expect(keys).toContain('dash')   // dashboard tab survives count 0
  expect(keys).not.toContain('empty')
})
```

- [ ] **Step 2: Run — expect FAIL** (`dash` dropped by the `count > 0` filter).

Run: `cd frontend-react && pnpm test -- src/search/__tests__/deriveSearchResults.test.ts`

- [ ] **Step 3: Update the filter** to keep dashboard categories. Dashboard-only tabs sort after counted tabs (count 0 already sorts last via the existing descending sort).
```ts
export function deriveSearchResults(resp: InitialSearchResponseV4): CategoryResultV4[] {
  return Object.values(resp.categoryResults)
    .filter((c) => c.count > 0 || c.dashboard != null)
    .sort((a, b) => b.count - a.count)
}
```

- [ ] **Step 4: Run — expect PASS.**

Run: `cd frontend-react && pnpm test -- src/search/__tests__/deriveSearchResults.test.ts`

- [ ] **Step 5: Commit.**
```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer
git add frontend-react/src/search/lib/deriveSearchResults.ts frontend-react/src/search/__tests__/deriveSearchResults.test.ts
git commit -m "feat(search): keep dashboard-bearing categories as tabs regardless of hit count

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

### Task 4.6: `RecvizEmbed` iframe primitive

**Files:**
- Create: `frontend-react/src/search/RecvizEmbed.tsx`
- Create: `frontend-react/public/recviz-placeholder.html` (local embed target for verification)
- Test: `frontend-react/src/search/__tests__/RecvizEmbed.test.tsx`

- [ ] **Step 1: Write failing tests** for `{q}` substitution and strict origin handling. Export the pure URL helper for direct testing.
```tsx
import { describe, it, expect } from 'vitest'
import { resolveEmbedUrl } from '@/search/RecvizEmbed'

describe('resolveEmbedUrl', () => {
  it('substitutes {q} encoded', () => {
    expect(resolveEmbedUrl('https://x/e?term={q}', 'a b')).toBe('https://x/e?term=a%20b')
  })
  it('leaves a url without {q} unchanged', () => {
    expect(resolveEmbedUrl('https://x/e', 'a')).toBe('https://x/e')
  })
})
```

- [ ] **Step 2: Run — expect FAIL** (module missing).

Run: `cd frontend-react && pnpm test -- src/search/__tests__/RecvizEmbed.test.tsx`

- [ ] **Step 3: Implement `RecvizEmbed.tsx`.** Skeleton → fade-in on load; sandbox; height + theme via `postMessage` with **strict origin checks**; error + retry.
```tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { m } from 'motion/react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/components/layout/theme-provider'

/** Substitute the optional `{q}` placeholder (URL-encoded). Exported for tests. */
// eslint-disable-next-line react-refresh/only-export-components
export function resolveEmbedUrl(url: string, q: string): string {
  return url.includes('{q}') ? url.replace('{q}', encodeURIComponent(q)) : url
}

export interface RecvizEmbedProps {
  url: string
  q: string
  title?: string
  minHeight?: number
}

export function RecvizEmbed({ url, q, title, minHeight = 320 }: RecvizEmbedProps) {
  const src = useMemo(() => resolveEmbedUrl(url, q), [url, q])
  const origin = useMemo(() => { try { return new URL(src).origin } catch { return '' } }, [src])
  const ref = useRef<HTMLIFrameElement>(null)
  const { resolvedTheme } = useTheme() // 'light' | 'dark' (resolves 'system')
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [height, setHeight] = useState(minHeight)
  const [reloadKey, setReloadKey] = useState(0)

  // Height messages from the embed — strict origin validation; never '*'.
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (!origin || e.origin !== origin) return
      const data = e.data as { type?: string; height?: number }
      if (data?.type === 'RECTRACE_IFRAME_HEIGHT' && typeof data.height === 'number') {
        setHeight(Math.max(minHeight, data.height))
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [origin, minHeight])

  // Push theme to the embed once loaded and whenever it changes.
  useEffect(() => {
    if (state !== 'ready' || !origin) return
    ref.current?.contentWindow?.postMessage(
      { type: 'RECTRACE_THEME', theme: resolvedTheme }, origin,
    )
  }, [state, resolvedTheme, origin])

  return (
    <div className="relative h-full w-full" style={{ minHeight }}>
      {state === 'loading' && <Skeleton className="absolute inset-2 rounded-lg" />}
      {state === 'error' ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
          <p>This dashboard could not be loaded.</p>
          <Button size="sm" variant="outline" onClick={() => { setState('loading'); setReloadKey((k) => k + 1) }}>
            Retry
          </Button>
        </div>
      ) : (
        <m.iframe
          key={reloadKey}
          ref={ref}
          src={src}
          title={title ?? 'Dashboard'}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups-to-escape-sandbox"
          onLoad={() => setState('ready')}
          onError={() => setState('error')}
          initial={{ opacity: 0 }}
          animate={{ opacity: state === 'ready' ? 1 : 0 }}
          transition={{ duration: 0.2 }}
          className="h-full w-full border-0"
          style={{ height }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create the local placeholder embed** `frontend-react/public/recviz-placeholder.html` so the iframe has something to load during verification (echoes the term, reports height, reacts to theme):
```html
<!doctype html><html><head><meta charset="utf-8"><style>
  body{font-family:Inter,system-ui,sans-serif;margin:0;padding:24px;background:#fff;color:#111}
  body[data-theme="dark"]{background:#15191c;color:#e8eaed}
</style></head><body>
  <h2>recviz placeholder</h2><p id="term"></p>
  <script>
    const p = new URLSearchParams(location.search);
    document.getElementById('term').textContent = 'term: ' + (p.get('term') || '(none)');
    function report(){ parent.postMessage({type:'RECTRACE_IFRAME_HEIGHT',height:document.body.scrollHeight}, '*'); }
    new ResizeObserver(report).observe(document.body); report();
    addEventListener('message', e => { if (e.data?.type==='RECTRACE_THEME') document.body.dataset.theme=e.data.theme; });
  </script>
</body></html>
```
> This placeholder uses `'*'` for its own outgoing height post (it's a throwaway local test page). The **host** (`RecvizEmbed`) still validates origin strictly — that's the security-relevant side.

- [ ] **Step 5: Run test + typecheck — expect PASS.**

Run: `cd frontend-react && pnpm test -- src/search/__tests__/RecvizEmbed.test.tsx && pnpm typecheck`

- [ ] **Step 6: Commit.**
```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer
git add frontend-react/src/search/RecvizEmbed.tsx frontend-react/public/recviz-placeholder.html frontend-react/src/search/__tests__/RecvizEmbed.test.tsx
git commit -m "feat(dashboard): RecvizEmbed iframe primitive (skeleton, height/theme postMessage, retry)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

### Task 4.7: `DashboardPanel` (collapsible header + full-surface + copy-link)

**Files:**
- Create: `frontend-react/src/search/DashboardPanel.tsx`
- Test: `frontend-react/src/search/__tests__/DashboardPanel.test.tsx`

- [ ] **Step 1: Write failing tests.**
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DashboardPanel } from '@/search/DashboardPanel'

const dash = { url: 'http://localhost:5173/recviz-placeholder.html', title: 'Job summary' }

it('full variant renders the embed with no collapse header', () => {
  render(<DashboardPanel variant="full" dashboard={dash} q="x" open onOpenChange={() => {}} />)
  expect(screen.queryByRole('button', { name: /collapse|expand/i })).toBeNull()
  expect(screen.getByTitle('Job summary')).toBeInTheDocument()
})

it('header variant toggles open/closed', async () => {
  const onOpenChange = vi.fn()
  render(<DashboardPanel variant="header" dashboard={dash} q="x" open onOpenChange={onOpenChange} />)
  await userEvent.click(screen.getByRole('button', { name: /collapse|hide/i }))
  expect(onOpenChange).toHaveBeenCalledWith(false)
})
```
(Add `import { vi } from 'vitest'`.)

- [ ] **Step 2: Run — expect FAIL** (module missing).

Run: `cd frontend-react && pnpm test -- src/search/__tests__/DashboardPanel.test.tsx`

- [ ] **Step 3: Implement.** `variant="full"` → just the embed; `variant="header"` → a collapsible bar (title + chevron + copy-link) with a Motion height reveal.
```tsx
import { m, AnimatePresence } from 'motion/react'
import { ChevronDownIcon, LinkIcon } from 'lucide-react'
import { toast } from 'sonner'
import { RecvizEmbed } from '@/search/RecvizEmbed'
import type { DashboardConfigV4 } from '@/search/types'

export interface DashboardPanelProps {
  variant: 'header' | 'full'
  dashboard: DashboardConfigV4
  q: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

function CopyLink() {
  return (
    <button type="button" aria-label="Copy link to this view"
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
      onClick={() => { void navigator.clipboard.writeText(window.location.href).then(() => toast.success('Link copied')) }}>
      <LinkIcon className="size-3.5" /> Copy link
    </button>
  )
}

export function DashboardPanel({ variant, dashboard, q, open, onOpenChange }: DashboardPanelProps) {
  if (variant === 'full') {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-sm font-semibold text-foreground">{dashboard.title ?? 'Dashboard'}</span>
          <CopyLink />
        </div>
        <div className="min-h-0 flex-1 px-3 pb-3">
          <RecvizEmbed url={dashboard.url} q={q} title={dashboard.title ?? undefined} minHeight={dashboard.height ?? 320} />
        </div>
      </div>
    )
  }
  return (
    <div className="border-b">
      <div className="flex items-center justify-between px-3 py-1.5">
        <button type="button" aria-label={open ? 'Collapse dashboard' : 'Expand dashboard'}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground"
          onClick={() => onOpenChange(!open)}>
          <m.span animate={{ rotate: open ? 0 : -90 }} transition={{ duration: 0.18 }}>
            <ChevronDownIcon className="size-4" />
          </m.span>
          {dashboard.title ?? 'Dashboard'}
        </button>
        <CopyLink />
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <m.div key="body" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: 'easeOut' }}
            className="overflow-hidden px-3 pb-3">
            <RecvizEmbed url={dashboard.url} q={q} title={dashboard.title ?? undefined} minHeight={dashboard.height ?? 320} />
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}
```

- [ ] **Step 4: Run test + typecheck — expect PASS.**

Run: `cd frontend-react && pnpm test -- src/search/__tests__/DashboardPanel.test.tsx && pnpm typecheck`

- [ ] **Step 5: Commit.**
```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer
git add frontend-react/src/search/DashboardPanel.tsx frontend-react/src/search/__tests__/DashboardPanel.test.tsx
git commit -m "feat(dashboard): DashboardPanel — collapsible header + full-surface variants

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

### Task 4.8: `ResultSurface` composition + Share `dashboardOpen`

**Files:**
- Create: `frontend-react/src/search/ResultSurface.tsx`
- Modify: `frontend-react/src/search/lib/gridViewState.ts` (add `dashboardOpen`)
- Modify: `frontend-react/src/search/SearchGridPanel.tsx` (accept restored `dashboardOpen`, expose it for Share)
- Test: `frontend-react/src/search/__tests__/ResultSurface.test.tsx`, extend `gridViewState.test.ts`

- [ ] **Step 1: Extend `GridViewState` with `dashboardOpen`** (test first). Add to `gridViewState.test.ts`:
```ts
it('round-trips dashboardOpen', () => {
  const enc = encodeViewState({ columnState: [], filterModel: {}, dedup: false, density: 'normal', expandedGroups: [], dashboardOpen: false })
  expect(decodeViewState(enc)?.dashboardOpen).toBe(false)
})
it('defaults dashboardOpen to undefined for old links', () => {
  const enc = encodeViewState({ columnState: [], filterModel: {}, dedup: false, density: 'normal', expandedGroups: [] } as never)
  expect(decodeViewState(enc)?.dashboardOpen).toBeUndefined()
})
```
Then in `gridViewState.ts`: add `dashboardOpen?: boolean` to the `GridViewState` interface, and in `decodeViewState`'s return add `dashboardOpen: typeof v.dashboardOpen === 'boolean' ? (v.dashboardOpen as boolean) : undefined,`. (No change to `isGridViewState` — it's optional.)

- [ ] **Step 2: Write failing `ResultSurface` branch tests.** Mock the heavy children so the test asserts only the branch.
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
vi.mock('@/search/SearchGridPanel', () => ({ SearchGridPanel: () => <div data-testid="grid" /> }))
vi.mock('@/search/DashboardPanel', () => ({ DashboardPanel: (p: { variant: string }) => <div data-testid={`dash-${p.variant}`} /> }))
import { ResultSurface } from '@/search/ResultSurface'
import type { CategoryResultV4 } from '@/search/types'

const grid = { key: 'g', label: 'G', values: ['a'], count: 1, hasMore: false, columns: [{ field: 'x', headerName: 'X', rowGroup: true }] } as CategoryResultV4
const dashOnly = { key: 'd', label: 'D', values: [], count: 0, hasMore: false, columns: [], dashboard: { url: 'u' } } as CategoryResultV4
const both = { ...grid, dashboard: { url: 'u' } } as CategoryResultV4

it('grid-only → grid, no dashboard', () => { render(<ResultSurface q="x" category={grid} />); expect(screen.getByTestId('grid')).toBeTruthy(); expect(screen.queryByTestId(/dash-/)).toBeNull() })
it('dashboard-only → full dashboard, no grid', () => { render(<ResultSurface q="x" category={dashOnly} />); expect(screen.getByTestId('dash-full')).toBeTruthy(); expect(screen.queryByTestId('grid')).toBeNull() })
it('both → header dashboard + grid', () => { render(<ResultSurface q="x" category={both} />); expect(screen.getByTestId('dash-header')).toBeTruthy(); expect(screen.getByTestId('grid')).toBeTruthy() })
```

- [ ] **Step 3: Run — expect FAIL** (module missing).

Run: `cd frontend-react && pnpm test -- src/search/__tests__/ResultSurface.test.tsx`

- [ ] **Step 4: Implement `ResultSurface`.** It owns the dashboard open state (seeded from the shared view, then `defaultOpen`) and passes it to `SearchGridPanel` so Share can capture it.
```tsx
import { useMemo, useState } from 'react'
import { useSearch } from '@tanstack/react-router'
import { DashboardPanel } from '@/search/DashboardPanel'
import { SearchGridPanel } from '@/search/SearchGridPanel'
import { decodeViewState } from '@/search/lib/gridViewState'
import type { CategoryResultV4 } from '@/search/types'

export function ResultSurface({ q, category }: { q: string; category: CategoryResultV4 }): React.ReactElement {
  const { view } = useSearch({ from: '/search' })
  const restored = useMemo(() => (view ? decodeViewState(view) : null), [view])
  const hasGrid = category.columns.length > 0
  const dash = category.dashboard ?? null
  const [dashOpen, setDashOpen] = useState<boolean>(
    () => restored?.dashboardOpen ?? dash?.defaultOpen ?? false,
  )

  if (dash && !hasGrid) {
    return <DashboardPanel variant="full" dashboard={dash} q={q} open onOpenChange={() => {}} />
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {dash && <DashboardPanel variant="header" dashboard={dash} q={q} open={dashOpen} onOpenChange={setDashOpen} />}
      <SearchGridPanel q={q} category={category} dashboardOpen={dash ? dashOpen : undefined} />
    </div>
  )
}
```

- [ ] **Step 5: Thread `dashboardOpen` into `SearchGridPanel`'s Share.** Add an optional prop `dashboardOpen?: boolean`; include it in the `onShare` payload so a shared grid+dashboard link preserves the collapse state:
```tsx
// SearchGridPanelProps: add `dashboardOpen?: boolean`
// in onShare(), build state with: dashboardOpen: dashboardOpen,
// add dashboardOpen to onShare's useCallback deps.
```
(The existing `restored?.dashboardOpen` is consumed by `ResultSurface`, not here — `SearchGridPanel` only needs to *emit* it on Share.)

- [ ] **Step 6: Run tests + typecheck — expect PASS.**

Run: `cd frontend-react && pnpm test -- src/search/__tests__/ResultSurface.test.tsx src/search/__tests__/gridViewState.test.ts && pnpm typecheck`

- [ ] **Step 7: Commit.**
```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer
git add frontend-react/src/search/ResultSurface.tsx frontend-react/src/search/lib/gridViewState.ts frontend-react/src/search/SearchGridPanel.tsx frontend-react/src/search/__tests__/ResultSurface.test.tsx frontend-react/src/search/__tests__/gridViewState.test.ts
git commit -m "feat(dashboard): ResultSurface composition + share dashboard collapse state

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

### Task 4.9: Wire `ResultSurface` into the page + dashboard-tab affordance

**Files:**
- Modify: `frontend-react/src/search/SearchPage.tsx`
- Modify: `frontend-react/src/search/CategoryTabBar.tsx`
- Modify: `frontend-react/src/search/__tests__/SearchPage.test.tsx` (mocks)

- [ ] **Step 1: Swap the render** in `SearchPage.tsx` — the `m.div` from Task 2.2 now wraps `ResultSurface` instead of `SearchGridPanel`:
```tsx
import { ResultSurface } from '@/search/ResultSurface'
// inside the keyed m.div:
<ResultSurface q={q ?? ''} category={activeCategory} />
```
Remove the now-unused `SearchGridPanel` import from `SearchPage.tsx`.

- [ ] **Step 2: Dashboard-tab affordance in `CategoryTabBar`** — show a dashboard icon instead of a count when the category is dashboard-only (no grid columns). Write the failing test:
```tsx
import { LayoutDashboardIcon } from 'lucide-react' // (in component, not test)
// test:
it('shows a dashboard icon (not a count) for a dashboard-only category', () => {
  const cats = [{ key: 'd', label: 'Overview', values: [], count: 0, hasMore: false, columns: [], dashboard: { url: 'u' } }] as never
  render(<CategoryTabBar categories={cats} activeKey="d" onSelect={() => {}} />)
  expect(screen.getByTestId('tab-dashboard-icon')).toBeTruthy()
})
```
Then in the component, when `c.columns.length === 0 && c.dashboard`, render `<LayoutDashboardIcon data-testid="tab-dashboard-icon" className="size-3.5" />` in place of the count pill.

- [ ] **Step 3: Update `SearchPage.test.tsx` mocks** — it currently mocks `SearchGridPanel`; mock `ResultSurface` instead:
```tsx
vi.mock('@/search/ResultSurface', () => ({
  // Preserve the key-capture the existing tab-switch tests rely on — they push
  // category.key and assert gridCategoryKeys.at(-1). Reuse the SAME array the
  // file already declares; just point it at ResultSurface instead of SearchGridPanel.
  ResultSurface: ({ category }: { category: { key: string } }) => {
    gridCategoryKeys.push(category.key)
    return <div data-testid="result-surface">{category.key}</div>
  },
}))
```
Keep the `gridCategoryKeys.at(-1)` tab-switch assertions; only the panel name changes.

- [ ] **Step 4: Run the full search suite + typecheck — expect PASS.**

Run: `cd frontend-react && pnpm test -- src/search && pnpm typecheck && pnpm lint`

- [ ] **Step 5: Live end-to-end verification.** With both servers up:
  - `?q=recon` → grid tabs unaffected (grid-only path intact).
  - the `jobName` tab shows a **collapsible dashboard header** above the grid (placeholder embed loads, echoes the term, collapses/expands).
  - the `overview` dashboard-only tab shows the **full-surface** dashboard with a dashboard icon in the tab (no count).
  - Share a grid+dashboard view with the header collapsed → open the link → header restores collapsed.
  - Toggle theme → placeholder embed flips via the postMessage handshake.
  - Light + dark; reduced-motion.

- [ ] **Step 6: Commit.**
```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer
git add frontend-react/src/search/SearchPage.tsx frontend-react/src/search/CategoryTabBar.tsx frontend-react/src/search/__tests__/SearchPage.test.tsx frontend-react/src/search/__tests__/CategoryTabBar.test.tsx
git commit -m "feat(dashboard): render ResultSurface + dashboard-only tab affordance

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Final verification (after all phases)

- [ ] `cd frontend-react && pnpm test && pnpm typecheck && pnpm lint` — all green (note any pre-existing lint errors in `tests/fixtures/raw-hex.tsx` / shadcn fast-refresh, confirmed on HEAD).
- [ ] `cd backend/rectrace && mvn -q test` — BUILD SUCCESS.
- [ ] Live Playwright sweep of all five seed terms across grid-only, grid+dashboard, and dashboard-only tabs, **light + dark**, with screenshots.
- [ ] Re-read the spec's "Constraints" and confirm: no raw hex, config-driven (no hardcoded URLs/columns in React), AG-Grid license still before `registerModules`, `getRowId` unchanged, no Motion on grid rows.
- [ ] Use **superpowers:finishing-a-development-branch** to wrap up.

## Self-review notes (gaps the executor must close)

- **SearchServiceV4 field names** (Task 4.2) — the Mockito test uses `configService` / `esService` / `ElasticsearchServiceV4`; confirm the real injected types/names when you open the file and adjust the `@Mock` declarations + `@InjectMocks` accordingly.
- **`useTheme` shape** (Tasks 1.2, 4.6) — confirm the provider's hook returns `{ theme }` with `'light' | 'dark' | 'system'`; if it exposes a resolved value, prefer that for the grid `data-ag-theme-mode` and the embed theme post.
- **AG-Grid v35 Theming chain types** (Task 1.1) — if `themeQuartz.withParams(...).withParams(..., 'dark').withCSS(...)` trips TS in the installed version, consult AG-Grid docs (context7) for the exact v35.3 signature and adapt; the no-hex test still guards correctness.
- **Existing SearchGrid/SearchPage tests** — update only assertions invalidated by the wrapper-class removal (Task 1.2) and the `ResultSurface` swap (Task 4.9); do not weaken behavioral assertions.
- **Existing tests broken by polish (must update, not just add):** `AppIDCellRenderer.test.tsx` (Task 3.4), `gridConfig.test.ts` (Task 1.3), `GridToolbar.test.tsx` `setup()` (Task 3.1), `SearchGridPanel.test.tsx` 'Row details' assertion (Task 3.3), `CategoryTabBar.test.tsx` active-border test (Task 2.3). Each is flagged in its task.
- **Grid loading/error polish is a soft gap** — Task 3.5 covers the no-rows overlay, but the spec's "refined loading treatment" and an in-grid error state are not separate tasks; treat them as live-verification polish during Task 3.2, not "done".
- **Dashboard-only `columns`** — the Task 4.2 guard coalesces `null → []` so `/initial` never emits `columns: null` (the client's `CategoryResultV4Schema.columns` is a strict array). Keep that coalesce; the dashboard-only config category (Task 4.3) has no `columns` key.
- **Theme source** — use `resolvedTheme` (not `theme`) for the grid `data-ag-theme-mode` (Task 1.2) and the embed theme post (Task 4.6), so `'system'`+OS-dark renders dark.
