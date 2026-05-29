import { describe, test, expect } from 'vitest'
import { deriveSearchResults } from '@/search/lib/deriveSearchResults'
import type { InitialSearchResponseV4 } from '@/search/types'

const mk = (key: string, count: number, hasMore = false) => ({
  key,
  label: key,
  values: [] as string[],
  count,
  hasMore,
  columns: [],
})

describe('deriveSearchResults', () => {
  test('filters out count===0 and sorts by count desc', () => {
    const resp = { categoryResults: { a: mk('a', 1), b: mk('b', 5), c: mk('c', 0) } } as unknown as InitialSearchResponseV4
    const out = deriveSearchResults(resp)
    expect(out.map((r) => r.key)).toEqual(['b', 'a'])
  })

  test('all zero → empty', () => {
    const resp = { categoryResults: { a: mk('a', 0) } } as unknown as InitialSearchResponseV4
    expect(deriveSearchResults(resp)).toEqual([])
  })

  test('keeps count>0 grid categories AND dashboard-bearing categories, drops empty grid categories', () => {
    const resp = {
      categoryResults: {
        grid: { ...mk('grid', 1) },
        empty: { ...mk('empty', 0) },
        dash: { ...mk('dash', 0), dashboard: { url: 'u' } },
      },
    } as unknown as InitialSearchResponseV4
    const keys = deriveSearchResults(resp).map((c) => c.key)
    expect(keys).toContain('grid') // count>0 grid kept
    expect(keys).toContain('dash') // dashboard tab survives count 0
    expect(keys).not.toContain('empty') // empty grid category dropped
  })
})
