// src/search/__tests__/RowDetailSheet.test.tsx
import { describe, test, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RowDetailSheet } from '@/search/RowDetailSheet'
import type { ColumnDefinitionV4 } from '@/search/types'

const columns: ColumnDefinitionV4[] = [
  { field: 'job_name', headerName: 'Job Name', rowGroup: true } as ColumnDefinitionV4,
  { field: 'recon', headerName: 'Recon Name' } as ColumnDefinitionV4,
]

describe('RowDetailSheet', () => {
  test('renders each column header and value for the row when open', () => {
    render(
      <RowDetailSheet
        open
        onOpenChange={vi.fn()}
        categoryLabel="Job Name"
        row={{ job_name: 'SAMPLE_TRADE_RECON_001', recon: 'TRADE_RECON_NA' }}
        columns={columns}
      />,
    )
    expect(screen.getByText('Job Name')).toBeInTheDocument()
    // The primary (rowGroup) value is the title; the duplicate cell value still renders too.
    expect(screen.getAllByText('SAMPLE_TRADE_RECON_001').length).toBeGreaterThan(0)
    expect(screen.getByText('Recon Name')).toBeInTheDocument()
    expect(screen.getByText('TRADE_RECON_NA')).toBeInTheDocument()
  })

  test('renders an em dash for missing values', () => {
    render(
      <RowDetailSheet open onOpenChange={vi.fn()} categoryLabel="Job Name" row={{ job_name: 'X' }} columns={columns} />,
    )
    expect(screen.getByText('—')).toBeInTheDocument() // recon is absent
  })

  test('renders nothing visible when row is null', () => {
    render(<RowDetailSheet open onOpenChange={vi.fn()} categoryLabel="Job Name" row={null} columns={columns} />)
    expect(screen.queryByText('Recon Name')).not.toBeInTheDocument()
  })

  it('titles the sheet with the search-column value and shows the category label', () => {
    render(<RowDetailSheet open onOpenChange={() => {}} categoryLabel="Job Name"
      row={{ job_name: 'JOB_ABC', box_name: '' }} columns={[
        { field: 'job_name', headerName: 'Job Name', rowGroup: true } as ColumnDefinitionV4,
        { field: 'box_name', headerName: 'Box Name' } as ColumnDefinitionV4,
      ]} />)
    // JOB_ABC appears both as the title and as the job_name cell value.
    expect(screen.getAllByText('JOB_ABC').length).toBeGreaterThan(0)
    // "Job Name" appears as both the category label (description) and a column header.
    expect(screen.getAllByText(/Job Name/i).length).toBeGreaterThan(0)
    // The description names the category as a "<label> record".
    expect(screen.getByText(/Job Name record/i)).toBeInTheDocument()
  })
})
