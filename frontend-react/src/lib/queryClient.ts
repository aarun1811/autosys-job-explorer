import { QueryClient, QueryCache } from '@tanstack/react-query'
import { toast } from 'sonner'

const BASE_URL = ''

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const correlationId = crypto.randomUUID().replace(/-/g, '')
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
        'X-Correlation-Id': correlationId,
      },
    })
    if (!res.ok) {
      throw Object.assign(new Error(`HTTP ${res.status} ${path}`), { correlationId })
    }
    return res
  } catch (err) {
    // Attach the correlationId to network-layer errors too (e.g. TypeError
    // "Failed to fetch" when the backend is unreachable). Without this the
    // bottom-right Sonner toast cannot quote the corr-id on connection failures.
    if (err && typeof err === 'object' && !(err as { correlationId?: string }).correlationId) {
      ;(err as { correlationId?: string }).correlationId = correlationId
    }
    throw err
  }
}

/**
 * Surface a network/HTTP failure as a bottom-right Sonner toast that includes
 * the correlationId so the user can quote it in a bug report.
 *
 * Exported so callers that bypass React Query (e.g. the AG-Grid SSRM
 * datasource in SmokeGrid, where errors hit params.fail() rather than the
 * QueryClient.queryCache onError path) can route through the same UX.
 */
export function reportRequestFailure(err: unknown): void {
  const corrId =
    err != null && typeof err === 'object' && typeof (err as Record<string, unknown>)['correlationId'] === 'string'
      ? (err as Record<string, unknown>)['correlationId'] as string
      : undefined
  toast.error('Request failed', {
    description: corrId
      ? `Error reference: ${corrId}`
      : 'Something went wrong. Check the browser console for details.',
  })
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: reportRequestFailure,
  }),
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
