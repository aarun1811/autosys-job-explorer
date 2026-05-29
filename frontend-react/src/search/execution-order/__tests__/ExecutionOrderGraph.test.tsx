import type { ReactNode } from 'react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const setCenter = vi.fn()
const fitView = vi.fn()

vi.mock('@xyflow/react', () => ({
  ReactFlowProvider: ({ children }: { children?: ReactNode }) => <div data-testid="rf-provider">{children}</div>,
  ReactFlow: ({ nodes, children }: { nodes: { id: string; data: { dimmed?: boolean } }[]; children?: ReactNode }) => (
    <div
      data-testid="rf"
      data-node-count={nodes.length}
      data-dimmed={nodes.filter((n) => n.data.dimmed).map((n) => n.id).join(',')}
    >
      {children}
    </div>
  ),
  Background: () => null,
  BackgroundVariant: { Dots: 'dots' },
  Controls: ({ children }: { children?: ReactNode }) => <div data-testid="eo-controls">{children}</div>,
  ControlButton: ({ children, ...rest }: { children?: ReactNode }) => <button type="button" {...rest}>{children}</button>,
  MiniMap: () => <div data-testid="eo-minimap" />,
  BaseEdge: () => null,
  getSmoothStepPath: () => ['', 0, 0],
  Position: { Top: 'top', Bottom: 'bottom' },
  useReactFlow: () => ({ setCenter, fitView, getNode: (id: string) => ({ id, position: { x: 0, y: 0 }, width: 240, height: 60 }) }),
}))

import { ExecutionOrderGraph } from '../ExecutionOrderGraph'
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
    { jobName: 'PRE-LOAD-ABC-123', loadJob: 'LOAD-ABC-123', executionOrder: 1 },
    { jobName: 'MAIN-LOAD-ABC-123', loadJob: 'LOAD-ABC-123', executionOrder: 2 },
    { jobName: 'POST-LOAD-ABC-123', loadJob: 'LOAD-ABC-123', executionOrder: 3 },
  ],
  jobDetails: {}, jobStatuses: { 'MAIN-LOAD-ABC-123': status({ jobName: 'MAIN-LOAD-ABC-123', visualState: 'FAILED' }) },
  statusAvailable: true,
}

const longData: ExecutionOrderData = {
  loadJob: 'L',
  executionSequence: Array.from({ length: 13 }, (_, i) => ({ jobName: `J${i}`, loadJob: 'L', executionOrder: i + 1 })),
  jobDetails: {}, jobStatuses: null, statusAvailable: false,
}

beforeEach(() => { setCenter.mockClear(); fitView.mockClear() })

describe('ExecutionOrderGraph', () => {
  test('wraps the body in a ReactFlowProvider and adapts the DTO into nodes', () => {
    render(<ExecutionOrderGraph data={data} selected={null} matches={[]} onSelect={vi.fn()} />)
    expect(screen.getByTestId('rf-provider')).toBeInTheDocument()
    expect(screen.getByTestId('rf').getAttribute('data-node-count')).toBe('3')
  })

  test('hides the MiniMap for short sequences (<= 12 nodes)', () => {
    render(<ExecutionOrderGraph data={data} selected={null} matches={[]} onSelect={vi.fn()} />)
    expect(screen.queryByTestId('eo-minimap')).toBeNull()
  })

  test('shows the MiniMap for long sequences (> 12 nodes)', () => {
    render(<ExecutionOrderGraph data={longData} selected={null} matches={[]} onSelect={vi.fn()} />)
    expect(screen.getByTestId('eo-minimap')).toBeInTheDocument()
  })

  test('smart-focus centers on the first FAILED node on mount', () => {
    render(<ExecutionOrderGraph data={data} selected={null} matches={[]} onSelect={vi.fn()} />)
    expect(setCenter).toHaveBeenCalled()
  })

  test('quick-find non-matches are dimmed via node data.dimmed', () => {
    render(<ExecutionOrderGraph data={data} selected={null} matches={['MAIN-LOAD-ABC-123']} onSelect={vi.fn()} />)
    // PRE + POST are non-matches → dimmed; MAIN (the match) is not.
    expect(screen.getByTestId('rf').getAttribute('data-dimmed')).toBe('PRE-LOAD-ABC-123,POST-LOAD-ABC-123')
  })

  test('renders zoom / fit / recenter controls', () => {
    render(<ExecutionOrderGraph data={data} selected={null} matches={[]} onSelect={vi.fn()} />)
    expect(screen.getByTestId('eo-controls')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /fit all/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /re-center/i })).toBeInTheDocument()
  })
})
