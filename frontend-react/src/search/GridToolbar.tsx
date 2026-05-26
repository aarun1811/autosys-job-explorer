// src/search/GridToolbar.tsx
import {
  PanelRightIcon,
  Rows3Icon,
  Maximize2Icon,
  RotateCcwIcon,
  ChevronsUpDownIcon,
  ChevronsDownUpIcon,
  FilterXIcon,
  RefreshCwIcon,
  CopyMinusIcon,
  DownloadIcon,
  Loader2Icon,
  CopyIcon,
  Share2Icon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { GridDensity } from '@/search/lib/gridConfig'

export interface GridToolbarProps {
  density: GridDensity
  isDeduplicated: boolean
  isSidebarVisible: boolean
  isExporting: boolean
  onToggleSidebar: () => void
  onToggleDensity: () => void
  onAutoSize: () => void
  onResetView: () => void
  onExpandAll: () => void
  onCollapseAll: () => void
  onClearFilters: () => void
  onRefresh: () => void
  onToggleDedup: () => void
  onExportExcel: () => void
  onCopy: () => void
  onShare: () => void
}

/** A single ghost icon-button with a tooltip; `pressed` drives active styling. */
function ToolButton({
  label,
  onClick,
  pressed,
  children,
}: {
  label: string
  onClick: () => void
  pressed?: boolean
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label={label}
          aria-pressed={pressed === undefined ? undefined : pressed}
          onClick={onClick}
          className={`size-8 ${pressed ? 'bg-accent text-foreground' : 'text-muted-foreground'}`}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

/**
 * GridToolbar — Angular search-v5 toolbar parity in shadcn: ghost icon-buttons
 * grouped (View · Grouping · Data · Export/Share) with separators, right-aligned.
 * Presentational only — every action is a parent callback.
 */
export function GridToolbar(props: GridToolbarProps): React.ReactElement {
  const sep = <Separator orientation="vertical" className="mx-1 h-5" />
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-11 items-center gap-0.5 border-b px-3">
        <div className="flex-1" />
        {/* View */}
        <ToolButton label="Toggle columns and filters panel" pressed={props.isSidebarVisible} onClick={props.onToggleSidebar}>
          <PanelRightIcon className="size-4" />
        </ToolButton>
        <ToolButton label="Toggle row density" pressed={props.density === 'compact'} onClick={props.onToggleDensity}>
          <Rows3Icon className="size-4" />
        </ToolButton>
        <ToolButton label="Auto-size columns" onClick={props.onAutoSize}>
          <Maximize2Icon className="size-4" />
        </ToolButton>
        <ToolButton label="Reset view" onClick={props.onResetView}>
          <RotateCcwIcon className="size-4" />
        </ToolButton>
        {sep}
        {/* Grouping */}
        <ToolButton label="Expand all groups" onClick={props.onExpandAll}>
          <ChevronsUpDownIcon className="size-4" />
        </ToolButton>
        <ToolButton label="Collapse all groups" onClick={props.onCollapseAll}>
          <ChevronsDownUpIcon className="size-4" />
        </ToolButton>
        {sep}
        {/* Data */}
        <ToolButton label="Clear filters" onClick={props.onClearFilters}>
          <FilterXIcon className="size-4" />
        </ToolButton>
        <ToolButton label="Refresh" onClick={props.onRefresh}>
          <RefreshCwIcon className="size-4" />
        </ToolButton>
        <ToolButton label="Remove duplicates" pressed={props.isDeduplicated} onClick={props.onToggleDedup}>
          <CopyMinusIcon className="size-4" />
        </ToolButton>
        {sep}
        {/* Export / Share */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" size="sm" variant="outline" disabled={props.isExporting} aria-label="Export">
              {props.isExporting ? (
                <Loader2Icon className="size-4 mr-1 animate-spin" />
              ) : (
                <DownloadIcon className="size-4 mr-1" />
              )}
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={props.onExportExcel}>Download Excel (.xlsx)</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <ToolButton label="Copy rows to clipboard" onClick={props.onCopy}>
          <CopyIcon className="size-4" />
        </ToolButton>
        <ToolButton label="Share view" onClick={props.onShare}>
          <Share2Icon className="size-4" />
        </ToolButton>
      </div>
    </TooltipProvider>
  )
}
