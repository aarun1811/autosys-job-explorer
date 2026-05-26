// src/search/__tests__/gridConfig.test.ts
import { describe, test, expect } from 'vitest'
import { rowHeightForDensity, GRID_STATUS_BAR, GRID_ROW_SELECTION } from '@/search/lib/gridConfig'

describe('gridConfig', () => {
  test('rowHeightForDensity: compact is shorter than normal', () => {
    expect(rowHeightForDensity('compact')).toBe(28)
    expect(rowHeightForDensity('normal')).toBe(36)
  })

  test('status bar exposes total, filtered and selected panels', () => {
    const panels = GRID_STATUS_BAR.statusPanels.map((p) => p.statusPanel)
    expect(panels).toEqual([
      'agTotalRowCountComponent',
      'agFilteredRowCountComponent',
      'agSelectedRowCountComponent',
    ])
  })

  test('row selection is multi-row with a header checkbox and no click-select', () => {
    expect(GRID_ROW_SELECTION.mode).toBe('multiRow')
    expect(GRID_ROW_SELECTION.checkboxes).toBe(true)
    expect(GRID_ROW_SELECTION.headerCheckbox).toBe(true)
    expect(GRID_ROW_SELECTION.enableClickSelection).toBe(false)
  })
})
