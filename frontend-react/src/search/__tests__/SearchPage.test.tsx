/* eslint-disable @typescript-eslint/require-await */
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import {
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
  Outlet,
} from '@tanstack/react-router'

import { SearchPage } from '@/search/SearchPage'

const apiFetchMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/queryClient', () => ({ apiFetch: apiFetchMock, reportRequestFailure: vi.fn() }))
vi.mock('@/search/hooks/useRecentSearches', () => ({ useRecentSearches: () => ({ recents: [], push: vi.fn(), clear: vi.fn() }) }))
vi.mock('@/search/hooks/useSuggestions', () => ({ useSuggestions: () => [] }))
vi.mock('@/search/hooks/useUserInfo', () => ({ useUserInfo: () => ({ loginId: null, initials: '', isIdentified: false }) }))
vi.mock('@/components/layout/theme-switch', () => ({ ThemeSwitch: () => null }))
vi.mock('@/components/app-shell/footer', () => ({ Footer: () => null }))
vi.mock('@/components/app-shell/BrandLogo', () => ({ BrandLogo: () => null }))

// Stub the heavy AG-Grid panel; record the category key each mount receives so
// we can assert tab-switch wiring (which category's grid is currently mounted).
const gridCategoryKeys: string[] = []
vi.mock('@/search/SearchGridPanel', () => ({
  SearchGridPanel: ({ category }: { category: { key: string } }) => {
    gridCategoryKeys.push(category.key)
    return <div data-testid="grid">{category.key}</div>
  },
}))

function mk(key: string, label: string, count: number, hasMore = false) {
  return { key, label, count, hasMore, values: ['v'], columns: [] }
}
function respWith(...cats: ReturnType<typeof mk>[]) {
  return { categoryResults: Object.fromEntries(cats.map((c) => [c.key, c])), searchTerm: 'trade', timestamp: 0 }
}

function renderAt(url: string) {
  const root = createRootRoute({ component: () => <Outlet /> })
  const index = createRoute({ getParentRoute: () => root, path: '/', component: () => <div>HERO</div> })
  const search = createRoute({
    getParentRoute: () => root,
    path: '/search',
    validateSearch: (s: Record<string, unknown>) => ({
      q: typeof s.q === 'string' ? s.q : undefined,
      tab: typeof s.tab === 'string' ? s.tab : undefined,
    }),
    component: SearchPage,
  })
  const router = createRouter({ routeTree: root.addChildren([index, search]), history: createMemoryHistory({ initialEntries: [url] }) })
  render(<RouterProvider router={router} />)
  return router
}

beforeEach(() => {
  apiFetchMock.mockReset()
  gridCategoryKeys.length = 0
})

describe('SearchPage results', () => {
  test('fetches /initial and renders a tab per count>0 category, highest-count active', async () => {
    apiFetchMock.mockResolvedValue({ json: async () => respWith(mk('fileName', 'File Name', 3), mk('jobName', 'Job Name', 10), mk('setId', 'Set ID', 0)) })
    renderAt('/search?q=trade')
    await waitFor(() => expect(screen.getByText('Job Name (10)')).toBeInTheDocument())
    expect(screen.getByText('File Name (3)')).toBeInTheDocument()
    expect(screen.queryByText(/Set ID/)).not.toBeInTheDocument()
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
    await waitFor(() => expect(screen.getByText('No results found')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /Start over/i })).toBeInTheDocument()
    expect(screen.queryByTestId('grid')).not.toBeInTheDocument()
  })

  test('navbar logo links to the home route', async () => {
    apiFetchMock.mockResolvedValue({ json: async () => respWith(mk('jobName', 'Job Name', 10)) })
    renderAt('/search?q=trade')
    await waitFor(() => expect(screen.getByText('Job Name (10)')).toBeInTheDocument())
    expect(screen.getByRole('link', { name: 'Go to Rectrace home' })).toHaveAttribute('href', '/')
  })

  test('deep-link tab selects that category when valid', async () => {
    apiFetchMock.mockResolvedValue({ json: async () => respWith(mk('jobName', 'Job Name', 10), mk('fileName', 'File Name', 3)) })
    renderAt('/search?q=trade&tab=fileName')
    await waitFor(() => expect(gridCategoryKeys.at(-1)).toBe('fileName'))
  })
})
