import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { CategoryTabBar } from '@/search/CategoryTabBar'

describe('CategoryTabBar', () => {
  test('renders one tab with text "File Name" when activeCat === "fileName"', () => {
    render(<CategoryTabBar activeCat="fileName" />)
    expect(screen.getByText('File Name')).toBeInTheDocument()
  })

  test('the active tab carries the primary-border indicator (no raw hex)', () => {
    render(<CategoryTabBar activeCat="fileName" />)
    const tab = screen.getByText('File Name')
    // Active 2px bottom border in var(--primary) — tailwind class border-primary.
    expect(tab.className).toMatch(/border-primary/)
    expect(tab.className).toMatch(/border-b-2/)
  })

  test('exposes data-active-cat for downstream automation', () => {
    render(<CategoryTabBar activeCat="fileName" />)
    const tab = screen.getByText('File Name')
    expect(tab.getAttribute('data-active-cat')).toBe('fileName')
  })

  test('renders exactly one tab element (no extra tabs in Phase 3)', () => {
    const { container } = render(<CategoryTabBar activeCat="fileName" />)
    const tabs = container.querySelectorAll('[data-active-cat]')
    expect(tabs.length).toBe(1)
  })
})
