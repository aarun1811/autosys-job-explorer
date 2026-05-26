/* eslint-disable @typescript-eslint/require-await */
import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import {
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
  Outlet,
} from '@tanstack/react-router'
import { SearchHero } from '@/search/SearchHero'

vi.mock('@/search/hooks/useRecentSearches', () => ({ useRecentSearches: () => ({ recents: [], clear: vi.fn(), push: vi.fn() }) }))
vi.mock('@/search/hooks/useSuggestions', () => ({ useSuggestions: () => [] }))
vi.mock('@/search/hooks/useUserInfo', () => ({ useUserInfo: () => ({ loginId: null, initials: '', isIdentified: false }) }))
vi.mock('@/components/app-shell/BrandLogo', () => ({ BrandLogo: () => null }))
vi.mock('@/components/layout/theme-switch', () => ({ ThemeSwitch: () => null }))

function renderHero() {
  const root = createRootRoute({ component: () => <Outlet /> })
  const index = createRoute({ getParentRoute: () => root, path: '/', component: SearchHero })
  const search = createRoute({
    getParentRoute: () => root,
    path: '/search',
    validateSearch: (s: Record<string, unknown>) => ({ q: typeof s.q === 'string' ? s.q : undefined }),
    component: () => <div>RESULTS</div>,
  })
  const router = createRouter({ routeTree: root.addChildren([index, search]), history: createMemoryHistory({ initialEntries: ['/'] }) })
  render(<RouterProvider router={router} />)
  return router
}

describe('SearchHero', () => {
  test('typing + Search navigates to /search?q=term', async () => {
    const router = renderHero()
    const input = await screen.findByRole('textbox')
    fireEvent.change(input, { target: { value: 'trade' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/search'))
    expect(router.state.location.search).toMatchObject({ q: 'trade' })
  })

  test('renders a Try button', async () => {
    renderHero()
    expect(await screen.findByRole('button', { name: /Try/i })).toBeInTheDocument()
  })
})
