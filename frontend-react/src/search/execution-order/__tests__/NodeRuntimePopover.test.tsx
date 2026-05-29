import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NodeRuntimePopover } from '../NodeRuntimePopover'
import type { JobStatusInfo } from '../types'

function status(over: Partial<JobStatusInfo>): JobStatusInfo {
  return {
    jobName: 'MAIN-LOAD-ABC-123', status: 5, statusName: 'Failure',
    nextStartEpoch: null, nextStartFormatted: null,
    lastStartEpoch: 1_700_000_000, lastStartFormatted: 'Nov 14, 8:00 PM',
    lastEndEpoch: 1_700_000_125, lastEndFormatted: 'Nov 14, 8:02 PM',
    exitCode: 1, runNum: 42, retries: 2, runMachine: 'na-trade07', owner: 'svc_recon',
    scheduledToday: false, currentlyActive: false, visualState: 'FAILED',
    ...over,
  }
}

describe('NodeRuntimePopover', () => {
  test('renders the runtime gold: status, exit code, duration, ended-at, retries, run machine', () => {
    render(<NodeRuntimePopover status={status({})} />)
    expect(screen.getByText('Failure')).toBeInTheDocument()
    expect(screen.getByText(/exit 1/i)).toBeInTheDocument()
    // duration = 1_700_000_125 - 1_700_000_000 = 125s = "2m 5s"
    expect(screen.getByText('2m 5s')).toBeInTheDocument()
    expect(screen.getByText(/Nov 14, 8:02 PM/)).toBeInTheDocument()
    expect(screen.getByText(/2 retries/i)).toBeInTheDocument()
    expect(screen.getByText('na-trade07')).toBeInTheDocument()
  })

  test('omits rows whose data is null (no run history)', () => {
    render(
      <NodeRuntimePopover
        status={status({ lastStartEpoch: null, lastEndEpoch: null, lastEndFormatted: null, exitCode: null, retries: null, runMachine: null })}
      />,
    )
    expect(screen.queryByText(/exit/i)).toBeNull()
    expect(screen.queryByText(/retries/i)).toBeNull()
    expect(screen.getByTestId('eo-runtime-popover')).toBeInTheDocument()
  })
})
