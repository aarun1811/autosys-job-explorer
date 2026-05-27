import { describe, test, expect } from 'vitest'
import {
  isEmptyExecutionOrder,
  formatDuration,
  rollup,
  findMatches,
  pickFocusNodeId,
  type ExecutionOrderData,
  type JobStatusInfo,
} from '../types'

function data(seq: ExecutionOrderData['executionSequence']): ExecutionOrderData {
  return { loadJob: 'L', executionSequence: seq, jobDetails: {}, jobStatuses: null, statusAvailable: false }
}

describe('isEmptyExecutionOrder', () => {
  test('true for null / undefined / missing sequence', () => {
    expect(isEmptyExecutionOrder(null)).toBe(true)
    expect(isEmptyExecutionOrder(undefined)).toBe(true)
    expect(isEmptyExecutionOrder({} as ExecutionOrderData)).toBe(true)
  })
  test('true for an empty sequence array', () => {
    expect(isEmptyExecutionOrder(data([]))).toBe(true)
  })
  test('false when the sequence has at least one node', () => {
    expect(isEmptyExecutionOrder(data([{ jobName: 'A', loadJob: 'L', executionOrder: 1 }]))).toBe(false)
  })
})

function status(over: Partial<JobStatusInfo>): JobStatusInfo {
  return {
    jobName: 'J', status: null, statusName: '',
    nextStartEpoch: null, nextStartFormatted: null,
    lastStartEpoch: null, lastStartFormatted: null,
    lastEndEpoch: null, lastEndFormatted: null,
    exitCode: null, runNum: null, retries: null, runMachine: null, owner: null,
    scheduledToday: false, currentlyActive: false, visualState: 'INACTIVE',
    ...over,
  }
}

function order(seq: string[], statuses: Record<string, JobStatusInfo> | null): ExecutionOrderData {
  return {
    loadJob: 'L',
    executionSequence: seq.map((jobName, i) => ({ jobName, loadJob: 'L', executionOrder: i + 1 })),
    jobDetails: {}, jobStatuses: statuses, statusAvailable: statuses !== null,
  }
}

describe('formatDuration', () => {
  test('returns null when either epoch is null', () => {
    expect(formatDuration(null, 100)).toBeNull()
    expect(formatDuration(100, null)).toBeNull()
  })
  test('returns null for a negative or zero-length span', () => {
    expect(formatDuration(200, 100)).toBeNull()
  })
  test('formats seconds, minutes, and hours (epochs are SECONDS)', () => {
    expect(formatDuration(0, 45)).toBe('45s')
    expect(formatDuration(0, 90)).toBe('1m 30s')
    expect(formatDuration(0, 3600)).toBe('1h 0m')
    expect(formatDuration(0, 3661)).toBe('1h 1m')
  })
})

describe('rollup', () => {
  test('counts per visual state and reports overall FAILED first', () => {
    const r = rollup({
      a: status({ visualState: 'COMPLETED' }),
      b: status({ visualState: 'RUNNING' }),
      c: status({ visualState: 'FAILED' }),
    })
    expect(r.counts.FAILED).toBe(1)
    expect(r.counts.RUNNING).toBe(1)
    expect(r.counts.COMPLETED).toBe(1)
    expect(r.total).toBe(3)
    expect(r.overall).toBe('ATTENTION')
    expect(r.failedCount).toBe(1)
  })
  test('RUNNING when no failures but a run is in flight', () => {
    expect(rollup({ a: status({ visualState: 'RUNNING' }), b: status({ visualState: 'COMPLETED' }) }).overall).toBe('RUNNING')
  })
  test('HEALTHY when everything completed', () => {
    expect(rollup({ a: status({ visualState: 'COMPLETED' }) }).overall).toBe('HEALTHY')
  })
  test('IDLE when only waiting/inactive', () => {
    expect(rollup({ a: status({ visualState: 'WAITING' }), b: status({ visualState: 'INACTIVE' }) }).overall).toBe('IDLE')
  })
  test('null jobStatuses → zeroed rollup, IDLE', () => {
    const r = rollup(null)
    expect(r.total).toBe(0)
    expect(r.overall).toBe('IDLE')
  })
})

describe('findMatches', () => {
  const fixture = order(['PRE-LOAD-ABC', 'MAIN-LOAD-ABC', 'POST-XYZ'], null)
  test('case-insensitive substring on job name, in sequence order', () => {
    expect(findMatches(fixture, 'load')).toEqual(['PRE-LOAD-ABC', 'MAIN-LOAD-ABC'])
  })
  test('empty / whitespace query → no matches', () => {
    expect(findMatches(fixture, '')).toEqual([])
    expect(findMatches(fixture, '   ')).toEqual([])
  })
  test('no substring hit → empty', () => {
    expect(findMatches(fixture, 'zzz')).toEqual([])
  })
})

describe('pickFocusNodeId', () => {
  test('first FAILED wins over later RUNNING and the top node', () => {
    const fixture = order(['A', 'B', 'C'], {
      A: status({ visualState: 'COMPLETED' }),
      B: status({ visualState: 'FAILED' }),
      C: status({ visualState: 'RUNNING' }),
    })
    expect(pickFocusNodeId(fixture)).toBe('B')
  })
  test('first RUNNING when there is no FAILED', () => {
    const fixture = order(['A', 'B', 'C'], {
      A: status({ visualState: 'COMPLETED' }),
      B: status({ visualState: 'RUNNING' }),
    })
    expect(pickFocusNodeId(fixture)).toBe('B')
  })
  test('falls back to the top node when nothing failed or running', () => {
    const fixture = order(['A', 'B'], { A: status({ visualState: 'COMPLETED' }) })
    expect(pickFocusNodeId(fixture)).toBe('A')
  })
  test('null for an empty sequence', () => {
    expect(pickFocusNodeId(order([], null))).toBeNull()
  })
})
