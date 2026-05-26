import { RotateCcwIcon, SearchXIcon } from 'lucide-react'

/**
 * NoResultsState — the "no matches" empty state for the search results view.
 *
 * Left-aligned and anchored to the top of the content area (intuitive on the
 * wide laptop/monitor screens this tool runs on). A sonar-ping search icon, the
 * searched term echoed in an inline token, genuinely-helpful guidance (spelling,
 * shorter term, what's searchable) rather than random terms, and a quietly
 * de-emphasised "Browse examples" chip row. A "Start over" link returns to the
 * landing page. All color comes from CSS tokens (oklch) so it reads correctly
 * in light and dark themes; the sonar motion is gated by the global
 * prefers-reduced-motion clamp.
 */
export interface NoResultsStateProps {
  /** The term the user searched for (echoed back). */
  term: string
  /** Example terms shown as de-emphasised "Browse examples" chips. */
  examples: string[]
  /** Human-readable categories the user can search by (display copy). */
  searchableCategories: string[]
  /** Run a fresh search for the given example term. */
  onExample: (term: string) => void
  /** Clear the search and return to the landing page ("Start over"). */
  onClear: () => void
}

export function NoResultsState({
  term,
  examples,
  searchableCategories,
  onExample,
  onClear,
}: NoResultsStateProps): React.ReactElement {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-6 py-12 sm:px-10">
      <div className="max-w-xl animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both duration-500">
        {/* Sonar-ping search icon. The medallion is opaque and sits above the
            ping-ring layer so the rings appear to emanate from behind it. */}
        <div className="relative mb-6 inline-flex size-14 items-center justify-center">
          <span
            aria-hidden="true"
            className="rectrace-sonar pointer-events-none absolute inset-0 rounded-2xl"
          />
          <span className="relative flex size-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 shadow-sm">
            <SearchXIcon className="size-6 text-primary" strokeWidth={1.75} />
          </span>
        </div>

        <h2 className="text-xl font-semibold tracking-tight text-foreground">No results found</h2>

        <p className="mt-2 text-sm text-muted-foreground">
          Nothing matched{' '}
          <span className="rounded-md bg-muted px-1.5 py-0.5 font-medium text-foreground">{term}</span>.
        </p>

        <p className="mt-6 text-sm font-medium text-foreground">Suggestions</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground marker:text-muted-foreground/50">
          <li>Check the spelling of your search term.</li>
          <li>Try a shorter or partial term.</li>
          <li>You can search by {searchableCategories.join(', ')}.</li>
        </ul>

        {examples.length > 0 && (
          <div className="mt-8">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Browse examples</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {examples.map((ex, i) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => onExample(ex)}
                  className="rounded-full border bg-background/60 px-3 py-1 text-xs font-medium text-foreground/80 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-accent hover:text-foreground hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring animate-in fade-in-0 zoom-in-95 fill-mode-both duration-300"
                  style={{ animationDelay: `${240 + i * 50}ms` }}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onClear}
          className="mt-8 inline-flex items-center gap-1.5 rounded-md py-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <RotateCcwIcon className="size-3.5" />
          Start over
        </button>
      </div>
    </div>
  )
}
