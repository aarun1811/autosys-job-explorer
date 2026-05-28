import type { ComponentProps } from 'react'
import { describe, expect, test, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ICellRendererParams } from 'ag-grid-community'

vi.mock('@/components/layout/theme-provider', () => ({ useTheme: () => ({ resolvedTheme: 'dark' }) }))
let lastModalProps: Record<string, unknown> = {}
vi.mock('@/search/recviz/RecvizDashboardModal', () => ({
  RecvizDashboardModal: (p: Record<string, unknown>) => {
    lastModalProps = p
    return p.open ? <div data-testid="modal" /> : null
  },
}))
vi.mock('@/search/recviz/recvizConfig', () => ({ getRecvizOrigin: () => 'http://localhost:5173' }))

import { TlmStatsCellRenderer } from './TlmStatsCellRenderer'

type EntryPoint = 'set_id' | 'recon' | 'tlm_instance'

function renderCell(
  data: Record<string, unknown>,
  entryPoint: EntryPoint,
  value: string,
) {
  const params = {
    value, data,
    colDef: { cellRendererParams: { entryPoint } },
  } as unknown as ICellRendererParams
  return render(<TlmStatsCellRenderer {...(params as ComponentProps<typeof TlmStatsCellRenderer>)} />)
}

describe('TlmStatsCellRenderer', () => {
  test('renders nothing when value is empty', () => {
    renderCell({ tlm_instance: 'TLMP_CONSUMER' }, 'tlm_instance', '')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  test('renders plain text when tlm_instance is missing (cannot route)', () => {
    renderCell({ tlm_instance: null, recon: 'R1' }, 'recon', 'R1')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText('R1')).toBeInTheDocument()
  })

  test('opens modal with tlm_instance lock on tlm_instance entry', () => {
    renderCell(
      { tlm_instance: 'TLMP_CONSUMER', recon: 'TRADE_RECON_NA', set_id: 'SETID_001' },
      'tlm_instance',
      'TLMP_CONSUMER',
    )
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByTestId('modal')).toBeInTheDocument()
    const u = new URL(lastModalProps.url as string)
    expect(u.pathname).toBe('/embed/dashboards/dash-tlm-stats')
    expect(u.searchParams.get('filter.tlm_instance')).toBe('TLMP_CONSUMER')
    expect(u.searchParams.get('filter.lock')).toBe('tlm_instance')
    expect(u.searchParams.get('theme')).toBe('dark')
  })

  test('opens modal with tlm_instance + recon lock on recon entry', () => {
    renderCell(
      { tlm_instance: 'TLMP_CONSUMER', recon: 'TRADE_RECON_NA', set_id: 'SETID_001' },
      'recon',
      'TRADE_RECON_NA',
    )
    fireEvent.click(screen.getByRole('button'))
    const u = new URL(lastModalProps.url as string)
    expect(u.searchParams.get('filter.tlm_instance')).toBe('TLMP_CONSUMER')
    expect(u.searchParams.get('filter.recon')).toBe('TRADE_RECON_NA')
    expect(u.searchParams.get('filter.lock')).toBe('tlm_instance,recon')
  })

  test('opens modal with tlm_instance + recon + set_id lock on set_id entry', () => {
    renderCell(
      { tlm_instance: 'TLMP_CONSUMER', recon: 'TRADE_RECON_NA', set_id: 'SETID_001' },
      'set_id',
      'SETID_001',
    )
    fireEvent.click(screen.getByRole('button'))
    const u = new URL(lastModalProps.url as string)
    expect(u.searchParams.get('filter.tlm_instance')).toBe('TLMP_CONSUMER')
    expect(u.searchParams.get('filter.recon')).toBe('TRADE_RECON_NA')
    expect(u.searchParams.get('filter.set_id')).toBe('SETID_001')
    expect(u.searchParams.get('filter.lock')).toBe('tlm_instance,recon,set_id')
  })
})
