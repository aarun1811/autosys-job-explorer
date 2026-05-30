# Post-Demo Pending Work — Handoff

**Created:** 2026-05-30 14:50 IST
**Owner:** A Arun
**Last updated:** 2026-05-30 14:50 IST (pre-compact)

After the successful TLM dashboard demo, we're working through the remaining task queue. This doc is the canonical "what's left" list. Status fields update in place.

---

## A. Original task queue (user-specified order)

| # | Task | Status |
|---|---|---|
| A1 | Empty-state no-results bug + Contextual dashboards inline in search results — needs its own brainstorm → spec → plan (UX redesign) | NOT STARTED — pick up with user |
| A2 | AG-Grid styling inside the embedded RecViz dashboards (quartz tweaks, denser rows, column dividers) | NOT STARTED — pick up with user |
| A3 | `Cache-Control: no-cache` on RecViz `index.html` so bundle-hash invalidation busts browser caches | NOT STARTED — autonomous attempt during user's 30-50min window |

## B. Plan 4 polish parked at the demo gate

| # | Task | Status |
|---|---|---|
| B4 | Set_id identifier alignment in `gen_core_dicts` (rectrace-local-dev `volume.py`) — change bounded SETV_* pool to per-recon `LACC_{recon.seq:06d}`. Fixes the 0/0/0/0 result when clicking a specific recon+set_id cell. | NOT STARTED — autonomous attempt during user's window |
| B5 | MultiSelectFilter array normalization (RecViz `dashboard-renderer.tsx`) — wrap URL string values as arrays for `multi-select` filters so the badge stops showing string-length as the selected count ("24 selected" → "1 selected" for the locked recon). | NOT STARTED — autonomous attempt during user's window |

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

Working through B4 → B5 → A3 in that order. Updates land here as I go.

### B4: Set_id alignment in `gen_core_dicts`

- **Status**: NOT STARTED
- **Repo**: `/Users/aarun/Workspace/Projects/rectrace-local-dev`
- **Branch**: TBD (likely a new `fix/setid-alignment` off `feature/tlm-instance-seed`, OR commit direct on current branch — repo is local-only so either works)
- **Files to change**: `volume.py` lines 285-307 (the `gen_core_dicts` function)
- **Concrete change**: replace `set_pool = [f"SETV_{k:06d}" for k in range(max(1, n // 70))]` + `set_id = set_pool[(i - 1) % len(set_pool)]` with `set_id = f"LACC_{recon.seq:06d}"`. Also drop `set_pool` decl + remove cyclic-pool comment.
- **Verification**: run `python apply.py --volume 10` from the rectrace-local-dev directory, confirm tail shows non-zero row counts. Then Playwright: search TLMP_CONSUMER → expand → click any recon cell → verify modal opens with non-zero KPIs.
- **Result placeholder**: <TO_BE_FILLED>

### B5: MultiSelectFilter array normalization

- **Status**: NOT STARTED
- **Repo**: `/Users/aarun/Workspace/Projects/RecViz`
- **Branch**: direct on `main` (matches recent fix-and-push pattern)
- **Files to change**: `frontend/src/components/dashboard/dashboard-renderer.tsx` (where `parseFilterParams(search)` becomes `initialFilters`)
- **Concrete change**: between `parseFilterParams` and `initializeFilters`, normalize: for each filter in `config.filters` where `filter.type === 'multi-select'`, if the parsed value is a string, wrap in `[value]` array.
- **Verification**: rebuild frontend, restart uvicorn (or just hard-refresh), Playwright a cell click → badge in modal shows "1 selected" not "24 selected".
- **Result placeholder**: <TO_BE_FILLED>

### A3: Cache-Control no-cache on RecViz index.html

- **Status**: NOT STARTED
- **Repo**: `/Users/aarun/Workspace/Projects/RecViz`
- **Branch**: direct on `main`
- **Files to change**: TBD — need to find where FastAPI serves `index.html`. Likely `backend/app/main.py` (StaticFiles mount + a catch-all `FileResponse('index.html')` route).
- **Concrete change**: for the catch-all that returns index.html, attach headers `Cache-Control: no-cache, no-store, must-revalidate` + `Pragma: no-cache`. The hashed bundle assets in `/assets/*` keep their default cacheable headers.
- **Verification**: rebuild frontend, restart uvicorn, `curl -I http://localhost:8000/` → confirm no-cache header. `curl -I http://localhost:8000/assets/index-<hash>.js` → confirm bundle is still cacheable.
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
