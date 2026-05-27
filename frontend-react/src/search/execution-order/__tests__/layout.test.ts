import { describe, test, expect } from 'vitest'
import { buildGraphFromData } from '../layout'
import type { ExecutionOrderData } from '../types'

function makeData(): ExecutionOrderData {
  return {
    loadJob: 'LOAD-ABC-123',
    executionSequence: [
      { jobName: 'PRE-LOAD-ABC-123', loadJob: 'LOAD-ABC-123', executionOrder: 1 },
      { jobName: 'MAIN-LOAD-ABC-123', loadJob: 'LOAD-ABC-123', executionOrder: 2 },
      { jobName: 'POST-LOAD-ABC-123', loadJob: 'LOAD-ABC-123', executionOrder: 3 },
    ],
    jobDetails: {
      'PRE-LOAD-ABC-123': { jobType: 'CMD', machine: 'm', runCalendar: '', excludeCalendar: '', boxName: 'BOX-ABC-123', command: '', description: '' },
    },
    jobStatuses: {
      'PRE-LOAD-ABC-123': { jobName: 'PRE-LOAD-ABC-123', status: 4, statusName: 'Success', nextStartEpoch: null, nextStartFormatted: null, scheduledToday: false, currentlyActive: false, visualState: 'COMPLETED' },
    },
    statusAvailable: true,
  }
}

describe('buildGraphFromData', () => {
  test('produces one node per sequence entry and chains edges i -> i+1', () => {
    const { nodes, edges } = buildGraphFromData(makeData())
    expect(nodes.map((n) => n.id)).toEqual(['PRE-LOAD-ABC-123', 'MAIN-LOAD-ABC-123', 'POST-LOAD-ABC-123'])
    expect(edges.map((e) => e.id)).toEqual(['PRE-LOAD-ABC-123__MAIN-LOAD-ABC-123', 'MAIN-LOAD-ABC-123__POST-LOAD-ABC-123'])
    expect(edges.every((e) => e.type === 'smoothstep')).toBe(true)
  })

  test('lays out top-to-bottom (monotonically increasing y in sequence order)', () => {
    const { nodes } = buildGraphFromData(makeData())
    expect(nodes[0].position.y).toBeLessThan(nodes[1].position.y)
    expect(nodes[1].position.y).toBeLessThan(nodes[2].position.y)
  })

  test('resolves node data: status, label, jobType, isLoadJob, statusLabel', () => {
    const { nodes } = buildGraphFromData(makeData())
    const pre = nodes[0]
    expect(pre.data.visualState).toBe('COMPLETED')
    expect(pre.data.statusLabel).toBe('Success')
    expect(pre.data.jobType).toBe('CMD')
    expect(pre.data.label).toBe('PRE-LOAD-ABC-123')
    expect(pre.data.isLoadJob).toBe(false)
    // Jobs without a status default to INACTIVE with no status label.
    expect(nodes[1].data.visualState).toBe('INACTIVE')
    expect(nodes[1].data.statusLabel).toBe('')
  })

  test('handles an empty sequence without throwing', () => {
    const empty: ExecutionOrderData = { loadJob: 'L', executionSequence: [], jobDetails: {}, jobStatuses: null, statusAvailable: false }
    expect(buildGraphFromData(empty)).toEqual({ nodes: [], edges: [] })
  })
})
