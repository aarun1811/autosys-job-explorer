import type { InitialSearchResponseV4, CategoryResultV4 } from '@/search/types'

/**
 * Reduce an `/api/v4/search/initial` response to the tabs the UI should render —
 * Angular `search-v5.component.ts` parity: keep categories with at least one hit
 * AND any dashboard-bearing category (a dashboard-only "overview" tab carries a
 * `dashboard` config but count 0, and must still render). Sorted by hit count
 * descending, so the richest grid result is the default active tab and count-0
 * dashboard tabs trail at the end.
 */
export function deriveSearchResults(resp: InitialSearchResponseV4): CategoryResultV4[] {
  return Object.values(resp.categoryResults)
    .filter((c) => c.count > 0 || c.dashboard != null)
    .sort((a, b) => b.count - a.count)
}
