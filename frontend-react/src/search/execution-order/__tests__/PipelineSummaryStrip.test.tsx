import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../QuickFind', () => ({
  QuickFind: () => <div data-testid="eo-quickfind-mock" />,
}))

import { PipelineSummaryStrip } from '../PipelineSummaryStrip'
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

function data(statusAvailable: boolean, statuses: Record<string, JobStatusInfo> | null): ExecutionOrderData {
  return {
    loadJob: 'L',
    executionSequence: [
      { jobName: 'A', loadJob: 'L', executionOrder: 1 },
      { jobName: 'B', loadJob: 'L', executionOrder: 2 },
      { jobName: 'C', loadJob: 'L', executionOrder: 3 },
    ],
    jobDetails: {}, jobStatuses: statuses, statusAvailable,
  }
}

const noop = () => {}

describe('PipelineSummaryStrip', () => {
  test('renders the segmented bar + counts (no duplicate state pill — header owns it)', () => {
    const d = data(true, {
      A: status({ visualState: 'COMPLETED' }),
      B: status({ visualState: 'RUNNING' }),
      C: status({ visualState: 'FAILED' }),
    })
    render(<PipelineSummaryStrip data={d} onActiveMatch={noop} onMatchesChange={noop} />)
    expect(screen.getByText(/3 jobs/i)).toBeInTheDocument()
    expect(screen.getByText(/1 done/i)).toBeInTheDocument()
    expect(screen.getByText(/1 running/i)).toBeInTheDocument()
    expect(screen.getByText(/·\s*1 failed/i)).toBeInTheDocument()
    expect(screen.getByTestId('eo-segbar')).toBeInTheDocument()
    expect(screen.getByTestId('eo-quickfind-mock')).toBeInTheDocument()
    // The strip no longer renders its own state pill (deduped — the modal header
    // carries the single "Attention — N failed" pill).
    expect(screen.queryByTestId('eo-state-pill')).toBeNull()
  })

  test('collapses to a quiet "Live status unavailable" note when statusAvailable is false', () => {
    render(<PipelineSummaryStrip data={data(false, null)} onActiveMatch={noop} onMatchesChange={noop} />)
    expect(screen.getByTestId('eo-status-unavailable')).toBeInTheDocument()
    expect(screen.queryByTestId('eo-segbar')).toBeNull()
    // QuickFind still available even with no live status.
    expect(screen.getByTestId('eo-quickfind-mock')).toBeInTheDocument()
  })
})
