import { useCallback, useEffect, useState } from 'react'

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
// Custom in-page event so multiple useRecentSearches consumers in the same
// document (e.g. SearchPage and SearchBar) stay synchronized. The native
// `storage` event only fires on OTHER tabs/windows — never on the tab that
// wrote the value — so we dispatch our own event after each mutation and have
// every hook instance re-read from localStorage on receipt.
const RECENT_SEARCHES_EVENT = 'rectrace:recent-searches-changed'

function broadcastChange(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(RECENT_SEARCHES_EVENT))
}

export function useRecentSearches(): {
  recents: string[]
  push: (term: string) => void
  remove: (term: string) => void
  clear: () => void
} {
  const [recents, setRecents] = useState<string[]>(read)

  // Subscribe to same-tab mutations from other hook instances, AND to
  // cross-tab `storage` events so multi-tab users see consistent recents.
  useEffect(() => {
    const sync = (): void => setRecents(read())
    const onStorage = (e: StorageEvent): void => {
      if (e.key === RECENT_SEARCHES_KEY || e.key === null) sync()
    }
    window.addEventListener(RECENT_SEARCHES_EVENT, sync)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(RECENT_SEARCHES_EVENT, sync)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const push = useCallback((term: string) => {
    const trimmed = term.trim()
    if (!trimmed) return
    // Side effects (persist + cross-instance broadcast) must run OUTSIDE the
    // setRecents updater. A setState updater runs during React's render phase;
    // dispatching the broadcast there makes peer useRecentSearches instances
    // call setState mid-render ("Cannot update a component while rendering a
    // different component"). We compute `next` from localStorage (the canonical
    // store every mutation writes), persist, set local state, then broadcast.
    const prev = read()
    const next = [trimmed, ...prev.filter((t) => t !== trimmed)].slice(0, RECENT_SEARCHES_MAX)
    let wroteOk = false
    try {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next))
      wroteOk = true
    } catch {
      // Quota exceeded, storage blocked, etc. — in-memory state still updates.
    }
    setRecents(next)
    // Only broadcast on a successful write: peer instances re-read from
    // localStorage, so broadcasting after a failed write would revert them to
    // the pre-mutation contents.
    if (wroteOk) broadcastChange()
  }, [])

  const remove = useCallback((term: string) => {
    // Side effects outside the updater (see push) — compute from the canonical
    // localStorage store, persist, set state, then broadcast to peers.
    const next = read().filter((t) => t !== term)
    let wroteOk = false
    try {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next))
      wroteOk = true
    } catch {
      // Quota / blocked storage — in-memory state still updates.
    }
    setRecents(next)
    if (wroteOk) broadcastChange()
  }, [])

  const clear = useCallback(() => {
    let removedOk = false
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY)
      removedOk = true
    } catch {
      // SecurityError, blocked storage — swallow; in-memory state still clears.
    }
    setRecents([])
    if (removedOk) broadcastChange()
  }, [])

  return { recents, push, remove, clear }
}
