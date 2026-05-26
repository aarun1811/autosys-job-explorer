// src/search/__tests__/SearchGridPanel.test.tsx
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
import { SearchGridPanel } from '@/search/SearchGridPanel'

const exportMock = vi.hoisted(() => vi.fn())
vi.mock('@/search/lib/exportSearch', () => ({ exportSearchToExcel: exportMock }))

// --- mock GridApi ---
const mockApi = {
  setSideBarVisible: vi.fn(),
  isSideBarVisible: vi.fn(() => false),
  openToolPanel: vi.fn(),
  autoSizeAllColumns: vi.fn(),
  resetColumnState: vi.fn(),
  setFilterModel: vi.fn(),
  collapseAll: vi.fn(),
  expandAll: vi.fn(),
  refreshServerSide: vi.fn(),
  getColumnState: vi.fn(() => [{ colId: 'job_name', hide: false }]),
  getFilterModel: vi.fn(() => ({})),
  getRowGroupColumns: vi.fn(() => []),
  getColumns: vi.fn(() => []),
  forEachNode: vi.fn(),
}

// Stub SearchGrid: fire onGridReady on mount; expose a dbl-click trigger.
vi.mock('@/search/SearchGrid', () => ({
  SearchGrid: ({ onGridReady, onRowDoubleClicked }: any) => {
    if (onGridReady) onGridReady({ api: mockApi })
    return (
      <button data-testid="dbl" onClick={() => onRowDoubleClicked?.({ job_name: 'SAMPLE_TRADE_RECON_001' })}>
        grid
      </button>
    )
  },
}))

const clipboard = vi.fn(() => Promise.resolve())
Object.assign(navigator, { clipboard: { writeText: clipboard } })

function mkCategory() {
  return {
    key: 'jobName',
    label: 'Job Name',
    count: 4,
    hasMore: false,
    values: ['SAMPLE_TRADE_RECON_001'],
    columns: [{ field: 'job_name', headerName: 'Job Name', rowGroup: true }],
  }
}

function renderPanel() {
  const root = createRootRoute({ component: () => <Outlet /> })
  const search = createRoute({
    getParentRoute: () => root,
    path: '/search',
    validateSearch: (s: Record<string, unknown>) => ({
      q: typeof s.q === 'string' ? s.q : undefined,
      tab: typeof s.tab === 'string' ? s.tab : undefined,
      view: typeof s.view === 'string' ? s.view : undefined,
    }),
    component: () => <SearchGridPanel q="recon" category={mkCategory() as any} />,
  })
  const router = createRouter({
    routeTree: root.addChildren([search]),
    history: createMemoryHistory({ initialEntries: ['/search?q=recon&tab=jobName'] }),
  })
  render(<RouterProvider router={router} />)
  return router
}

beforeEach(() => {
  Object.values(mockApi).forEach((fn) => (fn as any).mockClear?.())
  clipboard.mockClear()
})

describe('SearchGridPanel', () => {
  test('Toggle panel reveals the sidebar and opens the Columns panel (Angular parity)', async () => {
    renderPanel()
    fireEvent.click(await screen.findByRole('button', { name: 'Toggle columns and filters panel' }))
    // isSideBarVisible() is mocked false → opening: show sidebar + expand Columns.
    expect(mockApi.setSideBarVisible).toHaveBeenCalledWith(true)
    expect(mockApi.openToolPanel).toHaveBeenCalledWith('columns')
  })

  test('Expand all calls api.expandAll', async () => {
    renderPanel()
    fireEvent.click(await screen.findByRole('button', { name: 'Expand all groups' }))
    expect(mockApi.expandAll).toHaveBeenCalledTimes(1)
  })

  test('Clear filters calls api.setFilterModel(null)', async () => {
    renderPanel()
    fireEvent.click(await screen.findByRole('button', { name: 'Clear filters' }))
    expect(mockApi.setFilterModel).toHaveBeenCalledWith(null)
  })

  test('Refresh purges the server side', async () => {
    renderPanel()
    fireEvent.click(await screen.findByRole('button', { name: 'Refresh' }))
    expect(mockApi.refreshServerSide).toHaveBeenCalledWith({ purge: true })
  })

  test('Remove duplicates toggles active + refreshes (Angular-faithful)', async () => {
    renderPanel()
    const btn = await screen.findByRole('button', { name: 'Remove duplicates' })
    expect(btn).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(btn)
    expect(mockApi.refreshServerSide).toHaveBeenCalledWith({ purge: true })
    expect(screen.getByRole('button', { name: 'Remove duplicates' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('Reset view restores columns + filters + collapses', async () => {
    renderPanel()
    fireEvent.click(await screen.findByRole('button', { name: 'Reset view' }))
    expect(mockApi.resetColumnState).toHaveBeenCalled()
    expect(mockApi.setFilterModel).toHaveBeenCalledWith(null)
    expect(mockApi.collapseAll).toHaveBeenCalled()
  })

  test('double-clicking a row opens the detail drawer', async () => {
    renderPanel()
    fireEvent.click(await screen.findByTestId('dbl'))
    expect(await screen.findByText('Row details')).toBeInTheDocument()
    expect(screen.getByText('SAMPLE_TRADE_RECON_001')).toBeInTheDocument()
  })

  test('Share view writes the URL view param and copies a link', async () => {
    const router = renderPanel()
    fireEvent.click(await screen.findByRole('button', { name: 'Share view' }))
    // navigate() and the clipboard write are async (.then chain) — await both.
    await waitFor(() => expect(router.state.location.search).toHaveProperty('view'))
    await waitFor(() => expect(clipboard).toHaveBeenCalledTimes(1))
  })

  test('Export downloads via the backend export endpoint', async () => {
    exportMock.mockReset().mockResolvedValue(undefined)
    renderPanel()
    const trigger = await screen.findByRole('button', { name: 'Export' })
    trigger.focus()
    fireEvent.keyDown(trigger, { key: 'Enter' })
    fireEvent.click(screen.getByText('Download Excel (.xlsx)'))
    await waitFor(() => expect(exportMock).toHaveBeenCalledTimes(1))
    const [category, body] = exportMock.mock.calls[0]
    expect(category).toBe('jobName')
    expect(body.category).toBe('jobName')
    // mockApi.getColumnState → [{colId:'job_name',hide:false}], getRowGroupColumns → []
    expect(body.columns).toEqual(['job_name'])
  })
})
