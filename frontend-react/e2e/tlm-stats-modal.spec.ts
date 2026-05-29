import { test, expect, type Page } from '@playwright/test'

/**
 * TLM-stats embedded-RecViz modal smoke spec.
 *
 * Real-world adjustment from the plan body:
 *
 *  - The `tlmInstance` category's `tlm_instance` column is `rowGroup: true,
 *    hide: true` in search-config-v4.json. AG-Grid renders the group key
 *    via `autoGroupColumnDef` (a text expander) — NOT the
 *    `tlmStatsButtonRenderer`. So a button with aria-label "View TLM stats
 *    for TLMP_CONSUMER" never appears at the top level. The cells that DO
 *    render the button are the `recon` and `set_id` leaf columns (per
 *    Task 7's wiring). Each test therefore expands the TLMP_CONSUMER group
 *    first and clicks a leaf cell. The modal-opens + 4-KPI assertions still
 *    fully verify the Plan 4 end-to-end flow (Task 6 renderer → buildEmbedUrl
 *    → Task 5 dashboard).
 *
 *  - Plan 3's volume seed produces `set_id` values prefixed `SETV_`, not
 *    `SETID_` (verified via SSRM probe of the live stack).
 */
test.describe('TLM stats modal — embedded RecViz dashboard', () => {
  async function searchAndExpandGroup(page: Page) {
    // The route Zod schema accepts `tab` (not `cat`); the `tlmInstance`
    // category's searchColumn is `tlm_instance` so q=TLMP_CONSUMER hits.
    await page.goto('/search?q=TLMP_CONSUMER&tab=tlmInstance')

    // Grid populates with the TLMP_CONSUMER group row. Wait directly on the
    // group row's presence — that's the user-facing readiness signal and
    // covers both AG-Grid's `role="grid"` and `role="treegrid"` containers.
    const groupRow = page.locator('[role="row"]').filter({ hasText: 'TLMP_CONSUMER' }).first()
    await groupRow.waitFor({ state: 'visible', timeout: 30_000 })

    // Click the group-expand chevron. AG-Grid renders it as
    // `.ag-group-contracted` (with an `>` icon) inside the auto-group cell.
    // Clicking the chevron is the canonical SSRM-group expand path; row-level
    // double-click also works in many AG-Grid configs but is not guaranteed
    // for SSRM groups.
    await groupRow.locator('.ag-group-contracted').click()

    // Wait for AG-Grid to fetch + render the leaf rows. The group row
    // remains visible (it's the parent) but new rows appear below it. We
    // wait by polling for the appearance of a button-renderer cell, which
    // only exists on leaf rows.
    await page.locator('button[aria-label^="View TLM stats for"]').first().waitFor({
      state: 'visible',
      timeout: 15_000,
    })
  }

  test('search → expand tlm_instance group → click recon cell → modal opens with 4 KPIs visible', async ({ page }) => {
    await searchAndExpandGroup(page)

    // After expansion, leaf rows render with `recon` cells that have the
    // tlmStatsButtonRenderer (entryPoint=recon). Find any one — they all
    // open the same dashboard, just with different recon-name filters.
    const reconCell = page
      .locator('button[aria-label^="View TLM stats for"]')
      .filter({ hasNotText: /^SETV_/ })
      .first()
    await reconCell.waitFor({ state: 'visible', timeout: 15_000 })
    await reconCell.click()

    // Modal opens → iframe loads dash-tlm-stats. The iframe lives inside
    // the RecvizDashboardModal Dialog; frameLocator scopes assertions to
    // its document.
    const iframe = page.frameLocator('iframe[src*="/embed/dashboards/dash-tlm-stats"]')

    // All 4 KPI labels appear in the embed.
    await expect(iframe.getByText(/^Total Items$/)).toBeVisible({ timeout: 30_000 })
    await expect(iframe.getByText(/^Automatched$/)).toBeVisible()
    await expect(iframe.getByText(/^Total Breaks$/)).toBeVisible()
    await expect(iframe.getByText(/^Manual Matched$/)).toBeVisible()
  })

  test('search → expand tlm_instance group → click set_id cell → modal opens with tlm_instance + recon + set_id locked', async ({ page }) => {
    await searchAndExpandGroup(page)

    // Find a set_id cell button. The seed uses SETV_ as the prefix (verified
    // via SSRM probe — the plan body's SETID_ was a documentation guess).
    const setIdCell = page
      .locator('button[aria-label^="View TLM stats for"]')
      .filter({ hasText: /^SETV_/ })
      .first()
    await setIdCell.waitFor({ state: 'visible', timeout: 15_000 })
    await setIdCell.click()

    // Read the iframe src to assert the lock list is set_id-scoped.
    // URLSearchParams percent-encodes commas as %2C.
    const iframe = page.locator('iframe[src*="/embed/dashboards/dash-tlm-stats"]').first()
    await iframe.waitFor({ state: 'visible', timeout: 15_000 })
    const src = await iframe.getAttribute('src')
    expect(src).toContain('filter.tlm_instance=TLMP_CONSUMER')
    expect(src).toContain('filter.lock=tlm_instance%2Crecon%2Cset_id')
  })
})
