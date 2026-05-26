import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SearchSuggestDropdown } from '@/search/SearchSuggestDropdown'

const noop = vi.fn

describe('SearchSuggestDropdown', () => {
  test('shows recents when value is empty', () => {
    render(
      <SearchSuggestDropdown
        value=""
        recents={['trade', 'cash']}
        suggestions={[]}
        onPick={noop()}
        onRemoveRecent={noop()}
        onClearRecents={noop()}
      />,
    )
    expect(screen.getByText('Recent')).toBeInTheDocument()
    expect(screen.getByText('trade')).toBeInTheDocument()
    expect(screen.getByText('cash')).toBeInTheDocument()
  })

  test('shows live suggestions when typing (>=2 chars), not recents', () => {
    render(
      <SearchSuggestDropdown
        value="tr"
        recents={['x']}
        suggestions={['trade', 'trades']}
        onPick={noop()}
        onRemoveRecent={noop()}
        onClearRecents={noop()}
      />,
    )
    expect(screen.queryByText('Recent')).not.toBeInTheDocument()
    expect(screen.getByText('trades')).toBeInTheDocument()
  })

  test('picking a recent calls onPick with the term', () => {
    const onPick = vi.fn()
    render(
      <SearchSuggestDropdown
        value=""
        recents={['trade']}
        suggestions={[]}
        onPick={onPick}
        onRemoveRecent={noop()}
        onClearRecents={noop()}
      />,
    )
    fireEvent.click(screen.getByText('trade'))
    expect(onPick).toHaveBeenCalledWith('trade')
  })

  test('picking a suggestion calls onPick with the term', () => {
    const onPick = vi.fn()
    render(
      <SearchSuggestDropdown
        value="tr"
        recents={[]}
        suggestions={['trades']}
        onPick={onPick}
        onRemoveRecent={noop()}
        onClearRecents={noop()}
      />,
    )
    fireEvent.click(screen.getByText('trades'))
    expect(onPick).toHaveBeenCalledWith('trades')
  })

  test('per-item remove calls onRemoveRecent and not onPick', () => {
    const onPick = vi.fn()
    const onRemoveRecent = vi.fn()
    render(
      <SearchSuggestDropdown
        value=""
        recents={['trade']}
        suggestions={[]}
        onPick={onPick}
        onRemoveRecent={onRemoveRecent}
        onClearRecents={noop()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Remove trade' }))
    expect(onRemoveRecent).toHaveBeenCalledWith('trade')
    expect(onPick).not.toHaveBeenCalled()
  })

  test('Clear button (recents mode) calls onClearRecents', () => {
    const onClearRecents = vi.fn()
    render(
      <SearchSuggestDropdown
        value=""
        recents={['trade']}
        suggestions={[]}
        onPick={noop()}
        onRemoveRecent={noop()}
        onClearRecents={onClearRecents}
      />,
    )
    fireEvent.click(screen.getByText('Clear'))
    expect(onClearRecents).toHaveBeenCalled()
  })
})
