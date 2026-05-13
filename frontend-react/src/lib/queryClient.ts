import { QueryClient, QueryCache } from '@tanstack/react-query'
import { toast } from 'sonner'

const BASE_URL = ''

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const correlationId = crypto.randomUUID().replace(/-/g, '')
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
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      const corrId = (error as { correlationId?: string }).correlationId
      toast.error('Request failed', {
        description: corrId
          ? `Error reference: ${corrId}`
          : 'Something went wrong. Check the browser console for details.',
      })
    },
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
