// src/search/__tests__/gridConfig.test.ts
import { describe, test, expect } from 'vitest'
import { rowHeightForDensity } from '@/search/lib/gridConfig'

describe('gridConfig', () => {
  test('rowHeightForDensity: compact is shorter than normal', () => {
    expect(rowHeightForDensity('compact')).toBe(28)
    expect(rowHeightForDensity('normal')).toBe(36)
  })
})
