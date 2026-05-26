# Premium Search-Result Surface — Design Spec

**Date:** 2026-05-27
**Status:** Approved (brainstorm) — pending implementation plan
**Branch:** `milestone/modernization`
**Module:** `frontend-react` (React 19 + Vite 7 + AG-Grid v35.3 + shadcn/Tailwind v4 + TanStack) + a `backend/rectrace` config touch

> **Predecessor:** [`2026-05-26-grid-page-design.md`](./2026-05-26-grid-page-design.md) shipped the Angular-parity toolbar, drag-to-group, row-detail sheet, and shareable-view URL — but explicitly deferred *"deep grid-body styling … quartz-token palette … visual cohesion"* as the next milestone. **This spec is that milestone**, extended with three things that spec excluded: the AG-Grid **Theming API** migration, a **Motion** microinteraction layer, and a **config-driven dashboard panel** (recviz iframe) that can stand alone or share a tab with the grid.

---

## Goal

Make the React search-result surface **premium, refined, and "wow"** — through restraint (Stripe/Vercel lineage: airy spacing, soft depth, crisp type, one accent), purposeful microinteractions, and polished renderers — while reframing a "tab" from *"the grid"* into a **config-driven `ResultSurface`** that can compose a grid, a dashboard, or both.

## Why now

A near-future requirement: some tabs embed a **recviz dashboard** instead of, or alongside, the grid, and the deferred **TLM-stats / QuickRec-stats** renderers will *also* render recviz embeds. Both reduce to one primitive — **a recviz `<iframe>`** — so the surface and the renderer registry must be built to host it. Polishing the grid now, with that seam in place, avoids a second pass.

## Aesthetic direction

**Refined & airy** (Stripe / Vercel). Premium through restraint, not decoration. The **exact** palette, typography scale, surface/elevation values, and accent are chosen during implementation using the **`frontend-design` skill**, anchored to these constraints:

- Build on the existing **oklch CSS-variable tokens** (`--color-*`, light + dark via `.dark`). **No raw hex in TS/TSX** (ESLint `no-restricted-syntax`); tints via `color-mix(in oklab, var(--token) N%, transparent)`.
- Border-based depth over heavy shadows; cap shadows at two levels (popover, modal).
- One semantic accent (brand primary) for selection / focus / sort / active tab only — never borders, header bg, or zebra.
- `font-variant-numeric: tabular-nums` on data cells.
- Both themes must look deliberate; **fix** today's defects: invisible dark-mode borders, and hover-color == selected-color.

---

## Architecture

### 1. The `ResultSurface` reframe

`SearchPage.tsx` currently renders `<SearchGridPanel>` directly for the active category. It will instead render a new **`ResultSurface`** that composes **panels** declared in config. Three cases, all supported (nothing deferred):

| Case | Config | Render |
|---|---|---|
| **grid-only** (today) | has `columns`, no `dashboard` | `SearchGridPanel` (unchanged) |
| **grid + dashboard** | has `columns` **and** `dashboard` | `DashboardPanel` (collapsible header) **above** `SearchGridPanel`; grid keeps the visual weight; `defaultOpen` sets the header's initial state |
| **dashboard-only** | has `dashboard`, no/empty `columns` | `DashboardPanel` filling the whole surface (**no** collapsible header — that chrome is grid+dashboard only) |

```
CategoryTabBar
└─ ResultSurface (per active category; owns dashboard open/collapse state)
   ├─ DashboardPanel        (if category.dashboard present)
   │  └─ RecvizEmbed
   └─ SearchGridPanel       (if category has grid columns)
      ├─ GridToolbar
      ├─ SearchGrid
      └─ RowDetailSheet
```

### 2. Dashboard-only tab sourcing

Tabs today are sourced from search hits (each category carries a count from ES). A dashboard-only category has no search and no count, so:

- **Backend:** when assembling `/initial`, emit dashboard-bearing categories **unconditionally**. A category with a `dashboard` and no `elasticsearch`/`oracle` config skips the ES search and returns its metadata (label + `dashboard`) with a null/absent count.
- **Frontend:** `deriveSearchResults` **keeps** dashboard-bearing categories even when count is 0/absent (today it filters count-0 out). `CategoryTabBar` renders a dashboard tab with a **dashboard icon instead of a `(N)` count**. Ordering: dashboard-only tabs sort after counted grid tabs (or by a future config order — out of scope now).

### 3. `RecvizEmbed` — the reusable iframe primitive

One self-contained component (`src/search/RecvizEmbed.tsx`) used by the dashboard panel now and the deferred stats renderers later. Responsibilities:

- Skeleton placeholder → fade in on `onLoad` (Motion).
- `sandbox="allow-scripts allow-same-origin allow-forms allow-popups-to-escape-sandbox"`.
- **URL templating:** optional `{q}` placeholder in `dashboard.url` substituted with the current search term (used as-is if absent).
- Responsive height via `postMessage` (embed reports `scrollHeight`; host listens) with **strict `e.origin` validation** — never `'*'`.
- Theme handoff: `?theme=light|dark` on first load + `postMessage` on theme change.
- Error boundary with a **retry** affordance (and a clear message if the embed refuses framing).

> **Phase-4 dependency (not blocking this work):** a real recviz embed needs the Citi SSO/CSP contract — host `frame-src`, recviz `frame-ancestors`, and session cookie `SameSite=None; Secure`. The scaffold is verified against a **local placeholder embed page**; the real URL drops in via config later.

### 4. Config shape (config-driven, additive)

Per-category, in `search-config-v4.json`. **Absence of `dashboard` = grid-only, behavior unchanged.**

```jsonc
{
  "key": "jobName",
  "label": "Job Name",
  "searchColumn": "...",
  "elasticsearch": { ... },     // omit/empty for a dashboard-only category
  "oracle": { ... },            // omit/empty for a dashboard-only category
  "columns": [ ... ],           // omit/empty for a dashboard-only category
  "dashboard": {                 // NEW — optional
    "url": "https://recviz.example/embed/jobs?term={q}",
    "title": "Job summary",
    "defaultOpen": false,
    "height": 320
  }
}
```

Flow (unchanged path — the results page uses `/initial`, not `/config`):
`search-config-v4.json` → backend config POJO → `/initial` assembly → `CategoryResultV4` DTO → `GET /api/v4/search/initial` → `CategoryResultV4Schema` (Zod) → `ResultSurface`.

**Backend touch (in scope) — exact classes to be traced as the dashboard slice's first task (currently untraced):**
- `search-config-v4.json` — add the optional `dashboard` object; add one local-dev **grid+dashboard** category *and* one **dashboard-only** category (placeholder URLs) to exercise both.
- The **config POJO** that parses the JSON (likely needs the `dashboard` field).
- The `/initial` assembly service — emit dashboard-only categories without searching ES.
- `CategoryResultV4` Java DTO — carry `dashboard` through to `/initial`.

**A surface `layout` enum is intentionally deferred** (YAGNI). Only the `collapsible` (grid+dashboard) and full-surface (dashboard-only) compositions are built; a `layout` field can be added when a second arrangement is actually needed.

### 5. AG-Grid Theming API migration (foundation)

**Characterize before changing (systematic-debugging "gather evidence" first).** AG-Grid made the **Theming API the default in v33** (we're on 35.3); legacy themes now require *both* importing the CSS files *and* setting `theme="legacy"`. The audit found `className="ag-theme-quartz"` but **no `theme` grid option and (apparently) no legacy CSS import** — which means the grid is most likely **already rendering on the default Theming-API `themeQuartz`**, with our `.ag-theme-quartz { --ag-* }` block merely **cascading CSS variables** into it. So this is not a rip-and-replace; it's lifting ad-hoc overrides into a typed theme. **Migration slice step 1: confirm the actual current rendering** (CSS imported? `theme="legacy"`? what's applying?), then:

- **Add:** `src/search/lib/gridTheme.ts` exporting `themeQuartz.withParams({…}, 'light').withParams({…}, 'dark')`, **piping oklch tokens directly** (`accentColor: 'var(--color-primary)'`, etc. — `var()` is supported).
- **Remove/relocate:** the ad-hoc `.ag-theme-quartz { --ag-* }` overrides from `index.css` (now expressed as typed params) and the wrapper class; remove any legacy CSS import if present.
- **Wire:** `theme={gridTheme}` on `<AgGridReact>`; `data-ag-theme-mode={theme}` on the grid container, driven by the existing `ThemeProvider`.
- **Params for refined/airy:** generous `spacing`; `headerFontWeight: 500`; `rowHoverColor` subtle and **distinct** from `selectedRowBackgroundColor` (selected = `{ ref: 'accentColor', mix: ~0.12 }` + a left accent border via `withCSS`); `borderColor`/`rowBorder` subtle-but-visible in **both** themes; `columnBorder` off; `tabular-nums` via `withCSS` (lands grid-wide — harmless on text). Confirm the Theming API renders correctly with the current modular registration and no legacy CSS import.

### 6. Density (no new persistence)

Density (normal / compact) is driven by the **runtime grid options** `rowHeight` / `headerHeight` (cheap `setGridOption`), not by churning the theme `spacing` param — `spacing` stays one airy default in the theme object. Sensible starting heights for an airy-but-dense data grid: normal ~40 / header ~44, compact ~32 / header ~36 (tuned live with the frontend-design skill). **No localStorage persistence** — the shared `view` param stays the only non-default density source; a fresh search/tab is normal, as today.

### 7. Motion layer (chrome only)

Add `motion` (Framer Motion v11+).

- Wrap the search subtree in `<MotionConfig reducedMotion="user">`; use `LazyMotion features={domAnimation}` + `m.*` to keep the bundle lean. Coexists with the existing `tw-animate-css` entrance utilities (simple CSS) — Motion is for orchestrated chrome only; don't churn the current entrance animations.
- **Tab-content switch:** a **keyed fade-in entrance** on the incoming surface (opacity + small Y), **no blocking exit** — feels instant, preserves the existing `key={`${q}-${category.key}`}` remount and the share-view restore (the entrance wrapper must **not** re-key the grid). *(Explicitly not `AnimatePresence mode="wait"` — blocking exit stacks latency in front of a grid that already fetches.)*
- Spring for the collapsible dashboard header; subtle staggered entrance for toolbar groups / tab strip; icon-button hover/press microinteractions; animated active-tab indicator (`layout`).
- **Detail sheet:** keep the existing Radix/shadcn `Sheet` CSS slide — do **not** wrap it in Motion (avoid double-animation).
- **Hard rule:** never wrap AG-Grid rows/cells/overlays in `motion.*` (breaks virtualization). All in-grid microinteractions (row hover, selection, sort chevron, group expand) come from the Theming API params + AG-Grid built-ins.

---

## Polish targets (per component)

| Surface | Polish |
|---|---|
| **GridToolbar** | Add left-side context: category label + result count (= `category.count`, same source as the tabs) + active-filter badge (derived from `filterModel`). Clearer group segmentation; hover/press microinteractions. Keep all 13 actions. |
| **CategoryTabBar** | Sliding animated active indicator; refined count `Badge`; dashboard tabs show a dashboard icon instead of a count; hover microinteraction. |
| **SearchGrid** | Header chrome + medium weight; row hover ≠ selected; selected = accent tint + left border; tabular-nums; polished group rows + sort-chevron rotation; visible-subtle borders in both themes; a **refined loading treatment** (skeleton/overlay — exact mechanism, grid `loadingOverlayComponent` vs SSRM `loadingCellRenderer`, decided in impl); explicit polished **empty** + **error** states. |
| **RowDetailSheet** | Title shows category + the **search/rowGroup column's value**; group visible vs hidden fields; copy-cell affordance; de-emphasize empty/null fields. (Keep Radix slide animation.) |
| **DashboardPanel** | Collapsible header chrome (title + expand/collapse) for grid+dashboard; full-surface for dashboard-only; a lightweight **copy-link** control on the header so a gridless tab is still shareable. |
| **Renderers** | Refine the 3 existing (AppID anchor, SupportEmail mailto, ExecutionOrder button). Establish the green **"expand-on-hover" link** style as a shared primitive (ready for the deferred stats renderers). **Make the AppID URL config-driven** via `cellRendererParams` (a URL template) — remove the hardcoded LinkedIn placeholder; the real Citi app-portal URL is **`[NEEDS USER INPUT]`**, supplied via config. |

---

## Shareable view changes

The Share button serializes grid state into the `view` URL param and copies the link.

- `GridViewState` gains **`dashboardOpen?: boolean`**. For a grid+dashboard tab, `onShare` captures the current collapse state; on load it restores the header's open/closed state. **Backward-compatible:** `decodeViewState` defaults `dashboardOpen` to the config's `defaultOpen` when absent.
- The dashboard open/collapse state lifts to `ResultSurface` (which owns it) so `onShare` (in `SearchGridPanel`) can read it — minor plumbing: `ResultSurface` passes the state + setter down.
- **Dashboard-only tabs** have no grid state and no `GridToolbar`; sharing relies on the deep-linkable `q`+`tab` URL, surfaced via the `DashboardPanel` header **copy-link** control.

---

## Build order (incremental — push after each slice)

1. **Theming API migration** — characterize current state, then lift overrides into a typed `themeQuartz.withParams()` theme; light + dark, refined/airy params, density via grid options. (Frontend-design skill picks values.)
2. **Motion foundation + chrome microinteractions** — `MotionConfig`/`LazyMotion`, keyed fade-in tab switch, toolbar + tab-strip polish.
3. **Grid + renderer visual polish** — header/rows/hover/selection/group/loading/empty/error + the 3 renderers + the shared link primitive + config-driven AppID URL + RowDetailSheet polish.
4. **Dashboard scaffold (incl. dashboard-only)** — config field + backend config POJO/DTO/`/initial` emission + Zod + `deriveSearchResults` keep + `CategoryTabBar` dashboard tab + `RecvizEmbed` + `DashboardPanel` (collapsible & full-surface) + `ResultSurface` composition + Share `dashboardOpen`; verified against local placeholder embeds.

Each slice is independently shippable and verified before the next.

---

## Testing strategy (TDD)

**Frontend:**
- **Zod schema** — accepts the optional `dashboard` object; absence ⇒ grid-only; malformed URL rejected.
- **`deriveSearchResults`** — keeps dashboard-bearing categories with no count; still drops count-0 grid categories.
- **`ResultSurface`** — branches correctly: grid-only, grid+dashboard (collapsible header above grid), dashboard-only (full surface, no header).
- **`RecvizEmbed`** — ignores wrong-origin messages; applies height/theme only on valid-origin messages; substitutes `{q}`; renders skeleton until `onLoad`; shows retry on error.
- **`DashboardPanel`** — collapse/expand; honors `defaultOpen`; copy-link copies the deep-link URL.
- **`gridTheme`** — `withParams` produces the expected light/dark param objects (tokens wired to the right params).
- **Share round-trip** — `dashboardOpen` encodes/decodes; absent ⇒ `defaultOpen`.
- **`GridToolbar`** — left-context (label/count/filter badge) renders; existing button-callback tests stay green.
- **`SearchPage`** — update mocks for the `ResultSurface` insertion; existing tab/no-results tests stay green.
- **Live** — Playwright on real seed terms (`recon`, `SUBACC`, `SETID`, `trade`), light + dark, before each push.

**Backend (test gate is closed — `mvn test` runs):**
- `dashboard` config round-trips into the `/initial` response; a dashboard-only category appears in `/initial` without an ES search; keep `@Profile("!test")` wiring intact and existing tests green.

---

## Constraints (carried, non-negotiable)

- **Config-driven** — never hardcode columns, renderer keys, category metadata, or dashboard URLs in React.
- **No raw hex** in TS/TSX — oklch tokens / `color-mix` only.
- **AG-Grid license set before `registerModules`**; confirm the Theming API works with the current modular registration (theming is core in v33+, no legacy CSS import).
- **`getRowId`** stays on stable business keys.
- **Motion never on grid rows/cells.**

## Risks / open items

- **Theming current-state** — must characterize what's actually rendering before migrating (likely Theming-API-default already); first task of slice 1.
- **Backend mapping path untraced** — the config POJO / `/initial` assembly / `CategoryResultV4` classes must be located before the dashboard slice; the config POJO likely also needs the `dashboard` field.
- **recviz contract (Phase 4)** — real embed blocked on SSO/CSP/cookie coordination; scaffold uses local placeholders, real URLs are config-only later.
- **AppID URL** — real Citi app-portal URL is `[NEEDS USER INPUT]`.

## Deferred (explicitly out of scope here)

- TLM-stats / QuickRec-stats renderers (will reuse `RecvizEmbed` in a sheet/dialog) — **after** this grid-design milestone.
- The real recviz SSO/CSP integration (Phase 4).
- A second surface `layout` (split / sub-tabs / stacked) and config-driven tab ordering — only `collapsible` + full-surface now.
