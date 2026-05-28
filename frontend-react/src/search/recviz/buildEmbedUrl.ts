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
  params.set('hide', 'title')
  params.set('theme', theme)
  return `${origin}/embed/dashboards/${dashboardId}?${params.toString()}`
}
