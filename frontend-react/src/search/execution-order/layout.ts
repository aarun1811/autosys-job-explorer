import dagre from 'dagre'
import { Position, type Node, type Edge } from '@xyflow/react'
import type { ExecutionOrderData, VisualState } from './types'
import { findJobStatus } from './statusConfig'

export interface JobNodeData extends Record<string, unknown> {
  label: string
  jobType: string | undefined
  visualState: VisualState
  statusLabel: string
  isLoadJob: boolean
}

export type FlowNode = Node<JobNodeData, 'job'>

const NODE_WIDTH = 200
const NODE_HEIGHT = 56

/**
 * Build React Flow nodes (with dagre-computed top-to-bottom positions) + edges
 * from the execution-order DTO. The sequence is a strict linear chain, so edges
 * connect job[i] -> job[i+1]. Pure — no DOM, safe to unit-test directly.
 */
export function buildGraphFromData(
  data: ExecutionOrderData,
): { nodes: FlowNode[]; edges: Edge[] } {
  const sequence = data.executionSequence ?? []

  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'TB', nodesep: 30, ranksep: 50, marginx: 16, marginy: 16 })
  g.setDefaultEdgeLabel(() => ({}))

  for (const job of sequence) {
    g.setNode(job.jobName, { width: NODE_WIDTH, height: NODE_HEIGHT })
  }

  const edges: Edge[] = []
  for (let i = 0; i < sequence.length - 1; i++) {
    const source = sequence[i].jobName
    const target = sequence[i + 1].jobName
    g.setEdge(source, target)
    edges.push({ id: `${source}__${target}`, source, target, type: 'smoothstep' })
  }

  if (sequence.length > 0) {
    dagre.layout(g)
  }

  const nodes: FlowNode[] = sequence.map((job) => {
    const pos = g.node(job.jobName)
    const status = findJobStatus(data.jobStatuses, job.jobName)
    const visualState: VisualState = status?.visualState ?? 'INACTIVE'
    return {
      id: job.jobName,
      type: 'job',
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
      data: {
        label: job.jobName,
        jobType: data.jobDetails?.[job.jobName]?.jobType,
        visualState,
        statusLabel: data.statusAvailable && status ? status.statusName : '',
        isLoadJob: job.jobName === data.loadJob,
      },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    }
  })

  return { nodes, edges }
}
