import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RunOverview } from '../RunOverview'
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

const data: ExecutionOrderData = {
  loadJob: 'LOAD-ABC-123',
  executionSequence: [
    { jobName: 'A', loadJob: 'LOAD-ABC-123', executionOrder: 1 },
    { jobName: 'B', loadJob: 'LOAD-ABC-123', executionOrder: 2 },
    { jobName: 'C', loadJob: 'LOAD-ABC-123', executionOrder: 3 },
  ],
  jobDetails: {},
  jobStatuses: {
    A: status({ jobName: 'A', visualState: 'COMPLETED', lastStartEpoch: 0, lastEndEpoch: 30 }),
    B: status({ jobName: 'B', visualState: 'FAILED', lastStartEpoch: 0, lastEndEpoch: 600 }),
    C: status({ jobName: 'C', visualState: 'COMPLETED', lastStartEpoch: 0, lastEndEpoch: 90 }),
  },
  statusAvailable: true,
}

describe('RunOverview', () => {
  test('shows load job, total count, rollup state, and the longest-running job', () => {
    render(<RunOverview data={data} />)
    expect(screen.getByText('LOAD-ABC-123')).toBeInTheDocument()
    expect(screen.getByText(/3 jobs/i)).toBeInTheDocument()
    expect(screen.getByText(/attention/i)).toBeInTheDocument() // B is FAILED
    // Longest run = B (600s = 10m).
    expect(screen.getByText('B')).toBeInTheDocument()
    expect(screen.getByText('10m 0s')).toBeInTheDocument()
    expect(screen.getByText(/select a job/i)).toBeInTheDocument()
  })

  test('omits the longest-running row when no run has a duration', () => {
    render(<RunOverview data={{ ...data, jobStatuses: { A: status({ jobName: 'A', visualState: 'WAITING' }) }, statusAvailable: true }} />)
    expect(screen.queryByText(/longest run/i)).toBeNull()
    expect(screen.getByText(/select a job/i)).toBeInTheDocument()
  })
})
