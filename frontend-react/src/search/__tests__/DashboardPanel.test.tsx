import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@/components/layout/theme-provider'
import { DashboardPanel } from '@/search/DashboardPanel'

const dash = { url: 'http://localhost:5173/recviz-placeholder.html', title: 'Job summary' }
function renderPanel(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>)
}

describe('DashboardPanel', () => {
  it('full variant renders the embed with no collapse toggle', () => {
    renderPanel(<DashboardPanel variant="full" dashboard={dash} q="x" open onOpenChange={() => {}} />)
    expect(screen.queryByRole('button', { name: /collapse|expand/i })).toBeNull()
    expect(screen.getByTitle('Job summary')).toBeInTheDocument()
  })

  it('header variant toggles open via onOpenChange', () => {
    const onOpenChange = vi.fn()
    renderPanel(<DashboardPanel variant="header" dashboard={dash} q="x" open onOpenChange={onOpenChange} />)
    fireEvent.click(screen.getByRole('button', { name: /collapse dashboard/i }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
