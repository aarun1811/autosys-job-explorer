import { describe, it, expect } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from '@tanstack/react-router'
import { useSearchState } from '@/search/hooks/useSearchState'

/**
 * Mount the hook inside an in-memory TanStack Router harness and return both
 * the hook result and the router so tests can assert on
 * `router.state.location.search` after acts.
 *
 * We mount the hook as the route's component (rather than via renderHook's
 * wrapper) because TanStack Router's `useSearch({ from: '/search' })` needs
 * the consuming component to be a descendant of a matched route — a plain
 * RouterProvider wrapper around renderHook's child does NOT satisfy that.
 */
function renderHookInRoute(initialUrl: string) {
  const rootRoute = createRootRoute({
    component: () => <Outlet />,
  })

  let latest: ReturnType<typeof useSearchState> | undefined
  function HookProbe() {
    latest = useSearchState()
    return null
  }

  const searchRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/search',
    validateSearch: (s: Record<string, unknown>) => ({
      q: typeof s.q === 'string' ? s.q : undefined,
      tab: typeof s.tab === 'string' ? s.tab : undefined,
    }),
    component: HookProbe,
  })

  const routeTree = rootRoute.addChildren([searchRoute])
  const history = createMemoryHistory({ initialEntries: [initialUrl] })
  const router = createRouter({ routeTree, history })

  const { rerender, unmount } = renderHook(() => null, {
    wrapper: ({ children }) => (
      <>
        <RouterProvider router={router} />
        {children}
      </>
    ),
  })

  return {
    router,
    get current() {
      if (!latest) throw new Error('useSearchState did not mount')
      return latest
    },
    rerender,
    unmount,
  }
}

describe('useSearchState', () => {
  it('reads q and tab from the URL (no default injected)', async () => {
    const h = renderHookInRoute('/search?q=LOAD-ABC-123&tab=jobName')
    await act(async () => {
      await h.router.load()
    })
    expect(h.current.q).toBe('LOAD-ABC-123')
    expect(h.current.tab).toBe('jobName')
  })

  it('tab is undefined when absent (no hardcoded default)', async () => {
    const h = renderHookInRoute('/search?q=trade')
    await act(async () => {
      await h.router.load()
    })
    expect(h.current.q).toBe('trade')
    expect(h.current.tab).toBeUndefined()
  })

  it('q is undefined when only tab is set', async () => {
    const h = renderHookInRoute('/search?tab=boxName')
    await act(async () => {
      await h.router.load()
    })
    expect(h.current.q).toBeUndefined()
    expect(h.current.tab).toBe('boxName')
  })

  it('setQ updates the URL with q and preserves tab (replace, no back-stack growth)', async () => {
    const h = renderHookInRoute('/search?tab=fileName')
    await act(async () => {
      await h.router.load()
    })
    const lengthBefore = h.router.history.length
    await act(async () => {
      await Promise.resolve(h.current.setQ('hello'))
    })
    expect(h.router.state.location.search).toMatchObject({ q: 'hello', tab: 'fileName' })
    // replace: true → history length must NOT grow
    expect(h.router.history.length).toBe(lengthBefore)
  })

  it('setQ(undefined) removes q from the URL', async () => {
    const h = renderHookInRoute('/search?q=initial&tab=fileName')
    await act(async () => {
      await h.router.load()
    })
    await act(async () => {
      await Promise.resolve(h.current.setQ(undefined))
    })
    expect(h.router.state.location.search).not.toHaveProperty('q')
    expect(h.router.state.location.search).toMatchObject({ tab: 'fileName' })
  })

  it('setTab writes tab with replace, preserving q', async () => {
    const h = renderHookInRoute('/search?q=KEEPME')
    await act(async () => {
      await h.router.load()
    })
    await act(async () => {
      await Promise.resolve(h.current.setTab('boxName'))
    })
    expect(h.router.state.location.search).toMatchObject({ q: 'KEEPME', tab: 'boxName' })
  })

  it('setTab(undefined) removes tab from the URL', async () => {
    const h = renderHookInRoute('/search?q=KEEPME&tab=fileName')
    await act(async () => {
      await h.router.load()
    })
    await act(async () => {
      await Promise.resolve(h.current.setTab(undefined))
    })
    expect(h.router.state.location.search).not.toHaveProperty('tab')
    expect(h.router.state.location.search).toMatchObject({ q: 'KEEPME' })
  })

  it('clear() empties the URL search', async () => {
    const h = renderHookInRoute('/search?q=anything&tab=fileName')
    await act(async () => {
      await h.router.load()
    })
    await act(async () => {
      await Promise.resolve(h.current.clear())
    })
    expect(h.router.state.location.search).toEqual({})
  })
})
