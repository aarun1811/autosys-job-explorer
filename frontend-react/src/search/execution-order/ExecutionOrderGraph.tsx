import { useMemo } from 'react'
import {
  ReactFlow, Background, BackgroundVariant, Controls, MiniMap, MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { buildGraphFromData } from './layout'
import { JobFlowNode } from './JobFlowNode'
import type { ExecutionOrderData } from './types'

const nodeTypes = { job: JobFlowNode }

interface Props {
  data: ExecutionOrderData
  onSelect: (jobName: string | null) => void
}

/** Thin React Flow wrapper. All graph data is precomputed by buildGraphFromData
 * (unit-tested) so this component stays declarative and easy to reason about. */
export function ExecutionOrderGraph({ data, onSelect }: Props) {
  const { nodes, edges } = useMemo(() => buildGraphFromData(data), [data])
  return (
    <div className="size-full" data-testid="eo-graph">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        defaultEdgeOptions={{ type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } }}
        onNodeClick={(_event, node) => onSelect(node.id)}
        onPaneClick={() => onSelect(null)}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  )
}
