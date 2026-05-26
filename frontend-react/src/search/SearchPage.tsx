import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import type { GridApi, GridReadyEvent } from 'ag-grid-community'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Footer } from '@/components/app-shell/footer'
import { BrandLogo } from '@/components/app-shell/BrandLogo'
import { UserChip } from '@/components/app-shell/UserChip'
import { ThemeSwitch } from '@/components/layout/theme-switch'

import { CategoryTabBar } from '@/search/CategoryTabBar'
import { SearchBar } from '@/search/SearchBar'
import { SearchGrid } from '@/search/SearchGrid'
import { SearchToolbar } from '@/search/SearchToolbar'
import { useRecentSearches } from '@/search/hooks/useRecentSearches'
import { useSuggestions } from '@/search/hooks/useSuggestions'
import { useUserInfo } from '@/search/hooks/useUserInfo'
import { buildExportFilename } from '@/search/lib/buildExportFilename'
import { deriveSearchResults } from '@/search/lib/deriveSearchResults'
import { InitialSearchResponseV4Schema, type CategoryResultV4 } from '@/search/types'
import { apiFetch, reportRequestFailure } from '@/lib/queryClient'

/**
 * SearchPage — the multi-category federated results view at `/search?q=…`
 * (Angular `search-v5` parity in the shadcn shell).
 *
 * One `GET /initial` per `q` → `deriveSearchResults` (categories with hits,
 * sorted by count desc). One tab per result category; only the ACTIVE tab's
 * grid is mounted (keyed by `${q}-${key}` in SearchGrid → clean remount + a
 * fresh SSRM datasource on every tab switch). The active tab is the URL `tab`
 * when valid, else the highest-count category; once results resolve the URL is
 * synced to the active key (replace). No `/config`, no hardcoded category.
 */
export function SearchPage(): React.ReactElement {
  const { q, tab } = useSearch({ from: '/search' }) as { q?: string; tab?: string }
  const navigate = useNavigate({ from: '/search' })
  const user = useUserInfo()
  const { push: pushRecent } = useRecentSearches()

  const [inputValue, setInputValue] = useState<string>(q ?? '')
  const suggestions = useSuggestions(inputValue)
  const [results, setResults] = useState<CategoryResultV4[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<{ correlationId?: string } | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [resultCount, setResultCount] = useState<number | null>(null)
  const gridApiRef = useRef<GridApi | null>(null)

  const runSearch = useCallback(
    async (term: string) => {
      const trimmed = term.trim()
      if (!trimmed) return
      setIsLoading(true)
      setError(null)
      setResultCount(null)
      try {
        const res = await apiFetch(`/rectrace/api/v4/search/initial?keyword=${encodeURIComponent(trimmed)}`)
        const parsed = InitialSearchResponseV4Schema.parse(await res.json())
        setResults(deriveSearchResults(parsed))
        pushRecent(trimmed)
      } catch (err) {
        setError({ correlationId: (err as { correlationId?: string }).correlationId })
        setResults([])
        reportRequestFailure(err)
      } finally {
        setIsLoading(false)
      }
    },
    [pushRecent],
  )

  // Deep-link + URL-driven q: run the search whenever q changes.
  useEffect(() => {
    if (q && q.trim()) {
      setInputValue(q)
      void runSearch(q)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const activeCategory = useMemo<CategoryResultV4 | undefined>(() => {
    if (results.length === 0) return undefined
    return results.find((r) => r.key === tab) ?? results[0]
  }, [results, tab])

  // Sync the URL tab to the active category once results resolve (Angular parity).
  useEffect(() => {
    if (results.length === 0) return
    const valid = tab && results.some((r) => r.key === tab)
    if (!valid && activeCategory) {
      void navigate({
        search: (prev: Record<string, unknown>) => ({ ...prev, tab: activeCategory.key }),
        replace: true,
      })
    }
  }, [results, tab, activeCategory, navigate])

  const handleSubmit = useCallback(
    (term: string) => {
      const t = term.trim()
      if (t) void navigate({ search: { q: t }, replace: true })
    },
    [navigate],
  )

  const handleClear = useCallback(() => {
    setInputValue('')
    setResults([])
    setResultCount(null)
    setError(null)
    void navigate({ to: '/' })
  }, [navigate])

  const handleSelectTab = useCallback(
    (key: string) => {
      void navigate({
        search: (prev: Record<string, unknown>) => ({ ...prev, tab: key }),
        replace: true,
      })
    },
    [navigate],
  )

  const handleExport = useCallback(() => {
    const api = gridApiRef.current
    if (!api || !activeCategory) return
    setIsExporting(true)
    try {
      const cols = api.getColumns()
      const columnKeys = cols
        ? cols.filter((c) => c.getColId() !== 'execution_order').map((c) => c.getColId())
        : undefined
      api.exportDataAsExcel({ fileName: buildExportFilename(activeCategory.key, q ?? ''), columnKeys })
    } catch (err) {
      reportRequestFailure(err)
    } finally {
      setIsExporting(false)
    }
  }, [activeCategory, q])

  return (
    <div className="flex min-h-screen flex-col">
      <header
        className="bg-background/40 sticky top-0 z-50 flex items-center justify-between gap-3 border-b px-4 backdrop-blur-md"
        style={{ height: 'var(--header-height, 2.5rem)' }}
      >
        <BrandLogo className="h-5 w-auto" />
        <div className="flex-1">
          <SearchBar
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleSubmit}
            onClear={handleClear}
            suggestions={suggestions}
            placeholder="Search…"
          />
        </div>
        <ThemeSwitch />
        <UserChip {...user} />
      </header>

      {isLoading ? (
        <div role="status" aria-label="Loading results..." className="flex flex-col gap-2 p-4">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : error ? (
        <ErrorStateCard correlationId={error.correlationId} onRetry={() => q && void runSearch(q)} />
      ) : results.length === 0 ? (
        <NoResultsState term={q ?? ''} />
      ) : (
        <>
          <CategoryTabBar categories={results} activeKey={activeCategory?.key ?? results[0].key} onSelect={handleSelectTab} />
          <SearchToolbar resultCount={resultCount} onExport={handleExport} isExporting={isExporting} />
          <main className="flex-1 overflow-hidden">
            {activeCategory && (
              <SearchGrid
                q={q ?? ''}
                category={activeCategory}
                onGridReady={(e: GridReadyEvent) => {
                  gridApiRef.current = e.api
                }}
                onModelUpdated={setResultCount}
              />
            )}
          </main>
        </>
      )}
      <Footer />
    </div>
  )
}

function NoResultsState({ term }: { term: string }): React.ReactElement {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>No results found</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          No results found for &ldquo;<strong>{term}</strong>&rdquo;. Try a different term.
        </CardContent>
      </Card>
    </div>
  )
}

interface ErrorStateCardProps {
  correlationId?: string
  onRetry: () => void
}

function ErrorStateCard({ correlationId, onRetry }: ErrorStateCardProps): React.ReactElement {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Search unavailable</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
          <p>
            Failed to load results.{' '}
            {correlationId ? (
              <>
                Error reference: <code className="font-mono">{correlationId}</code> — quote this when reporting an issue.
              </>
            ) : (
              'Check the browser console for details.'
            )}
          </p>
          <div>
            <Button type="button" variant="default" size="sm" onClick={onRetry}>
              Try again
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
