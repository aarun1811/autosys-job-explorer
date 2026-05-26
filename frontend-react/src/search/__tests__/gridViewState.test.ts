// src/search/__tests__/gridViewState.test.ts
import { describe, test, expect } from 'vitest'
import { encodeViewState, decodeViewState, viewStateToGridState, type GridViewState } from '@/search/lib/gridViewState'
import type { ColumnState } from 'ag-grid-community'

const sample: GridViewState = {
  columnState: [{ colId: 'job_name', width: 200, hide: false }],
  filterModel: { job_name: { filterType: 'text', type: 'contains', filter: 'recon' } },
  dedup: false,
  density: 'compact',
  expandedGroups: ['RECON-1', 'GBLCOMMAND'],
}

describe('gridViewState', () => {
  test('encode then decode round-trips the state (incl. expandedGroups)', () => {
    const decoded = decodeViewState(encodeViewState(sample))
    expect(decoded).toEqual(sample)
  })

  test('older links without expandedGroups decode with an empty array', () => {
    const json = JSON.stringify({ columnState: [], filterModel: {}, dedup: false, density: 'normal' })
    const param = btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    const decoded = decodeViewState(param)
    expect(decoded?.expandedGroups).toEqual([])
  })

  test('the encoded param is a non-empty URL-safe string', () => {
    const s = encodeViewState(sample)
    expect(s.length).toBeGreaterThan(0)
    expect(s).not.toMatch(/[+/=]/) // base64url, no +,/,= padding
  })

  test('decoding a malformed param returns null (never throws)', () => {
    expect(decodeViewState('not-base64-$$$')).toBeNull()
    expect(decodeViewState('')).toBeNull()
    expect(decodeViewState(btoa('{"oops":true}'))).toBeNull() // wrong shape
  })
})

describe('viewStateToGridState (initialState restore)', () => {
  const cs = (s: Partial<ColumnState> & { colId: string }): ColumnState => s as ColumnState
  const nested: GridViewState = {
    columnState: [
      cs({ colId: 'ag-Grid-AutoColumn', width: 250, hide: false }),
      cs({ colId: 'job_name', width: 200, hide: true, rowGroup: true, rowGroupIndex: 0 }),
      cs({ colId: 'box_name', width: 103, hide: true, rowGroup: true, rowGroupIndex: 1 }),
      cs({ colId: 'recon', width: 114, hide: false, sort: 'asc', sortIndex: 0 }),
      cs({ colId: 'execution_order', width: 100, hide: false, pinned: 'right' }),
    ],
    filterModel: { recon: { filterType: 'text', type: 'contains', filter: 'X' } },
    dedup: false,
    density: 'normal',
    expandedGroups: [],
  }

  test('maps grouping/visibility/order/sort/pin/filter and skips the auto-group column', () => {
    const gs = viewStateToGridState(nested)
    expect(gs.rowGroup?.groupColIds).toEqual(['job_name', 'box_name']) // ordered by rowGroupIndex
    expect(gs.columnVisibility?.hiddenColIds).toEqual(['job_name', 'box_name'])
    expect(gs.columnOrder?.orderedColIds).not.toContain('ag-Grid-AutoColumn') // grid-managed
    expect(gs.columnOrder?.orderedColIds).toEqual(['job_name', 'box_name', 'recon', 'execution_order'])
    expect(gs.columnPinning?.rightColIds).toEqual(['execution_order'])
    expect(gs.sort?.sortModel).toEqual([{ colId: 'recon', sort: 'asc' }])
    expect(gs.filter?.filterModel).toEqual(nested.filterModel)
    expect(gs.partialColumnState).toBe(true)
  })

  test('omits empty sections (no grouping, no filter, nothing hidden)', () => {
    const gs = viewStateToGridState({
      columnState: [cs({ colId: 'a', width: 100, hide: false })],
      filterModel: {},
      dedup: false,
      density: 'compact',
      expandedGroups: [],
    })
    expect(gs.rowGroup).toBeUndefined()
    expect(gs.filter).toBeUndefined()
    expect(gs.columnVisibility).toBeUndefined()
    expect(gs.columnPinning).toBeUndefined()
    expect(gs.sort).toBeUndefined()
    expect(gs.columnOrder?.orderedColIds).toEqual(['a'])
  })
})
