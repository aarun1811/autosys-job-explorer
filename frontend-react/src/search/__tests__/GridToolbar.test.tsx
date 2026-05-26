// src/search/__tests__/GridToolbar.test.tsx
import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GridToolbar } from '@/search/GridToolbar'
import type { GridDensity } from '@/search/lib/gridConfig'

// Homogeneous map of callback spies (all vi.fn) — kept separate from the
// scalar state props so dynamic indexing stays type-safe under tsc.
function makeSpies() {
  return {
    onToggleSidebar: vi.fn(),
    onToggleDensity: vi.fn(),
    onAutoSize: vi.fn(),
    onResetView: vi.fn(),
    onExpandAll: vi.fn(),
    onCollapseAll: vi.fn(),
    onClearFilters: vi.fn(),
    onRefresh: vi.fn(),
    onToggleDedup: vi.fn(),
    onExportExcel: vi.fn(),
    onCopy: vi.fn(),
    onShare: vi.fn(),
  }
}

function setup(state?: { density?: GridDensity; isDeduplicated?: boolean; isExporting?: boolean }) {
  const spies = makeSpies()
  render(
    <GridToolbar
      density={state?.density ?? 'normal'}
      isDeduplicated={state?.isDeduplicated ?? false}
      isExporting={state?.isExporting ?? false}
      {...spies}
    />,
  )
  return spies
}

describe('GridToolbar', () => {
  test('each toolbar button invokes its handler', () => {
    const spies = setup()
    const cases: [string, keyof ReturnType<typeof makeSpies>][] = [
      ['Toggle columns and filters panel', 'onToggleSidebar'],
      ['Toggle row density', 'onToggleDensity'],
      ['Auto-size columns', 'onAutoSize'],
      ['Reset view', 'onResetView'],
      ['Expand all groups', 'onExpandAll'],
      ['Collapse all groups', 'onCollapseAll'],
      ['Clear filters', 'onClearFilters'],
      ['Refresh', 'onRefresh'],
      ['Remove duplicates', 'onToggleDedup'],
      ['Copy rows to clipboard', 'onCopy'],
      ['Share view', 'onShare'],
    ]
    for (const [label, key] of cases) {
      fireEvent.click(screen.getByRole('button', { name: label }))
      expect(spies[key]).toHaveBeenCalledTimes(1)
    }
  })

  test('density button reflects active (compact) state via aria-pressed', () => {
    setup({ density: 'compact' })
    expect(screen.getByRole('button', { name: 'Toggle row density' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('remove-duplicates button reflects active state via aria-pressed', () => {
    setup({ isDeduplicated: true })
    expect(screen.getByRole('button', { name: 'Remove duplicates' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('Export button triggers export directly on a single click', () => {
    const spies = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Export to Excel' }))
    expect(spies.onExportExcel).toHaveBeenCalledTimes(1)
  })

  test('Export button shows a spinner and is disabled while exporting', () => {
    setup({ isExporting: true })
    const btn = screen.getByRole('button', { name: 'Export to Excel' })
    expect(btn).toBeDisabled()
    expect(btn.querySelector('.animate-spin')).not.toBeNull()
  })
})
