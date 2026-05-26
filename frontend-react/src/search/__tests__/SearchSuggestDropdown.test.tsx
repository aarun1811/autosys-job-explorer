import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SearchSuggestDropdown } from '@/search/SearchSuggestDropdown'
import type { SuggestItem } from '@/search/lib/buildSuggestItems'

const optionId = (i: number) => `opt-${i}`
function setup(props?: Partial<React.ComponentProps<typeof SearchSuggestDropdown>>) {
  const onPick = vi.fn()
  const onRemoveRecent = vi.fn()
  const onClearRecents = vi.fn()
  const onActiveIndexChange = vi.fn()
  const items: SuggestItem[] = props?.items ?? [
    { type: 'recent', text: 'trade' },
    { type: 'suggestion', text: 'trades' },
  ]
  render(
    <SearchSuggestDropdown
      items={items}
      query={props?.query ?? 'tr'}
      activeIndex={props?.activeIndex ?? -1}
      recentsHeader={props?.recentsHeader ?? false}
      onPick={onPick}
      onRemoveRecent={onRemoveRecent}
      onClearRecents={onClearRecents}
      onActiveIndexChange={onActiveIndexChange}
      listboxId="lb"
      optionId={optionId}
      {...props}
    />,
  )
  return { onPick, onRemoveRecent, onClearRecents, onActiveIndexChange }
}

describe('SearchSuggestDropdown', () => {
  test('renders one role=option per item with recent + suggestion text', () => {
    setup()
    const opts = screen.getAllByRole('option')
    expect(opts).toHaveLength(2)
    // Labels are split into {head}<strong>{tail}</strong>, so assert on the
    // option's concatenated text content, not getByText.
    expect(opts[1]).toHaveTextContent('trades')
  })

  test('marks the active option aria-selected', () => {
    setup({ activeIndex: 1 })
    const opts = screen.getAllByRole('option')
    expect(opts[0]).toHaveAttribute('aria-selected', 'false')
    expect(opts[1]).toHaveAttribute('aria-selected', 'true')
  })

  test('bolds the non-typed tail of each label', () => {
    setup({ items: [{ type: 'suggestion', text: 'trades' }], query: 'tra' })
    expect(screen.getByText('des').tagName.toLowerCase()).toBe('strong')
  })

  test('clicking an option calls onPick with its text', () => {
    const { onPick } = setup()
    fireEvent.click(screen.getAllByRole('option')[1])
    expect(onPick).toHaveBeenCalledWith('trades')
  })

  test('hovering an option reports its index', () => {
    const { onActiveIndexChange } = setup()
    fireEvent.mouseMove(screen.getAllByRole('option')[1])
    expect(onActiveIndexChange).toHaveBeenCalledWith(1)
  })

  test('recent items expose a remove button that calls onRemoveRecent (not onPick)', () => {
    const { onPick, onRemoveRecent } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Remove trade' }))
    expect(onRemoveRecent).toHaveBeenCalledWith('trade')
    expect(onPick).not.toHaveBeenCalled()
  })

  test('recentsHeader shows the Recent/Clear header wired to onClearRecents', () => {
    const { onClearRecents } = setup({ recentsHeader: true, items: [{ type: 'recent', text: 'trade' }], query: '' })
    expect(screen.getByText('Recent')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Clear'))
    expect(onClearRecents).toHaveBeenCalled()
  })

  test('renders nothing when items is empty', () => {
    const { container } = render(
      <SearchSuggestDropdown
        items={[]}
        query=""
        activeIndex={-1}
        recentsHeader
        onPick={vi.fn()}
        onRemoveRecent={vi.fn()}
        onClearRecents={vi.fn()}
        onActiveIndexChange={vi.fn()}
        listboxId="lb"
        optionId={optionId}
      />,
    )
    expect(container.firstChild).toBeNull()
  })
})
