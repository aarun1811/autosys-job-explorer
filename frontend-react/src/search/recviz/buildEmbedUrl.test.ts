import { describe, expect, test } from 'vitest'
import { buildEmbedUrl } from './buildEmbedUrl'

describe('buildEmbedUrl', () => {
  test('composes origin, dashboard id, locked filters, hide and theme', () => {
    const url = buildEmbedUrl({
      origin: 'http://localhost:5173',
      dashboardId: 'dash-quickrec-stats',
      filters: { recon_id: 'RECON_42', rec_portal_id: 'RP_7' },
      lock: ['recon_id', 'rec_portal_id'],
      theme: 'dark',
    })
    const u = new URL(url)
    expect(u.origin + u.pathname).toBe('http://localhost:5173/embed/dashboards/dash-quickrec-stats')
    expect(u.searchParams.get('filter.recon_id')).toBe('RECON_42')
    expect(u.searchParams.get('filter.rec_portal_id')).toBe('RP_7')
    expect(u.searchParams.get('filter.lock')).toBe('recon_id,rec_portal_id')
    expect(u.searchParams.get('hide')).toBe('title')
    expect(u.searchParams.get('theme')).toBe('dark')
  })

  test('omits empty filters and lock', () => {
    const url = buildEmbedUrl({
      origin: 'http://localhost:5173', dashboardId: 'd',
      filters: { recon_id: '', rec_portal_id: undefined }, lock: [], theme: 'light',
    })
    const u = new URL(url)
    expect(u.searchParams.has('filter.recon_id')).toBe(false)
    expect(u.searchParams.has('filter.lock')).toBe(false)
  })
})
