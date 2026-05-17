import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { SearchToolbar } from '@/search/SearchToolbar'

function renderToolbar(
  props?: Partial<React.ComponentProps<typeof SearchToolbar>>,
) {
  const onExport = vi.fn()
  const utils = render(
    <SearchToolbar resultCount={null} onExport={onExport} {...props} />,
  )
  return { ...utils, onExport }
}

describe('SearchToolbar', () => {
  test('Badge is hidden when resultCount is null', () => {
    renderToolbar({ resultCount: null })
    // No "results" / "result" text rendered anywhere.
    expect(screen.queryByText(/results?$/i)).toBeNull()
  })

  test('Badge is hidden when resultCount is 0 (empty state owned by SearchPage)', () => {
    renderToolbar({ resultCount: 0 })
    expect(screen.queryByText(/^0\s+results?$/i)).toBeNull()
  })

  test('Badge renders "1 result" (singular) when resultCount is 1', () => {
    renderToolbar({ resultCount: 1 })
    expect(screen.getByText('1 result')).toBeInTheDocument()
  })

  test('Badge renders locale-formatted "1,000 results" when resultCount is 1000', () => {
    renderToolbar({ resultCount: 1000 })
    // Allow comma, period, narrow no-break space, or no separator depending on
    // the test runner locale.
    const match = screen.getByText(/^1[,.   ]?000\s+results$/)
    expect(match).toBeInTheDocument()
  })

  test('Export DropdownMenu trigger has text "Export" with a DownloadIcon', () => {
    renderToolbar()
    const trigger = screen.getByRole('button', { name: /Export/ })
    expect(trigger).toBeInTheDocument()
    // Should render an svg (DownloadIcon) since not exporting.
    expect(trigger.querySelector('svg')).not.toBeNull()
  })

  test('clicking the trigger opens a menu with "Download Excel (.xlsx)"', () => {
    renderToolbar()
    const trigger = screen.getByRole('button', { name: /Export/ })
    fireEvent.click(trigger)
    expect(screen.getByText('Download Excel (.xlsx)')).toBeInTheDocument()
  })

  test('clicking the "Download Excel (.xlsx)" menu item calls props.onExport()', () => {
    const { onExport } = renderToolbar()
    fireEvent.click(screen.getByRole('button', { name: /Export/ }))
    const item = screen.getByText('Download Excel (.xlsx)')
    fireEvent.click(item)
    expect(onExport).toHaveBeenCalledTimes(1)
  })

  test('when isExporting is true: trigger is disabled and shows animate-spin Loader2', () => {
    renderToolbar({ isExporting: true })
    const trigger = screen.getByRole('button', { name: /Export/ })
    expect(trigger).toBeDisabled()
    // The SVG should carry the animate-spin class (Loader2Icon).
    const svg = trigger.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg!.getAttribute('class') ?? '').toMatch(/animate-spin/)
  })

  test('when isExporting is false (default): trigger is enabled', () => {
    renderToolbar({ isExporting: false })
    const trigger = screen.getByRole('button', { name: /Export/ })
    expect(trigger).not.toBeDisabled()
  })

  test('Badge renders with secondary variant token (no raw hex)', () => {
    renderToolbar({ resultCount: 42 })
    const badge = screen.getByText('42 results')
    // The Badge component uses data-slot="badge" and bg-secondary class for variant.
    expect(badge.getAttribute('data-slot')).toBe('badge')
  })
})
