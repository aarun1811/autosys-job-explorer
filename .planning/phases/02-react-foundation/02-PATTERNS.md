# Phase 2: React Foundation - Pattern Map

**Mapped:** 2026-05-13
**Files analyzed:** 37 new/modified files across frontend-react/, backend, tlm-stats, ops/, and planning docs
**Analogs found:** 27 / 37 (10 net-new with no in-repo analog; recviz fills the gap for all 10)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `frontend-react/package.json` | config | — | `/Users/aarun/Workspace/Projects/recviz/frontend/package.json` | exact-recviz |
| `frontend-react/pnpm-lock.yaml` | config | — | (generated) | none |
| `frontend-react/vite.config.ts` | config | — | `/Users/aarun/Workspace/Projects/recviz/frontend/vite.config.ts` | role-match (delta: base, define) |
| `frontend-react/tsconfig.json` | config | — | `/Users/aarun/Workspace/Projects/recviz/frontend/tsconfig.json` | exact-recviz |
| `frontend-react/tsconfig.app.json` | config | — | `/Users/aarun/Workspace/Projects/recviz/frontend/tsconfig.app.json` | exact-recviz |
| `frontend-react/tsconfig.node.json` | config | — | `/Users/aarun/Workspace/Projects/recviz/frontend/tsconfig.node.json` | exact-recviz |
| `frontend-react/eslint.config.js` | config | — | `/Users/aarun/Workspace/Projects/recviz/frontend/eslint.config.js` | role-match (delta: hex rule, globalIgnores) |
| `frontend-react/components.json` | config | — | `/Users/aarun/Workspace/Projects/recviz/frontend/components.json` | exact-recviz (copy verbatim) |
| `frontend-react/index.html` | config | — | recviz `index.html` | role-match |
| `frontend-react/.env.local.example` | config | — | no analog | none (trivial template) |
| `frontend-react/.gitignore` | config | — | `frontend/rectrace/.gitignore` | role-match |
| `frontend-react/vitest.config.ts` | config | — | `/Users/aarun/Workspace/Projects/recviz/frontend/vitest.config.ts` | exact-recviz |
| `frontend-react/src/main.tsx` | provider | — | `/Users/aarun/Workspace/Projects/recviz/frontend/src/main.tsx` | role-match (delta: no charts, selective modules, LicenseManager first) |
| `frontend-react/src/App.tsx` | component | request-response | recviz `src/App.tsx` (RouterProvider) | role-match |
| `frontend-react/src/index.css` | config | — | `/Users/aarun/Workspace/Projects/recviz/frontend/src/index.css` | exact-recviz (delta: empty extensions block) |
| `frontend-react/src/lib/utils.ts` | utility | — | `/Users/aarun/Workspace/Projects/recviz/frontend/src/lib/utils.ts` | exact-recviz (copy verbatim) |
| `frontend-react/src/lib/theme.ts` | utility | — | no direct analog | none (new file; mirrors CSS variables) |
| `frontend-react/src/lib/queryClient.ts` | utility | request-response | `/Users/aarun/Workspace/Projects/recviz/frontend/src/lib/query-client.ts` | role-match (delta: adds X-Correlation-Id, apiFetch wrapper) |
| `frontend-react/src/lib/agGrid.ts` | utility | — | no analog | none (new file; single call) |
| `frontend-react/src/components/layout/theme-provider.tsx` | provider | event-driven | `/Users/aarun/Workspace/Projects/recviz/frontend/src/components/layout/theme-provider.tsx` | exact-recviz (delta: STORAGE_KEY only) |
| `frontend-react/src/components/layout/theme-switch.tsx` | component | event-driven | `/Users/aarun/Workspace/Projects/recviz/frontend/src/components/layout/theme-switch.tsx` | exact-recviz (copy verbatim) |
| `frontend-react/src/components/app-shell/footer.tsx` | component | — | recviz `src/components/layout/header.tsx` (structural reference) | partial-match |
| `frontend-react/src/components/ui/button.tsx` | component | — | recviz `src/components/ui/button.tsx` (shadcn-generated) | exact-recviz (vendored via shadcn CLI) |
| `frontend-react/src/components/ui/sonner.tsx` | component | event-driven | recviz `src/components/ui/sonner.tsx` (shadcn-generated) | exact-recviz (vendored via shadcn CLI) |
| `frontend-react/src/components/ui/card.tsx` | component | — | recviz `src/components/ui/card.tsx` (shadcn-generated) | exact-recviz (vendored via shadcn CLI) |
| `frontend-react/src/grid/SmokeGrid.tsx` | component | SSRM/request-response | Angular `SearchV5GridComponent` (structural); RESEARCH.md Pattern 4 | partial-match (SSRM contract match; tech differs) |
| `frontend-react/src/routes/__root.tsx` | route | request-response | `/Users/aarun/Workspace/Projects/recviz/frontend/src/routes/__root.tsx` | exact-recviz |
| `frontend-react/src/routes/index.tsx` | route | — | `/Users/aarun/Workspace/Projects/recviz/frontend/src/routes/index.tsx` | role-match (no redirect; render SmokeGrid) |
| `backend/rectrace/pom.xml` | config | — | existing `backend/rectrace/pom.xml` (add dependency block) | exact (prior dep patterns) |
| `rectrace-tlm-stats/pom.xml` | config | — | existing `rectrace-tlm-stats/pom.xml` (add dependency block) | exact (prior dep patterns) |
| `backend/rectrace/src/main/java/.../config/CorrelationIdPropagationConfig.java` | config | — | `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/SecurityConfig.java` | role-match (`@Configuration @Profile("!test")`) |
| `backend/rectrace/src/main/resources/logback-spring.xml` | config | — | no existing analog (new file) | none (RESEARCH.md Pattern 8 is the template) |
| `rectrace-tlm-stats/src/main/java/.../config/CorrelationIdPropagationConfig.java` | config | — | same as backend analog above | role-match |
| `rectrace-tlm-stats/src/main/resources/logback-spring.xml` | config | — | no existing analog (new file) | none |
| `backend/rectrace/src/main/resources/application-local.properties` | config | — | existing `application-local.properties` (add 3 lines) | exact |
| `rectrace-tlm-stats/src/main/resources/application-local.properties` | config | — | existing `application-local.properties` (add 3 lines) | exact |
| `ops/rectrace-ops.sh` | utility | — | `.claude/hooks/gsd-validate-commit.sh` (bash structure) | partial-match (bash patterns only) |
| `ops/build.sh` | utility | — | same | partial-match |
| `.planning/ROADMAP.md` | doc | — | existing file (line edits) | exact |
| `.planning/REQUIREMENTS.md` | doc | — | existing file (line edits) | exact |

---

## Pattern Assignments

### `frontend-react/package.json` (config)

**Analog:** `/Users/aarun/Workspace/Projects/recviz/frontend/package.json`

**Copy base structure verbatim, apply these deltas:**

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

**Recviz dependency list to mirror (lines 14–66 of recviz package.json):**
- Remove from recviz: `@monaco-editor/react`, `ag-charts-enterprise`, `ag-charts-react`, `cmdk`, `date-fns`, `echarts`, `echarts-for-react`, `motion`, `radix-ui`, `react-day-picker`, `react-grid-layout`, `react-resizable-panels`, `sql-formatter`
- Add to recviz: `react-hook-form ^7.x`, `zod ^3.x`, `tw-animate-css ^1.4.0` (move from devDep to dep), `@radix-ui/react-slot ^1.2.4`
- Add to devDependencies: `@testing-library/react ^16.3.2`, `@testing-library/jest-dom ^6.9.1`, `vitest ^4.1.2`, `jsdom ^29.0.1`
- Keep from recviz devDependencies: all ESLint + TypeScript + Tailwind + Vite + shadcn entries at their exact versions

**Critical version pins (do not upgrade):**
- `"vite": "^7.3.1"` — NOT 8.x (npm latest is 8.0.12)
- `"shadcn": "^3.8.4"` — NOT 4.x (npm latest is 4.7.0)
- `"typescript": "~5.9.3"` — NOT 6.x (npm latest is 6.0.3)
- `"lucide-react": "^0.563.0"` — NOT 1.x (icon names changed)

---

### `frontend-react/vite.config.ts` (config)

**Analog:** `/Users/aarun/Workspace/Projects/recviz/frontend/vite.config.ts` (lines 1–14)

**Recviz base (lines 1–14):**
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import path from 'path'

export default defineConfig({
  plugins: [TanStackRouterVite(), react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

**Phase 2 delta — wrap in function form, add `base`, `define`, `server.proxy`:**
```typescript
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
    alias: { '@': path.resolve(__dirname, './src') },
  },
  define: {
    __BUILD_SHA__: JSON.stringify(getGitSha()),
  },
  server: {
    proxy: {
      '/rectrace/api': 'http://localhost:6088',
    },
  },
}))
```

**Also requires** `src/vite-env.d.ts` ambient declaration:
```typescript
/// <reference types="vite/client" />
declare const __BUILD_SHA__: string
```

---

### `frontend-react/tsconfig.json` + `tsconfig.app.json` + `tsconfig.node.json` (config)

**Analog:** `/Users/aarun/Workspace/Projects/recviz/frontend/tsconfig.json` (lines 1–14), `tsconfig.app.json` (lines 1–30), `tsconfig.node.json` (lines 1–26)

**tsconfig.json — copy verbatim** (recviz lines 1–14):
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```
Note: drop `tsconfig.e2e.json` reference (no Playwright in Phase 2).

**tsconfig.app.json — copy verbatim** (recviz lines 1–30):
```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "types": ["vite/client"],
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] },
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true
  },
  "include": ["src"]
}
```

**tsconfig.node.json — copy verbatim** (recviz lines 1–26), but change `include` to:
```json
"include": ["vite.config.ts", "vitest.config.ts"]
```
(recviz includes `playwright.config.ts` which Phase 2 does not have)

---

### `frontend-react/eslint.config.js` (config)

**Analog:** `/Users/aarun/Workspace/Projects/recviz/frontend/eslint.config.js` (lines 1–23)

**Recviz base (lines 1–23) — copy structure, apply deltas:**
```javascript
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),              // recviz original
  // ...
])
```

**Phase 2 delta — add globalIgnores entry + upgrade to recommendedTypeChecked + add hex rule:**
```javascript
export default defineConfig([
  globalIgnores(['dist', 'src/components/ui/**']),  // exempt vendored shadcn
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommendedTypeChecked,  // upgrade from recommended
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

---

### `frontend-react/components.json` (config)

**Analog:** `/Users/aarun/Workspace/Projects/recviz/frontend/components.json` (lines 1–24)

**Copy verbatim — no changes needed:**
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

`"config": ""` is the Tailwind v4 marker. Do NOT set `"config": "tailwind.config.ts"`.

---

### `frontend-react/vitest.config.ts` (config)

**Analog:** `/Users/aarun/Workspace/Projects/recviz/frontend/vitest.config.ts` (lines 1–15)

**Copy verbatim** (recviz lines 1–15):
```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',  // change from recviz's 'node' — Phase 2 tests render React
    exclude: ['node_modules/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

Delta from recviz: `environment: 'jsdom'` (recviz uses `'node'` because it has no DOM tests; Phase 2 smoke test renders React components).

---

### `frontend-react/src/main.tsx` (provider)

**Analog:** `/Users/aarun/Workspace/Projects/recviz/frontend/src/main.tsx` (lines 1–19)

**Recviz (lines 1–19):**
```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ModuleRegistry as ChartModuleRegistry, AllEnterpriseModule as AllChartsEnterpriseModule } from 'ag-charts-enterprise'
import { ModuleRegistry as GridModuleRegistry } from 'ag-grid-community'
import { AllEnterpriseModule } from 'ag-grid-enterprise'
import './index.css'
import App from './App'

ChartModuleRegistry.registerModules([AllChartsEnterpriseModule])
GridModuleRegistry.registerModules([AllEnterpriseModule])

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
)
```

**Phase 2 version (critical order: LicenseManager → ModuleRegistry → createRoot):**
```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LicenseManager } from 'ag-grid-enterprise'
import { ModuleRegistry } from 'ag-grid-community'
import { ServerSideRowModelModule } from 'ag-grid-enterprise'
import './index.css'
import App from './App'

// License MUST be set before any ModuleRegistry.registerModules() call
LicenseManager.setLicenseKey(import.meta.env.VITE_AG_GRID_LICENSE_KEY ?? '')
ModuleRegistry.registerModules([ServerSideRowModelModule])

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
)
```

Deltas from recviz: no chart modules; `ServerSideRowModelModule` only (not `AllEnterpriseModule`); `LicenseManager.setLicenseKey` added before registration.

---

### `frontend-react/src/index.css` (config)

**Analog:** `/Users/aarun/Workspace/Projects/recviz/frontend/src/index.css` (full file — recviz content verified in RESEARCH.md Code Examples)

**Structure (in this exact order):**
```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  /* radius scale */
  --radius-sm: calc(var(--radius) - 4px);
  /* ... full radius scale from RESEARCH.md Pattern 3 ... */

  /* color bridge */
  --color-background: var(--background);
  /* ... full color bridge from RESEARCH.md Pattern 3 ... */

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
  /* ... full mist :root block from RESEARCH.md Code Examples ... */
}

.dark {
  --background: oklch(0.148 0.004 228.8);
  --foreground: oklch(0.987 0.002 197.1);
  /* ... full .dark block from RESEARCH.md Code Examples ... */
}

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

Full OKLCH token values are in RESEARCH.md Code Examples section (verbatim from live recviz read).

---

### `frontend-react/src/lib/utils.ts` (utility)

**Analog:** `/Users/aarun/Workspace/Projects/recviz/frontend/src/lib/utils.ts` (lines 1–6)

**Copy verbatim:**
```typescript
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

---

### `frontend-react/src/lib/queryClient.ts` (utility, request-response)

**Analog:** `/Users/aarun/Workspace/Projects/recviz/frontend/src/lib/query-client.ts` (lines 1–24)

**Recviz base (lines 1–24):**
```typescript
import { QueryCache, QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      if (error instanceof ApiError) {
        toast.error(error.userMessage, {
          description: `Error code: ${error.code}`,
        })
      }
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

**Phase 2 version — replace ApiError with correlationId pattern; add apiFetch wrapper:**
```typescript
import { QueryClient, QueryCache } from '@tanstack/react-query'
import { toast } from 'sonner'

const BASE_URL = import.meta.env.DEV
  ? 'http://localhost:6088'
  : ''

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const correlationId = crypto.randomUUID().replace(/-/g, '')
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
      const corrId = (error as { correlationId?: string }).correlationId
      toast.error('Request failed', {
        description: corrId
          ? `Error reference: ${corrId}`
          : 'Something went wrong. Check the browser console for details.',
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

Key delta: `apiFetch` generates `crypto.randomUUID().replace(/-/g, '')` per call (32 hex = valid 128-bit traceId). `QueryCache.onError` reads `.correlationId` from the thrown error.

---

### `frontend-react/src/lib/agGrid.ts` (utility)

**No direct analog.** This is a single-call bootstrap module.

```typescript
// Exported for explicit import in main.tsx — keeps the bootstrap call visible
// and co-located with its env-var dependency.
export function initAgGridLicense(): void {
  // Called before ModuleRegistry.registerModules() — see main.tsx
  // The actual LicenseManager.setLicenseKey() call lives in main.tsx to
  // guarantee execution order. This module exports the env-var constant only.
}

export const AG_GRID_LICENSE_KEY = import.meta.env.VITE_AG_GRID_LICENSE_KEY ?? ''
```

Alternative: inline the constant directly in `main.tsx` and skip this file. Planner decides; the RESEARCH.md recommendation is to keep it in `main.tsx` for ordering clarity.

---

### `frontend-react/src/lib/theme.ts` (utility)

**No direct analog.** TS-side mirror of CSS variable names from `index.css`.

Pattern: export a `const tokens` object with every variable name from the `:root` block as a key, mapped to its `var(--)` string:

```typescript
export const tokens = {
  background: 'var(--background)',
  foreground: 'var(--foreground)',
  card: 'var(--card)',
  cardForeground: 'var(--card-foreground)',
  // ... all variables from index.css :root
  // RECTRACE EXTENSIONS (empty — see index.css comment)
} as const

export type TokenKey = keyof typeof tokens
```

---

### `frontend-react/src/components/layout/theme-provider.tsx` (provider, event-driven)

**Analog:** `/Users/aarun/Workspace/Projects/recviz/frontend/src/components/layout/theme-provider.tsx` (lines 1–62)

**Copy verbatim with one delta** (line 13):
```diff
- const STORAGE_KEY = 'recviz-theme'
+ const STORAGE_KEY = 'rectrace-theme'
```

Full file (lines 1–62 from recviz):
```typescript
import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark' | 'system'

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: 'light' | 'dark'
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

const STORAGE_KEY = 'rectrace-theme'  // <-- only delta from recviz

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'system'
    return (localStorage.getItem(STORAGE_KEY) as Theme) ?? 'system'
  })

  const resolvedTheme = theme === 'system' ? getSystemTheme() : theme

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(resolvedTheme)
  }, [resolvedTheme])

  useEffect(() => {
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = () => {
        const root = document.documentElement
        root.classList.remove('light', 'dark')
        root.classList.add(getSystemTheme())
      }
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
  }, [theme])

  const setTheme = (t: Theme) => {
    localStorage.setItem(STORAGE_KEY, t)
    setThemeState(t)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
```

---

### `frontend-react/src/components/layout/theme-switch.tsx` (component, event-driven)

**Analog:** `/Users/aarun/Workspace/Projects/recviz/frontend/src/components/layout/theme-switch.tsx` (lines 1–29)

**Copy verbatim — no deltas:**
```typescript
import { useState, useEffect } from 'react'
import { MoonIcon, SunIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from './theme-provider'

export function ThemeSwitch() {
  const [mounted, setMounted] = useState(false)
  const { resolvedTheme, setTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <Button
      size="icon-sm"
      variant="ghost"
      className="relative"
      onClick={() => setTheme(resolvedTheme === 'light' ? 'dark' : 'light')}
    >
      {resolvedTheme === 'light' ? <MoonIcon /> : <SunIcon />}
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
```

---

### `frontend-react/src/components/app-shell/footer.tsx` (component)

**Analog:** `/Users/aarun/Workspace/Projects/recviz/frontend/src/components/layout/header.tsx` (structural reference — lines 44–76 show the class list pattern: `sticky top-0 z-50`, `border-b`, `backdrop-blur-md`, spacing `px-4`)

**Pattern to follow (header structural reference, inverted to footer):**
```typescript
// Copy class-name pattern from recviz header (line 44):
// className="bg-background/40 sticky top-0 z-50 flex h-(--header-height) ... border-b backdrop-blur-md"
// Footer mirrors: border-t, px-4, text-muted-foreground text-[12px]
export function Footer() {
  return (
    <footer className="border-t px-4 py-2 text-muted-foreground text-[12px]">
      <span>Rectrace · Build: {__BUILD_SHA__} · v0.1.0</span>
    </footer>
  )
}
```

Requires `declare const __BUILD_SHA__: string` from `vite-env.d.ts`.

---

### `frontend-react/src/routes/__root.tsx` (route, request-response)

**Analog:** `/Users/aarun/Workspace/Projects/recviz/frontend/src/routes/__root.tsx` (lines 1–42)

**Copy verbatim, apply one delta — swap `queryClient` import path:**
```typescript
import { Outlet, createRootRoute, type ErrorComponentProps } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { AlertTriangle } from 'lucide-react'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '@/components/layout/theme-provider'
import { queryClient } from '@/lib/queryClient'  // delta: rectrace path (not query-client)

function RootErrorComponent({ error }: ErrorComponentProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="size-6 text-destructive" />
      </div>
      <p className="font-medium">Something went wrong</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        {error?.message || 'An unexpected error occurred.'}
      </p>
    </div>
  )
}

export const Route = createRootRoute({
  component: RootLayout,
  errorComponent: RootErrorComponent,
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

---

### `frontend-react/src/routes/index.tsx` (route)

**Analog:** `/Users/aarun/Workspace/Projects/recviz/frontend/src/routes/index.tsx` (lines 1–7 — structure only; recviz redirects, Phase 2 renders)

**Phase 2 version (no redirect; render AppShell with SmokeGrid):**
```typescript
import { createFileRoute } from '@tanstack/react-router'
import { SmokeGrid } from '@/grid/SmokeGrid'
import { ThemeSwitch } from '@/components/layout/theme-switch'
import { Footer } from '@/components/app-shell/footer'

export const Route = createFileRoute('/')({
  component: IndexPage,
})

function IndexPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="bg-background/40 sticky top-0 z-50 flex items-center justify-between px-4 border-b backdrop-blur-md" style={{ height: 'var(--header-height, 2.5rem)' }}>
        <span className="text-sm font-semibold">Rectrace</span>
        {/* future search slot — Phase 3 */}
        <div className="flex-1" />
        <ThemeSwitch />
      </header>
      <main className="flex-1 overflow-auto p-4">
        <SmokeGrid />
      </main>
      <Footer />
    </div>
  )
}
```

Header class list mirrors recviz's `header.tsx` line 44: `bg-background/40 sticky top-0 z-50 ... border-b backdrop-blur-md`.

---

### `frontend-react/src/grid/SmokeGrid.tsx` (component, SSRM)

**Analog (structural contract):** Angular `SearchV5GridComponent` (SSRM datasource pattern). No React analog exists; use RESEARCH.md Pattern 4 as the implementation template.

**Core SSRM datasource pattern (RESEARCH.md Pattern 4):**
```typescript
import { AgGridReact } from 'ag-grid-react'
import type { IServerSideDatasource, ColDef } from 'ag-grid-community'

const columnDefs: ColDef[] = [
  { field: 'jobName', headerName: 'Job Name', width: 200 },
  { field: 'fileName', headerName: 'File Name', width: 200 },
  { field: 'machine', headerName: 'Machine', width: 150 },
  { field: 'status', headerName: 'Status', width: 120 },
]

const datasource: IServerSideDatasource = {
  getRows: async (params) => {
    const correlationId = crypto.randomUUID().replace(/-/g, '')
    try {
      const body = {
        category: 'fileName',
        initialFilter: null,
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
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { correlationId })
      const data = await res.json()
      params.success({ rowData: data.rows, rowCount: data.lastRow })
    } catch (err) {
      console.error('SSRM fail', correlationId, err)
      params.fail()
    }
  },
}

export function SmokeGrid() {
  return (
    <div className="ag-theme-quartz h-[calc(100vh-6rem)]">
      <AgGridReact
        rowModelType="serverSide"
        serverSideDatasource={datasource}
        columnDefs={columnDefs}
        overlayNoRowsTemplate="<span>No seed data found</span>"
      />
    </div>
  )
}
```

**SSRM request/response interface** (matches `SSRMRequestV4.java` + `SSRMResponseV4.java`):
```typescript
interface SSRMRequestV4 {
  category: string | null
  initialFilter: { column: string; values: string[] } | null
  rowGroupCols: string[]
  groupKeys: string[]
  sortModel: Array<{ colId: string; sort: 'asc' | 'desc' }>
  filterModel: Record<string, unknown>
  startRow: number
  endRow: number
  visibleColumns: string[]
}

interface SSRMResponseV4 {
  rows: Array<Record<string, unknown>>
  lastRow: number
}
```

---

### `backend/rectrace/pom.xml` and `rectrace-tlm-stats/pom.xml` (config)

**Analog:** `backend/rectrace/pom.xml` existing dependency block structure (lines 33–93)

**Pattern — add inside `<dependencies>` after the last existing entry, no version (BOM-managed):**
```xml
<dependency>
    <groupId>io.micrometer</groupId>
    <artifactId>micrometer-tracing-bridge-brave</artifactId>
</dependency>
```

BOM-managed version via Boot 3.5.14 parent: `1.5.11`. Add identically to both `backend/rectrace/pom.xml` and `rectrace-tlm-stats/pom.xml`. The existing pom structure for both modules already follows BOM-managed dep entries with no explicit version (e.g., `spring-boot-starter-web`, `spring-boot-starter-actuator`).

---

### `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/CorrelationIdPropagationConfig.java` (config)

**Analog:** `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/SecurityConfig.java` (lines 1–41)

**Key patterns to copy from SecurityConfig.java:**
```java
// Lines 29-32: Profile guard + annotation set — copy exactly for new config classes
@Profile("!test")
@Configuration
@EnableWebSecurity  // <- NOT this one; remove for TracingConfig
public class SecurityConfig {
```

```java
// Lines 35-40: Bean method pattern — single @Bean method, constructor-style
@Bean
public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
    http
        .csrf(csrf -> csrf.disable())
        .authorizeHttpRequests(authz -> authz.anyRequest().permitAll());
    return http.build();
}
```

**Phase 2 TracingConfig (Option A — baggage propagation, recommended over Option B):**
```java
package com.citi.gru.rectrace.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

/**
 * No-op configuration class for Micrometer Tracing + Brave bridge in Phase 2.
 *
 * <p>Boot 3.5.14 auto-configures the Brave Tracer and MDC population when
 * {@code micrometer-tracing-bridge-brave} is on the classpath.
 * {@code X-Correlation-Id} propagation is handled via Spring Boot baggage
 * config in {@code application-local.properties} (Option A):
 * <pre>
 *   management.tracing.baggage.remote-fields=x-correlation-id
 *   management.tracing.baggage.correlation.fields=x-correlation-id
 * </pre>
 * No custom {@code Propagation.Factory} bean is needed for Phase 2.
 *
 * <p>The {@code @Profile("!test")} guard matches the pattern established in
 * {@code SecurityConfig} (Phase 1 D-1.17).
 */
@Profile("!test")
@Configuration
public class CorrelationIdPropagationConfig {
    // Boot auto-config handles Tracer bean and MDC population.
    // X-Correlation-Id appears in MDC as 'x-correlation-id' via baggage config.
    // Phase 7 OBS-01 owns the full propagation/exporter pipeline.
}
```

Apply the identical class to `rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/config/CorrelationIdPropagationConfig.java` (change package to `com.citi.gru.rectrace.tlmstats.config`).

---

### `backend/rectrace/src/main/resources/logback-spring.xml` (config, new file)

**No existing analog in repo.** Use RESEARCH.md Pattern 8 as the implementation template.

> **Note:** Option A baggage config was superseded by D-2.10 → custom Brave Propagation.Factory during planning; traceId MDC value IS the X-Correlation-Id header value when valid hex(32) is supplied. The pattern below reflects the implemented Option B from Plan 02-02.

**Pattern (both modules, identical — Option B: `%X{traceId:-}` ONLY):**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <include resource="org/springframework/boot/logging/logback/defaults.xml"/>
  <appender name="CONSOLE" class="ch.qos.logback.core.ConsoleAppender">
    <encoder>
      <pattern>%d{yyyy-MM-dd HH:mm:ss.SSS} [%thread] %-5level [traceId=%X{traceId:-}] %logger{36} - %msg%n</pattern>
    </encoder>
  </appender>
  <root level="INFO">
    <appender-ref ref="CONSOLE"/>
  </root>
</configuration>
```

Do NOT include `%X{x-correlation-id:-}` in the pattern. Under Option B the custom `CorrelationIdPropagationConfig.extractor()` adopts the X-Correlation-Id header value as the Brave `traceId`; no separate `x-correlation-id` MDC key is populated. The traceId MDC field IS the correlation ID.

**Critical:** file must be named `logback-spring.xml` (not `logback.xml`) — Spring Boot loads `logback-spring.xml` after context is ready, enabling Spring property substitution and profile-aware config. Phase 7 OBS-01 replaces this minimal pattern with the full JSON layout via `logstash-logback-encoder`.

---

### `backend/rectrace/src/main/resources/application-local.properties` (config, add lines)

**Analog:** existing `application-local.properties` (lines 1–50) — append 3 lines to the end

```properties
# Micrometer Tracing — Brave bridge (Phase 2 D-2.9, D-2.10, D-2.12)
management.tracing.sampling.probability=1.0
management.tracing.baggage.remote-fields=x-correlation-id
management.tracing.baggage.correlation.fields=x-correlation-id
```

Apply identically to `rectrace-tlm-stats/src/main/resources/application-local.properties`.

---

### `ops/rectrace-ops.sh` (utility, ops)

**Analog:** `.claude/hooks/gsd-validate-commit.sh` (lines 1–57) — provides bash structural patterns: `#!/usr/bin/env bash`, `REPO_ROOT` calculation, function structure

**Key patterns from gsd-validate-commit.sh:**
```bash
# Line 1: shebang
#!/usr/bin/env bash

# REPO_ROOT pattern (equivalent — adapt for ops/ subdir):
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
```

**Phase 2 ops script structure (RESEARCH.md Pattern 10):**
```bash
#!/usr/bin/env bash
# ops/rectrace-ops.sh v1 — runtime ops for rectrace services
# Usage: ops/rectrace-ops.sh <start|stop|status|restart|logs> <backend|tlm-stats|react>
# Phase 2 scope: v1 — no set -euo pipefail, no shellcheck; Phase 8 OPS-01..04 hardens this.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$REPO_ROOT/run"
LOG_DIR="$REPO_ROOT/logs"

mkdir -p "$RUN_DIR" "$LOG_DIR"

# Component: backend
BACKEND_CMD="mvn spring-boot:run -f $REPO_ROOT/backend/rectrace/pom.xml -Dspring.profiles.active=local"
BACKEND_PID="$RUN_DIR/backend.pid"
BACKEND_LOG="$LOG_DIR/backend.log"
BACKEND_READY="curl -s -o /dev/null -w '%{http_code}' http://localhost:6088/rectrace/actuator/health"

# Component: tlm-stats
TLMSTATS_CMD="mvn spring-boot:run -f $REPO_ROOT/rectrace-tlm-stats/pom.xml -Dspring.profiles.active=local"
TLMSTATS_PID="$RUN_DIR/tlmstats.pid"
TLMSTATS_LOG="$LOG_DIR/tlmstats.log"

# Component: react
if command -v pnpm >/dev/null 2>&1; then
  REACT_CMD="pnpm dev"
else
  REACT_CMD="npm run dev"
fi
REACT_DIR="$REPO_ROOT/frontend-react"
REACT_PID="$RUN_DIR/react.pid"
REACT_LOG="$LOG_DIR/react.log"
REACT_READY_URL="http://localhost:5173/"

# Readiness probe: poll HTTP 200 with 30s timeout
wait_ready() {
  local url="$1"
  local timeout=30
  local elapsed=0
  while [ $elapsed -lt $timeout ]; do
    if [ "$(curl -s -o /dev/null -w '%{http_code}' "$url")" = "200" ]; then
      return 0
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done
  return 1
}
```

No Angular component. PID files in `run/`, logs in `logs/`. `command -v pnpm` fallback is the canonical pattern.

---

### `ops/build.sh` (utility, build pipeline)

**Analog:** same bash structural pattern from `.claude/hooks/gsd-validate-commit.sh`

**Phase 2 build script (RESEARCH.md Pattern 11):**
```bash
#!/usr/bin/env bash
# ops/build.sh — build pipeline for rectrace
# Usage: ops/build.sh react
# Separated from rectrace-ops.sh per D-2.16: runtime ops != build pipeline.

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
    echo "Cleaning backend static/ and copying dist/..."
    rm -rf "$STATIC_DIR"          # Full clean — no Angular ghost files
    mkdir -p "$STATIC_DIR"
    cp -r dist/* "$STATIC_DIR/"
    echo "Done. Static: $STATIC_DIR"
    ;;
  *)
    echo "Usage: $0 react"
    exit 1
    ;;
esac
```

Full clean (`rm -rf static/`) is correct: `static/` directory does not exist on disk (verified), and Phase 2 expects only React artifacts in `static/`.

---

## Shared Patterns

### `@Profile("!test")` Guard on New Beans
**Source:** `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/SecurityConfig.java` (line 29)
**Apply to:** All new `@Configuration` classes in both Maven modules — specifically `CorrelationIdPropagationConfig.java`
```java
@Profile("!test")
@Configuration
public class CorrelationIdPropagationConfig {
    // ...
}
```
This matches Phase 0 and Phase 1's established pattern: test profile excludes infrastructure auto-configs, and the `@Profile("!test")` guard keeps new beans off the test boot path.

### Single `@Bean` Method Config Pattern
**Source:** `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/CorsConfig.java` (lines 1–22)
**Apply to:** Any new `@Configuration` that needs to register a single bean
```java
@Configuration
public class CorsConfig {
    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                // ...
            }
        };
    }
}
```

### pnpm-with-npm-fallback in Shell Scripts
**Source:** RESEARCH.md Pattern 10 (no existing analog — establish as Phase 2 canonical)
**Apply to:** Both `ops/rectrace-ops.sh` and `ops/build.sh`
```bash
if command -v pnpm >/dev/null 2>&1; then
  pnpm_or_npm="pnpm"
else
  pnpm_or_npm="npm run"
fi
```

### CSS Token Reference Pattern (no raw hex)
**Source:** `/Users/aarun/Workspace/Projects/recviz/frontend/src/components/layout/theme-switch.tsx` (lines 19–26)
**Apply to:** All `*.tsx` component files — use Tailwind utility classes or `var(--)` references; never raw hex
```tsx
// Correct: Tailwind utility referencing CSS token
<Button variant="ghost" className="relative text-foreground">

// Correct: var() reference
style={{ color: 'var(--foreground)' }}

// WRONG (ESLint error per D-2.8):
style={{ color: '#1a2b3c' }}
```

### Properties File Append Pattern
**Source:** `backend/rectrace/src/main/resources/application-local.properties` (lines 1–50)
**Apply to:** Both `application-local.properties` files for tracing config additions
```properties
# Heading comment with phase number and decision anchor
management.tracing.sampling.probability=1.0
management.tracing.baggage.remote-fields=x-correlation-id
management.tracing.baggage.correlation.fields=x-correlation-id
```

### REPO_ROOT Calculation in Bash
**Source:** `.claude/hooks/gsd-validate-commit.sh` (adapted)
**Apply to:** `ops/rectrace-ops.sh`, `ops/build.sh`
```bash
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
```
This is robust for symlinked directories and works in both bash 3.2 (macOS) and bash 4/5 (Linux).

---

## shadcn Component Vendoring

Vendored components are generated by the shadcn CLI and should NOT be hand-authored. Run after `pnpm install`:

```bash
# From frontend-react/
pnpm dlx shadcn@3.8.5 add button
pnpm dlx shadcn@3.8.5 add sonner
pnpm dlx shadcn@3.8.5 add card
```

Generated output locations:
- `frontend-react/src/components/ui/button.tsx`
- `frontend-react/src/components/ui/sonner.tsx`
- `frontend-react/src/components/ui/card.tsx`

These files are exempt from the hex-rejection ESLint rule via `globalIgnores(['src/components/ui/**'])`.

---

## No Analog Found

Files with no close match in the codebase (planner should use RESEARCH.md patterns directly):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `frontend-react/src/lib/theme.ts` | utility | — | No TS token mirror exists in Angular frontend; simple const export |
| `frontend-react/src/lib/agGrid.ts` | utility | — | No AG-Grid bootstrap in React exists; single-call pattern |
| `backend/rectrace/src/main/resources/logback-spring.xml` | config | — | Neither module ships a logback file today; use RESEARCH.md Pattern 8 verbatim |
| `rectrace-tlm-stats/src/main/resources/logback-spring.xml` | config | — | Same as above |
| `frontend-react/.env.local.example` | config | — | Trivial template; one line: `VITE_AG_GRID_LICENSE_KEY=` |
| `frontend-react/src/App.tsx` | provider | — | Minimal `RouterProvider` wrapper; TanStack Router generates the boilerplate |
| `frontend-react/index.html` | config | — | Standard Vite HTML entrypoint; TanStack Router docs provide template |
| `frontend-react/src/vite-env.d.ts` | config | — | Single ambient declaration; Vite docs provide template |
| `.planning/ROADMAP.md` edits | doc | — | Line-level text edits; no pattern needed |
| `.planning/REQUIREMENTS.md` edits | doc | — | Line-level text edits; no pattern needed |

---

## Metadata

**Analog search scope:** `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/`, `backend/rectrace/src/main/resources/`, `rectrace-tlm-stats/src/main/resources/`, `rectrace-tlm-stats/pom.xml`, `.claude/hooks/`, `/Users/aarun/Workspace/Projects/recviz/frontend/` (primary reference)
**Files scanned:** 22 in-repo + 12 recviz
**Pattern extraction date:** 2026-05-13

---

## Implementation Notes for Planner

1. **Commit wave ordering matters for AG-Grid:** Wave that adds `LicenseManager.setLicenseKey()` must ship in the same wave as `ModuleRegistry.registerModules()` to avoid a commit state where the grid runs unlicensed.

2. **logback-spring.xml is a new file in both modules:** Neither `backend/rectrace/src/main/resources/` nor `rectrace-tlm-stats/src/main/resources/` contains this file today. The planner should create both as new files (not edits).

3. **`static/` directory does not exist on disk:** `backend/rectrace/src/main/resources/static/` is absent (confirmed). `ops/build.sh react` must `mkdir -p` before copying.

4. **Option A vs Option B for correlation propagation:** RESEARCH.md recommends Option A (baggage config in `application-local.properties`). The `CorrelationIdPropagationConfig.java` class is a no-op in this case — it exists only to document the decision and carry the `@Profile("!test")` guard. If the planner opts for Option B (custom `Propagation.Factory`), the analog is still `SecurityConfig.java` for the `@Configuration @Profile("!test")` envelope, but the bean method will be a Brave `Propagation.Factory` implementation.

5. **recviz analog confidence:** All recviz-sourced patterns are HIGH confidence (files read live). The recviz `main.tsx` uses `AllEnterpriseModule` — do NOT copy that line; Phase 2 uses `ServerSideRowModelModule` only.
