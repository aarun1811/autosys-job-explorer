import { useCallback } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'

/**
 * The `/search` route is not yet declared in the file-based route tree —
 * Plan 03-07 creates `routes/search.tsx` with a Zod `validateSearch`. Until
 * then, `useSearch({ from: '/search' })` / `useNavigate({ from: '/search' })`
 * fail TanStack Router's literal-route constraint at the type level even
 * though they are correct at runtime (the route is matched via Plan 07's
 * file).
 *
 * We cast the hooks through `as unknown as ...` here so this Plan-02 hook
 * compiles today; Plan 03-07 will drop these casts when it registers the
 * route and the literal type appears in `routeTree.gen.ts`.
 */
type UseSearchLoose = (opts: { from: string }) => Record<string, unknown>
type UseNavigateLoose = (opts: { from: string }) => (args: {
  search?: Record<string, unknown> | ((prev: Record<string, unknown>) => Record<string, unknown>)
  replace?: boolean
}) => Promise<void> | void

const useSearchLoose = useSearch as unknown as UseSearchLoose
const useNavigateLoose = useNavigate as unknown as UseNavigateLoose

/**
 * URL-bound search state for the `/search` route.
 *
 * The URL is the single source of truth for `q` and `cat` (D-3.1). All writes
 * use `replace: true` so back-stack does not grow with every keystroke (D-3.2)
 * — the Angular `updateUrlWithState` `replaceUrl: true` semantics translated
 * 1:1 to TanStack Router.
 *
 * The `q` field defaults to `undefined` when absent from the URL; the `cat`
 * field defaults to `'fileName'` (Phase 3 only ships one category — D-3.4).
 *
 * Zod validation lives on the route (Plan 07 `validateSearch`), so by the
 * time `useSearch` resolves, `q` and `cat` are already typed/sanitized.
 *
 * SEARCH-03 / D-3.1 / D-3.2.
 */
export function useSearchState(): {
  q: string | undefined
  cat: string
  setQ: (next: string | undefined) => void
  setCat: (next: string) => void
  clear: () => void
} {
  const raw = useSearchLoose({ from: '/search' })
  const q = typeof raw.q === 'string' ? raw.q : undefined
  const cat = typeof raw.cat === 'string' ? raw.cat : undefined
  const navigate = useNavigateLoose({ from: '/search' })

  const setQ = useCallback(
    (next: string | undefined) => {
      void navigate({
        search: (prev: Record<string, unknown>) => {
          const rest = { ...prev }
          delete rest.q
          return next ? { ...rest, q: next } : rest
        },
        replace: true,
      })
    },
    [navigate],
  )

  const setCat = useCallback(
    (next: string) => {
      void navigate({
        search: (prev: Record<string, unknown>) => ({
          ...prev,
          cat: next,
        }),
        replace: true,
      })
    },
    [navigate],
  )

  const clear = useCallback(() => {
    void navigate({ search: {}, replace: true })
  }, [navigate])

  return { q, cat: cat ?? 'fileName', setQ, setCat, clear }
}
