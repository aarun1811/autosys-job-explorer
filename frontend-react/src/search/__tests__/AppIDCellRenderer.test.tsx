import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ICellRendererParams } from 'ag-grid-community'
import { AppIDCellRenderer } from '../renderers/AppIDCellRenderer'

const NO_APP_NAME = Symbol('no-app-name')

function makeParams(
  value: unknown,
  appName: string | typeof NO_APP_NAME = 'FOO_APP',
  urlTemplate?: string,
): ICellRendererParams {
  const data: Record<string, unknown> = {}
  if (appName !== NO_APP_NAME) data.app_name = appName
  const colDef = urlTemplate
    ? { cellRendererParams: { urlTemplate } }
    : undefined
  return { value, data, colDef } as unknown as ICellRendererParams
}

describe('AppIDCellRenderer', () => {
  test('renders an anchor from the configured urlTemplate, substituting {value}', () => {
    render(<AppIDCellRenderer {...makeParams('APP123', 'Acme', 'https://portal/app/{value}')} />)
    const link = screen.getByRole('link', { name: 'APP123' })
    expect(link).toHaveAttribute('href', 'https://portal/app/APP123')
  })

  test('URL-encodes the value when substituting into the template', () => {
    render(<AppIDCellRenderer {...makeParams('APP 1/2', 'Acme', 'https://portal/app/{value}')} />)
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('https://portal/app/APP%201%2F2')
  })

  test('anchor opens in a new tab with noopener noreferrer (no reverse-tabnabbing)', () => {
    render(<AppIDCellRenderer {...makeParams('APP-123', 'FOO_APP', 'https://portal/app/{value}')} />)
    const link = screen.getByRole('link')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  })

  test('anchor title reads "View details of {app_name}" (Angular parity)', () => {
    render(<AppIDCellRenderer {...makeParams('APP-123', 'FOO_APP', 'https://portal/app/{value}')} />)
    const link = screen.getByRole('link')
    expect(link.getAttribute('title')).toBe('View details of FOO_APP')
  })

  test('anchor carries the shared .rectrace-link class', () => {
    render(<AppIDCellRenderer {...makeParams('APP-123', 'FOO_APP', 'https://portal/app/{value}')} />)
    const link = screen.getByRole('link')
    expect(link.className).toContain('rectrace-link')
  })

  test('renders a plain span when no urlTemplate is configured', () => {
    render(<AppIDCellRenderer {...makeParams('APP123')} />)
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('APP123')).toBeInTheDocument()
  })

  test('renders a plain <span> (no anchor) when value is empty string', () => {
    render(<AppIDCellRenderer {...makeParams('', 'FOO_APP', 'https://portal/app/{value}')} />)
    expect(screen.queryByRole('link')).toBeNull()
  })

  test('renders a plain <span> when value is undefined', () => {
    render(<AppIDCellRenderer {...makeParams(undefined, 'FOO_APP', 'https://portal/app/{value}')} />)
    expect(screen.queryByRole('link')).toBeNull()
  })

  test('renders a plain <span> when value is null', () => {
    render(<AppIDCellRenderer {...makeParams(null, 'FOO_APP', 'https://portal/app/{value}')} />)
    expect(screen.queryByRole('link')).toBeNull()
  })

  test('falls back to empty appName when params.data.app_name is missing', () => {
    render(<AppIDCellRenderer {...makeParams('APP-123', NO_APP_NAME, 'https://portal/app/{value}')} />)
    const link = screen.getByRole('link')
    expect(link.getAttribute('title')).toBe('View details of ')
  })

  test('renders a plain <span> (no anchor) when the urlTemplate is not http(s)', () => {
    render(<AppIDCellRenderer {...makeParams('APP123', 'FOO_APP', 'javascript:alert(1)')} />)
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('APP123')).toBeInTheDocument()
  })

  test('substitutes every {value} occurrence in the template', () => {
    render(<AppIDCellRenderer {...makeParams('APP123', 'Acme', 'https://portal/{value}/detail/{value}')} />)
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('https://portal/APP123/detail/APP123')
  })
})
