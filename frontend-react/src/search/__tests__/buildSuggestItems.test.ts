import { describe, test, expect } from 'vitest'
import { buildSuggestItems } from '@/search/lib/buildSuggestItems'

describe('buildSuggestItems', () => {
  test('empty query → recents only (capped at 8), typed as recent', () => {
    const recents = Array.from({ length: 12 }, (_, i) => `r${i}`)
    const out = buildSuggestItems(recents, ['s1'], '')
    expect(out).toHaveLength(8)
    expect(out.every((x) => x.type === 'recent')).toBe(true)
    expect(out[0]).toEqual({ type: 'recent', text: 'r0' })
  })

  test('typing → prefix-matched recents (cap 3) first, then suggestions', () => {
    const recents = ['trade', 'tracker', 'transit', 'travel', 'box']
    const out = buildSuggestItems(recents, ['tradex', 'trade-x'], 'tra')
    expect(out.slice(0, 3)).toEqual([
      { type: 'recent', text: 'trade' },
      { type: 'recent', text: 'tracker' },
      { type: 'recent', text: 'transit' },
    ])
    expect(out.slice(3)).toEqual([
      { type: 'suggestion', text: 'tradex' },
      { type: 'suggestion', text: 'trade-x' },
    ])
  })

  test('prefix match is case-insensitive; non-matching recents excluded while typing', () => {
    const out = buildSuggestItems(['TRADE', 'box'], [], 'tr')
    expect(out).toEqual([{ type: 'recent', text: 'TRADE' }])
  })

  test('dedups a recent that also appears as a suggestion (case-insensitive; recent wins)', () => {
    const out = buildSuggestItems(['trade'], ['Trade', 'trades'], 'tr')
    expect(out).toEqual([
      { type: 'recent', text: 'trade' },
      { type: 'suggestion', text: 'trades' },
    ])
  })

  test('caps the total list at 10', () => {
    const suggestions = Array.from({ length: 20 }, (_, i) => `tr${i}`)
    const out = buildSuggestItems([], suggestions, 'tr')
    expect(out).toHaveLength(10)
  })
})
