import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  useRecentSearches,
  RECENT_SEARCHES_KEY,
  RECENT_SEARCHES_MAX,
} from '@/search/hooks/useRecentSearches'

describe('useRecentSearches', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns an empty array on fresh mount with empty localStorage', () => {
    const { result } = renderHook(() => useRecentSearches())
    expect(result.current.recents).toEqual([])
  })

  it('pushes a single term and persists it to localStorage', () => {
    const { result } = renderHook(() => useRecentSearches())
    act(() => {
      result.current.push('alpha')
    })
    expect(result.current.recents).toEqual(['alpha'])
    expect(JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) ?? '[]')).toEqual(['alpha'])
  })

  it('prepends new terms newest-first', () => {
    const { result } = renderHook(() => useRecentSearches())
    act(() => {
      result.current.push('alpha')
    })
    act(() => {
      result.current.push('beta')
    })
    expect(result.current.recents).toEqual(['beta', 'alpha'])
  })

  it('dedupes identical terms (case-sensitive) and moves them to the front', () => {
    const { result } = renderHook(() => useRecentSearches())
    act(() => {
      result.current.push('alpha')
    })
    act(() => {
      result.current.push('alpha')
    })
    expect(result.current.recents).toEqual(['alpha'])
  })

  it('treats different casings as distinct entries (case-sensitive)', () => {
    const { result } = renderHook(() => useRecentSearches())
    act(() => {
      result.current.push('Alpha')
    })
    act(() => {
      result.current.push('alpha')
    })
    expect(result.current.recents).toEqual(['alpha', 'Alpha'])
  })

  it('caps the list at RECENT_SEARCHES_MAX (10) and drops the oldest (LRU)', () => {
    const { result } = renderHook(() => useRecentSearches())
    const terms = Array.from({ length: 11 }, (_, i) => `term-${i}`)
    act(() => {
      for (const t of terms) result.current.push(t)
    })
    expect(result.current.recents.length).toBe(RECENT_SEARCHES_MAX)
    // newest-first ordering: term-10, term-9, ..., term-1 (term-0 evicted)
    expect(result.current.recents[0]).toBe('term-10')
    expect(result.current.recents).not.toContain('term-0')
  })

  it('treats whitespace-only terms as no-ops', () => {
    const { result } = renderHook(() => useRecentSearches())
    act(() => {
      result.current.push('alpha')
    })
    act(() => {
      result.current.push('   ')
    })
    act(() => {
      result.current.push('\t\n')
    })
    expect(result.current.recents).toEqual(['alpha'])
  })

  it('returns an empty array when localStorage holds malformed JSON', () => {
    localStorage.setItem(RECENT_SEARCHES_KEY, '{not json')
    const { result } = renderHook(() => useRecentSearches())
    expect(result.current.recents).toEqual([])
  })

  it('filters out non-string entries from localStorage', () => {
    localStorage.setItem(
      RECENT_SEARCHES_KEY,
      JSON.stringify(['alpha', 42, null, { foo: 1 }, 'beta']),
    )
    const { result } = renderHook(() => useRecentSearches())
    expect(result.current.recents).toEqual(['alpha', 'beta'])
  })

  it('returns an empty array when localStorage holds a non-array payload', () => {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify({ not: 'an array' }))
    const { result } = renderHook(() => useRecentSearches())
    expect(result.current.recents).toEqual([])
  })

  it('does not throw when localStorage.setItem throws (quota exceeded)', () => {
    const setItemSpy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('QuotaExceededError')
      })
    const { result } = renderHook(() => useRecentSearches())
    expect(() => {
      act(() => {
        result.current.push('alpha')
      })
    }).not.toThrow()
    // In-memory state still updates even when persistence fails
    expect(result.current.recents).toEqual(['alpha'])
    setItemSpy.mockRestore()
  })

  it('remove() drops a single term and persists the rest', () => {
    const { result } = renderHook(() => useRecentSearches())
    act(() => {
      result.current.push('alpha')
      result.current.push('beta')
      result.current.push('gamma')
    })
    act(() => {
      result.current.remove('beta')
    })
    expect(result.current.recents).toEqual(['gamma', 'alpha'])
    expect(JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY)!)).toEqual(['gamma', 'alpha'])
  })

  it('remove() of an absent term is a no-op', () => {
    const { result } = renderHook(() => useRecentSearches())
    act(() => {
      result.current.push('alpha')
    })
    act(() => {
      result.current.remove('nope')
    })
    expect(result.current.recents).toEqual(['alpha'])
  })

  it('clear() empties the list and removes the localStorage key', () => {
    const { result } = renderHook(() => useRecentSearches())
    act(() => {
      result.current.push('alpha')
      result.current.push('beta')
    })
    act(() => {
      result.current.clear()
    })
    expect(result.current.recents).toEqual([])
    expect(localStorage.getItem(RECENT_SEARCHES_KEY)).toBeNull()
  })

  it('clear() does not throw when localStorage.removeItem throws', () => {
    const removeItemSpy = vi
      .spyOn(Storage.prototype, 'removeItem')
      .mockImplementation(() => {
        throw new Error('SecurityError')
      })
    const { result } = renderHook(() => useRecentSearches())
    act(() => {
      result.current.push('alpha')
    })
    expect(() => {
      act(() => {
        result.current.clear()
      })
    }).not.toThrow()
    expect(result.current.recents).toEqual([])
    removeItemSpy.mockRestore()
  })

  it('caps to MAX even when reading an over-sized existing localStorage payload', () => {
    const oversized = Array.from({ length: 15 }, (_, i) => `t-${i}`)
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(oversized))
    const { result } = renderHook(() => useRecentSearches())
    expect(result.current.recents.length).toBe(RECENT_SEARCHES_MAX)
    expect(result.current.recents).toEqual(oversized.slice(0, RECENT_SEARCHES_MAX))
  })
})
