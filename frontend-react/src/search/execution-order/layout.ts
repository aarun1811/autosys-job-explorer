import dagre from 'dagre'
import { Position, type Node, type Edge } from '@xyflow/react'
import type { ExecutionOrderData, VisualState, JobStatusInfo } from './types'
import { findJobStatus } from './statusConfig'
import { pickFocusNodeId } from './types'

export interface JobNodeData extends Record<string, unknown> {
  label: string
  ordinal: number
  jobType: string | undefined
  visualState: VisualState
  statusLabel: string
  isLoadJob: boolean
  /** Full status object (runtime gold) for the hover popover; null when no live status. */
  status: JobStatusInfo | null
  /** Set by ExecutionOrderGraph for quick-find / select-emphasis dimming (not by buildGraphFromData). */
  dimmed?: boolean
}

export type FlowNode = Node<JobNodeData, 'job'>

const NODE_WIDTH = 240
const NODE_HEIGHT = 60

/**
 * Build React Flow nodes (dagre TB positions) + edges from the execution-order
 * DTO. The sequence is a topological flattening, so edges connect job[i] ->
 * job[i+1] as a NEUTRAL ORDER RAIL — not causal arrows: no markerEnd, and
 * selectable/focusable false so the spine is never an interaction surface
 * (spec §5.3). Also returns the smart-focus node id (first FAILED -> RUNNING ->
 * top). Pure — no DOM, safe to unit-test directly.
 */
export function buildGraphFromData(
  data: ExecutionOrderData,
): { nodes: FlowNode[]; edges: Edge[]; focusNodeId: string | null } {
  const sequence = data.executionSequence ?? []

  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'TB', nodesep: 28, ranksep: 44, marginx: 16, marginy: 16 })
  g.setDefaultEdgeLabel(() => ({}))

  for (const job of sequence) {
    g.setNode(job.jobName, { width: NODE_WIDTH, height: NODE_HEIGHT })
  }

  const edges: Edge[] = []
  for (let i = 0; i < sequence.length - 1; i++) {
    const source = sequence[i].jobName
    const target = sequence[i + 1].jobName
    g.setEdge(source, target)
    edges.push({
      id: `${source}__${target}`,
      source,
      target,
      type: 'spine',
      selectable: false,
      focusable: false,
      // No markerEnd — a neutral rail communicates ORDER, not causation.
    })
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
        ordinal: job.executionOrder,
        jobType: data.jobDetails?.[job.jobName]?.jobType,
        visualState,
        statusLabel: data.statusAvailable && status ? status.statusName : '',
        isLoadJob: job.jobName === data.loadJob,
        status: data.statusAvailable ? status : null,
      },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    }
  })

  return { nodes, edges, focusNodeId: pickFocusNodeId(data) }
}

/** Node/edge geometry exported for centering math (setCenter offset). */
export const NODE_SIZE = { width: NODE_WIDTH, height: NODE_HEIGHT }
