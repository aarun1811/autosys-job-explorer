/*
 * Vitest mock idioms intentionally use `async () => ({...})` for `json()` and
 * other Response-shaped responses even when the body is synchronous — this
 * matches the real Fetch API contract that callers await. Likewise, the
 * SearchGrid stub's useEffect intentionally has an empty dep array (mount-
 * once semantics matching AG-Grid's onGridReady), and the
 * vi.hoisted(unknown-value) cell is destructured in tests with type cast.
 * These conflict with strict lint rules; suppress at file scope.
 */
/* eslint-disable @typescript-eslint/require-await, react-hooks/exhaustive-deps, @typescript-eslint/no-unnecessary-type-assertion */
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { act, render, screen, waitFor, fireEvent } from '@testing-library/react'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from '@tanstack/react-router'
import { z } from 'zod'
import { useEffect } from 'react'

import { SearchPage } from '@/search/SearchPage'

/**
 * Integration-style tests for SearchPage. Mocks at the boundaries:
 *   - apiFetch / reportRequestFailure (network)
 *   - useRecentSearches (localStorage)
 *   - SearchGrid (heavy AG-Grid → stub that invokes onGridReady +
 *     onModelUpdated synthetically; lets us assert export-closure wiring +
 *     resultCount wiring without spinning up AG-Grid)
 *   - useSearchConfig (read by SearchGrid; harmless to keep here)
 *   - ThemeSwitch (next-themes harness is heavy; render a stub)
 */

// ─── Mocks ───────────────────────────────────────────────────────────────────

const apiFetchMock = vi.hoisted(() => vi.fn())
const reportRequestFailureMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/queryClient', () => ({
  apiFetch: apiFetchMock,
  reportRequestFailure: reportRequestFailureMock,
}))

const pushRecentMock = vi.hoisted(() => vi.fn())
vi.mock('@/search/hooks/useRecentSearches', () => ({
  useRecentSearches: () => ({
    recents: [],
    push: pushRecentMock,
    clear: vi.fn(),
  }),
}))

vi.mock('@/search/hooks/useSearchConfig', () => ({
  useSearchConfig: () => ({
    data: { categories: [{ key: 'fileName', label: 'File Name', searchColumn: 'file_name', elasticsearch: {}, oracle: {}, columns: [] }] },
    isLoading: false,
  }),
}))

vi.mock('@/components/layout/theme-switch', () => ({
  ThemeSwitch: () => null,
}))

// Footer reads __BUILD_SHA__ (Vite define injected at build time) — stub in tests.
vi.mock('@/components/app-shell/footer', () => ({
  Footer: () => null,
}))

// SearchGrid stub: synthetically invokes onGridReady with a fake GridApi
// exposing exportDataAsExcel + getColumns (the surfaces SearchPage uses) and
// fires onModelUpdated(3) on mount so we can assert the resultCount wire.
const exportDataAsExcelMock = vi.hoisted(() => vi.fn())
const getColumnsMock = vi.hoisted(() => vi.fn())
const onGridReadySeenProps = vi.hoisted(() => ({ value: undefined as unknown }))
vi.mock('@/search/SearchGrid', () => ({
  SearchGrid: (props: {
    q: string
    cat: string
    initialFilter: unknown
    onGridReady?: (e: { api: unknown }) => void
    onModelUpdated?: (n: number) => void
  }) => {
    onGridReadySeenProps.value = { q: props.q, cat: props.cat, initialFilter: props.initialFilter }
    // Capture & propagate the gridApi via the same useEffect ordering AG-Grid uses.
    useEffect(() => {
      const fakeApi = {
        exportDataAsExcel: exportDataAsExcelMock,
        getColumns: getColumnsMock,
      }
      props.onGridReady?.({ api: fakeApi })
      props.onModelUpdated?.(3)
    }, [])
    return <div data-testid="search-grid">{JSON.stringify({ q: props.q, cat: props.cat })}</div>
  },
}))

// ─── Harness ─────────────────────────────────────────────────────────────────

function renderAt(initialUrl: string) {
  const rootRoute = createRootRoute({ component: () => <Outlet /> })
  const searchRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/search',
    validateSearch: z.object({
      q: z.string().optional(),
      cat: z.string().optional().default('fileName'),
    }),
    component: SearchPage,
  })
  const routeTree = rootRoute.addChildren([searchRoute])
  const history = createMemoryHistory({ initialEntries: [initialUrl] })
  const router = createRouter({ routeTree, history })
  return render(<RouterProvider router={router} />)
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('SearchPage', () => {
  beforeEach(() => {
    apiFetchMock.mockReset()
    reportRequestFailureMock.mockReset()
    pushRecentMock.mockReset()
    exportDataAsExcelMock.mockReset()
    getColumnsMock.mockReset()
    onGridReadySeenProps.value = undefined
  })

  test('pre-search state: with no q in URL, renders "Search Autosys jobs" empty state and no grid', async () => {
    renderAt('/search')
    expect(await screen.findByText('Search Autosys jobs')).toBeInTheDocument()
    expect(screen.queryByTestId('search-grid')).toBeNull()
  })

  test('URL-restore: with /search?q=csv, fires GET /rectrace/api/v4/search/initial?keyword=csv on mount and renders SearchGrid with initialFilter', async () => {
    const responseBody = { categoryResults: { fileName: { key: 'fileName', label: 'File Name', values: ['a.csv'], count: 1, hasMore: false, columns: [] } } }
    apiFetchMock.mockResolvedValueOnce({ json: async () => responseBody })

    await act(async () => {
      renderAt('/search?q=csv&cat=fileName')
    })

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith('/rectrace/api/v4/search/initial?keyword=csv')
    })
    await waitFor(() => {
      expect(screen.getByTestId('search-grid')).toBeInTheDocument()
    })
    // The stub captured the initialFilter prop passed by SearchPage
    expect(onGridReadySeenProps.value).toMatchObject({ q: 'csv', cat: 'fileName', initialFilter: responseBody })
  })

  test('on successful submit, useRecentSearches.push is called with the trimmed term', async () => {
    apiFetchMock.mockResolvedValueOnce({
      json: async () => ({ categoryResults: { fileName: { key: 'fileName', label: 'File Name', values: ['a.csv'], count: 1, hasMore: false, columns: [] } } }),
    })
    await act(async () => {
      renderAt('/search?q=csv&cat=fileName')
    })
    await waitFor(() => {
      expect(pushRecentMock).toHaveBeenCalledWith('csv')
    })
  })

  test('on fetch rejection, reportRequestFailure is called and ErrorStateCard renders with "Try again"', async () => {
    const err = Object.assign(new Error('HTTP 500'), { correlationId: 'abc123def456abc123def456abc123de' })
    apiFetchMock.mockRejectedValueOnce(err)

    await act(async () => {
      renderAt('/search?q=fail&cat=fileName')
    })

    await waitFor(() => {
      expect(reportRequestFailureMock).toHaveBeenCalledWith(err)
    })
    expect(await screen.findByText('Search unavailable')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    // Correlation ID is rendered inline in the error card.
    expect(screen.getByText('abc123def456abc123def456abc123de')).toBeInTheDocument()
  })

  test('clicking "Try again" re-invokes apiFetch and renders SearchGrid on success', async () => {
    const okBody = { categoryResults: { fileName: { key: 'fileName', label: 'File Name', values: ['x'], count: 1, hasMore: false, columns: [] } } }
    apiFetchMock
      .mockRejectedValueOnce(Object.assign(new Error('boom'), { correlationId: 'cc'.repeat(16) }))
      .mockResolvedValueOnce({ json: async () => okBody })

    await act(async () => {
      renderAt('/search?q=retry&cat=fileName')
    })
    await waitFor(() => expect(screen.getByText('Search unavailable')).toBeInTheDocument())

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    })

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledTimes(2)
    })
    await waitFor(() => {
      expect(screen.getByTestId('search-grid')).toBeInTheDocument()
    })
  })

  test('Excel export: handleExport calls gridApi.exportDataAsExcel with rectrace-{cat}-{term}-YYYYMMDD.xlsx fileName and columnKeys excluding execution_order', async () => {
    apiFetchMock.mockResolvedValueOnce({
      json: async () => ({ categoryResults: { fileName: { key: 'fileName', label: 'File Name', values: ['a.csv'], count: 1, hasMore: false, columns: [] } } }),
    })
    // After onGridReady fires, the export closure uses getColumns(); return two columns.
    getColumnsMock.mockReturnValue([
      { getColId: () => 'app_id' },
      { getColId: () => 'execution_order' },
    ])

    await act(async () => {
      renderAt('/search?q=csv&cat=fileName')
    })

    await waitFor(() => {
      expect(screen.getByTestId('search-grid')).toBeInTheDocument()
    })

    // Open the Export DropdownMenu via keyboard (Radix opens on Enter/Space;
    // pointerdown is flaky in jsdom — see SearchToolbar.test.tsx).
    const exportBtn = screen.getByRole('button', { name: /export/i })
    await act(async () => {
      exportBtn.focus()
      fireEvent.keyDown(exportBtn, { key: 'Enter' })
    })
    const item = await screen.findByText('Download Excel (.xlsx)')
    await act(async () => {
      fireEvent.click(item)
    })

    await waitFor(() => {
      expect(exportDataAsExcelMock).toHaveBeenCalledTimes(1)
    })
    const callArg = exportDataAsExcelMock.mock.calls[0]?.[0] as { fileName: string; columnKeys?: string[] }
    expect(callArg.fileName).toMatch(/^rectrace-fileName-csv-\d{8}\.xlsx$/)
    expect(callArg.columnKeys).toEqual(['app_id'])
    expect(callArg.columnKeys).not.toContain('execution_order')
  })

  test('result count: SearchGrid.onModelUpdated(3) sets resultCount → Toolbar Badge shows "3 results"', async () => {
    apiFetchMock.mockResolvedValueOnce({
      json: async () => ({ categoryResults: { fileName: { key: 'fileName', label: 'File Name', values: ['a.csv'], count: 1, hasMore: false, columns: [] } } }),
    })

    await act(async () => {
      renderAt('/search?q=csv&cat=fileName')
    })

    await waitFor(() => {
      expect(screen.getByText('3 results')).toBeInTheDocument()
    })
  })
})
