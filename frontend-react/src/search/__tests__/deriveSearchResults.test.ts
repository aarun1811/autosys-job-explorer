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
})
