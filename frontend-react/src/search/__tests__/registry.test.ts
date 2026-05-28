import { describe, test, expect } from 'vitest'
import { cellRenderers } from '../renderers/registry'
import { AppIDCellRenderer } from '../renderers/AppIDCellRenderer'
import { SupportEmailCellRenderer } from '../renderers/SupportEmailCellRenderer'
import { ExecutionOrderCellRenderer } from '../renderers/ExecutionOrderCellRenderer'
import { QuickRecStatsCellRenderer } from '../renderers/QuickRecStatsCellRenderer'
import { TlmStatsCellRenderer } from '../renderers/TlmStatsCellRenderer'

describe('cellRenderers registry', () => {
  test('appIDCellRenderer key maps to AppIDCellRenderer component', () => {
    expect(cellRenderers.appIDCellRenderer).toBe(AppIDCellRenderer)
  })

  test('supportEmailCellRenderer key maps to SupportEmailCellRenderer component', () => {
    expect(cellRenderers.supportEmailCellRenderer).toBe(SupportEmailCellRenderer)
  })

  test('executionOrderButtonRenderer key maps to ExecutionOrderCellRenderer component', () => {
    expect(cellRenderers.executionOrderButtonRenderer).toBe(ExecutionOrderCellRenderer)
  })

  test('quickRecStatsButtonRenderer key maps to QuickRecStatsCellRenderer component', () => {
    expect(cellRenderers.quickRecStatsButtonRenderer).toBe(QuickRecStatsCellRenderer)
  })

  test('tlmStatsButtonRenderer key maps to TlmStatsCellRenderer component', () => {
    expect(cellRenderers.tlmStatsButtonRenderer).toBe(TlmStatsCellRenderer)
  })

  test('registry contains exactly 5 keys (regression guard for accidental drift)', () => {
    expect(Object.keys(cellRenderers).length).toBe(5)
  })

  test('unknown key resolves to undefined — adapter falls back to default text renderer', () => {
    expect(cellRenderers['unknownKey']).toBeUndefined()
  })
})
