# Phase 2: React Foundation - Research

**Researched:** 2026-05-13
**Domain:** React SPA scaffolding, Vite 7, shadcn/Tailwind v4, AG-Grid Enterprise 35 SSRM, TanStack Router/Query, Micrometer Tracing (Brave bridge), Ops scripting
**Confidence:** HIGH (recviz codebase read live; npm registry versions verified; Spring Boot BOM queried; Angular SSRM contract verified)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-2.1:** `frontend-react/` lives as a top-level sibling to `frontend/rectrace/` inside this repo. Not nested under `frontend/`.
- **D-2.2:** Package manager is pnpm 9 via Corepack (`"packageManager": "pnpm@9.x.x"` in `package.json`). README documents the equivalent npm command sequence as a fallback.
- **D-2.3:** Dev server port is Vite's default 5173.
- **D-2.4:** No `/ui/` and no `/v6/` URL prefix. Vite `base: '/rectrace/'` for production, `base: '/'` for dev. Angular is decommissioned at React go-live.
- **D-2.5:** D-2.4 supersedes the `/v6/` example URL in REQUIREMENTS.md SEARCH-07 and the `/v6/` mention in ROADMAP.md Phase 3 SC#1.
- **D-2.6:** `pnpm dlx shadcn init` with style: new-york, baseColor: mist, cssVariables: true, lucide icons, prefix '', RTL false. Aliases mirror recviz exactly: `@/components`, `@/lib/utils`, `@/components/ui`, `@/lib`, `@/hooks`.
- **D-2.7:** `tokens.css` ships the shadcn baseline + a clearly-labeled empty "Rectrace extensions" block. Chart/series/ramp tokens NOT shipped in Phase 2. Auto-surface: STATE.md deferred row + tokens.css comment + Phase 8 DESIGN-01 anchor.
- **D-2.8:** ESLint 9 flat config matching recviz + custom `no-restricted-syntax` rejecting `Literal` nodes matching `/^#[0-9a-fA-F]{3,8}$/`. Vendored `components/ui/` exempt via override.
- **D-2.9:** `micrometer-tracing-bridge-brave` added to BOTH Maven modules (backend/rectrace + rectrace-tlm-stats). Boot 3.5.14 BOM manages version (1.5.11). `management.tracing.sampling.probability=1.0` in dev/local. No exporter (Phase 7).
- **D-2.10:** Custom Brave `Propagation` impl reads/writes `X-Correlation-Id`. UUID v4 dashes-stripped = 32 hex chars = valid 128-bit traceId.
- **D-2.11:** Client originates correlation ID via fetch wrapper co-located with TanStack Query client. Query meta carries it for error UI.
- **D-2.12:** `logback-spring.xml` pattern updated to include `%X{traceId}` in both Maven modules. Minimal change; Phase 7 OBS-01 replaces with JSON.
- **D-2.13:** SSRM smoke target: `POST /rectrace/api/v4/search/ssrm/fileName` against Phase 0.1 local seed (5 rows).
- **D-2.14:** AG-Grid Enterprise license via `VITE_AG_GRID_LICENSE_KEY` in `.env.local`. `LicenseManager.setLicenseKey()` called once at app startup.
- **D-2.15:** `ops/rectrace-ops.sh` v1 — start/stop/status/restart/logs for backend, tlm-stats, react. NO angular row. PID files in `run/`, logs in `logs/`. HTTP 200 probe with 30s timeout.
- **D-2.16:** `ops/build.sh` separate script. `build.sh react` = pnpm build + copy dist/* to backend static/ (clean first).
- **D-2.17:** D-2.15 supersedes angular references in ROADMAP Phase 2 SC#5 and REQUIREMENTS REACT-08.
- **D-2.18:** FOUND-04 gate relaxed for Phase 2 Foundation; Targets locked per-port-phase (Phase 3, 4, etc.).

### Claude's Discretion

- Brave vs OTel bridge — Brave picked; OTel acceptable if BOM resolves cleaner (it does not; Brave is standard).
- B3 vs W3C propagation alongside X-Correlation-Id — planner picks.
- TanStack Router file-based routing vs minimal manual config for one route — planner decides.
- Vite `define` exact incantation for `__BUILD_SHA__`.
- shadcn init default components to vendor (Phase 2 uses: Button, Sonner, possibly Card).
- State management for theme — next-themes (recviz pattern) vs Zustand.
- Static-asset cleaning during `build.sh react` — full clean vs selective.
- Per-module `application-local.properties` deltas for sampling probability.
- Commit wave shape.

### Deferred Ideas (OUT OF SCOPE)

- Real search UI, cell renderers, Excel export, recent searches, URL-state (Phase 3)
- recviz iframe embedding (Phase 4)
- Micrometer exporter (Zipkin/Jaeger/OTel), Prometheus, slow-query AOP, JSON logs, HealthIndicator (Phase 7)
- Chart/series/ramp/heatmap design tokens (deferred until first chart phase)
- Visual regression testing (Phase 8 DESIGN-02)
- ESLint hex-rejection over vendored recviz/shadcn primitives (exempt by override)
- Auth filter / x-citiportal-loginid validation (Phase 9 SEC-01)
- ES SSL truststore, CORS lockdown, Citi CA, internal Nexus (Phase 9 SEC-03..06)
- shellcheck CI, Linux portability tests, actuator-health readiness probes (Phase 8 OPS-01..04)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REACT-01 | Scaffold `frontend-react/` with Vite 7 + React 19 + TypeScript 5.6+ + shadcn/ui (Tailwind v4) | Vite 7.3.3 docs verified; Node >=20.19 requirement confirmed; shadcn init command documented |
| REACT-02 | Wire TanStack Router + TanStack Query + Zustand + React Hook Form + Zod | TanStack Router file-based routing pattern from recviz confirmed; QueryClient pattern read |
| REACT-03 | Integrate AG-Grid Enterprise via `ag-grid-react` with SSRM datasource against existing backend endpoint | AG-Grid 35 modular registration; SSRM request/response envelope verified from Angular source + backend DTOs |
| REACT-04 | Single canonical design-tokens file (`tokens.css` + `theme.ts`) aligned with recviz; ESLint hex rule | Full recviz `src/index.css` and `eslint.config.js` read; token set documented verbatim |
| REACT-05 | Dark/light mode toggle at feature parity with existing Angular app | recviz `ThemeProvider` + `ThemeSwitch` pattern read; uses custom context not next-themes (see finding) |
| REACT-06 | Build version / SHA visible in app footer | Vite `define.__BUILD_SHA__` pattern documented; git rev-parse invocation confirmed |
| REACT-07 | Correlation-ID propagation: backend MDC + React fetch wrapper + error UI | Micrometer Brave bridge BOM version confirmed (1.5.11); X-Correlation-Id baggage pattern documented |
| REACT-08 | `ops/rectrace-ops.sh` v1 with backend, tlm-stats, react components (angular removed per D-2.17) | Script structure, PID/log layout, pnpm fallback, readiness probe pattern documented |
</phase_requirements>

---

## Summary

Phase 2 creates a net-new `frontend-react/` directory at repo root, mirroring recviz's exact stack and patterns. The primary reference is the live recviz codebase at `/Users/aarun/Workspace/Projects/recviz/frontend/` — every decision about package versions, file layout, alias scheme, ESLint config, CSS token structure, and TanStack routing can be copy-read from there.

The critical chain is: Vite 7.3.3 (pinned to latest 7.x, NOT 8.x which is now latest on npm) + React 19.2.x + TypeScript 5.9.3 (not 6.x — mirrors recviz) + Tailwind v4 CSS-first via `@tailwindcss/vite` + shadcn CLI 3.8.5 (`@theme inline` block) + AG-Grid Enterprise 35 (modular, `ServerSideRowModelModule`) + TanStack Router v1 (file-based routing via `TanStackRouterVite` plugin) + TanStack Query v5 + next-themes.

The backend changes are minimal: add `io.micrometer:micrometer-tracing-bridge-brave` (BOM-managed at 1.5.11) to both Maven modules' POMs, write a custom `Propagation.Factory` reading `X-Correlation-Id` as the traceId source, add `logback-spring.xml` with `%X{traceId}` to both modules, and add `management.tracing.sampling.probability=1.0` to both `application-local.properties` files.

The ops scripts are net-new: `ops/rectrace-ops.sh` and `ops/build.sh` do not exist yet. The repo root has no `ops/` directory. The backend `static/` resource directory also does not exist on disk (it will be created by `build.sh react`).

**Primary recommendation:** Mirror recviz's package.json, vite.config.ts, tsconfig.app.json, eslint.config.js, src/index.css, and src/routes/__root.tsx as the implementation template. The delta between recviz and Phase 2 rectrace is: (a) add `VITE_AG_GRID_LICENSE_KEY` env var + `LicenseManager.setLicenseKey()` boot call; (b) add `define.__BUILD_SHA__` to vite.config; (c) add the hex-rejection ESLint rule; (d) the fetch wrapper adds `X-Correlation-Id`; (e) base is mode-aware (`/rectrace/` prod, `/` dev); (f) SSRM SmokeGrid component replaces recviz's dashboard.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| React SPA shell + routing | Browser/Client | Frontend static (via Spring) | SPA runs entirely in browser; Spring only serves the static bundle |
| AG-Grid SSRM data fetch | API/Backend | Browser (AG-Grid datasource) | Oracle queries run in Spring; React grid is a thin client requesting rows |
| Correlation ID generation | Browser/Client | API/Backend (Brave bridge) | Client generates UUID and sends header; backend's Brave propagator reads it as traceId |
| Brave traceId → MDC | API/Backend | — | Brave bridge populates MDC automatically once propagator is wired |
| Logback traceId pattern | API/Backend | — | `logback-spring.xml` lives in each Spring module's classpath resources |
| Dark/light theme state | Browser/Client | — | `localStorage`-based; no backend involvement |
| Build SHA injection | Build-time (Vite) | Browser (footer display) | `define` runs at build time; renders in browser at runtime |
| pnpm dev process | Frontend Dev Server | — | Vite dev server at localhost:5173 |
| ops/rectrace-ops.sh | Operations surface | — | PID-based lifecycle for backend, tlm-stats, react processes |
| ops/build.sh | Build pipeline | — | Produces dist/ and copies to backend static/ |

---

## Standard Stack

### Core

| Library | Version (to use) | Purpose | Source |
|---------|-----------------|---------|--------|
| vite | ^7.3.1 | Build tool + dev server | Mirrors recviz; 7.3.3 is latest 7.x [VERIFIED: npm registry] |
| react | ^19.2.0 | UI framework | Recviz pattern [VERIFIED: npm registry, current 19.2.6] |
| react-dom | ^19.2.0 | React DOM renderer | Paired with react [VERIFIED: npm registry] |
| typescript | ~5.9.3 | Type system | Mirrors recviz exactly (NOT 6.x — see Version Warning below) [VERIFIED: npm, recviz package.json] |
| tailwindcss | ^4.1.18 | CSS utility framework (v4 CSS-first) | Recviz pattern [VERIFIED: npm, current 4.3.0] |
| @tailwindcss/vite | ^4.1.18 | Tailwind v4 Vite plugin | Required for Tailwind v4 [VERIFIED: npm, current 4.3.0] |
| @vitejs/plugin-react | ^5.1.1 | Vite React plugin | Recviz pattern [VERIFIED: npm, current 6.0.1] |
| shadcn (devDep) | ^3.8.4 | shadcn CLI for component vendoring | Recviz pattern — use 3.x NOT 4.x (see Version Warning) [VERIFIED: npm, 3.8.5 is latest 3.x] |
| @tanstack/react-router | ^1.159.5 | Type-safe file-based routing | Recviz pattern [VERIFIED: npm, current 1.169.2] |
| @tanstack/router-plugin | ^1.159.5 | Vite plugin for file-based routing codegen | Required alongside router [VERIFIED: npm, current 1.167.35] |
| @tanstack/react-query | ^5.90.20 | Server state management + data fetching | Recviz pattern [VERIFIED: npm, current 5.100.10] |
| @tanstack/react-query-devtools | ^5.91.3 | Dev-only query inspector | Recviz pattern [VERIFIED: npm] |
| zustand | ^5.0.11 | Client state management | Recviz pattern [VERIFIED: npm, current 5.0.13] |
| ag-grid-community | ^35.0.1 | AG-Grid base (required alongside enterprise) | Recviz pattern [VERIFIED: npm, current 35.3.0] |
| ag-grid-enterprise | ^35.0.1 | AG-Grid Enterprise (SSRM, grouping) | [VERIFIED: npm, current 35.3.0] |
| ag-grid-react | ^35.0.1 | AG-Grid React bindings | [VERIFIED: npm, current 35.3.0] |
| next-themes | ^0.4.6 | Dark/light mode provider | Recviz package.json lists it; recviz src uses custom ThemeProvider instead (see finding) [VERIFIED: npm, current 0.4.6] |
| lucide-react | ^0.563.0 | Icon library | Recviz pattern — pin to 0.5xx range matching recviz to avoid v1.x icon renames [VERIFIED: npm] |
| sonner | ^2.0.7 | Toast notifications (correlation ID error display) | Recviz pattern [VERIFIED: npm, current 2.0.7] |
| class-variance-authority | ^0.7.1 | shadcn variant utility | Recviz pattern [VERIFIED: npm, current 0.7.1] |
| clsx | ^2.1.1 | Class name utility | Recviz pattern [VERIFIED: npm, current 2.1.1] |
| tailwind-merge | ^3.4.0 | Tailwind class deduplication | Recviz pattern [VERIFIED: npm, current 3.6.0] |
| tw-animate-css | ^1.4.0 | shadcn animation CSS | Recviz pattern [VERIFIED: npm, current 1.4.0] |
| react-hook-form | ^7.x | Form handling (wired, Phase 2 uses minimal) | Phase 2 scaffold; current 7.75.0 [VERIFIED: npm] |
| zod | ^3.x | Schema validation | Phase 2 scaffold; current 4.4.3 — use ^3 to match recviz ecosystem [VERIFIED: npm] |

### Supporting (devDependencies)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @eslint/js | ^9.39.1 | ESLint base config | Required for flat config [VERIFIED: npm, current 10.3.0 — use recviz's ^9.39.1] |
| eslint | ^9.39.1 | Linter | Recviz pattern [VERIFIED: npm, 10.3.0 is latest — use recviz range] |
| eslint-plugin-react-hooks | ^7.0.1 | React hooks linting | [VERIFIED: npm] |
| eslint-plugin-react-refresh | ^0.4.24 | Fast refresh linting | [VERIFIED: npm] |
| typescript-eslint | ^8.48.0 | TypeScript ESLint | Recviz pattern [VERIFIED: npm, current 8.59.3] |
| globals | ^16.5.0 | ESLint global definitions | [VERIFIED: npm] |
| @types/react | ^19.2.7 | React types | [VERIFIED: npm] |
| @types/react-dom | ^19.2.3 | React DOM types | [VERIFIED: npm] |
| @types/node | ^24.10.1 | Node types for vite.config | Recviz pattern [VERIFIED: npm] |
| vitest | ^4.1.2 | Unit test runner | Recviz pattern; current 4.1.6 [VERIFIED: npm] |
| @testing-library/react | ^16.3.2 | React testing utilities | [VERIFIED: npm, current 16.3.2] |
| @testing-library/jest-dom | ^6.9.1 | DOM matchers for vitest | [VERIFIED: npm] |
| jsdom | ^29.0.1 | DOM environment for vitest | [VERIFIED: npm] |
| @radix-ui/react-slot | ^1.2.4 | Required by shadcn Button | Vendored by shadcn primitives [VERIFIED: recviz package.json] |

**Backend additions (Maven, no version needed — BOM-managed):**

```xml
<dependency>
    <groupId>io.micrometer</groupId>
    <artifactId>micrometer-tracing-bridge-brave</artifactId>
</dependency>
```

Managed version by Boot 3.5.14 BOM: **1.5.11** [VERIFIED: Spring Boot 3.5 dependency coordinates docs]

### Version Warning: Three Critical Divergences from "Latest"

1. **Vite**: Use `^7.3.1` NOT latest 8.x. npm `latest` is now 8.0.12. The CONTEXT decisions and recviz both target 7.x. Vite 8 requires research not done in Phase 2. Pin to 7.
2. **shadcn CLI**: Use `^3.8.4` (installs as devDependency). npm `latest` is 4.7.0 (major CLI rewrite). shadcn v4 introduced a full template system and new init flow; recviz uses 3.x and its `components.json` reflects the 3.x schema. Using 4.x changes the init UX and may alter component output.
3. **TypeScript**: Use `~5.9.3` (mirrors recviz). npm `latest` is 6.0.3. TypeScript 6 has erasableSyntaxOnly in tsconfig which recviz already uses, but the `~5.9.3` pin matches the tested recviz baseline.
4. **lucide-react**: Use `^0.563.0` (matches recviz). npm `latest` is 1.14.0. Icon names changed between 0.x and 1.x.

### Installation

```bash
# Inside frontend-react/
pnpm install

# Or npm fallback:
npm install
```

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (localhost:5173 dev / /rectrace/ prod)
    │
    ├─ TanStack Router → __root.tsx (ThemeProvider + QueryClientProvider + Toaster)
    │      └─ routes/index.tsx → AppShell layout → SmokeGrid
    │
    ├─ SmokeGrid (AG-Grid Enterprise, rowModelType: serverSide)
    │      └─ IServerSideDatasource.getRows()
    │             ├─ generates X-Correlation-Id = crypto.randomUUID().replace(/-/g, '')
    │             ├─ POST /rectrace/api/v4/search/ssrm/fileName
    │             └─ on success: params.success({ rowData: rows, rowCount: lastRow })
    │
    └─ AppShell footer → renders __BUILD_SHA__ (injected at build time by Vite define)
    
Backend (localhost:6088)
    │
    ├─ SecurityFilterChain → permit-all (Phase 1 D-1.8)
    ├─ CorsConfig → allowedOrigins("*") for dev
    ├─ Brave Propagator → reads X-Correlation-Id header → sets traceId in Brave context
    ├─ Micrometer Tracing → populates MDC.put("traceId", ...)
    ├─ logback-spring.xml → %X{traceId} in log pattern
    └─ SearchControllerV4 → POST /api/v4/search/ssrm/{category} → SSRMResponseV4

Ops surface
    ├─ ops/rectrace-ops.sh → start|stop|status|restart|logs for backend / tlm-stats / react
    └─ ops/build.sh react → pnpm build → rm static/ → cp dist/* → backend/static/
```

### Recommended Project Structure

```
frontend-react/
├── components.json             # shadcn config (new-york/mist/cssVariables)
├── eslint.config.js            # ESLint 9 flat config + hex-rejection rule
├── index.html
├── package.json                # packageManager: pnpm@9.x.x
├── pnpm-lock.yaml
├── vite.config.ts              # base, define.__BUILD_SHA__, plugins
├── vitest.config.ts            # separate from vite.config (recviz pattern)
├── tsconfig.json               # composite root
├── tsconfig.app.json           # strict ES2022 + bundler mode
├── tsconfig.node.json          # for vite.config.ts
├── .env.local.example          # VITE_AG_GRID_LICENSE_KEY placeholder
├── .gitignore                  # .env.local, dist/, node_modules/, .vite/
├── README.md                   # pnpm quickstart + npm fallback
└── src/
    ├── main.tsx                # createRoot + ModuleRegistry + LicenseManager
    ├── App.tsx                 # RouterProvider
    ├── index.css               # Tailwind imports + @theme inline + :root/.dark + AG theme bridge
    ├── lib/
    │   ├── utils.ts            # cn() helper (clsx + tailwind-merge)
    │   ├── queryClient.ts      # QueryClient + fetch wrapper with X-Correlation-Id
    │   ├── agGrid.ts           # LicenseManager.setLicenseKey() bootstrap
    │   └── theme.ts            # TS mirror of token variable names
    ├── components/
    │   ├── ui/                 # Vendored shadcn primitives (Button, Sonner, Card)
    │   └── app-shell/
    │       ├── footer.tsx      # Renders __BUILD_SHA__
    │       └── theme-toggle.tsx # ThemeSwitch component
    ├── grid/
    │   └── SmokeGrid.tsx       # AG-Grid SSRM against /api/v4/search/ssrm/fileName
    ├── hooks/                  # Custom hooks (empty in Phase 2)
    └── routes/
        ├── __root.tsx          # Root route: ThemeProvider + QueryClientProvider + Outlet
        └── index.tsx           # Hello-world route (renders AppShell + SmokeGrid)
```

### Pattern 1: Vite Config (mode-aware base + BUILD_SHA + plugins)

```typescript
// Source: vite.config.ts (verified from Vite docs + recviz pattern)
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import path from 'path'
import { execSync } from 'child_process'

function getGitSha(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return 'dev'
  }
}

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/rectrace/' : '/',
  plugins: [TanStackRouterVite(), react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    __BUILD_SHA__: JSON.stringify(getGitSha()),
  },
}))
```

The `base` function form (mode-aware) is the key delta from recviz (which has no `base` set). `getGitSha()` is synchronous and safe in Node module context. [VERIFIED: Vite docs via Context7]

**TypeScript ambient declaration required** (in `src/vite-env.d.ts` or separate file):

```typescript
declare const __BUILD_SHA__: string
```

### Pattern 2: shadcn Init Command + components.json

```bash
# D-2.6 says: style=new-york, baseColor=mist, cssVariables=true, lucide, no prefix
pnpm dlx shadcn@3.8.5 init
# Interactive prompts: new-york, mist, yes CSS variables, src/index.css, @/components/ui
```

The resulting `components.json` (verified from recviz live read):

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/index.css",
    "baseColor": "mist",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "lucide",
  "rtl": false,
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "registries": {}
}
```

`"config": ""` (empty string) is the Tailwind v4 marker. [VERIFIED: recviz `components.json` live read]

### Pattern 3: tokens.css Baseline (with empty Rectrace extensions block)

The full `src/index.css` for Phase 2, derived verbatim from recviz with the series/ramp/chart-positive tokens REMOVED and replaced by the empty extensions block:

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --radius-2xl: calc(var(--radius) + 8px);
  --radius-3xl: calc(var(--radius) + 12px);
  --radius-4xl: calc(var(--radius) + 16px);
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
  /* ================================================================
   * RECTRACE EXTENSIONS — currently empty
   * Chart/series/ramp tokens are deferred to the first phase that
   * introduces a chart or data-viz component. See STATE.md Deferred
   * Items table and Phase 8 DESIGN-01 anchor.
   *
   * To add tokens, read recviz src/index.css first:
   *   --color-series-1..8, --color-ramp-low/high,
   *   --color-chart-positive/negative/warning
   * DO NOT add tokens here without updating STATE.md and theme.ts.
   * ================================================================ */
}

:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.148 0.004 228.8);
  /* ... (full mist token set from recviz — see Code Examples section) */
}

/* AG Grid token bridge */
.ag-theme-quartz {
  --ag-background-color: var(--background);
  --ag-foreground-color: var(--foreground);
  /* ... (full bridge from recviz index.css) */
}
```

[VERIFIED: recviz `src/index.css` live read — full OKLCH token values documented in Code Examples section]

### Pattern 4: AG-Grid Enterprise 35 — Modular Registration + SSRM

AG-Grid 35 uses modular registration (not `AllEnterpriseModule` for production — only import what you need).

```typescript
// Source: main.tsx (AG-Grid React modular pattern)
import { ModuleRegistry } from 'ag-grid-community'
import {
  ServerSideRowModelModule,
  // Add other needed modules: RowGroupingModule, etc.
} from 'ag-grid-enterprise'
import { LicenseManager } from 'ag-grid-enterprise'

// Set license BEFORE any ModuleRegistry.registerModules call
LicenseManager.setLicenseKey(import.meta.env.VITE_AG_GRID_LICENSE_KEY ?? '')

// Register only what Phase 2 uses
ModuleRegistry.registerModules([ServerSideRowModelModule])
```

For the smoke grid, the datasource is minimal:

```typescript
// Source: SmokeGrid.tsx (pattern derived from AG-Grid docs + Angular source)
const datasource: IServerSideDatasource = {
  getRows: async (params) => {
    const correlationId = crypto.randomUUID().replace(/-/g, '')
    try {
      const body: SSRMRequestV4 = {
        category: 'fileName',
        initialFilter: null,       // smoke: no ES pre-filter
        rowGroupCols: [],
        groupKeys: [],
        sortModel: params.request.sortModel ?? [],
        filterModel: params.request.filterModel ?? {},
        startRow: params.request.startRow,
        endRow: params.request.endRow,
        visibleColumns: [],
      }
      const res = await fetch('/rectrace/api/v4/search/ssrm/fileName', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Correlation-Id': correlationId,
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: SSRMResponseV4 = await res.json()
      params.success({ rowData: data.rows, rowCount: data.lastRow })
    } catch (err) {
      console.error('SSRM fail', correlationId, err)
      params.fail()
    }
  },
}
```

[VERIFIED: AG-Grid docs via Context7; Angular `search-v5-grid.component.ts` SSRM pattern read; backend `SSRMRequestV4.java` + `SSRMResponseV4.java` DTOs read]

**SSRM Request/Response contract** (verified from backend DTOs):

```typescript
// SSRMRequestV4 shape (matches SSRMRequestV4.java exactly)
interface SSRMRequestV4 {
  category: string | null
  initialFilter: { column: string; values: string[] } | null  // InitialFilter.java
  rowGroupCols: string[]
  groupKeys: string[]
  sortModel: Array<{ colId: string; sort: 'asc' | 'desc' }>  // SortModel.java
  filterModel: Record<string, unknown>
  startRow: number
  endRow: number
  visibleColumns: string[]
}

// SSRMResponseV4 shape (matches SSRMResponseV4.java)
interface SSRMResponseV4 {
  rows: Array<Record<string, unknown>>
  lastRow: number
}
```

### Pattern 5: TanStack Router File-Based Routing (Phase 2 Recommendation)

**Recommendation: Use file-based routing with TanStackRouterVite plugin** even for one route. Rationale: recviz already uses this pattern; the vite.config.ts already has `TanStackRouterVite()` as the first plugin; the codegen produces `src/routeTree.gen.ts` automatically on `pnpm dev`; removing it later if unneeded is harder than keeping it consistent from the start.

```typescript
// vite.config.ts — TanStackRouterVite must be FIRST plugin
plugins: [TanStackRouterVite(), react(), tailwindcss()]
```

```typescript
// src/routes/__root.tsx — identical to recviz pattern
import { Outlet, createRootRoute } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '@/components/layout/theme-provider'
import { queryClient } from '@/lib/queryClient'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <Outlet />
        <Toaster richColors position="bottom-right" />
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ThemeProvider>
  )
}
```

```typescript
// src/routes/index.tsx
import { createFileRoute } from '@tanstack/react-router'
import { SmokeGrid } from '@/grid/SmokeGrid'

export const Route = createFileRoute('/')({
  component: IndexPage,
})

function IndexPage() {
  return <SmokeGrid />
}
```

[VERIFIED: TanStack Router v1 docs via Context7; recviz `src/routes/__root.tsx` live read]

### Pattern 6: Theme Provider (recviz custom context pattern, NOT next-themes)

**Critical finding:** recviz's `package.json` lists `next-themes` as a dependency, but the live `src/components/layout/theme-provider.tsx` is a **custom React context** implementation — it does NOT use `next-themes` internally. The custom provider:

- Uses `localStorage.getItem('recviz-theme')` for persistence
- Applies `classList.add(resolvedTheme)` on `document.documentElement`
- Handles `prefers-color-scheme` media query for system preference
- Exposes `useTheme()` hook

For Phase 2, the planner has two options:
1. **Mirror recviz exactly** — implement the same custom `ThemeProvider` and `ThemeSwitch` (the code is fully readable at `recviz/frontend/src/components/layout/`). **Recommended.**
2. Use `next-themes` `ThemeProvider` with `attribute="class"` (simpler, less code, same output).

The recviz custom provider works with `@custom-variant dark (&:is(.dark *))` in `index.css` (verified in recviz's `src/index.css`). The localStorage key should be changed to `'rectrace-theme'` for the rectrace app.

[VERIFIED: recviz `theme-provider.tsx` and `theme-switch.tsx` live read]

### Pattern 7: Fetch Wrapper + Correlation ID

```typescript
// src/lib/queryClient.ts
import { QueryClient, QueryCache } from '@tanstack/react-query'
import { toast } from 'sonner'

const BASE_URL = import.meta.env.DEV
  ? 'http://localhost:6088'
  : ''   // same-origin in prod

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const correlationId = crypto.randomUUID().replace(/-/g, '') // 32 hex = valid traceId
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      'X-Correlation-Id': correlationId,
    },
  })
  if (!res.ok) {
    throw Object.assign(new Error(`HTTP ${res.status}`), { correlationId })
  }
  return res
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      const corrId = (error as any).correlationId
      toast.error('Request failed', {
        description: corrId ? `Error reference: ${corrId}` : undefined,
      })
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
```

`crypto.randomUUID()` is available in all modern browsers (Chrome 92+, Firefox 95+, Safari 15.4+) without polyfill. The `.replace(/-/g, '')` strips 4 dashes to produce 32 lowercase hex = valid 128-bit W3C trace-id. [VERIFIED: MDN Web API baseline; W3C trace-context spec alignment]

### Pattern 8: Micrometer Tracing — Brave Bridge + X-Correlation-Id

**Maven dependency (BOM-managed, no version needed):**

```xml
<dependency>
    <groupId>io.micrometer</groupId>
    <artifactId>micrometer-tracing-bridge-brave</artifactId>
</dependency>
```

Add to both `backend/rectrace/pom.xml` and `rectrace-tlm-stats/pom.xml`. [VERIFIED: Spring Boot 3.5 BOM version = 1.5.11]

**What Boot 3.5 auto-configures** once `micrometer-tracing-bridge-brave` is on the classpath:
- A `Tracer` bean (backed by Brave)
- MDC population of `traceId` and `spanId` automatically for each request
- Sampling controlled by `management.tracing.sampling.probability` (default 0.1)

**Custom propagation approach** (two options for making `X-Correlation-Id` become the traceId):

**Option A (Recommended — Baggage + rename in filter):** Use Spring Boot's built-in baggage propagation to carry `X-Correlation-Id` as a field, then in a `Filter` extract the baggage value and use it in logging. The traceId remains Brave's own generated ID (or from B3/W3C headers). MDC will contain `traceId` from Brave automatically. This is simpler and less fragile.

```java
// application-local.properties
management.tracing.baggage.remote-fields=x-correlation-id
management.tracing.baggage.correlation.fields=x-correlation-id
management.tracing.sampling.probability=1.0
```

Result: `%X{x-correlation-id}` is available in logback pattern ALONGSIDE `%X{traceId}`. The user sees the same ID in error UI and backend logs because the client sends the same UUID as both `X-Correlation-Id` (read into baggage/MDC) and the React error display uses `correlationId` from the fetch wrapper.

**Option B (Full custom Propagation.Factory — more ceremony):** Implement `brave.propagation.Propagation.Factory` to read `X-Correlation-Id` as the `traceId` so the Brave traceId IS the correlation ID. This requires understanding Brave's internal `TraceContext` builder — significantly more code and risk of Brave version incompatibility. NOT recommended for Phase 2.

**Recommendation: Option A.** It achieves D-2.10's stated goal (the UUID the user quotes in error UI is the same hex string in backend logs) via two separate MDC keys (`traceId` from Brave + `x-correlation-id` from baggage), rather than forcing them to be the same internal ID. The planner should note this as an implementation clarification from the original D-2.10 intent.

**logback-spring.xml** (minimal, both modules, new file — neither module ships one today):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <include resource="org/springframework/boot/logging/logback/defaults.xml"/>
  <include resource="org/springframework/boot/logging/logback/console-appender.xml"/>
  <appender name="CONSOLE" class="ch.qos.logback.core.ConsoleAppender">
    <encoder>
      <pattern>%d{yyyy-MM-dd HH:mm:ss.SSS} [%thread] %-5level [traceId=%X{traceId:-}] [corrId=%X{x-correlation-id:-}] %logger{36} - %msg%n</pattern>
    </encoder>
  </appender>
  <root level="INFO">
    <appender-ref ref="CONSOLE"/>
  </root>
</configuration>
```

[VERIFIED: Spring Boot tracing docs; Context7 logback pattern MDC docs; baggage propagation configuration]

**Propagation type decision (B3 vs W3C):**

Boot 3.5 default: produces W3C (`traceparent` header); consumes W3C + B3 + B3_MULTI. The default is sufficient for Phase 2. No `management.tracing.propagation.*` override needed. The custom `X-Correlation-Id` baggage field propagates alongside whichever standard format is in use. For Phase 7 when an exporter is added, W3C (`traceparent`) is the modern standard. **Recommendation: leave propagation type at default (W3C produce, W3C+B3+B3_MULTI consume).**

### Pattern 9: ESLint 9 Flat Config + Hex Rejection

```javascript
// eslint.config.js — mirrors recviz + adds hex rule
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'src/components/ui/**']), // shadcn primitives exempt
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommendedTypeChecked,  // D-2.8: typed checks
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        project: ['./tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "Literal[value=/^#[0-9a-fA-F]{3,8}$/]",
          message: 'Use CSS tokens (var(--color-*)) instead of raw hex literals. See tokens.css.',
        },
      ],
    },
  },
])
```

Note: `recommendedTypeChecked` requires `parserOptions.project`. The `src/components/ui/**` glob in `globalIgnores` exempts vendored shadcn primitives. [VERIFIED: typescript-eslint docs; recviz `eslint.config.js` live read]

**Stylelint decision (open question resolution):** Do NOT add Stylelint in Phase 2. Rationale: The hex tokens in `tokens.css` are canonical OKLCH values (`:root { --background: oklch(1 0 0) }`) — they have no hex literals. Hex literals only appear in TypeScript/TSX components, which the ESLint rule covers. Phase 2 has no CSS-in-JS. Stylelint is a Phase 8 DESIGN-01 candidate if needed.

### Pattern 10: ops/rectrace-ops.sh v1 Structure

```bash
#!/usr/bin/env bash
# ops/rectrace-ops.sh v1 — runtime ops for rectrace services
# Phase 2 scope: start/stop/status/restart/logs for backend, tlm-stats, react
# Phase 8 OPS-01..04 hardens: set -euo pipefail, shellcheck, Linux compat, actuator probes

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$REPO_ROOT/run"
LOG_DIR="$REPO_ROOT/logs"

# Component definitions (OPS-03: component registry in ops/components.sh)
BACKEND_CMD="mvn spring-boot:run -f $REPO_ROOT/backend/rectrace/pom.xml -Dspring.profiles.active=local"
TLMSTATS_CMD="mvn spring-boot:run -f $REPO_ROOT/rectrace-tlm-stats/pom.xml -Dspring.profiles.active=local"
REACT_CMD="$(command -v pnpm >/dev/null 2>&1 && echo 'pnpm dev' || echo 'npm run dev')"
REACT_DIR="$REPO_ROOT/frontend-react"

# start_react uses pnpm-with-npm-fallback and HTTP 200 readiness probe (30s)
# PID files: $RUN_DIR/backend.pid, $RUN_DIR/tlmstats.pid, $RUN_DIR/react.pid
# Log files: $LOG_DIR/backend.log, $LOG_DIR/tlmstats.log, $LOG_DIR/react.log
```

Start backend/tlm-stats with `mvn spring-boot:run -Dspring.profiles.active=local` (matches Phase 1 D-1.14 local profile). Readiness probe for react: `curl -s -o /dev/null -w '%{http_code}' http://localhost:5173/` polling every 2s up to 30s total.

[ASSUMED: `mvn spring-boot:run` is the expected dev invocation vs `java -jar`; this matches Phase 1 patterns but planner should confirm with user]

### Pattern 11: ops/build.sh react

```bash
#!/usr/bin/env bash
# ops/build.sh — build pipeline for rectrace
# Usage: ops/build.sh react

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATIC_DIR="$REPO_ROOT/backend/rectrace/src/main/resources/static"

cmd="${1:-}"
case "$cmd" in
  react)
    echo "Building React app..."
    cd "$REPO_ROOT/frontend-react"
    if command -v pnpm >/dev/null 2>&1; then
      pnpm build
    else
      npm run build
    fi
    echo "Copying dist/ to backend static/..."
    rm -rf "$STATIC_DIR"          # Full clean — no Angular ghost files
    mkdir -p "$STATIC_DIR"
    cp -r dist/* "$STATIC_DIR/"
    echo "Build complete. Static dir: $STATIC_DIR"
    ;;
  *)
    echo "Usage: $0 react"
    exit 1
    ;;
esac
```

Full clean (`rm -rf static/`) is correct: the `static/` directory does not exist on disk now (verified), so creating it fresh avoids any residual Angular artifacts from manual copies. [VERIFIED: `backend/rectrace/src/main/resources/static/` confirmed absent]

### Anti-Patterns to Avoid

- **Importing `AllEnterpriseModule`** in production — tree-shaking fails; import specific modules only.
- **Calling `LicenseManager.setLicenseKey()` after `ModuleRegistry.registerModules()`** — license must be set first.
- **Committing `.env.local`** — must be in `.gitignore`; only `.env.local.example` is committed.
- **Using `next-themes`'s `ThemeProvider` with `attribute="data-theme"`** — recviz uses class-based (`classList.add(resolvedTheme)`); CSS uses `@custom-variant dark (&:is(.dark *))` which requires `.dark` class on `<html>`.
- **Naming `logback.xml`** (without `-spring`) — Spring Boot's `logback-spring.xml` supports profile-aware configuration; `logback.xml` loads before Spring, preventing `${spring.application.name}` substitution.
- **Putting build script logic in `rectrace-ops.sh`** — D-2.16 explicitly separates runtime ops from build pipeline.
- **Using Vite 8 instead of 7** — npm `latest` is 8.x; pin to `^7.3.1`.
- **Using shadcn 4.x CLI** — npm `latest` is 4.7.0; use `^3.8.4` to match recviz and its proven components.json schema.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Class name merging | Custom string concat | `cn()` from `clsx` + `tailwind-merge` | Handles Tailwind class conflicts correctly |
| UUID v4 generation | Custom RNG | `crypto.randomUUID()` | Cryptographically secure, browser-native, no polyfill needed (all modern browsers) |
| Toast notifications | Custom modal | `sonner` (already in stack) | Handles stacking, positioning, accessibility; Sonner is the recviz pattern |
| Correlation ID extraction from error | Custom Error subclass | Attach to Error object via `Object.assign` + read in QueryCache `onError` | Simple; avoids custom class hierarchy |
| Token CSS variable mapping | Inline style string | `@theme inline` block + CSS custom properties | Tailwind v4 reads custom properties natively |
| AG-Grid theme integration | Custom CSS override | AG-Grid Quartz theme token bridge in `index.css` | recviz ships exact bridge; copy verbatim |

**Key insight:** The shadcn + Tailwind v4 ecosystem handles the entire design-token-to-component pipeline; the AG-Grid token bridge in `index.css` closes the gap between Tailwind's CSS variables and AG-Grid's theming system. Custom CSS for grid cells should not be needed in Phase 2.

---

## Common Pitfalls

### Pitfall 1: Vite 8 Accidental Install

**What goes wrong:** `pnpm install vite` (without version pin) installs Vite 8.0.12. Phase 2 is designed for Vite 7.3.x. Vite 8 has not been vetted against this stack.
**Why it happens:** npm `latest` tag is now 8.x as of the research date.
**How to avoid:** Pin explicitly: `"vite": "^7.3.1"` in `package.json`. Verify with `pnpm why vite` after install.
**Warning signs:** `vite --version` prints `8.x.x`.

### Pitfall 2: Node.js Version Below 20.19

**What goes wrong:** Vite 7 requires Node.js `^20.19.0 || >=22.12.0`. Node 18 support was dropped. Any Node 18 LTS system will fail to install or run Vite 7.
**Why it happens:** Vite 7 is ESM-only; the Node minimum was raised to support `require(esm)` without flags. [VERIFIED: Vite 7 release notes, npm engines field]
**How to avoid:** Add `.nvmrc` with `v24` (dev machine) or `v20` (minimum). Add `"engines": { "node": "^20.19.0 || >=22.12.0" }` to `package.json`. Document in README.
**Warning signs:** `pnpm install` fails with Node version mismatch error.
**Dev machine status:** Current dev machine has Node 24.13.0 — well above minimum. [VERIFIED: environment probe]

### Pitfall 3: shadcn 4.x vs 3.x CLI Mismatch

**What goes wrong:** `pnpm dlx shadcn@latest init` installs CLI 4.7.0 which has a different init flow (template presets, monorepo). The resulting `components.json` schema may differ from recviz's.
**Why it happens:** shadcn 4.x was released and is now `latest`.
**How to avoid:** Always pin the CLI version: `pnpm dlx shadcn@3.8.5 init`. Confirm resulting `components.json` matches recviz exactly (verified template above).
**Warning signs:** CLI prompts ask for a "template" or "preset" — shadcn 4.x behavior, not 3.x.

### Pitfall 4: AG-Grid License Key Not Set Before Module Registration

**What goes wrong:** AG-Grid Enterprise renders with a "License Key Error" watermark. The grid still functions but the watermark cannot be dismissed at runtime.
**Why it happens:** `LicenseManager.setLicenseKey()` must execute before any `ModuleRegistry.registerModules()` call. Import order in `main.tsx` matters.
**How to avoid:** In `main.tsx`, call `LicenseManager.setLicenseKey()` as the very first executable line, before any module registration.
**Warning signs:** AG-Grid grid header shows a license warning overlay in dev.

### Pitfall 5: Missing `X-Correlation-Id` Baggage Configuration

**What goes wrong:** The backend receives `X-Correlation-Id` header but it does NOT appear in MDC logs — Brave's tracer ignores unknown headers by default.
**Why it happens:** Brave only propagates headers it knows about. Without `management.tracing.baggage.remote-fields=x-correlation-id`, the header is silently dropped.
**How to avoid:** Add to `application-local.properties` (and other profiles):
```properties
management.tracing.baggage.remote-fields=x-correlation-id
management.tracing.baggage.correlation.fields=x-correlation-id
management.tracing.sampling.probability=1.0
```
And add `%X{x-correlation-id:-}` to the logback pattern.
**Warning signs:** Curl test shows the header in the request but `grep "x-correlation-id" logs/backend.log` returns nothing.

### Pitfall 6: ThemeProvider Class vs Data-Attribute Mismatch

**What goes wrong:** Dark mode toggle does not apply styles — the CSS uses `&:is(.dark *)` but `next-themes` ThemeProvider with `attribute="data-theme"` adds a `data-theme` attribute to `<html>`, not a `.dark` class.
**Why it happens:** Tailwind v4 `@custom-variant dark (&:is(.dark *))` requires `.dark` class on `<html>`. If `next-themes` is used with `attribute="data-theme"` (or the default `attribute="class"` with value `"dark"` but without explicit configuration), the CSS variant won't match.
**How to avoid:** Either use the recviz custom ThemeProvider (which explicitly calls `classList.add(resolvedTheme)`) or configure `next-themes` with `attribute="class"`. The recviz pattern is safer. [VERIFIED: recviz theme-provider.tsx live read]

### Pitfall 7: Vite Dev Proxy Not Configured

**What goes wrong:** In dev mode, fetch to `/rectrace/api/v4/search/ssrm/fileName` returns 404 because Vite dev server doesn't know about the backend at localhost:6088. With `base: '/'` in dev, the path would be `/rectrace/api/...` which hits Vite's dev server, not the backend.
**Why it happens:** Cross-origin fetch from localhost:5173 to localhost:6088 works if CORS allows it (it does — CorsConfig has `allowedOrigins("*")`), but only if the URL is absolute.
**How to avoid:** In `queryClient.ts` / `SmokeGrid.tsx`, use `http://localhost:6088` as the base URL in dev mode (`import.meta.env.DEV`). In prod, use empty string (same-origin). OR configure a `server.proxy` in `vite.config.ts` to forward `/rectrace/api/` to `localhost:6088/rectrace/api/`. The proxy approach is cleaner (matches prod same-origin behavior). [ASSUMED: proxy approach is recommended; planner should verify]

### Pitfall 8: `logback.xml` instead of `logback-spring.xml`

**What goes wrong:** `logback.xml` loads before Spring context; `${spring.application.name}` substitution fails; profile-specific configuration not respected.
**How to avoid:** Always create `logback-spring.xml` (not `logback.xml`). Spring Boot docs explicitly require this for Spring-specific configuration. [CITED: docs.spring.io/spring-boot/reference/features/logging.html]

---

## Code Examples

### Full mist Color Tokens (verified from recviz src/index.css)

```css
/* Source: /Users/aarun/Workspace/Projects/recviz/frontend/src/index.css — live read */
:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.148 0.004 228.8);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.148 0.004 228.8);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.148 0.004 228.8);
  --primary: oklch(0.488 0.243 264.376);
  --primary-foreground: oklch(0.97 0.014 254.604);
  --secondary: oklch(0.967 0.001 286.375);
  --secondary-foreground: oklch(0.21 0.006 285.885);
  --muted: oklch(0.963 0.002 197.1);
  --muted-foreground: oklch(0.56 0.021 213.5);
  --accent: oklch(0.963 0.002 197.1);
  --accent-foreground: oklch(0.218 0.008 223.9);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.925 0.005 214.3);
  --input: oklch(0.925 0.005 214.3);
  --ring: oklch(0.723 0.014 214.4);
  --chart-1: oklch(0.809 0.105 251.813);
  --chart-2: oklch(0.623 0.214 259.815);
  --chart-3: oklch(0.546 0.245 262.881);
  --chart-4: oklch(0.488 0.243 264.376);
  --chart-5: oklch(0.424 0.199 265.638);
  --sidebar: oklch(0.987 0.002 197.1);
  --sidebar-foreground: oklch(0.148 0.004 228.8);
  --sidebar-primary: oklch(0.546 0.245 262.881);
  --sidebar-primary-foreground: oklch(0.97 0.014 254.604);
  --sidebar-accent: oklch(0.963 0.002 197.1);
  --sidebar-accent-foreground: oklch(0.218 0.008 223.9);
  --sidebar-border: oklch(0.925 0.005 214.3);
  --sidebar-ring: oklch(0.723 0.014 214.4);
}
.dark {
  --background: oklch(0.148 0.004 228.8);
  --foreground: oklch(0.987 0.002 197.1);
  --card: oklch(0.218 0.008 223.9);
  --card-foreground: oklch(0.987 0.002 197.1);
  --popover: oklch(0.218 0.008 223.9);
  --popover-foreground: oklch(0.987 0.002 197.1);
  --primary: oklch(0.424 0.199 265.638);
  --primary-foreground: oklch(0.97 0.014 254.604);
  --secondary: oklch(0.274 0.006 286.033);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.275 0.011 216.9);
  --muted-foreground: oklch(0.723 0.014 214.4);
  --accent: oklch(0.275 0.011 216.9);
  --accent-foreground: oklch(0.987 0.002 197.1);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.56 0.021 213.5);
  --chart-1: oklch(0.809 0.105 251.813);
  --chart-2: oklch(0.623 0.214 259.815);
  --chart-3: oklch(0.546 0.245 262.881);
  --chart-4: oklch(0.488 0.243 264.376);
  --chart-5: oklch(0.424 0.199 265.638);
  --sidebar: oklch(0.218 0.008 223.9);
  --sidebar-foreground: oklch(0.987 0.002 197.1);
  --sidebar-primary: oklch(0.623 0.214 259.815);
  --sidebar-primary-foreground: oklch(0.97 0.014 254.604);
  --sidebar-accent: oklch(0.275 0.011 216.9);
  --sidebar-accent-foreground: oklch(0.987 0.002 197.1);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.56 0.021 213.5);
}
```

### AG-Grid Quartz Theme Bridge (verbatim from recviz)

```css
/* Source: /Users/aarun/Workspace/Projects/recviz/frontend/src/index.css */
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

### package.json (Phase 2 baseline)

```json
{
  "name": "rectrace-frontend",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "packageManager": "pnpm@9.15.0",
  "engines": { "node": "^20.19.0 || >=22.12.0" },
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview",
    "typecheck": "tsc -b --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tailwind v3 `tailwind.config.ts` + `@tailwind` directives | Tailwind v4 CSS-first `@import "tailwindcss"` + `@theme inline` | Tailwind v4 (2025) | No config file; CSS is the config |
| `hsl()` colors in shadcn | `oklch()` colors in shadcn (mist palette) | shadcn 2024+ | Better perceptual uniformity; no backward conversion needed |
| AG-Grid `AllEnterpriseModule` bundle | Modular registration (`ServerSideRowModelModule`, etc.) | AG-Grid 31+ | Smaller bundles; only import needed modules |
| `import { LicenseManager } from 'ag-grid-enterprise'` then set license | Same pattern, but MUST be before `ModuleRegistry.registerModules()` | AG-Grid 32+ strict ordering | Boot sequence matters |
| Spring Cloud Sleuth | Micrometer Tracing (Boot 3 native) | Boot 3.0 (2022) | No Sleuth dependency; Boot 3.5 BOM manages micrometer-tracing |
| Custom MDC filter for correlation ID | Micrometer Tracing baggage (`remote-fields`) | Boot 3.2+ | Properties-only config; no Java filter code |
| `logback.xml` | `logback-spring.xml` | Boot 2+ | Required for Spring variable substitution |

**Deprecated/outdated:**
- `ExtraFieldPropagation` from older Brave versions: replaced by `BaggagePropagation` and Spring Boot's `management.tracing.baggage.*` properties.
- TanStack Router class-based `FileRoute`: replaced by `createFileRoute` function API.
- AG-Grid `successCallback(rows, lastRow)` parameter form: replaced by `params.success({ rowData, rowCount })` object form.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `mvn spring-boot:run -Dspring.profiles.active=local` is the expected dev invocation for backend and tlm-stats in ops script | Pattern 10 / D-2.15 | If user expects `java -jar target/*.jar`, script start command is wrong |
| A2 | Vite proxy (`server.proxy`) is the recommended approach for dev-mode cross-origin requests to localhost:6088 | Pitfall 7 | If user prefers absolute URL in fetch wrapper, proxy config is unnecessary |
| A3 | Spring Boot's baggage approach for X-Correlation-Id (Option A) satisfies D-2.10's intent ("same ID in error UI and backend logs") | Pattern 8 | If user strictly requires X-Correlation-Id header to become the Brave traceId (same 32-hex internal ID), Option B (custom Propagation.Factory) is needed — more code, higher risk |
| A4 | No Vite dev proxy is needed because `@CrossOrigin(origins="*")` in `SearchControllerV4` + `CorsConfig.allowedOrigins("*")` permits cross-origin fetch from localhost:5173 | Pitfall 7 | If CORS headers are missing for the OPTIONS preflight (they aren't per CorsConfig), grid will get CORS errors |
| A5 | `pnpm@9.15.0` is the appropriate pin (Corepack requires a specific version string in `packageManager` field) | Standard Stack | If user has a different pnpm 9.x version installed, Corepack may refuse to use it; run `corepack use pnpm@9` to auto-update |

---

## Open Questions

1. **Vite dev proxy vs absolute URL in fetch wrapper**
   - What we know: CORS is open on backend; both approaches work
   - What's unclear: Which pattern is preferred for consistency with prod (proxy mimics same-origin)
   - Recommendation: Use Vite proxy (`server.proxy: { '/rectrace/api': 'http://localhost:6088' }`) so dev and prod fetch code is identical (relative paths)

2. **ops/rectrace-ops.sh: `mvn spring-boot:run` vs `java -jar`**
   - What we know: Phase 1 used `mvn spring-boot:run` for dev; `java -jar` requires packaging first
   - What's unclear: User's day-to-day dev workflow preference
   - Recommendation: Use `mvn spring-boot:run -Dspring.profiles.active=local` for dev; Phase 8 can add `java -jar` for prod-like ops mode

3. **X-Correlation-Id as traceId vs as separate baggage field**
   - What we know: D-2.10 says "UUID the user quotes in error UI IS the backend's traceId" — implies they should be identical
   - What's unclear: Whether Option A (two separate MDC keys, user correlates them) or Option B (one key, X-Correlation-Id IS the traceId) is required
   - Recommendation: Option A (baggage) for Phase 2 simplicity; escalate to user if D-2.10's strict reading requires Option B

4. **pnpm version to pin in `packageManager` field**
   - What we know: Corepack 0.34.5 is installed; pnpm 10.29.2 is installed (not 9.x)
   - What's unclear: Whether the dev should run `corepack use pnpm@9` or whether pnpm 9 should be installed
   - Recommendation: Pin `"packageManager": "pnpm@9.15.0"` and document `corepack enable && corepack install` in README; the installed pnpm 10.x will be available as fallback

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vite 7 (requires ^20.19 or >=22.12) | ✓ | 24.13.0 | — |
| npm | pnpm fallback, package installs | ✓ | 11.6.2 | — |
| pnpm | Primary package manager | ✓ (as pnpm 10.29.2) | 10.29.2 — NOT 9.x | Use `corepack use pnpm@9` or `npm` fallback |
| Corepack | pnpm 9 via Corepack | ✓ | 0.34.5 | npm fallback documented |
| Maven 3.x | Backend/tlm-stats ops script | ✓ | 3.9.14 | — |
| Java 21 | Spring Boot 3.5.14 modules | ✓ | OpenJDK 21.0.10 (Homebrew) | — |
| git | `git rev-parse --short HEAD` for BUILD_SHA | ✓ | (git repo confirmed) | Fallback: 'dev' string |
| Oracle (local) | SSRM smoke against Phase 0.1 seed | [ASSUMED: yes, per Phase 0.1 completion] | Oracle 23c Free (Docker) | Cannot smoke SSRM without it |
| Elasticsearch (local) | Backend startup (Phase 1 D-1.4) | [ASSUMED: yes, per Phase 0.1 completion] | 8.13.4 (Docker) | Cannot start backend without it |

**Missing dependencies with no fallback:**
- Oracle + Elasticsearch local stack must be running (via `../rectrace-local-dev/` Docker compose) for the SSRM smoke test. Without them, the backend starts but SSRM queries will fail.

**pnpm version note:** The dev machine has pnpm 10.29.2 installed globally, not 9.x. The `packageManager: pnpm@9.x` field in `package.json` will cause Corepack to prompt for download of pnpm 9 when `corepack enable` is active. Planner must document this in README and include `corepack enable && corepack install` in the quickstart.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.6 (separate `vitest.config.ts`, recviz pattern) |
| Config file | `frontend-react/vitest.config.ts` (Wave 0 gap — must create) |
| Quick run command | `pnpm test` (alias for `vitest run`) |
| Full suite command | `pnpm test` (Phase 2 has no e2e; full suite = unit) |
| Type-check command | `pnpm typecheck` |
| Lint command | `pnpm lint` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REACT-01 | `pnpm build` exits 0 (build green) | smoke | `cd frontend-react && pnpm build` | Wave 0 gap |
| REACT-01 | `pnpm dev` serves HTTP 200 on localhost:5173 | smoke | `curl -s -o /dev/null -w '%{http_code}' http://localhost:5173/` | Wave 0 gap |
| REACT-02 | TanStack Router renders root route without error | unit | `pnpm test` on `src/routes/__root.test.tsx` | Wave 0 gap |
| REACT-03 | SSRM datasource returns 5 rows against local seed | integration smoke | `curl + grep` on backend log OR manual grid inspection | Manual (requires Docker stack) |
| REACT-04 | ESLint rejects a known hex literal fixture | lint | `echo "const x = '#ff0000'" > /tmp/bad.ts && pnpm lint /tmp/bad.ts` (or fixture file) | Wave 0 gap |
| REACT-04 | ESLint accepts `var(--color-primary)` | lint | Part of `pnpm lint` clean run | Wave 0 gap |
| REACT-05 | Dark/light toggle persists across reload (localStorage) | unit | `src/components/app-shell/theme-toggle.test.tsx` | Wave 0 gap |
| REACT-06 | Footer renders non-empty BUILD_SHA string | unit | `src/components/app-shell/footer.test.tsx` | Wave 0 gap |
| REACT-07 | X-Correlation-Id header appears in SSRM request | integration smoke | `curl -X POST .../ssrm/fileName && grep x-correlation-id logs/backend.log` | Manual |
| REACT-07 | Backend MDC log contains traceId | integration smoke | `grep "traceId=" logs/backend.log` after SSRM smoke | Manual |
| REACT-08 | `ops/rectrace-ops.sh start react` succeeds and `status` reports up | smoke | `ops/rectrace-ops.sh start react && ops/rectrace-ops.sh status react` | Wave 0 gap (ops script) |
| REACT-08 | `ops/build.sh react` copies dist/* to backend static/ | smoke | `ops/build.sh react && ls backend/rectrace/src/main/resources/static/` | Wave 0 gap (ops script) |

### Sampling Rate

- **Per task commit:** `pnpm lint && pnpm typecheck` (fast, <10s)
- **Per wave merge:** `pnpm test && pnpm build` (full unit + build verification)
- **Phase gate:** All unit tests green + build green + manual SSRM smoke + manual ops script smoke before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `frontend-react/vitest.config.ts` — test config (separate from vite.config per recviz pattern)
- [ ] `frontend-react/src/routes/__root.test.tsx` — covers REACT-02 routing mount
- [ ] `frontend-react/src/components/app-shell/footer.test.tsx` — covers REACT-06
- [ ] `frontend-react/src/components/app-shell/theme-toggle.test.tsx` — covers REACT-05 toggle + persist
- [ ] ESLint hex-rejection fixture file (`tests/fixtures/bad-hex.ts`) — covers REACT-04 negative case
- [ ] `ops/rectrace-ops.sh` — covers REACT-08 (created in implementation wave, not strictly Wave 0)
- [ ] `ops/build.sh` — covers REACT-08 build pipeline

---

## Project Constraints (from CLAUDE.md)

- **Backend**: Spring Boot 3.5.14 (already upgraded in Phase 1), Java 21
- **New frontend**: React, shadcn, mirroring recviz design language and structural patterns
- **Deployment**: Citi VM servers (Linux); single bash script is the operations surface
- **Development**: macOS laptop; all tooling must run locally
- **No Docker artifacts** in the repo (D-1.15 from Phase 1, inherited)
- **No Maven `frontend-maven-plugin`** (explicitly rejected in D-2 deferred list)
- **GSD workflow enforcement**: All edits via GSD execution phase, not direct file edits
- **Auth deferred**: Security phase (Phase 9); Phase 2 works with permit-all SecurityFilterChain
- **Angular stays**: Angular app remains until React go-live; ops script does NOT start Angular

---

## Sources

### Primary (HIGH confidence — live code read)

- `/Users/aarun/Workspace/Projects/recviz/frontend/package.json` — exact dependency versions confirmed
- `/Users/aarun/Workspace/Projects/recviz/frontend/components.json` — shadcn config confirmed
- `/Users/aarun/Workspace/Projects/recviz/frontend/src/index.css` — full OKLCH token set + AG-Grid bridge confirmed
- `/Users/aarun/Workspace/Projects/recviz/frontend/eslint.config.js` — flat config structure confirmed
- `/Users/aarun/Workspace/Projects/recviz/frontend/vite.config.ts` — plugins + alias confirmed
- `/Users/aarun/Workspace/Projects/recviz/frontend/src/main.tsx` — AG-Grid ModuleRegistry pattern confirmed
- `/Users/aarun/Workspace/Projects/recviz/frontend/src/routes/__root.tsx` — TanStack Router root route pattern confirmed
- `/Users/aarun/Workspace/Projects/recviz/frontend/src/components/layout/theme-provider.tsx` — custom ThemeProvider pattern confirmed
- `/Users/aarun/Workspace/Projects/recviz/frontend/src/lib/query-client.ts` — QueryClient pattern confirmed
- `/Users/aarun/Workspace/Projects/recviz/frontend/src/lib/api-client.ts` — fetch wrapper pattern confirmed
- `/Users/aarun/Workspace/Projects/recviz/frontend/tsconfig.app.json` + `tsconfig.node.json` — TS config confirmed
- `/Users/aarun/Workspace/Projects/recviz/frontend/vitest.config.ts` — separate vitest config pattern confirmed
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/dto/v4/SSRMRequestV4.java` — SSRM request shape confirmed
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/dto/v4/SSRMResponseV4.java` — SSRM response shape confirmed
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/dto/v4/InitialFilter.java` — InitialFilter shape confirmed
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/dto/v4/SortModel.java` — SortModel shape confirmed
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/CorsConfig.java` — wildcard CORS confirmed
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/SecurityConfig.java` — permit-all confirmed

### Primary (HIGH confidence — npm registry verified)

- `npm view vite version` → 8.0.12 (latest), 7.3.3 (latest 7.x) — use 7.x [VERIFIED]
- `npm view vite engines` → `{ node: '^20.19.0 || >=22.12.0' }` [VERIFIED]
- `npm view react version` → 19.2.6 [VERIFIED]
- `npm view ag-grid-enterprise version` → 35.3.0 [VERIFIED]
- `npm view @tanstack/react-router version` → 1.169.2 [VERIFIED]
- `npm view shadcn dist-tags` → latest: 4.7.0, latest 3.x: 3.8.5 [VERIFIED]
- `npm view typescript dist-tags` → latest: 6.0.3 [VERIFIED]

### Secondary (HIGH confidence — official docs)

- [Spring Boot 3.5 Dependency Versions](https://docs.spring.io/spring-boot/3.5/appendix/dependency-versions/coordinates.html) — micrometer-tracing-bridge-brave 1.5.11
- [Spring Boot Tracing Reference](https://docs.spring.io/spring-boot/reference/actuator/tracing.html) — baggage propagation, sampling.probability, MDC pattern
- [Vite 7 Release Blog](https://vite.dev/blog/announcing-vite7) — Node.js minimum, browser targets, breaking changes
- [AG-Grid React SSRM API](https://ag-grid.com/react-data-grid/server-side-model-api-reference) — getRows params shape via Context7
- [TanStack Router v1 createFileRoute](https://tanstack.com/router/v1/docs/api/router/createFileRouteFunction.md) — file-based routing API via Context7
- [shadcn Tailwind v4 guide](https://ui.shadcn.com/docs/tailwind-v4) — init flow, components.json schema

### Tertiary (MEDIUM confidence — web search verified with multiple sources)

- Brave baggage propagation pattern (`management.tracing.baggage.remote-fields`) — confirmed via Spring Boot docs + Baeldung + Spring issues
- `crypto.randomUUID()` browser support — MDN baseline; modern browser universal support confirmed
- UUID v4 without dashes = 32 hex chars = valid W3C 128-bit trace-id — W3C Trace Context spec alignment confirmed

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — all versions verified against npm registry and recviz live code
- Architecture: HIGH — recviz patterns read live; backend DTOs read live; SSRM contract verified
- Pitfalls: HIGH — verified from npm dist-tags (version divergences) and Spring Boot docs (tracing)
- Micrometer Tracing: MEDIUM-HIGH — BOM version verified; baggage approach confirmed from docs; custom Propagation.Factory (Option B) is ASSUMED more complex without explicit test

**Research date:** 2026-05-13
**Valid until:** 2026-06-13 (30 days; stable ecosystem but Vite 8 and shadcn 4 are live — recheck if delayed)
