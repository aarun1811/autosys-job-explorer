import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { CategoryTabBar } from '@/search/CategoryTabBar'
import type { CategoryResultV4 } from '@/search/types'

const cats = [
  { key: 'fileName', label: 'File Name', count: 3, hasMore: false, values: [], columns: [] },
  { key: 'jobName', label: 'Job Name', count: 1000, hasMore: true, values: [], columns: [] },
] as CategoryResultV4[]

describe('CategoryTabBar', () => {
  test('renders each tab with its label text and a separate count pill', () => {
    render(<CategoryTabBar categories={cats} activeKey="fileName" onSelect={vi.fn()} />)
    // Label and count are now distinct elements, not a combined "Label (N)" string.
    expect(screen.getByText('File Name')).toBeInTheDocument()
    expect(screen.getByText('Job Name')).toBeInTheDocument()
    // Count pills: plain count, and count + "+" when hasMore. The "+" is a
    // sibling text node, so match on the element's normalized text content.
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(
      screen.getByText((_content, el) => el?.textContent === '1000+' && el.tagName === 'SPAN'),
    ).toBeInTheDocument()
  })

  test('only the active tab renders the sliding underline indicator', () => {
    const { container } = render(
      <CategoryTabBar categories={cats} activeKey="jobName" onSelect={vi.fn()} />,
    )
    const activeButton = container.querySelector('[data-tab-key="jobName"]')
    const inactiveButton = container.querySelector('[data-tab-key="fileName"]')
    expect(activeButton?.getAttribute('data-active')).toBe('true')
    expect(inactiveButton?.getAttribute('data-active')).toBe('false')
    // The underline span (bg-primary indicator) is rendered exactly once, under
    // the active tab only.
    const underlines = container.querySelectorAll('.bg-primary')
    expect(underlines.length).toBe(1)
    expect(activeButton?.contains(underlines[0])).toBe(true)
  })

  test('clicking a tab calls onSelect with its key', () => {
    const onSelect = vi.fn()
    render(<CategoryTabBar categories={cats} activeKey="fileName" onSelect={onSelect} />)
    fireEvent.click(screen.getByText('Job Name'))
    expect(onSelect).toHaveBeenCalledWith('jobName')
  })

  test('renders exactly N tabs and exposes data-tab-key', () => {
    const { container } = render(<CategoryTabBar categories={cats} activeKey="fileName" onSelect={vi.fn()} />)
    expect(container.querySelectorAll('[data-tab-key]').length).toBe(2)
  })
})
