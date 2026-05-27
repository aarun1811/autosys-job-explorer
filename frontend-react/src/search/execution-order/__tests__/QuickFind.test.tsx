import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QuickFind } from '../QuickFind'
import type { ExecutionOrderData } from '../types'

const data: ExecutionOrderData = {
  loadJob: 'L',
  executionSequence: [
    { jobName: 'PRE-LOAD-ABC', loadJob: 'L', executionOrder: 1 },
    { jobName: 'MAIN-LOAD-ABC', loadJob: 'L', executionOrder: 2 },
    { jobName: 'POST-XYZ', loadJob: 'L', executionOrder: 3 },
  ],
  jobDetails: {}, jobStatuses: null, statusAvailable: false,
}

function setup() {
  const onActiveMatch = vi.fn()
  const onMatchesChange = vi.fn()
  render(<QuickFind data={data} onActiveMatch={onActiveMatch} onMatchesChange={onMatchesChange} />)
  return { onActiveMatch, onMatchesChange, input: screen.getByRole('textbox', { name: /find a job/i }) }
}

describe('QuickFind', () => {
  test('shows a live match counter and reports matches + first active match', () => {
    const { onActiveMatch, onMatchesChange, input } = setup()
    fireEvent.change(input, { target: { value: 'load' } })
    expect(screen.getByTestId('eo-find-counter')).toHaveTextContent('1 / 2')
    expect(onMatchesChange).toHaveBeenLastCalledWith(['PRE-LOAD-ABC', 'MAIN-LOAD-ABC'])
    expect(onActiveMatch).toHaveBeenLastCalledWith('PRE-LOAD-ABC')
  })

  test('Enter / ArrowDown cycles to the next match (wraps)', () => {
    const { onActiveMatch, input } = setup()
    fireEvent.change(input, { target: { value: 'load' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByTestId('eo-find-counter')).toHaveTextContent('2 / 2')
    expect(onActiveMatch).toHaveBeenLastCalledWith('MAIN-LOAD-ABC')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(screen.getByTestId('eo-find-counter')).toHaveTextContent('1 / 2') // wrap
  })

  test('no matches → "0 / 0" and reports empty + null active', () => {
    const { onActiveMatch, onMatchesChange, input } = setup()
    fireEvent.change(input, { target: { value: 'zzz' } })
    expect(screen.getByTestId('eo-find-counter')).toHaveTextContent('0 / 0')
    expect(onMatchesChange).toHaveBeenLastCalledWith([])
    expect(onActiveMatch).toHaveBeenLastCalledWith(null)
  })

  test('Escape / clear resets the query and restores the default view', () => {
    const { onActiveMatch, onMatchesChange, input } = setup()
    fireEvent.change(input, { target: { value: 'load' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect((input as HTMLInputElement).value).toBe('')
    expect(onMatchesChange).toHaveBeenLastCalledWith([])
    expect(onActiveMatch).toHaveBeenLastCalledWith(null)
  })
})
