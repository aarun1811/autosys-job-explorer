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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { GridDensity } from '@/search/lib/gridConfig'

export interface GridToolbarProps {
  density: GridDensity
  isDeduplicated: boolean
  isExporting: boolean
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
          className={`size-8 rounded-md transition-colors disabled:opacity-100 ${
            pressed
              ? 'bg-primary/15 text-primary hover:bg-primary/20'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          }`}
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
 * A segmented cluster of related actions. The bordered surface makes the
 * controls read as deliberate buttons (not faint floating glyphs that get lost
 * on a wide monitor). The group name is carried as an accessible `aria-label`
 * (named for screen readers) rather than visible text — no extra row of height.
 */
function ToolGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex items-center gap-0.5 rounded-lg border border-border/70 bg-card/60 p-0.5 shadow-sm"
    >
      {children}
    </div>
  )
}

/**
 * GridToolbar — the action strip above the grid. Actions are grouped into
 * labelled segmented clusters (View · Group · Data · Export) and left-aligned so
 * they sit where attention lands and stay visible on large monitors. The
 * category name + count are NOT repeated here — they already live in the active
 * tab. Presentational only; every action is a parent callback.
 */
export function GridToolbar(props: GridToolbarProps): React.ReactElement {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-12 items-center gap-2 px-4">
        <ToolGroup label="View">
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
        </ToolGroup>

        <ToolGroup label="Group">
          <ToolButton label="Expand all groups" onClick={props.onExpandAll}>
            <ChevronsUpDownIcon className="size-4" />
          </ToolButton>
          <ToolButton label="Collapse all groups" onClick={props.onCollapseAll}>
            <ChevronsDownUpIcon className="size-4" />
          </ToolButton>
        </ToolGroup>

        <ToolGroup label="Data">
          <ToolButton label="Clear filters" onClick={props.onClearFilters}>
            <FilterXIcon className="size-4" />
          </ToolButton>
          <ToolButton label="Refresh" onClick={props.onRefresh}>
            <RefreshCwIcon className="size-4" />
          </ToolButton>
          <ToolButton label="Remove duplicates" pressed={props.isDeduplicated} onClick={props.onToggleDedup}>
            <CopyMinusIcon className="size-4" />
          </ToolButton>
        </ToolGroup>

        <ToolGroup label="Export">
          <ToolButton label="Export to Excel" onClick={props.onExportExcel} disabled={props.isExporting}>
            {props.isExporting ? <Loader2Icon className="size-4 animate-spin" /> : <DownloadIcon className="size-4" />}
          </ToolButton>
          <ToolButton label="Copy rows to clipboard" onClick={props.onCopy}>
            <CopyIcon className="size-4" />
          </ToolButton>
          <ToolButton label="Share view" onClick={props.onShare}>
            <Share2Icon className="size-4" />
          </ToolButton>
        </ToolGroup>

        <div className="flex-1" />

        {props.activeFilterCount > 0 && (
          <span
            aria-label="active filters"
            className="rectrace-num inline-flex items-center gap-1.5 rounded-full bg-primary/12 px-2.5 py-1 text-[11px] font-semibold text-primary"
          >
            <FilterXIcon className="size-3" aria-hidden />
            {props.activeFilterCount} active
          </span>
        )}
      </div>
    </TooltipProvider>
  )
}
