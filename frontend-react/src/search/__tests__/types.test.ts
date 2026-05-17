import { describe, test, expect } from 'vitest'
import {
  ColumnDefinitionV4Schema,
  CategoryConfigV4Schema,
  SearchConfigurationV4Schema,
  InitialFilterSchema,
  CategoryResultV4Schema,
  InitialSearchResponseV4Schema,
  SortModelItemSchema,
  SSRMRequestV4Schema,
  type ColumnDefinitionV4,
  type CategoryConfigV4,
  type SearchConfigurationV4,
  type InitialFilter,
  type InitialSearchResponseV4,
  type SSRMRequestV4,
} from '../types'

// Fixture: the `execution_order` column from search-config-v4.json line 31-35.
// Exercises every optional/conditional field — cellStyle with kebab-case keys,
// cellRendererParams, pinned: 'right', sortable/filter: false, width.
const executionOrderColumn = {
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
  pinned: 'right',
}

// Fixture: the full `fileName` category entry from search-config-v4.json lines 3-37.
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
    { field: 'ok_file_name', headerName: 'OK File Name', sortable: true, filter: true },
    { field: 'job_name', headerName: 'Job Name', sortable: true, filter: true },
    executionOrderColumn,
  ],
}

describe('search/types Zod schemas', () => {
  describe('ColumnDefinitionV4Schema', () => {
    test('accepts the execution_order column from search-config-v4.json', () => {
      const result = ColumnDefinitionV4Schema.parse(executionOrderColumn)
      expect(result.field).toBe('execution_order')
      expect(result.pinned).toBe('right')
      expect(result.sortable).toBe(false)
      expect(result.cellRendererParams).toEqual({ jobNameField: 'load_job' })
      expect(result.cellStyle).toBeDefined()
      // cellStyle preserves kebab-case keys at parse time — adapter converts in Plan 04
      expect(result.cellStyle?.['align-items']).toBe('center')
      expect(result.cellStyle?.['justify-content']).toBe('center')
    })

    test('accepts a minimal column (only field + headerName)', () => {
      const minimal = { field: 'recon', headerName: 'Recon Name' }
      const result = ColumnDefinitionV4Schema.parse(minimal)
      expect(result.field).toBe('recon')
      expect(result.headerName).toBe('Recon Name')
      expect(result.rowGroup).toBeUndefined()
    })

    test('rejects column missing required field', () => {
      expect(() => ColumnDefinitionV4Schema.parse({ headerName: 'Missing field' })).toThrow()
    })

    test('rejects column missing required headerName', () => {
      expect(() => ColumnDefinitionV4Schema.parse({ field: 'no_header' })).toThrow()
    })

    test('rejects invalid pinned value (must be left|right|null|undefined)', () => {
      expect(() =>
        ColumnDefinitionV4Schema.parse({ field: 'x', headerName: 'X', pinned: 'top' }),
      ).toThrow()
    })
  })

  describe('CategoryConfigV4Schema', () => {
    test('accepts the full fileName category entry', () => {
      const result = CategoryConfigV4Schema.parse(fileNameCategory)
      expect(result.key).toBe('fileName')
      expect(result.label).toBe('File Name')
      expect(result.searchColumn).toBe('file_name_pattern')
      expect(result.columns).toHaveLength(4)
      expect(result.elasticsearch).toMatchObject({ index: 'rectrace_core_index' })
    })

    test('rejects category missing required key', () => {
      const bad = { ...fileNameCategory } as Record<string, unknown>
      delete bad.key
      expect(() => CategoryConfigV4Schema.parse(bad)).toThrow()
    })
  })

  describe('SearchConfigurationV4Schema', () => {
    test('accepts { categories: [<fileName entry>] } and exposes typed result', () => {
      const result: SearchConfigurationV4 = SearchConfigurationV4Schema.parse({
        categories: [fileNameCategory],
      })
      expect(result.categories[0].key).toBe('fileName')
      // Compile-time + runtime check: types flow through.
      const cat: CategoryConfigV4 = result.categories[0]
      const col: ColumnDefinitionV4 = cat.columns[0]
      expect(col.field).toBe('file_name_pattern')
    })

    test('rejects payload missing categories array', () => {
      expect(() => SearchConfigurationV4Schema.parse({ wrong: true })).toThrow()
    })
  })

  describe('InitialFilterSchema', () => {
    test('accepts { column, values }', () => {
      const f: InitialFilter = InitialFilterSchema.parse({
        column: 'file_name_pattern',
        values: ['a.csv', 'b.csv'],
      })
      expect(f.column).toBe('file_name_pattern')
      expect(f.values).toHaveLength(2)
    })

    test('rejects when values is not a string array', () => {
      expect(() =>
        InitialFilterSchema.parse({ column: 'x', values: [1, 2] }),
      ).toThrow()
    })
  })

  describe('CategoryResultV4Schema', () => {
    test('accepts { category, initialFilter }', () => {
      const result = CategoryResultV4Schema.parse({
        category: 'fileName',
        initialFilter: { column: 'file_name_pattern', values: ['x.csv'] },
      })
      expect(result.category).toBe('fileName')
      expect(result.initialFilter.values).toEqual(['x.csv'])
    })
  })

  describe('InitialSearchResponseV4Schema', () => {
    test('accepts a categoryResults record keyed by category id', () => {
      const result: InitialSearchResponseV4 = InitialSearchResponseV4Schema.parse({
        categoryResults: {
          fileName: {
            category: 'fileName',
            initialFilter: { column: 'file_name_pattern', values: ['x.csv'] },
          },
        },
      })
      expect(result.categoryResults.fileName.category).toBe('fileName')
      expect(result.categoryResults.fileName.initialFilter.values).toEqual(['x.csv'])
    })
  })

  describe('SortModelItemSchema', () => {
    test('accepts { colId, sort: asc }', () => {
      const r = SortModelItemSchema.parse({ colId: 'job_name', sort: 'asc' })
      expect(r.sort).toBe('asc')
    })
    test('rejects sort other than asc|desc', () => {
      expect(() => SortModelItemSchema.parse({ colId: 'x', sort: 'sideways' })).toThrow()
    })
  })

  describe('SSRMRequestV4Schema', () => {
    test('accepts a full SSRM body', () => {
      const body: SSRMRequestV4 = SSRMRequestV4Schema.parse({
        category: 'fileName',
        initialFilter: { column: 'file_name_pattern', values: ['x.csv', 'y.csv'] },
        rowGroupCols: ['file_name_pattern'],
        groupKeys: [],
        startRow: 0,
        endRow: 100,
        sortModel: [{ colId: 'job_name', sort: 'asc' }],
        filterModel: { job_name: { filterType: 'text', type: 'contains', filter: 'foo' } },
        visibleColumns: ['file_name_pattern', 'job_name'],
      })
      expect(body.startRow).toBe(0)
      expect(body.endRow).toBe(100)
      expect(body.sortModel[0].sort).toBe('asc')
      expect(body.initialFilter?.values).toHaveLength(2)
    })

    test('accepts null initialFilter (group expansion case)', () => {
      const body = SSRMRequestV4Schema.parse({
        category: 'fileName',
        initialFilter: null,
        rowGroupCols: [],
        groupKeys: [],
        startRow: 0,
        endRow: 100,
        sortModel: [],
        filterModel: {},
        visibleColumns: [],
      })
      expect(body.initialFilter).toBeNull()
    })

    test('rejects body missing required numeric startRow', () => {
      expect(() =>
        SSRMRequestV4Schema.parse({
          category: 'fileName',
          initialFilter: null,
          rowGroupCols: [],
          groupKeys: [],
          endRow: 100,
          sortModel: [],
          filterModel: {},
          visibleColumns: [],
        }),
      ).toThrow()
    })
  })
})
