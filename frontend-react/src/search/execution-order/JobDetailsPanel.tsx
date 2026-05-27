import { CodeIcon, FolderIcon, CalendarIcon, CalendarOffIcon, ServerIcon, BoxIcon, CalendarClockIcon, MousePointerClickIcon, TerminalIcon, InfoIcon } from 'lucide-react'
import { m } from 'motion/react'

import { cn } from '@/lib/utils'
import { STATUS_CONFIG } from './statusConfig'
import type { JobDetails, JobStatusInfo } from './types'

interface Props {
  jobName: string | null
  details: JobDetails | undefined
  status: JobStatusInfo | null
  statusAvailable: boolean
}

function Row({ icon: Icon, label, value }: { icon: typeof ServerIcon; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5 border-b px-4 py-2.5 last:border-b-0">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="truncate text-sm">{value || 'N/A'}</div>
      </div>
    </div>
  )
}

/** Right-hand details pane: selected job's metadata + (when available) live status. */
export function JobDetailsPanel({ jobName, details, status, statusAvailable }: Props) {
  if (!jobName || !details) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-10 text-center" data-testid="eo-details-empty">
        <MousePointerClickIcon className="size-8 text-muted-foreground opacity-60" />
        <p className="text-sm text-muted-foreground">Click on any job in the graph to view its details</p>
      </div>
    )
  }

  const TypeIcon = details.jobType === 'BOX' ? FolderIcon : CodeIcon
  const showStatus = statusAvailable && status

  return (
    <m.div
      key={jobName}
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="flex flex-col"
    >
      <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-3">
        <TypeIcon className="size-4 shrink-0 text-primary" />
        <span className="truncate font-mono text-sm font-medium">{jobName}</span>
      </div>

      {showStatus && (
        <div className="flex items-center gap-2 border-b px-4 py-2.5">
          <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium', STATUS_CONFIG[status.visualState].badgeClassName)}>
            {status.statusName}
          </span>
          {status.nextStartFormatted && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarClockIcon className="size-3.5" />
              Next Run: {status.nextStartFormatted}
            </span>
          )}
        </div>
      )}

      <Row icon={ServerIcon} label="Machine" value={details.machine} />
      <Row icon={CalendarIcon} label="Run Calendar" value={details.runCalendar} />
      <Row icon={CalendarOffIcon} label="Exclude Calendar" value={details.excludeCalendar} />
      {details.boxName && <Row icon={BoxIcon} label="Box Name" value={details.boxName} />}

      {details.command && (
        <div className="border-b px-4 py-3 last:border-b-0">
          <div className="mb-1.5 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <TerminalIcon className="size-3.5" />
            Command
          </div>
          <pre className="overflow-x-auto rounded-md bg-muted/50 px-2.5 py-2 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap">{details.command}</pre>
        </div>
      )}
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
