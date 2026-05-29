# Phase 2: React Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `02-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-05-13
**Phase:** 02-react-foundation
**Areas discussed:** Project layout & URL prefix, Recviz token mirroring strategy, Correlation-ID + Micrometer Tracing, SSRM smoke + ops-script shape

---

## Project layout & tooling

| Option | Description | Selected |
|--------|-------------|----------|
| Sibling folder, pnpm (mirror recviz) | `frontend-react/` sibling; pnpm via Corepack | (partial) |
| Sibling folder, npm | npm to match Angular module | |
| Sibling, npm + .nvmrc | npm + pinned Node version | |
| Nested under frontend/ | `frontend/react/` instead of sibling | |

**User's choice:** "frontend-react sounds better. but what is your recommendation for tooling?"
**Notes:** Folder location locked as **top-level sibling `frontend-react/`**. Package manager moved to a follow-up turn for explicit recommendation.

---

## Package manager (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — pnpm 9 via corepack | Primary pick; planner verifies VM at plan time | |
| Yes, but with npm fallback documented | pnpm primary, npm command sequence in README | ✓ |
| Stick with npm | Lose recviz parity | |

**User's choice:** "Yes, but with npm fallback documented" → **D-2.2**
**Notes:** Recommendation was straight pnpm; user added the explicit npm-fallback requirement.

---

## Dev port + URL prefix (Area A continued)

| Question | Option | Selected |
|----------|--------|----------|
| Dev port | 5173 (Vite default) | ✓ |
| Dev port | 6173 | |
| Dev port | 4300 | |
| URL prefix activation | Vite base `/v6/` from day one | (user surfaced confusion) |
| URL prefix activation | Leave `/` in Phase 2; flip in Phase 3 | |
| URL prefix activation | Set via env var | |

**User's response on prefix:** "what is /v6/? where did it come from?"
**Notes:** `/v6/` was traced back to REQUIREMENTS SEARCH-07's "e.g. `/v6/`" example; surfaced as conflicting with Phase 1 D-1.18 V4 nomenclature. Re-asked.

---

## URL prefix (re-asked)

| Option | Description | Selected |
|--------|-------------|----------|
| `/ui/` — name-based, version-free | Recommended | ✓ (initial) |
| `/v4/` — align with D-1.18 | Collides cognitively with `/api/v4/*` | |
| `/react/` — stack-name | Implementation detail in URL | |
| Keep `/v6/` — as written | Reopens V5/V6 mismatch | |

**User's choice (round 1):** `/ui/`
**Then user clarified:** "prod has to build at `/rectrace/` bro. the current one is configured that way in prod actually and i have to maintain that. the version consistency i flagged was for naming of files in frontend and backend and backend api routing alone. not particularly for frontend routing"
**Notes:** Re-scoped — `/ui/` would have to be `/rectrace/ui/` because backend has context-path `/rectrace`.

---

## URL prefix (final resolution)

| Option | Description | Selected |
|--------|-------------|----------|
| React at `/rectrace/ui/` (coexist) | Angular keeps `/rectrace/`, React under `/ui/` | |
| Mode-based: dev=`/ui/`, prod=`/rectrace/ui/` | Mode-aware Vite base | |
| Different sub-path | Propose alternative | |

**User's clarification:** "when react is live, angular will be taken down bro. so they don't have to co-exist. /ui/ wouldn't be needed honestly speaking"
**Final question — drop `/ui/` entirely?**

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — drop `/ui/` | Vite base `/rectrace/` prod, `/` dev; deploy to classpath:/static/ | ✓ |
| Keep `/ui/` for build-out, drop at switchover | Hedge for UAT side-by-side | |

**User's choice:** "Yes — drop /ui/" → **D-2.4 + D-2.5**

---

## Recviz token mirroring strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Copy recviz src/index.css verbatim | Fastest; inherits everything | |
| shadcn-init (new-york / mist) + manually overlay recviz extensions | Disciplined; audit-friendly | (recommendation) |
| Bare shadcn defaults now; full audit in Phase 8 | Cleanest Phase 2 scope | |
| Read recviz on the fly during planning | Bespoke; more overhead | |

**User's response:** "what do you recommend bro?"
**Recommendation given:** Option 2 with a Phase-2 trim — shadcn-init + empty extensions overlay, defer chart/series/ramp tokens until first chart lands.

---

## Token plan (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — minimal Phase 2, defer chart tokens | + auto-surface mechanism | ✓ |
| Yes, but ship recviz extensions now | Full token parity day one | |
| Verbatim copy recviz src/index.css | Skip shadcn-init | |

**User's choice:** "ok. we will go with 'minimal phase 2, defer chart tokens' but ensure that at that phase it is automatically surfaced bro." → **D-2.6 + D-2.7**
**Notes:** "Auto-surface" requirement led to the three-trigger mechanism: STATE.md Deferred Items + `tokens.css` inline comment + Phase 8 DESIGN-01 CONTEXT.md anchor.

---

## ESLint configuration

| Option | Description | Selected |
|--------|-------------|----------|
| ESLint 9 flat config (match recviz) | 1:1 with recviz, hex-rejection rule on top | ✓ |
| Flat + strictTypeChecked preset | More verbose suppressions | |
| Defer ESLint to Phase 3 | Anti-pattern; REACT-04 says hex rejection is Phase 2 | |

**User's choice:** "ESLint 9 flat config (match recviz)" → **D-2.8**

---

## Tracing scope

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal: brave bridge + MDC log pattern only | No propagation override | |
| Minimal + B3/W3C propagation reading X-Correlation-Id | Single ID end-to-end | (recommendation) |
| Servlet filter only; defer Micrometer Tracing to Phase 7 | Throwaway code | |

**User's response:** "what is recommended bro?"

## ID generation

| Option | Description | Selected |
|--------|-------------|----------|
| Client generates UUID v4 per request | Survives network failures | |
| Backend generates; React reads from response | Backend = source of truth | |
| Hybrid: client generates, backend honors | Best ergonomics + tracing propagation | (recommendation) |

**User's response:** "same question bro. what is recommended?"
**Recommendations given:** Scope = option 2 (brave + X-Correlation-Id propagator). Generation = option 3 (hybrid). Together: React-generated UUID literally IS the backend `traceId` (UUID-without-dashes = 32 hex = valid 128-bit traceparent).

---

## Tracing lock (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — lock as recommended | brave + X-Correlation-Id propagator; hybrid generation | ✓ |
| Yes, defer logback-spring.xml to Phase 7 | Less log ergonomics in the gap | |
| Brave vs OTel — let planner pick | Defer | |

**User's choice:** "Yes — lock as recommended" → **D-2.9, D-2.10, D-2.11, D-2.12**

---

## SSRM smoke target

| Option | Description | Selected |
|--------|-------------|----------|
| `/api/v4/search/ssrm/fileName` against Phase 0.1 seed | 5 actual rows in dev | ✓ |
| `/api/v4/search/config` only (no data smoke) | Thinner, less confidence | |
| New `/api/v4/health/grid-smoke` endpoint | Decouples; adds backend surface | |
| All three Phase 0.1 hyphenated categories | Bleeds into Phase 8 | |

**User's choice:** "`/api/v4/search/ssrm/fileName` against Phase 0.1 seed" → **D-2.13**

## AG-Grid license

| Option | Description | Selected |
|--------|-------------|----------|
| Env var injected at build time via Vite | `VITE_AG_GRID_LICENSE_KEY` | ✓ |
| Backend-served at runtime | Easier rotation; deferred | |
| Copy from Angular env.ts as quick start | Tactical | |

**User's choice:** "Env var injected at build time via Vite" → **D-2.14**

---

## Ops React shape

| Option | Description | Selected |
|--------|-------------|----------|
| Dev-only + root URL probe | pnpm dev background, curl 5173 | (clarification needed) |
| Dev + preview both | Adds preview mode | |
| Dev-only now, defer preview to Phase 8 | Same as 1 with deferred note | |

**User's response:** "what is this question bro?" → re-explained in plain English.

## Ops React shape (re-asked after explanation)

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — dev-only + root URL probe | Plus pnpm-with-npm-fallback | ✓ |
| Dev + preview both supported | Extra ~20 lines | |
| Dev-only now, defer preview to Phase 8 | Same as 1 with deferred note | |

**User's choice:** "we can go with 'dev-only + root URL probe', where we run `pnpm dev` with npm fallback. but in prod, it will be present inside the backend build. hope that is known." → **D-2.15**

---

## Build wiring

| Option | Description | Selected |
|--------|-------------|----------|
| `build` subcommand to ops script | Same script, separate verb | |
| `frontend-maven-plugin` (Maven auto-build) | Couples Java↔Node | |
| Document the manual flow | No automation Phase 2 | |

**User's response:** "build and starting won't be in the same script right?" — surfaced the script-separation preference. Also a parallel correction: "angular needn't be started in the script bro. we will be ditching angular remember."

## Script split (after correction)

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — two scripts (rectrace-ops.sh runtime + build.sh pipeline) | Recommended | ✓ |
| Single script, separate subcommands | Bigger script | |
| Two scripts but defer build.sh to Phase 8 | Lighter Phase 2 | |

**User's choice:** "Yes — two scripts" → **D-2.16 + D-2.17 (Angular row removed)**

---

## Claude's Discretion

The following decisions were intentionally deferred to plan-phase:

- Brave `Propagation.Factory` vs OTel `TextMapPropagator` (D-2.9 names brave)
- B3 vs W3C propagation headers alongside X-Correlation-Id
- TanStack Router file-based routing setup depth in Phase 2
- Exact Vite `define` mechanism for `__BUILD_SHA__` (fallback when `.git` is absent)
- Minimum shadcn primitives to vendor in Phase 2 (Button + Sonner + Card likely)
- Theme state ownership: `next-themes` vs Zustand (probably `next-themes` per shadcn integration)
- `build.sh react` `static/` cleanup approach (full rm vs targeted)
- `application-local.properties` vs `application.properties` for default sampling probability
- `CorrelationIdPropagation` duplication across modules vs shared lib refactor (Phase 2 = duplication)
- Wave shape for plan-phase (likely 5-6 waves)

## Deferred Ideas

- UAT side-by-side React+Angular review (re-introduce `/rectrace/<sub>/` prefix if needed)
- ROADMAP/REQUIREMENTS doc edits for `/v6/` and "angular" references — either fold into Phase 2 plan or queue as backlog
- Chart/series/ramp tokens — auto-surfaced per D-2.7 mechanism
- AG-Grid license served from backend endpoint (rotation pain reconsider)
- `frontend-maven-plugin` (single Maven entrypoint)
- Brave vs OTel reconsideration during Phase 7
- Phase 7 OBS-01..08 work (exporter, Prometheus, slow-query AOP, JSON layout, HealthIndicators)
- Phase 8 DESIGN-02 visual regression
- Phase 8 OPS-01..04 ops script hardening
- Phase 9 SEC-01..06 auth + TLS + CORS + Nexus
- Shared-ops Java library to deduplicate CorrelationIdPropagation (3rd-module trigger)
- Vitest + Playwright scaffolding depth (planner picks Phase 2 minimum bar)
- TanStack Router file-based routing (planner decides for Phase 2)
