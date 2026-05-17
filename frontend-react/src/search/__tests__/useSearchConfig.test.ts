import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider, QueryCache } from '@tanstack/react-query'
import React from 'react'

// Hoisted mock: replace the production queryClient module so the hook calls
// our mocked apiFetch instead of the real fetch path. reportRequestFailure is
// also mocked so the QueryCache.onError handler can be asserted.
vi.mock('@/lib/queryClient', () => ({
  apiFetch: vi.fn(),
  reportRequestFailure: vi.fn(),
  // We never use the real queryClient here — tests build their own via wrapper.
  queryClient: undefined,
}))

import { apiFetch, reportRequestFailure } from '@/lib/queryClient'
import { useSearchConfig } from '../hooks/useSearchConfig'

// Canonical fileName fixture (matches search-config-v4.json shape).
const validConfigPayload = {
  categories: [
    {
      key: 'fileName',
      label: 'File Name',
      searchColumn: 'file_name_pattern',
      elasticsearch: {
        index: 'rectrace_core_index',
        searchFields: ['file_name_pattern', 'file_name_pattern.keyword'],
        collapseField: 'file_name_pattern.keyword',
        maxResults: 1000,
      },
      oracle: { table: 'rectrace_core' },
      columns: [
        { field: 'file_name_pattern', headerName: 'File Name', rowGroup: true },
      ],
    },
  ],
}

function makeWrapper(): { wrapper: React.FC<{ children: React.ReactNode }>; client: QueryClient } {
  const onErrorSpy = reportRequestFailure as unknown as ReturnType<typeof vi.fn>
  const client = new QueryClient({
    queryCache: new QueryCache({ onError: (err) => onErrorSpy(err) }),
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) =>
    React.createElement(QueryClientProvider, { client }, children)
  return { wrapper, client }
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useSearchConfig', () => {
  test('calls apiFetch with /rectrace/api/v4/search/config', async () => {
    const mockApi = apiFetch as unknown as ReturnType<typeof vi.fn>
    mockApi.mockResolvedValue({ json: async () => validConfigPayload } as Response)

    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useSearchConfig(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockApi).toHaveBeenCalledTimes(1)
    expect(mockApi).toHaveBeenCalledWith('/rectrace/api/v4/search/config')
  })

  test('returns Zod-parsed SearchConfigurationV4 on success', async () => {
    const mockApi = apiFetch as unknown as ReturnType<typeof vi.fn>
    mockApi.mockResolvedValue({ json: async () => validConfigPayload } as Response)

    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useSearchConfig(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.categories[0].key).toBe('fileName')
    expect(result.current.data?.categories[0].columns[0].field).toBe('file_name_pattern')
  })

  test('Zod-rejects malformed response and routes through QueryCache.onError → reportRequestFailure', async () => {
    const mockApi = apiFetch as unknown as ReturnType<typeof vi.fn>
    mockApi.mockResolvedValue({ json: async () => ({ wrong: true }) } as Response)

    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useSearchConfig(), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    // QueryCache onError in the test wrapper forwards to reportRequestFailure mock
    expect(reportRequestFailure).toHaveBeenCalledTimes(1)
    expect(result.current.error).toBeDefined()
    // ZodError has a name property — assert it propagated
    expect((result.current.error as { name?: string }).name).toBe('ZodError')
  })

  test('uses queryKey ["search-config"]', async () => {
    const mockApi = apiFetch as unknown as ReturnType<typeof vi.fn>
    mockApi.mockResolvedValue({ json: async () => validConfigPayload } as Response)

    const { wrapper, client } = makeWrapper()
    renderHook(() => useSearchConfig(), { wrapper })

    await waitFor(() => {
      const cached = client.getQueryCache().find({ queryKey: ['search-config'] })
      expect(cached).toBeDefined()
    })
  })

  test('uses staleTime: Infinity (config never goes stale until restart)', async () => {
    const mockApi = apiFetch as unknown as ReturnType<typeof vi.fn>
    mockApi.mockResolvedValue({ json: async () => validConfigPayload } as Response)

    const { wrapper, client } = makeWrapper()
    renderHook(() => useSearchConfig(), { wrapper })

    await waitFor(() => {
      const q = client.getQueryCache().find({ queryKey: ['search-config'] })
      expect(q).toBeDefined()
    })
    const q = client.getQueryCache().find({ queryKey: ['search-config'] })
    // TanStack Query exposes the configured staleTime on each observer.
    const observer = q?.observers[0]
    expect(observer?.options.staleTime).toBe(Infinity)
  })
})
