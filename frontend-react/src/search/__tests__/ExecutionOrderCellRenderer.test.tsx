import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import type { ICellRendererParams } from 'ag-grid-community'

// Hoisted mock — replace queryClient module so the renderer calls our spies
// instead of the real fetch path. Both apiFetch and reportRequestFailure are
// asserted in failure-path tests.
vi.mock('@/lib/queryClient', () => ({
  apiFetch: vi.fn(),
  reportRequestFailure: vi.fn(),
}))

import { apiFetch, reportRequestFailure } from '@/lib/queryClient'
import { ExecutionOrderCellRenderer } from '../renderers/ExecutionOrderCellRenderer'

type CellRendererParamsLike = {
  data?: Record<string, unknown>
  colDef?: { cellRendererParams?: { jobNameField?: string } }
}

function makeParams(opts: CellRendererParamsLike): ICellRendererParams {
  return opts as unknown as ICellRendererParams
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ExecutionOrderCellRenderer', () => {
  test('renders null when params.data.load_job is undefined', () => {
    const { container } = render(
      <ExecutionOrderCellRenderer {...makeParams({ data: {} })} />,
    )
    expect(container.firstChild).toBeNull()
  })

  test('renders null when params.data.load_job is empty string', () => {
    const { container } = render(
      <ExecutionOrderCellRenderer {...makeParams({ data: { load_job: '' } })} />,
    )
    expect(container.firstChild).toBeNull()
  })

  test('renders null when params.data.load_job is whitespace-only', () => {
    const { container } = render(
      <ExecutionOrderCellRenderer {...makeParams({ data: { load_job: '   ' } })} />,
    )
    expect(container.firstChild).toBeNull()
  })

  test('renders null when params.data itself is undefined', () => {
    const { container } = render(
      <ExecutionOrderCellRenderer {...makeParams({})} />,
    )
    expect(container.firstChild).toBeNull()
  })

  test('renders a "View" button when default jobNameField (load_job) is present', () => {
    render(
      <ExecutionOrderCellRenderer {...makeParams({ data: { load_job: 'JOB-1' } })} />,
    )
    expect(screen.getByRole('button', { name: /view/i })).toBeInTheDocument()
  })

  test('uses custom jobNameField from colDef.cellRendererParams.jobNameField', () => {
    render(
      <ExecutionOrderCellRenderer
        {...makeParams({
          data: { job_name: 'CUSTOM-JOB' },
          colDef: { cellRendererParams: { jobNameField: 'job_name' } },
        })}
      />,
    )
    expect(screen.getByRole('button', { name: /view/i })).toBeInTheDocument()
  })

  test('on click, calls apiFetch with /rectrace/api/execution-order/{encodedJobName}', async () => {
    const mockApi = apiFetch as unknown as ReturnType<typeof vi.fn>
    mockApi.mockResolvedValue({ json: () => Promise.resolve({ ok: true }) })

    render(
      <ExecutionOrderCellRenderer {...makeParams({ data: { load_job: 'JOB/1 SPACE' } })} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /view/i }))

    await waitFor(() => expect(mockApi).toHaveBeenCalledTimes(1))
    const callArg = mockApi.mock.calls[0][0] as string
    expect(callArg).toBe(`/rectrace/api/execution-order/${encodeURIComponent('JOB/1 SPACE')}`)
  })

  test('shows Loader2Icon (animate-spin) and disables button during fetch in-flight', async () => {
    const mockApi = apiFetch as unknown as ReturnType<typeof vi.fn>
    // never-resolving promise → in-flight forever. The Promise executor is a
    // plain (no-op) function — not async — so no-misused-promises is happy.
    const neverResolving: Promise<unknown> = new Promise<unknown>(function neverSettle() {
      /* never resolves */
    })
    mockApi.mockReturnValue(neverResolving)

    render(
      <ExecutionOrderCellRenderer {...makeParams({ data: { load_job: 'JOB-1' } })} />,
    )
    const button = screen.getByRole('button')
    fireEvent.click(button)

    await waitFor(() => expect(button).toBeDisabled())
    // Loader2Icon renders with animate-spin class
    expect(button.querySelector('.animate-spin')).not.toBeNull()
    // "View" text is NOT rendered while loading
    expect(button.textContent).not.toMatch(/view/i)
  })

  test('on success, opens Dialog with title "Execution Order — {jobName}" and JSON <pre>', async () => {
    const mockApi = apiFetch as unknown as ReturnType<typeof vi.fn>
    const responsePayload = { loadJob: 'JOB-1', executionSequence: [{ jobName: 'A', executionOrder: 1, loadJob: 'JOB-1' }] }
    mockApi.mockResolvedValue({ json: () => Promise.resolve(responsePayload) })

    render(
      <ExecutionOrderCellRenderer {...makeParams({ data: { load_job: 'JOB-1' } })} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /view/i }))

    await waitFor(() => {
      expect(screen.getByText(/Execution Order — JOB-1/)).toBeInTheDocument()
    })
    // <pre> contains JSON.stringify of the response
    const pre = document.querySelector('pre')
    expect(pre).not.toBeNull()
    expect(pre?.textContent).toContain('"loadJob": "JOB-1"')
  })

  test('on fetch failure, calls reportRequestFailure(err) — Dialog does NOT open; button re-enables', async () => {
    const mockApi = apiFetch as unknown as ReturnType<typeof vi.fn>
    const mockReport = reportRequestFailure as unknown as ReturnType<typeof vi.fn>
    const err = new Error('boom')
    mockApi.mockRejectedValue(err)

    render(
      <ExecutionOrderCellRenderer {...makeParams({ data: { load_job: 'JOB-1' } })} />,
    )
    const button = screen.getByRole('button', { name: /view/i })
    fireEvent.click(button)

    await waitFor(() => expect(mockReport).toHaveBeenCalledTimes(1))
    expect(mockReport).toHaveBeenCalledWith(err)
    // Dialog did NOT open
    expect(screen.queryByText(/Execution Order/)).toBeNull()
    // Button re-enabled
    await waitFor(() => expect(button).not.toBeDisabled())
  })

  test('source file contains literal "TODO(Phase 4)" marker (regression guard for Phase 4 placeholder swap)', async () => {
    // Vite's `?raw` query returns the on-disk source as a string. Phase 4 will
    // grep for this exact "TODO(Phase 4)" comment when replacing the
    // placeholder Dialog with the Cytoscape modal — this test asserts the
    // marker survives any refactor of the renderer file.
    const mod = await import('../renderers/ExecutionOrderCellRenderer.tsx?raw')
    expect(mod.default.includes('TODO(Phase 4)')).toBe(true)
  })
})
