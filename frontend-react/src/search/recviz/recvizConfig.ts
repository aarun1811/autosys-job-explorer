/** RecViz embed origin.
 *
 * Resolution order:
 *  1. Runtime config from the rectrace backend at `/rectrace/api/config`
 *     (fetched once on first module load and cached). Driven by the
 *     `app.recviz.origin` Spring property — lets one jar work across
 *     UAT / PROD without rebuilding the frontend.
 *  2. Build-time env var `VITE_RECVIZ_ORIGIN` (legacy override for dev).
 *  3. Hardcoded `http://localhost:8000` fallback (local dev default).
 *
 * The runtime fetch fires immediately on module load so the cache is
 * usually populated before the user clicks a cell. If a click races the
 * fetch, `getRecvizOrigin()` returns the env-var/localhost fallback —
 * acceptable for local dev, very rare in production (fetch is ~50ms).
 *
 * The synchronous `getRecvizOrigin()` signature is preserved for backward
 * compatibility with existing call sites (TlmStatsCellRenderer,
 * QuickRecStatsCellRenderer).
 */

const ENV_FALLBACK = import.meta.env.VITE_RECVIZ_ORIGIN ?? 'http://localhost:8000'

let cachedOrigin: string | undefined

async function fetchRuntimeOrigin(): Promise<void> {
  try {
    const r = await fetch('/rectrace/api/config', { credentials: 'same-origin' })
    if (!r.ok) return
    const cfg = (await r.json()) as { recvizOrigin?: string }
    if (typeof cfg.recvizOrigin === 'string' && cfg.recvizOrigin.length > 0) {
      cachedOrigin = cfg.recvizOrigin
    }
  } catch {
    // Network error / backend not reachable — keep the fallback.
  }
}

// Kick off runtime config fetch as soon as the module is first imported.
// Don't await — the synchronous accessor below falls back gracefully if a
// caller races the fetch.
void fetchRuntimeOrigin()

export function getRecvizOrigin(): string {
  return cachedOrigin ?? ENV_FALLBACK
}
