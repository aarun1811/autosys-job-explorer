import { describe, test, expect } from 'vitest'
import { buildGraphFromData } from '../layout'
import type { ExecutionOrderData, JobStatusInfo } from '../types'

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
      'PRE-LOAD-ABC-123': status({ jobName: 'PRE-LOAD-ABC-123', status: 4, statusName: 'Success', visualState: 'COMPLETED' }),
      'MAIN-LOAD-ABC-123': status({ jobName: 'MAIN-LOAD-ABC-123', statusName: 'Failure', visualState: 'FAILED', exitCode: 1 }),
    },
    statusAvailable: true,
  }
}

describe('buildGraphFromData', () => {
  test('produces one node per sequence entry and chains spine edges i -> i+1', () => {
    const { nodes, edges } = buildGraphFromData(makeData())
    expect(nodes.map((n) => n.id)).toEqual(['PRE-LOAD-ABC-123', 'MAIN-LOAD-ABC-123', 'POST-LOAD-ABC-123'])
    expect(edges.map((e) => e.id)).toEqual(['PRE-LOAD-ABC-123__MAIN-LOAD-ABC-123', 'MAIN-LOAD-ABC-123__POST-LOAD-ABC-123'])
  })

  test('spine edges are neutral + non-interactive (no arrowhead, not selectable/focusable)', () => {
    const { edges } = buildGraphFromData(makeData())
    for (const e of edges) {
      expect(e.type).toBe('spine')
      expect(e.selectable).toBe(false)
      expect(e.focusable).toBe(false)
      expect(e.markerEnd).toBeUndefined()
    }
  })

  test('lays out top-to-bottom (monotonically increasing y in sequence order)', () => {
    const { nodes } = buildGraphFromData(makeData())
    expect(nodes[0].position.y).toBeLessThan(nodes[1].position.y)
    expect(nodes[1].position.y).toBeLessThan(nodes[2].position.y)
  })

  test('resolves node data: ordinal, label, jobType, isLoadJob, visualState, statusLabel, runtime', () => {
    const { nodes } = buildGraphFromData(makeData())
    const pre = nodes[0]
    expect(pre.data.ordinal).toBe(1)
    expect(pre.data.visualState).toBe('COMPLETED')
    expect(pre.data.statusLabel).toBe('Success')
    expect(pre.data.jobType).toBe('CMD')
    expect(pre.data.label).toBe('PRE-LOAD-ABC-123')
    expect(pre.data.isLoadJob).toBe(false)
    // The FAILED node threads its status object (runtime gold) for the popover.
    expect(nodes[1].data.status?.exitCode).toBe(1)
    expect(nodes[1].data.ordinal).toBe(2)
    // Jobs without a status default to INACTIVE with no status label + null status.
    expect(nodes[2].data.visualState).toBe('INACTIVE')
    expect(nodes[2].data.statusLabel).toBe('')
    expect(nodes[2].data.status).toBeNull()
  })

  test('focusNodeId is the first FAILED node', () => {
    expect(buildGraphFromData(makeData()).focusNodeId).toBe('MAIN-LOAD-ABC-123')
  })

  test('handles an empty sequence without throwing', () => {
    const empty: ExecutionOrderData = { loadJob: 'L', executionSequence: [], jobDetails: {}, jobStatuses: null, statusAvailable: false }
    expect(buildGraphFromData(empty)).toEqual({ nodes: [], edges: [], focusNodeId: null })
  })
})
