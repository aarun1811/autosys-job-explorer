import { describe, it, expect } from 'vitest'
import { gridTheme } from '@/search/lib/gridTheme'

// ThemeImpl serializes params as an array of PartImpl objects. We locate our
// withParams entry by its accentColor value (`var(--color-primary)`), not by
// position, then verify only the values we actually set — not the base
// themeQuartz defaults, which contain hex internally.
function ourParams(theme: object): string {
  const parsed = JSON.parse(JSON.stringify(theme)) as {
    parts: Array<{ modeParams?: Record<string, Record<string, unknown>> }>
  }
  // Find the part whose $default has accentColor set to our var token
  const ourPart = parsed.parts.find(
    (p) => p.modeParams?.['$default']?.['accentColor'] === 'var(--color-primary)',
  )
  return JSON.stringify(ourPart?.modeParams?.['$default'] ?? {})
}

describe('gridTheme', () => {
  it('is a constructed AG-Grid Theme object (has Theming-API marker methods)', () => {
    expect(gridTheme).toBeDefined()
    expect(typeof (gridTheme as { withParams?: unknown }).withParams).toBe('function')
  })

  it('wires brand + surface params to oklch CSS tokens (no raw hex)', () => {
    const json = ourParams(gridTheme)
    expect(json).toContain('var(--color-primary)')
    expect(json).toContain('var(--color-background)')
    expect(json).toContain('var(--color-foreground)')
    expect(json).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('disables zebra striping (odd rows transparent)', () => {
    const params = JSON.parse(ourParams(gridTheme)) as Record<string, unknown>
    expect(params['oddRowBackgroundColor']).toBe('transparent')
  })

  it('keeps row hover distinct from selected row', () => {
    const params = JSON.parse(ourParams(gridTheme)) as Record<string, unknown>
    expect(params['rowHoverColor']).not.toBe(params['selectedRowBackgroundColor'])
  })

  it('injects the body-treatment CSS via the custom part', () => {
    const json = JSON.stringify(gridTheme)
    expect(json).toContain('font-variant-numeric: tabular-nums')
    expect(json).toContain('.ag-row-selected')
    expect(json).toContain('.ag-row-group-expanded')
  })
})
