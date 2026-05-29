export interface BuildEmbedUrlArgs {
  origin: string
  dashboardId: string
  filters: Record<string, string | undefined>
  lock: string[]
  theme: 'light' | 'dark'
}

/** Compose a RecViz embed URL: {origin}/embed/dashboards/{id}?filter.*&filter.lock&hide=title&theme. */
export function buildEmbedUrl({ origin, dashboardId, filters, lock, theme }: BuildEmbedUrlArgs): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value != null && value !== '') params.set(`filter.${key}`, value)
  }
  const presentLocks = lock.filter((k) => filters[k] != null && filters[k] !== '')
  if (presentLocks.length > 0) params.set('filter.lock', presentLocks.join(','))
  // 'title' collapses the topbar title text (keeps the Open-in-RecViz link).
  // 'toolbar' removes the redundant refresh + auto-refresh row — in a modal
  // the user can just close/reopen for a fresh fetch; auto-refresh isn't
  // useful in a transient view. Together they make the top area thin.
  params.set('hide', 'title,toolbar')
  params.set('theme', theme)
  return `${origin}/embed/dashboards/${dashboardId}?${params.toString()}`
}
