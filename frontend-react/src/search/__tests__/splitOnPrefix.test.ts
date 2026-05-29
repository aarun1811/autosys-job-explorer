import { describe, test, expect } from 'vitest'
import { splitOnPrefix } from '@/search/lib/splitOnPrefix'

describe('splitOnPrefix', () => {
  test('splits head (typed prefix) and tail when text starts with query', () => {
    expect(splitOnPrefix('trades', 'tra')).toEqual({ head: 'tra', tail: 'des' })
  })
  test('preserves the original casing of the head from the text', () => {
    expect(splitOnPrefix('TRADES', 'tra')).toEqual({ head: 'TRA', tail: 'DES' })
  })
  test('non-prefix match → empty head, whole text as tail', () => {
    expect(splitOnPrefix('box', 'tra')).toEqual({ head: '', tail: 'box' })
  })
  test('empty / whitespace query → empty head', () => {
    expect(splitOnPrefix('trade', '')).toEqual({ head: '', tail: 'trade' })
    expect(splitOnPrefix('trade', '   ')).toEqual({ head: '', tail: 'trade' })
  })
})
