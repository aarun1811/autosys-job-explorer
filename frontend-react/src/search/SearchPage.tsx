import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import type { GridApi, GridReadyEvent } from 'ag-grid-community'
import { TriangleAlertIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Footer } from '@/components/app-shell/footer'
import { BrandLogo } from '@/components/app-shell/BrandLogo'
import { UserChip } from '@/components/app-shell/UserChip'
import { ThemeSwitch } from '@/components/layout/theme-switch'

import { CategoryTabBar } from '@/search/CategoryTabBar'
import { NoResultsState } from '@/search/NoResultsState'
import { SearchBar } from '@/search/SearchBar'
import { SearchGrid } from '@/search/SearchGrid'
import { SearchToolbar } from '@/search/SearchToolbar'
import { useRecentSearches } from '@/search/hooks/useRecentSearches'
import { useSuggestions } from '@/search/hooks/useSuggestions'
import { useUserInfo } from '@/search/hooks/useUserInfo'
import { buildExportFilename } from '@/search/lib/buildExportFilename'
import { deriveSearchResults } from '@/search/lib/deriveSearchResults'
import { PLACEHOLDER_PHRASES, TRY_EXAMPLES } from '@/search/lib/heroContent'
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
  const { q, tab } = useSearch({ from: '/search' })
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

  // Deep-link + URL-driven q: run the search whenever q changes. Syncing the
  // controlled input from the URL (source of truth) is a legitimate
  // external→React sync, not a cascading-render anti-pattern.
  useEffect(() => {
    if (q && q.trim()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
    <div className="flex h-screen flex-col overflow-hidden">
      <header
        className="bg-background/70 supports-[backdrop-filter]:bg-background/55 sticky top-0 z-50 flex items-center gap-3 border-b px-4 shadow-[0_1px_0_0_color-mix(in_oklab,var(--foreground)_4%,transparent)] backdrop-blur-xl"
        style={{ height: 'var(--header-height, 3.5rem)' }}
      >
        <Link
          to="/"
          aria-label="Go to Rectrace home"
          className="shrink-0 rounded-md transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <BrandLogo className="h-6 w-auto" />
        </Link>
        <div className="ml-4 w-full max-w-xl sm:ml-6">
          <SearchBar
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleSubmit}
            // Clearing the navbar field just empties it and keeps the caret in
            // the box (Google-style) — it does NOT navigate away or drop the
            // current results. "Start over" (empty state) is what returns home.
            onClear={() => setInputValue('')}
            suggestions={suggestions}
            submitButton="icon"
            placeholder="Search…"
          />
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5">
          <ThemeSwitch />
          <UserChip {...user} />
        </div>
      </header>

      {isLoading ? (
        <div role="status" aria-label="Loading results..." className="flex flex-col gap-2.5 p-5">
          <Skeleton className="h-10 w-64 rounded-lg" />
          <Skeleton className="h-9 w-full rounded-lg" />
          <Skeleton className="h-9 w-full rounded-lg" />
          <Skeleton className="h-9 w-full rounded-lg" />
        </div>
      ) : error ? (
        <ErrorStateCard correlationId={error.correlationId} onRetry={() => q && void runSearch(q)} />
      ) : results.length === 0 ? (
        <NoResultsState
          term={q ?? ''}
          examples={TRY_EXAMPLES.slice(0, 6)}
          searchableCategories={PLACEHOLDER_PHRASES}
          onExample={handleSubmit}
          onClear={handleClear}
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden animate-in fade-in-0 duration-300">
          <CategoryTabBar categories={results} activeKey={activeCategory?.key ?? results[0].key} onSelect={handleSelectTab} />
          <SearchToolbar resultCount={resultCount} onExport={handleExport} isExporting={isExporting} />
          <main className="min-h-0 flex-1 overflow-hidden px-3 pb-3">
            {activeCategory && (
              <div className="h-full overflow-hidden rounded-xl border bg-card shadow-sm">
                <SearchGrid
                  q={q ?? ''}
                  category={activeCategory}
                  onGridReady={(e: GridReadyEvent) => {
                    gridApiRef.current = e.api
                  }}
                  onModelUpdated={setResultCount}
                />
              </div>
            )}
          </main>
        </div>
      )}
      <Footer />
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
      <Card className="max-w-md animate-in fade-in-0 zoom-in-95 fill-mode-both duration-500">
        <CardHeader className="items-center text-center">
          <div className="mb-1 flex size-12 items-center justify-center rounded-full bg-destructive/10">
            <TriangleAlertIcon className="size-6 text-destructive" />
          </div>
          <CardTitle>Search unavailable</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3 text-center text-sm text-muted-foreground">
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
