import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'

import { SearchBar } from '@/search/SearchBar'

// Mock useRecentSearches per test to control the recents list deterministically.
const mockClear = vi.fn()
let mockRecents: string[] = []

vi.mock('@/search/hooks/useRecentSearches', () => ({
  useRecentSearches: () => ({
    recents: mockRecents,
    push: vi.fn(),
    clear: mockClear,
  }),
}))

function renderBar(props?: Partial<React.ComponentProps<typeof SearchBar>>) {
  const onChange = vi.fn()
  const onSubmit = vi.fn()
  const onClear = vi.fn()
  const utils = render(
    <SearchBar
      value=""
      onChange={onChange}
      onSubmit={onSubmit}
      onClear={onClear}
      {...props}
    />,
  )
  return { ...utils, onChange, onSubmit, onClear }
}

describe('SearchBar', () => {
  beforeEach(() => {
    mockRecents = []
    mockClear.mockClear()
  })

  test('renders Input with the canonical placeholder + Search button with SearchIcon', () => {
    renderBar()
    const input = screen.getByPlaceholderText('Search by file name...')
    expect(input).toBeInTheDocument()
    const searchBtn = screen.getByRole('button', { name: 'Search' })
    expect(searchBtn).toBeInTheDocument()
    // SearchIcon is rendered as an <svg>; confirm at least one svg inside the button.
    expect(searchBtn.querySelector('svg')).not.toBeNull()
  })

  test('typing into Input fires props.onChange with the new value', () => {
    const { onChange } = renderBar()
    const input = screen.getByPlaceholderText('Search by file name...')
    fireEvent.change(input, { target: { value: 'csv' } })
    expect(onChange).toHaveBeenCalledWith('csv')
  })

  test('pressing Enter calls props.onSubmit(value.trim())', () => {
    const { onSubmit } = renderBar({ value: '  load-abc  ' })
    const input = screen.getByPlaceholderText('Search by file name...')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledWith('load-abc')
  })

  test('pressing Enter does NOT call onSubmit when value is whitespace-only', () => {
    const { onSubmit } = renderBar({ value: '   ' })
    const input = screen.getByPlaceholderText('Search by file name...')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSubmit).not.toHaveBeenCalled()
  })

  test('pressing Enter does NOT call onSubmit when value is empty', () => {
    const { onSubmit } = renderBar({ value: '' })
    const input = screen.getByPlaceholderText('Search by file name...')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSubmit).not.toHaveBeenCalled()
  })

  test('clicking the Search button calls props.onSubmit(value.trim())', () => {
    const { onSubmit } = renderBar({ value: 'LOAD-ABC-123' })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    expect(onSubmit).toHaveBeenCalledWith('LOAD-ABC-123')
  })

  test('clicking the Search button does NOT call onSubmit when value is whitespace-only', () => {
    const { onSubmit } = renderBar({ value: '   ' })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  test('clear (X) button is not rendered when value is empty', () => {
    renderBar({ value: '' })
    expect(screen.queryByRole('button', { name: /Clear search/i })).toBeNull()
  })

  test('clear (X) button appears when value is non-empty and has aria-label "Clear search"', () => {
    renderBar({ value: 'abc' })
    const clearBtn = screen.getByRole('button', { name: /Clear search/i })
    expect(clearBtn).toBeInTheDocument()
    expect(clearBtn.getAttribute('aria-label')).toBe('Clear search')
  })

  test('clicking the clear (X) button calls props.onClear()', () => {
    const { onClear } = renderBar({ value: 'abc' })
    fireEvent.click(screen.getByRole('button', { name: /Clear search/i }))
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  test('Popover opens on Input focus when value is empty AND recents has items', () => {
    mockRecents = ['LOAD-ABC-123', 'reconour']
    renderBar({ value: '' })
    const input = screen.getByPlaceholderText('Search by file name...')
    fireEvent.focus(input)
    // "Recent" label appears in popover header.
    expect(screen.getByText('Recent')).toBeInTheDocument()
  })

  test('Popover does NOT open on focus when value is empty AND recents is empty', () => {
    mockRecents = []
    renderBar({ value: '' })
    const input = screen.getByPlaceholderText('Search by file name...')
    fireEvent.focus(input)
    expect(screen.queryByText('Recent')).toBeNull()
  })

  test('Popover content lists recent items each with an svg (ClockIcon) and the recent label is semibold-xs', () => {
    mockRecents = ['LOAD-ABC-123', 'reconour']
    renderBar({ value: '' })
    fireEvent.focus(screen.getByPlaceholderText('Search by file name...'))
    const recentLabel = screen.getByText('Recent')
    expect(recentLabel.className).toMatch(/text-xs/)
    expect(recentLabel.className).toMatch(/font-semibold/)
    // Both items render.
    expect(screen.getByText('LOAD-ABC-123')).toBeInTheDocument()
    expect(screen.getByText('reconour')).toBeInTheDocument()
    // Each recent row contains an svg (ClockIcon).
    const item1 = screen.getByText('LOAD-ABC-123').closest('[data-slot="command-item"]')
    expect(item1).not.toBeNull()
    expect(item1!.querySelector('svg')).not.toBeNull()
  })

  test('clicking a recent item invokes props.onSubmit(term)', () => {
    mockRecents = ['LOAD-ABC-123', 'reconour']
    const { onSubmit } = renderBar({ value: '' })
    fireEvent.focus(screen.getByPlaceholderText('Search by file name...'))
    const item = screen.getByText('reconour').closest('[data-slot="command-item"]')!
    fireEvent.click(item)
    expect(onSubmit).toHaveBeenCalledWith('reconour')
  })

  test('popover Clear button invokes useRecentSearches().clear() when recents has items', () => {
    mockRecents = ['LOAD-ABC-123']
    renderBar({ value: '' })
    fireEvent.focus(screen.getByPlaceholderText('Search by file name...'))
    // Find the popover Clear button (sibling of "Recent" label).
    const recentLabel = screen.getByText('Recent')
    const popoverHeader = recentLabel.parentElement!
    const clearBtn = within(popoverHeader).getByRole('button', { name: /Clear/i })
    fireEvent.click(clearBtn)
    expect(mockClear).toHaveBeenCalledTimes(1)
  })

  test('typing while popover is open closes it (live-typing closes popover per UI-SPEC)', () => {
    mockRecents = ['LOAD-ABC-123']
    const { onChange } = renderBar({ value: '' })
    const input = screen.getByPlaceholderText('Search by file name...')
    fireEvent.focus(input)
    expect(screen.getByText('Recent')).toBeInTheDocument()
    fireEvent.change(input, { target: { value: 'L' } })
    expect(onChange).toHaveBeenCalledWith('L')
    expect(screen.queryByText('Recent')).toBeNull()
  })

  test('blur closes popover after a 150ms delay (allows item click to register first)', () => {
    vi.useFakeTimers()
    try {
      mockRecents = ['LOAD-ABC-123']
      renderBar({ value: '' })
      const input = screen.getByPlaceholderText('Search by file name...')
      fireEvent.focus(input)
      expect(screen.getByText('Recent')).toBeInTheDocument()
      fireEvent.blur(input)
      // Still open immediately after blur (within the 150ms window).
      expect(screen.queryByText('Recent')).toBeInTheDocument()
      act(() => {
        vi.advanceTimersByTime(160)
      })
      expect(screen.queryByText('Recent')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})
