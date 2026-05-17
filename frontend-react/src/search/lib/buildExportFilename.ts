/**
 * Filename for the client-side Excel export (D-3.10).
 *
 *   rectrace-{cat}-{safeTerm}-{YYYYMMDD}.xlsx
 *
 * `safeTerm` lower-cases and replaces non-alphanumerics with `_` so the
 * filename is safe across operating systems and shells. T-03.7-04 covers the
 * accept-disposition on contents; the filename sanitization here addresses
 * the local-download surface in T-03.7-05.
 *
 * Lives in `search/lib/` (not inline in SearchPage.tsx) so the SearchPage
 * module satisfies `react-refresh/only-export-components` — pure helpers must
 * live in their own files to keep HMR boundaries clean.
 */
export function buildExportFilename(cat: string, term: string): string {
  const safeTerm = term.toLowerCase().replace(/[^a-z0-9]+/g, '_')
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `rectrace-${cat}-${safeTerm}-${ymd}.xlsx`
}
