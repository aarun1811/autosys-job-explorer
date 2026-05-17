import type { ICellRendererParams } from 'ag-grid-community'

/**
 * AppIDCellRenderer — React port of AppIDCellRendererComponent.
 *
 * Behavioral parity with Angular source:
 *   frontend/rectrace/src/app/custom-interactions/components/renderers/app-id-cell-renderer.component.ts
 *
 * - Truthy params.value → <a href="https://lnkd.in/gpAtSBRj"> opening in a new tab.
 *   title attribute = "View details of {params.data.app_name}".
 * - Falsy params.value → plain <span>{value}</span> (no link).
 *
 * Styling uses the Phase 2 design tokens (text-primary, underline) — no raw hex.
 */
export function AppIDCellRenderer(params: ICellRendererParams) {
  const value = params.value as string | undefined | null
  const data = params.data as Record<string, unknown> | undefined
  const appName = (data?.app_name as string | undefined) ?? ''
  if (!value) {
    return <span>{value}</span>
  }
  return (
    <a
      href="https://lnkd.in/gpAtSBRj"
      target="_blank"
      rel="noopener noreferrer"
      title={`View details of ${appName}`}
      className="text-primary underline hover:no-underline"
    >
      {value}
    </a>
  )
}
