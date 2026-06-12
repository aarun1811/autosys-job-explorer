---
milestone: v1.0 — Modernization
status: substantially_complete_merged_to_main
last_updated: 2026-06-12
progress:
  total_phases: 11
  completed_phases: 9        # 0, 0.1, 1, 2, 3, 5, 6, 7, 8 (+ post-milestone work on main)
  open_phases: ["4 (RecViz integration — rectrace side largely built)", "8 DESIGN-01/02/03", "9 (security)"]
---

# Project State

> **Authoritative current-state reference:** `.planning/codebase/CURRENT-STATE-2026-06-12.md` (verified system map, domain model, RecViz integration, endpoint inventory, doc-vs-code corrections). This STATE.md is the lightweight pointer; the per-phase decision log below `Phase 8` is archived under `.planning/archive/`.

## Project Reference

See: `.planning/PROJECT.md` and `.planning/codebase/CURRENT-STATE-2026-06-12.md`.

**Core value:** Users can quickly find Autosys jobs and understand their dependencies and TLM statistics through a unified, performant, design-consistent React UI.

## Current Position (2026-06-12)

The **Modernization milestone is substantially complete and merged into `main`.** `main` is ~45 commits **ahead** of `milestone/modernization` (whose HEAD is the merge-base) — `main` is the source of truth; do new work there.

**Done and merged to main:**

- **Phase 0 / 0.1** — test gate (`maven.test.skip` removed); sibling local-dev seed repo (`../rectrace-local-dev`).
- **Phase 1** — Boot 2.7 → 3.5.14, Java 8 → 21, jakarta sweep, V3 deletion, `SecurityFilterChain`, explicit HikariCP (4 named pools).
- **Phase 2** — React shell (Vite 7 + React 19 + shadcn + AG-Grid 35 + correlation-ID tracing + ops v1).
- **Phase 3** — React search vertical slice (one tab end-to-end).
- **Phase 5** — Config-driven SELECT (`sql-search` subsystem: JSqlParser boot-guard + read-only DS + SSRM).
- **Phase 6** — ES Loader (ShedLock + BulkIngester + alias-only + admin endpoints + run history).
- **Phase 7** — Observability sweep (JSON logs + Brave tracing + HealthIndicators + Prometheus + Micrometer enforcer pin).
- **Phase 8 (BUG + OPS subset)** — hyphen-search fix (`caseInsensitive(true)` on `.keyword` wildcards), `ops/rectrace-ops.sh` v2, `ops/ci-smoke.sh`, GitHub Actions.

**Post-milestone work landed on `main`** (after the per-phase `.planning/` history was archived — these are NOT reflected in the archived phase docs):

- All **13 search tabs** ported to one config-driven React search surface.
- **Execution-order redesign** — full React Flow (`@xyflow/react` v12 + dagre) `ExecutionOrderModal` with JobInspector / StatusLegend / QuickFind / minimap. Replaces the Phase-3 placeholder dialog; native, **not** Cytoscape.
- **TLM / QuickRec → RecViz embed** — `TlmStatsCellRenderer` + `QuickRecStatsCellRenderer` open a sandboxed RecViz dashboard iframe via `RecvizEmbed` / `buildEmbedUrl` / `recvizConfig`; backend `ConfigController` `GET /api/config` → `{recvizOrigin}`. (This is most of ROADMAP Phase 4 on the rectrace side.)
- **A1a (2026-05-31)** — removed the category-level `dashboard` config concept (config-only edit; `DashboardConfig` DTO/types retained, no category uses it).
- **Loader extraction (2026-05-31)** — loader moved out of `backend/rectrace` into `rectrace-loader/` (:6089); backend carries zero loader code.
- AG-grid styling consistency, inline-SVG logo, Citi laptop profile + `CITI-LAPTOP-SETUP.md`.

## Open / Next

- **Phase 4 — RecViz integration:** rectrace side largely built. Remaining is RecViz-side + cross-team — seed the RecViz dashboards (`dash-tlm-stats`, `dash-quickrec-stats`) per env via `RecViz/scripts/seed-oracle.py`; align dataset `filter_mappings` with the renderers' filter IDs; write the CSP/`frame-ancestors`/cookie/SSO contract; clear the prod blockers (see CURRENT-STATE §5).
- **Phase 9 — Domain security** (not started): CitiPortal/SiteMinder/SPNEGO + keytab/Vault + ES SSL re-enable + Citi CA truststore + CORS prod allow-list.
- **Phase 8 DESIGN-01/02/03** (deferred): needs RecViz visual references.
- **Angular retirement:** `frontend/` is frozen and slated for deletion; finalize the `/rectrace/` base-path + `rectrace-theme` coexistence before production.

## Known prod-config gotchas (verified 2026-06-12)

- `application-uat.properties:2` sets `spring.profiles.active=uat` — **forbidden in Boot 3.x**; fails boot if the UAT profile is activated. Other profile files only mention it in comments.
- `app.recviz.origin` is **absent from every** `application-*.properties` → `ConfigController` returns empty → RecViz embeds point at a dead `http://localhost:8000`.
- RecViz CORS is hardcoded to dev origins (`RecViz/backend/app/main.py:219`); its `RECVIZ_CORS_ALLOWED_ORIGINS` env var is never read.
- `AutosysDataSourceConfig` has no `get_password.sh` fallback (unlike primary/readonly DS) → empty password on a Citi VM.

## Blockers / Concerns

- RecViz embed is the highest-uncertainty integration — see open questions in `.planning/codebase/CURRENT-STATE-2026-06-12.md` §8.
- Security (`x-citiportal-loginid` enforcement, ES SSL, CORS prod list) is the production gate — Phase 9.

## History

Per-phase plans/summaries/decision-logs (Phases 0–8) are archived under `.planning/archive/`. New work uses `superpowers:writing-plans` and does not add to that history.

Last activity: 2026-06-12 (documentation reconciliation sweep — CLAUDE.md + `.planning/` + README + DEPLOY + codebase audits refreshed against verified code state).
