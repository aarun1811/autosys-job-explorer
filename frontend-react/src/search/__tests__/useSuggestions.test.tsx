/* eslint-disable @typescript-eslint/require-await */
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const apiFetchMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/queryClient', () => ({ apiFetch: apiFetchMock, reportRequestFailure: vi.fn() }))
import { useSuggestions } from '@/search/hooks/useSuggestions'

beforeEach(() => {
  vi.useFakeTimers()
  apiFetchMock.mockReset()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('useSuggestions', () => {
  test('does not query for terms shorter than 2 chars', () => {
    const { rerender } = renderHook(({ q }) => useSuggestions(q), { initialProps: { q: 'a' } })
    act(() => { vi.advanceTimersByTime(400) })
    expect(apiFetchMock).not.toHaveBeenCalled()
    rerender({ q: '' })
    act(() => { vi.advanceTimersByTime(400) })
    expect(apiFetchMock).not.toHaveBeenCalled()
  })

  test('debounces then queries /api/search/suggest?prefix=', async () => {
    apiFetchMock.mockResolvedValue({ json: async () => ['trade', 'trades'] })
    const { result, rerender } = renderHook(({ q }) => useSuggestions(q), { initialProps: { q: 'tr' } })
    rerender({ q: 'tra' })
    // advanceTimersByTimeAsync flushes microtasks between timers — required
    // because the debounce fires an async fetch chain (waitFor would hang
    // under fake timers since it relies on real timers internally).
    await act(async () => { await vi.advanceTimersByTimeAsync(300) })
    expect(apiFetchMock).toHaveBeenCalledTimes(1)
    expect(apiFetchMock).toHaveBeenCalledWith('/rectrace/api/search/suggest?prefix=tra')
    expect(result.current).toEqual(['trade', 'trades'])
  })

  test('error → empty array', async () => {
    apiFetchMock.mockRejectedValue(new Error('x'))
    const { result } = renderHook(() => useSuggestions('trade'))
    await act(async () => { await vi.advanceTimersByTimeAsync(300) })
    expect(apiFetchMock).toHaveBeenCalled()
    expect(result.current).toEqual([])
  })
})
