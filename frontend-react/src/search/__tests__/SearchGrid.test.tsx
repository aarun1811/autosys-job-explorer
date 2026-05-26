/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/await-thenable, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { _test_buildDatasource } from '@/search/SearchGrid'
import type { CategoryResultV4 } from '@/search/types'

const apiFetchMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/queryClient', () => ({ apiFetch: apiFetchMock, reportRequestFailure: vi.fn() }))

const category: CategoryResultV4 = {
  key: 'fileName',
  label: 'File Name',
  count: 3,
  hasMore: false,
  values: ['trade.csv', 'cash.dat'],
  columns: [
    { field: 'file_name_pattern', headerName: 'File Name', rowGroup: true, hide: true, sortable: true, filter: true, resizable: null, width: null, cellRenderer: null, cellRendererParams: null, cellStyle: null, pinned: null },
    { field: 'app_name', headerName: 'App Name', rowGroup: null, hide: null, sortable: true, filter: true, resizable: null, width: null, cellRenderer: null, cellRendererParams: null, cellStyle: null, pinned: null },
  ],
}

const req = { request: { startRow: 0, endRow: 100, rowGroupCols: [], groupKeys: [], sortModel: [], filterModel: {} }, success: vi.fn(), fail: vi.fn() }

beforeEach(() => { apiFetchMock.mockReset() })

describe('SearchGrid datasource', () => {
  test('POSTs SSRM to the category key with initialFilter column = rowGroup field', async () => {
    apiFetchMock.mockResolvedValue({ json: async () => ({ rows: [], lastRow: 0 }) })
    const ds = _test_buildDatasource('trade', category)
    await ds.getRows({ ...req, success: vi.fn() } as never)
    const [url, init] = apiFetchMock.mock.calls[0]
    expect(url).toBe('/rectrace/api/v4/search/ssrm/fileName')
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.category).toBe('fileName')
    expect(body.initialFilter).toEqual({ column: 'file_name_pattern', values: ['trade.csv', 'cash.dat'] })
  })

  test('null initialFilter when values empty', async () => {
    apiFetchMock.mockResolvedValue({ json: async () => ({ rows: [], lastRow: 0 }) })
    const ds = _test_buildDatasource('trade', { ...category, values: [] })
    await ds.getRows(req as never)
    const body = JSON.parse((apiFetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.initialFilter).toBeNull()
  })

  test('null initialFilter when no rowGroup column exists (no bogus column name)', async () => {
    apiFetchMock.mockResolvedValue({ json: async () => ({ rows: [], lastRow: 0 }) })
    const noRowGroup = { ...category, columns: category.columns.map((c) => ({ ...c, rowGroup: false })) }
    const ds = _test_buildDatasource('trade', noRowGroup)
    await ds.getRows(req as never)
    const body = JSON.parse((apiFetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.initialFilter).toBeNull()
  })

  test('forwards grid request paging + grouping fields into the SSRM body', async () => {
    apiFetchMock.mockResolvedValue({ json: async () => ({ rows: [], lastRow: 0 }) })
    const ds = _test_buildDatasource('trade', category)
    await ds.getRows({
      request: { startRow: 100, endRow: 200, rowGroupCols: [{ field: 'app_name' }], groupKeys: ['x'], sortModel: [{ colId: 'app_name', sort: 'asc' }], filterModel: {} },
      success: vi.fn(), fail: vi.fn(),
    } as never)
    const body = JSON.parse((apiFetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.startRow).toBe(100)
    expect(body.endRow).toBe(200)
    expect(body.rowGroupCols).toEqual(['app_name'])
    expect(body.groupKeys).toEqual(['x'])
  })
})
