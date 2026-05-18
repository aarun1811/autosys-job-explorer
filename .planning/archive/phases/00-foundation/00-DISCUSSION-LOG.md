# Phase 0: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-12
**Phase:** 0-foundation
**Areas discussed:** CI target system, Parity matrix format, Test fixture strategy, Test gate scope, Branching strategy (cross-cutting)

---

## CI target system

| Option | Description | Selected |
|--------|-------------|----------|
| Jenkins (Citi standard) | Add a Jenkinsfile; assume Citi has shared Jenkins infrastructure | |
| GitHub Actions / GitLab CI | Add CI YAML based on repo host; only viable if Citi allows SaaS/internal runners | |
| Local pre-commit hook only | Husky/pre-commit hook runs `mvn test`; doesn't catch what doesn't run locally | |
| Don't know yet — stub for later | Defer CI wiring; Phase 0 ships test-skip removal + scaffolding only | ✓ (modified) |

**User's choice:** Free-text — "in citi we use lightspeed along with teamcity and(or) udeploy ... else we can have the test gate locally and move the actual CI pipeline implementation to last phase."

**Notes:** Resolved as "TeamCity is the real CI engine; Lightspeed = release orchestration, uDeploy = deployment automation." Phase 0 keeps the test gate local-only because removing `maven.test.skip=true` is sufficient — `mvn install` already fails on test red. TeamCity pipeline wiring deferred to a later phase (Phase 8 Ops Hardening is the natural fit).

---

## Parity matrix format

| Option | Description | Selected |
|--------|-------------|----------|
| Exhaustive table | One row per (cellRenderer × category × grid behavior); heavy Phase 0 inventory | |
| Tab/route rollup | One row per Angular route/tab; renderers listed compactly; details filled later | ✓ |
| Feature-area rollup | Group by feature area (search / execution-order / TLM stats); rougher | |
| Living doc, start with production state | Inventory only current production; grow organically | |

**User's choice:** Tab/route rollup, after Claude explained the matrix's purpose.

**Notes:** User asked "what is this matrix for bro?" — Claude explained the purpose (preventing the React-app-without-Angular-parity failure mode from PITFALLS.md #1). User then added critical nuance: "not everything can be moved to recviz. maybe entire tlm-stat-modal can be implemented in recviz. but the renderer still has to be in rectrace which render the modal on click the recviz's embedded dashboard." This led to the target vocabulary being expanded from three values (`port` / `replace` / `drop`) to five values (`port` / `replace-content-with-recviz` / `replace-fully-with-recviz` / `drop` / `tbd`). Day-0 fill scope: every route/tab gets a row with target verb; Priority and Notes can stay `tbd`.

---

## Test fixture strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Testcontainers (real Oracle + ES in Docker) | Highest fidelity; requires Docker on laptop AND Citi VM | |
| Embedded H2 + ES mock | Lightweight; H2 ≠ Oracle so Oracle-specific bugs slip through | |
| Pure @MockBean / @TestConfiguration | Smallest scope; only verifies bean wiring | |
| Test profile that disables real datasources | `application-test.properties` with `spring.autoconfigure.exclude=...` | ✓ |

**User's choice:** Option 4 (test profile that disables DB/ES), after Claude explained the four options in plain English.

**Notes:** User initially asked "again i am not clear with the ask bro." Claude re-explained without jargon and recommended option 4 based on three reasons: (1) Phase 0's goal is minimal — just prove "the app boots without crashing"; (2) Citi VMs typically don't have Docker so Testcontainers is a deploy-time risk; (3) H2 lies about Oracle and would create false safety. User confirmed and added the branching ask in the same message ("can we work on a git branch with is not main ?").

---

## Test gate scope

| Option | Description | Selected |
|--------|-------------|----------|
| Backend only (FOUND-02 as-written) | `mvn test` gate only; Angular stays as-is; React brings its own gate later | ✓ |
| Backend + Angular Karma | Also enforces `npm test` on Angular | |
| Backend + new React (when it exists) | Vitest gate lands in Phase 2 when React app exists | |
| Bro, just pick the sensible one | Claude's discretion | |

**User's choice:** Backend only.

**Notes:** Clean alignment with FOUND-02 as written. Angular Karma stays as-is because Angular is on the decommission path per the parity matrix. New React app brings its own Vitest gate in Phase 2.

---

## Branching strategy (cross-cutting — surfaced during Area 3 discussion)

| Option | Description | Selected |
|--------|-------------|----------|
| Single milestone branch | `milestone/modernization` off `main`; all 10 phases commit here; one PR at end | ✓ |
| Milestone branch + phase branches | Long-lived integration branch with per-phase PRs to it | |
| Phase branches off main directly | Per-phase PR back to main; no long-lived integration branch | |
| Bro, just pick the sensible one | Claude's discretion | |

**User's choice:** Single milestone branch — "just one branch for everything bro. we will merge it at the end."

**Notes:** Branch `milestone/modernization` was cut from `main` during the discussion (`git checkout -b milestone/modernization`). Earlier commits that landed on `main` during init/research/roadmap remain on main as stable docs. GSD doesn't currently have a config key for branching strategy (`planning.branching` and `workflow.branching` both rejected by the SDK) — captured as a minor GSD ergonomics improvement.

---

## Claude's Discretion

- Exact list of auto-configurations to exclude in `application-test.properties` per module — planner will inspect each `pom.xml` and `application.properties` to decide.
- Whether to add a pre-commit hook alongside the Maven-level gate — small ergonomic add; planner's call.
- Markdown table layout / column order for `parity-matrix.md`.
- Discovery method for the day-0 row set in the parity matrix (likely `grep`/inventory of `frontend/rectrace/src/app/` routes + components + active `search-config-v4.json`).

## Deferred Ideas

- Wire `mvn test` into a TeamCity job that runs on every push — Phase 8 Ops Hardening candidate, or standalone backlog item.
- Lightspeed / uDeploy deploy automation — out of scope for the test-gate phase; belongs in a later ops/deploy phase.
- Vitest gate for the new React app — lands in Phase 2 (React Foundation).
- Real-database test fixtures (Testcontainers, H2, or @MockBean) — each later phase picks its own fixture strategy when business logic actually needs one.
- Pre-commit hook to run `mvn test` before push — small ergonomic add for Phase 0 or later.
- Filling the parity matrix's Priority and Notes columns — populated during each React phase's discuss/plan, not in Phase 0.
- `/gsd-settings` improvement: add a `planning.branching` config key so branching strategy can be persisted.
