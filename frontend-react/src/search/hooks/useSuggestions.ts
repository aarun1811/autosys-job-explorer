import { useEffect, useState } from 'react'

import { apiFetch } from '@/lib/queryClient'

const DEBOUNCE_MS = 300
const MIN_CHARS = 2

/**
 * Debounced typeahead suggestions — Angular `initializeSuggestions` parity.
 *
 * Waits {@link DEBOUNCE_MS} after the last keystroke, skips terms shorter than
 * {@link MIN_CHARS}, then `GET /rectrace/api/search/suggest?prefix=<term>`.
 * Any error (or a non-array body) resolves to `[]` — suggestions are a
 * best-effort affordance, never a hard failure.
 */
export function useSuggestions(term: string): string[] {
  const [suggestions, setSuggestions] = useState<string[]>([])

  useEffect(() => {
    const q = term.trim()
    if (q.length < MIN_CHARS) {
      setSuggestions([])
      return
    }
    let cancelled = false
    const handle = setTimeout(() => {
      void (async () => {
        try {
          const res = await apiFetch(`/rectrace/api/search/suggest?prefix=${encodeURIComponent(q)}`)
          const json = (await res.json()) as unknown
          if (!cancelled) setSuggestions(Array.isArray(json) ? (json as string[]) : [])
        } catch {
          if (!cancelled) setSuggestions([])
        }
      })()
    }, DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [term])

  return suggestions
}
