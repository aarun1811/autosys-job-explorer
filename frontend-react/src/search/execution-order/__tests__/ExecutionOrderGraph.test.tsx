import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ nodes }: { nodes: unknown[] }) => (
    <div data-testid="rf" data-node-count={nodes.length} />
  ),
  Background: () => null,
  BackgroundVariant: { Dots: 'dots' },
  Controls: () => null,
  MiniMap: () => null,
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

describe('ExecutionOrderGraph', () => {
  test('adapts the DTO into React Flow nodes (one per sequence entry)', () => {
    render(<ExecutionOrderGraph data={data} onSelect={vi.fn()} />)
    expect(screen.getByTestId('rf').getAttribute('data-node-count')).toBe('3')
  })
})
