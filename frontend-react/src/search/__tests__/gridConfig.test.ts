// src/search/__tests__/gridConfig.test.ts
import { describe, test, expect } from 'vitest'
import { rowHeightForDensity, headerHeightForDensity, GRID_SIDEBAR } from '@/search/lib/gridConfig'

describe('gridConfig', () => {
  test('rowHeightForDensity + headerHeightForDensity match Angular (24/32, 32/36)', () => {
    expect(rowHeightForDensity('compact')).toBe(24)
    expect(rowHeightForDensity('normal')).toBe(32)
    expect(headerHeightForDensity('compact')).toBe(32)
    expect(headerHeightForDensity('normal')).toBe(36)
  })

  test('sidebar opens to a clean Columns panel (no pivot/values clutter)', () => {
    const panels = GRID_SIDEBAR.toolPanels as Array<{ id: string; toolPanelParams?: Record<string, unknown> }>
    expect(panels.map((p) => p.id)).toEqual(['columns', 'filters'])
    const columns = panels[0].toolPanelParams
    expect(columns?.suppressValues).toBe(true)
    expect(columns?.suppressPivots).toBe(true)
    expect(columns?.suppressPivotMode).toBe(true)
    expect(GRID_SIDEBAR.position).toBe('right')
    expect(GRID_SIDEBAR.defaultToolPanel).toBe('')
  })
})
