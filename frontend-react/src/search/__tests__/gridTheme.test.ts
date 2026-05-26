import { describe, it, expect } from 'vitest'
import { gridTheme } from '@/search/lib/gridTheme'

// Pull the last modeParams entry that corresponds to our withParams call.
// ThemeImpl serializes params as an array of PartImpl objects; our params land
// in the penultimate entry (the last is the dark-mode override, followed by the
// tabular-nums part). We reach into the serialized structure to verify only the
// values we actually set — not the base themeQuartz defaults, which contain hex
// internally.
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
})
