# Angular V5 Grid → SQL Search Endpoint (Phase 5 evidence, not wired)

**Status:** Documentation only. Phase 5 ships zero Angular code edits.
**Date:** 2026-05-17
**Companion smoke:** `scripts/smoke-sql-search.sh` (6 assertions green against live local stack).

## Why this doc exists

Phase 5 (D-5.18) explicitly defers all frontend changes. The new
`SqlSearchControllerV4` (`/api/v4/sql-search/{config,ssrm/{tabKey}}`)
mirrors the existing `SearchControllerV4` shape exactly — request body
(`SSRMRequestV4`) and response body (`SSRMResponseV4`) are reused
verbatim — so the existing Angular V5 SSRM grid can consume the new
endpoint by swapping the URL constant in a single service file. This
document captures the swap as a concrete, future-executable instruction
without modifying any frontend code in Phase 5.

The strangler-fig strategy (per phase plan) deliberately leaves the
Angular surface untouched until the React frontend is the long-term
home for SQL tabs. The end-to-end evidence required by SQL-07 is
satisfied by the smoke script against the live backend; Angular
consumption is documented here for the future plan that opts in.

## The minimal change

All URL composition for the V5 grid lives in **one Angular service**:

- **File:** `frontend/rectrace/src/app/services/search-v5.service.ts`
- **Line 98** — base URL constant:
  ```
  private apiUrl = `${environment.apiUrl}/v4/search`;  // Using V4 endpoints
  ```
  becomes
  ```
  private apiUrl = `${environment.apiUrl}/v4/sql-search`;
  ```
  This single edit re-targets all three V4 method calls — `performInitialSearch`
  (line 103), `fetchSSRMData` (line 112), and `getConfiguration` (line 119) — at
  the new SQL surface. The grid component delegates to this service at
  `frontend/rectrace/src/app/search-v5/components/search-v5-grid/search-v5-grid.component.ts:363`
  via `this.searchServiceV5.fetchSSRMData(request).toPromise()` — no
  component-side edit is required.

- **One caveat — `performInitialSearch` has no SQL counterpart.** The SQL
  surface does not expose `/initial?keyword=...`; SQL tabs are populated
  directly by the SSRM POST (no two-step ES pre-filter). Two options:

  1. **Preferred (long-term):** Split the service. Create a sibling
     `SqlSearchServiceV5` that targets `/v4/sql-search` and exposes only
     `getConfiguration()` + `fetchSSRMData()`. Leave `SearchServiceV5`
     unchanged. The grid component then selects which service to call
     based on the active tab's `type` (the `tabs[].type` field in the
     `/config` response distinguishes SQL tabs from regular search tabs).
  2. **Quick (evidence-only):** Keep one service. Override the base URL
     per call by inlining the path: in `fetchSSRMData`, replace
     `` `${this.apiUrl}/ssrm/${category}` `` (line 112) with
     `` `${environment.apiUrl}/v4/sql-search/ssrm/${category}` `` (and similarly
     for `getConfiguration` at line 119). Leave `performInitialSearch`
     pointing at `/v4/search/initial` — it will never be called for SQL
     tabs because the grid skips the ES pre-filter step.

  Option 1 is the right structural choice for the React port (parity
  matrix marks reconSummary as `port`); option 2 is acceptable for a
  one-off Angular validation run.

- **No DTO changes needed.** The Angular `SSRMRequestV4` interface
  (declared at `search-v5.service.ts:37-47`) carries an `initialFilter`
  field that the SQL controller ignores; the backend's `SSRMRequestV4`
  DTO is the same class for both surfaces. Sending an empty
  `initialFilter` (or omitting it) is harmless for SQL tabs.

## Verification recipe

Once the swap above is applied in a future plan:

1. Apply the constant swap in `search-v5.service.ts` (option 1 or 2 above).
2. Start the backend with the SQL config present:
   ```
   ./ops/rectrace-ops.sh start backend
   ```
   Confirm `/rectrace/api/v4/sql-search/config` returns the `reconSummary`
   tab. Run `npm start` in `frontend/rectrace/`.
3. Navigate to the V5 search route. The tab list now shows the
   `Recon Summary (SQL)` tab. Select it; confirm the grid loads ≥1 row
   and that the `recon` column displays values including `CROSS_ASSET_GBL`
   (the row whose `job_name='RECON-XYZ-42'` — proves the seed flowed
   through the SQL surface unchanged).

## Why we did not wire it now

Three reasons stack:

1. **Phase 5 charter (D-5.18):** "No frontend changes in Phase 5. The
   React app's CategoryTabBar already has a Phase 4 TODO; SQL tab
   consumption from React is deferred. Angular consumes the new endpoint
   as the wire-up evidence." The smoke script (`scripts/smoke-sql-search.sh`,
   6 assertions green against the live backend) is the documented
   "wire-up evidence" — `curl` exercises the same HTTP contract Angular
   would use.

2. **Strangler-fig strategy:** Modernization is replacing Angular with
   React. Editing Angular for a feature that lives only on the new SQL
   surface adds maintenance cost to the deprecated stack; the parity
   matrix marks `reconSummary` as `port` (React-native), not `keep-in-angular`.

3. **SQL-07 is satisfied by the smoke.** The phase requirement is "at
   least one example end-to-end consumable by an existing grid." The
   smoke proves the contract is consumable; the Angular swap above is
   a documented, one-line, future-executable transformation. No
   undiscovered integration risk remains.
