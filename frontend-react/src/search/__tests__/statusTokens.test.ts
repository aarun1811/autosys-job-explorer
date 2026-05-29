import { describe, test, expect } from 'vitest'
import { tokens } from '@/lib/theme'

describe('execution-order status tokens', () => {
  test('theme.ts exposes the five status tokens as var(--status-*) refs', () => {
    const keys = [
      'statusCompleted', 'statusFailed', 'statusRunning',
      'statusWaiting', 'statusInactive',
    ] as const
    for (const k of keys) {
      expect(tokens[k]).toMatch(/^var\(--status-[a-z]+\)$/)
    }
  })
})
