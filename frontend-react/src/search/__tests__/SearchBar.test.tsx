import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { SearchBar } from '@/search/SearchBar'

const mockClear = vi.fn()
const mockRemove = vi.fn()
let mockRecents: string[] = []

vi.mock('@/search/hooks/useRecentSearches', () => ({
  useRecentSearches: () => ({
    recents: mockRecents,
    push: vi.fn(),
    remove: mockRemove,
    clear: mockClear,
  }),
}))

function renderBar(props?: Partial<React.ComponentProps<typeof SearchBar>>) {
  const onChange = vi.fn()
  const onSubmit = vi.fn()
  const onClear = vi.fn()
  const utils = render(
    <SearchBar value="" onChange={onChange} onSubmit={onSubmit} onClear={onClear} suggestions={[]} {...props} />,
  )
  return { ...utils, onChange, onSubmit, onClear }
}

describe('SearchBar', () => {
  beforeEach(() => {
    mockRecents = []
    mockClear.mockClear()
    mockRemove.mockClear()
  })

  test('renders an input (role=combobox) + Search button', () => {
    renderBar()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument()
  })

  test('Enter with no highlight submits the trimmed typed value', () => {
    const { onSubmit } = renderBar({ value: '  trade ' })
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledWith('trade')
  })

  test('Search button submits', () => {
    const { onSubmit } = renderBar({ value: 'cash' })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    expect(onSubmit).toHaveBeenCalledWith('cash')
  })

  test('default submitButton renders the full text "Search" button', () => {
    renderBar({ value: 'cash' })
    expect(screen.getByRole('button', { name: 'Search' })).toHaveTextContent('Search')
  })

  test('submitButton="icon" has no submit button (decorative lens); Enter submits', () => {
    const { onSubmit } = renderBar({ value: 'cash', submitButton: 'icon' })
    // The leading magnifier is decorative (Google-style) — no clickable submit.
    expect(screen.queryByRole('button', { name: 'Search' })).not.toBeInTheDocument()
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledWith('cash')
  })

  test('clicking clear (X) refocuses the input for immediate re-typing', () => {
    renderBar({ value: 'abc' })
    fireEvent.click(screen.getByRole('button', { name: /Clear search/i }))
    expect(screen.getByRole('combobox')).toHaveFocus()
  })

  test('focus opens recents; ArrowDown highlights first option; Enter submits it', () => {
    mockRecents = ['LOAD-ABC-123', 'reconour']
    const { onSubmit } = renderBar({ value: '' })
    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    expect(screen.getByText('LOAD-ABC-123')).toBeInTheDocument()
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    const opts = screen.getAllByRole('option')
    expect(opts[0]).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledWith('LOAD-ABC-123')
  })

  test('typing merges matching recents + suggestions into the list', () => {
    mockRecents = ['trade', 'box']
    renderBar({ value: 'tr', suggestions: ['trades', 'tracking'] })
    fireEvent.focus(screen.getByRole('combobox'))
    const opts = screen.getAllByRole('option')
    expect(opts).toHaveLength(3)
    expect(opts[0]).toHaveTextContent('trade')
    expect(opts[2]).toHaveTextContent('tracking')
    expect(opts.some((o) => o.textContent === 'box')).toBe(false)
  })

  test('ArrowUp past the top clears the highlight (returns to typed text)', () => {
    mockRecents = ['a', 'b']
    renderBar({ value: '' })
    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    fireEvent.keyDown(input, { key: 'ArrowDown' }) // index 0
    fireEvent.keyDown(input, { key: 'ArrowUp' }) // back to -1
    expect(screen.getAllByRole('option').every((o) => o.getAttribute('aria-selected') === 'false')).toBe(true)
  })

  test('Escape closes the panel', () => {
    mockRecents = ['a']
    renderBar({ value: '' })
    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  test('clear (X) button shows when non-empty and calls onClear', () => {
    const { onClear } = renderBar({ value: 'abc' })
    fireEvent.click(screen.getByRole('button', { name: /Clear search/i }))
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  test('custom placeholder honored', () => {
    renderBar({ placeholder: 'Search by job name…' })
    expect(screen.getByPlaceholderText('Search by job name…')).toBeInTheDocument()
  })
})
