import { Handle, Position, type NodeProps } from '@xyflow/react'
import { CodeIcon, FolderIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { STATUS_CONFIG } from './statusConfig'
import type { FlowNode } from './layout'

/** Custom React Flow node: a shadcn-styled card tinted by live job status. */
export function JobFlowNode({ data, selected }: NodeProps<FlowNode>) {
  const status = STATUS_CONFIG[data.visualState]
  const TypeIcon = data.jobType === 'BOX' ? FolderIcon : CodeIcon
  return (
    <div
      data-testid="eo-node"
      className={cn(
        'eo-node flex w-[200px] flex-col gap-0.5 rounded-md border px-3 py-2 text-xs shadow-sm transition-colors',
        status.nodeClassName,
        selected && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
      )}
    >
      <Handle type="target" position={Position.Top} className="!size-1.5 !bg-border" />
      <div className="flex items-center gap-1.5">
        <TypeIcon className="size-3.5 shrink-0 opacity-70" />
        <span className="truncate font-mono font-medium">{data.label}</span>
      </div>
      {data.statusLabel && (
        <span className="pl-5 text-[11px] opacity-80">({data.statusLabel})</span>
      )}
      <Handle type="source" position={Position.Bottom} className="!size-1.5 !bg-border" />
    </div>
  )
}
