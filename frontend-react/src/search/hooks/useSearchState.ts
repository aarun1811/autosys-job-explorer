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
 * The URL is the single source of truth for `q` and `tab` (the selected
 * category key — Angular `search-v5` parity). All writes use `replace: true`
 * so the back-stack does not grow with every keystroke — the Angular
 * `updateUrlWithState` `replaceUrl: true` semantics translated 1:1.
 *
 * Both fields default to `undefined` when absent from the URL. There is NO
 * hardcoded category default: the active tab is derived from the search
 * results (highest-count category) when `tab` is absent — see SearchPage.
 *
 * Zod validation lives on the route (`routes/search.tsx` `validateSearch`), so
 * by the time `useSearch` resolves, `q` and `tab` are already typed/sanitized.
 */
export function useSearchState(): {
  q: string | undefined
  tab: string | undefined
  setQ: (next: string | undefined) => void
  setTab: (next: string | undefined) => void
  clear: () => void
} {
  const raw = useSearchLoose({ from: '/search' })
  const q = typeof raw.q === 'string' ? raw.q : undefined
  const tab = typeof raw.tab === 'string' ? raw.tab : undefined
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

  const setTab = useCallback(
    (next: string | undefined) => {
      void navigate({
        search: (prev: Record<string, unknown>) => {
          const rest = { ...prev }
          delete rest.tab
          return next ? { ...rest, tab: next } : rest
        },
        replace: true,
      })
    },
    [navigate],
  )

  const clear = useCallback(() => {
    void navigate({ search: {}, replace: true })
  }, [navigate])

  return { q, tab, setQ, setTab, clear }
}
