// src/search/__tests__/ResultSurface.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
vi.mock('@tanstack/react-router', () => ({ useSearch: () => ({}) }))
vi.mock('@/search/SearchGridPanel', () => ({ SearchGridPanel: () => <div data-testid="grid" /> }))
vi.mock('@/search/DashboardPanel', () => ({ DashboardPanel: (p: { variant: string }) => <div data-testid={`dash-${p.variant}`} /> }))
import { ResultSurface } from '@/search/ResultSurface'
import type { CategoryResultV4 } from '@/search/types'

const grid = { key: 'g', label: 'G', values: ['a'], count: 1, hasMore: false, columns: [{ field: 'x', headerName: 'X', rowGroup: true }] } as CategoryResultV4
const dashOnly = { key: 'd', label: 'D', values: [], count: 0, hasMore: false, columns: [], dashboard: { url: 'u' } } as CategoryResultV4
const both = { ...grid, dashboard: { url: 'u' } } as CategoryResultV4

describe('ResultSurface', () => {
  it('grid-only → grid, no dashboard', () => {
    render(<ResultSurface q="x" category={grid} />)
    expect(screen.getByTestId('grid')).toBeTruthy()
    expect(screen.queryByTestId(/dash-/)).toBeNull()
  })
  it('dashboard-only → full dashboard, no grid', () => {
    render(<ResultSurface q="x" category={dashOnly} />)
    expect(screen.getByTestId('dash-full')).toBeTruthy()
    expect(screen.queryByTestId('grid')).toBeNull()
  })
  it('both → header dashboard + grid', () => {
    render(<ResultSurface q="x" category={both} />)
    expect(screen.getByTestId('dash-header')).toBeTruthy()
    expect(screen.getByTestId('grid')).toBeTruthy()
  })
})
