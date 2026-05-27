import type { ReactNode } from 'react'
import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@xyflow/react', () => ({
  // Render children so the conditional <MiniMap/> (a child of <ReactFlow>) is
  // actually exercised by the node-count gate.
  ReactFlow: ({ nodes, children }: { nodes: unknown[]; children?: ReactNode }) => (
    <div data-testid="rf" data-node-count={nodes.length}>{children}</div>
  ),
  Background: () => null,
  BackgroundVariant: { Dots: 'dots' },
  Controls: () => null,
  MiniMap: () => <div data-testid="eo-minimap" />,
  MarkerType: { ArrowClosed: 'arrowclosed' },
  Position: { Top: 'top', Bottom: 'bottom' },
}))

import { ExecutionOrderGraph } from '../ExecutionOrderGraph'
import type { ExecutionOrderData } from '../types'

const data: ExecutionOrderData = {
  loadJob: 'LOAD-ABC-123',
  executionSequence: [
    { jobName: 'PRE-LOAD-ABC-123', loadJob: 'LOAD-ABC-123', executionOrder: 1 },
    { jobName: 'MAIN-LOAD-ABC-123', loadJob: 'LOAD-ABC-123', executionOrder: 2 },
    { jobName: 'POST-LOAD-ABC-123', loadJob: 'LOAD-ABC-123', executionOrder: 3 },
  ],
  jobDetails: {}, jobStatuses: null, statusAvailable: false,
}

const longData: ExecutionOrderData = {
  loadJob: 'L',
  executionSequence: Array.from({ length: 13 }, (_, i) => ({
    jobName: `J${i}`, loadJob: 'L', executionOrder: i + 1,
  })),
  jobDetails: {}, jobStatuses: null, statusAvailable: false,
}

describe('ExecutionOrderGraph', () => {
  test('adapts the DTO into React Flow nodes (one per sequence entry)', () => {
    render(<ExecutionOrderGraph data={data} onSelect={vi.fn()} />)
    expect(screen.getByTestId('rf').getAttribute('data-node-count')).toBe('3')
  })

  test('hides the MiniMap for short sequences (<= 12 nodes)', () => {
    render(<ExecutionOrderGraph data={data} onSelect={vi.fn()} />)
    expect(screen.queryByTestId('eo-minimap')).toBeNull()
  })

  test('shows the MiniMap for long sequences (> 12 nodes)', () => {
    render(<ExecutionOrderGraph data={longData} onSelect={vi.fn()} />)
    expect(screen.getByTestId('eo-minimap')).toBeInTheDocument()
  })
})
