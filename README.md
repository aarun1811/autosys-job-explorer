# Rectrace — Autosys Job Explorer

Internal Citi (Global Reconciliation Unit) web app for exploring **Autosys job metadata, dependencies, and TLM/QuickRec reconciliation statistics**, sourced from Oracle + Elasticsearch.

> **Status:** the codebase has been modernized (Spring Boot 3.5.14 / Java 21 / React 19) and merged to `main`. For the authoritative, verified current state — system map, domain model, RecViz integration, endpoint inventory — see **`.planning/codebase/CURRENT-STATE-2026-06-12.md`**. Working in this repo? Read **`CLAUDE.md`** first (conventions + gotchas).

## Architecture

Five components, deployed independently:

| Component | Stack | Dev port | Status |
|---|---|---|---|
| `backend/rectrace` | Spring Boot 3.5.14, Java 21, jakarta | 6088 | Active — main API (context path `/rectrace`) |
| `rectrace-loader` | Spring Boot 3.5.14, Java 21 | 6089 | Active — Oracle→Elasticsearch loader (extracted from backend) |
| `rectrace-tlm-stats` | Spring Boot 3.5.14, Java 21 (no Lombok) | 8080 | Active — TLM statistics service |
| `frontend-react` | Vite 7 + React 19 + shadcn (Tailwind v4) + AG-Grid 35 + TanStack | 5173 | Active — go-forward UI |
| `frontend/` (Angular 18) | AG-Grid 32, Cytoscape, RxJS | 4200 | **Frozen — slated for deletion** |

Plus an **embedded** sibling app, **RecViz** (separate repo, FastAPI + React), which rectrace embeds via iframe for the TLM/QuickRec statistics dashboards. Local Oracle + Elasticsearch come from the sibling repo `../rectrace-local-dev`.

```
Browser → frontend-react (/rectrace) ──→ backend/rectrace ──→ Oracle  ←── rectrace-loader (Oracle→ES)
                 │                              └────────────→ Elasticsearch ──┘
                 └── <iframe> ──→ RecViz (TLM / QuickRec dashboards, separate app on :8000)
```

## How search works

- **Config-driven categories.** `backend/rectrace/src/main/resources/search-config-v4.json` declares each of the 13 categories' ES index, search column, Oracle table, and column definitions. The React frontend builds grid columns from the config — never hardcoded. All 13 categories share the ES index `rectrace_core_index` and the Oracle table `rectrace_core`.
- **Two-step, dual-provider.** Step 1: Elasticsearch wildcard + collapse on `<field>.keyword` returns the distinct matching values (cap 1000). Step 2: those values are passed as Oracle bind params (`IN (?,…)`) and Oracle returns SSRM-paged/sorted/filtered detail rows.
- **Server-side row model.** `POST /api/v4/search/ssrm/{category}` drives the AG-Grid SSRM grid. Every client-supplied column name is validated by `ColumnNameWhitelist` before any SQL string concatenation.
- **Execution-order graph.** Clicking the execution-order cell opens a native **React Flow** (`@xyflow/react` + dagre) dependency-graph modal built from `GET /api/execution-order/{jobName}`.
- **TLM / QuickRec dashboards.** Clicking the TLM/QuickRec cells opens a **RecViz dashboard** inside a sandboxed iframe modal.

## Getting started (local dev)

**Prerequisites:** Java 21, Maven 3.6+, Node 20+, pnpm 9+, Docker (for the local Oracle + ES stack).

```bash
# 1. Bring up Oracle + Elasticsearch + seed data (sibling repo)
cd ../rectrace-local-dev
docker compose up -d
python apply.py --reset          # idempotent: DDL + seed + ES index

# 2. Backend (http://localhost:6088/rectrace)
cd ../autosys-job-explorer/backend/rectrace
mvn spring-boot:run -Dspring-boot.run.profiles=local

# 3. Loader (http://localhost:6089) — optional locally
cd ../../rectrace-loader
mvn spring-boot:run -Dspring-boot.run.profiles=local

# 4. React frontend (http://localhost:5173)
cd ../frontend-react
pnpm install
pnpm dev
```

The `local` profile points at the sibling Docker stack (Oracle `localhost:1521/FREEPDB1`, ES `http://localhost:9200`). Without it the backend boots but Oracle health is DOWN.

### Common tasks

```bash
# Backend
cd backend/rectrace && mvn test            # tests run (Phase 0 closed the skip gate)

# Frontend
cd frontend-react
pnpm test          # vitest
pnpm typecheck     # tsc -b --noEmit
pnpm lint          # ESLint (hex-rejection rule)
pnpm build         # tsc -b && vite build

# Ops surface (bash 3.2 / 4 / 5 portable)
ops/rectrace-ops.sh start|stop|restart|status backend|loader|tlm-stats|react|all
ops/build.sh react     # build React, copy dist/ into backend static/
ops/ci-smoke.sh        # portability smoke (no live backend needed)
```

## Backend API (selected)

All paths shown with the `/rectrace` context prefix; auth is via the `x-citiportal-loginid` header (logged, **not yet enforced** — Phase 9).

| Method | Path | Purpose |
|---|---|---|
| GET | `/rectrace/api/config` | `{recvizOrigin}` for the React app's RecViz embeds |
| GET | `/rectrace/api/v4/search/initial?keyword=` | Initial keyword search (returns config + first rows) |
| POST | `/rectrace/api/v4/search/ssrm/{category}` | AG-Grid server-side row model page |
| GET | `/rectrace/api/v4/search/config` | Search config |
| POST | `/rectrace/api/v4/search/export/{category}` | Server-side Excel export (blob) |
| GET | `/rectrace/api/execution-order/{loadJobName}` | Execution-order dependency graph data |
| GET | `/rectrace/api/v4/sql-search/config` · POST `/rectrace/api/v4/sql-search/ssrm/{tabKey}` | Config-driven SELECT tab (JSqlParser-validated) |
| GET | `/rectrace/api/search/suggest?prefix=` | Legacy autocomplete |
| GET | `/rectrace/api/user/info` | Current user info |

The loader admin endpoints (`/api/v4/loader-admin/*`) live in **`rectrace-loader`** on :6089.

## Observability

Profile-aware JSON logs (`logback-spring.xml` → Splunk HEC), Brave/Micrometer tracing with `X-Correlation-Id` as the 128-bit traceId, Prometheus (`/actuator/prometheus`), slow-query AOP, and custom health indicators (`oracle`, `elasticsearch`, `searchConfig` in the backend; `loaderRunAge` in the loader).

## Deployment

The React frontend is built into the backend jar — production deploys one Spring Boot service per component. See **`DEPLOY.md`** for the Citi VM runbook (env vars, Oracle wallet, systemd, RecViz origin config).

## Documentation map

- **`CLAUDE.md`** — working conventions, architecture, gotchas (read first).
- **`.planning/codebase/CURRENT-STATE-2026-06-12.md`** — verified current state (the source of truth).
- **`.planning/STATE.md` / `ROADMAP.md` / `parity-matrix.md`** — milestone/phase tracking.
- **`.planning/codebase/CONCERNS.md`** — security/quality concerns (with closure markers).
- **`docs/superpowers/specs|plans/`** — per-feature design specs and implementation plans.
- **`DEPLOY.md` / `CITI-LAPTOP-SETUP.md`** — deployment + first-Citi-run setup.

---

*Proprietary — Citi GRU. This README replaces a pre-modernization version (Boot 2.7 / Angular 16 / Java 8); for deep, verified detail prefer `CLAUDE.md` and `.planning/codebase/CURRENT-STATE-2026-06-12.md`.*
