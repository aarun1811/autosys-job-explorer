import { describe, test, expect } from 'vitest'
import { searchSchema } from '@/routes/search'

describe('searchSchema (/search validateSearch)', () => {
  test('accepts q and tab', () => {
    expect(searchSchema.parse({ q: 'x', tab: 'jobName' })).toEqual({ q: 'x', tab: 'jobName' })
  })
  test('no defaults injected when absent', () => {
    expect(searchSchema.parse({})).toEqual({})
  })
  test('drops the legacy cat param (no longer in the schema)', () => {
    expect(searchSchema.parse({ cat: 'fileName' })).toEqual({})
  })
  test('searchSchema accepts an optional view param', () => {
    expect(searchSchema.parse({ q: 'recon', tab: 'jobName', view: 'abc' })).toMatchObject({ view: 'abc' })
    expect(searchSchema.parse({ q: 'recon' }).view).toBeUndefined()
  })
})
