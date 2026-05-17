import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ICellRendererParams } from 'ag-grid-community'
import { SupportEmailCellRenderer } from '../renderers/SupportEmailCellRenderer'

const NO_APP_NAME = Symbol('no-app-name')

function makeParams(value: unknown, appName: string | typeof NO_APP_NAME = 'FOO_APP'): ICellRendererParams {
  const data: Record<string, unknown> = {}
  if (appName !== NO_APP_NAME) data.app_name = appName
  return { value, data } as unknown as ICellRendererParams
}

describe('SupportEmailCellRenderer', () => {
  test('renders a mailto: anchor when value is a truthy email', () => {
    render(<SupportEmailCellRenderer {...makeParams('support@example.com')} />)
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('mailto:support@example.com')
    expect(link.textContent).toBe('support@example.com')
  })

  test('anchor title reads "Send email to {app_name}" (Angular parity)', () => {
    render(<SupportEmailCellRenderer {...makeParams('support@example.com', 'FOO_APP')} />)
    const link = screen.getByRole('link')
    expect(link.getAttribute('title')).toBe('Send email to FOO_APP')
  })

  test('renders a plain <span> when value is empty string', () => {
    render(<SupportEmailCellRenderer {...makeParams('')} />)
    expect(screen.queryByRole('link')).toBeNull()
  })

  test('renders a plain <span> when value is undefined', () => {
    render(<SupportEmailCellRenderer {...makeParams(undefined)} />)
    expect(screen.queryByRole('link')).toBeNull()
  })

  test('renders a plain <span> when value is null', () => {
    render(<SupportEmailCellRenderer {...makeParams(null)} />)
    expect(screen.queryByRole('link')).toBeNull()
  })

  test('className uses text-primary + underline tokens (no raw hex)', () => {
    render(<SupportEmailCellRenderer {...makeParams('support@example.com')} />)
    const link = screen.getByRole('link')
    expect(link.className).toContain('text-primary')
    expect(link.className).toContain('underline')
  })

  test('falls back to empty appName when params.data.app_name is missing', () => {
    render(<SupportEmailCellRenderer {...makeParams('support@example.com', NO_APP_NAME)} />)
    const link = screen.getByRole('link')
    expect(link.getAttribute('title')).toBe('Send email to ')
  })
})
