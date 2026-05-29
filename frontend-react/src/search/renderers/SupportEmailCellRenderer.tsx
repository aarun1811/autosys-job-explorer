import type { ICellRendererParams } from 'ag-grid-community'

/**
 * SupportEmailCellRenderer — React port of AppSupportCellRendererComponent.
 *
 * Behavioral parity with Angular source:
 *   frontend/rectrace/src/app/custom-interactions/components/renderers/app-support-cell-renderer.component.ts
 *
 * - Truthy params.value → <a href="mailto:{value}"> with title "Send email to {app_name}".
 * - Falsy params.value → plain <span>{value}</span>.
 *
 * Styling uses the shared `.rectrace-link` class (token-driven `var(--color-primary)`,
 * underline-at-rest, clip-safe inside grid cells) — same as AppIDCellRenderer.
 */
export function SupportEmailCellRenderer(params: ICellRendererParams) {
  const value = params.value as string | undefined | null
  const data = params.data as Record<string, unknown> | undefined
  const appName = (data?.app_name as string | undefined) ?? ''
  if (!value) {
    return <span>{value}</span>
  }
  return (
    <a
      href={`mailto:${value}`}
      title={`Send email to ${appName}`}
      className="rectrace-link"
    >
      {value}
    </a>
  )
}
