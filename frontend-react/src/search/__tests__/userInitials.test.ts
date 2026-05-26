import { describe, test, expect } from 'vitest'
import { userInitials } from '@/search/lib/userInitials'

describe('userInitials', () => {
  test('dotted loginId → first char of first two parts', () => expect(userInitials('john.doe')).toBe('JD'))
  test('multi-part dotted → first two parts only', () => expect(userInitials('a.b.c')).toBe('AB'))
  test('no dot → first two chars upper', () => expect(userInitials('xy123')).toBe('XY'))
  test('single char → that char upper', () => expect(userInitials('z')).toBe('Z'))
  test('empty → empty', () => expect(userInitials('')).toBe(''))
})
