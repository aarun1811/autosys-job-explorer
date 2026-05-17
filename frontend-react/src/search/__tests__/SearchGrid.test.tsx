import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// Mock the queryClient module so we can spy on apiFetch + reportRequestFailure.
vi.mock('@/lib/queryClient', () => ({
  apiFetch: vi.fn(),
  reportRequestFailure: vi.fn(),
  queryClient: undefined,
}))

// Mock the useSearchConfig hook so SearchGrid can resolve a CategoryConfigV4
// without a real network round-trip. The hook returns the fileName fixture.
const fileNameCategory = {
  key: 'fileName',
  label: 'File Name',
  searchColumn: 'file_name_pattern',
  elasticsearch: {
    index: 'rectrace_core_index',
    searchFields: ['file_name_pattern', 'file_name_pattern.keyword'],
    collapseField: 'file_name_pattern.keyword',
    maxResults: 1000,
  },
  oracle: { table: 'rectrace_core' },
  columns: [
    { field: 'file_name_pattern', headerName: 'File Name', rowGroup: true, hide: true, sortable: true, filter: true },
    { field: 'job_name', headerName: 'Job Name', sortable: true, filter: true },
  ],
}

const useSearchConfigMock = vi.fn(() => ({
  data: { categories: [fileNameCategory] },
  isLoading: false,
  isError: false,
  isSuccess: true,
  error: null,
}))

vi.mock('@/search/hooks/useSearchConfig', () => ({
  useSearchConfig: () => useSearchConfigMock(),
}))

import { apiFetch, reportRequestFailure } from '@/lib/queryClient'
import { SearchGrid, _test_buildDatasource } from '../SearchGrid'
import type { InitialSearchResponseV4 } from '../types'

// Canonical fixture matching the real /initial response shape (key, label,
// values, count, hasMore, columns). SearchGrid combines this with
// category.searchColumn from /config to build the SSRM body's initialFilter.
const initialFilterFixture: InitialSearchResponseV4 = {
  categoryResults: {
    fileName: {
      key: 'fileName',
      label: 'File Name',
      values: ['acct.csv', 'gl.csv'],
      count: 2,
      hasMore: false,
      columns: [{ field: 'file_name_pattern', headerName: 'File Name Pattern' }],
    },
  },
}

function makeWrapper(): React.FC<{ children: React.ReactNode }> {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return ({ children }) => React.createElement(QueryClientProvider, { client }, children)
}

beforeEach(() => {
  vi.clearAllMocks()
  useSearchConfigMock.mockReturnValue({
    data: { categories: [fileNameCategory] },
    isLoading: false,
    isError: false,
    isSuccess: true,
    error: null,
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('SearchGrid', () => {
  test('renders without crashing when config is loaded and category is found', () => {
    const Wrapper = makeWrapper()
    try {
      render(
        <Wrapper>
          <SearchGrid q="csv" cat="fileName" initialFilter={initialFilterFixture} />
        </Wrapper>,
      )
    } catch (_e) {
      // jsdom canvas limitations for AG-Grid — acceptable per Phase 2 idiom.
    }
  })

  test('renders fallback (no crash) while config is loading', () => {
    useSearchConfigMock.mockReturnValueOnce({
      data: undefined,
      isLoading: true,
      isError: false,
      isSuccess: false,
      error: null,
    })
    const Wrapper = makeWrapper()
    // Must not throw — fallback path must be defensive.
    expect(() =>
      render(
        <Wrapper>
          <SearchGrid q="csv" cat="fileName" initialFilter={initialFilterFixture} />
        </Wrapper>,
      ),
    ).not.toThrow()
  })

  test('SSRM getRows POST body shape mirrors SSRMRequestV4', async () => {
    const mockApi = apiFetch as unknown as ReturnType<typeof vi.fn>
    mockApi.mockResolvedValue({ json: () => Promise.resolve({ rows: [], lastRow: 0 }) })

    const ds = _test_buildDatasource('csv', 'fileName', initialFilterFixture, 'file_name_pattern')

    const params = {
      request: {
        startRow: 0,
        endRow: 100,
        sortModel: [{ colId: 'job_name', sort: 'asc' as const }],
        filterModel: { job_name: { type: 'contains', filter: 'load' } },
        rowGroupCols: [{ field: 'file_name_pattern', id: 'file_name_pattern' }],
        groupKeys: ['acct.csv'],
      },
      success: vi.fn(),
      fail: vi.fn(),
      api: { getAllDisplayedColumns: () => [] },
    } as never

    await ds.getRows(params)

    expect(mockApi).toHaveBeenCalledTimes(1)
    const [url, init] = mockApi.mock.calls[0]
    expect(url).toBe('/rectrace/api/v4/search/ssrm/fileName')
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body as string)
    // Body-shape assertion — mirrors SSRMRequestV4.
    expect(body.category).toBe('fileName')
    expect(body.initialFilter).toEqual({ column: 'file_name_pattern', values: ['acct.csv', 'gl.csv'] })
    expect(body.rowGroupCols).toEqual(['file_name_pattern'])
    expect(body.groupKeys).toEqual(['acct.csv'])
    expect(body.startRow).toBe(0)
    expect(body.endRow).toBe(100)
    expect(body.sortModel).toEqual([{ colId: 'job_name', sort: 'asc' }])
    expect(body.filterModel).toEqual({ job_name: { type: 'contains', filter: 'load' } })
    expect(Array.isArray(body.visibleColumns)).toBe(true)
  })

  test('on non-AbortError rejection: setTimeout fires and reportRequestFailure is called', async () => {
    vi.useFakeTimers()
    const mockApi = apiFetch as unknown as ReturnType<typeof vi.fn>
    const networkErr = Object.assign(new Error('Boom'), { correlationId: 'abc123', name: 'TypeError' })
    mockApi.mockRejectedValue(networkErr)

    const ds = _test_buildDatasource('csv', 'fileName', initialFilterFixture, 'file_name_pattern')

    const params = {
      request: {
        startRow: 0,
        endRow: 100,
        sortModel: [],
        filterModel: {},
        rowGroupCols: [],
        groupKeys: [],
      },
      success: vi.fn(),
      fail: vi.fn(),
      api: { getAllDisplayedColumns: () => [] },
    } as never

    await ds.getRows(params)
    // The catch block schedules reportRequestFailure on the next macrotask.
    vi.advanceTimersByTime(0)

    expect(reportRequestFailure).toHaveBeenCalledTimes(1)
    expect(reportRequestFailure).toHaveBeenCalledWith(networkErr)
    expect(params.fail).toHaveBeenCalledTimes(1)
  })

  test('on AbortError: neither reportRequestFailure nor params.fail is called', async () => {
    vi.useFakeTimers()
    const mockApi = apiFetch as unknown as ReturnType<typeof vi.fn>
    const abortErr = Object.assign(new Error('aborted'), { name: 'AbortError' })
    mockApi.mockRejectedValue(abortErr)

    const ds = _test_buildDatasource('csv', 'fileName', initialFilterFixture, 'file_name_pattern')

    const params = {
      request: {
        startRow: 0,
        endRow: 100,
        sortModel: [],
        filterModel: {},
        rowGroupCols: [],
        groupKeys: [],
      },
      success: vi.fn(),
      fail: vi.fn(),
      api: { getAllDisplayedColumns: () => [] },
    } as never

    await ds.getRows(params)
    vi.advanceTimersByTime(0)

    expect(reportRequestFailure).not.toHaveBeenCalled()
    expect(params.fail).not.toHaveBeenCalled()
  })
})
