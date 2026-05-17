import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { apiFetch } from '@/lib/queryClient'
import {
  SearchConfigurationV4Schema,
  type SearchConfigurationV4,
} from '@/search/types'

/**
 * Fetches and Zod-validates the V4 search configuration.
 *
 * The backend (SearchConfigServiceV4) parses search-config-v4.json once at
 * @PostConstruct and holds it in memory — config can only change on
 * application restart. Hence the Infinity stale / gc timings below.
 *
 * Errors (network failure OR Zod parse failure) propagate via the
 * QueryClient's QueryCache.onError → reportRequestFailure handler wired in
 * src/lib/queryClient.ts, surfacing a Sonner toast with the correlation ID.
 * No local error handling needed here.
 *
 * Threat model: this hook is the gate at the backend → React trust boundary.
 * Zod parse rejects malformed payloads before they reach grid/UI code.
 */
export function useSearchConfig(): UseQueryResult<SearchConfigurationV4> {
  return useQuery<SearchConfigurationV4>({
    queryKey: ['search-config'],
    queryFn: async () => {
      const res = await apiFetch('/rectrace/api/v4/search/config')
      const json: unknown = await res.json()
      return SearchConfigurationV4Schema.parse(json)
    },
    staleTime: Infinity,
    gcTime: Infinity,
  })
}
