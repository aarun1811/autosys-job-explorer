import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../RunOverview', () => ({
  RunOverview: () => <div data-testid="eo-run-overview-mock" />,
}))

import { JobInspector } from '../JobInspector'
import type { JobDetails, JobStatusInfo, ExecutionOrderData } from '../types'

const details: JobDetails = {
  jobType: 'CMD', machine: 'na-trade01', runCalendar: 'DAILY_NA',
  excludeCalendar: 'NA_HOLIDAYS', boxName: 'BOX_TRADE_RECON_001', command: '', description: '',
}
const status: JobStatusInfo = {
  jobName: 'PRE_LOAD_TRADE_RECON_001', status: 5, statusName: 'Failure',
  nextStartEpoch: 1747084800, nextStartFormatted: 'May 12, 8:00 AM',
  lastStartEpoch: 1_700_000_000, lastStartFormatted: 'Nov 14, 8:00 PM',
  lastEndEpoch: 1_700_000_125, lastEndFormatted: 'Nov 14, 8:02 PM',
  exitCode: 1, runNum: 42, retries: 2, runMachine: 'na-trade07', owner: 'svc_recon',
  scheduledToday: true, currentlyActive: false, visualState: 'FAILED',
}

const overviewData: ExecutionOrderData = {
  loadJob: 'L', executionSequence: [], jobDetails: {}, jobStatuses: null, statusAvailable: false,
}

// Captured as a plain const (not accessed as navigator.clipboard.writeText in the
// assertion) to avoid @typescript-eslint/unbound-method on the method reference.
const writeText = vi.fn().mockResolvedValue(undefined)
beforeEach(() => {
  writeText.mockClear()
  Object.assign(navigator, { clipboard: { writeText } })
})

describe('JobInspector', () => {
  test('empty state renders the RunOverview (not a dead prompt)', () => {
    render(<JobInspector jobName={null} details={undefined} status={null} statusAvailable data={overviewData} />)
    expect(screen.getByTestId('eo-run-overview-mock')).toBeInTheDocument()
  })

  test('renders the last-run card + owner when a job has live status but no JIL details', () => {
    // A sequence job can have a run history (status) without a jobDetails row.
    // The runtime gold must still surface — not collapse to the run overview.
    render(<JobInspector jobName="PRE_LOAD_TRADE_RECON_001" details={undefined} status={status} statusAvailable data={overviewData} />)
    expect(screen.queryByTestId('eo-run-overview-mock')).toBeNull()
    expect(screen.getByTestId('eo-last-run')).toBeInTheDocument()
    expect(screen.getByText('svc_recon')).toBeInTheDocument() // owner, from status
    expect(screen.getByText('2m 5s')).toBeInTheDocument()      // duration
  })

  test('falls back to RunOverview when the selected job has neither details nor status', () => {
    render(<JobInspector jobName="GHOST" details={undefined} status={null} statusAvailable data={overviewData} />)
    expect(screen.getByTestId('eo-run-overview-mock')).toBeInTheDocument()
  })

  test('last-run card leads with duration · exit code · retries used', () => {
    render(<JobInspector jobName="PRE_LOAD_TRADE_RECON_001" details={details} status={status} statusAvailable data={overviewData} />)
    // duration = 125s = "2m 5s"
    expect(screen.getByText('2m 5s')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()       // exit code
    expect(screen.getByText('2')).toBeInTheDocument()       // retries used
    expect(screen.getByText(/Nov 14, 8:02 PM/)).toBeInTheDocument()
  })

  test('distinguishes run machine (where it ran) from definition machine (where it is defined)', () => {
    render(<JobInspector jobName="PRE_LOAD_TRADE_RECON_001" details={details} status={status} statusAvailable data={overviewData} />)
    expect(screen.getByText(/na-trade07/)).toBeInTheDocument() // run machine (last-run card, "Ran on …")
    expect(screen.getByText('na-trade01')).toBeInTheDocument() // definition machine
  })

  test('owner reads from status (not JobDetails) and renders in the definition group', () => {
    render(<JobInspector jobName="PRE_LOAD_TRADE_RECON_001" details={details} status={status} statusAvailable data={overviewData} />)
    expect(screen.getByText('svc_recon')).toBeInTheDocument()
  })

  test('hides the last-run card when statusAvailable is false; definition fields still render', () => {
    render(<JobInspector jobName="PRE_LOAD_TRADE_RECON_001" details={details} status={status} statusAvailable={false} data={overviewData} />)
    expect(screen.queryByTestId('eo-last-run')).toBeNull()
    expect(screen.getByText('na-trade01')).toBeInTheDocument()
  })

  test('renders Command + Description only when present, and copies the command', () => {
    const withText: JobDetails = { ...details, command: '/scripts/run_pre.sh', description: 'Pre step for X' }
    const { rerender } = render(
      <JobInspector jobName="PRE_LOAD_TRADE_RECON_001" details={withText} status={null} statusAvailable={false} data={overviewData} />,
    )
    expect(screen.getByText('/scripts/run_pre.sh')).toBeInTheDocument()
    expect(screen.getByText('Pre step for X')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /copy command/i }))
    expect(writeText).toHaveBeenCalledWith('/scripts/run_pre.sh')

    rerender(<JobInspector jobName="PRE_LOAD_TRADE_RECON_001" details={details} status={null} statusAvailable={false} data={overviewData} />)
    expect(screen.queryByText('/scripts/run_pre.sh')).toBeNull()
    expect(screen.queryByText('Pre step for X')).toBeNull()
  })
})
