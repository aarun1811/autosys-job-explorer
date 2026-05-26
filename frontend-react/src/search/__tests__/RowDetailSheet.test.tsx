// src/search/__tests__/RowDetailSheet.test.tsx
import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RowDetailSheet } from '@/search/RowDetailSheet'
import type { ColumnDefinitionV4 } from '@/search/types'

const columns: ColumnDefinitionV4[] = [
  { field: 'job_name', headerName: 'Job Name' },
  { field: 'recon', headerName: 'Recon Name' },
]

describe('RowDetailSheet', () => {
  test('renders each column header and value for the row when open', () => {
    render(
      <RowDetailSheet
        open
        onOpenChange={vi.fn()}
        row={{ job_name: 'SAMPLE_TRADE_RECON_001', recon: 'TRADE_RECON_NA' }}
        columns={columns}
      />,
    )
    expect(screen.getByText('Job Name')).toBeInTheDocument()
    expect(screen.getByText('SAMPLE_TRADE_RECON_001')).toBeInTheDocument()
    expect(screen.getByText('Recon Name')).toBeInTheDocument()
    expect(screen.getByText('TRADE_RECON_NA')).toBeInTheDocument()
  })

  test('renders an em dash for missing values', () => {
    render(
      <RowDetailSheet open onOpenChange={vi.fn()} row={{ job_name: 'X' }} columns={columns} />,
    )
    expect(screen.getByText('—')).toBeInTheDocument() // recon is absent
  })

  test('renders nothing visible when row is null', () => {
    render(<RowDetailSheet open onOpenChange={vi.fn()} row={null} columns={columns} />)
    expect(screen.queryByText('Job Name')).not.toBeInTheDocument()
  })
})
