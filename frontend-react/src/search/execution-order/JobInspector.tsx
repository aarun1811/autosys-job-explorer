import {
  CodeIcon, FolderIcon, CalendarIcon, CalendarOffIcon, ServerIcon, BoxIcon,
  CalendarClockIcon, TerminalIcon, InfoIcon, CopyIcon, UserIcon, TimerIcon,
  HashIcon, RepeatIcon, FlagTriangleRightIcon, PlayIcon,
} from 'lucide-react'
import { m } from 'motion/react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import { STATUS_CONFIG } from './statusConfig'
import { RunOverview } from './RunOverview'
import { formatDuration, type JobDetails, type JobStatusInfo, type ExecutionOrderData } from './types'

interface Props {
  jobName: string | null
  details: JobDetails | undefined
  status: JobStatusInfo | null
  statusAvailable: boolean
  /** For the empty-state RunOverview. */
  data: ExecutionOrderData
}

function copy(value: string, label: string) {
  navigator.clipboard
    .writeText(value)
    .then(() => toast.success(`Copied ${label}`))
    .catch(() => toast.error('Copy failed'))
}

function Row({ icon: Icon, label, value }: { icon: typeof ServerIcon; label: string; value: string }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-2.5 border-b px-4 py-2.5 last:border-b-0">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="truncate text-sm">{value}</div>
      </div>
    </div>
  )
}

function Metric({ icon: Icon, label, value }: { icon: typeof TimerIcon; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-md border bg-card px-2 py-2 text-center">
      <Icon className="size-3.5 text-muted-foreground" aria-hidden />
      <div className="font-mono text-sm font-medium tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  )
}

/**
 * Inspector rail — triage-first order (spec §5.6):
 *   Identity → Last-run card (gold) → Definition (incl. owner from STATUS) →
 *   Command → Description. Sections render only when data exists (no "N/A" noise).
 * Empty (nothing selected) → a real RunOverview, not a dead prompt.
 * Slide-in keyed by job name; reduced-motion gated globally by MotionConfig.
 */
export function JobInspector({ jobName, details, status, statusAvailable, data }: Props) {
  if (!jobName || !details) {
    return <RunOverview data={data} />
  }

  const TypeIcon = details.jobType === 'BOX' ? FolderIcon : CodeIcon
  const cfg = status ? STATUS_CONFIG[status.visualState] : null
  const showLastRun = statusAvailable && status
  const duration = status ? formatDuration(status.lastStartEpoch, status.lastEndEpoch) : null

  return (
    <m.div
      key={jobName}
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="flex flex-col"
    >
      {/* Identity */}
      <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-3">
        <TypeIcon className="size-4 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0 flex-1 truncate font-mono text-sm font-medium" title={jobName}>{jobName}</span>
        {showLastRun && cfg && (
          <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', cfg.badgeClassName)}>
            <cfg.icon className="size-3" aria-hidden />
            {status.statusName}
          </span>
        )}
        <button
          type="button"
          aria-label="Copy job name"
          className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => copy(jobName, 'job name')}
        >
          <CopyIcon className="size-3.5" />
        </button>
      </div>

      {showLastRun && status.nextStartFormatted && (
        <div className="flex items-center gap-1.5 border-b px-4 py-2 text-xs text-muted-foreground">
          <CalendarClockIcon className="size-3.5" aria-hidden />
          Next run: {status.nextStartFormatted}
        </div>
      )}

      {/* Last-run card (the gold) — status-tinted left edge, three numbers lead. */}
      {showLastRun && (
        <div
          data-testid="eo-last-run"
          className={cn('relative border-b px-4 py-3', cfg && cfg.nodeClassName)}
        >
          {cfg && <span className={cn('absolute inset-y-0 left-0 w-1', cfg.accentClassName)} aria-hidden />}
          <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <PlayIcon className="size-3.5" aria-hidden />
            Last run
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Metric icon={TimerIcon} label="Duration" value={duration ?? '—'} />
            <Metric icon={FlagTriangleRightIcon} label="Exit code" value={status.exitCode != null ? String(status.exitCode) : '—'} />
            <Metric icon={RepeatIcon} label="Retries" value={status.retries != null ? String(status.retries) : '—'} />
          </div>
          <div className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
            {status.lastStartFormatted && <div className="flex items-center gap-1.5"><PlayIcon className="size-3" />Started {status.lastStartFormatted}</div>}
            {status.lastEndFormatted && <div className="flex items-center gap-1.5"><FlagTriangleRightIcon className="size-3" />Ended {status.lastEndFormatted}</div>}
            {status.runMachine && <div className="flex items-center gap-1.5"><ServerIcon className="size-3" />Ran on {status.runMachine}</div>}
            {status.runNum != null && <div className="flex items-center gap-1.5"><HashIcon className="size-3" />Run #{status.runNum}</div>}
          </div>
        </div>
      )}

      {/* Definition — owner reads from STATUS (not JobDetails); rows self-hide when empty. */}
      <Row icon={UserIcon} label="Owner" value={status?.owner ?? ''} />
      <Row icon={ServerIcon} label="Machine" value={details.machine} />
      <Row icon={BoxIcon} label="Box" value={details.boxName} />
      <Row icon={CalendarIcon} label="Run Calendar" value={details.runCalendar} />
      <Row icon={CalendarOffIcon} label="Exclude Calendar" value={details.excludeCalendar} />

      {/* Command */}
      {details.command && (
        <div className="border-b px-4 py-3 last:border-b-0">
          <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <span className="flex items-center gap-2"><TerminalIcon className="size-3.5" />Command</span>
            <button
              type="button"
              aria-label="Copy command"
              className="text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => copy(details.command, 'command')}
            >
              <CopyIcon className="size-3.5" />
            </button>
          </div>
          <pre className="overflow-x-auto rounded-md bg-muted/50 px-2.5 py-2 font-mono text-xs leading-relaxed whitespace-pre">{details.command}</pre>
        </div>
      )}

      {/* Description */}
      {details.description && (
        <div className="border-b px-4 py-3 last:border-b-0">
          <div className="mb-1.5 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <InfoIcon className="size-3.5" />
            Description
          </div>
          <p className="text-sm leading-relaxed">{details.description}</p>
        </div>
      )}
    </m.div>
  )
}
