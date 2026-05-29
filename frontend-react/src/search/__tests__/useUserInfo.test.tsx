import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const apiFetchMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/queryClient', () => ({ apiFetch: apiFetchMock, reportRequestFailure: vi.fn() }))
import { useUserInfo } from '@/search/hooks/useUserInfo'

beforeEach(() => {
  localStorage.clear()
  apiFetchMock.mockReset()
})

describe('useUserInfo', () => {
  test('uses cached loginId from localStorage without calling the endpoint', async () => {
    localStorage.setItem('userLoginId', 'john.doe')
    const { result } = renderHook(() => useUserInfo())
    await waitFor(() => expect(result.current.isIdentified).toBe(true))
    expect(result.current.loginId).toBe('john.doe')
    expect(result.current.initials).toBe('JD')
    expect(apiFetchMock).not.toHaveBeenCalled()
  })

  test('falls back to /api/user/info and caches a non-null loginId', async () => {
    apiFetchMock.mockResolvedValue({ json: async () => ({ loginId: 'jane.roe' }) })
    const { result } = renderHook(() => useUserInfo())
    await waitFor(() => expect(result.current.isIdentified).toBe(true))
    expect(result.current.loginId).toBe('jane.roe')
    expect(localStorage.getItem('userLoginId')).toBe('jane.roe')
    expect(apiFetchMock).toHaveBeenCalledWith('/rectrace/api/user/info')
  })

  test('null loginId → unidentified, nothing cached', async () => {
    apiFetchMock.mockResolvedValue({ json: async () => ({ loginId: null }) })
    const { result } = renderHook(() => useUserInfo())
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalled())
    expect(result.current.isIdentified).toBe(false)
    expect(localStorage.getItem('userLoginId')).toBeNull()
  })

  test('endpoint error → unidentified (swallowed)', async () => {
    apiFetchMock.mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useUserInfo())
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalled())
    expect(result.current.isIdentified).toBe(false)
  })
})
