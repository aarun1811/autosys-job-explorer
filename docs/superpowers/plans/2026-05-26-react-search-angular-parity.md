# React Search — Angular Parity Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `frontend-react`'s single-category search into a multi-category federated search mirroring Angular `search-v5` behavior (one `/initial` call → tabs per category with hits → per-tab SSRM grid), plus user-info, typeahead, recent-searches cleanup, and a centered hero — all in the existing shadcn shell.

**Architecture:** URL is the single source of truth (`q` + `tab`). `/` renders a centered hero; `/search?q=…` renders the results view. The `/initial` response is self-sufficient (inline `columns[]`, `count`, `hasMore`, `values`); `/config` + `useSearchConfig` are deleted. The SSRM filter column is derived from the column flagged `rowGroup: true`. Only the active tab's grid is mounted, keyed by `${q}-${activeKey}` for clean remount + correct SSRM on tab switch.

**Tech Stack:** React 19, TanStack Router + Query, Zod, AG-Grid 35 SSRM, shadcn/Tailwind v4, Vitest + @testing-library/react (jsdom), Playwright for E2E.

**Spec:** `docs/superpowers/specs/2026-05-26-react-search-angular-parity-design.md`

**Test conventions (verified):**
- Run a single test file: `pnpm exec vitest run src/search/__tests__/<file>.test.tsx`
- Full suite: `pnpm test` · Types: `pnpm typecheck` · Lint: `pnpm lint`
- `src/test-setup.ts` already polyfills `matchMedia`, `ResizeObserver`, `scrollIntoView`.
- Router-bound hooks/components are tested inside an in-memory TanStack Router harness (see `useSearchState.test.tsx` pattern). Network/hooks are mocked with `vi.hoisted` + `vi.mock`.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/search/lib/configToColDefs.ts` | Add `columnsToColDefs(columns)`; `configCategoryToColDefs` delegates to it |
| `src/search/hooks/useUserInfo.ts` | localStorage-cached user identity (loginId, initials, isIdentified) |
| `src/search/hooks/useSuggestions.ts` | Debounced typeahead against `/api/search/suggest` |
| `src/search/hooks/useSearchState.ts` | URL state `{ q, tab, setQ, setTab, clear }` |
| `src/search/lib/deriveSearchResults.ts` | Pure: response → filtered+sorted category array |
| `src/search/lib/userInitials.ts` | Pure: loginId → initials |
| `src/search/SearchGrid.tsx` | Per-category SSRM grid from inline `columns[]` |
| `src/search/CategoryTabBar.tsx` | Multi-tab strip, `"Label (N[+])"`, active=tab, click→setTab |
| `src/search/SearchSuggestDropdown.tsx` | Recents (empty) / live suggestions (typing), single open-state |
| `src/search/SearchBar.tsx` | Thin controlled input + clear + Search, delegates dropdown |
| `src/components/app-shell/UserChip.tsx` | Initials chip (tooltip=loginId) or "Sign in" |
| `src/components/app-shell/BrandLogo.tsx` | Theme-aware logo (`Rectrace.png`/`rectrace-dark.png`) |
| `src/search/SearchHero.tsx` | Centered hero: logo + animated placeholder input + Search + Try + dropdown + user chip |
| `src/search/SearchPage.tsx` | Results view orchestrator (navbar + tabs + active grid + toolbar) |
| `src/routes/index.tsx` | Renders `SearchHero` (no redirect) |
| `src/routes/search.tsx` | Zod `{ q?, tab? }`; no-`q` guard → `/` |
| `src/search/lib/heroContent.ts` | Declared cosmetic constants: placeholder phrases, Try examples |
| `src/search/hooks/useSearchConfig.ts` + test | **DELETE** |
| `public/rectrace.png`, `public/rectrace-dark.png` | Ported logo assets |

---

## Wave 1 — Pure logic & standalone hooks

### Task 1: `columnsToColDefs` extraction

**Files:**
- Modify: `src/search/lib/configToColDefs.ts`
- Test: `src/search/__tests__/configToColDefs.test.ts` (extend)

- [ ] **Step 1: Read the current adapter.** Open `src/search/lib/configToColDefs.ts`. It currently exports `configCategoryToColDefs(category: CategoryConfigV4): ColDef[]`. Note the exact mapping (field→colId, headerName, rowGroup/hide, cellRenderer string lookup, cellStyle kebab→camel). The whole body operates on `category.columns` — that is the seam to extract.

- [ ] **Step 2: Write the failing test.** Append to `configToColDefs.test.ts`:

```ts
import { columnsToColDefs } from '@/search/lib/configToColDefs'
import { cellRenderers } from '@/search/renderers/registry'
import type { ColumnDefinitionV4 } from '@/search/types'

describe('columnsToColDefs', () => {
  const cols: ColumnDefinitionV4[] = [
    { field: 'file_name_pattern', headerName: 'File Name', rowGroup: true, hide: true, sortable: true, filter: true, resizable: null, width: null, cellRenderer: null, cellRendererParams: null, cellStyle: null, pinned: null },
    { field: 'app_name', headerName: 'App Name', rowGroup: null, hide: null, sortable: true, filter: true, resizable: null, width: null, cellRenderer: 'appIDCellRenderer', cellRendererParams: null, cellStyle: null, pinned: null },
    { field: 'misc', headerName: 'Misc', rowGroup: null, hide: null, sortable: true, filter: true, resizable: null, width: null, cellRenderer: 'unknownKey', cellRendererParams: null, cellStyle: null, pinned: null },
  ]
  test('maps fields, rowGroup, and resolves renderer key to the registry component', () => {
    // The adapter resolves the JSON cellRenderer STRING through the registry into
    // a component (configToColDefs.ts) — registry keys are appIDCellRenderer etc.
    const defs = columnsToColDefs(cols)
    expect(defs).toHaveLength(3)
    expect(defs[0]).toMatchObject({ field: 'file_name_pattern', rowGroup: true, hide: true })
    expect(defs[1].field).toBe('app_name')
    expect(defs[1].cellRenderer).toBe(cellRenderers.appIDCellRenderer)
    // Unknown renderer key resolves to undefined (registry miss) — not the string.
    expect(defs[2].cellRenderer).toBeUndefined()
  })
  test('configCategoryToColDefs delegates to columnsToColDefs (same output)', () => {
    const category = { key: 'fileName', label: 'File Name', searchColumn: 'file_name_pattern', elasticsearch: {}, oracle: {}, columns: cols }
    expect(configCategoryToColDefs(category)).toEqual(columnsToColDefs(cols))
  })
})
```

- [ ] **Step 3: Run, verify it fails.** `pnpm exec vitest run src/search/__tests__/configToColDefs.test.ts` → FAIL (`columnsToColDefs` not exported).

- [ ] **Step 4: Refactor.** In `configToColDefs.ts`, rename the existing function body to `columnsToColDefs(columns: ColumnDefinitionV4[]): ColDef[]` (export it). Replace `configCategoryToColDefs`:

```ts
export function columnsToColDefs(columns: ColumnDefinitionV4[]): ColDef[] {
  // … the existing per-column mapping, iterating `columns` instead of `category.columns` …
}

export function configCategoryToColDefs(category: { columns: ColumnDefinitionV4[] }): ColDef[] {
  return columnsToColDefs(category.columns)
}
```

Keep all existing mapping logic byte-for-byte; only the parameter changes.

- [ ] **Step 5: Run tests.** `pnpm exec vitest run src/search/__tests__/configToColDefs.test.ts` → PASS.

- [ ] **Step 6: Commit.** `git add -A && git commit -m "refactor(react): extract columnsToColDefs from configCategoryToColDefs"`

---

### Task 2: `userInitials` + `useUserInfo`

**Files:**
- Create: `src/search/lib/userInitials.ts`, `src/search/hooks/useUserInfo.ts`
- Test: `src/search/__tests__/userInitials.test.ts`, `src/search/__tests__/useUserInfo.test.tsx`

- [ ] **Step 1: Failing test for `userInitials`.**

```ts
import { describe, test, expect } from 'vitest'
import { userInitials } from '@/search/lib/userInitials'
describe('userInitials', () => {
  test('dotted loginId → first char of first two parts', () => expect(userInitials('john.doe')).toBe('JD'))
  test('multi-part dotted → first two parts only', () => expect(userInitials('a.b.c')).toBe('AB'))
  test('no dot → first two chars upper', () => expect(userInitials('xy123')).toBe('XY'))
  test('single char → that char upper', () => expect(userInitials('z')).toBe('Z'))
  test('empty → empty', () => expect(userInitials('')).toBe(''))
})
```

- [ ] **Step 2: Run, verify fail.** `pnpm exec vitest run src/search/__tests__/userInitials.test.ts` → FAIL.

- [ ] **Step 3: Implement `userInitials.ts`** (Angular `getUserInitials` parity):

```ts
export function userInitials(loginId: string): string {
  if (!loginId) return ''
  const parts = loginId.split('.')
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return loginId.substring(0, 2).toUpperCase()
}
```

- [ ] **Step 4: Run → PASS.**

- [ ] **Step 5: Failing test for `useUserInfo`.** Mock `apiFetch`; assert localStorage-first, then endpoint, then null→unidentified.

```tsx
/* eslint-disable @typescript-eslint/require-await */
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const apiFetchMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/queryClient', () => ({ apiFetch: apiFetchMock, reportRequestFailure: vi.fn() }))
import { useUserInfo } from '@/search/hooks/useUserInfo'

beforeEach(() => { localStorage.clear(); apiFetchMock.mockReset() })

describe('useUserInfo', () => {
  test('uses cached loginId from localStorage without calling the endpoint', async () => {
    localStorage.setItem('userLoginId', 'john.doe')
    const { result } = renderHook(() => useUserInfo())
    await waitFor(() => expect(result.current.isIdentified).toBe(true))
    expect(result.current.loginId).toBe('john.doe')
    expect(result.current.initials).toBe('JD')
    expect(apiFetchMock).not.toHaveBeenCalled()
  })
  test('falls back to /api/user/info and caches a non-null loginId', async () => {
    apiFetchMock.mockResolvedValue({ json: async () => ({ loginId: 'jane.roe' }) })
    const { result } = renderHook(() => useUserInfo())
    await waitFor(() => expect(result.current.isIdentified).toBe(true))
    expect(result.current.loginId).toBe('jane.roe')
    expect(localStorage.getItem('userLoginId')).toBe('jane.roe')
    expect(apiFetchMock).toHaveBeenCalledWith('/rectrace/api/user/info')
  })
  test('null loginId → unidentified, nothing cached', async () => {
    apiFetchMock.mockResolvedValue({ json: async () => ({ loginId: null }) })
    const { result } = renderHook(() => useUserInfo())
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalled())
    expect(result.current.isIdentified).toBe(false)
    expect(localStorage.getItem('userLoginId')).toBeNull()
  })
  test('endpoint error → unidentified (swallowed)', async () => {
    apiFetchMock.mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useUserInfo())
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalled())
    expect(result.current.isIdentified).toBe(false)
  })
})
```

- [ ] **Step 6: Run, verify fail.** → FAIL (module missing).

- [ ] **Step 7: Implement `useUserInfo.ts`:**

```ts
import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/queryClient'
import { userInitials } from '@/search/lib/userInitials'

const STORAGE_KEY = 'userLoginId'

export interface UserInfoState {
  loginId: string | null
  initials: string
  isIdentified: boolean
}

export function useUserInfo(): UserInfoState {
  const [loginId, setLoginId] = useState<string | null>(() => {
    try { return localStorage.getItem(STORAGE_KEY) } catch { return null }
  })

  useEffect(() => {
    if (loginId) return // cached — Angular initializeUser parity
    let cancelled = false
    void (async () => {
      try {
        const res = await apiFetch('/rectrace/api/user/info')
        const json = (await res.json()) as { loginId: string | null }
        if (cancelled) return
        if (json.loginId && json.loginId.trim() !== '') {
          setLoginId(json.loginId)
          try { localStorage.setItem(STORAGE_KEY, json.loginId) } catch { /* quota/blocked */ }
        }
      } catch { /* unreachable / non-2xx → stay unidentified */ }
    })()
    return () => { cancelled = true }
  }, [loginId])

  return {
    loginId,
    initials: loginId ? userInitials(loginId) : '',
    isIdentified: Boolean(loginId),
  }
}
```

- [ ] **Step 8: Run → PASS.**

- [ ] **Step 9: Commit.** `git add -A && git commit -m "feat(react): add useUserInfo hook + userInitials (Angular user-info parity)"`

---

### Task 3: `useSuggestions`

**Files:**
- Create: `src/search/hooks/useSuggestions.ts`
- Test: `src/search/__tests__/useSuggestions.test.tsx`

- [ ] **Step 1: Failing test** (fake timers for debounce; min-2-chars; error→[]):

```tsx
/* eslint-disable @typescript-eslint/require-await */
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const apiFetchMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/queryClient', () => ({ apiFetch: apiFetchMock, reportRequestFailure: vi.fn() }))
import { useSuggestions } from '@/search/hooks/useSuggestions'

beforeEach(() => { vi.useFakeTimers(); apiFetchMock.mockReset() })
afterEach(() => { vi.useRealTimers() })

describe('useSuggestions', () => {
  test('does not query for terms shorter than 2 chars', () => {
    const { rerender } = renderHook(({ q }) => useSuggestions(q), { initialProps: { q: 'a' } })
    act(() => { vi.advanceTimersByTime(400) })
    expect(apiFetchMock).not.toHaveBeenCalled()
    rerender({ q: '' })
    act(() => { vi.advanceTimersByTime(400) })
    expect(apiFetchMock).not.toHaveBeenCalled()
  })
  test('debounces then queries /api/search/suggest?prefix=', async () => {
    apiFetchMock.mockResolvedValue({ json: async () => ['trade', 'trades'] })
    const { result, rerender } = renderHook(({ q }) => useSuggestions(q), { initialProps: { q: 'tr' } })
    rerender({ q: 'tra' })
    act(() => { vi.advanceTimersByTime(300) })
    await waitFor(() => expect(result.current).toEqual(['trade', 'trades']))
    expect(apiFetchMock).toHaveBeenCalledTimes(1)
    expect(apiFetchMock).toHaveBeenCalledWith('/rectrace/api/search/suggest?prefix=tra')
  })
  test('error → empty array', async () => {
    apiFetchMock.mockRejectedValue(new Error('x'))
    const { result } = renderHook(() => useSuggestions('trade'))
    act(() => { vi.advanceTimersByTime(300) })
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalled())
    expect(result.current).toEqual([])
  })
})
```

- [ ] **Step 2: Run, verify fail.** → FAIL.

- [ ] **Step 3: Implement `useSuggestions.ts`:**

```ts
import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/queryClient'

const DEBOUNCE_MS = 300
const MIN_CHARS = 2

export function useSuggestions(term: string): string[] {
  const [suggestions, setSuggestions] = useState<string[]>([])

  useEffect(() => {
    const q = term.trim()
    if (q.length < MIN_CHARS) { setSuggestions([]); return }
    let cancelled = false
    const handle = setTimeout(() => {
      void (async () => {
        try {
          const res = await apiFetch(`/rectrace/api/search/suggest?prefix=${encodeURIComponent(q)}`)
          const json = (await res.json()) as string[]
          if (!cancelled) setSuggestions(Array.isArray(json) ? json : [])
        } catch { if (!cancelled) setSuggestions([]) }
      })()
    }, DEBOUNCE_MS)
    return () => { cancelled = true; clearTimeout(handle) }
  }, [term])

  return suggestions
}
```

- [ ] **Step 4: Run → PASS.**

- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(react): add useSuggestions typeahead hook"`

---

### Task 4: `deriveSearchResults` (pure)

**Files:**
- Create: `src/search/lib/deriveSearchResults.ts`
- Test: `src/search/__tests__/deriveSearchResults.test.ts`

- [ ] **Step 1: Failing test:**

```ts
import { describe, test, expect } from 'vitest'
import { deriveSearchResults } from '@/search/lib/deriveSearchResults'
import type { InitialSearchResponseV4 } from '@/search/types'

const mk = (key: string, count: number, hasMore = false) => ({ key, label: key, values: [], count, hasMore, columns: [] })

describe('deriveSearchResults', () => {
  test('filters out count===0 and sorts by count desc', () => {
    const resp = { categoryResults: { a: mk('a', 1), b: mk('b', 5), c: mk('c', 0) } } as unknown as InitialSearchResponseV4
    const out = deriveSearchResults(resp)
    expect(out.map(r => r.key)).toEqual(['b', 'a'])
  })
  test('all zero → empty', () => {
    const resp = { categoryResults: { a: mk('a', 0) } } as unknown as InitialSearchResponseV4
    expect(deriveSearchResults(resp)).toEqual([])
  })
})
```

- [ ] **Step 2: Run, verify fail.** → FAIL.

- [ ] **Step 3: Implement:**

```ts
import type { InitialSearchResponseV4, CategoryResultV4 } from '@/search/types'

export function deriveSearchResults(resp: InitialSearchResponseV4): CategoryResultV4[] {
  return Object.values(resp.categoryResults)
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count)
}
```

- [ ] **Step 4: Run → PASS.** **Step 5: Commit** `git commit -am "feat(react): add deriveSearchResults (filter count>0, sort desc)"`

---

## Wave 2 — URL state + route shells

### Task 5: `useSearchState` → `{ q, tab }`

**Files:**
- Modify: `src/search/hooks/useSearchState.ts`
- Modify: `src/search/__tests__/useSearchState.test.tsx` (replace `cat` with `tab`, drop `'fileName'` default)

- [ ] **Step 1: Update the test harness route** in `useSearchState.test.tsx`: change `validateSearch` to `{ q, tab }` (no `cat`). Replace `cat` assertions:

```tsx
// validateSearch:
(s: Record<string, unknown>) => ({
  q: typeof s.q === 'string' ? s.q : undefined,
  tab: typeof s.tab === 'string' ? s.tab : undefined,
})
```

Add/replace test cases:

```tsx
it('reads q and tab from the URL, no default injected', () => {
  const { result } = renderHookInRoute('/search?q=trade&tab=jobName')
  expect(result().q).toBe('trade')
  expect(result().tab).toBe('jobName')
})
it('tab is undefined when absent (no hardcoded default)', () => {
  const { result } = renderHookInRoute('/search?q=trade')
  expect(result().tab).toBeUndefined()
})
it('setTab writes tab with replace (no history growth)', async () => {
  const { result, router } = renderHookInRoute('/search?q=trade')
  await act(async () => { result().setTab('boxName') })
  expect(router.state.location.search).toMatchObject({ q: 'trade', tab: 'boxName' })
})
```

- [ ] **Step 2: Run, verify fail.** `pnpm exec vitest run src/search/__tests__/useSearchState.test.tsx` → FAIL.

- [ ] **Step 3: Rewrite `useSearchState.ts`** — replace `cat` with `tab`, drop the `?? 'fileName'`:

```ts
export function useSearchState(): {
  q: string | undefined
  tab: string | undefined
  setQ: (next: string | undefined) => void
  setTab: (next: string | undefined) => void
  clear: () => void
} {
  const raw = useSearchLoose({ from: '/search' })
  const q = typeof raw.q === 'string' ? raw.q : undefined
  const tab = typeof raw.tab === 'string' ? raw.tab : undefined
  const navigate = useNavigateLoose({ from: '/search' })

  const setQ = useCallback((next: string | undefined) => {
    void navigate({ search: (prev) => { const r = { ...prev }; delete r.q; return next ? { ...r, q: next } : r }, replace: true })
  }, [navigate])

  const setTab = useCallback((next: string | undefined) => {
    void navigate({ search: (prev) => { const r = { ...prev }; delete r.tab; return next ? { ...r, tab: next } : r }, replace: true })
  }, [navigate])

  const clear = useCallback(() => { void navigate({ search: {}, replace: true }) }, [navigate])

  return { q, tab, setQ, setTab, clear }
}
```

- [ ] **Step 4: Run → PASS.** **Step 5: Commit** `git commit -am "refactor(react): useSearchState uses q+tab, drops hardcoded cat default"`

---

### Task 6: `routes/search.tsx` Zod `{ q?, tab? }` + no-`q` guard

**Files:**
- Modify: `src/routes/search.tsx`
- Test: `src/search/__tests__/searchRoute.test.tsx` (new — validateSearch shape)

> Note: changing route files regenerates `src/routeTree.gen.ts` on next `pnpm dev`/`pnpm build`. Run `pnpm typecheck` after to confirm the tree compiles.

- [ ] **Step 1: Failing test** for the schema (import the exported schema):

```tsx
import { describe, test, expect } from 'vitest'
import { searchSchema } from '@/routes/search'
describe('searchSchema', () => {
  test('accepts q and tab', () => expect(searchSchema.parse({ q: 'x', tab: 'jobName' })).toEqual({ q: 'x', tab: 'jobName' }))
  test('no defaults injected when absent', () => expect(searchSchema.parse({})).toEqual({}))
  test('drops unknown cat (no longer in schema)', () => expect(searchSchema.parse({ cat: 'fileName' })).toEqual({}))
})
```

- [ ] **Step 2: Run, verify fail.** → FAIL (`searchSchema` not exported / still has `cat`).

- [ ] **Step 3: Rewrite `routes/search.tsx`:**

```tsx
import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { SearchPage } from '@/search/SearchPage'

export const searchSchema = z.object({
  q: z.string().optional(),
  tab: z.string().optional(),
})

export const Route = createFileRoute('/search')({
  validateSearch: searchSchema,
  beforeLoad: ({ search }) => {
    if (!search.q || !search.q.trim()) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect({ to: '/' })
    }
  },
  component: SearchPage,
})
```

- [ ] **Step 4: Run → PASS.** Then `pnpm typecheck` (regenerates/validates route tree). Expected: PASS (SearchPage may still read old props — fixed in Task 13; if typecheck fails only inside SearchPage, that's expected until then — note it and proceed).

- [ ] **Step 5: Commit** `git commit -am "refactor(react): /search Zod q+tab, redirect to / when no q"`

---

### Task 7: `routes/index.tsx` → hero (remove redirect)

**Files:**
- Modify: `src/routes/index.tsx`

- [ ] **Step 1: Rewrite** (renders the hero; SearchHero created in Task 12 — use a temporary import that Task 12 satisfies). To keep this task self-contained and compiling, create a minimal placeholder hero now and flesh it out in Task 12:

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { SearchHero } from '@/search/SearchHero'

export const Route = createFileRoute('/')({
  component: SearchHero,
})
```

- [ ] **Step 2:** Create a minimal `src/search/SearchHero.tsx` stub so the route compiles (Task 12 replaces the body):

```tsx
export function SearchHero(): React.ReactElement {
  return <div data-testid="search-hero">Rectrace</div>
}
```

- [ ] **Step 3:** `pnpm typecheck` → PASS (index route resolves). **Step 4: Commit** `git commit -am "refactor(react): / renders SearchHero, redirect removed (stub hero)"`

---

## Wave 3 — Grid & tabs

### Task 8: `SearchGrid` — inline columns, drop `useSearchConfig`

**Files:**
- Modify: `src/search/SearchGrid.tsx`
- Modify: `src/search/__tests__/SearchGrid.test.tsx`

- [ ] **Step 1: Rewrite the test** to drive the new prop shape. New contract: `SearchGrid` takes a single `category: CategoryResultV4` + `q`. It derives searchColumn from the rowGroup column and POSTs SSRM to `/ssrm/{category.key}`.

```tsx
/* eslint-disable @typescript-eslint/require-await */
import { describe, test, expect, vi } from 'vitest'
import { _test_buildDatasource } from '@/search/SearchGrid'
import type { CategoryResultV4 } from '@/search/types'

const category: CategoryResultV4 = {
  key: 'fileName', label: 'File Name', count: 3, hasMore: false,
  values: ['trade.csv', 'cash.dat'],
  columns: [
    { field: 'file_name_pattern', headerName: 'File Name', rowGroup: true, hide: true, sortable: true, filter: true, resizable: null, width: null, cellRenderer: null, cellRendererParams: null, cellStyle: null, pinned: null },
    { field: 'app_name', headerName: 'App Name', rowGroup: null, hide: null, sortable: true, filter: true, resizable: null, width: null, cellRenderer: null, cellRendererParams: null, cellStyle: null, pinned: null },
  ],
}

const apiFetchMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/queryClient', () => ({ apiFetch: apiFetchMock, reportRequestFailure: vi.fn() }))

describe('SearchGrid datasource', () => {
  test('POSTs SSRM to the category key with initialFilter column = rowGroup field', async () => {
    apiFetchMock.mockResolvedValue({ json: async () => ({ rows: [], lastRow: 0 }) })
    const ds = _test_buildDatasource('trade', category)
    const success = vi.fn()
    await ds.getRows({ request: { startRow: 0, endRow: 100, rowGroupCols: [], groupKeys: [], sortModel: [], filterModel: {} }, success, fail: vi.fn() } as never)
    const [url, init] = apiFetchMock.mock.calls[0]
    expect(url).toBe('/rectrace/api/v4/search/ssrm/fileName')
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.category).toBe('fileName')
    expect(body.initialFilter).toEqual({ column: 'file_name_pattern', values: ['trade.csv', 'cash.dat'] })
  })
  test('null initialFilter when values empty', async () => {
    apiFetchMock.mockResolvedValue({ json: async () => ({ rows: [], lastRow: 0 }) })
    const ds = _test_buildDatasource('trade', { ...category, values: [] })
    await ds.getRows({ request: { startRow: 0, endRow: 100, rowGroupCols: [], groupKeys: [], sortModel: [], filterModel: {} }, success: vi.fn(), fail: vi.fn() } as never)
    const body = JSON.parse((apiFetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.initialFilter).toBeNull()
  })
})
```

- [ ] **Step 2: Run, verify fail.** → FAIL (signature changed).

- [ ] **Step 3: Rewrite `SearchGrid.tsx`.** Remove `useSearchConfig`/`configCategoryToColDefs` import; use `columnsToColDefs`. New props + datasource signature:

```tsx
import { useMemo, type ReactElement } from 'react'
import { AgGridReact } from 'ag-grid-react'
import type { IServerSideDatasource, ColDef, GridReadyEvent, IServerSideGetRowsParams } from 'ag-grid-community'
import { apiFetch, reportRequestFailure } from '@/lib/queryClient'
import { columnsToColDefs } from '@/search/lib/configToColDefs'
import { cellRenderers } from '@/search/renderers/registry'
import type { CategoryResultV4, SSRMRequestV4, InitialFilter } from '@/search/types'

export interface SearchGridProps {
  q: string
  category: CategoryResultV4
  onGridReady?: (e: GridReadyEvent) => void
  onModelUpdated?: (rowCount: number) => void
}

function searchColumnFor(category: CategoryResultV4): string {
  // Angular search-v5-grid.component.ts:330 — the rowGroup column IS the ES search
  // column. If no rowGroup column exists, return '' so buildInitialFilter yields a
  // null filter (never a bogus column name like the category key — defense-in-depth).
  return category.columns.find((c) => c.rowGroup)?.field ?? ''
}

function buildInitialFilter(category: CategoryResultV4): InitialFilter | null {
  const column = searchColumnFor(category)
  if (category.values.length === 0 || !column) return null
  return { column, values: category.values }
}

// eslint-disable-next-line react-refresh/only-export-components
export function _test_buildDatasource(q: string, category: CategoryResultV4): IServerSideDatasource {
  void q
  const controller = new AbortController()
  return {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    getRows: async (params: IServerSideGetRowsParams) => {
      try {
        const body: SSRMRequestV4 = {
          category: category.key,
          initialFilter: buildInitialFilter(category),
          rowGroupCols: (params.request.rowGroupCols ?? []).map((c) => c.field ?? ''),
          groupKeys: params.request.groupKeys ?? [],
          sortModel: params.request.sortModel ?? [],
          filterModel: (params.request.filterModel ?? {}) as Record<string, unknown>,
          startRow: params.request.startRow ?? 0,
          endRow: params.request.endRow ?? 100,
          visibleColumns: [],
        }
        const res = await apiFetch(`/rectrace/api/v4/search/ssrm/${category.key}`, {
          method: 'POST', body: JSON.stringify(body), signal: controller.signal,
        })
        const data = (await res.json()) as { rows: Record<string, unknown>[]; lastRow: number }
        params.success({ rowData: data.rows, rowCount: data.lastRow })
      } catch (err) {
        if ((err as { name?: string }).name !== 'AbortError') {
          setTimeout(() => reportRequestFailure(err), 0)
          params.fail()
        }
      }
    },
    destroy: () => controller.abort(),
  }
}

export function SearchGrid({ q, category, onGridReady, onModelUpdated }: SearchGridProps): ReactElement {
  const columnDefs = useMemo<ColDef[]>(() => columnsToColDefs(category.columns), [category])
  const datasource = useMemo<IServerSideDatasource>(() => _test_buildDatasource(q, category), [q, category])
  return (
    <div className="ag-theme-quartz h-[calc(100vh-var(--header-height,2.5rem)-40px-40px-2.5rem)]">
      <AgGridReact
        key={`${q}-${category.key}`}
        rowModelType="serverSide"
        serverSideDatasource={datasource}
        columnDefs={columnDefs}
        components={cellRenderers}
        sideBar={{ toolPanels: ['columns', 'filters'] }}
        cacheBlockSize={100}
        maxBlocksInCache={10}
        autoSizeStrategy={{ type: 'fitCellContents' }}
        onGridReady={onGridReady}
        onModelUpdated={(e) => onModelUpdated?.(e.api.getDisplayedRowCount())}
      />
    </div>
  )
}
```

- [ ] **Step 4: Run → PASS.** **Step 5: Commit** `git commit -am "refactor(react): SearchGrid uses inline columns + rowGroup-derived search column"`

---

### Task 9: `CategoryTabBar` — multi-tab

**Files:**
- Modify: `src/search/CategoryTabBar.tsx`
- Modify: `src/search/__tests__/CategoryTabBar.test.tsx`

- [ ] **Step 1: Rewrite the test** for the multi-tab contract:

```tsx
import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CategoryTabBar } from '@/search/CategoryTabBar'
import type { CategoryResultV4 } from '@/search/types'

const cats = [
  { key: 'fileName', label: 'File Name', count: 3, hasMore: false, values: [], columns: [] },
  { key: 'jobName', label: 'Job Name', count: 1000, hasMore: true, values: [], columns: [] },
] as CategoryResultV4[]

describe('CategoryTabBar', () => {
  test('renders one tab per category with "Label (N)" / "(N+)" labels', () => {
    render(<CategoryTabBar categories={cats} activeKey="fileName" onSelect={vi.fn()} />)
    expect(screen.getByText('File Name (3)')).toBeInTheDocument()
    expect(screen.getByText('Job Name (1000+)')).toBeInTheDocument()
  })
  test('active tab carries the primary border indicator', () => {
    render(<CategoryTabBar categories={cats} activeKey="jobName" onSelect={vi.fn()} />)
    const active = screen.getByText('Job Name (1000+)')
    expect(active.className).toMatch(/border-primary/)
    expect(active.className).toMatch(/border-b-2/)
  })
  test('clicking a tab calls onSelect with its key', () => {
    const onSelect = vi.fn()
    render(<CategoryTabBar categories={cats} activeKey="fileName" onSelect={onSelect} />)
    fireEvent.click(screen.getByText('Job Name (1000+)'))
    expect(onSelect).toHaveBeenCalledWith('jobName')
  })
  test('renders exactly N tabs', () => {
    const { container } = render(<CategoryTabBar categories={cats} activeKey="fileName" onSelect={vi.fn()} />)
    expect(container.querySelectorAll('[data-tab-key]').length).toBe(2)
  })
})
```

- [ ] **Step 2: Run, verify fail.** → FAIL.

- [ ] **Step 3: Rewrite `CategoryTabBar.tsx`** (no hardcoded labels):

```tsx
import type { CategoryResultV4 } from '@/search/types'

export interface CategoryTabBarProps {
  categories: CategoryResultV4[]
  activeKey: string
  onSelect: (key: string) => void
}

function tabLabel(c: CategoryResultV4): string {
  return `${c.label} (${c.count}${c.hasMore ? '+' : ''})`
}

export function CategoryTabBar({ categories, activeKey, onSelect }: CategoryTabBarProps) {
  return (
    <div className="flex items-center gap-0 border-b px-4 h-10 bg-muted/50 backdrop-blur-sm overflow-x-auto">
      {categories.map((c) => {
        const active = c.key === activeKey
        return (
          <button
            key={c.key}
            type="button"
            data-tab-key={c.key}
            data-active={active}
            onClick={() => onSelect(c.key)}
            className={`px-4 h-10 flex items-center text-xs font-semibold whitespace-nowrap border-b-2 ${active ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {tabLabel(c)}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Run → PASS.** **Step 5: Commit** `git commit -am "refactor(react): CategoryTabBar renders data-driven multi-tabs with counts"`

---

### Task 10: Delete `useSearchConfig`

> **SEQUENCING (verified fix):** EXECUTE THIS TASK **AFTER Task 15**. `SearchPage.tsx`
> does not import `useSearchConfig` (only `SearchGrid` did, removed in Task 8), but
> `SearchPage.test.tsx` still does `vi.mock('@/search/hooks/useSearchConfig', …)`
> until Task 15 rewrites it. Deleting the module before Task 15 makes that mock's
> path unresolvable and the test suite errors on import. Run this only once Task 15
> has dropped the mock.

**Files:**
- Delete: `src/search/hooks/useSearchConfig.ts`, `src/search/__tests__/useSearchConfig.test.ts`

- [ ] **Step 1:** Confirm no remaining importers: `grep -rn "useSearchConfig" src/` → after Task 15 this returns only the two files being deleted. If anything else matches, fix it first.
- [ ] **Step 2:** `git rm src/search/hooks/useSearchConfig.ts src/search/__tests__/useSearchConfig.test.ts`
- [ ] **Step 3:** `pnpm exec vitest run src/search` → PASS (no references remain).
- [ ] **Step 4: Commit** `git commit -m "chore(react): delete useSearchConfig (/config no longer used)"`

---

## Wave 4 — Search input dropdown

### Task 11: `SearchSuggestDropdown`

**Files:**
- Create: `src/search/SearchSuggestDropdown.tsx`
- Test: `src/search/__tests__/SearchSuggestDropdown.test.tsx`

- [ ] **Step 1: Failing test** — recents when empty, suggestions when typing:

```tsx
import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SearchSuggestDropdown } from '@/search/SearchSuggestDropdown'

describe('SearchSuggestDropdown', () => {
  test('shows recents when value is empty', () => {
    render(<SearchSuggestDropdown value="" recents={['trade', 'cash']} suggestions={[]} onPick={vi.fn()} onClearRecents={vi.fn()} />)
    expect(screen.getByText('Recent')).toBeInTheDocument()
    expect(screen.getByText('trade')).toBeInTheDocument()
  })
  test('shows live suggestions when typing (>=2 chars)', () => {
    render(<SearchSuggestDropdown value="tr" recents={['x']} suggestions={['trade', 'trades']} onPick={vi.fn()} onClearRecents={vi.fn()} />)
    expect(screen.queryByText('Recent')).not.toBeInTheDocument()
    expect(screen.getByText('trades')).toBeInTheDocument()
  })
  test('picking an item calls onPick with the term', () => {
    const onPick = vi.fn()
    render(<SearchSuggestDropdown value="" recents={['trade']} suggestions={[]} onPick={onPick} onClearRecents={vi.fn()} />)
    fireEvent.click(screen.getByText('trade'))
    expect(onPick).toHaveBeenCalledWith('trade')
  })
})
```

- [ ] **Step 2: Run, verify fail.** → FAIL.

- [ ] **Step 3: Implement `SearchSuggestDropdown.tsx`** (presentational; uses shadcn `Command`/`CommandItem`/`Separator`, `ClockIcon`/`SearchIcon`). It owns no open-state — the parent (`SearchBar`) controls visibility via the Popover.

```tsx
import { ClockIcon, SearchIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandItem, CommandList } from '@/components/ui/command'
import { Separator } from '@/components/ui/separator'

export interface SearchSuggestDropdownProps {
  value: string
  recents: string[]
  suggestions: string[]
  onPick: (term: string) => void
  onClearRecents: () => void
}

export function SearchSuggestDropdown({ value, recents, suggestions, onPick, onClearRecents }: SearchSuggestDropdownProps) {
  const typing = value.trim().length >= 2
  if (typing) {
    return (
      <Command>
        <CommandList className="max-h-[320px]">
          {suggestions.length === 0
            ? <CommandEmpty>No suggestions</CommandEmpty>
            : suggestions.map((s) => (
                <CommandItem key={s} value={s} onSelect={() => onPick(s)}>
                  <SearchIcon className="size-3.5 mr-2 text-muted-foreground" />{s}
                </CommandItem>
              ))}
        </CommandList>
      </Command>
    )
  }
  return (
    <>
      <div className="flex items-center justify-between px-2 py-1.5">
        <span className="text-xs font-semibold text-muted-foreground">Recent</span>
        {recents.length > 0 && (
          <Button type="button" size="xs" variant="ghost" className="text-muted-foreground" onClick={onClearRecents}>Clear</Button>
        )}
      </div>
      <Separator />
      <Command>
        <CommandList className="max-h-[320px]">
          {recents.length === 0
            ? <CommandEmpty>No recent searches</CommandEmpty>
            : recents.map((t) => (
                <CommandItem key={t} value={t} onSelect={() => onPick(t)}>
                  <ClockIcon className="size-3.5 mr-2 text-muted-foreground" />{t}
                </CommandItem>
              ))}
        </CommandList>
      </Command>
    </>
  )
}
```

- [ ] **Step 4: Run → PASS.** **Step 5: Commit** `git commit -am "feat(react): SearchSuggestDropdown (recents + live suggestions, one state)"`

---

### Task 12: `SearchBar` — thin input delegating dropdown

**Files:**
- Modify: `src/search/SearchBar.tsx`
- Modify: `src/search/__tests__/SearchBar.test.tsx` (if present; else create)

- [ ] **Step 1: Failing/updated test** — SearchBar now takes a `suggestions` prop and renders `SearchSuggestDropdown` inside its popover; submit/clear behavior unchanged:

```tsx
import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SearchBar } from '@/search/SearchBar'

vi.mock('@/search/hooks/useRecentSearches', () => ({ useRecentSearches: () => ({ recents: ['trade'], clear: vi.fn() }) }))

describe('SearchBar', () => {
  test('Enter submits trimmed non-empty value', () => {
    const onSubmit = vi.fn()
    render(<SearchBar value="  trade " onChange={vi.fn()} onSubmit={onSubmit} onClear={vi.fn()} suggestions={[]} />)
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledWith('trade')
  })
  test('Search button submits', () => {
    const onSubmit = vi.fn()
    render(<SearchBar value="cash" onChange={vi.fn()} onSubmit={onSubmit} onClear={vi.fn()} suggestions={[]} />)
    fireEvent.click(screen.getByText('Search'))
    expect(onSubmit).toHaveBeenCalledWith('cash')
  })
})
```

- [ ] **Step 2: Run, verify fail.** → FAIL (no `suggestions` prop).

- [ ] **Step 3: Rewrite `SearchBar.tsx`** — keep the Popover + focus/blur/typing open-state logic, but render `<SearchSuggestDropdown>` for the content and accept a `suggestions` prop. Open when focused AND (recents exist OR suggestions exist OR typing). Body:

```tsx
import { useRef, useState } from 'react'
import { XIcon, SearchIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useRecentSearches } from '@/search/hooks/useRecentSearches'
import { SearchSuggestDropdown } from '@/search/SearchSuggestDropdown'

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

  const submit = () => { const t = value.trim(); if (t) onSubmit(t) }

  return (
    <div className="flex items-center gap-2">
      <Popover open={isOpen && hasContent} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <div className="relative flex-1">
            <Input
              className="h-9 pr-8" placeholder={placeholder} value={value}
              onChange={(e) => { onChange(e.target.value); setIsOpen(true) }}
              onFocus={() => setIsOpen(true)}
              onBlur={() => { if (blurTimer.current) clearTimeout(blurTimer.current); blurTimer.current = setTimeout(() => setIsOpen(false), 150) }}
              onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
            />
            {value !== '' && (
              <Button type="button" size="icon-xs" variant="ghost" aria-label="Clear search"
                className="absolute right-1 top-1/2 -translate-y-1/2" onClick={onClear}>
                <XIcon className="size-3.5" />
              </Button>
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start" sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}>
          <SearchSuggestDropdown
            value={value} recents={recents} suggestions={suggestions}
            onPick={(t) => { setIsOpen(false); onSubmit(t) }}
            onClearRecents={() => { clearRecents(); setIsOpen(false) }}
          />
        </PopoverContent>
      </Popover>
      <Button type="button" size="sm" variant="default" onClick={submit}>
        <SearchIcon className="size-4 mr-1" />Search
      </Button>
    </div>
  )
}
```

- [ ] **Step 4: Run → PASS.** **Step 5: Commit** `git commit -am "refactor(react): SearchBar delegates to SearchSuggestDropdown, accepts suggestions"`

---

## Wave 5 — App-shell pieces, hero, results page

### Task 13: `BrandLogo` + `UserChip` + logo assets

**Files:**
- Create: `src/components/app-shell/BrandLogo.tsx`, `src/components/app-shell/UserChip.tsx`
- Test: `src/components/app-shell/__tests__/UserChip.test.tsx`
- Assets: copy `frontend/rectrace/src/assets/Rectrace.png` → `frontend-react/public/rectrace.png`; `rectrace-dark.png` → `frontend-react/public/rectrace-dark.png`

- [ ] **Step 1: Copy assets.**

```bash
cp ../frontend/rectrace/src/assets/Rectrace.png public/rectrace.png
cp ../frontend/rectrace/src/assets/rectrace-dark.png public/rectrace-dark.png
```

(Run from `frontend-react/`. Adjust relative path if needed — the source repo root is one level up.)

- [ ] **Step 2: Failing test for `UserChip`:**

```tsx
import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UserChip } from '@/components/app-shell/UserChip'

describe('UserChip', () => {
  test('shows initials when identified', () => {
    render(<UserChip loginId="john.doe" initials="JD" isIdentified />)
    expect(screen.getByText('JD')).toBeInTheDocument()
  })
  test('shows Sign in when not identified', () => {
    render(<UserChip loginId={null} initials="" isIdentified={false} />)
    expect(screen.getByText('Sign in')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run, verify fail.** → FAIL.

- [ ] **Step 4: Implement `UserChip.tsx`:**

```tsx
import { Button } from '@/components/ui/button'

export interface UserChipProps {
  loginId: string | null
  initials: string
  isIdentified: boolean
}

export function UserChip({ loginId, initials, isIdentified }: UserChipProps) {
  if (!isIdentified) {
    return <Button type="button" size="sm" variant="outline">Sign in</Button>
  }
  return (
    <div
      title={loginId ?? undefined}
      className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
    >
      {initials}
    </div>
  )
}
```

- [ ] **Step 5: Implement `BrandLogo.tsx`** (theme-aware; no test needed — trivial presentational, covered by E2E):

```tsx
import { useTheme } from '@/components/layout/theme-provider'

export function BrandLogo({ className }: { className?: string }) {
  const { resolvedTheme } = useTheme()
  const src = resolvedTheme === 'dark' ? '/rectrace-dark.png' : '/rectrace.png'
  return <img src={src} alt="Rectrace" className={className} />
}
```

- [ ] **Step 6: Run → PASS.** **Step 7: Commit** `git commit -am "feat(react): BrandLogo (theme-aware) + UserChip + ported logo assets"`

---

### Task 14: `heroContent` constants + `SearchHero`

**Files:**
- Create: `src/search/lib/heroContent.ts`
- Replace: `src/search/SearchHero.tsx` (the stub from Task 7)
- Test: `src/search/__tests__/SearchHero.test.tsx`

- [ ] **Step 1: Create `heroContent.ts`** (declared cosmetic copy — see spec "Accepted exceptions"):

```ts
export const PLACEHOLDER_PHRASES = [
  'job name', 'set ID', 'recon name', 'machine name', 'box name',
  'file name', 'run calendar', 'exclude calendar', 'sub account',
]

export const TRY_EXAMPLES = [
  'reconour', 'gpdw', 'flexcube', 'nyk.cash', 'sbn.cash',
  'House', 'EUREX', 'citicorp', 'HMC', 'us_holiday',
]
```

- [ ] **Step 2: Failing test for `SearchHero`** (submit navigates to `/search?q=`). Mount in a router harness with both `/` and `/search` routes:

```tsx
/* eslint-disable @typescript-eslint/require-await */
import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { RouterProvider, createRootRoute, createRoute, createRouter, createMemoryHistory, Outlet } from '@tanstack/react-router'
import { SearchHero } from '@/search/SearchHero'

vi.mock('@/search/hooks/useRecentSearches', () => ({ useRecentSearches: () => ({ recents: [], clear: vi.fn(), push: vi.fn() }) }))
vi.mock('@/search/hooks/useSuggestions', () => ({ useSuggestions: () => [] }))
vi.mock('@/search/hooks/useUserInfo', () => ({ useUserInfo: () => ({ loginId: null, initials: '', isIdentified: false }) }))
vi.mock('@/components/app-shell/BrandLogo', () => ({ BrandLogo: () => null }))

function renderHero() {
  const root = createRootRoute({ component: () => <Outlet /> })
  const index = createRoute({ getParentRoute: () => root, path: '/', component: SearchHero })
  const search = createRoute({ getParentRoute: () => root, path: '/search', validateSearch: (s: Record<string, unknown>) => ({ q: typeof s.q === 'string' ? s.q : undefined }), component: () => <div>RESULTS</div> })
  const router = createRouter({ routeTree: root.addChildren([index, search]), history: createMemoryHistory({ initialEntries: ['/'] }) })
  render(<RouterProvider router={router} />)
  return router
}

describe('SearchHero', () => {
  test('typing + Search navigates to /search?q=term', async () => {
    const router = renderHero()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'trade' } })
    fireEvent.click(screen.getByText('Search'))
    await waitFor(() => expect(router.state.location.pathname).toBe('/search'))
    expect(router.state.location.search).toMatchObject({ q: 'trade' })
  })
})
```

- [ ] **Step 3: Run, verify fail.** → FAIL (stub hero has no input).

- [ ] **Step 4: Implement `SearchHero.tsx`.** Centered layout; reuses `SearchBar` (with suggestions wired); animated placeholder via a small interval + CSS fade honoring `prefers-reduced-motion`; Try button; UserChip top-right.

```tsx
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { SearchBar } from '@/search/SearchBar'
import { BrandLogo } from '@/components/app-shell/BrandLogo'
import { UserChip } from '@/components/app-shell/UserChip'
import { ThemeSwitch } from '@/components/layout/theme-switch'
import { Button } from '@/components/ui/button'
import { useSuggestions } from '@/search/hooks/useSuggestions'
import { useUserInfo } from '@/search/hooks/useUserInfo'
import { PLACEHOLDER_PHRASES, TRY_EXAMPLES } from '@/search/lib/heroContent'

export function SearchHero(): React.ReactElement {
  const navigate = useNavigate()
  const user = useUserInfo()
  const [value, setValue] = useState('')
  const suggestions = useSuggestions(value)
  const [phraseIdx, setPhraseIdx] = useState(0)
  const prefersReduced = useRef(false)

  useEffect(() => {
    prefersReduced.current = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    if (prefersReduced.current) return
    const id = setInterval(() => setPhraseIdx((i) => (i + 1) % PLACEHOLDER_PHRASES.length), 2200)
    return () => clearInterval(id)
  }, [])

  const submit = (term: string) => {
    const t = term.trim()
    if (t) void navigate({ to: '/search', search: { q: t } })
  }
  const tryRandom = () => submit(TRY_EXAMPLES[Math.floor(Math.random() * TRY_EXAMPLES.length)])

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-end gap-2 px-4 py-2">
        <ThemeSwitch />
        <UserChip {...user} />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 -mt-16">
        <BrandLogo className="h-12 w-auto" />
        <div className="w-full max-w-xl">
          <SearchBar
            value={value} onChange={setValue} onSubmit={submit} onClear={() => setValue('')}
            suggestions={suggestions}
            placeholder={`Search by ${PLACEHOLDER_PHRASES[phraseIdx]}…`}
          />
          <div className="mt-3 flex justify-center">
            <Button type="button" variant="ghost" size="sm" onClick={tryRandom}>
              Try an example
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
```

> Placeholder animation note: the `placeholder` text changes every 2.2s; the SearchBar `Input` re-renders with the new phrase. The CSS fade is applied via a Tailwind `transition` on the input's placeholder is not directly stylable, so the "modern" treatment is the smooth phrase rotation (no abrupt layout shift) + reduced-motion guard. A richer animated-label treatment is deferred to the polish pass (spec §L).

- [ ] **Step 5: Run → PASS.** **Step 6: Commit** `git commit -am "feat(react): SearchHero centered page with animated placeholder + Try + user chip"`

---

### Task 15: `SearchPage` results view rewrite

**Files:**
- Modify: `src/search/SearchPage.tsx`
- Modify: `src/search/__tests__/SearchPage.test.tsx`

- [ ] **Step 1: Rewrite the SearchPage test.** Drop the `useSearchConfig` mock. Mock `SearchGrid` to a stub that records the `category` prop it receives, so we can assert tab-switch wiring. Key assertions: (a) fetches `/initial`, (b) renders a tab per `count>0` category, (c) clicking a tab updates the URL `tab` and re-renders the grid for the new category, (d) no-results state when all zero.

```tsx
/* eslint-disable @typescript-eslint/require-await, react-hooks/exhaustive-deps */
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { RouterProvider, createRootRoute, createRoute, createRouter, createMemoryHistory, Outlet } from '@tanstack/react-router'
import { SearchPage } from '@/search/SearchPage'

const apiFetchMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/queryClient', () => ({ apiFetch: apiFetchMock, reportRequestFailure: vi.fn() }))
vi.mock('@/search/hooks/useRecentSearches', () => ({ useRecentSearches: () => ({ recents: [], push: vi.fn(), clear: vi.fn() }) }))
vi.mock('@/search/hooks/useSuggestions', () => ({ useSuggestions: () => [] }))
vi.mock('@/search/hooks/useUserInfo', () => ({ useUserInfo: () => ({ loginId: null, initials: '', isIdentified: false }) }))
vi.mock('@/components/layout/theme-switch', () => ({ ThemeSwitch: () => null }))
vi.mock('@/components/app-shell/footer', () => ({ Footer: () => null }))
vi.mock('@/components/app-shell/BrandLogo', () => ({ BrandLogo: () => null }))

const gridCategoryKeys: string[] = []
vi.mock('@/search/SearchGrid', () => ({
  SearchGrid: ({ category }: { category: { key: string } }) => { gridCategoryKeys.push(category.key); return <div data-testid="grid">{category.key}</div> },
}))

function mk(key: string, label: string, count: number, hasMore = false) {
  return { key, label, count, hasMore, values: ['v'], columns: [] }
}
function respWith(...cats: ReturnType<typeof mk>[]) {
  return { categoryResults: Object.fromEntries(cats.map((c) => [c.key, c])), searchTerm: 'trade', timestamp: 0 }
}

function renderAt(url: string) {
  const root = createRootRoute({ component: () => <Outlet /> })
  const search = createRoute({
    getParentRoute: () => root, path: '/search',
    validateSearch: (s: Record<string, unknown>) => ({ q: typeof s.q === 'string' ? s.q : undefined, tab: typeof s.tab === 'string' ? s.tab : undefined }),
    component: SearchPage,
  })
  const index = createRoute({ getParentRoute: () => root, path: '/', component: () => <div>HERO</div> })
  const router = createRouter({ routeTree: root.addChildren([index, search]), history: createMemoryHistory({ initialEntries: [url] }) })
  render(<RouterProvider router={router} />)
  return router
}

beforeEach(() => { apiFetchMock.mockReset(); gridCategoryKeys.length = 0 })

describe('SearchPage results', () => {
  test('fetches /initial and renders a tab per count>0 category, sorted desc', async () => {
    apiFetchMock.mockResolvedValue({ json: async () => respWith(mk('fileName', 'File Name', 3), mk('jobName', 'Job Name', 10), mk('setId', 'Set ID', 0)) })
    renderAt('/search?q=trade')
    await waitFor(() => expect(screen.getByText('Job Name (10)')).toBeInTheDocument())
    expect(screen.getByText('File Name (3)')).toBeInTheDocument()
    expect(screen.queryByText(/Set ID/)).not.toBeInTheDocument()
    // highest-count tab active first → its grid mounted
    await waitFor(() => expect(gridCategoryKeys.at(-1)).toBe('jobName'))
  })

  test('clicking a tab updates URL tab and mounts that category grid', async () => {
    apiFetchMock.mockResolvedValue({ json: async () => respWith(mk('jobName', 'Job Name', 10), mk('fileName', 'File Name', 3)) })
    const router = renderAt('/search?q=trade')
    await waitFor(() => expect(screen.getByText('File Name (3)')).toBeInTheDocument())
    fireEvent.click(screen.getByText('File Name (3)'))
    await waitFor(() => expect(router.state.location.search).toMatchObject({ q: 'trade', tab: 'fileName' }))
    await waitFor(() => expect(gridCategoryKeys.at(-1)).toBe('fileName'))
  })

  test('no-results state when all categories are empty', async () => {
    apiFetchMock.mockResolvedValue({ json: async () => respWith(mk('fileName', 'File Name', 0)) })
    renderAt('/search?q=zzz')
    await waitFor(() => expect(screen.getByText(/No results found/i)).toBeInTheDocument())
    expect(screen.queryByTestId('grid')).not.toBeInTheDocument()
  })

  test('deep-link tab selects that category when valid', async () => {
    apiFetchMock.mockResolvedValue({ json: async () => respWith(mk('jobName', 'Job Name', 10), mk('fileName', 'File Name', 3)) })
    renderAt('/search?q=trade&tab=fileName')
    await waitFor(() => expect(gridCategoryKeys.at(-1)).toBe('fileName'))
  })
})
```

- [ ] **Step 2: Run, verify fail.** → FAIL.

- [ ] **Step 3: Rewrite `SearchPage.tsx`.** Reads `q`,`tab` via `useSearch({ from: '/search' })`; fetches `/initial` on `q` change; derives `searchResults`; computes active category; syncs `tab` to URL; renders navbar + `CategoryTabBar` + `SearchToolbar` + active `SearchGrid` + Footer; no-results + error + loading states.

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import type { GridApi, GridReadyEvent } from 'ag-grid-community'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Footer } from '@/components/app-shell/footer'
import { ThemeSwitch } from '@/components/layout/theme-switch'
import { BrandLogo } from '@/components/app-shell/BrandLogo'
import { UserChip } from '@/components/app-shell/UserChip'
import { CategoryTabBar } from '@/search/CategoryTabBar'
import { SearchBar } from '@/search/SearchBar'
import { SearchGrid } from '@/search/SearchGrid'
import { SearchToolbar } from '@/search/SearchToolbar'
import { useRecentSearches } from '@/search/hooks/useRecentSearches'
import { useSuggestions } from '@/search/hooks/useSuggestions'
import { useUserInfo } from '@/search/hooks/useUserInfo'
import { buildExportFilename } from '@/search/lib/buildExportFilename'
import { deriveSearchResults } from '@/search/lib/deriveSearchResults'
import { InitialSearchResponseV4Schema } from '@/search/types'
import type { CategoryResultV4 } from '@/search/types'
import { apiFetch, reportRequestFailure } from '@/lib/queryClient'

export function SearchPage(): React.ReactElement {
  const { q, tab } = useSearch({ from: '/search' }) as { q?: string; tab?: string }
  const navigate = useNavigate({ from: '/search' })
  const user = useUserInfo()
  const { push: pushRecent } = useRecentSearches()

  const [inputValue, setInputValue] = useState<string>(q ?? '')
  const suggestions = useSuggestions(inputValue)
  const [results, setResults] = useState<CategoryResultV4[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<{ correlationId?: string } | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [resultCount, setResultCount] = useState<number | null>(null)
  const gridApiRef = useRef<GridApi | null>(null)

  const runSearch = useCallback(async (term: string) => {
    const trimmed = term.trim()
    if (!trimmed) return
    setIsLoading(true); setError(null); setResultCount(null)
    try {
      const res = await apiFetch(`/rectrace/api/v4/search/initial?keyword=${encodeURIComponent(trimmed)}`)
      const parsed = InitialSearchResponseV4Schema.parse(await res.json())
      setResults(deriveSearchResults(parsed))
      pushRecent(trimmed)
    } catch (err) {
      setError({ correlationId: (err as { correlationId?: string }).correlationId })
      setResults([])
      reportRequestFailure(err)
    } finally { setIsLoading(false) }
  }, [pushRecent])

  // Deep-link + URL-driven q: run search when q changes.
  useEffect(() => {
    if (q && q.trim()) { setInputValue(q); void runSearch(q) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const activeCategory = useMemo<CategoryResultV4 | undefined>(() => {
    if (results.length === 0) return undefined
    return results.find((r) => r.key === tab) ?? results[0]
  }, [results, tab])

  // Sync URL tab to the active category once results resolve (Angular parity).
  useEffect(() => {
    if (results.length === 0) return
    const valid = tab && results.some((r) => r.key === tab)
    if (!valid && activeCategory) {
      void navigate({ search: (prev: Record<string, unknown>) => ({ ...prev, tab: activeCategory.key }), replace: true })
    }
  }, [results, tab, activeCategory, navigate])

  const handleSubmit = useCallback((term: string) => {
    const t = term.trim()
    if (t) void navigate({ search: { q: t }, replace: true })
  }, [navigate])

  const handleClear = useCallback(() => {
    setInputValue(''); setResults([]); setResultCount(null); setError(null)
    void navigate({ to: '/' })
  }, [navigate])

  const handleSelectTab = useCallback((key: string) => {
    void navigate({ search: (prev: Record<string, unknown>) => ({ ...prev, tab: key }), replace: true })
  }, [navigate])

  const handleExport = useCallback(() => {
    const api = gridApiRef.current
    if (!api || !activeCategory) return
    setIsExporting(true)
    try {
      const cols = api.getColumns()
      const columnKeys = cols ? cols.filter((c) => c.getColId() !== 'execution_order').map((c) => c.getColId()) : undefined
      api.exportDataAsExcel({ fileName: buildExportFilename(activeCategory.key, q ?? ''), columnKeys })
    } catch (err) { reportRequestFailure(err) } finally { setIsExporting(false) }
  }, [activeCategory, q])

  return (
    <div className="flex flex-col min-h-screen">
      <header className="bg-background/40 sticky top-0 z-50 flex items-center justify-between gap-3 px-4 border-b backdrop-blur-md" style={{ height: 'var(--header-height, 2.5rem)' }}>
        <BrandLogo className="h-5 w-auto" />
        <div className="flex-1">
          <SearchBar value={inputValue} onChange={setInputValue} onSubmit={handleSubmit} onClear={handleClear} suggestions={suggestions} placeholder="Search…" />
        </div>
        <ThemeSwitch />
        <UserChip {...user} />
      </header>

      {isLoading ? (
        <div role="status" aria-label="Loading results..." className="flex flex-col gap-2 p-4">
          <Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" />
        </div>
      ) : error ? (
        <ErrorStateCard correlationId={error.correlationId} onRetry={() => q && void runSearch(q)} />
      ) : results.length === 0 ? (
        <NoResultsState term={q ?? ''} />
      ) : (
        <>
          <CategoryTabBar categories={results} activeKey={activeCategory?.key ?? results[0].key} onSelect={handleSelectTab} />
          <SearchToolbar resultCount={resultCount} onExport={handleExport} isExporting={isExporting} />
          <main className="flex-1 overflow-hidden">
            {activeCategory && (
              <SearchGrid
                q={q ?? ''}
                category={activeCategory}
                onGridReady={(e: GridReadyEvent) => { gridApiRef.current = e.api }}
                onModelUpdated={setResultCount}
              />
            )}
          </main>
        </>
      )}
      <Footer />
    </div>
  )
}

function NoResultsState({ term }: { term: string }): React.ReactElement {
  return (
    <div className="flex h-full flex-1 items-center justify-center p-8">
      <Card className="max-w-md">
        <CardHeader><CardTitle>No results found</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          No results found for &ldquo;<strong>{term}</strong>&rdquo;. Try a different term.
        </CardContent>
      </Card>
    </div>
  )
}

interface ErrorStateCardProps { correlationId?: string; onRetry: () => void }
function ErrorStateCard({ correlationId, onRetry }: ErrorStateCardProps): React.ReactElement {
  return (
    <div className="flex h-full flex-1 items-center justify-center p-8">
      <Card className="max-w-md">
        <CardHeader><CardTitle>Search unavailable</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
          <p>Failed to load results. {correlationId ? <>Error reference: <code className="font-mono">{correlationId}</code> — quote this when reporting an issue.</> : 'Check the browser console for details.'}</p>
          <div><Button type="button" variant="default" size="sm" onClick={onRetry}>Try again</Button></div>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: Run → PASS.** `pnpm exec vitest run src/search/__tests__/SearchPage.test.tsx`.

- [ ] **Step 5: Commit** `git commit -am "feat(react): SearchPage multi-category results view (tabs + per-tab SSRM grid)"`

---

## Wave 6 — Integration, gates, E2E

### Task 16: Full gate — typecheck, lint, test

- [ ] **Step 1:** `pnpm typecheck` → PASS. Fix any residual references (e.g. stale `cat`/`useSearchConfig` imports). The TanStack route tree regenerates; if `routeTree.gen.ts` is stale, run `pnpm dev` once (it regenerates on boot) or `pnpm build`.
- [ ] **Step 2:** `pnpm lint` → PASS (hex-rejection rule: ensure no raw hex; use tokens). Fix violations.
- [ ] **Step 3:** `pnpm test` → all PASS.
- [ ] **Step 4: Commit** any fixes: `git commit -am "chore(react): typecheck/lint/test gate green for search rebuild"`

### Task 17: Playwright E2E verification (against running stack)

> Backend (6088), React (5173), Oracle + ES must be up. Drive the real app; do not mock.

- [ ] **Step 1: Hero loads at `/` with a clean URL** — navigate to `http://localhost:5173/`, confirm URL stays `/` (no redirect, no `?cat=`), the centered search input + logo render.
- [ ] **Step 2: Search shows multi-category tabs** — type `trade`, submit; URL becomes `/search?q=trade&tab=<key>`; assert ≥2 tabs render with `Label (N)` counts; the highest-count tab is active and its grid shows rows.
- [ ] **Step 3: Tab switch remounts grid + fires SSRM** — click a different tab; URL `tab` updates; capture network: a `POST /rectrace/api/v4/search/ssrm/<newKey>` fires and rows for the new category render. This is the §D correctness gate.
- [ ] **Step 4: Deep-link restore** — open `http://localhost:5173/search?q=trade&tab=boxName` directly; assert the search runs and `boxName` tab is active.
- [ ] **Step 5: No-results** — search a nonsense term (e.g. `zzzqzzq`); assert the "No results found" card, no tabs.
- [ ] **Step 6: User chip** — assert the "Sign in" affordance renders (local dev → no portal header).
- [ ] **Step 7: Theme toggle** — toggle theme; assert logo swaps and persists across reload (localStorage `rectrace-theme`).
- [ ] **Step 8:** Record findings (screenshots/console) in the final summary. Any failure → systematic-debugging before claiming done.

---

## Self-Review (run by author after writing)

- **Spec coverage:** §A routing → Tasks 6,7,15; §B data flow → Tasks 4,8,15; §C tab selection → Task 15; §D mounting/SSRM → Tasks 8,15,17(step 3); §E user info → Tasks 2,13,15; §F suggestions → Tasks 3,12,14,15; §G recents cleanup → Tasks 11,12; §H hero extras → Tasks 13,14; §I component map → all; §J states → Task 15; §K testing → every task + 17; §L out-of-scope → respected (no collapse animation). ✓
- **Placeholders:** none — every code step shows full code. ✓
- **Type consistency:** `CategoryResultV4` prop shape consistent (Tasks 8,9,15); `SearchBar` `suggestions` prop added in Task 12 and supplied by Hero (14) + SearchPage (15); `useUserInfo` returns `{loginId,initials,isIdentified}` consumed by `UserChip` (13) and pages (14,15); `searchSchema` `{q,tab}` (6) matches `useSearchState` (5) and SearchPage reads (15). ✓
- **Known seam:** Task 7 introduces a `SearchHero` stub so `/` compiles; Task 14 replaces it. Task 15 fixes the last SearchPage typecheck break introduced by Task 6. Sequencing is correct.
