# Post-Demo Pending Work — Handoff

**Created:** 2026-05-30 14:50 IST
**Owner:** A Arun
**Last updated:** 2026-05-30 (A2 AG-Grid styling executed end-to-end via subagent-driven-development — 11 tasks shipped, both repos pushed, final review SHIP ✅)

After the successful TLM dashboard demo, we're working through the remaining task queue. This doc is the canonical "what's left" list. Status fields update in place.

---

## A. Original task queue (user-specified order)

| # | Task | Status |
|---|---|---|
| A1 | Empty-state no-results bug + Contextual dashboards inline in search results — needs its own brainstorm → spec → plan (UX redesign) | NOT STARTED — pick up with user |
| A2 | AG-Grid styling consistency between rectrace + RecViz (Gmail-inspired hover hairline in rectrace + v35-canonical port to RecViz + Geist app-wide migration in RecViz) | ✅ DONE (2026-05-30) — spec + plan executed end-to-end via subagent-driven-development. 11 tasks shipped + 1 Task-6 remediation. Final cross-cutting review verdict: SHIP. Mirror sync between `frontend-react/src/search/lib/gridTheme.ts` and `RecViz/frontend/src/lib/grid-theme.ts` verified byte-for-byte on visual params + universal CSS. Cross-app continuity confirmed via embed-modal screenshot. 25 handoff PNGs in `docs/superpowers/handoff/` (taskA3 ×4, task6 ×16, task11 ×5). Commits: rectrace `5b316ca`/`d49ad63`/`202830c`/`fd310f6`/`d77f6a4`/`bdc5775`; RecViz `6408fa8`/`7e99697`/`9aad0ef`/`38299e8`/`7f575a2`/`e1bc728` |
| A3 | `Cache-Control: no-cache` on RecViz `index.html` so bundle-hash invalidation busts browser caches | ✅ DONE + RUNTIME VERIFIED — `/`, `/dashboards/quickrec`, `/embed/dashboards/dash-tlm-stats` all return `no-cache, no-store, must-revalidate`; `/assets/<hash>.js` still cacheable; `/health` JSON unchanged |

## B. Plan 4 polish parked at the demo gate

| # | Task | Status |
|---|---|---|
| B4 | Set_id identifier alignment in `gen_core_dicts` (rectrace-local-dev `volume.py`) — change bounded SETV_* pool to per-recon `LACC_{recon.seq:06d}`. Fixes the 0/0/0/0 result when clicking a specific recon+set_id cell. | ✅ DONE + RUNTIME VERIFIED — KPIs 5/0/1/10 on click of LACC_000006 (was 0/0/0/0) |
| B5 | MultiSelectFilter array normalization (RecViz `dashboard-renderer.tsx`) — wrap URL string values as arrays for `multi-select` filters so the badge stops showing string-length as the selected count ("24 selected" → "1 selected" for the locked recon). | ✅ DONE + RUNTIME VERIFIED — locked recon (22-char) + set_id badges both show "1 selected" |
| B6 | Multi-select cascade serialization — GET `/api/data-sources/:id/distinct/:col` serializes array filter values as `"A,B"` comma-string instead of repeated query keys, so SQL becomes `IN ('A,B')` and matches nothing. Surfaced when picking >1 recon in the recon multi-select and watching set_id dropdown return empty. | ✅ DONE + UI-VERIFIED — 2 recons → set_id dropdown shows 2 LACCs; single-recon and KPI/grid queries unaffected |
| B7 | Single-selection multi-select badge — after B5 fixed the char-count bug, a multi-select with exactly 1 value (locked or unlocked) shows the unhelpful "1 selected" badge instead of the actual value. Especially bad for locked filters since the dropdown is disabled so the user can't see what's in. | ✅ DONE + UI-VERIFIED — locked recon/set_id now read out full value with title-attr tooltip; 0 and 2+ states unchanged |

## C. Code-review hygiene (low-priority but real)

| # | Task | Status |
|---|---|---|
| C6 | NULL-vs-missing semantics in matched merge rows — `coalesce_zero=true` only fills cells absent from the row dict; a SQL NULL serialized as `None` stays `None`. Add a test fixture row + ~5 LOC fix in `_merge_two`. | PARKED |
| C7 | Pre-existing Rules-of-Hooks issue in `frontend/src/components/dashboard/config-kpi-row.tsx` (line 64-65 early return before `useDashboardKpis`). Plan 4 docs explicitly deferred this. | PARKED |
| C8 | Frontend `DataSourceQueryResponse` type lies (`columns: string[]` vs actual `list[dict]`). Frontend never reads the field so benign; fix if we start consuming column metadata client-side. | PARKED |
| C9 | Standalone-embed empty-state guard for `dash-tlm-stats` when no `tlm_instance` provided. Only matters if dashboard is ever surfaced outside the rectrace cell-click flow. | PARKED |

## D. Hygiene / housekeeping

| # | Task | Status |
|---|---|---|
| D10 | Branch topology in rectrace-local-dev — `feature/tlm-instance-seed` carries a merge of `feature/volume-seed-data` because `main` was too old. Either rebase tlm-instance-seed onto volume-seed-data, OR merge volume-seed-data → main first. Not pushed anywhere, so cleanup is safe. | PARKED |
| D11 | rectrace-local-dev has no GitHub remote — local-only. If you want it on `aarun1811/...` for backup/sharing, create the repo + push. | PARKED |

## E. Phase 9 (Citi domain security) — blocked

| # | Task | Status |
|---|---|---|
| E12 | CitiPortal / SiteMinder / SPNEGO auth integration — blocked on Citi auth contract (which auth flow, keytab vs Vault, ES SSL re-enable, Citi CA truststore, prod CORS allow-list). | BLOCKED — needs Citi infra clarity |

## F. Actual deployment to Citi VMs

| # | Task | Status |
|---|---|---|
| F13 | First-deploy walkthrough on a real Citi VM. DEPLOY.md is comprehensive but a real first-run will surface Citi-specific gotchas (Oracle wallet path quirks, CA truststore, password-fetch script integration). | PENDING — when ops gives a VM |

---

## Active work — autonomous window (2026-05-30, ~30-50 min user-away)

### Window closing summary

All three tasks: **CODE COMPLETE + REVIEWED + COMMITTED + PUSHED + RUNTIME VERIFIED ✅**. User granted permission to bring up the local stack mid-window for end-to-end verification; brought up Docker → Oracle + ES → re-seeded → started backend + RecViz + React → ran A3 curl + B4/B5 Playwright. All three tasks pass real verification (not just static).

Working through B4 → B5 → A3 in that order. Updates land here as I go.

### B4: Set_id alignment in `gen_core_dicts`

- **Status**: CODE COMPLETE — RUNTIME VERIFICATION PENDING (local stack offline)
- **Commits**: rectrace-local-dev `d4532ea` (local-only, no remote) + autosys-job-explorer `c33ab08` (pushed to main)
- **Code review**: feature-dev:code-reviewer APPROVED with no findings (verified LACC_ format matches TLM-side generators byte-for-byte at volume.py:343, 360, 377, 392, 461; no SETV_* assertions in apply.py; recon-name prefixes don't collide with LACC_ regex)
- **Runtime verification result** (2026-05-30, ran post-user-grant of stack-bring-up):
  - Stack brought up: Docker daemon → `docker compose up -d` (Oracle + ES both healthy) → `apply.py --volume 10` (re-seed clean, 2.7s, all assertion gates passed)
  - Oracle spot-check: 15 distinct set_ids in `rectrace_core`, all `LACC_000001` through `LACC_000015`, **zero `SETV_` leftovers**
  - Backend running on `:6088`, RecViz on `:8000`, React dev on `:5173`
  - Playwright: navigated to `/search?q=TLMP_CONSUMER&tab=tlmInstance` → expanded TLMP_CONSUMER group → clicked button `View TLM stats for LACC_000006` → iframe loaded `/embed/dashboards/dash-tlm-stats?filter.set_id=LACC_000006&...` → KPIs read: **Total Items 5 · Automatched 0 · Total Breaks 1 · Manual Matched 10** (pre-B4 these would have been 0/0/0/0 because SETV_* never matched TLM-side LACC_*). Screenshot at `/Users/aarun/Workspace/Projects/autosys-job-explorer/.playwright-mcp/b4-kpis-non-zero-LACC_000006.png`.
- **Repo**: `/Users/aarun/Workspace/Projects/rectrace-local-dev`
- **Branch**: commit direct on `feature/tlm-instance-seed` (repo is local-only, no remote, no other open work on this branch).

**Purpose** — rectrace search-result rows have `set_id` drawn from a 70-deep bounded `SETV_*` pool. The TLM-side tables that the dashboard merges (`autosys_tlm_recon_sequences`, the manual-match union, the recon-stats family) use per-recon `LACC_<seq:06d>` for `local_acc_no` / `setid`. The dashboard auto-launches with `filter.set_id=<search-row.set_id>` and joins by `local_acc_no=set_id` — so a `SETV_*` value never matches → 0/0/0/0 KPIs on click. Demo'd the data-rich path (no set_id filter) but the clicked-row path still breaks.

**Approach chosen — A: strict per-recon LACC**
`set_id = f"LACC_{recon.seq:06d}"`. Search-row set_id now collides exactly with TLM-side local_acc_no for the same recon → cell click filter matches → KPIs populate.

**Alternatives rejected**
- B (multi-LACC pool per recon): would need symmetric TLM-seed expansion, otherwise re-introduces 0/0/0/0 for non-primary LACCs. Scope creep.
- C (lookup table in dashboard): adds an indirection that doesn't exist in production semantics. Set_id IS the local_acc_no in real data.
- D (90/10 hybrid SETV/LACC): 10% of cells still 0/0/0/0. Confusing demo behavior.

**Tradeoff accepted** — `set_id` cardinality drops from ~286 to ~14 (one per recon). This is correct semantics. The grid still shows the column with sensible values; group-by stays meaningful (one row per recon-set).

**Affected surfaces (grep-verified)**
- `volume.py` — only `SETV_*` source in rectrace-local-dev.
- `frontend-react/e2e/tlm-stats-modal.spec.ts:59,83` — `filter({ hasText: /^SETV_/ })` and `.filter({ hasNotText: /^SETV_/ })` regexes will break. Update to `/^LACC_/`.
- `heroContent.ts` TRY_EXAMPLES — no SETV_/LACC_ literals, neutral.
- No Java/JSON in rectrace references `SETV_`.

**Verification**
1. `cd ../rectrace-local-dev && .venv/bin/python apply.py --volume 10` — confirm assertion gates pass + row counts present.
2. `curl /api/v4/search/config` returns config (unchanged).
3. Playwright: rectrace `/search?cat=tlmInstance` → click any TLMP_CONSUMER row → expand recon → click set_id cell → modal opens with non-zero KPIs (260/110/50/136 or similar).
4. Run e2e: `pnpm test:e2e` with updated regex passes.

- **Result placeholder**: <TO_BE_FILLED>

### B5: MultiSelectFilter array normalization

- **Status**: CODE COMPLETE — RUNTIME VERIFICATION PENDING (RecViz dev stack offline)
- **Commit**: RecViz main (will be pushed; see git log)
- **Code review**: feature-dev:code-reviewer APPROVED — verified FilterConfig.type discriminant, idempotency, no other call sites, defaults handling correct, no store-level coercion conflict, share-URL round-trip clean
- **Reviewer parked one Nit** (skipped per design): empty-string URL param (`?filter.recon=`) would normalize to `['']` → "1 selected" with empty token. Unreachable in practice (URLSearchParams behaviour) — not addressed.
- **Static verification done**: `pnpm tsc -b --noEmit` clean; `pnpm lint` shows pre-existing 53-error baseline with **zero new errors** from this file; `pnpm build` succeeds (5.32s, no new warnings)
- **Runtime verification result** (2026-05-30):
  - Modal opened from rectrace cell-click with locked recon (`RECON-REPO-GBL-000006`, 22 chars) and locked set_id (`LACC_000006`, 11 chars). Both multi-select filter combobox triggers display the text **"1 selected"**.
  - Pre-B5 these would have rendered "22 selected" and "11 selected" (`String.length` on the bare string).
  - The tlm_instance single-select shows `TLMP_CONSUMER` (raw value, not a count badge — correct, that one is `single-select` not `multi-select`).
  - Screenshot evidence in the same B4 PNG above shows the filter row with the correct badges.
- **Repo**: `/Users/aarun/Workspace/Projects/RecViz`
- **Branch**: direct on `main`.

**Purpose** — `parseFilterParams` at `lib/dashboard-url-state.ts:25` returns `string | string[]` per filter: comma → split to array, no comma → keep as string. For a `multi-select` filter receiving a single value (eg `?filter.recon=R123`), the resulting initialFilter is the string `"R123"`. The DashboardRenderer seeds the filter-store with that string. The MultiSelectFilter component (config-filter-bar.tsx:233) does `const selected = value ?? []` then renders `{selected.length} selected` — JS string-length returns char count → "4 selected" badge for a 4-char value. Demo showed "24 selected" because the recon name is 24 chars long.

**Approach chosen — A: normalize in DashboardRenderer init**
In `dashboard-renderer.tsx` between receiving `initialFilters` prop and calling `initializeFilters`, walk `config.filters`; for each filter where `filter.type === 'multi-select'`, if the corresponding initial value is a string, wrap as `[value]`. Idempotent — only wraps strings, passes arrays through.

**Alternatives rejected**
- B (consumer-side coerce in MultiSelectFilter): defensive but doesn't fix downstream — the store still holds wrong-typed data; cross-filter logic, share-URL builder etc see strings where arrays should be.
- C (parseFilterParams returns Array<string> always): breaks single-select consumers that expect string.

**Affected surfaces**
- `frontend/src/components/dashboard/dashboard-renderer.tsx:70-86` — the synchronous init block. Insert normalization just before `initializeFilters(merged, lockedFilters)`.
- Both `/embed/dashboards/$dashboardId` (TLM modal path) AND `/_app/dashboards/$dashboardId` (standalone open) reach DashboardRenderer with the same initialFilters shape → single fix covers both.

**Verification**
1. `pnpm build` in `/Users/aarun/Workspace/Projects/RecViz/frontend`.
2. RecViz uvicorn auto-picks up the new `frontend/dist`.
3. Playwright: rectrace cell click → modal opens → locked recon multi-select shows "1 selected" + the recon-name value in the dropdown trigger when expanded.
4. Sanity: a normal (unlocked) multi-select still works — pick 3 items, badge says "3 selected".

- **Result placeholder**: <TO_BE_FILLED>

### B6: Multi-select cascade serialization bug

- **Status**: ✅ DONE + RUNTIME + UI VERIFIED
- **Commit**: RecViz `03115dd` (pushed to main)
- **Code review**: feature-dev:code-reviewer APPROVED — verified Starlette `multi_items()` semantics; idempotency across 0/1/N value cases; `_resolve_database` list-coercion (line 83-84) safe for `tlm_instance=['T1']`; FilterValue type narrowing correct; empty-array now means "filter not active" (correct semantics, supersedes latent `IN ('')` bug); POST /query body path untouched
- **Runtime verification result** (live stack, post-rebuild + uvicorn restart):
  - curl 2-recon (`?filter.recon=RECON-COMMOD-APAC-000052&filter.recon=FX_FWD_RECON_LATAM_000023`) → `{"values":["LACC_000023","LACC_000052"]}` ✅
  - curl 1-recon → `{"values":["LACC_000052"]}` (regression OK) ✅
  - curl 0-recon → all 105 set_ids (no filter applied) ✅
  - recon dropdown options API → 105 distinct recons ✅
- **UI verification result** (Playwright):
  - Navigated to `/dashboards/dash-tlm-stats?filter.tlm_instance=TLMP_CONSUMER&filter.recon=RECON-COMMOD-APAC-000052,FX_FWD_RECON_LATAM_000023`
  - Recon filter badge displays **"2 selected"** (B5 fix + B6 fix interplay confirmed)
  - Opened Set ID dropdown → contains **exactly 2 items**: `LACC_000023` and `LACC_000052` — matches the 2 selected recons' LACCs
  - Screenshot at `docs/superpowers/handoff/b6-cascade-2-recons-2-set-ids.png`
- **Repo**: `/Users/aarun/Workspace/Projects/RecViz`
- **Branch**: direct on `main`

**Purpose** — Cascading filter options (`set_id` depends on `recon` depends on `tlm_instance`) work fine for single-recon selections but return empty when 2+ recons are picked. Root cause is in the URL serialization of array filter values to the GET `/distinct` endpoint.

**Root cause** (curl-verified):
- Frontend `frontend/src/hooks/use-filter-options.ts:25` does `params.set('filter.${key}', String(val))`. For `val = ['A','B']`, `String(['A','B'])` returns `"A,B"`. URL becomes `?filter.recon=A,B`.
- Backend `backend/app/api/data_sources.py:80-86` reads `request.query_params.items()` — one entry per key, value is the raw string `"A,B"`. Filter dict becomes `{'recon': 'A,B'}`.
- Backend `query_engine._build_sql:172-177` sees `isinstance(fval, list) == False`, takes the string branch → SQL: `b.agent_code IN ('A,B')` (one literal) → matches no row.

**Important: POST `/query` body path is fine.** It deserializes JSON arrays via Pydantic `dict[str, str | int | list[str] | None]` and `_build_sql` correctly handles lists. So multi-select filtering of KPIs/charts/grids already works — only the cascading-options GET path is broken.

**Approach chosen — A: repeated query params**
- Frontend: when value is an array, call `.append('filter.${key}', item)` per element. Strings still use `.set()`.
- Backend `get_distinct_values`: iterate `request.query_params.multi_items()` into a per-key list; if 1 entry keep as string, if ≥2 keep as list. Pass to `execute_distinct` whose `_build_sql` already handles both.

**Alternatives rejected**
- B (JSON-encoded query value, `filter.recon=%5B%22A%22%5D`): ugly URLs, fragile parsing, non-REST.
- C (switch GET to POST with body): API-break, loses GET cacheability and URL-share/debug ergonomics, larger blast radius.

**Idempotency**
- Single string value (`?filter.X=A`) — backend reads 1 entry → string → unchanged behavior.
- Multi-value (`?filter.X=A&filter.X=B`) — backend reads 2 entries → list → SQL `IN ('A','B')`.
- `_resolve_database` (dynamic DB routing) already coerces list→list[0] (query_engine.py:83-84), so `tlm_instance=['TLMP_CONSUMER']` doesn't break routing.

**Affected surfaces**
- `frontend/src/hooks/use-filter-options.ts` lines 22-27 — switch `.set` to per-element `.append` for arrays.
- `backend/app/api/data_sources.py` lines 80-86 — replace `items()` with `multi_items()` + grouping.
- No SQL/schema changes. No POST /query changes. No type changes.

**Verification**
- API: `curl '.../distinct/set_id?filter.tlm_instance=TLMP_CONSUMER&filter.recon=RECON-COMMOD-APAC-000052&filter.recon=FX_FWD_RECON_LATAM_000023'` → returns `{"values":["LACC_000023","LACC_000052"]}`.
- UI: rebuild RecViz frontend, restart uvicorn, select 2 recons in `/dashboards/dash-tlm-stats?filter.tlm_instance=TLMP_CONSUMER` → set_id dropdown shows their 2 LACCs.
- Regression: single recon still narrows to 1 LACC (existing B4-verified behavior).
- KPI/grid queries (POST /query body path) unaffected — confirm by clicking through the rectrace cell flow once.

### B7: Single-selection multi-select badge UX

- **Status**: ✅ DONE + RUNTIME + UI VERIFIED
- **Commit**: RecViz `48d7ca7` (pushed to main)
- **Code review**: feature-dev:code-reviewer APPROVED — verified 3-way branch correctness (0/1/2+), truncation math inside 200px button minus chevron + padding ≈ 144px → 24-char value truncates with ellipsis, native `title` tooltip exposes full string, no SingleSelectFilter/PresetRangeFilter side-effects, no raw hex
- **Runtime verification result** (live stack):
  - Embed modal (locked) `?filter.recon=RECON-COMMOD-APAC-000052&filter.set_id=LACC_000052&filter.lock=tlm_instance,recon,set_id`:
    - RECON pill displays "RECON-COMMOD-APAC-000052" + `title="RECON-COMMOD-APAC-000052"` ✅
    - SET ID pill displays "LACC_000052" + `title="LACC_000052"` ✅
  - Standalone (2 recons via `?filter.recon=A,B`): RECON pill displays "2 selected" (regression OK) ✅
  - Standalone (0 recons): SET ID pill displays "All set id" placeholder (regression OK) ✅
- **Screenshots**: `docs/superpowers/handoff/b7-locked-single-shows-value.png` (the win) + `b7-regression-2-recons-shows-N-selected.png` (regression OK)
- **Repo**: `/Users/aarun/Workspace/Projects/RecViz`
- **Branch**: direct on `main`

**Purpose** — B5 fixed the "24 selected" char-count bug by wrapping single-value URL params as `[value]` arrays. Now locked multi-selects (recon, set_id) correctly count as "1 selected" — but the badge is opaque: it reveals neither what's selected nor (when locked) any way to find out. Especially bad for the rectrace cell-click modal where recon + set_id are always single-locked.

**Approach chosen — A: value-aware badge text**
Replace the always-`{N} selected` rendering with:
- **0 selected** → existing placeholder (`All recon` / `Select…`)
- **1 selected** → render `selected[0]` as text. Truncate with CSS ellipsis past pill width (already truncate-able via existing `.truncate` class on the inner span). Add `title={selected[0]}` for native tooltip with the full value.
- **2+ selected** → existing `{N} selected`

Idempotent — array length switches drive the render branch.

**Alternatives rejected**
- B (always `N selected: <preview>`): noisier; doesn't fit the compact pill.
- C (locked-only): leaves the unlocked-single inconsistency; tlm_instance single-select shows raw value, multi-select with one item should match.

**Affected surfaces**
- `frontend/src/components/dashboard/config-filter-bar.tsx` around the MultiSelectFilter render (lines ~269-274 where `{selected.length} selected` is rendered).
- No other consumer.

**Verification**
- Playwright: rectrace cell-click modal — locked recon shows full value (truncated if needed); set_id shows `LACC_000006`. Open standalone dashboard with `?filter.recon=A,B` → recon badge shows "2 selected" (unchanged). Pick 1 unlocked recon → badge shows that recon's value.
- Tooltip: hover the truncated value → native tooltip shows full string.

### A3: Cache-Control no-cache on RecViz index.html

- **Status**: CODE COMPLETE — RUNTIME VERIFICATION PENDING (RecViz uvicorn offline)
- **Commit**: RecViz main (will be pushed; see git log)
- **Code review**: feature-dev:code-reviewer APPROVED — verified coverage of both HTML paths (StaticFiles(html=True) for GET / + spa_fallback exception_handler — both flow through BaseHTTPMiddleware), no precedence conflicts (only Cache-Control setter in backend), middleware ordering benign, content-type robustness handles all variants (charset suffix, mixed case, empty)
- **Static verification done**: `venv/bin/python -m py_compile app/main.py` SYNTAX OK
- **Runtime verification result** (2026-05-30):
  - `GET /` → `content-type: text/html; charset=utf-8` + `cache-control: no-cache, no-store, must-revalidate` + `pragma: no-cache` ✓
  - `GET /dashboards/quickrec` → same headers ✓
  - `GET /embed/dashboards/dash-tlm-stats` → same headers ✓
  - `GET /assets/index-CDRDNjIs.js` → `content-type: text/javascript; charset=utf-8` + content-length 6,197,558 + **no cache-control / no pragma** (bundles stay cacheable) ✓
  - `GET /health` → `content-type: application/json` + no Cache-Control change ✓
  - Note: `HEAD /health` is misrouted to spa_fallback by FastAPI (HEAD-vs-GET routing quirk in the StaticFiles mount catch-all order) — produces `text/html` with no-cache. Pre-existing behavior unrelated to A3; the actual `GET /health` (which is what browsers and clients use) is correct.
- **Repo**: `/Users/aarun/Workspace/Projects/RecViz`
- **Branch**: direct on `main`.

**Purpose** — After a RecViz redeploy, users' browsers may hold cached `index.html` pointing to old `/assets/index-<hash>.js`. New deploy replaces the hash → browser fetches stale HTML → bundle 404 → blank page until hard refresh. Want HTML to never cache; bundles (content-hashed) stay aggressively cached.

**Found two HTML-serving paths** in `backend/app/main.py`:
- `StaticFiles(directory=FRONTEND_DIST, html=True)` mounted at `/` (line 264) — serves index.html for bare `/` because `html=True`.
- `@app.exception_handler(404)` returning `FileResponse(FRONTEND_DIST / "index.html")` (line 256-262) — serves index.html for TanStack-Router paths (`/dashboards/...`, `/embed/...`).

**Approach chosen — A: response-type-aware middleware**
Add a small `BaseHTTPMiddleware` (mirrors the existing `XFrameOptionsMiddleware` pattern at line 226). For every response, if `response.headers.get("content-type", "").startswith("text/html")`, attach:
```
Cache-Control: no-cache, no-store, must-revalidate
Pragma: no-cache
```
This catches both HTML paths automatically AND is future-proof if more HTML routes appear. Bundle assets are `application/javascript` / `text/css` → unaffected. JSON API responses → unaffected.

**Alternatives rejected**
- B (route-level header on spa_fallback only): misses the StaticFiles `GET /` case.
- C (subclass StaticFiles): more code, less general.

**Affected surfaces**
- `backend/app/main.py` — one new middleware class + one `add_middleware` call.
- No frontend changes.

**Verification**
1. RecViz uvicorn restart (no rebuild needed — backend change only).
2. `curl -I http://localhost:8000/` → `Cache-Control: no-cache, no-store, must-revalidate` + `Pragma: no-cache`.
3. `curl -I http://localhost:8000/dashboards/quickrec` → same.
4. `curl -I http://localhost:8000/embed/dashboards/dash-tlm-stats` → same.
5. `curl -I http://localhost:8000/assets/<find-a-hashed-bundle>.js` → NO Cache-Control: no-cache (default StaticFiles ETag/Last-Modified headers).
6. `curl -I http://localhost:8000/health` → JSON, no Cache-Control change.

- **Result placeholder**: <TO_BE_FILLED>

---

## Recommended order after this window

When the user is back and ready:
1. **A3** if I didn't finish it autonomously
2. **A2 (AG-Grid styling)** — design conviction work, half-day, fun
3. **A1 (empty-state + contextual dashboards)** — needs brainstorm → spec → plan first; biggest scope
4. **Hygiene (C6/C7/C8/C9, D10/D11)** — sprinkle in between features
5. **F13 (real Citi VM deploy walkthrough)** — when ops gives a VM
6. **E12 (Phase 9 security)** — when Citi auth contract is unblocked

---

## State at start of autonomous window (2026-05-30 14:50 IST)

**Repos on `main` (post-demo state):**
- `autosys-job-explorer` (rectrace): HEAD `227810d` — modernization + Plan 4 + DEPLOY.md + runtime RecViz origin endpoint
- `RecStats` (RecViz): HEAD `647c628` — embed foundation + Plan 2 (QuickRec) + Plan 4 (TLM) + DEPLOY.md + RECVIZ_CONFIG_PATH support
- `rectrace-local-dev`: HEAD `c075f08` on `feature/tlm-instance-seed` (no remote)

**Live stack:** Oracle 23c at `:1521`, ES at `:9200`, rectrace Spring Boot at `:6088`, RecViz uvicorn at `:8000`, React dev at `:5173` (all running per pre-demo).

**Standing rules in effect** (carry through compact):
- opus everywhere (including subagents)
- `feature-dev:code-reviewer` after every task
- commit/push to `main` only since the post-demo merge — feature branches when scope warrants
- Co-Authored-By footer on every commit
- no raw hex in TS/TSX (use `var(--…)`)
- Bash 3.2 portability for `ops/`
- config-driven principle (no hardcoded columns/renderers)
