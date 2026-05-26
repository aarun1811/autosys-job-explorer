import { apiFetch } from '@/lib/queryClient'
import type { ExportRequestV4 } from '@/search/types'

/** Full-dataset Excel export via the backend (Angular parity), not client-side. */
export async function exportSearchToExcel(category: string, body: ExportRequestV4): Promise<void> {
  const res = await apiFetch(`/rectrace/api/v4/search/export/${encodeURIComponent(category)}`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = `${category}_export.xlsx`
    a.click()
  } finally {
    URL.revokeObjectURL(url)
  }
}
