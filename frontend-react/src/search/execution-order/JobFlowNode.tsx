import { Handle, Position, type NodeProps } from '@xyflow/react'
import { CodeIcon, FolderIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { STATUS_CONFIG } from './statusConfig'
import { NodeRuntimePopover } from './NodeRuntimePopover'
import type { FlowNode } from './layout'

/**
 * Redesigned execution-order node — one scannable line:
 *   [4px status accent bar] · #ordinal · type glyph · job name (mono, truncate) · status icon
 * Subtle status-tinted body; RUNNING glows + pulses; hover lifts and reveals the
 * runtime popover (overlay, no layout shift); selected shows a focus ring; quick-
 * find non-matches dim. Color AND icon both encode status (colorblind-safe).
 *
 * Crosshair fix (spec §5.7): the <Handle>s are isConnectable={false} +
 * pointer-events-none, kept ONLY as edge anchors — so React Flow never advertises
 * the connection/crosshair affordance (nodesConnectable={false} alone does not).
 */
export function JobFlowNode({ data, selected }: NodeProps<FlowNode>) {
  const cfg = STATUS_CONFIG[data.visualState]
  const TypeIcon = data.jobType === 'BOX' ? FolderIcon : CodeIcon
  const hasRuntime = data.status != null

  return (
    <div className="group relative">
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={false}
        className="!pointer-events-none !size-1 !border-0 !bg-transparent !opacity-0"
      />

      <div
        data-testid="eo-node"
        title={data.label}
        className={cn(
          'eo-node eo-node-lift relative flex w-[240px] items-center gap-2 overflow-hidden rounded-lg border py-2 pl-3 pr-2.5 text-xs shadow-sm',
          cfg.nodeClassName,
          cfg.pulse && 'eo-pulse',
          data.dimmed && 'eo-node-dim',
          // Selection treatment (ring + halo + glow + pop) lives entirely in
          // .eo-node-selected so it reads as one strong, cohesive emphasis.
          selected && 'eo-node-selected',
        )}
      >
        <span
          data-testid="eo-accent"
          className={cn('absolute inset-y-0 left-0 w-1', cfg.accentClassName)}
          aria-hidden
        />
        <span className="ml-1 shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
          #{data.ordinal}
        </span>
        <TypeIcon className="size-3.5 shrink-0 opacity-70" aria-hidden />
        <span className="min-w-0 flex-1 truncate font-mono font-medium">{data.label}</span>
        <cfg.icon
          className="size-3.5 shrink-0"
          style={{ color: `var(--status-${data.visualState.toLowerCase()})` }}
          aria-label={cfg.label}
        />
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={false}
        className="!pointer-events-none !size-1 !border-0 !bg-transparent !opacity-0"
      />

      {hasRuntime && (
        <div className="pointer-events-none absolute left-1/2 top-full z-20 hidden -translate-x-1/2 translate-y-1.5 group-hover:block">
          <NodeRuntimePopover status={data.status!} />
        </div>
      )}
    </div>
  )
}
