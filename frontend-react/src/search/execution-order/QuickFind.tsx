import { useEffect, useState } from 'react'
import { SearchIcon, XIcon } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { findMatches, type ExecutionOrderData } from './types'

interface Props {
  data: ExecutionOrderData
  /** The active match's job name (or null) — drives graph center + inspector. */
  onActiveMatch: (jobName: string | null) => void
  /** Full ordered match set — drives node dim/highlight. */
  onMatchesChange: (matches: string[]) => void
}

/**
 * Quick-find — case-insensitive substring on job name. Matched nodes get a focus
 * ring; non-matches dim (handled by the graph from the reported match set). A
 * live counter shows "2 / 5"; Enter / ArrowDown / ArrowUp cycle (wrapping);
 * Escape / clear restores the default view. Selecting a match centers + opens it.
 */
export function QuickFind({ data, onActiveMatch, onMatchesChange }: Props) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [matches, setMatches] = useState<string[]>([])

  // Recompute matches whenever the query (or data) changes; reset active to 0.
  useEffect(() => {
    const next = findMatches(data, query)
    setMatches(next)
    setActive(0)
    onMatchesChange(next)
    onActiveMatch(next.length > 0 ? next[0] : null)
    // onMatchesChange / onActiveMatch are stable (useCallback in the parent).
  }, [query, data, onMatchesChange, onActiveMatch])

  const cycle = (delta: number) => {
    if (matches.length === 0) return
    const next = (active + delta + matches.length) % matches.length
    setActive(next)
    onActiveMatch(matches[next])
  }

  const reset = () => {
    setQuery('')
    setMatches([])
    setActive(0)
    onMatchesChange([])
    onActiveMatch(null)
  }

  const count = matches.length
  const display = count > 0 ? `${active + 1} / ${count}` : '0 / 0'

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          aria-label="Find a job"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); cycle(1) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); cycle(-1) }
            else if (e.key === 'Escape') { e.preventDefault(); reset() }
          }}
          placeholder="Find a job"
          className="h-8 w-44 pl-7 pr-7 text-xs"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={reset}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <XIcon className="size-3.5" />
          </button>
        )}
      </div>
      {query && (
        <span data-testid="eo-find-counter" className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {display}
        </span>
      )}
    </div>
  )
}
