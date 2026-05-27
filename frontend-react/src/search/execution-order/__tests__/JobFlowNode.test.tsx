import type { ComponentProps } from 'react'
import { describe, test, expect, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

// Capture Handle props so the crosshair regression can assert isConnectable=false.
const handleSpy = vi.fn()
vi.mock('@xyflow/react', () => ({
  Handle: (props: Record<string, unknown>) => {
    handleSpy(props)
    return null
  },
  Position: { Top: 'top', Bottom: 'bottom' },
}))

// NodeRuntimePopover is exercised in its own suite; render it inert here so the
// node test focuses on the resting node + hover trigger wiring.
vi.mock('../NodeRuntimePopover', () => ({
  NodeRuntimePopover: () => <div data-testid="eo-runtime-popover-mock" />,
}))

import { JobFlowNode } from '../JobFlowNode'
import type { JobNodeData } from '../layout'

function renderNode(data: Partial<JobNodeData>, selected = false) {
  // Tests that render twice (e.g. RUNNING then COMPLETED) need the prior tree
  // torn down first; RTL auto-cleanup only runs between tests, not between
  // render() calls within one test, so getByTestId would otherwise see two nodes.
  cleanup()
  handleSpy.mockClear()
  const full: JobNodeData = {
    label: 'PRE-LOAD-ABC-123', ordinal: 3, jobType: 'CMD', visualState: 'RUNNING',
    statusLabel: 'Running', isLoadJob: false, status: null, ...data,
  }
  const props = { data: full, selected } as unknown as ComponentProps<typeof JobFlowNode>
  return render(<JobFlowNode {...props} />)
}

describe('JobFlowNode', () => {
  test('renders the ordinal, job name, and applies the status node class', () => {
    renderNode({ visualState: 'COMPLETED', statusLabel: 'Success' })
    expect(screen.getByText('#3')).toBeInTheDocument()
    expect(screen.getByText('PRE-LOAD-ABC-123')).toBeInTheDocument()
    expect(screen.getByTestId('eo-node')).toHaveClass('eo-node-completed')
  })

  test('renders a left accent bar tinted by status', () => {
    renderNode({ visualState: 'FAILED' })
    expect(screen.getByTestId('eo-accent')).toHaveClass('eo-accent-failed')
  })

  test('pulses only when RUNNING', () => {
    renderNode({ visualState: 'RUNNING' })
    expect(screen.getByTestId('eo-node')).toHaveClass('eo-pulse')
    renderNode({ visualState: 'COMPLETED' })
    expect(screen.getByTestId('eo-node')).not.toHaveClass('eo-pulse')
  })

  test('applies the selection emphasis class when selected', () => {
    renderNode({}, true)
    expect(screen.getByTestId('eo-node')).toHaveClass('eo-node-selected')
  })

  test('dims when data.dimmed is set (quick-find non-match)', () => {
    renderNode({ dimmed: true } as Partial<JobNodeData>)
    expect(screen.getByTestId('eo-node')).toHaveClass('eo-node-dim')
  })

  // Crosshair root-cause regression (spec §5.7): Handles MUST be non-connectable,
  // otherwise React Flow advertises the connection (crosshair) affordance even
  // under nodesConnectable={false}.
  test('renders both handles as NON-connectable (no crosshair affordance)', () => {
    renderNode({})
    expect(handleSpy).toHaveBeenCalledTimes(2)
    for (const call of handleSpy.mock.calls) {
      expect(call[0].isConnectable).toBe(false)
    }
  })
})
