import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { SearchPage } from '@/search/SearchPage'

/**
 * Zod-validated search params for `/search`.
 *
 *   - `q`:   optional keyword. Undefined when omitted.
 *   - `tab`: optional selected-category key (Angular `tab` parity). Undefined
 *            when omitted — the active tab is derived from the search results
 *            (highest-count category), never a hardcoded default.
 *
 * No `cat`, no `.default()` — the URL is bare until the user searches.
 */
// Exported for the route's own validateSearch test. The route file legitimately
// owns its param schema alongside the Route; this is not a shared-constant smell.
// eslint-disable-next-line react-refresh/only-export-components
export const searchSchema = z.object({
  q: z.string().optional(),
  tab: z.string().optional(),
  view: z.string().optional(),
})

export const Route = createFileRoute('/search')({
  validateSearch: searchSchema,
  // Landing on /search with no query is an invalid state — send the user to the
  // hero at `/`. This is NOT the cosmetic param-injection rewrite that was
  // removed; it is the only redirect in the app.
  beforeLoad: ({ search }) => {
    if (!search.q || !search.q.trim()) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect({ to: '/' })
    }
  },
  component: SearchPage,
})
