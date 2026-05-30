# Post-Demo Pending Work — Handoff

**Created:** 2026-05-30 14:50 IST
**Owner:** A Arun
**Last updated:** 2026-05-30 (autonomous window closed — B4/B5/A3 code complete + reviewed + pushed; runtime verification pending stack-up)

After the successful TLM dashboard demo, we're working through the remaining task queue. This doc is the canonical "what's left" list. Status fields update in place.

---

## A. Original task queue (user-specified order)

| # | Task | Status |
|---|---|---|
| A1 | Empty-state no-results bug + Contextual dashboards inline in search results — needs its own brainstorm → spec → plan (UX redesign) | NOT STARTED — pick up with user |
| A2 | AG-Grid styling inside the embedded RecViz dashboards (quartz tweaks, denser rows, column dividers) | NOT STARTED — pick up with user |
| A3 | `Cache-Control: no-cache` on RecViz `index.html` so bundle-hash invalidation busts browser caches | CODE COMPLETE + REVIEWED + PUSHED (RecViz `c4a59b3`); runtime verification pending |

## B. Plan 4 polish parked at the demo gate

| # | Task | Status |
|---|---|---|
| B4 | Set_id identifier alignment in `gen_core_dicts` (rectrace-local-dev `volume.py`) — change bounded SETV_* pool to per-recon `LACC_{recon.seq:06d}`. Fixes the 0/0/0/0 result when clicking a specific recon+set_id cell. | CODE COMPLETE + REVIEWED (rectrace-local-dev `d4532ea` local-only; autosys-job-explorer `c33ab08` pushed); runtime verification pending |
| B5 | MultiSelectFilter array normalization (RecViz `dashboard-renderer.tsx`) — wrap URL string values as arrays for `multi-select` filters so the badge stops showing string-length as the selected count ("24 selected" → "1 selected" for the locked recon). | CODE COMPLETE + REVIEWED + PUSHED (RecViz `df458b9`); runtime verification pending |

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

All three tasks: **CODE COMPLETE + REVIEWED + COMMITTED + PUSHED**. Runtime verification deferred — at start-of-window the entire local stack (Docker daemon, Oracle, ES, rectrace backend, RecViz uvicorn, React dev) was offline. Bringing it back up wasn't an action authorized by the brief, so the autonomous window completed everything possible without runtime: write code, code-review via subagents, type-check / lint / syntax-check, commit, push.

**To verify everything in one pass (on return)**:
1. Open Docker Desktop → wait for daemon
2. `cd ../rectrace-local-dev && docker compose up -d` → wait for Oracle ready
3. `cd ../rectrace-local-dev && .venv/bin/python apply.py --volume 10` → re-seeds with new B4 LACC_* set_ids
4. `cd /Users/aarun/Workspace/Projects/autosys-job-explorer && ops/rectrace-ops.sh start backend` → :6088 up
5. `cd /Users/aarun/Workspace/Projects/RecViz/backend && venv/bin/python -m uvicorn app.main:app --reload` → :8000 up (A3 middleware now applied)
6. `cd /Users/aarun/Workspace/Projects/autosys-job-explorer/frontend-react && pnpm dev` → :5173 up
7. Run each verification block in the B4/B5/A3 sections below (curl + Playwright).

If any verification fails, halt and update the relevant Result placeholder with the failure details; I can take it from there on next session.

Working through B4 → B5 → A3 in that order. Updates land here as I go.

### B4: Set_id alignment in `gen_core_dicts`

- **Status**: CODE COMPLETE — RUNTIME VERIFICATION PENDING (local stack offline)
- **Commits**: rectrace-local-dev `d4532ea` (local-only, no remote) + autosys-job-explorer `c33ab08` (pushed to main)
- **Code review**: feature-dev:code-reviewer APPROVED with no findings (verified LACC_ format matches TLM-side generators byte-for-byte at volume.py:343, 360, 377, 392, 461; no SETV_* assertions in apply.py; recon-name prefixes don't collide with LACC_ regex)
- **Runtime verification needed when stack is back up**:
  1. Start Docker + Oracle + ES + rectrace backend + RecViz + React
  2. `cd ../rectrace-local-dev && .venv/bin/python apply.py --volume 10` — should re-seed cleanly
  3. Spot-check Oracle: `SELECT COUNT(DISTINCT set_id), MIN(set_id), MAX(set_id) FROM rectrace_core` should show ~14 distinct LACC_* values
  4. Playwright: rectrace search `/search?q=TLMP_CONSUMER&tab=tlmInstance` → click recon row → expand → click any set_id cell (LACC_xxxxxx) → modal opens with non-zero KPIs (was 0/0/0/0)
  5. `cd frontend-react && pnpm test:e2e -- tlm-stats-modal.spec.ts` should pass
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
- **Runtime verification needed when stack is back up**:
  1. Start RecViz uvicorn + React dev
  2. Rectrace → search → click any recon-leaf cell → modal opens → locked recon filter badge shows "1 selected" (was 24 / char-count)
  3. Sanity check: open standalone (non-embed) RecViz dashboard with `?filter.region=APAC` — badge shows "1 selected"
  4. Pick 3 items in an unlocked multi-select — badge shows "3 selected"
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

### A3: Cache-Control no-cache on RecViz index.html

- **Status**: CODE COMPLETE — RUNTIME VERIFICATION PENDING (RecViz uvicorn offline)
- **Commit**: RecViz main (will be pushed; see git log)
- **Code review**: feature-dev:code-reviewer APPROVED — verified coverage of both HTML paths (StaticFiles(html=True) for GET / + spa_fallback exception_handler — both flow through BaseHTTPMiddleware), no precedence conflicts (only Cache-Control setter in backend), middleware ordering benign, content-type robustness handles all variants (charset suffix, mixed case, empty)
- **Static verification done**: `venv/bin/python -m py_compile app/main.py` SYNTAX OK
- **Runtime verification needed when stack is back up**:
  1. Start RecViz uvicorn
  2. `curl -I http://localhost:8000/` → `Cache-Control: no-cache, no-store, must-revalidate` + `Pragma: no-cache`
  3. `curl -I http://localhost:8000/dashboards/quickrec` → same
  4. `curl -I http://localhost:8000/embed/dashboards/dash-tlm-stats` → same
  5. `curl -I http://localhost:8000/assets/<a-hashed-bundle>.js` → NO Cache-Control: no-cache (default ETag/Last-Modified)
  6. `curl -I http://localhost:8000/health` → JSON, no Cache-Control change
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
