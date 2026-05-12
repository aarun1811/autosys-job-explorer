# Autosys Job Explorer

## What This Is

Autosys Job Explorer is an internal enterprise web application at Citi for exploring and managing Autosys job information. Users search and visualize Autosys job metadata, dependencies, and TLM statistics pulled from Oracle databases and Elasticsearch.

The system today is a three-tier stack — Spring Boot 2.7.16 REST API (`backend/rectrace`), an Angular 16 SPA with AG-Grid Enterprise (`frontend/rectrace`), and a standalone Spring Boot TLM stats service (`rectrace-tlm-stats`) — developed on a laptop and deployed to Citi VM servers.

The current milestone is a modernization initiative: stand up a **new React frontend** mirroring the design and patterns of an existing internal app called **recviz**, embed recviz views inside the app via a configurable iframe/micro-frontend pattern, fix outstanding search bugs, and improve operability, observability, and Citi-domain security posture. The existing Angular app stays in place during the React build-out; the React app is **net-new**, not a rewrite.

## Core Value

Users can quickly find Autosys jobs and understand their dependencies and TLM statistics through a unified, performant, design-consistent UI.

## Requirements

### Validated

<!-- Inferred from existing codebase — see .planning/codebase/. -->

- ✓ v3 search across configurable categories backed by Oracle + Elasticsearch — existing
- ✓ AG-Grid server-side row model display in the Angular SPA — existing
- ✓ Execution order graph visualization (Cytoscape.js + dagre) — existing
- ✓ TLM statistics modal connecting to multiple Oracle instances — existing
- ✓ User context propagated via `x-citiportal-loginid` header — existing
- ✓ Dynamic JSON-driven search categories (`search-config.json`) — existing
- ✓ Standalone TLM stats Spring Boot service — existing

### Active

<!-- Listed in user-stated priority order. -->

- [ ] **REACT-MIGRATION**: Stand up a net-new React frontend project mirroring recviz's design language and patterns; port only the latest search flow and latest custom renderers from the Angular app. Existing Angular app stays running until the React app is ready.
- [ ] **RECVIZ-INTEGRATION**: Embed recviz inside the new React app via iframe/micro-frontend; configurable per-tab and inside modals (alongside AG-Grid as a renderer option).
- [ ] **SEARCH-BUG-HYPHEN**: Fix special-character search bug — hyphen (`-`) in search terms returns wrong results, likely an Elasticsearch analyzer/tokenizer or indexing issue.
- [ ] **CONFIG-DIRECT-SQL**: Extend search configuration so a tab can run an arbitrary `SELECT` query (not just a single-table mapping). Queries are authored by devs/admins in config; not exposed to end users.
- [ ] **DESIGN-SHADCN**: Adopt shadcn components as the design system in the new React app; ensure visual consistency with recviz.
- [ ] **OBSERVABILITY**: Sweep across backend + TLM-stats — structured logging with correlation IDs, slow-query visibility, health endpoints/probes, and a central log aggregation surface so operators can see what's happening without SSH'ing into VMs.
- [ ] **ES-LOADER**: Configurable Oracle→Elasticsearch loader with multiple jobs (each: index + SELECT query + schedule) and an in-built scheduler running them periodically.
- [ ] **OPS-SCRIPT**: A single bash script as the operations surface — start, stop, status, restart for all moving parts (backend, TLM stats, frontend dev server, ES loader). Works on laptop and on Citi VM.
- [ ] **DOMAIN-SECURITY**: Fix outstanding security issues and adopt canonical Citi-domain auth patterns for both user→app and app→infrastructure (Oracle/ES/etc.). Specific mechanisms (CitiPortal headers vs SiteMinder vs SPNEGO; keytab+Kerberos vs Vault) deferred to the security phase.

### Out of Scope

- **Rewrite of existing Angular app** — A new React project is built alongside; the Angular app is not refactored beyond what's needed to keep it running.
- **Backend (Spring Boot) rewrite or restructure** — Only additive features land in the existing backend. No framework upgrades, package re-layout, or service splits unless required by a specific item.
- **TLM-stats service migration / rewrite** — Stays as-is structurally; receives observability changes only.
- **End-user-facing SQL console** — Arbitrary SELECT queries are authored by devs/admins in config; users do not write or paste SQL.
- **Modifications to recviz** — recviz is a separate app at `/Users/aarun/Workspace/Projects/recviz`; we only integrate with it. No PRs into recviz.
- **Mobile UI** — Internal desktop browser experience only.

## Context

- **Codebase already mapped** — see `.planning/codebase/` (`STACK.md`, `ARCHITECTURE.md`, `STRUCTURE.md`, `CONVENTIONS.md`, `TESTING.md`, `INTEGRATIONS.md`, `CONCERNS.md`) for the inferred state of the existing system.
- **Reference architecture** — The recviz codebase at `/Users/aarun/Workspace/Projects/recviz` is the visual and structural reference for the new React app. recviz's Python backend is not relevant; only its frontend patterns are. To be examined during `discuss-phase` / `plan-phase` for the React phase.
- **Development vs deployment** — All development currently happens on a local macOS laptop. Production runs on Citi VM servers (Linux). Ops surface must work in both environments.
- **Backend tests are skipped by default** — `maven.test.skip=true` is the current state. Test coverage gap to be aware of when modifying backend.
- **Password retrieval via external scripts** — Current pattern for DB credentials. Treated as a smell to be replaced under DOMAIN-SECURITY.
- **Hyphen bug suspicion** — Default Elasticsearch standard analyzer splits on `-`, so `ABC-123` tokenizes as `ABC` and `123`. Likely root cause for SEARCH-BUG-HYPHEN; needs verification against the actual mapping + analyzer.

## Constraints

- **Tech stack — backend**: Spring Boot 2.7.16 stays. No framework upgrade in this milestone.
- **Tech stack — new frontend**: React, with **shadcn** as the design system, mirroring recviz's design language and structural patterns.
- **Integration — recviz**: Embedded as iframe / micro-frontend. We do not modify recviz.
- **Deployment**: Citi VM servers (Linux). Single bash script is the operations surface.
- **Security**: Citi domain integration is required for production. User-side auth (CitiPortal headers / SiteMinder / SPNEGO) and service-side auth (Kerberos keytab / Vault) deferred to the security phase but must be resolved before "done."
- **Development environment**: macOS laptop; all tooling must run locally without a Citi VM.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Build new React app rather than rewrite Angular | Migration is strategically mandated; building net-new keeps the existing Angular app shippable during transition | — Pending |
| Port only latest search flow + renderers to React | Avoid dragging legacy v1/v2 code paths into the new app | — Pending |
| recviz integrated via iframe / micro-frontend | recviz is a separate Python-backed app; URL embedding is the lowest-friction integration | — Pending |
| Spring Boot backend stays as-is structurally | Migration scope kept manageable; new features layer on additively | — Pending |
| Direct Oracle queries: `SELECT`-only, dev/admin authored in config | Adds flexibility without exposing SQL to end users; safer surface | — Pending |
| ES loader has its own multi-job scheduler | Configuration-driven Oracle→ES ingest with periodic runs; avoids external scheduler dependency | — Pending |
| One bash script as the unified ops surface | User preference; works identically on laptop and Citi VM | — Pending |
| User-auth mechanism (CitiPortal / SiteMinder / SPNEGO) | Deferred — lock in during the security phase | — Pending |
| Service-auth mechanism (keytab+Kerberos / Vault / scripts) | Deferred — lock in during the security phase | — Pending |
| Observability stack (logging library, metrics, aggregation target) | Deferred — choose during the observability phase | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-12 after initialization*
