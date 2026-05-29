// src/search/__tests__/ssrm.test.ts
import { describe, test, expect } from 'vitest'
import {
  FRONTEND_ONLY_COLUMNS,
  buildSsrmRowId,
  getVisibleColumnIds,
  convertFilterModel,
  searchColumnFor,
  buildInitialFilter,
  groupNodeRoute,
  makeIsGroupOpen,
} from '@/search/lib/ssrm'
import type { CategoryResultV4 } from '@/search/types'

const cat = (over: Partial<CategoryResultV4> = {}): CategoryResultV4 => ({
  key: 'jobName', label: 'Job Name', count: 4, hasMore: false,
  values: ['A', 'B'],
  columns: [{ field: 'job_name', headerName: 'Job Name', rowGroup: true }, { field: 'box_name', headerName: 'Box' }],
  ...over,
})

describe('ssrm helpers', () => {
  test('buildSsrmRowId: stable group id; route-prefixed leaves; no value-concat collisions', () => {
    // group row: no parents, data is just the group value (independent of visible cols)
    const groupId = buildSsrmRowId({ parentKeys: [], data: { job_name: 'RECON-1' } })
    expect(groupId).toBe('RECON-1')
    expect(buildSsrmRowId({ parentKeys: [], data: { job_name: 'RECON-1' } })).toBe(groupId) // stable
    // leaf row under that group: route prefix + its own values
    const leafId = buildSsrmRowId({ parentKeys: ['RECON-1'], data: { box_name: 'BOX-1', machine: 'm1' } })
    expect(leafId.startsWith('RECON-1')).toBe(true)
    expect(leafId).not.toBe(groupId)
    // separated values → naive-concat lookalikes do NOT collide
    const a = buildSsrmRowId({ parentKeys: ['g'], data: { x: '1', y: '23' } })
    const b = buildSsrmRowId({ parentKeys: ['g'], data: { x: '12', y: '3' } })
    expect(a).not.toBe(b)
  })

  test('FRONTEND_ONLY_COLUMNS contains the expected sentinel values', () => {
    expect(FRONTEND_ONLY_COLUMNS.has('execution_order')).toBe(true)
    expect(FRONTEND_ONLY_COLUMNS.has('ag-Grid-AutoColumn')).toBe(true)
    expect(FRONTEND_ONLY_COLUMNS.has('job_name')).toBe(false)
  })

  test('getVisibleColumnIds: drops hidden + frontend-only, always includes group cols', () => {
    const state = [
      { colId: 'job_name', hide: true },   // hidden but is a group col → kept
      { colId: 'box_name', hide: false },
      { colId: 'machine', hide: true },    // hidden, not group → dropped
      { colId: 'execution_order', hide: false }, // frontend-only → dropped
      { colId: 'ag-Grid-AutoColumn', hide: false }, // frontend-only → dropped
    ] as Array<{ colId: string; hide: boolean }>
    const ids = getVisibleColumnIds(state as never, ['job_name'])
    expect(ids).toHaveLength(2)
    expect(ids).toEqual(expect.arrayContaining(['box_name', 'job_name'])) // order not contractual
    expect(ids).not.toContain('machine')
    expect(ids).not.toContain('execution_order')
  })

  test('convertFilterModel: drops empty entries, defaults filterType/type', () => {
    const raw = {
      box_name: { filter: 'trade' },
      machine: { filter: '' },          // dropped
      recon: null,                       // dropped
      job_name: { filterType: 'text', type: 'equals', filter: 'X' },
    }
    expect(convertFilterModel(raw as never)).toEqual({
      box_name: { filterType: 'text', type: 'contains', filter: 'trade' },
      job_name: { filterType: 'text', type: 'equals', filter: 'X' },
    })
    expect(convertFilterModel(null)).toEqual({})
  })

  test('searchColumnFor / buildInitialFilter use the rowGroup column', () => {
    expect(searchColumnFor(cat())).toBe('job_name')
    expect(buildInitialFilter(cat())).toEqual({ column: 'job_name', values: ['A', 'B'] })
    expect(buildInitialFilter(cat({ values: [] }))).toBeNull()
  })

  test('makeIsGroupOpen: matches saved group routes at every nesting level', () => {
    const root = { key: null, parent: null }
    const lvl0 = { key: 'RECON-1', parent: root }
    const lvl1 = { key: 'BOX-1', parent: lvl0 }
    const other = { key: 'RECON-2', parent: root }
    const isOpen = makeIsGroupOpen(['RECON-1', groupNodeRoute(lvl1)])
    expect(isOpen(lvl0)).toBe(true) // level-0 route listed
    expect(isOpen(lvl1)).toBe(true) // nested route listed → restores deep expansion
    expect(isOpen(other)).toBe(false) // not listed → stays collapsed
    // empty set (a normal, non-shared search) → nothing auto-opens
    expect(makeIsGroupOpen([])(lvl0)).toBe(false)
  })

  test('groupNodeRoute builds the group key-path from the node up to root', () => {
    const root = { key: null, parent: null }
    const grp = { key: 'RECON-1', parent: root }
    const sub = { key: 'NA', parent: grp }
    expect(groupNodeRoute(grp)).toBe('RECON-1')
    const subRoute = groupNodeRoute(sub)
    expect(subRoute.startsWith('RECON-1')).toBe(true)
    expect(subRoute.endsWith('NA')).toBe(true)
    expect(subRoute).not.toBe('RECON-1NA') // keys are separated, not concatenated
    expect(groupNodeRoute(null)).toBe('')
  })
})
