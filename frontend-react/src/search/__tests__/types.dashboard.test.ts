import { describe, it, expect } from 'vitest'
import { CategoryResultV4Schema, CategoryConfigV4Schema, SearchConfigurationV4Schema } from '@/search/types'

const baseResult = { key: 'k', label: 'L', values: [], count: 0, hasMore: false, columns: [] }

describe('dashboard schema', () => {
  it('CategoryResultV4Schema accepts a result with a dashboard', () => {
    const r = CategoryResultV4Schema.parse({ ...baseResult, dashboard: { url: 'https://x/{q}', title: 'T', defaultOpen: true, height: 320 } })
    expect(r.dashboard?.url).toBe('https://x/{q}')
  })
  it('CategoryResultV4Schema accepts a result without a dashboard', () => {
    expect(CategoryResultV4Schema.parse(baseResult).dashboard).toBeUndefined()
  })
  it('CategoryResultV4Schema rejects a dashboard with a non-string url', () => {
    expect(() => CategoryResultV4Schema.parse({ ...baseResult, dashboard: { url: 42 } })).toThrow()
  })
  it('CategoryConfigV4Schema accepts a dashboard-only category (no elasticsearch/oracle/columns)', () => {
    expect(() => CategoryConfigV4Schema.parse({ key: 'overview', label: 'Overview', searchColumn: '', dashboard: { url: 'u' } })).not.toThrow()
  })
  it('SearchConfigurationV4Schema accepts a mix of grid + dashboard-only categories', () => {
    const grid = { key: 'jobName', label: 'Job', searchColumn: 'job_name', elasticsearch: {}, oracle: {}, columns: [{ field: 'job_name', headerName: 'Job' }] }
    const dashOnly = { key: 'overview', label: 'Overview', searchColumn: '', dashboard: { url: 'u' } }
    expect(() => SearchConfigurationV4Schema.parse({ categories: [grid, dashOnly] })).not.toThrow()
  })
})
