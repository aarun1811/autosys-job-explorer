import { createFileRoute, redirect } from '@tanstack/react-router'

/**
 * Root route `/` redirects to `/search` (SEARCH-07 / Phase 2 D-2.4).
 *
 * The full app shell (header + SearchBar + CategoryTabBar + SearchToolbar +
 * SearchGrid + Footer) lives inside `SearchPage` (`routes/search.tsx`); this
 * file is intentionally body-less so a deep-link to `/` never renders a flash
 * of an obsolete layout before the redirect resolves. `beforeLoad` runs before
 * the route component would render, so no UI is ever produced here.
 */
export const Route = createFileRoute('/')({
  beforeLoad: () => {
    // TanStack Router's `redirect()` returns a Redirect error subclass that
    // the router catches and converts into a navigation — the canonical
    // pattern per its docs. eslint's only-throw-error rule doesn't recognize
    // the Redirect class as an Error, so we silence it here.
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw redirect({ to: '/search' })
  },
})
