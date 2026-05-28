import { describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/search/RecvizEmbed', () => ({
  RecvizEmbed: ({ url }: { url: string }) => <div data-testid="embed" data-url={url} />,
}))

import { RecvizDashboardModal } from './RecvizDashboardModal'

describe('RecvizDashboardModal', () => {
  test('renders the embed with the given url + title when open', () => {
    render(
      <RecvizDashboardModal open onOpenChange={() => {}} title="QuickRec Statistics" url="http://x/embed/dashboards/d?theme=dark" />,
    )
    expect(screen.getByText('QuickRec Statistics')).toBeInTheDocument()
    expect(screen.getByTestId('embed')).toHaveAttribute('data-url', 'http://x/embed/dashboards/d?theme=dark')
  })

  test('renders nothing visible when closed', () => {
    render(<RecvizDashboardModal open={false} onOpenChange={() => {}} title="QuickRec" url="http://x/d" />)
    expect(screen.queryByTestId('embed')).not.toBeInTheDocument()
  })
})
