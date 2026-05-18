# Phase 2: React Foundation - Context

**Gathered:** 2026-05-13
**Status:** Ready for planning

<domain>
## Phase Boundary

A net-new React shell (`frontend-react/`) is scaffolded as a top-level sibling to the existing `frontend/rectrace/` Angular module, using **Vite 7 + React 19 + TypeScript + shadcn (Tailwind v4) + AG-Grid Enterprise via `ag-grid-react`** with the **TanStack Router + TanStack Query + Zustand + React Hook Form + Zod** runtime stack — mirroring `recviz/frontend/`'s shape so patterns transfer 1:1. The shell renders an empty SSRM grid against `/api/v4/search/ssrm/fileName` (using the Phase 0.1 local seed for visible rows), surfaces the build SHA in the footer, exposes a dark/light toggle at parity with the Angular app, propagates a single end-to-end correlation ID via Micrometer Tracing's Boot-3 native bridge (`micrometer-tracing-bridge-brave`) with a custom `X-Correlation-Id` propagator (so the UUID the user quotes in error UI literally **is** the backend's `traceId`), and ships a Phase-1-class `ops/rectrace-ops.sh` v1 that manages backend, tlm-stats, and the new React process — **Angular is intentionally excluded from the ops script** because Angular is being decommissioned at React go-live (D-2.4) and there is no long-term coexistence. Production deployment retains today's pattern: the React `dist/` is copied into `backend/rectrace/src/main/resources/static/` and served by Spring at `/rectrace/` (no `/v6/` or `/ui/` prefix — Angular's current base href is reused intact at switchover).

**In scope:**
- Scaffold `frontend-react/` (Vite 7 + React 19 + TS 5.6+) with pnpm 9 (via Corepack) as the primary package manager; documented npm fallback in `frontend-react/README.md`.
- `shadcn init` with **style: new-york**, **baseColor: mist**, **cssVariables: true**, lucide icons, Tailwind v4 CSS-first `@theme inline` — recviz baseline reproduced 1:1.
- `frontend-react/src/index.css` with shadcn baseline tokens + a labeled but **empty** "Rectrace extensions" overlay block (chart/series/ramp tokens deferred — see D-2.7); `theme.ts` TS-side mirror.
- ESLint 9 flat config (`eslint.config.js`) matching recviz's setup (`@eslint/js` + `typescript-eslint` recommendedTypeChecked + `react-hooks` + `react-refresh`) plus a custom `no-restricted-syntax` rule rejecting raw hex literals in component/CSS-in-JS sources (REACT-04).
- TanStack Router + TanStack Query + Zustand + React Hook Form + Zod wired with a single root layout and one hello-world route (`/`). Recviz alias scheme (`@/components`, `@/lib/utils`, `@/components/ui`, `@/lib`, `@/hooks`).
- AG-Grid Enterprise 35 via `ag-grid-react`, SSRM datasource wired against `/api/v4/search/ssrm/fileName` (Phase 0.1 local seed renders 5 rows). License key plumbed via `VITE_AG_GRID_LICENSE_KEY` at build time; `.env.local` for dev (in `.gitignore`).
- Dark/light mode via `next-themes` (recviz pattern); toggle component in the app shell; persisted; system-preference default.
- Build SHA / version surfaced in footer via Vite `define` injecting `__BUILD_SHA__` from `git rev-parse --short HEAD` at build time.
- Vite `base: '/rectrace/'` for prod build, `base: '/'` for dev — production deploys to `classpath:/static/` exactly like Angular does today.
- Correlation-ID end-to-end:
  - **Backend** (`backend/rectrace` + `rectrace-tlm-stats`): add `micrometer-tracing-bridge-brave` dependency to both modules; ship a custom Brave `Propagation` impl that reads/writes `X-Correlation-Id` (UUID v4 with dashes stripped → 32 hex chars → valid 128-bit `traceId`); `management.tracing.sampling.probability=1.0` in dev/local; `logback-spring.xml` log pattern updated to include `%X{traceId}` in both modules. **No exporter** (Zipkin/Jaeger), **no Prometheus**, **no slow-query AOP** — those are Phase 7.
  - **Frontend**: fetch wrapper co-located with the TanStack Query client generates a UUID v4 per HTTP request (dashes stripped) and sends as `X-Correlation-Id`; the query meta carries it so error UI can render `Error — reference: <ID>` (REACT-07 / SEARCH-06 anchor).
- `ops/rectrace-ops.sh` v1 — runtime ops only (start/stop/status/restart/logs). Registers **three** components: backend, tlm-stats, react. **NO angular row.** PID files in `run/`, logs in `logs/`. React `start` runs `pnpm dev` with a `command -v pnpm` fallback to `npm run dev`. Readiness probe: `curl http://localhost:5173/` for HTTP 200 with a 30s timeout.
- `ops/build.sh` v1 — separate build pipeline script. `build.sh react` runs `pnpm build` in `frontend-react/`, then copies `dist/*` into `backend/rectrace/src/main/resources/static/`. (Future verb `build.sh package` invoking `mvn package` is anticipated but not required in Phase 2.)
- ROADMAP.md and REQUIREMENTS.md edits to reflect D-2.4 + D-2.15 supersessions (drop `/v6/` references; remove `angular` from Phase 2 SC#5 and REACT-08).

**Out of scope for Phase 2:**
- **Real search UI** — Phase 3 ports the search vertical slice end-to-end. Phase 2 only proves the AG-Grid SSRM contract works against an existing backend endpoint.
- **Cell renderers** (`appIDCellRenderer`, `executionOrderButtonRenderer`, etc.) — Phase 3 per parity matrix.
- **Excel export, recent searches, URL-state sync** — Phase 3 (SEARCH-03/04/05).
- **recviz iframe embedding** — Phase 4.
- **Micrometer Tracing exporter** (Zipkin/Jaeger/OTel collector), **Prometheus metrics**, **slow-query AOP**, **JSON log format via logstash-logback-encoder**, **HealthIndicator beans**, **log aggregator forwarder** — Phase 7 (OBS-01..08).
- **Chart/series/ramp/heatmap design tokens** — deferred until the first chart/data-viz component lands (auto-surfaced via STATE.md Deferred Items + tokens.css comment marker + Phase 8 DESIGN-01 anchor).
- **Visual regression testing** (Playwright + Percy/Chromatic) — Phase 8 DESIGN-02.
- **ESLint hex-rejection over `recviz`-vendored components** — only enforced on rectrace-authored sources; vendored shadcn primitives are exempt via override.
- **Auth filter / `x-citiportal-loginid` validation** — Phase 9 (SEC-01).
- **ES SSL truststore, CORS lockdown, Citi CA, internal Nexus / Verdaccio routing** — Phase 9 (SEC-03..06).
- **`shellcheck` CI on `rectrace-ops.sh`, Linux portability test, actuator-health readiness probe** — Phase 8 (OPS-01..04).
- **AG-Grid Enterprise license served from a backend endpoint** (vs build-time env injection) — possible future improvement; deferred unless it surfaces a rotation pain point.
- **Maven `frontend-maven-plugin` (auto-build React during `mvn package`)** — explicitly rejected; build is the responsibility of `ops/build.sh react`. Reconsider if CI integration ever asks for a single Maven entrypoint.
- **TanStack Router code-generation / file-based routing config polish** — researcher decides if the Phase 2 hello-world route warrants the full file-based config or just a tiny manual route declaration.

</domain>

<decisions>
## Implementation Decisions

### Project layout & tooling

- **D-2.1:** `frontend-react/` lives as a **top-level sibling** to `frontend/rectrace/` inside this repo. Not nested under `frontend/`.
- **D-2.2:** Package manager is **pnpm 9** via Corepack (`"packageManager": "pnpm@9.x.x"` in `package.json`). README documents the equivalent `npm` command sequence as a fallback for developers without pnpm. Planner verifies at plan time that the Citi VM Node version is ≥ 18 and that `corepack enable` succeeds behind the Citi proxy.
- **D-2.3:** Dev server port is Vite's default **5173** (matches recviz; no collision with Angular 4200 / backend 6088 / tlm-stats 8080).

### URL prefix & deployment

- **D-2.4:** **No `/ui/` and no `/v6/` URL prefix.** Vite `base: '/rectrace/'` for the production build (matches Angular's current `baseHref: /rectrace/`); `base: '/'` for dev. The production build artifact deploys to `backend/rectrace/src/main/resources/static/` and is served by Spring at `/rectrace/`. Angular is decommissioned at React go-live (no long-term coexistence in prod/UAT). If UAT side-by-side review ever becomes a need, the fix is a 2-line Vite `base` change plus a Spring static-route alternation — captured as a deferred idea.
- **D-2.5:** **D-2.4 supersedes** the `/v6/` example URL in `REQUIREMENTS.md` SEARCH-07 ("e.g. `/v6/`") and the `/v6/` mention in `ROADMAP.md` Phase 3 SC#1. Planner proposes a small ROADMAP/REQUIREMENTS edit during plan-phase (or defers as a documentation-hygiene task — either is acceptable).

### Design tokens & shadcn

- **D-2.6:** Run `pnpm dlx shadcn init` with **style: new-york**, **baseColor: mist**, **cssVariables: true**, lucide icons, prefix `''`, RTL false. This matches recviz's `components.json` 1:1. Aliases mirror recviz exactly: `@/components`, `@/lib/utils`, `@/components/ui`, `@/lib`, `@/hooks`. Tailwind v4 CSS-first via `@theme inline` (reuse recviz's pattern).
- **D-2.7:** `tokens.css` ships the shadcn baseline (bg/fg, card, popover, primary, secondary, muted, accent, destructive, sidebar suite, border, ring, radius scale) PLUS a clearly-labeled **empty** "Rectrace extensions" block with a header comment pointing to recviz's `src/index.css` (`--series-*`, `--ramp-*`, `--chart-positive/negative/warning`) and the Phase 8 DESIGN-01 audit anchor. `theme.ts` mirrors the variable set on the TS side. **Chart/series/ramp tokens are NOT shipped in Phase 2.** They are added in the phase that introduces the first chart or data-viz component.

  **Auto-surface mechanism (per user requirement):**
  1. STATE.md "Deferred Items" table gets a row: *"Add chart/series/ramp tokens — surfaces when first chart/data-viz component is planned"*. Every `/gsd-discuss-phase` invocation reads STATE.md, so the reminder fires automatically.
  2. The empty "Rectrace extensions" block in `tokens.css` contains an inline comment instructing any developer who needs to add a chart token to read this entry first.
  3. Phase 8 DESIGN-01 in CONTEXT.md (when that phase is discussed) gets an explicit cross-check item against this overlay block.

- **D-2.8:** ESLint 9 flat config (`eslint.config.js`) matching recviz: `@eslint/js` + `typescript-eslint` (`recommendedTypeChecked`) + `react-hooks` + `react-refresh`. Custom `no-restricted-syntax` rule rejecting `Literal` nodes whose value matches `/^#[0-9a-fA-F]{3,8}$/` in `*.{ts,tsx,css}` source files. The vendored `components/ui/` shadcn primitives are exempt via override (their internal color usage is canonical via shadcn).

### Correlation ID + Micrometer Tracing

- **D-2.9:** Phase 2 adds `micrometer-tracing-bridge-brave` (the Boot-3 native bridge) to **both Maven modules** (`backend/rectrace`, `rectrace-tlm-stats`). Boot 3.5 auto-wires a `Tracer` bean and populates MDC. `management.tracing.sampling.probability=1.0` in dev/local; default (`0.1`) in prod/UAT until Phase 7. **No exporter** (Zipkin/Jaeger), **no Prometheus**, **no slow-query AOP** — those are Phase 7 (OBS-01..08).
- **D-2.10:** Custom Brave `Propagation` implementation that reads/writes the `X-Correlation-Id` HTTP header. A UUID v4 with dashes stripped is exactly 32 hex characters, which is a valid W3C `traceparent` 128-bit traceId. The `X-Correlation-Id` the user sees in error UI **is** the backend's `traceId` — single ID end to end, no duplication, no two-IDs-for-one-request confusion. Planner picks `B3` vs `W3C` propagation alongside `X-Correlation-Id` (Brave defaults to `B3`; adding W3C is one config line).
- **D-2.11:** Client originates the correlation ID. A fetch wrapper (co-located with the TanStack Query `QueryClient` setup) generates a UUID v4 (dashes stripped) per HTTP request and sends it as `X-Correlation-Id`. Backend honors the inbound header as the `traceId` source via D-2.10. If the header is absent (curl, scheduler-internal calls), backend's tracer generates its own `traceId` — graceful fallback. The query meta carries the client-side ID so the React error UI can render `Error — reference: <ID>` (REACT-07 / SEARCH-06 anchor) even on network failures where the response never arrived.
- **D-2.12:** `logback-spring.xml` log pattern in **both Maven modules** is updated in Phase 2 to include `%X{traceId}` (just `traceId`; no `spanId` because there are no nested spans yet). Phase 7 OBS-01 will replace the pattern entirely with structured JSON via `logstash-logback-encoder` 8.x. The pattern update in this phase is intentionally minimal — adds the trace ID to plain-text dev logs, nothing more.

### SSRM smoke + AG-Grid Enterprise license

- **D-2.13:** The Phase 2 SSRM smoke target is **`/rectrace/api/v4/search/ssrm/fileName`** against the Phase 0.1 local seed (`../rectrace-local-dev/` Oracle + ES, 5 fully-connected scenarios including 2 hyphenated). The user sees 5 actual rows in dev mode, proving the entire stack end-to-end: SSRM request/response envelope, JSON shape compatibility, `X-Correlation-Id` propagation, AG-Grid Enterprise license activation, dark/light theme on a real grid.
- **D-2.14:** AG-Grid Enterprise license key is plumbed via Vite's environment-variable mechanism: `VITE_AG_GRID_LICENSE_KEY` is read from `.env.local` (in `.gitignore`) in dev and from CI/VM-injected environment in prod. A bootstrap module calls `LicenseManager.setLicenseKey(import.meta.env.VITE_AG_GRID_LICENSE_KEY)` exactly once at app startup. For the laptop quick-start, the developer can copy the license string out of `frontend/rectrace/src/environments/environment.ts` into `frontend-react/.env.local`. Backend-served license (alternative pattern, easier rotation) is deferred.

### Ops scripts (REACT-08)

- **D-2.15:** `ops/rectrace-ops.sh` v1 is **runtime ops only** (`start`, `stop`, `status`, `restart`, `logs`). It registers **three** components: `backend`, `tlm-stats`, `react`. **NO angular row** — Angular is being decommissioned at React go-live (D-2.4) and there is no operational scenario where the ops script needs to start it. During Phases 2-9, if a developer needs Angular running for parity comparison, it's a manual `cd frontend/rectrace && npm start`.

  - PID files in `run/<component>.pid`; logs in `logs/<component>.log` (matches OPS-03 spec).
  - `start react` runs `pnpm dev` in `frontend-react/`. The script does `command -v pnpm` first; if pnpm isn't on PATH, falls back to `npm run dev` automatically.
  - Readiness probe (for `start <component>` to block until ready): `curl -s -o /dev/null -w '%{http_code}' http://localhost:5173/` polled with a 30s timeout, expecting HTTP 200.
  - `start backend` / `start tlm-stats` reuse the existing Phase 0.1 / Phase 1 invocation pattern (`mvn spring-boot:run` with the `local` profile, or `java -jar` against the packaged JAR — planner picks based on what the user expects to use in day-to-day dev).
  - **This is v1.** Phase 8 OPS-01..04 hardens it: `set -euo pipefail`, `shellcheck` clean, macOS bash 3.2 + Linux bash 4/5 compat, actuator-health readiness probes, CI portability test.

- **D-2.16:** `ops/build.sh` is a **separate script** for the build pipeline. `build.sh react` runs `pnpm build` in `frontend-react/` then copies `dist/*` into `backend/rectrace/src/main/resources/static/` (after first cleaning the existing `static/` so Angular's old build doesn't ghost in). Anticipated future verbs: `build.sh package` (chains `build.sh react && mvn package -pl backend/rectrace`), `build.sh angular` (kept available in case the user ever wants to build the old Angular app for comparison). Phase 2 ships `build.sh react` minimum; the other verbs are stretch but cheap.

  **Why separated from `rectrace-ops.sh`:** runtime ops and build pipeline are different concerns with different cadences (start/stop dozens of times a day; build once before deploy). Separation keeps `rectrace-ops.sh` small enough for Phase 8 `shellcheck` hardening without dragging the build pipeline through it.

- **D-2.17:** **D-2.15 supersedes** the Angular reference in `ROADMAP.md` Phase 2 SC#5 ("registers backend, tlm-stats, angular, and React") and in `REQUIREMENTS.md` REACT-08 ("backend, tlm-stats, angular components registered"). Planner proposes a small ROADMAP/REQUIREMENTS edit (or defers — either acceptable).

### Parity-matrix gate (FOUND-04)

- **D-2.18:** The strict reading of FOUND-04 + `.planning/parity-matrix.md`'s gate ("Phase 2 can begin once every row has a non-`tbd` value in Target") is **relaxed for Phase 2 Foundation**, on the basis that Phase 2 ships only scaffolding (empty SSRM grid against an existing endpoint) and does not port any specific cell renderer, modal, or search tab. The Target column is locked **per-phase** as we port: Phase 3 locks Targets for the search tab and renderers it ports; Phase 4 locks Targets for the modals it owns. The gate's intent (no React porting work without a decision on what to do with each Angular asset) is preserved — only the timing of when each row's Target gets locked is deferred.

### Claude's Discretion (planner decides)

- **Brave vs OTel bridge** — D-2.9 names `micrometer-tracing-bridge-brave` for less ceremony; planner can swap to `bridge-otel` during plan-phase research if the Boot 3.5.14 BOM resolves cleaner with OTel. Both work for the propagator-customization path.
- **B3 vs W3C propagation headers** alongside `X-Correlation-Id` — Brave default is B3; adding W3C is one `application.properties` line. Planner picks based on what plays nicest with the custom propagator implementation.
- **TanStack Router file-based routing vs minimal manual config** — Phase 2 has one hello-world route; planner decides whether to set up the full code-generation pipeline now (matches recviz) or stage it for Phase 3 when real routes land.
- **Vite `define` mechanism for `__BUILD_SHA__`** — exact incantation. Standard pattern: `vite.config.ts` reads `git rev-parse --short HEAD` synchronously at build time. Planner picks fallback when `.git` is absent (e.g., a CI-style tarball build).
- **`shadcn init` default components to vendor** — only those Phase 2 demonstrably uses: `Button` (theme toggle), `Sonner` (error toasts that quote correlation ID), possibly `Card` for the empty-state container. Planner picks the minimum set.
- **State management for theme** — `next-themes` is the recviz pattern; Zustand is also wired (REACT-02). Planner picks which owns the theme state (probably `next-themes` since shadcn integrates natively).
- **Static-asset cleaning during `build.sh react`** — whether to `rm -rf backend/rectrace/src/main/resources/static/*` before copying or only delete known Angular paths. Planner picks; preferred safer default is full clean since Phase 2 expects only React in `static/` going forward.
- **Per-module `application-local.properties` deltas** — D-2.9 / D-2.12 ask both Maven modules to load `micrometer-tracing-bridge-brave` and update the log pattern. Whether to set `management.tracing.sampling.probability=1.0` only in `application-local.properties` or also in `application.properties` (default profile) is planner's call.
- **Commit shape** — wave-based atomic commits (per Phase 1's successful pattern). Likely waves: (1) `frontend-react/` scaffold + shadcn init + tokens.css + ESLint, (2) TanStack stack + theme + footer SHA, (3) AG-Grid SSRM hello-world + license plumbing, (4) backend brave bridge + propagator + logback pattern, (5) `ops/rectrace-ops.sh` v1 + `ops/build.sh` v1, (6) ROADMAP/REQUIREMENTS edits (D-2.5, D-2.17). Planner refines.

### Folded Todos

None — no pending todos matched this phase at discuss time.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project context

- `.planning/PROJECT.md` — Rectrace modernization milestone scope, the V4-nomenclature convention (D-1.18), out-of-scope list (no Angular rewrite, no backend rewrite, no Docker artifacts).
- `.planning/REQUIREMENTS.md` §"React Foundation" — REACT-01..08 (the eight Phase 2 requirements). **Note**: REACT-08's "angular components registered" wording is superseded by D-2.15; SEARCH-07's `/v6/` example is superseded by D-2.4.
- `.planning/ROADMAP.md` §"Phase 2: React Foundation" — phase goal + five success criteria. **Note**: SC#5's "registers backend, tlm-stats, angular, and React" wording is superseded by D-2.15; Phase 3 SC#1's `/v6/` mention is superseded by D-2.4.
- `.planning/STATE.md` — current milestone state; Phase 1 closed PASS on 2026-05-12.
- `.planning/parity-matrix.md` — React↔Angular parity matrix; FOUND-04 gate; D-2.18 relaxes the gate timing for Phase 2 only.

### Prior phase decisions (carry-forward)

- `.planning/phases/01-backend-platform-upgrade/01-CONTEXT.md` — Phase 1 decisions. Specifically:
  - **D-1.18** — "New React frontend uses V4 nomenclature" (matches `/api/v4/*`). Phase 2 inherits.
  - **D-1.2** — Spring Boot pinned at 3.5.14 in both modules. Phase 2's `micrometer-tracing-bridge-brave` must resolve cleanly against the Boot 3.5.14 BOM.
  - **D-1.3** — cross-module version alignment is non-negotiable. Both modules add the brave bridge at the same pinned version.
  - **D-1.4** — ES Java API Client (`co.elastic.clients.elasticsearch.ElasticsearchClient`) is the live ES path. Phase 2's `/api/v4/search/ssrm/fileName` smoke depends on it.
  - **D-1.6** — `/api/search/suggest` and `ElasticsearchServiceV4` are the live ES endpoints. Phase 2 grid smoke uses the latter.
  - **D-1.14..1.17** — `application-local.properties` + `../rectrace-local-dev/` seed. Phase 2's grid smoke runs against this exact stack.
  - **D-1.15** — no Docker-shaped artifacts in the repo. Phase 2 inherits — `frontend-react/` ships no `Dockerfile` either.
- `.planning/phases/01-backend-platform-upgrade/01-VERIFICATION.md` — Phase 1 exit state. Confirms Boot 3.5.14 + Java 21 + jakarta + ES Java API Client + `SecurityFilterChain` live.
- `.planning/phases/00.1-local-dev-seed-bootstrap/00.1-CONTEXT.md` — Phase 0.1 seed data layout. The `fileName` category and its 5 scenarios (2 hyphenated: `LOAD-ABC-123`, etc.) are what Phase 2's grid smoke renders.

### Codebase facts (read before planning)

- `.planning/codebase/STACK.md` — current Angular 18 / TS 5.5 / AG-Grid 32.2.2 baseline (frontend-react upgrades to React 19 / TS 5.6+ / AG-Grid 35 per REACT-01 + recviz parity).
- `.planning/codebase/STRUCTURE.md` — frontend module layout (`frontend/rectrace/`). `frontend-react/` is the new sibling.
- `.planning/codebase/CONVENTIONS.md` — Angular code conventions. React conventions are inherited from recviz (component-first, recviz alias scheme, shadcn primitives).
- `.planning/codebase/ARCHITECTURE.md` — V4 search flow (SearchControllerV4 → SearchServiceV4 → SSRM). Phase 2's grid datasource hits the same SSRM endpoint Angular hits today.
- `.planning/codebase/CONCERNS.md` MEDIUM — AG-Grid Enterprise license env-var wiring (closed by D-2.14).

### Recviz reference (external; read structurally)

- `/Users/aarun/Workspace/Projects/recviz/frontend/package.json` — runtime stack snapshot: React 19.2.0, Vite 7.3.1, Tailwind 4.1.18, TanStack Router 1.159.5, TanStack Query 5.90.20, Zustand 5.0.11, AG-Grid 35.0.1, `next-themes` 0.4.6, `tw-animate-css` 1.4.0, `shadcn` 3.8.4, `typescript-eslint` 8.48.0, ESLint 9.39.1, `class-variance-authority` 0.7.1, `lucide-react` 0.563.0, `sonner` 2.0.7. Mirror these for Phase 2 except where Phase 2's narrower scope drops a dependency.
- `/Users/aarun/Workspace/Projects/recviz/frontend/components.json` — shadcn config; D-2.6 reproduces 1:1 (style:new-york, baseColor:mist, RSC false, cssVariables true, aliases @/components etc., lucide icons).
- `/Users/aarun/Workspace/Projects/recviz/frontend/src/index.css` — Tailwind v4 `@theme inline` token block; D-2.7 reproduces the shadcn baseline subset, leaves `--series-*` / `--ramp-*` / `--chart-positive|negative|warning` as the deferred extensions.
- `/Users/aarun/Workspace/Projects/recviz/frontend/eslint.config.js` — D-2.8 reproduces this flat-config shape with one custom hex-rejection rule added.

### External references (for research/planning)

- Spring Boot 3.5 Tracing reference — https://docs.spring.io/spring-boot/reference/actuator/tracing.html — `micrometer-tracing-bridge-brave` and `bridge-otel` auto-config sections.
- Micrometer Tracing 1.4+ docs — custom `Propagation`/`Propagator` impl (Brave path: `brave.propagation.Propagation.Factory`).
- Vite 7 docs (env vars, `base`, `define`) — https://vitejs.dev/config/.
- AG-Grid React + SSRM docs (v35) — https://www.ag-grid.com/react-data-grid/server-side-model/.
- TanStack Router v1 — https://tanstack.com/router/latest.
- shadcn (v3) — https://ui.shadcn.com/.
- W3C Trace Context — https://www.w3.org/TR/trace-context/ — confirms UUIDv4-without-dashes (32 hex chars) is a valid `trace-id`.

### Files to touch in Phase 2 (illustrative — planner finalizes)

**New: `frontend-react/`** (full scaffold)
- `frontend-react/package.json` — runtime + dev deps mirroring recviz; `packageManager: pnpm@9.x.x`; scripts: `dev`, `build`, `preview`, `lint`, `typecheck`.
- `frontend-react/pnpm-lock.yaml` (generated; committed).
- `frontend-react/vite.config.ts` — `base` (mode-aware: `/rectrace/` for prod, `/` for dev), `define.__BUILD_SHA__`, plugins: `@vitejs/plugin-react`, `@tanstack/router-plugin` (vite), `@tailwindcss/vite`.
- `frontend-react/tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json` — match recviz strict-mode config; path aliases `@/*`.
- `frontend-react/eslint.config.js` — flat config per D-2.8.
- `frontend-react/components.json` — shadcn config per D-2.6.
- `frontend-react/index.html`.
- `frontend-react/src/main.tsx`, `src/App.tsx` — root mount + hello-world route.
- `frontend-react/src/index.css` — Tailwind imports + `@theme inline` baseline + empty extensions block per D-2.7.
- `frontend-react/src/lib/theme.ts` — TS mirror of token names.
- `frontend-react/src/lib/utils.ts` — shadcn's `cn` helper.
- `frontend-react/src/lib/queryClient.ts` — TanStack Query client + fetch wrapper that generates `X-Correlation-Id` per request per D-2.11.
- `frontend-react/src/lib/agGrid.ts` — `LicenseManager.setLicenseKey` bootstrap.
- `frontend-react/src/components/ui/` — vendored shadcn primitives (Button, Sonner, possibly Card).
- `frontend-react/src/components/app-shell/footer.tsx` — renders `__BUILD_SHA__`.
- `frontend-react/src/components/app-shell/theme-toggle.tsx` — `next-themes` toggle.
- `frontend-react/src/components/grid/SmokeGrid.tsx` — AG-Grid SSRM hello-world wired to `/api/v4/search/ssrm/fileName`.
- `frontend-react/src/routes/__root.tsx`, `src/routes/index.tsx` — TanStack Router minimal setup.
- `frontend-react/.env.local.example` — template noting `VITE_AG_GRID_LICENSE_KEY` is required for dev (real value not committed).
- `frontend-react/.gitignore` — `.env.local`, `dist/`, `node_modules/`, `.vite/`.
- `frontend-react/README.md` — pnpm-first quickstart + npm fallback instructions.

**Backend modifications: `backend/rectrace/`**
- `pom.xml` — add `io.micrometer:micrometer-tracing-bridge-brave` dependency.
- `src/main/java/com/citi/gru/rectrace/config/` — **new** `CorrelationIdPropagation.java` (Brave `Propagation.Factory` impl reading/writing `X-Correlation-Id` to/from trace context).
- `src/main/java/com/citi/gru/rectrace/config/TracingConfig.java` — **new** bean registering the custom propagation; or alternatively put it under `SecurityConfig` if planner judges it cleaner.
- `src/main/resources/application-local.properties` — `management.tracing.sampling.probability=1.0`.
- `src/main/resources/application.properties` — optional default sampling; planner decides.
- `src/main/resources/logback-spring.xml` — **new** file (currently absent per CONCERNS-implied baseline); minimal pattern with `%X{traceId}`. Phase 7 replaces with the full JSON layout.

**Backend modifications: `rectrace-tlm-stats/`**
- `pom.xml` — same `micrometer-tracing-bridge-brave` dependency.
- `src/main/java/com/citi/gru/rectrace/tlmstats/config/CorrelationIdPropagation.java` — duplicate of the rectrace impl OR refactor into a shared lib (planner picks; for Phase 2 simplest is duplication — there's no shared module today).
- `src/main/resources/application-local.properties` — same sampling override.
- `src/main/resources/logback-spring.xml` — same minimal pattern.

**New: `ops/`**
- `ops/rectrace-ops.sh` — runtime ops v1 per D-2.15.
- `ops/build.sh` — build pipeline per D-2.16.
- `ops/components.sh` — component registry (backend, tlm-stats, react). OPS-03 anticipates this.
- `run/`, `logs/` — directories created on first start; both in `.gitignore`.

**Planning documents:**
- `.planning/ROADMAP.md` — Phase 2 SC#5 edit (drop "angular"); Phase 3 SC#1 edit (drop `/v6/` and replace with no-prefix language per D-2.4).
- `.planning/REQUIREMENTS.md` — REACT-08 edit; SEARCH-07 edit.
- `.planning/STATE.md` — adds the "Add chart/series/ramp tokens — surfaces when first chart/data-viz component is planned" deferred-items row per D-2.7.
- `.planning/parity-matrix.md` — D-2.18 captured as a note at the top of the gate ("Foundation phase relaxed; Targets locked per-port-phase").

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **Recviz frontend (`/Users/aarun/Workspace/Projects/recviz/frontend/`)** — the structural and visual reference. Read `package.json`, `components.json`, `src/index.css`, `eslint.config.js`, `tsconfig.app.json`, `src/main.tsx`, and `src/routes/__root.tsx` for the patterns to mirror. Recviz's `src/lib/utils.ts` (`cn` helper) and the `next-themes` integration in `src/main.tsx` are direct copy targets.
- **Phase 0.1 local seed (`../rectrace-local-dev/`)** — Oracle on `localhost:1521/FREEPDB1` + ES on `localhost:9200`, 5 scenarios in `rectrace_core` (`fileName` SSRM target) plus the 13 hyphen-sensitive `.keyword` multi-fields. Phase 2's grid smoke uses this stack via the `local` Spring profile (`-Dspring.profiles.active=local`).
- **`application-local.properties` baseline (Phase 1 D-1.14)** — already in both Maven modules. Phase 2 only adds the tracing sampling line; no profile re-plumbing needed.
- **Angular's `environment.ts` AG-Grid license string** — copy to `frontend-react/.env.local` for laptop dev (D-2.14). Same physical key; different injection mechanism.
- **`AppConstants.CITI_PORTAL_LOGIN_ID_HEADER` (Phase 1 D-1.13)** — useful to reference in the React fetch wrapper if/when Phase 9 SEC-01 starts requiring the header from the React app. Phase 2 doesn't send it (auth deferred), but the constant is already canonical on the backend side.
- **Phase 1's `SecurityFilterChain` permit-all (D-1.8)** — keeps CORS and auth out of the way. The React shell can POST/GET `/api/v4/search/*` without any auth ceremony.
- **`/api/v4/search/config`, `/api/v4/search/initial`, `/api/v4/search/ssrm/{category}`, `/api/search/suggest`** — all live on Boot 3.5.14 + ES Java API Client post-Phase 1. Phase 2 only needs the SSRM endpoint.

### Established Patterns

- **Wave-based atomic commits** — Phase 0.1 (7 waves) and Phase 1 (8 waves) both used this. Phase 2 inherits; expected 5-6 waves.
- **`@Profile("!test")` guards** — Phase 0 added these; Phase 1 preserved them; Phase 2 must preserve them for the new `TracingConfig` and any new `CorrelationIdPropagation` bean (planner verifies whether tracing beans need the guard).
- **Single Spring profile per environment** (`default`, `local`, `test`, `prod`, `uat`) — `local` is the new one introduced in Phase 1. Phase 2 only writes to `application-local.properties` (and base `application.properties` if planner chooses for default-sampling). No new profiles.
- **`logback-spring.xml`** — currently neither module ships one. Phase 2 introduces the file in both modules (minimal pattern). Phase 7 OBS-01 replaces with the full JSON layout.
- **`pnpm` vs `npm` is opaque to the consumer** — README + script auto-detection mean a developer doesn't have to remember which is installed. The script does `command -v pnpm` first.

### Integration Points

- **React → backend HTTP**: `frontend-react/src/lib/queryClient.ts` fetch wrapper hits `http://localhost:6088/rectrace/api/v4/search/ssrm/fileName` in dev (Vite dev proxy or direct CORS via the permit-all SecurityFilterChain). Production: same-origin `/rectrace/api/v4/search/ssrm/fileName`.
- **React → AG-Grid Enterprise**: license loaded once at app bootstrap; SSRM datasource is constructed per grid mount.
- **Backend → MDC / logs**: brave bridge populates `traceId` via the Tracer; logback pattern reads it as `%X{traceId}`.
- **Ops script → processes**: each component has a start/stop/status/restart verb; PID-based lifecycle (per OPS-03); `command -v pnpm` fallback for the React row.
- **Build script → backend**: `ops/build.sh react` produces `frontend-react/dist/` and rsyncs it into `backend/rectrace/src/main/resources/static/`. Backend's existing static-asset serving (via `WebMvcConfigurer` defaults from Spring Boot) picks it up at `/rectrace/`.

</code_context>

<specifics>
## Specific Ideas

- **Mirror recviz aggressively for the runtime stack.** When the user said "lets discuss everything thoroughly as this is an important phase," the underlying intent is that this phase sets the conventions for every subsequent React phase (3, 4, 8). Drift from recviz now means drift in every later React phase. Treat recviz's `package.json`, `components.json`, `eslint.config.js`, and `src/index.css` as canon — diff against them at planning time and justify every delta in CONTEXT.md or PLAN.md notes.
- **The user wants chart/series/ramp tokens auto-surfaced when needed.** Quote: *"ok. we will go with 'minimal phase 2, defer chart tokens' but ensure that at that phase it is automatically surfaced bro."* — D-2.7's three-trigger mechanism (STATE.md + tokens.css comment + Phase 8 DESIGN-01 anchor) is the answer. Planner should NOT delete or weaken any of those three triggers.
- **The user prefers explicit recommendations over neutral option lists.** Multiple "what is recommended bro?" turns surfaced this. Planner should follow suit when surfacing planner-discretion items at review time — lead with a recommendation and rationale, then list alternatives.
- **Angular is decommissioned at React go-live.** Quote: *"when react is live, angular will be taken down bro. so they don't have to co-exist."* This single sentence is the basis for D-2.4 (no `/ui/` prefix), D-2.15 (no angular row in ops script), and D-2.17 (ROADMAP/REQUIREMENTS edits). If a planner ever proposes a "let's keep Angular alive longer" path, that contradicts this.
- **The user values script separation by concern.** Quote (paraphrased): *"build and starting won't be in the same script right?"* led to D-2.16 (separate `ops/build.sh`). Planner should NOT collapse `build.sh` back into `rectrace-ops.sh` under the rationale of "fewer entrypoints."
- **The user has flagged `/v6/` as an artefact of an older draft.** It was never a deliberate choice. D-2.4 + D-2.17 retire it. The supersession is intentional and should be reflected in the ROADMAP/REQUIREMENTS edits.

</specifics>

<deferred>
## Deferred Ideas

- **UAT side-by-side React+Angular review** — D-2.4 deliberately drops the `/ui/` prefix on the assumption Angular is gone at React go-live. If during Phases 2-9 the user wants to deploy both to UAT for stakeholder comparison, the fix is a 2-line Vite `base` change + a Spring static-route alternation. Captured for re-evaluation each phase.
- **Backend ROADMAP/REQUIREMENTS edit** to drop `/v6/` references and the Angular row in REACT-08 — doc hygiene. Either fold into Phase 2 planning as a single wave (recommended), or capture as a backlog item.
- **Chart/series/ramp/heatmap design tokens** — surfaces at the next phase introducing a chart/data-viz component. Auto-surface mechanism per D-2.7: STATE.md Deferred Items + `tokens.css` comment + Phase 8 DESIGN-01 anchor.
- **AG-Grid Enterprise license served from a backend endpoint** (vs build-time env injection) — would make license rotation a backend-only operation. Phase 2 ships build-time env per D-2.14 because it matches the existing Angular pattern. Reconsider during license rotation pain.
- **Maven `frontend-maven-plugin`** — fully-automatic `mvn package` triggering React build. Phase 2 deliberately stays manual (`ops/build.sh react`) to keep the Java↔Node coupling out of the Maven build. Reconsider if CI integration ever asks for a single Maven entrypoint.
- **Brave vs OTel bridge** — Brave picked for less ceremony in Phase 2; reconsider during Phase 7 if the OTel exporter pipeline (Loki/OTel collector) is the chosen log/metric forwarder target.
- **Slow-query AOP, Prometheus, JSON log layout via logstash-logback-encoder, HealthIndicator beans, log aggregator forwarder, actuator endpoint lockdown** — Phase 7 (OBS-01..08).
- **Visual regression testing** (Playwright + Percy/Chromatic) — Phase 8 DESIGN-02.
- **`shellcheck` CI on `rectrace-ops.sh`, Linux portability test, actuator-health readiness probes** — Phase 8 OPS-01..04.
- **Auth filter / `x-citiportal-loginid` validation in the React app** — Phase 9 SEC-01.
- **ES SSL truststore, CORS lockdown, Citi CA, internal Nexus / Verdaccio routing for npm/pnpm registry, React bundle external-CDN audit** — Phase 9 SEC-03..06.
- **`shared-ops` Java library to deduplicate the `CorrelationIdPropagation` impl between the two Maven modules** — only worth it if a third module surfaces. Phase 2 duplicates the class across modules (per D-2.10 planner-discretion note).
- **Vitest + React Testing Library + Playwright** scaffolding — recviz has all three; Phase 2 may or may not ship the test scaffolding. Planner picks: minimum bar is one "App mounts and renders the empty grid" smoke test (Vitest). Full Playwright suite is Phase 8 DESIGN-02.
- **TanStack Router file-based routing code-generation** — recviz has it; Phase 2 with one hello-world route may not need it. Planner decides.

### Reviewed Todos (not folded)

None — no pending todos were reviewed at discuss time.

</deferred>

---

*Phase: 02-react-foundation*
*Context gathered: 2026-05-13*
