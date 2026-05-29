// src/search/__tests__/exportSearch.test.ts
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'

const apiFetchMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/queryClient', () => ({ apiFetch: apiFetchMock, reportRequestFailure: vi.fn() }))

import { exportSearchToExcel } from '@/search/lib/exportSearch'
import type { ExportRequestV4 } from '@/search/types'

describe('exportSearchToExcel', () => {
  beforeEach(() => {
    apiFetchMock.mockReset()
    apiFetchMock.mockResolvedValue({ blob: async () => new Blob(['x'], { type: 'application/octet-stream' }) })
    // jsdom URL object-url shims
    ;(URL as unknown as { createObjectURL: () => string }).createObjectURL = vi.fn(() => 'blob:mock')
    ;(URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = vi.fn()
  })

  afterEach(() => vi.restoreAllMocks())

  test('POSTs the export body to /export/{category} and downloads a blob', async () => {
    const body: ExportRequestV4 = {
      category: 'jobName', initialFilter: { column: 'job_name', values: ['A'] },
      columns: ['job_name', 'box_name'], rowGroupCols: ['job_name'], sortModel: [], filterModel: {},
    }
    const clickSpy = vi.fn()
    vi.spyOn(document, 'createElement').mockReturnValue({ click: clickSpy, setAttribute: vi.fn(), style: {}, href: '', download: '' } as never)

    await exportSearchToExcel('jobName', body)

    const [url, opts] = apiFetchMock.mock.calls[0]
    expect(url).toBe('/rectrace/api/v4/search/export/jobName')
    expect(opts.method).toBe('POST')
    expect(JSON.parse(opts.body)).toEqual(body)
    expect(clickSpy).toHaveBeenCalledTimes(1)
  })
})
