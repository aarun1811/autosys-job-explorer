# Phase 0: Foundation - Context

**Gathered:** 2026-05-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish two prerequisites that gate every other phase in the Rectrace modernization milestone:

1. A **green local test gate** for the backend — `maven.test.skip=true` removed from both `backend/rectrace/pom.xml` and `rectrace-tlm-stats/pom.xml`, with at least one passing Spring context-load test per Maven module. After this, `mvn install` automatically fails on test red (no extra plumbing needed).
2. A **React↔Angular parity matrix** at `.planning/parity-matrix.md` — a tab/route-level rollup that inventories every Angular capability today and assigns each one a target verb (`port` / `replace-content-with-recviz` / `replace-fully-with-recviz` / `drop` / `tbd`). This is the contract that gates the React phase (Phase 2) and prevents the dual-SPA failure mode flagged in `research/PITFALLS.md` #1.

Out of scope for Phase 0:
- TeamCity / Lightspeed / uDeploy CI pipeline wiring (deferred — see Deferred Ideas)
- Real-database test fixtures (Testcontainers / H2) — layered in by BOOT-UPGRADE / SQL / LOADER phases when business logic actually needs them
- Angular Karma gate or new React Vitest gate — Phase 2 brings React test infrastructure
- Java version bump or Spring Boot upgrade — those are Phase 1 (BOOT-UPGRADE)
- Filling in priority / notes columns in the parity matrix beyond `tbd` — that happens during each React phase's planning

</domain>

<decisions>
## Implementation Decisions

### CI / test gate

- **D-01:** CI engine target when wired is **TeamCity** (Citi's actual CI, not Lightspeed which is release orchestration and not uDeploy which is deployment).
- **D-02:** Phase 0 keeps the test gate **local-only** — removing `maven.test.skip=true` is the gate. `mvn install` will fail on test red automatically; no extra Maven plugin or pre-commit hook is required in Phase 0.
- **D-03:** Wiring `mvn test` into a TeamCity job that runs on every push is **deferred** to a later phase (natural fit: Phase 8 Ops Hardening) or treated as a backlog item — see Deferred Ideas.
- **D-04:** Test gate scope in Phase 0 is **backend only** — `mvn test` for `backend/rectrace` and `rectrace-tlm-stats`. Angular Karma stays as-is (Angular is on the decommission path per parity matrix). New React app brings its own Vitest gate in Phase 2.

### Test fixtures (FOUND-03 — one passing context-load test per module)

- **D-05:** Use a `test` Spring profile that disables Oracle + Elasticsearch auto-configuration. Concretely: `src/test/resources/application-test.properties` per module sets `spring.autoconfigure.exclude=...DataSourceAutoConfiguration,...ElasticsearchDataAutoConfiguration` (and any other DB/ES auto-configs that fire during normal startup). Goal: one `@SpringBootTest @ActiveProfiles("test")` test per module with a single `contextLoads()` assertion.
- **D-06:** **No Testcontainers in Phase 0** — Citi VM typically does not have Docker; introducing the dependency now is risky and unnecessary for a context-load test.
- **D-07:** **No H2** — H2 ≠ Oracle and would create false safety for Oracle-specific SQL bugs. If/when real DB tests are needed, they land in the phase that needs them.
- **D-08:** Richer fixtures (real DB tests, integration tests against live Oracle/ES) are deferred — each later phase chooses its own fixture strategy when its requirements demand one.

### Parity matrix (FOUND-04)

- **D-09:** Matrix lives at `.planning/parity-matrix.md` (top-level, not under a phase dir — every React phase will read it).
- **D-10:** **Granularity: tab/route rollup** — one row per current Angular route or top-level tab, NOT one row per cellRenderer × category × grid behavior. The exhaustive option was rejected as Phase 0 overkill.
- **D-11:** **Target vocabulary is five-valued, not three:**
  - `port` — build the capability in React natively
  - `replace-content-with-recviz` — rectrace owns the renderer / modal shell / tab host; the content inside is a recviz iframe (example: TLM-stats modal becomes a recviz dashboard, but the React cell renderer that opens the modal stays in rectrace)
  - `replace-fully-with-recviz` — capability removed from rectrace entirely; lives in recviz
  - `drop` — not needed; delete from inventory
  - `tbd` — decide during that capability's React phase planning
- **D-12:** **Day-0 fill-in scope:** every current Angular route/tab gets a row with the renderers it uses (compact list), and a target verb (or `tbd`). Priority (P1/P2/P3) and Notes columns may be left blank or `tbd`; they are filled during each React phase's planning.
- **D-13:** Matrix is a **living document** — it gets edited as React phases land. Phase 0 produces the day-0 snapshot.
- **D-14:** **Gating rule (informs Phase 2 / React Foundation discuss-phase):** the React phase can start once every row has a non-`tbd` target. Priority and Notes can stay `tbd` per row at that point.

### Branching strategy (cross-cutting, affects every phase)

- **D-15:** Branch model: **single milestone branch** named `milestone/modernization` (already cut from `main` during this discussion). All 10 phases commit to this branch. One PR back to `main` at milestone completion.
- **D-16:** Phase 0 documentation commits that pre-date the branch (project init, codebase map, research, roadmap) landed on `main` and stay there — those are stable docs, no rewrite needed.
- **D-17:** Future phases — when started via `/gsd-discuss-phase` / `/gsd-plan-phase` — verify the working branch is `milestone/modernization` before any commit.

### Claude's Discretion

- Exact Maven coordinate(s) of the `spring.autoconfigure.exclude` list per module — planner inspects each `pom.xml` and `application.properties` to determine which auto-configs to exclude.
- Whether to add a pre-commit hook in Phase 0 (alongside the un-skipped Maven build) — small ergonomic add; planner may include or skip.
- Format of the parity-matrix.md table (Markdown table layout, column ordering) — planner picks a sensible Markdown layout consistent with other `.planning/` docs.
- How to discover the day-0 row set — likely `grep`/inventory of `frontend/rectrace/src/app/` routes + components + active `search-config-v4.json` categories.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project context
- `.planning/PROJECT.md` — Rectrace modernization milestone scope, constraints, key decisions
- `.planning/REQUIREMENTS.md` §Foundation — FOUND-01..04 (the four Phase 0 requirements)
- `.planning/ROADMAP.md` §"Phase 0: Foundation" — phase goal + success criteria
- `.planning/STATE.md` — current milestone state

### Research findings
- `.planning/research/SUMMARY.md` §"Phase 0: Test gate + parity matrix" — phase rationale
- `.planning/research/PITFALLS.md` Pitfall #1 — "React drift from Angular feature parity" (parity matrix mitigation)
- `.planning/research/PITFALLS.md` Pitfall #10 — "`maven.test.skip=true` lets silent regressions ship" (test-gate mitigation)

### Codebase facts
- `.planning/codebase/STACK.md` — current Java 17 / Spring Boot 2.7.16 setup and Maven configuration
- `.planning/codebase/STRUCTURE.md` — module layout, where renderers live (`custom-interactions/components/renderers/`), where search config lives (`search-config-v4.json`)
- `.planning/codebase/TESTING.md` — current test posture (skipped backend, Karma+Jasmine on frontend)
- `.planning/codebase/CONCERNS.md` — already-identified concerns to be aware of (`maven.test.skip=true`, `printStackTrace`, `show_sql`, etc.)

### Files to touch in Phase 0
- `backend/rectrace/pom.xml` — remove `<maven.test.skip>true</maven.test.skip>`
- `rectrace-tlm-stats/pom.xml` — remove `<maven.test.skip>true</maven.test.skip>`
- `backend/rectrace/src/test/resources/application-test.properties` (new) — `spring.autoconfigure.exclude=...`
- `rectrace-tlm-stats/src/test/resources/application-test.properties` (new) — same pattern
- `backend/rectrace/src/test/java/.../ContextLoadsTest.java` (new) — minimal `@SpringBootTest @ActiveProfiles("test")` test
- `rectrace-tlm-stats/src/test/java/.../ContextLoadsTest.java` (new) — same pattern
- `.planning/parity-matrix.md` (new) — day-0 tab/route rollup

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend/rectrace/src/main/.../custom-interactions/components/renderers/` — renderer inventory source for the parity matrix
- `backend/rectrace/src/main/resources/search-config-v4.json` — active search categories; informs parity matrix rows for search routes
- `backend/rectrace/src/main/resources/search-config.json` — legacy v3 config (per codebase map, kept for reference) — may surface rows targeted `drop` in the matrix

### Established Patterns
- Spring Boot profile-based configuration (`application.properties`, `application-prod.properties`, `application-uat.properties` already exist) — adding `application-test.properties` follows the same pattern
- Maven multi-module backend (`backend/rectrace` + `rectrace-tlm-stats`) — Phase 0 changes mirror in both
- `.planning/` is the existing home for planning artifacts — parity matrix at `.planning/parity-matrix.md` keeps that convention

### Integration Points
- No runtime code is changed in Phase 0 — only build / test config + a new planning doc
- The parity matrix is the integration point between Phase 0 and every React phase (2, 3, 4, 7)

</code_context>

<specifics>
## Specific Ideas

- User explicitly cited the **TLM-stats modal example** as a concrete shape of `replace-content-with-recviz`: "entire tlm-stat-modal can be implemented in recviz. but the renderer still has to be in rectrace which renders the modal on click [showing] recviz's embedded dashboard." This is the canonical illustration of the 5-valued target vocabulary in D-11 — preserve it in the matrix as an example row when Phase 0 ships.
- User wants the actual CI pipeline wiring (TeamCity) out of Phase 0: "we can have the test gate locally and move the actual CI pipeline implementation to last phase."
- Branching: "just one branch for everything bro. we will merge it at the end."

</specifics>

<deferred>
## Deferred Ideas

- **TeamCity pipeline job** — `mvn test` runs on every push, fails the build on red, optionally publishes coverage. Natural fit: Phase 8 (Ops Hardening) or a small standalone backlog item. Captures the Citi CI integration without bloating Phase 0.
- **Lightspeed / uDeploy deploy automation** — release orchestration and deployment pipeline; out of scope for the test-gate phase. Belongs alongside Phase 8 ops hardening or its own deploy phase later.
- **Vitest gate for the new React app** — Phase 2 (React Foundation) brings its own test framework and gate.
- **Real-database test fixtures** (Testcontainers, H2, or @MockBean) — each later phase picks its own fixture strategy when business logic actually needs one. Phase 0 only ships the minimum to assert "Spring context loads."
- **Pre-commit hook** to run `mvn test` before push — small ergonomic add; planner may include in Phase 0 plan or defer.
- **Filling the parity matrix's Priority and Notes columns** — those get populated during each React phase's `discuss-phase` and `plan-phase`. Phase 0 only assigns the target verb per row.
- **`/gsd-settings` improvement: branching-strategy config key** — `planning.branching` / `workflow.branching` were attempted but neither exists in the GSD config schema. Minor GSD ergonomics item.

</deferred>

---

*Phase: 0-foundation*
*Context gathered: 2026-05-12*
