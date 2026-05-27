import { ArrowDownUpIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { STATUS_CONFIG, VISUAL_STATES } from './statusConfig'

/**
 * Five token-colored dots keyed to the node status tints + the one-line honesty
 * hint that color = each job's last run, position = execution order (spec §4) —
 * so a green node below a failed one reads as "different jobs," not a bug.
 */
export function StatusLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5" data-testid="eo-legend">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {VISUAL_STATES.map((s) => {
          const c = STATUS_CONFIG[s]
          return (
            <span key={s} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className={cn('size-2 rounded-full', c.dotClassName)} />
              {c.label}
            </span>
          )
        })}
      </div>
      <span
        data-testid="eo-order-hint"
        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/80"
      >
        <ArrowDownUpIcon className="size-3" aria-hidden />
        execution order · color = each job&apos;s last run
      </span>
    </div>
  )
}
