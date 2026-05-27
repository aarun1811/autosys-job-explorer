import type { ComponentProps } from 'react'
import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@xyflow/react', () => ({
  Handle: () => null,
  Position: { Top: 'top', Bottom: 'bottom' },
}))

import { JobFlowNode } from '../JobFlowNode'
import type { JobNodeData } from '../layout'

function renderNode(data: Partial<JobNodeData>, selected = false) {
  const full: JobNodeData = {
    label: 'PRE-LOAD-ABC-123', jobType: 'CMD', visualState: 'RUNNING',
    statusLabel: 'Running', isLoadJob: false, ...data,
  }
  // NodeProps has many fields the node never reads; cast the minimal shape.
  const props = { data: full, selected } as unknown as ComponentProps<typeof JobFlowNode>
  return render(<JobFlowNode {...props} />)
}

describe('JobFlowNode', () => {
  test('renders the job name and the status label', () => {
    renderNode({})
    expect(screen.getByText('PRE-LOAD-ABC-123')).toBeInTheDocument()
    expect(screen.getByText('(Running)')).toBeInTheDocument()
  })

  test('applies the status node class', () => {
    renderNode({ visualState: 'COMPLETED', statusLabel: 'Success' })
    expect(screen.getByTestId('eo-node')).toHaveClass('eo-node-completed')
  })

  test('omits the status line when statusLabel is empty', () => {
    renderNode({ statusLabel: '' })
    expect(screen.queryByText(/\(.*\)/)).toBeNull()
  })
})
