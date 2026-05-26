import { createFileRoute } from '@tanstack/react-router'
import { SearchHero } from '@/search/SearchHero'

/**
 * Root route `/` IS the centered search hero — no redirect.
 *
 * Submitting a term from the hero navigates to `/search?q=<term>` (the results
 * view). This eliminates the previous `/` → `/search?cat=fileName` rewrite.
 */
export const Route = createFileRoute('/')({
  component: SearchHero,
})
