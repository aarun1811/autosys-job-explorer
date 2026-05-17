import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ICellRendererParams } from 'ag-grid-community'
import { AppIDCellRenderer } from '../renderers/AppIDCellRenderer'

const NO_APP_NAME = Symbol('no-app-name')

function makeParams(value: unknown, appName: string | typeof NO_APP_NAME = 'FOO_APP'): ICellRendererParams {
  const data: Record<string, unknown> = {}
  if (appName !== NO_APP_NAME) data.app_name = appName
  return { value, data } as unknown as ICellRendererParams
}

describe('AppIDCellRenderer', () => {
  test('renders an anchor with the canonical href when value is truthy', () => {
    render(<AppIDCellRenderer {...makeParams('APP-123')} />)
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('https://lnkd.in/gpAtSBRj')
    expect(link.textContent).toBe('APP-123')
  })

  test('anchor opens in a new tab with noopener noreferrer (no reverse-tabnabbing)', () => {
    render(<AppIDCellRenderer {...makeParams('APP-123')} />)
    const link = screen.getByRole('link')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  })

  test('anchor title reads "View details of {app_name}" (Angular parity)', () => {
    render(<AppIDCellRenderer {...makeParams('APP-123', 'FOO_APP')} />)
    const link = screen.getByRole('link')
    expect(link.getAttribute('title')).toBe('View details of FOO_APP')
  })

  test('renders a plain <span> (no anchor) when value is empty string', () => {
    render(<AppIDCellRenderer {...makeParams('')} />)
    expect(screen.queryByRole('link')).toBeNull()
  })

  test('renders a plain <span> when value is undefined', () => {
    render(<AppIDCellRenderer {...makeParams(undefined)} />)
    expect(screen.queryByRole('link')).toBeNull()
  })

  test('renders a plain <span> when value is null', () => {
    render(<AppIDCellRenderer {...makeParams(null)} />)
    expect(screen.queryByRole('link')).toBeNull()
  })

  test('className uses text-primary + underline tokens (no raw hex)', () => {
    render(<AppIDCellRenderer {...makeParams('APP-123')} />)
    const link = screen.getByRole('link')
    expect(link.className).toContain('text-primary')
    expect(link.className).toContain('underline')
  })

  test('falls back to empty appName when params.data.app_name is missing', () => {
    render(<AppIDCellRenderer {...makeParams('APP-123', NO_APP_NAME)} />)
    const link = screen.getByRole('link')
    expect(link.getAttribute('title')).toBe('View details of ')
  })
})
