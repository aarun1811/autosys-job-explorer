import type { ComponentProps } from 'react'
import { describe, expect, test, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ICellRendererParams } from 'ag-grid-community'

vi.mock('@/components/layout/theme-provider', () => ({ useTheme: () => ({ resolvedTheme: 'dark' }) }))
let lastModalProps: Record<string, unknown> = {}
vi.mock('@/search/recviz/RecvizDashboardModal', () => ({
  RecvizDashboardModal: (p: Record<string, unknown>) => { lastModalProps = p; return p.open ? <div data-testid="modal" /> : null },
}))
vi.mock('@/search/recviz/recvizConfig', () => ({ getRecvizOrigin: () => 'http://localhost:5173' }))

import { QuickRecStatsCellRenderer } from './QuickRecStatsCellRenderer'

function renderCell(data: Record<string, unknown>, entryPoint: 'recon_id' | 'rec_portal_id', value: string) {
  const params = {
    value, data,
    colDef: { cellRendererParams: { entryPoint } },
  } as unknown as ICellRendererParams
  return render(<QuickRecStatsCellRenderer {...(params as ComponentProps<typeof QuickRecStatsCellRenderer>)} />)
}

describe('QuickRecStatsCellRenderer', () => {
  test('renders nothing when tlm_instance is not QuickRec', () => {
    renderCell({ tlm_instance: 'TLMP_CONSUMER', recon_id: 'R1', recon_portal_id: 'P1' }, 'recon_id', 'R1')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  test('renders View and opens modal with recon_id locked on click', () => {
    renderCell({ tlm_instance: 'QuickRec', recon_id: 'R1', recon_portal_id: 'P1' }, 'recon_id', 'R1')
    fireEvent.click(screen.getByRole('button', { name: /view/i }))
    expect(screen.getByTestId('modal')).toBeInTheDocument()
    const u = new URL(lastModalProps.url as string)
    expect(u.pathname).toBe('/embed/dashboards/dash-quickrec-stats')
    expect(u.searchParams.get('filter.recon_id')).toBe('R1')
    expect(u.searchParams.get('filter.rec_portal_id')).toBe('P1')
    expect(u.searchParams.get('filter.lock')).toBe('recon_id')
    expect(u.searchParams.get('theme')).toBe('dark')
  })
})
