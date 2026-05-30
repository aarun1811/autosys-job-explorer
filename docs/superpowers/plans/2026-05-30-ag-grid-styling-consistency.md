# AG-Grid Styling Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring rectrace's AG-Grid v35 visual standard to RecViz's dashboard grids, plus add a Gmail-inspired hover hairline to rectrace as the new shared standard.

**Architecture:** Two sequential parts across two repos. Part A: one-CSS-rule addition to rectrace's existing `gridTheme.ts` + test assertion. Part B: Geist app-wide font migration in RecViz, new mirror-of-rectrace `grid-theme.ts` (scoped, density-preserving), wire into three grid sites with `data-ag-theme-mode`, delete legacy `.ag-theme-quartz` CSS bridge.

**Tech Stack:** AG-Grid v35 Theming API (community + enterprise), Tailwind v4 with shadcn oklch tokens, React 19, Vite 7, Vitest, TanStack Router/Query, Geist Variable font via `@fontsource-variable/geist` and `@fontsource-variable/geist-mono`. Playwright MCP for runtime verification.

**Spec reference:** `docs/superpowers/specs/2026-05-30-ag-grid-styling-consistency-design.md` (v3, rectrace `9b09c2a`).

**Standing rules** (apply to every task):
- Direct-to-`main` commits per task. No feature branches.
- Co-Authored-By footer on every commit: `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>`.
- No raw hex literals in TS/TSX. Use `var(--…)` / `color-mix(in oklab, ...)`. Both repos have an ESLint rule that catches new hex.
- After each task: `feature-dev:code-reviewer` subagent pass before commit (per CLAUDE.md). Standing convention in this session.
- Live stack is up: rectrace dev `:5173`, RecViz uvicorn `:8000`, Oracle `:1521`, ES `:9200`, rectrace backend `:6088`. Use it for runtime verification.

**Sequencing:** Tasks 1-3 (rectrace) MUST complete and ship before Tasks 4+ (RecViz) start. Part A's hover hairline is the visual reference for Part B's port.

---

## File Structure

### Rectrace files

| Path | Action |
|---|---|
| `frontend-react/src/search/__tests__/gridTheme.test.ts` | Modify — add `.ag-row-hover` assertion in the existing "injects the body-treatment CSS" test |
| `frontend-react/src/search/lib/gridTheme.ts` | Modify — append two CSS rules to `gridBodyPart` (`.ag-row-hover` + combined `.ag-row-hover.ag-row-selected`) and a mirror-comment banner pointing at RecViz |

### RecViz files

| Path | Action |
|---|---|
| `frontend/package.json` | Modify — add `@fontsource-variable/geist`, `@fontsource-variable/geist-mono` deps |
| `frontend/src/main.tsx` | Modify — add two Geist imports before `./index.css` |
| `frontend/index.html` | Modify — remove three lines: two Google-Fonts preconnect `<link>` tags + the Inter Google-Fonts `<link>` |
| `frontend/src/index.css` | Modify — add `--font-sans` / `--font-mono` tokens to `@theme inline`; swap body `font-family` literal; delete legacy `.ag-theme-quartz {...}` block |
| `frontend/src/lib/grid-theme.ts` | Create — new file: port of rectrace's `gridTheme.ts` (scoped, density-preserving); includes the new hover hairline rules ported from Part A |
| `frontend/src/components/dashboard/config-data-grid.tsx` | Modify — TWO grid sites (`SingleSourceGrid` ~line 80, `MergedSourceGrid` ~line 222). Replace per-render `themeQuartz.withPart(colorSchemeDark)` ternary with static `gridTheme` import; add `data-ag-theme-mode` to existing height-styled `<div>` wrapper |
| `frontend/src/components/dashboard/drill-detail-grid.tsx` | Modify — same pattern as the two `config-data-grid` sites |

---

## Part A — Rectrace hover hairline (single repo)

### Task 1: Rectrace test assertion for `.ag-row-hover` (TDD red)

**Files:**
- Modify: `frontend-react/src/search/__tests__/gridTheme.test.ts:43-48`

- [ ] **Step 1: Add the failing assertion**

Open `frontend-react/src/search/__tests__/gridTheme.test.ts`. Locate the test block at lines 43-48:

```ts
  it('injects the body-treatment CSS via the custom part', () => {
    const json = JSON.stringify(gridTheme)
    expect(json).toContain('font-variant-numeric: tabular-nums')
    expect(json).toContain('.ag-row-selected')
    expect(json).toContain('.ag-row-group-expanded')
  })
```

Add two assertions for the new hover rules (in the same `it()` block to keep related assertions together):

```ts
  it('injects the body-treatment CSS via the custom part', () => {
    const json = JSON.stringify(gridTheme)
    expect(json).toContain('font-variant-numeric: tabular-nums')
    expect(json).toContain('.ag-row-selected')
    expect(json).toContain('.ag-row-group-expanded')
    // Gmail-inspired hover hairline (single-state) + combined hover+selected
    // composition (CSS does not auto-compose two separate box-shadow
    // declarations — the combined .ag-row-hover.ag-row-selected selector
    // is required so the primary left-edge stays visible on hovered-selected
    // rows).
    expect(json).toContain('.ag-row-hover')
    expect(json).toContain('.ag-row-hover.ag-row-selected')
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/aarun/Workspace/Projects/autosys-job-explorer/frontend-react && pnpm test --run src/search/__tests__/gridTheme.test.ts`

Expected: FAIL with two assertion errors:
```
Expected substring: ".ag-row-hover"
Received string: <existing JSON without .ag-row-hover>

Expected substring: ".ag-row-hover.ag-row-selected"
Received string: <existing JSON without combined selector>
```

If you see "PASS" instead, something is off — STOP and re-read the source before proceeding.

- [ ] **Step 3: Commit the failing test**

```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer
git add frontend-react/src/search/__tests__/gridTheme.test.ts
git commit -m "$(cat <<'EOF'
test(gridTheme): assert .ag-row-hover + combined selector CSS (red)

Locks in the spec'd behavior:
  - .ag-row-hover gets the Gmail-inspired top + bottom hairlines
  - .ag-row-hover.ag-row-selected combined selector composes the
    primary left-edge with the hairlines (single box-shadow
    declaration with three stops — CSS does not auto-compose
    declarations from different selectors)

Implementation lands in Task 2.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

DO NOT push yet — pushes happen after Task 2 (green) so the remote always has a passing main.

---

### Task 2: Rectrace CSS rule addition (TDD green)

**Files:**
- Modify: `frontend-react/src/search/lib/gridTheme.ts` (the `gridBodyPart` CSS string at lines 22-89)

- [ ] **Step 1: Read the current CSS block**

Open `frontend-react/src/search/lib/gridTheme.ts`. Locate the `gridBodyPart = createPart({ css: \`...\` })` block at lines 22-89.

Identify the existing `.ag-row` transition rule at line 29 (immediately after the `.ag-group-value` rule):
```css
.ag-row { transition: background-color 120ms ease; }
```

And the existing `.ag-row-selected` rule at line 31:
```css
.ag-row-selected { box-shadow: inset 2px 0 0 0 var(--color-primary); }
```

These are the right neighbours — append the new rules immediately after `.ag-row-selected`.

- [ ] **Step 2: Append the two new CSS rules**

After the `.ag-row-selected` line, insert these two rules:

```css
/* Gmail-inspired hover hairline: bright top + bottom edges that read brighter
   than the default 7% row border. The foreground-tinted hairline switches
   automatically across light + dark via the var() cascade. The existing 6%
   primary rowHoverColor (set via .withParams) stays — it provides the BG
   lift; this rule adds the edge emphasis. */
.ag-row-hover {
  box-shadow:
    inset 0 1px 0 0 color-mix(in oklab, var(--color-foreground) 20%, transparent),
    inset 0 -1px 0 0 color-mix(in oklab, var(--color-foreground) 20%, transparent);
}
/* Hovered + selected: CSS does NOT compose two separate box-shadow declarations
   (later cascade winner replaces, not adds). Declare the combined effect
   explicitly so the user sees the primary left-edge AND the hover hairlines
   together. The combined selector has higher specificity (two classes) than
   each single-class rule and wins the cascade for the hovered-and-selected
   state. */
.ag-row-hover.ag-row-selected {
  box-shadow:
    inset 2px 0 0 0 var(--color-primary),
    inset 0 1px 0 0 color-mix(in oklab, var(--color-foreground) 20%, transparent),
    inset 0 -1px 0 0 color-mix(in oklab, var(--color-foreground) 20%, transparent);
}
```

- [ ] **Step 3: Add mirror-comment banner**

At the very top of `gridTheme.ts` (after the existing JSDoc block ending at line 20), add this banner:

```ts
/**
 * MIRROR FILE: `RecViz/frontend/src/lib/grid-theme.ts`
 *
 * Sync rule (best-effort, no CI enforcement):
 *  - Visual params (colors, borders, hover/selected, header chrome) are kept
 *    in lockstep with the RecViz mirror. Any change here SHOULD also be
 *    applied there, and vice-versa.
 *  - Density params (fontSize, headerFontSize, cellHorizontalPadding,
 *    spacing, iconSize) are DELIBERATELY divergent — rectrace runs the
 *    tighter custom values below; RecViz runs Quartz defaults.
 *  - CSS rules in gridBodyPart are rectrace-specific in places (row-group
 *    panel, sidebar tabs, group rows). The RecViz mirror skips those.
 *
 * When this file changes, audit the mirror. Drift is reviewed during
 * quarterly design audits if not caught earlier in normal PR review.
 */
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /Users/aarun/Workspace/Projects/autosys-job-explorer/frontend-react && pnpm test --run src/search/__tests__/gridTheme.test.ts`

Expected output last line:
```
Test Files  1 passed (1)
     Tests  5 passed (5)
```

All 5 `it()` blocks pass — including the two new assertions added in Task 1.

- [ ] **Step 5: Run typecheck + lint to ensure no regression**

Run: `cd /Users/aarun/Workspace/Projects/autosys-job-explorer/frontend-react && pnpm typecheck && pnpm lint src/search/lib/gridTheme.ts`

Expected: typecheck clean. Lint shows no NEW errors on `gridTheme.ts` (rectrace has a baseline of 6 pre-existing errors elsewhere — that's fine; the changed file should be clean).

- [ ] **Step 6: Commit**

```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer
git add frontend-react/src/search/lib/gridTheme.ts
git commit -m "$(cat <<'EOF'
feat(gridTheme): Gmail-inspired row-hover hairline (green)

Adds two CSS rules to gridBodyPart:
  - .ag-row-hover: top + bottom inset hairlines via box-shadow,
    foreground-tinted at 20% (switches automatically light/dark)
  - .ag-row-hover.ag-row-selected: combined selector with three
    shadow stops (left-edge primary + top + bottom hairlines) so
    the hover state composes with the selected indicator instead
    of clobbering it (CSS does not auto-compose declarations from
    different selectors — combined selector required)

Mirror-comment banner added at file top pointing at the RecViz
mirror at frontend/src/lib/grid-theme.ts (lands in Part B).

Tests from Task 1 now pass: gridTheme.test.ts asserts both class
selectors are present in the serialised theme.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

### Task 3: Rectrace runtime visual verification

**Files:**
- Read-only verification — no edits. Save screenshots to `docs/superpowers/handoff/`.

- [ ] **Step 1: Confirm rectrace dev server is up**

Run: `curl -sI http://localhost:5173 | head -1`
Expected: `HTTP/1.1 200 OK`. If not, the live stack is down — flag and STOP.

- [ ] **Step 2: Trigger a HMR refresh of the gridTheme**

The Vite dev server hot-reloads on save (already happened during edit). Confirm by checking the most recent Vite log line:
Run: `tail -5 /tmp/react-dev.log 2>/dev/null | grep -i hmr | tail -3`
Expected: a recent HMR update log mentioning `gridTheme.ts`. If you don't see it, save the file again to trigger HMR.

- [ ] **Step 3: Use Playwright MCP — navigate to rectrace search and verify hover**

Use the Playwright MCP tools available in this session:
1. `mcp__plugin_playwright_playwright__browser_navigate` to `http://localhost:5173/search?q=TLMP_CONSUMER&tab=tlmInstance`
2. Wait for grid (`mcp__plugin_playwright_playwright__browser_wait_for` for text "TLMP_CONSUMER")
3. Expand the group row (find `.ag-group-contracted`, click via `browser_evaluate`).
4. Hover the FIRST leaf row using `browser_evaluate`:
   ```js
   () => {
     const firstLeaf = document.querySelector('[role="row"]:not(.ag-row-group)')
     if (!firstLeaf) return 'no leaf'
     firstLeaf.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
     firstLeaf.classList.add('ag-row-hover')  // simulate AG-Grid's class-add on hover
     return 'hovered'
   }
   ```
5. Take a screenshot: `browser_take_screenshot` with `filename: 'taskA3-rectrace-hover-light.png'`.
6. Inspect the computed `box-shadow`:
   ```js
   () => {
     const row = document.querySelector('.ag-row-hover')
     return row ? getComputedStyle(row).boxShadow : 'no hover row'
   }
   ```
   Expected: a value containing two `inset 0px 1px 0px 0px` / `inset 0px -1px 0px 0px` stops (the top + bottom hairlines). Color values are oklch-mixed; exact string varies by browser but the presence of two inset stops is the signal.

- [ ] **Step 4: Verify hover + selected composition**

Add the `.ag-row-selected` class to the same row (still hovered) via `browser_evaluate`:
```js
() => {
  const row = document.querySelector('.ag-row-hover')
  if (!row) return 'no row'
  row.classList.add('ag-row-selected')
  const cs = getComputedStyle(row).boxShadow
  return cs
}
```

Expected: the returned `boxShadow` value contains THREE stops: one `inset 2px 0px 0px 0px` (primary left-edge) + two `inset 0px 1px 0px 0px` and `inset 0px -1px 0px 0px` (top + bottom hairlines). If you see only ONE stop, the combined selector didn't win the cascade — debug before continuing.

Screenshot: `taskA3-rectrace-hover-selected-light.png`.

- [ ] **Step 5: Repeat in dark mode**

Toggle dark via the rectrace theme toggle button OR navigate with `?theme=dark` if supported. Use `browser_evaluate` to switch:
```js
() => {
  document.documentElement.classList.add('dark')
  return document.documentElement.className
}
```

Repeat steps 3-4 and capture screenshots: `taskA3-rectrace-hover-dark.png` and `taskA3-rectrace-hover-selected-dark.png`.

Verify the hairlines read against the dark row background (should be a brighter light-tinted line, since `var(--color-foreground)` flips light in dark mode).

- [ ] **Step 6: Move screenshots into handoff dir**

```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer
mv frontend-react/taskA3-rectrace-hover-*.png docs/superpowers/handoff/ 2>/dev/null || mv taskA3-rectrace-hover-*.png docs/superpowers/handoff/
ls docs/superpowers/handoff/taskA3-*.png
```

Expected: 4 files (light + dark, hover + hover-selected).

- [ ] **Step 7: Commit screenshots + close Part A**

```bash
git add docs/superpowers/handoff/taskA3-*.png
git commit -m "$(cat <<'EOF'
docs(handoff): Part A runtime evidence — rectrace hover hairline

Screenshots verify the Gmail-inspired hover hairline + combined
selector composition in both light and dark modes:
  - taskA3-rectrace-hover-light.png
  - taskA3-rectrace-hover-selected-light.png
  - taskA3-rectrace-hover-dark.png
  - taskA3-rectrace-hover-selected-dark.png

Part A closed. Part B (RecViz modernization) starts next.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Part B — RecViz modernization (RecViz repo)

### Task 4: RecViz Geist install + main.tsx import

**Files:**
- Modify: `RecViz/frontend/package.json`
- Modify: `RecViz/frontend/src/main.tsx`

- [ ] **Step 1: Add the two Geist packages**

```bash
cd /Users/aarun/Workspace/Projects/RecViz/frontend
pnpm add @fontsource-variable/geist @fontsource-variable/geist-mono
```

Expected output last lines: both packages added to `dependencies` in `package.json`; pnpm reports `+ @fontsource-variable/geist X.Y.Z` and `+ @fontsource-variable/geist-mono X.Y.Z`. `pnpm-lock.yaml` updated.

If the install fails with `ERR_PNPM_*`, run `pnpm install` first to refresh state, then retry.

- [ ] **Step 2: Add imports to main.tsx BEFORE `./index.css`**

Open `RecViz/frontend/src/main.tsx`. Current contents (relevant lines 1-7):
```ts
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ModuleRegistry as ChartModuleRegistry, AllEnterpriseModule as AllChartsEnterpriseModule } from 'ag-charts-enterprise'
import { ModuleRegistry as GridModuleRegistry } from 'ag-grid-community'
import { AllEnterpriseModule } from 'ag-grid-enterprise'
import './index.css'
import App from './App'
```

Insert TWO new import lines immediately BEFORE `import './index.css'` (so the `@font-face` declarations register before any CSS that references them):

```ts
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ModuleRegistry as ChartModuleRegistry, AllEnterpriseModule as AllChartsEnterpriseModule } from 'ag-charts-enterprise'
import { ModuleRegistry as GridModuleRegistry } from 'ag-grid-community'
import { AllEnterpriseModule } from 'ag-grid-enterprise'
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import './index.css'
import App from './App'
```

- [ ] **Step 3: Typecheck + build**

```bash
cd /Users/aarun/Workspace/Projects/RecViz/frontend
./node_modules/.bin/tsc -b --noEmit
./node_modules/.bin/vite build
```

Expected: tsc clean. vite build succeeds; `dist/` regenerates. New woff2 assets appear under `dist/assets/*.woff2` (Geist variable font files).

Confirm via:
```bash
ls dist/assets/*.woff2 | head -10
du -sh dist/
```
Expected: woff2 files present (Geist variable + Geist Mono variable). Bundle size up ~80KB from the previous build.

- [ ] **Step 4: Commit**

```bash
cd /Users/aarun/Workspace/Projects/RecViz
git add frontend/package.json frontend/pnpm-lock.yaml frontend/src/main.tsx
git commit -m "$(cat <<'EOF'
chore(font): install + import Geist Variable + Geist Mono Variable

Adds @fontsource-variable/geist and @fontsource-variable/geist-mono
as dependencies. Imports them in main.tsx BEFORE ./index.css so the
@font-face declarations register before CSS that references them.

Tokens themselves wire in the next task — this commit only loads
the fonts. Tailwind font-sans / font-mono utilities still resolve
to defaults at this point (no token bridge yet).

Bundle delta: ~80KB confined to woff2 assets in dist/.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

### Task 5: RecViz Inter removal + Geist tokens in `@theme inline`

**Files:**
- Modify: `RecViz/frontend/index.html`
- Modify: `RecViz/frontend/src/index.css`

- [ ] **Step 1: Remove three lines from `index.html`**

Open `RecViz/frontend/index.html`. Lines 7-9 currently:
```html
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap" rel="stylesheet">
```

(Exact text may vary slightly — match the substance. The 3 lines are: two preconnects to Google Fonts + the Inter family link.)

Delete all three. No replacement — Geist is now loaded via `@fontsource-variable/geist` in `main.tsx` (Task 4).

- [ ] **Step 2: Add `--font-sans` and `--font-mono` tokens to `@theme inline`**

Open `RecViz/frontend/src/index.css`. Locate the `@theme inline { ... }` block at lines 7-59 (approximate — find the literal `@theme inline {`).

Add these two lines inside the block, mirroring rectrace's `frontend-react/src/index.css:11-12`:

```css
  --font-sans: "Geist Variable", system-ui, sans-serif;
  --font-mono: "Geist Mono Variable", ui-monospace, "SF Mono", Menlo, monospace;
```

Place them alongside the other `--color-*` / `--*` token assignments in the block, ideally near the top (after `--color-background` / `--color-foreground` for grouping clarity). Match the existing indent style (2 spaces).

- [ ] **Step 3: Update the body font-family literal**

Still in `RecViz/frontend/src/index.css`. Find the rule (around line 182 in current source — search for `font-family: "Inter"`):

```css
body {
  font-family: "Inter", system-ui, sans-serif;
  /* ... other body rules ... */
}
```

Change the literal:

```css
body {
  font-family: "Geist Variable", system-ui, sans-serif;
  /* ... other body rules untouched ... */
}
```

Only the `font-family` line changes. Other body rules (color, anti-aliasing, etc) stay.

- [ ] **Step 4: Verify no other Inter literals**

```bash
cd /Users/aarun/Workspace/Projects/RecViz/frontend
grep -rn '"Inter"' src/ index.html
```

Expected: only `src/index.css` lines remaining have the literal "Inter" — and those are inside the `.ag-theme-quartz {...}` block that Task 11 will delete entirely. If you see "Inter" anywhere else (eg in a component .tsx), surface it as an unexpected case before continuing.

- [ ] **Step 5: Typecheck + build**

```bash
./node_modules/.bin/tsc -b --noEmit
./node_modules/.bin/vite build
```

Expected: both clean. `dist/` regenerates.

- [ ] **Step 6: Commit**

```bash
cd /Users/aarun/Workspace/Projects/RecViz
git add frontend/index.html frontend/src/index.css
git commit -m "$(cat <<'EOF'
feat(font): make Geist app-wide via @theme tokens + body literal

Three edits land the Geist migration:
  - index.html: remove orphan preconnects + Inter Google-Fonts link
  - index.css @theme inline: ADD --font-sans + --font-mono tokens
    (mirrors rectrace index.css:11-12). RecViz didn't have these
    tokens defined before — without them Tailwind v4's font-sans /
    font-mono utilities would resolve to ui-sans-serif / ui-monospace
    and the 15+ font-mono callsites (column-metadata-grid,
    kpi-builder, chart-builder-preview, data-source-sheet, etc)
    would silently stay on system mono after Geist install.
  - index.css body: font-family literal Inter → Geist Variable.

Tailwind font-sans + font-mono utilities now resolve through these
tokens. App-wide font sweep happens in the next task.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

### Task 6: RecViz Geist app-wide smoke test (visual sweep, light + dark)

**Files:**
- Read-only verification. Save screenshots to `docs/superpowers/handoff/` if anything reflows weirdly.

- [ ] **Step 1: Confirm RecViz uvicorn is serving the new `dist/`**

RecViz uvicorn auto-serves whatever is in `frontend/dist/` via StaticFiles. The build from Task 5 already updated it.

Sanity:
```bash
curl -sI http://localhost:8000/ | head -3
curl -s http://localhost:8000/ | grep -oE 'index-[A-Za-z0-9_-]+\.js' | head -1
```
Expected: 200 OK + a new bundle hash (different from the pre-Task-4 hash).

- [ ] **Step 2: Visit each surface (Playwright MCP) in LIGHT mode**

Use `mcp__plugin_playwright_playwright__browser_navigate` for each URL. After each navigate, snapshot the page with `browser_snapshot` (limit depth so it's fast) and visually scan for: (a) Geist-style letterforms (slightly more geometric than Inter; characteristic "a" with a single-story design at default weight), (b) any obvious reflow / clipping / wrapping anomalies.

URLs to visit (LIGHT mode):
- `http://localhost:8000/dashboards` (dashboard list)
- `http://localhost:8000/dashboards/dash-tlm-stats?filter.tlm_instance=TLMP_CONSUMER` (standalone TLM dashboard)
- `http://localhost:8000/dashboards/dash-quickrec-stats` (standalone QuickRec dashboard)
- `http://localhost:8000/embed/dashboards/dash-tlm-stats?filter.tlm_instance=TLMP_CONSUMER&filter.recon=RECON-COMMOD-APAC-000052&filter.set_id=LACC_000052&filter.lock=tlm_instance,recon,set_id` (embed mode locked)
- `http://localhost:5173/search?q=TLMP_CONSUMER&tab=tlmInstance` then click a leaf row's set_id button → the embedded RecViz modal opens (smoke the cell-click flow)
- `http://localhost:8000/datasets` (admin: dataset list)
- `http://localhost:8000/explorer` (admin: query results)
- `http://localhost:8000/connections` (admin: connection settings)

For EACH URL, capture one screenshot via `browser_take_screenshot` named `task6-light-<surface>.png` (e.g. `task6-light-dashboards.png`).

- [ ] **Step 3: Repeat in DARK mode**

Toggle via the topbar theme button OR `browser_evaluate`:
```js
() => { document.documentElement.classList.add('dark'); return 'dark on' }
```

Re-visit the same URL set. Capture `task6-dark-<surface>.png` for each.

- [ ] **Step 4: Inspect for reflow issues**

Look for: button text wrapping to 2 lines, KPI numbers overflowing tiles, table headers truncating differently, chart axis labels overlapping. If you see any:
- If trivial (eg one button wrapping): note in handoff doc, possibly tighten copy in a future task.
- If load-bearing (eg dashboard layout breaks): STOP and surface it before continuing.

- [ ] **Step 5: Confirm `font-mono` actually picks up Geist Mono**

In the browser console at `/explorer`:
```js
getComputedStyle(document.querySelector('.font-mono') || document.querySelector('[class*="font-mono"]')).fontFamily
```
Expected: contains `"Geist Mono Variable"`. If it shows `ui-monospace` or similar, the token wiring didn't take — debug Task 5 before proceeding.

- [ ] **Step 6: Move screenshots into handoff dir + commit**

```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer
find . -maxdepth 3 -name "task6-*.png" -not -path "*/node_modules/*" -exec mv {} docs/superpowers/handoff/ \;
ls docs/superpowers/handoff/task6-*.png | wc -l
```
Expected: 16 screenshots (8 surfaces × 2 modes).

```bash
git add docs/superpowers/handoff/task6-*.png
git commit -m "$(cat <<'EOF'
docs(handoff): Task 6 evidence — Geist app-wide smoke sweep

8 surfaces × 2 modes (light + dark) = 16 screenshots verifying
Geist Variable renders across:
  - Dashboard list + 2 standalone dashboards + embed modal
  - rectrace search → cell-click flow (cross-app continuity)
  - 3 admin surfaces (datasets, explorer, connections)

font-mono callsites confirmed resolving to Geist Mono Variable
via computed-style check in /explorer.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

### Task 7: RecViz new `lib/grid-theme.ts` file

**Files:**
- Create: `RecViz/frontend/src/lib/grid-theme.ts`

- [ ] **Step 1: Create the directory if it doesn't exist**

```bash
mkdir -p /Users/aarun/Workspace/Projects/RecViz/frontend/src/lib
ls /Users/aarun/Workspace/Projects/RecViz/frontend/src/lib
```

(If `lib/` already exists with other files, that's fine — they coexist.)

- [ ] **Step 2: Write the full file**

Create `/Users/aarun/Workspace/Projects/RecViz/frontend/src/lib/grid-theme.ts` with the following exact contents:

```ts
import { createPart, themeQuartz } from 'ag-grid-community'

/**
 * AG-Grid v35 Theming-API theme for RecViz dashboard grids.
 *
 * MIRROR FILE: `autosys-job-explorer/frontend-react/src/search/lib/gridTheme.ts`
 *
 * Sync rule (best-effort, no CI enforcement):
 *  - Visual params (colors, borders, hover/selected, header chrome) are kept
 *    in lockstep with rectrace's gridTheme.ts. Any change here SHOULD also
 *    be applied there, and vice-versa.
 *  - Density params (fontSize, headerFontSize, cellHorizontalPadding,
 *    spacing, iconSize) are deliberately SKIPPED here — RecViz uses Quartz
 *    defaults to preserve current row density.
 *  - CSS rules in the gridBodyPart are SCOPED to rules that apply to flat
 *    dashboard grids: rectrace-only rules for row-group panel, sidebar
 *    tabs, group rows, and auto-group cells are NOT mirrored.
 *
 * When rectrace's gridTheme.ts changes, audit this file. Drift is reviewed
 * during quarterly design audits if not caught earlier.
 *
 * Params reference shadcn oklch CSS variables directly so the grid follows
 * the .dark cascade automatically — no JS-level theme switching needed. The
 * grid container in each dashboard grid component carries
 * data-ag-theme-mode={resolvedTheme} so AG-Grid's own popups and
 * scrollbars pick the right scheme (see config-data-grid.tsx +
 * drill-detail-grid.tsx).
 */

const gridBodyPart = createPart({
  css: `.ag-cell { font-variant-numeric: tabular-nums; }
.ag-row { transition: background-color 120ms ease; }
.ag-row-selected { box-shadow: inset 2px 0 0 0 var(--color-primary); }
/* Gmail-inspired hover hairline (mirror of rectrace gridBodyPart). The
   single-state rule + the combined hover+selected rule together preserve
   the selected left-edge AND the hover hairlines on a hovered-selected
   row — CSS does not auto-compose two separate box-shadow declarations. */
.ag-row-hover {
  box-shadow:
    inset 0 1px 0 0 color-mix(in oklab, var(--color-foreground) 20%, transparent),
    inset 0 -1px 0 0 color-mix(in oklab, var(--color-foreground) 20%, transparent);
}
.ag-row-hover.ag-row-selected {
  box-shadow:
    inset 2px 0 0 0 var(--color-primary),
    inset 0 1px 0 0 color-mix(in oklab, var(--color-foreground) 20%, transparent),
    inset 0 -1px 0 0 color-mix(in oklab, var(--color-foreground) 20%, transparent);
}
.ag-header-cell-text { letter-spacing: 0.005em; }
.ag-header-cell-resize::after { opacity: 0; transition: opacity 120ms ease; }
.ag-header-cell:hover .ag-header-cell-resize::after { opacity: 1; }
/* filter popup polish — RecViz dashboards enable column filters via
   DEFAULT_COL_DEF.filter: true in config-data-grid.tsx + drill-detail-grid.tsx */
.ag-filter-apply-panel-button { border-radius: 7px; font-weight: 550; transition: filter 120ms ease, background-color 120ms ease; }
.ag-filter-apply-panel-button:last-child {
  background: var(--color-primary); color: var(--color-primary-foreground);
  border-color: transparent;
}
.ag-filter-apply-panel-button:last-child:hover { filter: brightness(1.06); }
.ag-filter-apply-panel-button:not(:last-child) {
  background: transparent; color: var(--color-foreground);
  border: 1px solid var(--color-border);
}
.ag-filter-apply-panel-button:not(:last-child):hover { background: color-mix(in oklab, var(--color-foreground) 7%, transparent); }
.ag-filter .ag-input-field-input:focus,
.ag-filter .ag-picker-field-wrapper:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px color-mix(in oklab, var(--color-primary) 22%, transparent);
}`,
})

export const gridTheme = themeQuartz
  .withParams({
    accentColor: 'var(--color-primary)',
    backgroundColor: 'var(--color-background)',
    foregroundColor: 'var(--color-foreground)',
    chromeBackgroundColor: 'color-mix(in oklab, var(--color-muted) 55%, var(--color-background))',
    headerBackgroundColor: 'color-mix(in oklab, var(--color-muted) 55%, var(--color-background))',
    headerTextColor: 'color-mix(in oklab, var(--color-foreground) 70%, transparent)',
    borderColor: 'var(--color-border)',
    wrapperBorder: false,
    columnBorder: false,
    headerColumnBorder: { color: 'color-mix(in oklab, var(--color-border) 75%, transparent)' },
    headerColumnBorderHeight: '58%',
    rowBorder: { color: 'color-mix(in oklab, var(--color-foreground) 7%, transparent)' },
    rowHoverColor: 'color-mix(in oklab, var(--color-primary) 6%, transparent)',
    selectedRowBackgroundColor: 'color-mix(in oklab, var(--color-primary) 13%, transparent)',
    oddRowBackgroundColor: 'transparent',
    fontFamily: 'Geist Variable, system-ui, sans-serif',
    headerFontFamily: 'Geist Variable, system-ui, sans-serif',
    headerFontWeight: 550,
    wrapperBorderRadius: 0,
  })
  .withPart(gridBodyPart)
```

- [ ] **Step 3: Typecheck + lint + build**

```bash
cd /Users/aarun/Workspace/Projects/RecViz/frontend
./node_modules/.bin/tsc -b --noEmit
./node_modules/.bin/eslint src/lib/grid-theme.ts
./node_modules/.bin/vite build
```

Expected: typecheck clean; eslint clean for this file (no new errors against baseline); vite build succeeds. The new file is not yet imported by anything so the bundle isn't affected — that wires in Task 8.

- [ ] **Step 4: Commit**

```bash
cd /Users/aarun/Workspace/Projects/RecViz
git add frontend/src/lib/grid-theme.ts
git commit -m "$(cat <<'EOF'
feat(grid-theme): port rectrace's v35 Theming-API theme to RecViz

New file: scoped mirror of rectrace's gridTheme.ts.

Visual params + universal CSS rules carry over verbatim:
  - shadcn token-driven colors (primary, foreground, background,
    border, muted) via var() + color-mix(in oklab, ...)
  - vertical header separators at 58% height
  - 7% row-border hairlines, 6% primary hover BG tint
  - 13% primary selected BG tint + primary left-edge inset shadow
  - Gmail-inspired hover hairlines + combined hover+selected
    composition (same as rectrace's Part A)
  - filter popup polish (Apply primary button + focus rings)

Deliberately skipped (per spec scope decisions 3 & 4):
  - density params (fontSize, headerFontSize, cellHorizontalPadding,
    spacing, iconSize) — RecViz keeps Quartz defaults
  - rectrace-only CSS (row-group panel chips, sidebar tabs,
    group-row chevron hover, auto-group cell, "Group by" decorator)
    — RecViz dashboard grids are flat tables without these features

File header carries the mirror-sync rule. Not yet imported — the
three grid wiring sites land in Tasks 8-10.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

### Task 8: Wire `gridTheme` into `config-data-grid.tsx` SingleSourceGrid

**Files:**
- Modify: `RecViz/frontend/src/components/dashboard/config-data-grid.tsx`

- [ ] **Step 1: Read the file head + the SingleSourceGrid render block**

Open `RecViz/frontend/src/components/dashboard/config-data-grid.tsx`. Confirm:
- Line 3: `import { type ColDef, type GridApi, type GridReadyEvent, themeQuartz, colorSchemeDark } from 'ag-grid-community'`
- Line 9: `import { useTheme } from '@/components/layout/theme-provider'`
- Line 66 (inside `SingleSourceGrid`): `const { resolvedTheme } = useTheme()`
- Line 80: `const gridTheme = resolvedTheme === 'dark' ? themeQuartz.withPart(colorSchemeDark) : themeQuartz`
- Around line 146: a `<div>` wrapping `<AgGridReact theme={gridTheme} ... />`

If line numbers have drifted slightly, find the patterns by content match.

- [ ] **Step 2: Update the import line 3**

Remove `themeQuartz, colorSchemeDark` from the `ag-grid-community` import. The line becomes:

```ts
import { type ColDef, type GridApi, type GridReadyEvent } from 'ag-grid-community'
```

(Keep all the `type` imports intact — only the two value imports leave.)

- [ ] **Step 3: Add new import for the static theme**

Add immediately after the `ag-grid-community` import:

```ts
import { gridTheme } from '@/lib/grid-theme'
```

- [ ] **Step 4: Delete the per-render theme calc inside `SingleSourceGrid`**

In `SingleSourceGrid` (around line 80), delete the line:
```ts
const gridTheme = resolvedTheme === 'dark' ? themeQuartz.withPart(colorSchemeDark) : themeQuartz
```

The reference to `gridTheme` in the JSX below still resolves — now to the module-level import added in Step 3.

- [ ] **Step 5: Add `data-ag-theme-mode` to the existing height-styled wrapper div**

Locate the existing `<div>` immediately wrapping `<AgGridReact>` inside `SingleSourceGrid` (around line 146). It currently looks something like:
```tsx
<div style={{ height: 400, width: '100%' }}>
  <AgGridReact theme={gridTheme} ... />
</div>
```

Add the `data-ag-theme-mode` attribute (DO NOT add a new wrapper div):
```tsx
<div style={{ height: 400, width: '100%' }} data-ag-theme-mode={resolvedTheme}>
  <AgGridReact theme={gridTheme} ... />
</div>
```

The `resolvedTheme` reference is already in scope from the `useTheme()` call at line 66. KEEP that call — it's still needed for the attribute.

- [ ] **Step 6: Typecheck + lint + build**

```bash
cd /Users/aarun/Workspace/Projects/RecViz/frontend
./node_modules/.bin/tsc -b --noEmit
./node_modules/.bin/eslint src/components/dashboard/config-data-grid.tsx
./node_modules/.bin/vite build
```

Expected: all clean.

- [ ] **Step 7: Commit**

```bash
cd /Users/aarun/Workspace/Projects/RecViz
git add frontend/src/components/dashboard/config-data-grid.tsx
git commit -m "$(cat <<'EOF'
feat(dashboard): wire gridTheme into SingleSourceGrid + scheme attr

  - Replace per-render themeQuartz.withPart(colorSchemeDark) ternary
    with static `import { gridTheme } from '@/lib/grid-theme'`
  - Drop themeQuartz + colorSchemeDark imports from ag-grid-community
  - Keep useTheme() call — resolvedTheme now flows only into the
    grid container's data-ag-theme-mode attribute so AG-Grid's own
    popups + scrollbars follow the .dark cascade
  - Place data-ag-theme-mode on the existing height-styled <div>
    wrapper (mirrors rectrace SearchGrid.tsx:130 pattern; no new
    DOM wrapper introduced)

MergedSourceGrid lands in Task 9; drill-detail-grid in Task 10.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

### Task 9: Wire `gridTheme` into `config-data-grid.tsx` MergedSourceGrid

**Files:**
- Modify: `RecViz/frontend/src/components/dashboard/config-data-grid.tsx` (same file as Task 8; second function)

- [ ] **Step 1: Locate the MergedSourceGrid block**

Open `RecViz/frontend/src/components/dashboard/config-data-grid.tsx`. The `MergedSourceGrid` function declared around line 188. Confirm:
- Around line 198: `const { resolvedTheme } = useTheme()`
- Around line 222: `const gridTheme = resolvedTheme === 'dark' ? themeQuartz.withPart(colorSchemeDark) : themeQuartz`
- Around line 288: a `<div>` wrapping `<AgGridReact theme={gridTheme} ... />`

(After Task 8 the import line 3 no longer has `themeQuartz, colorSchemeDark` — the line 222 reference is currently broken. tsc would have failed at the end of Task 8 if both grid sites weren't done together. **In practice Tasks 8 and 9 must be staged + committed together for a clean tsc pass — see Step 5 note**.)

**IMPORTANT — pre-Task-8 fix order**: To keep the repo on a working build between commits, do Task 8 and Task 9 as one logical unit:
- After Task 8 Step 5 (the data-ag-theme-mode add for SingleSourceGrid), immediately proceed to this task's Steps 2-4 BEFORE running tsc + commit.
- Combine Task 8 Step 6+7 (typecheck + commit) and Task 9 Step 4+5 into one tsc/commit cycle.

If Task 8 was already committed independently (rare — the implementer ignored the warning), `pnpm tsc -b --noEmit` will report `Cannot find name 'themeQuartz'` at line 222. Continue to Step 2 below to repair.

- [ ] **Step 2: Delete the per-render theme calc**

Inside `MergedSourceGrid` (around line 222), delete:
```ts
const gridTheme = resolvedTheme === 'dark' ? themeQuartz.withPart(colorSchemeDark) : themeQuartz
```

The reference to `gridTheme` in this function's JSX below now resolves to the module-level import added in Task 8 Step 3.

- [ ] **Step 3: Add `data-ag-theme-mode` to the existing wrapper div**

Locate the existing `<div>` immediately wrapping `<AgGridReact>` inside `MergedSourceGrid` (around line 288). Add the attribute:
```tsx
<div style={{ height: 400, width: '100%' }} data-ag-theme-mode={resolvedTheme}>
  <AgGridReact theme={gridTheme} ... />
</div>
```

`resolvedTheme` is already in scope from the `useTheme()` call at line 198 — KEEP that call.

- [ ] **Step 4: Typecheck + lint + build**

```bash
cd /Users/aarun/Workspace/Projects/RecViz/frontend
./node_modules/.bin/tsc -b --noEmit
./node_modules/.bin/eslint src/components/dashboard/config-data-grid.tsx
./node_modules/.bin/vite build
```

Expected: all clean (config-data-grid.tsx now has BOTH grid sites updated).

- [ ] **Step 5: Commit**

If Tasks 8 and 9 were staged together (recommended): rebase the Task 8 commit message to mention both, OR include both functions' diff in a single Task 8/9 combined commit.

If Task 8 was committed independently first (so we now have a broken intermediate commit — the build was broken between commit 1 and this one): create a clean commit here that completes the wiring AND amend the commit message to acknowledge the brief inter-commit broken state for review history.

Standard commit (separate from Task 8):
```bash
cd /Users/aarun/Workspace/Projects/RecViz
git add frontend/src/components/dashboard/config-data-grid.tsx
git commit -m "$(cat <<'EOF'
feat(dashboard): wire gridTheme into MergedSourceGrid + scheme attr

Same change pattern as Task 8, applied to the second grid function
in config-data-grid.tsx (cross-DB merge variant — used by the TLM
dashboard's Reconciliation grid):
  - drop per-render themeQuartz.withPart(colorSchemeDark) ternary
  - data-ag-theme-mode={resolvedTheme} on the existing wrapper div

config-data-grid.tsx is now fully on the v35-canonical theme +
scheme-attribute pattern across BOTH grid functions. The single
remaining dashboard grid (drill-detail-grid.tsx) lands in Task 10.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

### Task 10: Wire `gridTheme` into `drill-detail-grid.tsx`

**Files:**
- Modify: `RecViz/frontend/src/components/dashboard/drill-detail-grid.tsx`

- [ ] **Step 1: Read the file head + render block**

Open `RecViz/frontend/src/components/dashboard/drill-detail-grid.tsx`. Confirm:
- Line 3: imports include `themeQuartz, colorSchemeDark` from `ag-grid-community`
- Line 8 (approx): `import { useTheme } from '@/components/layout/theme-provider'`
- Line 44 (approx): `const { resolvedTheme } = useTheme()`
- Line 66 (approx): `const gridTheme = resolvedTheme === 'dark' ? themeQuartz.withPart(colorSchemeDark) : themeQuartz`
- Line 143 (approx): a `<div style={{ height: ... }}>` wrapping `<AgGridReact theme={gridTheme} ... />`

Match by content if line numbers have drifted.

- [ ] **Step 2: Update the import line 3**

Remove `themeQuartz, colorSchemeDark` from the `ag-grid-community` import. Keep `type ColDef` and any other types unchanged.

- [ ] **Step 3: Add new import for the static theme**

Add immediately after the `ag-grid-community` import:

```ts
import { gridTheme } from '@/lib/grid-theme'
```

- [ ] **Step 4: Delete the per-render theme calc**

Delete the line:
```ts
const gridTheme = resolvedTheme === 'dark' ? themeQuartz.withPart(colorSchemeDark) : themeQuartz
```

The JSX reference to `gridTheme` below now resolves to the module-level import added in Step 3.

- [ ] **Step 5: Add `data-ag-theme-mode` to the existing wrapper div**

Locate the `<div>` wrapping `<AgGridReact>` (around line 143). Add:
```tsx
<div style={{ height: ... }} data-ag-theme-mode={resolvedTheme}>
  <AgGridReact theme={gridTheme} ... />
</div>
```

Keep all existing style properties. KEEP the `useTheme()` call at line 44 — `resolvedTheme` is still consumed by the attribute.

- [ ] **Step 6: Typecheck + lint + build**

```bash
cd /Users/aarun/Workspace/Projects/RecViz/frontend
./node_modules/.bin/tsc -b --noEmit
./node_modules/.bin/eslint src/components/dashboard/drill-detail-grid.tsx
./node_modules/.bin/vite build
```

Expected: all clean. Confirm via grep that no remaining files in `src/components/dashboard/` still import `colorSchemeDark` or do the per-render ternary:

```bash
grep -rn "colorSchemeDark\|resolvedTheme.*===.*dark.*themeQuartz" src/components/dashboard/
```
Expected: zero matches.

- [ ] **Step 7: Commit**

```bash
cd /Users/aarun/Workspace/Projects/RecViz
git add frontend/src/components/dashboard/drill-detail-grid.tsx
git commit -m "$(cat <<'EOF'
feat(dashboard): wire gridTheme into drill-detail-grid + scheme attr

Same change pattern as config-data-grid.tsx's two grid sites:
  - drop ag-grid-community imports of themeQuartz + colorSchemeDark
  - add static `import { gridTheme } from '@/lib/grid-theme'`
  - delete per-render theme calc
  - data-ag-theme-mode={resolvedTheme} on existing wrapper div

drill-detail-grid is user-facing in the chart drill-down flow (open
a chart, click a slice → this grid renders inside the modal). It
shares visual continuity with the other dashboard grids around it
that just landed via Tasks 8-9.

All three dashboard grid sites are now v35-canonical. Legacy
.ag-theme-quartz CSS bridge in index.css is now provably dead and
gets deleted in Task 11.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

### Task 11: Delete legacy `.ag-theme-quartz {...}` block from `index.css`

**Files:**
- Modify: `RecViz/frontend/src/index.css`

- [ ] **Step 1: Locate the legacy block**

Open `RecViz/frontend/src/index.css`. Search for the comment `AG Grid token bridge`:
```bash
cd /Users/aarun/Workspace/Projects/RecViz/frontend
grep -n "AG Grid token bridge\|.ag-theme-quartz" src/index.css
```

Expected: two-ish matches — the comment line and the `.ag-theme-quartz {` opening line. The block spans ~20 lines (lines 156-176 ish in current source — match by content):

```css
/* AG Grid token bridge — reads shadcn CSS variables */
.ag-theme-quartz {
  --ag-background-color: var(--background);
  --ag-foreground-color: var(--foreground);
  --ag-header-background-color: var(--muted);
  --ag-header-foreground-color: var(--foreground);
  --ag-border-color: var(--border);
  --ag-row-hover-color: var(--accent);
  --ag-selected-row-background-color: var(--accent);
  --ag-odd-row-background-color: transparent;
  --ag-font-family: "Inter", system-ui, sans-serif;
  --ag-font-size: 13px;
  --ag-header-font-size: 12px;
  --ag-header-font-weight: 500;
  --ag-cell-horizontal-padding: 12px;
  --ag-row-height: 36px;
  --ag-header-height: 40px;
}
```

- [ ] **Step 2: Delete the block (including the leading comment)**

Remove all ~20 lines from the leading `/* AG Grid token bridge */` comment through the closing `}` of the `.ag-theme-quartz` rule. Leave a single blank line in place to preserve visual rhythm with surrounding rules.

- [ ] **Step 3: Verify no references remain**

```bash
grep -n "ag-theme-quartz\|--ag-" src/index.css
```
Expected: ZERO matches.

- [ ] **Step 4: Typecheck + lint + build**

```bash
./node_modules/.bin/tsc -b --noEmit
./node_modules/.bin/eslint src/index.css || true   # CSS-lint may or may not be wired; tolerate non-error exit
./node_modules/.bin/vite build
```

Expected: tsc + build clean. CSS file is no longer load-bearing for AG-Grid — the v35 Theming API handles everything via the JS theme object now.

- [ ] **Step 5: Smoke-check the live stack**

The build just regenerated `dist/`. RecViz uvicorn auto-serves it. Visit `http://localhost:8000/dashboards/dash-tlm-stats?filter.tlm_instance=TLMP_CONSUMER` and confirm grids still render (they should — the deleted block was dead under v35 Theming API). Light + dark.

If a grid mis-renders, the deletion was NOT purely dead — STOP and investigate which property the live code still depended on.

- [ ] **Step 6: Commit**

```bash
cd /Users/aarun/Workspace/Projects/RecViz
git add frontend/src/index.css
git commit -m "$(cat <<'EOF'
chore(css): delete legacy .ag-theme-quartz bridge block

Dead code under AG-Grid v35 Theming API. The grid no longer carries
the ag-theme-quartz className (theme is passed as a JS object via
the `theme` grid option since v33+). The bridge block was a pre-v33
pattern that exposed shadcn CSS variables to AG-Grid via legacy
--ag-* variables.

Verified live: dashboard grids render identically before/after this
deletion in both light + dark.

This closes Part B of the spec. Final runtime verification + handoff
screenshots land in Task 12.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

### Task 12: RecViz runtime verification + handoff evidence

**Files:**
- Read-only verification. Save evidence to `docs/superpowers/handoff/`.

- [ ] **Step 1: Bundle-size delta check**

```bash
cd /Users/aarun/Workspace/Projects/RecViz/frontend
du -sh dist/
ls -la dist/assets/*.woff2 | awk '{sum+=$5} END {print "woff2 total:", sum/1024, "KB"}'
ls -la dist/assets/*.js | awk '{sum+=$5} END {print "js total:", sum/1024, "KB"}'
```

Expected: total `dist/` size up ~80KB from the pre-Task-4 baseline. The delta should be confined to woff2 assets (Geist Variable + Geist Mono Variable each ~40KB). The js total should be close to pre-Task-4 (drift within rounding is fine).

If the JS bundle bloated materially (>50KB), something else got pulled in — investigate before claiming done.

- [ ] **Step 2: Standalone dashboard with theme — light**

Use Playwright MCP:
1. Navigate: `http://localhost:8000/dashboards/dash-tlm-stats?filter.tlm_instance=TLMP_CONSUMER`
2. Wait for grids to render.
3. Hover a row in the Reconciliation grid → confirm the Gmail-inspired hairlines via `browser_evaluate`:
   ```js
   () => {
     const row = document.querySelector('.ag-row-hover')
     return row ? getComputedStyle(row).boxShadow : 'no hover row'
   }
   ```
   Expected: two `inset` stops (top + bottom hairlines).
4. Screenshot: `task12-recviz-standalone-light.png`.

- [ ] **Step 3: Standalone dashboard with theme — dark**

Toggle dark via topbar or `browser_evaluate(() => document.documentElement.classList.add('dark'))`.
Repeat hover + screenshot: `task12-recviz-standalone-dark.png`.

- [ ] **Step 4: Embedded modal from rectrace cell-click flow**

1. Navigate to `http://localhost:5173/search?q=TLMP_CONSUMER&tab=tlmInstance`.
2. Expand the TLMP_CONSUMER group.
3. Click a `View TLM stats for LACC_*` button.
4. Wait for the modal iframe to load.
5. Screenshot the modal: `task12-recviz-embedded-modal.png`.

The visual goal: the dashboard grids inside the modal should read as continuous with the rectrace search grid behind them. Same font, same header chrome, same hover hairlines, same selected primary left-edge.

- [ ] **Step 5: Drill-down detail grid**

The drill-detail-grid is reached by clicking a chart segment in a dashboard whose config has `features.drillDown: true`. Check whether any seeded dashboard exposes drill-down:

```bash
cd /Users/aarun/Workspace/Projects/RecViz
grep -n '"drillDown"' scripts/seed-oracle.py | head -10
```

If no dashboard has `drillDown: True`, the user-flow runtime verification is not reachable in the current seed. In that case:
1. Confirm the file imports + builds cleanly (already covered by Task 10 Step 6).
2. Skip the user-flow screenshot.
3. Note in the handoff commit message: "drill-detail-grid runtime user-flow not reachable in current seed (all dashboard configs have drillDown: false). File-level integration verified; user-flow verification deferred to next seed change that enables drill-down."

If a dashboard DOES have drill-down enabled:
1. Open it standalone.
2. Click a chart segment.
3. Drill-detail-grid renders. Hover a row → confirm hairlines apply here too.
4. Screenshot: `task12-recviz-drill-detail.png`.

- [ ] **Step 6: Filter popup adopts dark mode via `data-ag-theme-mode`**

1. With the dashboard in dark mode, click a column-header filter icon to open the filter popup.
2. The popup should adopt the dark scheme (dark background, light text). If it shows light-mode chrome inside a dark grid, the `data-ag-theme-mode` attribute didn't take effect — debug Tasks 8/9/10 wiring.
3. Screenshot: `task12-recviz-filter-popup-dark.png`.

- [ ] **Step 7: Regression sweep**

Quick sanity check across functionality that should NOT have changed:
- Pagination controls work (next/prev page).
- Sorting (click a header).
- Column resize (drag a header divider).
- Quick filter (if the toolbar exposes one).
- Row selection.

All should still function. If anything breaks, halt — likely a typo in Tasks 8-10 wiring.

- [ ] **Step 8: Move screenshots into handoff dir + commit**

```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer
find . -maxdepth 3 -name "task12-recviz-*.png" -not -path "*/node_modules/*" -exec mv {} docs/superpowers/handoff/ \;
ls docs/superpowers/handoff/task12-recviz-*.png
```
Expected: 5 screenshots.

```bash
git add docs/superpowers/handoff/task12-recviz-*.png
git commit -m "$(cat <<'EOF'
docs(handoff): Task 12 evidence — RecViz dashboard grids end-to-end

5 screenshots verify the full Part B port:
  - task12-recviz-standalone-light.png
  - task12-recviz-standalone-dark.png
  - task12-recviz-embedded-modal.png (rectrace cell-click flow)
  - task12-recviz-drill-detail.png (chart drill-down grid)
  - task12-recviz-filter-popup-dark.png (data-ag-theme-mode adoption)

Bundle-size delta confirmed ~80KB confined to Geist woff2 assets.
Regression sweep passed (pagination, sorting, resize, quick filter,
row selection).

AG-Grid styling consistency spec
(docs/superpowers/specs/2026-05-30-ag-grid-styling-consistency-design.md)
is now fully implemented end-to-end across both repos.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Post-Plan Updates

After Task 12 ships, update the handoff doc with the close-out entry:

```bash
# Edit docs/superpowers/handoff/2026-05-29-post-demo-pending-work.md
# Update the A2 row in the top-level task table from
#   "AG-Grid styling inside the embedded RecViz dashboards ... NOT STARTED — pick up with user"
# to
#   "AG-Grid styling consistency — both repos ... ✅ DONE — spec + plan executed end-to-end"
# Reference: spec 9b09c2a, plan <this file>, plus commit SHAs from Tasks 2, 5, 7, 8, 9, 10, 11
```

Commit with a `docs(handoff): mark A2 done` message.

---

## Verification matrix (cross-cutting)

| Surface | Where verified |
|---|---|
| Rectrace test asserts new `.ag-row-hover` rule | Task 1 (red), Task 2 (green) |
| Rectrace hover hairline in light mode | Task 3 (Playwright + screenshot) |
| Rectrace hover hairline in dark mode | Task 3 |
| Rectrace hover-selected composition (3 box-shadow stops) | Task 3 (`browser_evaluate` returning the computed boxShadow) |
| RecViz Geist installed | Task 4 (build succeeds; woff2 in dist) |
| RecViz `font-mono` callsites resolve to Geist Mono | Task 6 (`getComputedStyle` console check) |
| RecViz visual sweep (8 surfaces × 2 modes) | Task 6 (16 screenshots) |
| RecViz dashboard grid uses new theme | Task 12 (standalone screenshots) |
| RecViz drill-detail grid uses new theme | Task 12 |
| `data-ag-theme-mode` flips filter popup with dark mode | Task 12 |
| Embedded modal grids visually continuous with rectrace | Task 12 (cross-app screenshot) |
| Bundle-size delta confined to woff2 | Task 12 (du -sh + asset breakdown) |
| Regression: pagination, sorting, resize, filter, selection | Task 12 Step 7 |
| No remaining legacy `--ag-*` references | Task 11 Step 3 |
| No remaining per-render `themeQuartz.withPart(colorSchemeDark)` ternary | Task 10 Step 6 |

---

## What's NOT in this plan (explicit, per spec out-of-scope)

- **RecViz internal-admin grids** (query-results, dataset-editor, column-metadata-grid). Will look stock-Quartz vs the new themed dashboard grids until a follow-up port. Accepted transient.
- **Density variants** (compact for embed mode). Revisit only if the modal feels cramped after this lands.
- **Card hover-lift in RecViz dashboard grid cards** — may visually clash inside the rectrace modal. Follow-up: add `data-static` to grid Cards or accept.
- **A1** Empty-state no-results + Contextual dashboards inline (separate UX redesign).

These are flagged in the spec's "Out of scope" section; no task implements them.
