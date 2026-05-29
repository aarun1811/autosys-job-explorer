import { cn } from '@/lib/utils'
import { QuickFind } from './QuickFind'
import { rollup, type ExecutionOrderData, type VisualState } from './types'

// Segment fill class + count-label noun for each state, in display order.
const SEGMENTS: { state: VisualState; seg: string; noun: string }[] = [
  { state: 'COMPLETED', seg: 'eo-seg-completed', noun: 'done' },
  { state: 'RUNNING', seg: 'eo-seg-running', noun: 'running' },
  { state: 'FAILED', seg: 'eo-seg-failed', noun: 'failed' },
  { state: 'WAITING', seg: 'eo-seg-waiting', noun: 'waiting' },
  { state: 'INACTIVE', seg: 'eo-seg-inactive', noun: 'inactive' },
]

interface Props {
  data: ExecutionOrderData
  onActiveMatch: (jobName: string | null) => void
  onMatchesChange: (matches: string[]) => void
}

/**
 * Summary strip: a segmented proportion bar + counts + rollup state pill on the
 * left; quick-find on the right. When live status is unavailable it collapses to
 * a quiet note (the layout never depends on live data — spec §6 graceful degrade).
 */
export function PipelineSummaryStrip({ data, onActiveMatch, onMatchesChange }: Props) {
  const r = rollup(data)
  const total = data.executionSequence.length
  const present = SEGMENTS.filter((s) => r.counts[s.state] > 0)

  return (
    <div className="flex items-center gap-4 px-5 py-2.5">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {data.statusAvailable ? (
          <>
            <div data-testid="eo-segbar" className="flex h-2 w-40 shrink-0 overflow-hidden rounded-full border bg-muted">
              {present.map((s) => (
                <span
                  key={s.state}
                  className={cn('h-full', s.seg)}
                  style={{ width: `${(r.counts[s.state] / Math.max(total, 1)) * 100}%` }}
                />
              ))}
            </div>
            <div className="min-w-0 truncate text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{total} jobs</span>
              {present.map((s) => (
                <span key={s.state}> · {r.counts[s.state]} {s.noun}</span>
              ))}
            </div>
          </>
        ) : (
          <span data-testid="eo-status-unavailable" className="text-xs text-muted-foreground">
            Live status unavailable
          </span>
        )}
      </div>
      <QuickFind data={data} onActiveMatch={onActiveMatch} onMatchesChange={onMatchesChange} />
    </div>
  )
}
