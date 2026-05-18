---
phase: 02-react-foundation
plan: "01"
subsystem: ui
tags: [react, vite, shadcn, tailwind-v4, ag-grid, tanstack-router, tanstack-query, eslint, vitest, typescript, pnpm]

requires:
  - phase: 01-boot-upgrade
    provides: backend Spring Boot 3.5.14 + Java 21 (API unchanged; Plan 01 consumed the existing v4 search endpoints)

provides:
  - frontend-react/ Vite 7 + React 19 + TypeScript 5.9.3 project scaffold
  - pnpm@9.15.0 lockfile (pnpm-lock.yaml)
  - shadcn new-york/mist design token baseline (src/index.css) — no chart-1..5 tokens
  - TS token mirror (src/lib/theme.ts) exporting const tokens + TokenKey
  - ESLint flat config with hex-rejection rule (no-restricted-syntax Literal[value=/^#.../])
  - vitest 4 harness with jsdom, @testing-library/jest-dom, passWithNoTests
  - AG-Grid Enterprise 35 registered (ServerSideRowModelModule only; LicenseManager first)
  - Dev proxy: /rectrace/api → http://localhost:6088 (Vite server.proxy)
  - __BUILD_SHA__ injected at build time from git rev-parse (REACT-06)
  - RECTRACE EXTENSIONS empty block in index.css (D-2.7 anchor for Phase 8 chart tokens)
  - raw-hex ESLint fixture (tests/fixtures/raw-hex.tsx) proving hex-rejection is enforced

affects: [02-02-correlation-id, 02-03-smoke-grid, 02-04-ops, 03-recviz-integration, 08-design-audit]

tech-stack:
  added:
    - "vite@7.3.x — build tool, mode-aware base, dev proxy, BUILD_SHA define"
    - "react@19.2.x + react-dom@19.2.x — UI framework"
    - "typescript@~5.9.3 — strict ES2022 + bundler mode"
    - "@tanstack/react-router@1.169.x + router-plugin — file-based routing"
    - "@tanstack/react-query@5.100.x — server state management"
    - "ag-grid-enterprise@35.3.x + ag-grid-community + ag-grid-react — SSRM grid"
    - "shadcn@3.8.x — component CLI (new-york style, mist base, Tailwind v4)"
    - "@tailwindcss/vite@4.3.x — Tailwind v4 via Vite plugin (no tailwind.config.ts)"
    - "eslint@9.x flat config + typescript-eslint@8.x recommendedTypeChecked"
    - "vitest@4.1.x + @testing-library/react + @testing-library/jest-dom + jsdom"
    - "zustand@5.x — client state management"
    - "lucide-react@0.563.0 — icon library (pinned; 1.x renames icons)"
    - "sonner@2.x — toast notifications"
    - "pnpm@9.15.0 — package manager (Corepack pin, D-2.2)"
  patterns:
    - "pnpm@9.15.0 as canonical package manager with corepack pinning (D-2.2)"
    - "Vite function-form config (mode-aware base, define, server.proxy)"
    - "shadcn vendored components exempt from hex-rejection ESLint rule via globalIgnores"
    - "AG-Grid license set BEFORE ModuleRegistry.registerModules() — execution order constraint"
    - "Tailwind v4 token bridge: @theme inline maps CSS vars without OKLCH literals in block"
    - "RECTRACE EXTENSIONS labeled empty block in index.css for future chart/viz tokens"
    - "tsconfig.eslint.json extends tsconfig.app.json with broader include (tests + vite configs)"

key-files:
  created:
    - "frontend-react/package.json — dependency manifest, pnpm@9.15.0, all version pins"
    - "frontend-react/pnpm-lock.yaml — reproducible dependency tree"
    - "frontend-react/vite.config.ts — mode-aware base, __BUILD_SHA__, /rectrace/api proxy"
    - "frontend-react/tsconfig.json + tsconfig.app.json + tsconfig.node.json — strict TS config"
    - "frontend-react/tsconfig.eslint.json — covers tests/ and vite/vitest configs for typed ESLint"
    - "frontend-react/components.json — shadcn new-york/mist/cssVariables, config='' (Tailwind v4)"
    - "frontend-react/vitest.config.ts — jsdom env, setupFiles, passWithNoTests:true"
    - "frontend-react/eslint.config.js — flat config, recommendedTypeChecked, hex-rejection rule"
    - "frontend-react/src/index.css — OKLCH mist tokens (no chart-1..5), RECTRACE EXTENSIONS, AG bridge"
    - "frontend-react/src/lib/theme.ts — TS mirror of CSS vars as const tokens + TokenKey type"
    - "frontend-react/src/lib/utils.ts — cn() helper (clsx + tailwind-merge)"
    - "frontend-react/src/test-setup.ts — @testing-library/jest-dom import"
    - "frontend-react/src/vite-env.d.ts — __BUILD_SHA__ ambient + ImportMetaEnv type"
    - "frontend-react/src/main.tsx — LicenseManager first, ServerSideRowModelModule, createRoot"
    - "frontend-react/src/App.tsx — RouterProvider wrapper, TanStack Router module augmentation"
    - "frontend-react/tests/fixtures/raw-hex.tsx — intentional #1a2b3c to trigger hex rule"
    - "frontend-react/.gitignore — .env.local, dist/, node_modules/, .vite/, routeTree.gen.ts"
    - "frontend-react/.env.local.example — VITE_AG_GRID_LICENSE_KEY placeholder (T-2-01)"
  modified: []

key-decisions:
  - "D-2.1: React net-new SPA (not rewrite of Angular) — frontend-react/ at repo root"
  - "D-2.2: pnpm@9.15.0 Corepack pin via packageManager field — SATISFIED (package.json)"
  - "D-2.4: mode-aware base (/rectrace/ in production, / in dev) — SATISFIED (vite.config.ts)"
  - "D-2.6: shadcn new-york style, mist base, cssVariables, lucide icons — SATISFIED (components.json)"
  - "D-2.7: No chart-1..5 tokens in index.css; RECTRACE EXTENSIONS empty block committed — SATISFIED"
  - "D-2.8: ESLint hex-rejection rule (no-restricted-syntax Literal[value=/^#.../]) — SATISFIED; fixture verified"
  - "D-2.14: LicenseManager.setLicenseKey inlined in main.tsx (not src/lib/agGrid.ts) — SATISFIED; WARNING 7 resolved"
  - "WARNING 7: src/lib/agGrid.ts intentionally NOT created — LicenseManager.setLicenseKey is in main.tsx for execution order clarity"

patterns-established:
  - "Pattern: Tailwind v4 via @tailwindcss/vite plugin; no tailwind.config.ts (components.json config='')"
  - "Pattern: ESLint flat config with tsconfig.eslint.json for full project coverage (src + tests + configs)"
  - "Pattern: vitest passWithNoTests:true so empty suite exits 0 (required for CI scaffold without initial tests)"
  - "Pattern: ImportMetaEnv augmentation in vite-env.d.ts for typed VITE_* env vars"

requirements-completed: [REACT-01, REACT-04]

duration: ~12min
completed: "2026-05-13"
---

# Phase 02 Plan 01: React Foundation Scaffold Summary

**Vite 7 + React 19 + shadcn/mist design token scaffold with ESLint hex-rejection rule, vitest harness, and AG-Grid Enterprise 35 SSRM bootstrap — zero chart tokens committed per D-2.7**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-13T02:16:00Z
- **Completed:** 2026-05-13T02:28:17Z
- **Tasks:** 2 (Task 1: scaffold; Task 2: ESLint + fixture)
- **Files modified:** 20 files created, 0 modified

## Accomplishments

- `frontend-react/` project scaffold bootable with `pnpm dev` at localhost:5173
- Full OKLCH mist design token set in `src/index.css` with AG-Grid token bridge; no chart-1..5 tokens (D-2.7 honored)
- ESLint flat config with `recommendedTypeChecked` and hex-rejection rule; `tests/fixtures/raw-hex.tsx` triggers the rule on first lint run
- vitest 4 harness exits 0 on empty test suite (`passWithNoTests: true` — Rule 1 fix applied)
- AG-Grid Enterprise 35 registered with `ServerSideRowModelModule` only; `LicenseManager.setLicenseKey` first in execution order (D-2.14)

## Task Commits

1. **Task 1: Scaffold frontend-react/ project files** - `52cdcf8` (feat)
2. **Task 2: ESLint config and raw-hex fixture** - `e26692b` (feat)

## Files Created/Modified

- `frontend-react/package.json` — dependency manifest; pnpm@9.15.0, Vite ^7.3.1, React 19, TypeScript ~5.9.3, shadcn ^3.8.4
- `frontend-react/pnpm-lock.yaml` — lockfile (595 packages installed)
- `frontend-react/vite.config.ts` — mode-aware base, `__BUILD_SHA__` define, `/rectrace/api` proxy
- `frontend-react/tsconfig.json` / `tsconfig.app.json` / `tsconfig.node.json` — strict ES2022 composite config
- `frontend-react/tsconfig.eslint.json` — ESLint-specific tsconfig covering src + tests + vite configs
- `frontend-react/components.json` — shadcn new-york/mist/cssVariables, `"config": ""` (Tailwind v4 marker)
- `frontend-react/vitest.config.ts` — jsdom environment, setupFiles, passWithNoTests:true
- `frontend-react/eslint.config.js` — flat config, recommendedTypeChecked, globalIgnores (vendored shadcn), hex rule
- `frontend-react/src/index.css` — OKLCH mist tokens (no chart-1..5), RECTRACE EXTENSIONS block, AG-Grid bridge
- `frontend-react/src/lib/theme.ts` — `const tokens` mirroring all CSS vars + `TokenKey` type
- `frontend-react/src/lib/utils.ts` — `cn()` helper (clsx + tailwind-merge)
- `frontend-react/src/test-setup.ts` — `@testing-library/jest-dom` import
- `frontend-react/src/vite-env.d.ts` — `__BUILD_SHA__` ambient + `ImportMetaEnv` type
- `frontend-react/src/main.tsx` — LicenseManager first, ServerSideRowModelModule, createRoot
- `frontend-react/src/App.tsx` — RouterProvider wrapper with TanStack Router module augmentation
- `frontend-react/tests/fixtures/raw-hex.tsx` — intentional `#1a2b3c` hex literal (ESLint fixture)
- `frontend-react/.gitignore` — `.env.local`, `dist/`, `node_modules/`, `.vite/`, `src/routeTree.gen.ts`
- `frontend-react/.env.local.example` — `VITE_AG_GRID_LICENSE_KEY=` placeholder (T-2-01 mitigation)

## Decisions Made

- **src/lib/agGrid.ts NOT created**: Plan note (WARNING 7) confirmed inline approach — `LicenseManager.setLicenseKey` lives in `main.tsx` alongside `ModuleRegistry.registerModules` for execution order clarity. No separate agGrid.ts module needed.
- **tsconfig.eslint.json added**: Extends tsconfig.app.json with `include: ["src", "tests", "vite.config.ts", "vitest.config.ts"]` so all TypeScript files are accessible for typed ESLint rules.
- **passWithNoTests: true**: Added to vitest.config.ts so the test harness exits 0 on the empty initial scaffold, consistent with the plan's behavior spec.

## Versions Pinned

| Library | Version Pinned | Reason |
|---------|---------------|--------|
| vite | ^7.3.1 | NOT 8.x (npm latest 8.0.12) — Vite 8 has breaking changes; plan spec mandates 7.x |
| shadcn | ^3.8.4 | NOT 4.x (npm latest 4.7.0) — 4.x changed component API significantly |
| typescript | ~5.9.3 | NOT 6.x (npm latest 6.0.3) — 6.x is beta/unstable for this toolchain |
| lucide-react | ^0.563.0 | NOT 1.x (npm latest 1.14.0) — 1.x renames many icon exports |

## Key Decisions Executed (D-* Status)

| Decision | Status |
|----------|--------|
| D-2.1: React net-new SPA at frontend-react/ | SATISFIED |
| D-2.2: pnpm@9.15.0 Corepack pin | SATISFIED |
| D-2.4: mode-aware base (/rectrace/ prod, / dev) | SATISFIED |
| D-2.6: shadcn new-york/mist/cssVariables/lucide | SATISFIED |
| D-2.7: No chart tokens; RECTRACE EXTENSIONS block present | SATISFIED |
| D-2.8: ESLint hex-rejection rule; fixture verified | SATISFIED |
| D-2.14: LicenseManager inline in main.tsx; no lib/agGrid.ts | SATISFIED |

## Deferred Items Confirmed

- **Chart tokens**: `--chart-1..5`, `--series-1..8`, `--ramp-low/high`, `--chart-positive/negative/warning` are NOT in `src/index.css` (D-2.7 honored). The `RECTRACE EXTENSIONS` labeled empty block is the Phase 8 anchor point.
- **shadcn vendored components**: `button.tsx`, `sonner.tsx`, `card.tsx` are NOT generated in this plan — they are vendored via `pnpm dlx shadcn@3.8.5 add` in Plan 02-03 (smoke grid scaffold).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added passWithNoTests: true to vitest.config.ts**
- **Found during:** Task 1 (scaffold)
- **Issue:** `vitest run` exits 1 when no test files found. Plan behavior spec requires "vitest runs and exits 0 on an empty test suite".
- **Fix:** Added `passWithNoTests: true` to vitest.config.ts test options.
- **Files modified:** `frontend-react/vitest.config.ts`
- **Verification:** `pnpm run test` outputs "No test files found, exiting with code 0", exit code 0.
- **Committed in:** `52cdcf8` (Task 1 commit)

**2. [Rule 1 - Bug] Created tsconfig.eslint.json for full ESLint coverage**
- **Found during:** Task 2 (ESLint config)
- **Issue:** `parserOptions.project: ['./tsconfig.app.json']` caused "file not found" parser errors for `tests/fixtures/raw-hex.tsx`, `vite.config.ts`, and `vitest.config.ts` — none of which are in tsconfig.app.json's `include: ["src"]`.
- **Fix:** Created `frontend-react/tsconfig.eslint.json` that extends tsconfig.app.json and adds `"include": ["src", "tests", "vite.config.ts", "vitest.config.ts"]`. Updated eslint.config.js to reference it.
- **Files modified:** `frontend-react/tsconfig.eslint.json` (created), `frontend-react/eslint.config.js` (updated project ref)
- **Verification:** `pnpm lint tests/fixtures/raw-hex.tsx` reports exactly 1 error (hex literal in fixture).
- **Committed in:** `e26692b` (Task 2 commit)

**3. [Rule 1 - Bug] Added ImportMetaEnv type declaration to vite-env.d.ts**
- **Found during:** Task 2 (ESLint config)
- **Issue:** `import.meta.env.VITE_AG_GRID_LICENSE_KEY` was typed as `any` (Vite's generic env type), causing `@typescript-eslint/no-unsafe-argument` error in main.tsx when the typed ESLint rules ran.
- **Fix:** Added `ImportMetaEnv` and `ImportMeta` interface augmentations to `src/vite-env.d.ts` with `VITE_AG_GRID_LICENSE_KEY: string`.
- **Files modified:** `frontend-react/src/vite-env.d.ts`
- **Verification:** `pnpm lint tests/fixtures/raw-hex.tsx` no longer reports errors from main.tsx.
- **Committed in:** `e26692b` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (3 Rule 1 bugs)
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep. passWithNoTests aligns with plan spec. tsconfig.eslint.json is standard practice for typed ESLint. ImportMetaEnv is required for typed env vars with Vite.

## Known Stubs

- **`src/routeTree.gen.ts` (gitignored placeholder)**: A minimal placeholder exists on disk at `frontend-react/src/routeTree.gen.ts` so `App.tsx` can resolve the import during development. This file is gitignored and auto-regenerated by TanStack Router's Vite plugin when `pnpm dev` or `pnpm build` runs. The placeholder does NOT block any plan functionality — the real file is generated at runtime. Plans 02-03+ (smoke grid, routes) will depend on the generated file being present after `pnpm dev` is run.

## Next Phase Readiness

- **Plan 02-02** (correlation ID propagation): Frontend scaffold is ready. `src/lib/queryClient.ts` and `apiFetch` wrapper will be created there (not here — Plan 01 scope is config/scaffold only).
- **Plan 02-03** (smoke grid): `frontend-react/` has all dependencies needed — ag-grid-react, @tanstack/react-router, etc. The smoke grid component, routes, and app-shell components will be created in 02-03.
- **Plan 02-04** (ops scripts): `frontend-react/` is ready for `ops/rectrace-ops.sh` and `ops/build.sh` to reference `pnpm dev` and `pnpm build`.
- **REACT-01 and REACT-04** requirements: Satisfied by this plan.

---

*Phase: 02-react-foundation*
*Completed: 2026-05-13*
