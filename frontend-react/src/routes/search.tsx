import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { SearchPage } from '@/search/SearchPage'

/**
 * Zod-validated search params for `/search`.
 *
 * The route is the trust boundary for URL-borne state (D-3.1, T-03.7-01):
 *   - `q`: optional keyword. Undefined when omitted from the URL.
 *   - `cat`: optional category key; defaults to 'fileName' (Phase 3 ships a
 *     single category — D-3.4).
 *
 * Downstream code (`SearchPage`, `useSearchState`) reads these as typed
 * values; encodeURIComponent at the apiFetch call site is the second gate.
 */
const searchSchema = z.object({
  q: z.string().optional(),
  cat: z.string().optional().default('fileName'),
})

export const Route = createFileRoute('/search')({
  validateSearch: searchSchema,
  component: SearchPage,
})
