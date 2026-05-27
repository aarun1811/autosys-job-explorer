import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../ExecutionOrderGraph', () => ({
  // Clicking the mock graph drives onSelect, so we can exercise selection state.
  ExecutionOrderGraph: ({ onSelect }: { onSelect: (id: string) => void }) => (
    <button type="button" data-testid="eo-graph-mock" onClick={() => onSelect('PICKED_JOB')}>
      graph
    </button>
  ),
}))
vi.mock('../PipelineSummaryStrip', () => ({
  PipelineSummaryStrip: ({ data }: { data: { statusAvailable: boolean } }) => (
    <div data-testid="eo-strip-mock" data-status-available={String(data.statusAvailable)} />
  ),
}))
vi.mock('../JobInspector', () => ({
  JobInspector: ({ jobName }: { jobName: string | null }) => (
    <div data-testid="eo-inspector-mock">{jobName ?? 'EMPTY'}</div>
  ),
}))

import { ExecutionOrderModal } from '../ExecutionOrderModal'
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

function base(overrides: Partial<ExecutionOrderData> = {}): ExecutionOrderData {
  return {
    loadJob: 'LOAD-ABC-123',
    executionSequence: [{ jobName: 'PRE-LOAD-ABC-123', loadJob: 'LOAD-ABC-123', executionOrder: 1 }],
    jobDetails: {}, jobStatuses: null, statusAvailable: true, ...overrides,
  }
}

describe('ExecutionOrderModal', () => {
  test('renders the header with the load job, the strip, graph, and inspector', () => {
    render(<ExecutionOrderModal data={base()} jobName="LOAD-ABC-123" open onOpenChange={vi.fn()} />)
    expect(screen.getByText('Job Execution Order')).toBeInTheDocument()
    expect(screen.getByText('LOAD-ABC-123')).toBeInTheDocument()
    expect(screen.getByTestId('eo-strip-mock')).toBeInTheDocument()
    expect(screen.getByTestId('eo-graph-mock')).toBeInTheDocument()
    // Nothing selected → inspector shows the empty (RunOverview) state.
    expect(screen.getByTestId('eo-inspector-mock')).toHaveTextContent('EMPTY')
  })

  test('header pipeline-state pill rolls up the run ("Attention — N failed")', () => {
    const data = base({
      executionSequence: [
        { jobName: 'A', loadJob: 'LOAD-ABC-123', executionOrder: 1 },
        { jobName: 'B', loadJob: 'LOAD-ABC-123', executionOrder: 2 },
      ],
      jobStatuses: { A: status({ visualState: 'COMPLETED' }), B: status({ visualState: 'FAILED' }) },
      statusAvailable: true,
    })
    render(<ExecutionOrderModal data={data} jobName="LOAD-ABC-123" open onOpenChange={vi.fn()} />)
    expect(screen.getByTestId('eo-pipeline-pill')).toHaveTextContent(/attention — 1 failed/i)
  })

  test('pipeline-state pill is hidden when statusAvailable is false', () => {
    render(<ExecutionOrderModal data={base({ statusAvailable: false })} jobName="LOAD-ABC-123" open onOpenChange={vi.fn()} />)
    expect(screen.queryByTestId('eo-pipeline-pill')).toBeNull()
    // Strip still renders (it shows its own "unavailable" note).
    expect(screen.getByTestId('eo-strip-mock').getAttribute('data-status-available')).toBe('false')
  })

  test('shows the empty state (no strip / graph) when the sequence is empty', () => {
    render(<ExecutionOrderModal data={base({ executionSequence: [] })} jobName="LOAD-ABC-123" open onOpenChange={vi.fn()} />)
    expect(screen.getByTestId('eo-empty')).toBeInTheDocument()
    expect(screen.queryByTestId('eo-graph-mock')).toBeNull()
    expect(screen.queryByTestId('eo-strip-mock')).toBeNull()
  })

  test('reopening resets the selection back to the run overview (spec §5)', () => {
    const { rerender } = render(
      <ExecutionOrderModal data={base()} jobName="LOAD-ABC-123" open onOpenChange={vi.fn()} />,
    )
    // Select a node via the graph → inspector opens that job.
    fireEvent.click(screen.getByTestId('eo-graph-mock'))
    expect(screen.getByTestId('eo-inspector-mock')).toHaveTextContent('PICKED_JOB')
    // Close, then reopen → selection cleared, inspector back to the empty state.
    rerender(<ExecutionOrderModal data={base()} jobName="LOAD-ABC-123" open={false} onOpenChange={vi.fn()} />)
    rerender(<ExecutionOrderModal data={base()} jobName="LOAD-ABC-123" open onOpenChange={vi.fn()} />)
    expect(screen.getByTestId('eo-inspector-mock')).toHaveTextContent('EMPTY')
  })
})
