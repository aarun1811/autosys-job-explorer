import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import type { GridApi, GridReadyEvent } from 'ag-grid-community'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Footer } from '@/components/app-shell/footer'
import { ThemeSwitch } from '@/components/layout/theme-switch'

import { CategoryTabBar } from '@/search/CategoryTabBar'
import { SearchBar } from '@/search/SearchBar'
import { SearchGrid } from '@/search/SearchGrid'
import { SearchToolbar } from '@/search/SearchToolbar'
import { useRecentSearches } from '@/search/hooks/useRecentSearches'
import { buildExportFilename } from '@/search/lib/buildExportFilename'
import {
  type InitialSearchResponseV4,
  InitialSearchResponseV4Schema,
} from '@/search/types'
import { apiFetch, reportRequestFailure } from '@/lib/queryClient'

/**
 * SearchPage — the Phase 3 vertical-slice orchestrator.
 *
 * Composes the full app shell + search experience: header (Rectrace brand +
 * SearchBar + ThemeSwitch) → CategoryTabBar → SearchToolbar → main grid slot
 * (PreSearch / Loading / Error / SearchGrid) → Footer.
 *
 * URL is the single source of truth (D-3.1): `useSearch({ from: '/search' })`
 * reads Zod-validated `{ q, cat }`. handleSubmit issues a `replace: true`
 * navigation then fires `apiFetch('/rectrace/api/v4/search/initial?keyword=...')`
 * (GET — Pitfall 4 / D-3.7), parses the response through
 * `InitialSearchResponseV4Schema.parse()` at the trust boundary (T-03.7-02),
 * and stores the result as `initialFilter` for SearchGrid.
 *
 * Deep-link restore (D-3.2 — Angular `initializeQueryParamsSubscription`
 * parity): a useEffect keyed on `[q, cat]` fires `handleSubmit(q)` once on
 * mount when `q` is present and no filter is loaded yet, and syncs the input
 * value when the URL changes externally. Re-entrancy is gated by
 * `!initialFilter && !isInitialLoading` (T-03.7-05).
 *
 * Grid integration (D-3.10 / SEARCH-04): `gridApiRef` is captured via
 * `onGridReady` and `resultCount` via `onModelUpdated`. The Excel-export
 * closure passed to SearchToolbar calls `gridApi.exportDataAsExcel({ fileName:
 * buildExportFilename(cat, q), columnKeys })` excluding the `execution_order`
 * action column.
 *
 * Errors route through `reportRequestFailure(err)` (Sonner with 32-hex
 * correlation ID — SEARCH-06) AND surface inline as an error-state card with a
 * "Try again" button (UI-SPEC §"Error Surfaces").
 */
export function SearchPage(): React.ReactElement {
  const { q, cat } = useSearch({ from: '/search' })
  const navigate = useNavigate({ from: '/search' })
  const { push: pushRecent } = useRecentSearches()

  const [inputValue, setInputValue] = useState<string>(q ?? '')
  const [initialFilter, setInitialFilter] = useState<InitialSearchResponseV4 | null>(null)
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(false)
  const [initialError, setInitialError] = useState<{ correlationId?: string } | null>(null)
  const [isExporting, setIsExporting] = useState<boolean>(false)
  // resultCount is wired via SearchGrid.onModelUpdated below (NOT optional —
  // UI-SPEC parity requires the Toolbar Badge to update on every model
  // change). SearchToolbar hides the Badge when this is null or 0.
  const [resultCount, setResultCount] = useState<number | null>(null)
  const gridApiRef = useRef<GridApi | null>(null)

  const handleSubmit = useCallback(
    async (term: string) => {
      const trimmed = term.trim()
      if (!trimmed) return
      await navigate({
        search: (prev: Record<string, unknown>) => ({ ...prev, q: trimmed, cat }),
        replace: true,
      })
      setIsInitialLoading(true)
      setInitialError(null)
      try {
        const res = await apiFetch(
          `/rectrace/api/v4/search/initial?keyword=${encodeURIComponent(trimmed)}`,
        )
        const json: unknown = await res.json()
        const parsed = InitialSearchResponseV4Schema.parse(json)
        setInitialFilter(parsed)
        pushRecent(trimmed)
      } catch (err) {
        const correlationId = (err as { correlationId?: string }).correlationId
        setInitialError({ correlationId })
        reportRequestFailure(err)
      } finally {
        setIsInitialLoading(false)
      }
    },
    [navigate, pushRecent, cat],
  )

  // Deep-link restore + URL-driven input sync (D-3.2). handleSubmit is stable
  // via useCallback; intentionally omitted from the dep array to match Angular
  // initializeQueryParamsSubscription semantics (fire once per URL change, not
  // per handler-identity change). See plan §URL-restore.
  //
  // The setInputValue call inside this effect synchronizes the controlled
  // input with the URL — a legitimate "sync external system → React state"
  // pattern (the URL is the source of truth per D-3.1). React's lint rule
  // doesn't distinguish this from a cascading-render anti-pattern; we silence
  // it on the setState lines because the alternative (deriving input value
  // from URL on every render) would prevent the user from typing freely
  // while the URL lags.
  useEffect(() => {
    if (q && q.trim() && !initialFilter && !isInitialLoading) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInputValue(q)
      void handleSubmit(q)
    } else if (q !== undefined && q !== inputValue) {
      setInputValue(q)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, cat])

  const handleClear = useCallback(() => {
    setInputValue('')
    setInitialFilter(null)
    setResultCount(null)
    setInitialError(null)
    void navigate({ search: {}, replace: true })
  }, [navigate])

  const handleGridReady = useCallback((event: GridReadyEvent) => {
    gridApiRef.current = event.api
  }, [])

  const handleModelUpdated = useCallback((rowCount: number) => {
    setResultCount(rowCount)
  }, [])

  const handleExport = useCallback(() => {
    const api = gridApiRef.current
    if (!api) return
    setIsExporting(true)
    try {
      // D-3.10: exclude the `execution_order` action column from the export.
      // getColumns() can return null pre-init; fall back to undefined which
      // tells AG-Grid to use all columns.
      const cols = api.getColumns()
      const columnKeys = cols
        ? cols
            .filter((c) => c.getColId() !== 'execution_order')
            .map((c) => c.getColId())
        : undefined
      api.exportDataAsExcel({
        fileName: buildExportFilename(cat, q ?? ''),
        columnKeys,
      })
    } catch (err) {
      reportRequestFailure(err)
    } finally {
      setIsExporting(false)
    }
  }, [cat, q])

  return (
    <div className="flex flex-col min-h-screen">
      <header
        className="bg-background/40 sticky top-0 z-50 flex items-center justify-between px-4 border-b backdrop-blur-md"
        style={{ height: 'var(--header-height, 2.5rem)' }}
      >
        <span className="text-sm font-semibold">Rectrace</span>
        <div className="flex-1 px-6">
          <SearchBar
            value={inputValue}
            onChange={setInputValue}
            // SearchBar.onSubmit is typed (term: string) => void; handleSubmit
            // returns Promise<void>. Wrap in a `void` IIFE so the attribute
            // returns synchronously while the async work fires-and-forgets.
            onSubmit={(term) => {
              void handleSubmit(term)
            }}
            onClear={handleClear}
          />
        </div>
        <ThemeSwitch />
      </header>
      {q && (
        <>
          <CategoryTabBar activeCat={cat ?? 'fileName'} />
          <SearchToolbar
            resultCount={resultCount}
            onExport={handleExport}
            isExporting={isExporting}
          />
        </>
      )}
      <main className="flex-1 overflow-hidden">
        {!q ? (
          <PreSearchEmptyState />
        ) : isInitialLoading ? (
          <InitialLoadingSkeleton />
        ) : initialError ? (
          <ErrorStateCard
            correlationId={initialError.correlationId}
            onRetry={() => void handleSubmit(q)}
          />
        ) : initialFilter ? (
          <SearchGrid
            q={q}
            cat={cat ?? 'fileName'}
            initialFilter={initialFilter}
            onGridReady={handleGridReady}
            onModelUpdated={handleModelUpdated}
          />
        ) : null}
      </main>
      <Footer />
    </div>
  )
}

function PreSearchEmptyState(): React.ReactElement {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Search Autosys jobs</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Enter a search term above to find jobs by file name. Recent searches
          appear when you click the input.
        </CardContent>
      </Card>
    </div>
  )
}

function InitialLoadingSkeleton(): React.ReactElement {
  return (
    <div
      aria-label="Loading results..."
      role="status"
      className="flex flex-col gap-2 p-4"
    >
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
    </div>
  )
}

interface ErrorStateCardProps {
  correlationId?: string
  onRetry: () => void
}

function ErrorStateCard({ correlationId, onRetry }: ErrorStateCardProps): React.ReactElement {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Search unavailable</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
          <p>
            Failed to load results.{' '}
            {correlationId ? (
              <>
                Error reference: <code className="font-mono">{correlationId}</code> — quote
                this when reporting an issue.
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
