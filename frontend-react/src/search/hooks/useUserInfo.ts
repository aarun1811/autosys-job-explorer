import { useEffect, useState } from 'react'

import { apiFetch } from '@/lib/queryClient'
import { userInitials } from '@/search/lib/userInitials'

/**
 * localStorage key holding the resolved Citi loginId — Angular `initializeUser`
 * caches under this exact key, so the two apps share the cache during coexistence.
 */
const STORAGE_KEY = 'userLoginId'

export interface UserInfoState {
  loginId: string | null
  initials: string
  isIdentified: boolean
}

/**
 * User identity for the header chip — Angular `initializeUser` parity.
 *
 * 1. Read `localStorage['userLoginId']` first; if present, use it (no request).
 * 2. Otherwise `GET /rectrace/api/user/info` (backend reads the
 *    `x-citiportal-loginid` header the portal proxy injects in prod; locally
 *    it's absent → `{ loginId: null }`).
 * 3. A non-empty loginId is cached; null/empty/error → unidentified ("Sign in").
 */
export function useUserInfo(): UserInfoState {
  const [loginId, setLoginId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY)
    } catch {
      return null
    }
  })

  useEffect(() => {
    if (loginId) return // cached — no fetch (Angular parity)
    let cancelled = false
    void (async () => {
      try {
        const res = await apiFetch('/rectrace/api/user/info')
        const json = (await res.json()) as { loginId: string | null }
        if (cancelled) return
        if (json.loginId && json.loginId.trim() !== '') {
          setLoginId(json.loginId)
          try {
            localStorage.setItem(STORAGE_KEY, json.loginId)
          } catch {
            /* quota / blocked storage — in-memory state still updates */
          }
        }
      } catch {
        /* unreachable / non-2xx → stay unidentified */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loginId])

  return {
    loginId,
    initials: loginId ? userInitials(loginId) : '',
    isIdentified: Boolean(loginId),
  }
}
