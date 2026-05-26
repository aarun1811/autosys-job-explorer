// src/search/__tests__/gridViewState.test.ts
import { describe, test, expect } from 'vitest'
import { encodeViewState, decodeViewState, type GridViewState } from '@/search/lib/gridViewState'

const sample: GridViewState = {
  columnState: [{ colId: 'job_name', width: 200, hide: false }],
  filterModel: { job_name: { filterType: 'text', type: 'contains', filter: 'recon' } },
  dedup: false,
  density: 'compact',
  expandedGroups: ['RECON-1', 'GBLCOMMAND'],
}

describe('gridViewState', () => {
  test('encode then decode round-trips the state (incl. expandedGroups)', () => {
    const decoded = decodeViewState(encodeViewState(sample))
    expect(decoded).toEqual(sample)
  })

  test('older links without expandedGroups decode with an empty array', () => {
    const json = JSON.stringify({ columnState: [], filterModel: {}, dedup: false, density: 'normal' })
    const param = btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    const decoded = decodeViewState(param)
    expect(decoded?.expandedGroups).toEqual([])
  })

  test('the encoded param is a non-empty URL-safe string', () => {
    const s = encodeViewState(sample)
    expect(s.length).toBeGreaterThan(0)
    expect(s).not.toMatch(/[+/=]/) // base64url, no +,/,= padding
  })

  test('decoding a malformed param returns null (never throws)', () => {
    expect(decodeViewState('not-base64-$$$')).toBeNull()
    expect(decodeViewState('')).toBeNull()
    expect(decodeViewState(btoa('{"oops":true}'))).toBeNull() // wrong shape
  })
})
