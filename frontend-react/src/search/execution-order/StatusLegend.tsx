import { cn } from '@/lib/utils'
import { STATUS_CONFIG, VISUAL_STATES } from './statusConfig'

/** Five token-colored dots keyed to the node status tints. */
export function StatusLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1" data-testid="eo-legend">
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
  )
}
