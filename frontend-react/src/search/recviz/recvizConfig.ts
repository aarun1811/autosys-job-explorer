/** RecViz embed origin. Dev default; per-env via VITE_RECVIZ_ORIGIN. NOTE: spec §6.5
 * prefers a server-driven origin (added to backend search config like `dashboard.url`).
 * This env-var path is a pragmatic interim — switch to server-driven in a follow-up
 * once the backend SearchConfigV4 carries a `recvizOrigin` field. */
export function getRecvizOrigin(): string {
  // Local dev: RecViz backend serves both API and SPA on :8000 (our React dev
  // server occupies :5173). Override via VITE_RECVIZ_ORIGIN for other envs.
  return import.meta.env.VITE_RECVIZ_ORIGIN ?? 'http://localhost:8000'
}
