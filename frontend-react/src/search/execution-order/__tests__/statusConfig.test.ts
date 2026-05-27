import { describe, test, expect } from 'vitest'
import { STATUS_CONFIG, VISUAL_STATES, findJobStatus } from '../statusConfig'
import type { JobStatusInfo } from '../types'

describe('STATUS_CONFIG', () => {
  test('covers all five visual states with label + class names', () => {
    expect(VISUAL_STATES).toEqual(['COMPLETED', 'FAILED', 'RUNNING', 'WAITING', 'INACTIVE'])
    for (const s of VISUAL_STATES) {
      const c = STATUS_CONFIG[s]
      expect(c.label.length).toBeGreaterThan(0)
      expect(c.nodeClassName).toBe(`eo-node-${s.toLowerCase()}`)
      expect(c.dotClassName).toBe(`eo-dot-${s.toLowerCase()}`)
      expect(c.badgeClassName).toBe(`eo-badge-${s.toLowerCase()}`)
    }
  })
})

describe('findJobStatus', () => {
  const statuses: Record<string, JobStatusInfo> = {
    'PRE-LOAD-ABC-123': {
      jobName: 'PRE-LOAD-ABC-123', status: 4, statusName: 'Success',
      nextStartEpoch: null, nextStartFormatted: null,
      scheduledToday: false, currentlyActive: false, visualState: 'COMPLETED',
    },
  }
  test('matches case-insensitively', () => {
    expect(findJobStatus(statuses, 'pre-load-abc-123')?.visualState).toBe('COMPLETED')
  })
  test('returns null when absent or when jobStatuses is null', () => {
    expect(findJobStatus(statuses, 'NOPE')).toBeNull()
    expect(findJobStatus(null, 'PRE-LOAD-ABC-123')).toBeNull()
  })
})
