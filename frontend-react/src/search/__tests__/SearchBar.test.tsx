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
    remove: vi.fn(),
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
      suggestions={[]}
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

  test('renders an Input + Search button with an icon', () => {
    renderBar()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    const searchBtn = screen.getByRole('button', { name: 'Search' })
    expect(searchBtn).toBeInTheDocument()
    expect(searchBtn.querySelector('svg')).not.toBeNull()
  })

  test('honours a custom placeholder prop', () => {
    renderBar({ placeholder: 'Search by job name…' })
    expect(screen.getByPlaceholderText('Search by job name…')).toBeInTheDocument()
  })

  test('typing into Input fires props.onChange with the new value', () => {
    const { onChange } = renderBar()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'csv' } })
    expect(onChange).toHaveBeenCalledWith('csv')
  })

  test('pressing Enter calls props.onSubmit(value.trim())', () => {
    const { onSubmit } = renderBar({ value: '  load-abc  ' })
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledWith('load-abc')
  })

  test('Enter does NOT submit whitespace-only or empty values', () => {
    const { onSubmit } = renderBar({ value: '   ' })
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })
    expect(onSubmit).not.toHaveBeenCalled()
  })

  test('clicking Search calls props.onSubmit(value.trim())', () => {
    const { onSubmit } = renderBar({ value: 'LOAD-ABC-123' })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    expect(onSubmit).toHaveBeenCalledWith('LOAD-ABC-123')
  })

  test('clear (X) button hidden when empty, shown + wired when non-empty', () => {
    const { rerender } = render(<SearchBar value="" onChange={vi.fn()} onSubmit={vi.fn()} onClear={vi.fn()} suggestions={[]} />)
    expect(screen.queryByRole('button', { name: /Clear search/i })).toBeNull()
    const onClear = vi.fn()
    rerender(<SearchBar value="abc" onChange={vi.fn()} onSubmit={vi.fn()} onClear={onClear} suggestions={[]} />)
    const clearBtn = screen.getByRole('button', { name: /Clear search/i })
    fireEvent.click(clearBtn)
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  test('Popover opens on focus showing recents when value empty AND recents has items', () => {
    mockRecents = ['LOAD-ABC-123', 'reconour']
    renderBar({ value: '' })
    fireEvent.focus(screen.getByRole('textbox'))
    expect(screen.getByText('Recent')).toBeInTheDocument()
    expect(screen.getByText('reconour')).toBeInTheDocument()
  })

  test('Popover does NOT open on focus when recents empty and not typing', () => {
    mockRecents = []
    renderBar({ value: '' })
    fireEvent.focus(screen.getByRole('textbox'))
    expect(screen.queryByText('Recent')).toBeNull()
  })

  test('clicking a recent item invokes props.onSubmit(term)', () => {
    mockRecents = ['LOAD-ABC-123', 'reconour']
    const { onSubmit } = renderBar({ value: '' })
    fireEvent.focus(screen.getByRole('textbox'))
    const item = screen.getByText('reconour').closest('[data-slot="command-item"]')!
    fireEvent.click(item)
    expect(onSubmit).toHaveBeenCalledWith('reconour')
  })

  test('popover Clear button invokes useRecentSearches().clear()', () => {
    mockRecents = ['LOAD-ABC-123']
    renderBar({ value: '' })
    fireEvent.focus(screen.getByRole('textbox'))
    const popoverHeader = screen.getByText('Recent').parentElement!
    fireEvent.click(within(popoverHeader).getByRole('button', { name: /Clear/i }))
    expect(mockClear).toHaveBeenCalledTimes(1)
  })

  test('shows live suggestions (not recents) when value >=2 chars and suggestions provided', () => {
    mockRecents = ['old']
    renderBar({ value: 'tr', suggestions: ['trade', 'trades'] })
    fireEvent.focus(screen.getByRole('textbox'))
    expect(screen.queryByText('Recent')).toBeNull()
    expect(screen.getByText('trades')).toBeInTheDocument()
  })

  test('blur closes popover after a 150ms delay (lets item click register first)', () => {
    vi.useFakeTimers()
    try {
      mockRecents = ['LOAD-ABC-123']
      renderBar({ value: '' })
      const input = screen.getByRole('textbox')
      fireEvent.focus(input)
      expect(screen.getByText('Recent')).toBeInTheDocument()
      fireEvent.blur(input)
      expect(screen.queryByText('Recent')).toBeInTheDocument()
      act(() => { vi.advanceTimersByTime(160) })
      expect(screen.queryByText('Recent')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})
