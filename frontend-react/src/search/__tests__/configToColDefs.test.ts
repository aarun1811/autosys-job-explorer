import { describe, it, expect } from 'vitest'

import {
  configCategoryToColDefs,
  toCamelCaseStyle,
} from '@/search/lib/configToColDefs'
import {
  CategoryConfigV4Schema,
  type CategoryConfigV4,
} from '@/search/types'
import { AppIDCellRenderer } from '@/search/renderers/AppIDCellRenderer'
import { SupportEmailCellRenderer } from '@/search/renderers/SupportEmailCellRenderer'
import { ExecutionOrderCellRenderer } from '@/search/renderers/ExecutionOrderCellRenderer'

/**
 * Adapter tests — Plan 04 Task 1.
 *
 * The fileName category is taken verbatim from
 *   backend/rectrace/src/main/resources/search-config-v4.json
 * to ensure the adapter handles the real production config shape, including
 * kebab-case cellStyle keys and string-keyed cellRenderer references.
 */

const fileNameCategoryFixture = {
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
    { field: 'ok_file_name', headerName: 'OK File Name', sortable: true, filter: true },
    { field: 'job_name', headerName: 'Job Name', sortable: true, filter: true },
    { field: 'recon_engine', headerName: 'Recon Engine', sortable: true, filter: true },
    { field: 'app_name', headerName: 'App Name', hide: true, sortable: true, filter: true },
    { field: 'app_id', headerName: 'App ID', sortable: true, filter: true, cellRenderer: 'appIDCellRenderer' },
    { field: 'support_email', headerName: 'Support Email', sortable: true, filter: true, cellRenderer: 'supportEmailCellRenderer' },
    { field: 'support_hotline', headerName: 'Support Hotline', sortable: true, filter: true },
    { field: 'receive_path', headerName: 'Receive Path', sortable: true, filter: true },
    { field: 'recon', headerName: 'Recon Name', sortable: true, filter: true },
    { field: 'set_id', headerName: 'Set ID', sortable: true, filter: true, hide: true },
    { field: 'sub_acc', headerName: 'Sub Account', sortable: true, filter: true, hide: true },
    { field: 'load_job', headerName: 'Load Job', sortable: true, filter: true },
    { field: 'box_name', headerName: 'Box Name', sortable: true, filter: true },
    {
      field: 'execution_order',
      headerName: 'Execution Order',
      width: 100,
      cellRenderer: 'executionOrderButtonRenderer',
      cellRendererParams: { jobNameField: 'load_job' },
      cellStyle: {
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'center',
        padding: '0',
        height: '100%',
      },
      sortable: false,
      filter: false,
      resizable: false,
      pinned: 'right' as const,
    },
  ],
}

function parseFixture(): CategoryConfigV4 {
  // Round-tripping through Zod parse confirms the fixture matches the
  // contract Plan 01 publishes; if it ever drifts, this throws loudly.
  return CategoryConfigV4Schema.parse(fileNameCategoryFixture)
}

describe('configCategoryToColDefs — fileName category', () => {
  it('produces 15 ColDefs in the same order as the JSON columns array', () => {
    const cat = parseFixture()
    const cols = configCategoryToColDefs(cat)

    expect(cols).toHaveLength(15)
    expect(cols.map((c) => c.field)).toEqual([
      'file_name_pattern',
      'ok_file_name',
      'job_name',
      'recon_engine',
      'app_name',
      'app_id',
      'support_email',
      'support_hotline',
      'receive_path',
      'recon',
      'set_id',
      'sub_acc',
      'load_job',
      'box_name',
      'execution_order',
    ])
  })

  it('maps headerName verbatim from JSON', () => {
    const cols = configCategoryToColDefs(parseFixture())
    expect(cols[0].headerName).toBe('File Name')
    expect(cols[14].headerName).toBe('Execution Order')
  })

  it('preserves rowGroup + hide for file_name_pattern', () => {
    const cols = configCategoryToColDefs(parseFixture())
    const c = cols.find((col) => col.field === 'file_name_pattern')!
    expect(c.rowGroup).toBe(true)
    expect(c.hide).toBe(true)
  })

  it('resolves known cellRenderer string keys via the registry (identity equality)', () => {
    const cols = configCategoryToColDefs(parseFixture())
    expect(cols.find((c) => c.field === 'app_id')!.cellRenderer).toBe(AppIDCellRenderer)
    expect(cols.find((c) => c.field === 'support_email')!.cellRenderer).toBe(SupportEmailCellRenderer)
    expect(cols.find((c) => c.field === 'execution_order')!.cellRenderer).toBe(ExecutionOrderCellRenderer)
  })

  it('forwards execution_order column attributes (pinned, sortable=false, filter=false, cellRendererParams)', () => {
    const cols = configCategoryToColDefs(parseFixture())
    const exec = cols.find((c) => c.field === 'execution_order')!
    expect(exec.pinned).toBe('right')
    expect(exec.sortable).toBe(false)
    expect(exec.filter).toBe(false)
    expect(exec.resizable).toBe(false)
    expect(exec.width).toBe(100)
    expect(exec.cellRendererParams).toEqual({ jobNameField: 'load_job' })
  })

  it('converts kebab-case cellStyle keys to camelCase before AG-Grid sees them', () => {
    const cols = configCategoryToColDefs(parseFixture())
    const exec = cols.find((c) => c.field === 'execution_order')!
    expect(exec.cellStyle).toEqual({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0',
      height: '100%',
    })
  })

  it('omits cellRenderer (undefined) when JSON omits it', () => {
    const cols = configCategoryToColDefs(parseFixture())
    const c = cols.find((col) => col.field === 'support_hotline')!
    expect(c.cellRenderer).toBeUndefined()
  })

  it('defaults sortable to true when JSON omits sortable', () => {
    const cat = parseFixture()
    // Inject a row without sortable to exercise the default branch:
    const cols = configCategoryToColDefs({
      ...cat,
      columns: [{ field: 'no_sort_col', headerName: 'No Sort' }],
    })
    expect(cols[0].sortable).toBe(true)
  })

  it('maps filter: true → agTextColumnFilter; filter: false → false', () => {
    const cols = configCategoryToColDefs(parseFixture())
    expect(cols.find((c) => c.field === 'file_name_pattern')!.filter).toBe('agTextColumnFilter')
    expect(cols.find((c) => c.field === 'execution_order')!.filter).toBe(false)
  })

  it('defaults filter to agTextColumnFilter when JSON omits filter', () => {
    const cat = parseFixture()
    const cols = configCategoryToColDefs({
      ...cat,
      columns: [{ field: 'no_filter_col', headerName: 'No Filter' }],
    })
    expect(cols[0].filter).toBe('agTextColumnFilter')
  })

  it('gracefully resolves unknown cellRenderer string keys to undefined (Pitfall 6 fallback)', () => {
    const cat = parseFixture()
    const cols = configCategoryToColDefs({
      ...cat,
      columns: [
        { field: 'unknown_renderer', headerName: 'Unknown', cellRenderer: 'doesNotExistRenderer' },
      ],
    })
    expect(cols[0].cellRenderer).toBeUndefined()
  })
})

describe('toCamelCaseStyle helper', () => {
  it('returns an empty object for an empty input', () => {
    expect(toCamelCaseStyle({})).toEqual({})
  })

  it('converts a single kebab-case key', () => {
    expect(toCamelCaseStyle({ 'align-items': 'center' })).toEqual({ alignItems: 'center' })
  })

  it('passes camelCase keys through unchanged', () => {
    expect(toCamelCaseStyle({ display: 'flex', padding: '0' })).toEqual({ display: 'flex', padding: '0' })
  })

  it('converts multi-segment kebab keys', () => {
    expect(toCamelCaseStyle({ 'border-top-left-radius': '4px' })).toEqual({ borderTopLeftRadius: '4px' })
  })
})
