import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { JobDetailsPanel } from '../JobDetailsPanel'
import type { JobDetails, JobStatusInfo } from '../types'

const details: JobDetails = {
  jobType: 'CMD', machine: 'na-trade01', runCalendar: 'DAILY_NA',
  excludeCalendar: 'NA_HOLIDAYS', boxName: 'BOX_TRADE_RECON_001', command: '', description: '',
}
const status: JobStatusInfo = {
  jobName: 'PRE_LOAD_TRADE_RECON_001', status: 4, statusName: 'Success',
  nextStartEpoch: 1747084800, nextStartFormatted: 'May 12, 8:00 AM',
  scheduledToday: true, currentlyActive: false, visualState: 'COMPLETED',
}

describe('JobDetailsPanel', () => {
  test('shows the empty hint when no job is selected', () => {
    render(<JobDetailsPanel jobName={null} details={undefined} status={null} statusAvailable />)
    expect(screen.getByText(/click on any job/i)).toBeInTheDocument()
  })

  test('renders job fields when a job is selected', () => {
    render(<JobDetailsPanel jobName="PRE_LOAD_TRADE_RECON_001" details={details} status={status} statusAvailable />)
    expect(screen.getByText('PRE_LOAD_TRADE_RECON_001')).toBeInTheDocument()
    expect(screen.getByText('na-trade01')).toBeInTheDocument()
    expect(screen.getByText('DAILY_NA')).toBeInTheDocument()
    expect(screen.getByText('BOX_TRADE_RECON_001')).toBeInTheDocument()
    expect(screen.getByText('Success')).toBeInTheDocument()
    expect(screen.getByText(/May 12, 8:00 AM/)).toBeInTheDocument()
  })

  test('hides the status badge when statusAvailable is false', () => {
    render(<JobDetailsPanel jobName="PRE_LOAD_TRADE_RECON_001" details={details} status={status} statusAvailable={false} />)
    expect(screen.queryByText('Success')).toBeNull()
    // Job fields still render.
    expect(screen.getByText('na-trade01')).toBeInTheDocument()
  })

  test('renders Command and Description sections only when present', () => {
    const withText: JobDetails = { ...details, command: '/scripts/run_pre.sh', description: 'Pre step for X' }
    const { rerender } = render(
      <JobDetailsPanel jobName="PRE_LOAD_TRADE_RECON_001" details={withText} status={null} statusAvailable={false} />,
    )
    expect(screen.getByText('Command')).toBeInTheDocument()
    expect(screen.getByText('/scripts/run_pre.sh')).toBeInTheDocument()
    expect(screen.getByText('Description')).toBeInTheDocument()
    expect(screen.getByText('Pre step for X')).toBeInTheDocument()

    // Empty command/description (the current backend default) → sections hidden.
    rerender(<JobDetailsPanel jobName="PRE_LOAD_TRADE_RECON_001" details={details} status={null} statusAvailable={false} />)
    expect(screen.queryByText('Command')).toBeNull()
    expect(screen.queryByText('Description')).toBeNull()
  })
})
