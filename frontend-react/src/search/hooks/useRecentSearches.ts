import { useCallback, useState } from 'react'

/**
 * localStorage key for the rectrace recent-searches LRU bucket (D-3.11).
 *
 * Single global bucket in Phase 3; per-category namespacing
 * (`rectrace-recent-searches:{cat}`) is deferred to Phase 4+.
 */
export const RECENT_SEARCHES_KEY = 'rectrace-recent-searches'

/**
 * Maximum number of recent search terms to retain.
 *
 * Capped at 10 per D-3.11 / SEARCH-05. Oldest entries are dropped (LRU) when
 * the cap is exceeded.
 */
export const RECENT_SEARCHES_MAX = 10

function read(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((s): s is string => typeof s === 'string')
      .slice(0, RECENT_SEARCHES_MAX)
  } catch {
    // Malformed JSON, blocked storage (Safari ITP, private browsing), etc.
    return []
  }
}

/**
 * localStorage-backed LRU of the user's recent search terms.
 *
 * - Dedupe is case-sensitive (D-3.11): `'Alpha'` and `'alpha'` are distinct.
 * - Whitespace-only terms are no-ops.
 * - Capped at {@link RECENT_SEARCHES_MAX} (10); oldest entries drop first.
 * - Resilient to malformed payloads, quota errors, and SecurityError on
 *   removeItem (in-memory state still updates).
 *
 * SEARCH-05 / D-3.11.
 */
export function useRecentSearches(): {
  recents: string[]
  push: (term: string) => void
  clear: () => void
} {
  const [recents, setRecents] = useState<string[]>(read)

  const push = useCallback((term: string) => {
    if (!term.trim()) return
    setRecents((prev) => {
      const filtered = prev.filter((t) => t !== term)
      const next = [term, ...filtered].slice(0, RECENT_SEARCHES_MAX)
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next))
      } catch {
        // Quota exceeded, storage blocked, etc. — in-memory state still updates.
      }
      return next
    })
  }, [])

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY)
    } catch {
      // SecurityError, blocked storage — swallow; in-memory state still clears.
    }
    setRecents([])
  }, [])

  return { recents, push, clear }
}
