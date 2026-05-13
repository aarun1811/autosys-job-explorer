# Rectrace — React Frontend

Net-new React SPA for Rectrace, built with Vite 7 + React 19 + shadcn (Tailwind v4) + AG-Grid Enterprise 35. Runs side-by-side with the existing Angular app during development; replaces Angular in production.

## Prerequisites

- **Node.js** >= 20.19.0
- **pnpm 9** via Corepack (preferred) — or npm (fallback, see below)

## Quickstart (pnpm — preferred)

```bash
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm install
cp .env.local.example .env.local
# Set VITE_AG_GRID_LICENSE_KEY in .env.local
# Copy the license string from frontend/rectrace/src/environments/environment.ts
# Do NOT commit the real value
pnpm dev
# App at http://localhost:5173/
```

## Quickstart (npm fallback — for developers without pnpm)

```bash
npm install
cp .env.local.example .env.local
# Set VITE_AG_GRID_LICENSE_KEY in .env.local
npm run dev
# App at http://localhost:5173/
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start the Vite dev server at http://localhost:5173/ |
| `pnpm build` | Production build (outputs to `dist/`) |
| `pnpm preview` | Serve the production build locally |
| `pnpm lint` | Run ESLint (flat config, hex-rejection rule enforced) |
| `pnpm typecheck` | Run `tsc --noEmit` |
| `pnpm test` | Run Vitest in CI mode |
| `pnpm test:watch` | Run Vitest in watch mode |

Use `npm run <script>` instead of `pnpm <script>` if using the npm fallback.

## Backend Connection

The dev server proxies `/rectrace/api` to `http://localhost:6088`. Start the backend first:

```bash
bash ops/rectrace-ops.sh start backend
```

The backend must be running before the SSRM grid will render data.

## Ops Script

To start all services:

```bash
bash ops/rectrace-ops.sh start all
```

From repo root. Manages backend, tlm-stats, and the React dev server. See `ops/rectrace-ops.sh` for available subcommands: `start`, `stop`, `restart`, `status`, `logs`.

## Build for Production

```bash
bash ops/build.sh react
```

Builds the React app and deploys to `backend/rectrace/src/main/resources/static/`, from which Spring Boot serves it at `/rectrace/`. Run from repo root.

## Design Tokens

Design tokens live in `src/index.css` (OKLCH mist palette via shadcn + Tailwind v4 `@theme inline`). The `RECTRACE EXTENSIONS` block is intentionally empty — see STATE.md Deferred Items for the auto-surface mechanism. Chart/series/ramp tokens are added in the phase that introduces the first chart or data-viz component (tracked in `.planning/STATE.md`; Phase 8 DESIGN-01 audits the lot).

## AG-Grid License

Set `VITE_AG_GRID_LICENSE_KEY` in `.env.local` (gitignored). Copy the value from `frontend/rectrace/src/environments/environment.ts`. Do NOT commit the real value to the repo.
