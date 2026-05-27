import { useEffect, useMemo, useRef } from 'react'
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Controls, ControlButton,
  MiniMap, BaseEdge, getSmoothStepPath, useReactFlow,
  type EdgeProps, type EdgeTypes, type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { MaximizeIcon, CrosshairIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { buildGraphFromData, NODE_SIZE, type FlowNode } from './layout'
import { JobFlowNode } from './JobFlowNode'
import type { ExecutionOrderData } from './types'

const nodeTypes: NodeTypes = { job: JobFlowNode }

/** Neutral order-rail edge — no markerEnd; class drives the muted/active/dim stroke. */
function SpineEdge({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }: EdgeProps) {
  const [path] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
  const state = (data as { state?: 'active' | 'dim' } | undefined)?.state
  return (
    <BaseEdge
      path={path}
      className={cn('eo-spine-path', state === 'active' && 'eo-spine-path-active', state === 'dim' && 'eo-spine-path-dim')}
    />
  )
}
const edgeTypes: EdgeTypes = { spine: SpineEdge }

interface Props {
  data: ExecutionOrderData
  /** Currently selected job (drives select-emphasis + inspector). */
  selected: string | null
  /** Quick-find match set (non-matches dim; the active match is centered by the parent via `selected`). */
  matches: string[]
  onSelect: (jobName: string | null) => void
}

/**
 * Inner view — lives INSIDE <ReactFlowProvider>, so it can call useReactFlow()
 * for smart-focus + match centering (those hooks throw without the provider, and
 * cannot run in the component that renders <ReactFlow> unless it's inside one).
 */
function GraphView({ data, selected, matches, onSelect }: Props) {
  const { setCenter, fitView, getNode } = useReactFlow()
  const { nodes, edges, focusNodeId } = useMemo(() => buildGraphFromData(data), [data])
  const didInitialFocus = useRef(false)

  const matchSet = useMemo(() => new Set(matches), [matches])

  // Decorate nodes with dim/select state derived from selection + quick-find.
  const decoratedNodes: FlowNode[] = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        selected: n.id === selected,
        data: {
          ...n.data,
          dimmed: matchSet.size > 0 ? !matchSet.has(n.id) : false,
        },
      })),
    [nodes, selected, matchSet],
  )

  // Adjacent-edge emphasis: highlight edges touching the selected node, dim the rest.
  const decoratedEdges = useMemo(
    () =>
      edges.map((e) => {
        if (!selected) return e
        const adjacent = e.source === selected || e.target === selected
        return { ...e, data: { state: adjacent ? 'active' : 'dim' } }
      }),
    [edges, selected],
  )

  const center = (id: string | null) => {
    if (!id) return
    const node = getNode(id)
    if (!node) return
    const x = node.position.x + NODE_SIZE.width / 2
    const y = node.position.y + NODE_SIZE.height / 2
    void setCenter(x, y, { zoom: 1.1, duration: 350 })
  }

  // Smart initial focus — center on the first FAILED -> RUNNING -> top node once.
  useEffect(() => {
    if (didInitialFocus.current) return
    if (focusNodeId) { center(focusNodeId); didInitialFocus.current = true }
    // center/getNode/setCenter identities are stable for the provider's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNodeId])

  // Re-center on the active quick-find match (parent passes it through `selected`).
  useEffect(() => {
    if (selected) center(selected)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])

  return (
    <ReactFlow
      nodes={decoratedNodes}
      edges={decoratedEdges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      fitViewOptions={{ padding: 0.2, maxZoom: nodes.length <= 5 ? 1 : 1.5 }}
      minZoom={0.3}
      maxZoom={2}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable
      panOnScroll
      zoomOnScroll={false}
      onNodeClick={(_e, node) => onSelect(node.id)}
      onPaneClick={() => onSelect(null)}
      proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Dots} gap={18} size={1} />
      {/* showFitView={false}: we provide our own labeled "Fit all" below, so the
          built-in (unlabeled, identical-action) fit button would just duplicate it. */}
      <Controls showInteractive={false} showFitView={false}>
        <ControlButton aria-label="Fit all" title="Fit all" onClick={() => { void fitView({ padding: 0.2, duration: 350 }) }}>
          <MaximizeIcon className="size-3.5" />
        </ControlButton>
        <ControlButton aria-label="Re-center on focus" title="Re-center on focus" onClick={() => center(focusNodeId)}>
          <CrosshairIcon className="size-3.5" />
        </ControlButton>
      </Controls>
      {/* MiniMap only earns its place on long sequences (existing gate). */}
      {nodes.length > 12 && <MiniMap pannable zoomable />}
    </ReactFlow>
  )
}

/**
 * Public wrapper — provides the ReactFlowProvider context that GraphView's
 * useReactFlow() requires (smart-focus + quick-find centering). All graph data
 * is precomputed by buildGraphFromData (unit-tested) so this stays declarative.
 */
export function ExecutionOrderGraph(props: Props) {
  return (
    <div className="size-full" data-testid="eo-graph">
      <ReactFlowProvider>
        <GraphView {...props} />
      </ReactFlowProvider>
    </div>
  )
}
