import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SearchSuggestDropdown } from '@/search/SearchSuggestDropdown'

describe('SearchSuggestDropdown', () => {
  test('shows recents when value is empty', () => {
    render(<SearchSuggestDropdown value="" recents={['trade', 'cash']} suggestions={[]} onPick={vi.fn()} onClearRecents={vi.fn()} />)
    expect(screen.getByText('Recent')).toBeInTheDocument()
    expect(screen.getByText('trade')).toBeInTheDocument()
    expect(screen.getByText('cash')).toBeInTheDocument()
  })

  test('shows live suggestions when typing (>=2 chars), not recents', () => {
    render(<SearchSuggestDropdown value="tr" recents={['x']} suggestions={['trade', 'trades']} onPick={vi.fn()} onClearRecents={vi.fn()} />)
    expect(screen.queryByText('Recent')).not.toBeInTheDocument()
    expect(screen.getByText('trades')).toBeInTheDocument()
  })

  test('picking a recent calls onPick with the term', () => {
    const onPick = vi.fn()
    render(<SearchSuggestDropdown value="" recents={['trade']} suggestions={[]} onPick={onPick} onClearRecents={vi.fn()} />)
    fireEvent.click(screen.getByText('trade'))
    expect(onPick).toHaveBeenCalledWith('trade')
  })

  test('picking a suggestion calls onPick with the term', () => {
    const onPick = vi.fn()
    render(<SearchSuggestDropdown value="tr" recents={[]} suggestions={['trades']} onPick={onPick} onClearRecents={vi.fn()} />)
    fireEvent.click(screen.getByText('trades'))
    expect(onPick).toHaveBeenCalledWith('trades')
  })

  test('Clear button (recents mode) calls onClearRecents', () => {
    const onClearRecents = vi.fn()
    render(<SearchSuggestDropdown value="" recents={['trade']} suggestions={[]} onPick={vi.fn()} onClearRecents={onClearRecents} />)
    fireEvent.click(screen.getByText('Clear'))
    expect(onClearRecents).toHaveBeenCalled()
  })
})
