import { TimerIcon, FlagTriangleRightIcon, RepeatIcon, ServerIcon, CircleDotIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { STATUS_CONFIG } from './statusConfig'
import { formatDuration, type JobStatusInfo } from './types'

interface Props {
  status: JobStatusInfo
}

function Line({ icon: Icon, children }: { icon: typeof TimerIcon; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 truncate">{children}</span>
    </div>
  )
}

/**
 * Hover runtime-gold card (overlay — no layout shift). Renders only the rows
 * whose data exists; jobs with no run history show just the status line. The
 * card surface + theming live in .eo-popover-surface (index.css). Duration is
 * derived here (formatDuration), never on the wire.
 */
export function NodeRuntimePopover({ status }: Props) {
  const cfg = STATUS_CONFIG[status.visualState]
  const duration = formatDuration(status.lastStartEpoch, status.lastEndEpoch)
  return (
    <div
      data-testid="eo-runtime-popover"
      className="eo-popover-surface w-60 rounded-md p-3 text-xs"
    >
      <div className="mb-2 flex items-center gap-1.5">
        <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium', cfg.badgeClassName)}>
          <cfg.icon className="size-3" />
          {status.statusName || cfg.label}
        </span>
        {status.exitCode != null && (
          <span className="font-mono text-[11px] text-muted-foreground">exit {status.exitCode}</span>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        {duration && <Line icon={TimerIcon}>Ran for <span className="font-medium">{duration}</span></Line>}
        {status.lastEndFormatted && <Line icon={FlagTriangleRightIcon}>Ended {status.lastEndFormatted}</Line>}
        {status.retries != null && status.retries > 0 && <Line icon={RepeatIcon}>{status.retries} retries used</Line>}
        {status.runMachine && <Line icon={ServerIcon}>{status.runMachine}</Line>}
        {status.runNum != null && <Line icon={CircleDotIcon}>Run #{status.runNum}</Line>}
      </div>
    </div>
  )
}
