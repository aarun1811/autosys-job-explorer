import { describe, test, expect, vi, afterEach } from 'vitest'
import { apiFetch } from './queryClient'

afterEach(() => { vi.restoreAllMocks() })

describe('apiFetch', () => {
  test('attaches X-Correlation-Id header to request', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', mockFetch)
    await apiFetch('/rectrace/api/v4/search/ssrm/fileName', { method: 'POST', body: '{}' })
    const [, init] = mockFetch.mock.calls[0]
    expect((init as RequestInit).headers).toHaveProperty('X-Correlation-Id')
    const corrId = (init as RequestInit & { headers: Record<string, string> }).headers['X-Correlation-Id']
    expect(corrId).toMatch(/^[0-9a-f]{32}$/)
  })

  test('throws error with correlationId property on non-2xx response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 500 })
    vi.stubGlobal('fetch', mockFetch)
    const err = await apiFetch('/rectrace/api/v4/search/ssrm/fileName', {}).catch(e => e)
    expect(err).toBeInstanceOf(Error)
    expect((err as { correlationId: string }).correlationId).toMatch(/^[0-9a-f]{32}$/)
  })
})
