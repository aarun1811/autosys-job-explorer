import type { InitialSearchResponseV4, CategoryResultV4 } from '@/search/types'

/**
 * Reduce an `/api/v4/search/initial` response to the tabs the UI should render —
 * Angular `search-v5.component.ts` parity: keep only categories with at least
 * one hit, sorted by hit count descending (so the richest result is the default
 * active tab).
 */
export function deriveSearchResults(resp: InitialSearchResponseV4): CategoryResultV4[] {
  return Object.values(resp.categoryResults)
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count)
}
