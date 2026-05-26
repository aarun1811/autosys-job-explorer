import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { CategoryTabBar } from '@/search/CategoryTabBar'
import type { CategoryResultV4 } from '@/search/types'

const cats = [
  { key: 'fileName', label: 'File Name', count: 3, hasMore: false, values: [], columns: [] },
  { key: 'jobName', label: 'Job Name', count: 1000, hasMore: true, values: [], columns: [] },
] as CategoryResultV4[]

describe('CategoryTabBar', () => {
  test('renders one tab per category with "Label (N)" / "(N+)" labels', () => {
    render(<CategoryTabBar categories={cats} activeKey="fileName" onSelect={vi.fn()} />)
    expect(screen.getByText('File Name (3)')).toBeInTheDocument()
    expect(screen.getByText('Job Name (1000+)')).toBeInTheDocument()
  })

  test('active tab carries the primary border indicator', () => {
    render(<CategoryTabBar categories={cats} activeKey="jobName" onSelect={vi.fn()} />)
    const active = screen.getByText('Job Name (1000+)')
    expect(active.className).toMatch(/border-primary/)
    expect(active.className).toMatch(/border-b-2/)
  })

  test('clicking a tab calls onSelect with its key', () => {
    const onSelect = vi.fn()
    render(<CategoryTabBar categories={cats} activeKey="fileName" onSelect={onSelect} />)
    fireEvent.click(screen.getByText('Job Name (1000+)'))
    expect(onSelect).toHaveBeenCalledWith('jobName')
  })

  test('renders exactly N tabs and exposes data-tab-key', () => {
    const { container } = render(<CategoryTabBar categories={cats} activeKey="fileName" onSelect={vi.fn()} />)
    expect(container.querySelectorAll('[data-tab-key]').length).toBe(2)
  })
})
