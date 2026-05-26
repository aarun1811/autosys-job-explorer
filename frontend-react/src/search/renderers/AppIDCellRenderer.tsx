import type { ICellRendererParams } from 'ag-grid-community'

/**
 * AppIDCellRenderer — config-driven app link. The URL comes from
 * cellRendererParams.urlTemplate (with a `{value}` placeholder) declared in
 * search-config-v4.json; no template ⇒ plain text. The real Citi app-portal
 * URL is supplied via config — see search-config-v4.json [NEEDS USER INPUT].
 */
export function AppIDCellRenderer(params: ICellRendererParams) {
  const value = params.value as string | undefined | null
  const data = params.data as Record<string, unknown> | undefined
  const appName = (data?.app_name as string | undefined) ?? ''
  const template = (params.colDef?.cellRendererParams as { urlTemplate?: string } | undefined)?.urlTemplate
  if (!value || !template || !/^https?:\/\//i.test(template)) return <span>{value}</span>
  const href = template.replaceAll('{value}', encodeURIComponent(value))
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
       title={`View details of ${appName}`} className="rectrace-link">
      {value}
    </a>
  )
}
