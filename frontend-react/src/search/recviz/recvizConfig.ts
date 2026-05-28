/** RecViz embed origin. Dev default; per-env via VITE_RECVIZ_ORIGIN. NOTE: spec §6.5
 * prefers a server-driven origin (added to backend search config like `dashboard.url`).
 * This env-var path is a pragmatic interim — switch to server-driven in a follow-up
 * once the backend SearchConfigV4 carries a `recvizOrigin` field. */
export function getRecvizOrigin(): string {
  return import.meta.env.VITE_RECVIZ_ORIGIN ?? 'http://localhost:5173'
}
