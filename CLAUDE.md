# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project Overview

**Rectrace** — internal enterprise web app at Citi for exploring Autosys job metadata, dependencies, and TLM statistics from Oracle + Elasticsearch. Three independently deployed components plus a net-new React frontend being built side-by-side with the existing Angular app:

| Module | Stack | Port (dev) | Status |
|---|---|---|---|
| `backend/rectrace` | Spring Boot 3.5.14, Java 21, jakarta | 6088 | Active |
| `rectrace-tlm-stats` | Spring Boot 3.5.14, Java 21 | 8080 | Active |
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
- `smoke-loader-{admin,alias,sigterm}.sh` — Phase 6 loader paths
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
- **Observability** uses `logback-spring.xml` (profile-aware Splunk HEC), Brave Micrometer tracing with `X-Correlation-Id` as the 128-bit traceId, `/actuator/health` with custom indicators (Oracle, ES, loader-run-age, search-config), `/actuator/prometheus`, slow-query AOP.
- **Loader subsystem** uses ShedLock 7.7.0 + `@Scheduled` + ES BulkIngester writing to aliases, with run-history and admin endpoints at `/api/v4/loader-admin`.
- **SQL tab subsystem** uses JSqlParser 5.3 for boot-time validation (fails to boot on bad shape) + a dedicated read-only Oracle DS + per-statement `setMaxRows/setQueryTimeout/setFetchSize` caps.

### Frontend (React)
- **TanStack Router** with Zod-validated search params (`/search?q=...&cat=fileName`).
- **TanStack Query** with `apiFetch` wrapper generating 32-char hex correlation IDs and attaching them to errors for "Error — reference: <ID>" toasts.
- **Config-driven columns** — `useSearchConfig` hook fetches `/api/v4/search/config` once (`staleTime: Infinity`); `configCategoryToColDefs` adapts ColumnDefinitionV4 → AG-Grid ColDef; cell renderers are looked up by string key from `renderers/registry.ts`.
- **Cell renderers** ported so far: AppID (anchor), SupportEmail (mailto), ExecutionOrder (button with placeholder Dialog — full Cytoscape graph deferred to Phase 4).
- **Custom ThemeProvider** with `rectrace-theme` localStorage key (NOT next-themes — that's dead code in `package.json`).
- **ESLint** has a hex-rejection rule (`no-restricted-syntax` for hex Literals) — use CSS tokens (`var(--color-*)`).
- **AG-Grid v35** requires 10 modules registered in `main.tsx` BEFORE license. Adding a new feature usually means adding a module.

### Authentication
- All APIs read `x-citiportal-loginid` header for user context (logged, not enforced yet — Phase 9 will gate).
- The React app generates `X-Correlation-Id` per request; backend adopts it as the 128-bit Brave traceId via a custom `Propagation.Factory`.

## Project State

The living state is in `.planning/`:
- **`.planning/STATE.md`** — current phase, what's complete, what's open
- **`.planning/ROADMAP.md`** — phase list with success criteria
- **`.planning/REQUIREMENTS.md`** — REQ-IDs and traceability matrix
- **`.planning/parity-matrix.md`** — React ↔ Angular feature port status
- **`.planning/codebase/CONCERNS.md`** — security/quality concerns (with CLOSED markers as items land)
- **`.planning/research/`** — domain research summaries

The `.planning/phases/` history (per-phase plan/summary blizzard from the previous workflow) is archived; read it for context but new work doesn't add to it. Use `superpowers:writing-plans` for new plans.

## Active Modernization Milestone

Branch: `milestone/modernization` (≈160 commits ahead of `main`). Done:

- Phase 0/0.1: test gate, local-dev seed bootstrap
- Phase 1: Boot 2.7 → 3.5.14, Java 17 → 21, jakarta sweep, V3 deletion, SecurityFilterChain, HikariCP
- Phase 2: React shell (Vite 7 + React 19 + shadcn + AG-Grid 35 + tracing + ops v1)
- Phase 3: React search vertical slice (one tab end-to-end)
- Phase 5: Config-driven SELECT (JSqlParser + read-only DS + SSRM)
- Phase 6: ES Loader (ShedLock + BulkIngester + admin endpoints + alias-only)
- Phase 7: Observability sweep (JSON logs + tracing + HealthIndicators + Prometheus + enforcer pin)
- Phase 8 (BUG + OPS subset): hyphen-search fix via `caseInsensitive(true)` on `.keyword` wildcards; `ops/rectrace-ops.sh` v2; `ops/ci-smoke.sh`; GitHub Actions workflow

Open:

- **Phase 4 — recviz integration** (not started). Needs Citi-internal CSP/cookie/SSO contract.
- **Phase 8 DESIGN-01/02/03** (deferred). Needs recviz visual references.
- **Phase 9 — Domain security** (not started). Needs CitiPortal/SiteMinder/SPNEGO + keytab/Vault choice + ES SSL re-enable + Citi CA truststore + CORS prod allow-list.
- **Angular ↔ React coexistence decision** — both apps configure `/rectrace/` as base path; both use `rectrace-theme` localStorage key. Pick a path before production cutover (move React to `/rectrace-react/`, OR move Angular to `/rectrace-legacy/`, OR cut Angular over to React entirely once parity is reached).

## Things to Watch Out For

- **`backend/rectrace` is `@Profile("!test")`-gated** for production beans (`OracleServiceV4`, `SqlQueryServiceV4`, `SqlSearchControllerV4`, `LoaderShedLockConfig`, etc.). Test profile bypasses Oracle wiring. When adding new wiring tests, decide whether `@Profile("!test")` or a `@ActiveProfiles("slice")` carve-out is needed.
- **Lombok is in `backend/rectrace` but NOT `rectrace-tlm-stats`.** When mirroring code between modules, use plain SLF4J `Logger`/`LoggerFactory` for tlm-stats, not `@Slf4j`.
- **The `local` profile** points at the sibling `../rectrace-local-dev/` Docker stack. Without that stack running, the backend boots but Oracle health is DOWN.
- **Maven Surefire on Java 21 + Lombok prints `Unsafe::objectFieldOffset` warnings.** Cosmetic; not a build failure.
- **Bash 3.2 portability is enforced for everything under `ops/`** (OPS-01). No associative arrays, no `mapfile`, no `[[ ... = pat* ]]` glob patterns. Use POSIX `case` for prefix matching. `shellcheck -x` is the gate.
- **`scripts/smoke-loader-sigterm.sh`** depends on a Python interpreter with `oracledb` installed; it tries `$RECTRACE_PYTHON`, then the sibling venv, then `python3` on PATH.
- **AG-Grid v35 modules must be registered BEFORE `LicenseManager.setLicenseKey`** in `frontend-react/src/main.tsx` — order matters.
- **`getRowId`** in any AG-Grid SSRM datasource must use stable business keys, never `Date.now()+Math.random()`. Breaks row-state persistence across refreshes.
- **`x-citiportal-loginid` is logged, not enforced.** Phase 9 will add the Spring Security filter; until then, treat any backend that's reachable directly (i.e., not behind the portal proxy) as un-authenticated.

## Reference

- `.planning/PROJECT.md` — extended background, key decisions, evolution rules
- `.planning/research/` — pre-phase research notes (architecture, features, pitfalls, stack, summary)
- `README.md` — public-style overview (predates the modernization; uses the old Boot 2.7 / Angular 16 / Java 8 numbers)
