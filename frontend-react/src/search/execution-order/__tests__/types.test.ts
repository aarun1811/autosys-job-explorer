import { describe, test, expect } from 'vitest'
import { isEmptyExecutionOrder, type ExecutionOrderData } from '../types'

function data(seq: ExecutionOrderData['executionSequence']): ExecutionOrderData {
  return { loadJob: 'L', executionSequence: seq, jobDetails: {}, jobStatuses: null, statusAvailable: false }
}

describe('isEmptyExecutionOrder', () => {
  test('true for null / undefined / missing sequence', () => {
    expect(isEmptyExecutionOrder(null)).toBe(true)
    expect(isEmptyExecutionOrder(undefined)).toBe(true)
    expect(isEmptyExecutionOrder({} as ExecutionOrderData)).toBe(true)
  })
  test('true for an empty sequence array', () => {
    expect(isEmptyExecutionOrder(data([]))).toBe(true)
  })
  test('false when the sequence has at least one node', () => {
    expect(isEmptyExecutionOrder(data([{ jobName: 'A', loadJob: 'L', executionOrder: 1 }]))).toBe(false)
  })
})
