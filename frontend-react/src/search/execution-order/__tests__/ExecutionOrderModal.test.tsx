import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../ExecutionOrderGraph', () => ({
  ExecutionOrderGraph: () => <div data-testid="eo-graph-mock" />,
}))

import { ExecutionOrderModal } from '../ExecutionOrderModal'
import type { ExecutionOrderData } from '../types'

function base(overrides: Partial<ExecutionOrderData> = {}): ExecutionOrderData {
  return {
    loadJob: 'LOAD-ABC-123',
    executionSequence: [
      { jobName: 'PRE-LOAD-ABC-123', loadJob: 'LOAD-ABC-123', executionOrder: 1 },
    ],
    jobDetails: {}, jobStatuses: null, statusAvailable: true, ...overrides,
  }
}

describe('ExecutionOrderModal', () => {
  test('renders the header with the load job and the graph', () => {
    render(<ExecutionOrderModal data={base()} jobName="LOAD-ABC-123" open onOpenChange={vi.fn()} />)
    expect(screen.getByText('Job Execution Order')).toBeInTheDocument()
    expect(screen.getByText('LOAD-ABC-123')).toBeInTheDocument()
    expect(screen.getByTestId('eo-graph-mock')).toBeInTheDocument()
  })

  test('shows the legend when statusAvailable is true', () => {
    render(<ExecutionOrderModal data={base({ statusAvailable: true })} jobName="LOAD-ABC-123" open onOpenChange={vi.fn()} />)
    expect(screen.getByTestId('eo-legend')).toBeInTheDocument()
  })

  test('shows the "live status unavailable" note (no legend) when statusAvailable is false', () => {
    render(<ExecutionOrderModal data={base({ statusAvailable: false })} jobName="LOAD-ABC-123" open onOpenChange={vi.fn()} />)
    expect(screen.getByTestId('eo-status-unavailable')).toBeInTheDocument()
    expect(screen.queryByTestId('eo-legend')).toBeNull()
  })

  test('shows the empty state when the sequence is empty', () => {
    render(<ExecutionOrderModal data={base({ executionSequence: [] })} jobName="LOAD-ABC-123" open onOpenChange={vi.fn()} />)
    expect(screen.getByTestId('eo-empty')).toBeInTheDocument()
    expect(screen.queryByTestId('eo-graph-mock')).toBeNull()
  })
})
