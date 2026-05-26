// src/search/GridToolbar.tsx
import {
  PanelRightIcon,
  Rows3Icon,
  ArrowLeftRightIcon,
  ListRestartIcon,
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
import { m } from 'motion/react'

import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { GridDensity } from '@/search/lib/gridConfig'

export interface GridToolbarProps {
  density: GridDensity
  isDeduplicated: boolean
  isExporting: boolean
  categoryLabel: string
  resultCount: number
  activeFilterCount: number
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
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  pressed?: boolean
  disabled?: boolean
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
          disabled={disabled}
          onClick={onClick}
          // disabled:opacity-100 keeps a loading spinner fully visible while busy.
          className={`size-8 disabled:opacity-100 ${pressed ? 'bg-accent text-foreground' : 'text-muted-foreground'}`}
        >
          <m.span
            className="inline-flex"
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 600, damping: 30 }}
          >
            {children}
          </m.span>
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
    <TooltipProvider delayDuration={200}>
      <div className="flex h-11 items-center gap-0.5 border-b px-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold text-foreground">{props.categoryLabel}</span>
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
            {props.resultCount}
          </span>
          {props.activeFilterCount > 0 && (
            <span
              aria-label="active filters"
              className="rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-medium tabular-nums text-primary"
            >
              {props.activeFilterCount}
            </span>
          )}
        </div>
        <div className="flex-1" />
        {/* View */}
        <ToolButton label="Toggle columns and filters panel" onClick={props.onToggleSidebar}>
          <PanelRightIcon className="size-4" />
        </ToolButton>
        <ToolButton label="Toggle row density" pressed={props.density === 'compact'} onClick={props.onToggleDensity}>
          <Rows3Icon className="size-4" />
        </ToolButton>
        <ToolButton label="Auto-size columns" onClick={props.onAutoSize}>
          <ArrowLeftRightIcon className="size-4" />
        </ToolButton>
        <ToolButton label="Reset view" onClick={props.onResetView}>
          <ListRestartIcon className="size-4" />
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
        {/* Export / Share — Export downloads immediately on click (spinner while busy). */}
        <ToolButton label="Export to Excel" onClick={props.onExportExcel} disabled={props.isExporting}>
          {props.isExporting ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <DownloadIcon className="size-4" />
          )}
        </ToolButton>
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
