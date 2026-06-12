# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project Overview

**Rectrace** — internal enterprise web app at Citi for exploring Autosys job metadata, dependencies, and TLM statistics from Oracle + Elasticsearch. Three independently deployed components plus a net-new React frontend being built side-by-side with the existing Angular app:

| Module | Stack | Port (dev) | Status |
|---|---|---|---|
| `backend/rectrace` | Spring Boot 3.5.14, Java 21, jakarta | 6088 | Active |
| `rectrace-tlm-stats` | Spring Boot 3.5.14, Java 21 | 8080 | Active |
| `rectrace-loader` | Spring Boot 3.5.14, Java 21 | 6089 | Active |
| `frontend/rectrace` | Angular 18.2.14, AG-Grid 32, RxJS | 4200 | Legacy — frozen, replaced incrementally |
| `frontend-react` | Vite 7 + React 19 + shadcn (Tailwind v4) + AG-Grid 35 + TanStack | 5173 | Net-new vertical-slice port |

Production deployment target is Citi Linux VMs. All development is local on macOS — every script and ops surface must work on bash 3.2 (macOS native) *and* bash 4/5 (Linux CI).

## Working Conventions

This repo uses the **superpowers** skill suite. The expectation when working here:

- **Brainstorm first** for any new feature, behavioral change, or non-trivial refactor. Invoke `superpowers:brainstorming` before reaching for code. Treats "Let's build X" as a design conversation, not an implementation request.
- **Plan before touching code** for multi-step work. Invoke `superpowers:writing-plans` to produce a written implementation plan; execute with `superpowers:executing-plans` and TDD checkpoints.
- **TDD is the default** (`superpowers:test-driven-development`) for features, bug fixes, refactors, and behavior changes. Red → Green → Refactor. No production code without a failing test first. Configuration files and throwaway prototypes are the only exceptions.
- **Verify before claiming complete** (`superpowers:verification-before-completion`). Run the actual verification command, read the output, *then* claim. "Should pass" is not evidence.
- **Systematically debug** (`superpowers:systematic-debugging`) before proposing fixes for any bug, test failure, or unexpected behavior.
- **Use git worktrees for parallel work** (`superpowers:using-git-worktrees`) when starting feature work that needs isolation. During the modernization, executor agents that used absolute paths from worktree branches accidentally committed to `milestone/modernization` — worktrees prevent that.
- **Parallel agents when work is genuinely independent** (`superpowers:dispatching-parallel-agents`). Send a single message with multiple tool calls.
- **Code review** (`superpowers:receiving-code-review`) before implementing review feedback — verify the technical claim, don't perform agreement.
- **Wrap up** (`superpowers:finishing-a-development-branch`) when implementation is complete and the integration step is the next question.

Invoke skills via the `Skill` tool. Project facts/state below should not duplicate what those skills already teach.

## Essential Commands

### Backend (`backend/rectrace`)
```bash
cd backend/rectrace
mvn clean install                          # Build with tests
mvn test                                   # Tests only (NOT skipped — Phase 0 closed the test gate)
mvn spring-boot:run -Dspring-boot.run.profiles=local   # Run against local Docker stack
```
Boots on `http://localhost:6088/rectrace`.

### Frontend (React, active)
```bash
cd frontend-react
pnpm install         # or: npm install
pnpm dev             # Vite dev server on :5173
pnpm test            # vitest run
pnpm typecheck       # tsc -b --noEmit
pnpm lint            # ESLint (hex-rejection rule active)
pnpm build           # tsc -b && vite build
```

### Frontend (Angular, legacy)
```bash
cd frontend/rectrace
npm ci               # Install (node_modules not committed)
npm start            # Dev server on :4200
```
Frozen — receives no new features. Stays running while React reaches parity.

### TLM Stats Service
```bash
cd rectrace-tlm-stats
mvn spring-boot:run -Dspring-boot.run.profiles=local
```
Boots on `http://localhost:8080`.

### Loader Service
```bash
cd rectrace-loader
mvn spring-boot:run -Dspring-boot.run.profiles=local
```
Boots on `http://localhost:6089`. Owns the ES Loader subsystem (ShedLock-coordinated ticker + admin endpoints at `/api/v4/loader-admin/*`). Backend (`backend/rectrace`) no longer carries any loader code as of Phase 4 of the loader-extraction work.

### Ops Surface
```bash
ops/rectrace-ops.sh start backend|tlm-stats|react|all
ops/rectrace-ops.sh stop|restart|status backend|tlm-stats|react|all
ops/rectrace-ops.sh logs backend|tlm-stats|react
ops/build.sh react                      # Build React, copy dist/ into backend static/
ops/ci-smoke.sh                         # Portability smoke (no live backend needed)
```
`ops/components.sh` is the component registry — adding a new managed process is one line.

### Local Docker Stack
Oracle + Elasticsearch live in a sibling repo at `../rectrace-local-dev/`. That repo owns DDL, ES mapping, seed data, and the `apply.py` idempotent driver. The `local` profile in both backend modules expects Oracle at `localhost:1521/FREEPDB1` and ES at `http://localhost:9200`.

### Smoke Scripts
Under `scripts/`:
- `smoke-ssrm.sh` — end-to-end /initial → SSRM search flow
- `smoke-hyphen-search.sh` — hyphenated-identifier regression (Phase 8 BUG-01..03)
- `smoke-sql-search.sh` — Phase 5 configured-SELECT tab
- `smoke-loader-{admin,alias,sigterm}.sh` — loader admin / alias-bootstrap / SIGTERM paths (post-extraction: targets `:6089`, no context path)
- `smoke-observability.sh` — Phase 7 actuator/metrics/tracing surface
- `smoke-correlation-id.sh` — `X-Correlation-Id` round-trip via MDC

Each is bash 3.2 / 4 / 5 portable and reports clear PASS/FAIL.

## Repo Layout

```
backend/rectrace/           # Spring Boot 3.5.14 main API (V4 search, loader, observability, SQL tab)
rectrace-tlm-stats/         # Spring Boot 3.5.14 TLM stats service
frontend/                   # Angular 18 legacy SPA (frozen)
frontend-react/             # Vite 7 + React 19 + shadcn + AG-Grid 35 (active)
ops/                        # rectrace-ops.sh, components.sh, build.sh, ci-smoke.sh
scripts/                    # smoke-*.sh integration tests
.planning/                  # Project register: STATE, ROADMAP, REQUIREMENTS, parity-matrix, CONCERNS, research
../rectrace-local-dev/      # Sibling repo: Docker stack + seed data (NOT in this tree)
```

## Architecture & Key Patterns

### Backend
- **Config-driven search categories.** `backend/rectrace/src/main/resources/search-config-v4.json` declares each category's ES index, search column, Oracle table, and column definitions. The frontend reads `/api/v4/search/config` and produces grid columns from the JSON — never hardcoded.
- **Dual-provider per category.** Each search category goes ES first (fast collapsed keyword lookup) then Oracle (SSRM-paginated detail rows).
- **Server-side row model.** AG-Grid SSRM endpoint at `POST /api/v4/search/ssrm/{category}` with `SSRMRequestV4` carrying initial ES filter + group keys + sort/filter model + visible columns + pagination.
- **Column-name whitelist** (`ColumnNameWhitelist.forCategory(config)`) validates every client-supplied column name in ORDER BY / WHERE / SELECT / GROUP BY before SQL concatenation. Added 2026-05-18 to close the CONCERNS.md CRITICAL.
- **CORS** is property-driven via `app.cors.allowed-origins` (comma-separated). Empty = block. Local profile defaults to dev origins; prod/uat carry `[NEEDS USER REVIEW]` placeholders.
- **Observability** uses `logback-spring.xml` (profile-aware Splunk HEC), Brave Micrometer tracing with `X-Correlation-Id` as the 128-bit traceId, `/actuator/health` with custom indicators — **`oracle`, `elasticsearch`, `searchConfig` in `backend/rectrace`** (the `loaderRunAge` indicator now lives in `rectrace-loader`, not the backend), `/actuator/prometheus`, slow-query AOP.
- **Loader subsystem extracted to `rectrace-loader/`** (Boot 3.5.14, port 6089). Backend has zero loader awareness as of 2026-05-31 loader-extraction work — see `docs/superpowers/specs/2026-05-31-loader-extraction-design.md`.
- **SQL tab subsystem** uses JSqlParser 5.3 for boot-time validation (fails to boot on bad shape) + a dedicated read-only Oracle DS + per-statement `setMaxRows/setQueryTimeout/setFetchSize` caps.

### Frontend (React)
- **TanStack Router** with Zod-validated search params (`/search?q=...&tab=fileName`; the active-category param is `tab`, not `cat`).
- **TanStack Query** with `apiFetch` wrapper generating 32-char hex correlation IDs and attaching them to errors for "Error — reference: <ID>" toasts.
- **Config-driven columns** — column defs arrive **inline** with the `GET /api/v4/search/initial` response (`CategoryResultV4.columns`); `configToColDefs` adapts `ColumnDefinitionV4` → AG-Grid `ColDef`; cell renderers are looked up by string key from the `cellRenderers` map in `renderers/registry.ts`. (A `GET /api/v4/search/config` endpoint also exists, but there is **no** `useSearchConfig` hook and the TanStack Query default `staleTime` is **5 min**, not `Infinity`.)
- **Cell renderers** — 5 registered in `renderers/registry.ts`: `appIDCellRenderer` (anchor), `supportEmailCellRenderer` (mailto), `executionOrderButtonRenderer` (opens a **complete** `ExecutionOrderModal` — React Flow `@xyflow/react` v12 + dagre layout; native graph, **not** Cytoscape and **not** a placeholder), `tlmStatsButtonRenderer` + `quickRecStatsButtonRenderer` (open a RecViz dashboard inside a sandboxed iframe modal — see "RecViz integration" below).
- **Custom ThemeProvider** with `rectrace-theme` localStorage key (NOT next-themes — that's dead code in `package.json`).
- **ESLint** has a hex-rejection rule (`no-restricted-syntax` for hex Literals) — use CSS tokens (`var(--color-*)`).
- **AG-Grid v35** — in `main.tsx`, `LicenseManager.setLicenseKey(...)` is called **first**, then `ModuleRegistry.registerModules([...])` with **16 modules** (license-before-modules is the AG-Grid requirement). Adding a new grid feature usually means adding a module.

### Authentication
- All APIs read `x-citiportal-loginid` header for user context (logged, not enforced yet — Phase 9 will gate).
- The React app generates `X-Correlation-Id` per request; backend adopts it as the 128-bit Brave traceId via a custom `Propagation.Factory`.

### RecViz Integration (TLM / QuickRec dashboards)

**RecViz** is a *separate* app (`/Users/aarun/Workspace/Projects/citi/RecViz` — FastAPI + Python 3.12 on :8000, React 19 + AG-Charts/ECharts; **not** Cytoscape). rectrace embeds RecViz **one-directionally via iframe** — there is no API exchange, no shared ES, and only a shared Oracle *instance* (different schema). The only data hand-off is URL filter params.

- The `tlmStatsButtonRenderer` / `quickRecStatsButtonRenderer` cells open `RecvizDashboardModal` → `RecvizEmbed` → `<iframe src="{recvizOrigin}/embed/dashboards/{id}?filter.{k}={v}&filter.lock=...&hide=...&theme=...">`. Origin is fetched at runtime from `GET /rectrace/api/config` (`ConfigController` → `app.recviz.origin`, default empty), with `recvizConfig.ts` falling back to `VITE_RECVIZ_ORIGIN` then `http://localhost:8000`. `RecvizEmbed` does origin-validated `postMessage` (`RECTRACE_THEME` / `RECTRACE_IFRAME_HEIGHT`), never `*`.
- Execution-order visualization is **native React Flow** and **independent of RecViz** — RecViz is only for the TLM/QuickRec *stats dashboards*.
- **Prod blockers (verified 2026-06-12, see `.planning/codebase/CURRENT-STATE-2026-06-12.md`):** RecViz CORS is hardcoded to dev origins (`RecViz/backend/app/main.py:219`; its `RECVIZ_CORS_ALLOWED_ORIGINS` env var is never read); `app.recviz.origin` is absent from every `application-*.properties`; the `dash-tlm-stats`/`dash-quickrec-stats` dashboards must be seeded per env via `RecViz/scripts/seed-oracle.py`; neither app has SSO/auth; `RecvizEmbed.onError` can't detect a CSP `frame-ancestors` refusal.

## Project State

The living state is in `.planning/`:
- **`.planning/STATE.md`** — current phase, what's complete, what's open
- **`.planning/ROADMAP.md`** — phase list with success criteria
- **`.planning/REQUIREMENTS.md`** — REQ-IDs and traceability matrix
- **`.planning/parity-matrix.md`** — React ↔ Angular feature port status
- **`.planning/codebase/CONCERNS.md`** — security/quality concerns (with CLOSED markers as items land)
- **`.planning/research/`** — domain research summaries

The `.planning/phases/` history (per-phase plan/summary blizzard from the previous workflow) is archived; read it for context but new work doesn't add to it. Use `superpowers:writing-plans` for new plans.

## Modernization Status & Current State

> **Full current-state reference:** `.planning/codebase/CURRENT-STATE-2026-06-12.md` — system map, domain model, RecViz integration, verified endpoint list, and doc-vs-code corrections. Read it before non-trivial work; the per-phase `.planning/` docs (STATE / ROADMAP / parity-matrix) lag the code.

**Branch reality:** the modernization milestone is **merged into `main`** — `main` is the source of truth and is ~45 commits **ahead** of `milestone/modernization` (whose HEAD is the merge-base). The old "milestone branch is ~160 commits ahead of main" framing is obsolete. Do new work on `main` (or a feature branch off it).

**Done (merged to main):**

- Phase 0/0.1: test gate, local-dev seed bootstrap (sibling `../rectrace-local-dev/`)
- Phase 1: Boot 2.7 → 3.5.14, Java 8 → 21, jakarta sweep, V3 deletion, `SecurityFilterChain`, explicit HikariCP
- Phase 2: React shell (Vite 7 + React 19 + shadcn + AG-Grid 35 + tracing + ops v1)
- Phase 3: React search vertical slice (one tab end-to-end)
- Phase 5: Config-driven SELECT (JSqlParser + read-only DS + SSRM)
- Phase 6: ES Loader (ShedLock + BulkIngester + admin endpoints + alias-only)
- Phase 7: Observability sweep (JSON logs + tracing + HealthIndicators + Prometheus + enforcer pin)
- Phase 8 (BUG + OPS subset): hyphen-search fix via `caseInsensitive(true)` on `.keyword` wildcards; `ops/rectrace-ops.sh` v2; `ops/ci-smoke.sh`; GitHub Actions workflow
- **Post-milestone work on `main` (not in the per-phase `.planning/` history):**
  - All 13 search tabs ported to one config-driven React search surface
  - Execution-order **redesign** — full React Flow + dagre `ExecutionOrderModal` (native graph; replaces the Phase-3 placeholder)
  - **TLM/QuickRec → RecViz embed** — `TlmStatsCellRenderer` + `QuickRecStatsCellRenderer` + `RecvizEmbed` + `buildEmbedUrl` + `recvizConfig` + backend `ConfigController`
  - **A1a** — removed the category-level `dashboard` config concept (config-only edit; the `DashboardConfig` DTO infra remains but no category uses it)
  - **Loader extraction** — loader moved out of `backend/rectrace` into `rectrace-loader/` (:6089); backend carries zero loader code
  - AG-grid styling consistency, inline-SVG logo, Citi laptop profile + `CITI-LAPTOP-SETUP.md`

**Open:**

- **Phase 4 — RecViz integration**: the **rectrace side is largely built** (renderers, embed, runtime origin config). Remaining is RecViz-side + cross-team — seed the RecViz dashboards per env, write the CSP/`frame-ancestors`/cookie/SSO contract, and clear the blockers in the "RecViz Integration" section above.
- **Phase 9 — Domain security** (not started). Needs CitiPortal/SiteMinder/SPNEGO + keytab/Vault choice + ES SSL re-enable + Citi CA truststore + CORS prod allow-list.
- **Phase 8 DESIGN-01/02/03** (deferred). Needs RecViz visual references.
- **Angular retirement** — Angular (`frontend/`) is frozen and slated for deletion; React is the go-forward UI. Both still configure `/rectrace/` base path and the `rectrace-theme` localStorage key, so finalize the cutover (retire Angular, or move one off `/rectrace/`) before production.

## Things to Watch Out For

- **`backend/rectrace` is `@Profile("!test")`-gated** for production beans (`OracleServiceV4`, `SqlQueryServiceV4`, `SqlSearchControllerV4`, `LoaderShedLockConfig`, etc.). Test profile bypasses Oracle wiring. When adding new wiring tests, decide whether `@Profile("!test")` or a `@ActiveProfiles("slice")` carve-out is needed.
- **Lombok is in `backend/rectrace` and `rectrace-loader/` but NOT `rectrace-tlm-stats`.** When mirroring code into tlm-stats, use plain SLF4J `Logger`/`LoggerFactory`, not `@Slf4j`; backend ↔ loader code can share Lombok freely.
- **The `local` profile** points at the sibling `../rectrace-local-dev/` Docker stack. Without that stack running, the backend boots but Oracle health is DOWN.
- **Maven Surefire on Java 21 + Lombok prints `Unsafe::objectFieldOffset` warnings.** Cosmetic; not a build failure.
- **Bash 3.2 portability is enforced for everything under `ops/`** (OPS-01). No associative arrays, no `mapfile`, no `[[ ... = pat* ]]` glob patterns. Use POSIX `case` for prefix matching. `shellcheck -x` is the gate.
- **`scripts/smoke-loader-sigterm.sh`** depends on a Python interpreter with `oracledb` installed; it tries `$RECTRACE_PYTHON`, then the sibling venv, then `python3` on PATH.
- **AG-Grid v35: `LicenseManager.setLicenseKey` must run BEFORE `ModuleRegistry.registerModules`** in `frontend-react/src/main.tsx` (license first, then the 16 modules) — order matters.
- **`getRowId`** in any AG-Grid SSRM datasource must use stable business keys, never `Date.now()+Math.random()`. Breaks row-state persistence across refreshes.
- **`x-citiportal-loginid` is logged, not enforced.** Phase 9 will add the Spring Security filter; until then, treat any backend that's reachable directly (i.e., not behind the portal proxy) as un-authenticated.

## Reference

- `.planning/PROJECT.md` — extended background, key decisions, evolution rules
- `.planning/research/` — pre-phase research notes (architecture, features, pitfalls, stack, summary)
- `README.md` — public-style overview (predates the modernization; uses the old Boot 2.7 / Angular 16 / Java 8 numbers)
