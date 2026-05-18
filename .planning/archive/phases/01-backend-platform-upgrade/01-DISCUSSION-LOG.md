# Phase 1: Backend Platform Upgrade - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-12
**Phase:** 01-backend-platform-upgrade
**Areas discussed:** Version targets (Java + Boot line), Elasticsearch client strategy, Spring Security scope, BOOT-08 cleanup scope, cross-module/frontend-backend version alignment, local-dev testing environment

---

## Area 1a: Java target

| Option | Description | Selected |
|--------|-------------|----------|
| Stay on Java 17 (Recommended) | Already current target. LTS through 2029. Lowest blast radius — one variable at a time. | |
| Bump to Java 21 | Newer LTS through 2031, virtual threads available. Requires confirming Citi VM has JDK 21+. | ✓ |
| Defer to planning | Planner inspects VM JDK and locks at plan time. | |

**User's choice:** Bump to Java 21.
**Notes:** Planner will verify VM JDK 21+ as a gate on success criterion #1 in ROADMAP.md before the upgrade ships.

---

## Area 1b: Spring Boot minor line

| Option | Description | Selected |
|--------|-------------|----------|
| Spring Boot 3.5.x (latest) | Latest GA. Pins Micrometer 1.14+, Hibernate 6.6+, ES client 8.15+. | |
| Spring Boot 3.3.x LTS (Recommended) | Commercial LTS line. CONCERNS.md recommends. Pins Micrometer 1.13.x, Hibernate 6.5.x, ES client 8.13.x. | ✓ |
| Spring Boot 3.2.x | What ROADMAP.md literally says. Older line, no real reason vs 3.3.x. | |

**User's choice:** Spring Boot 3.3.x LTS.
**Notes:** ROADMAP.md is updated in this phase to reflect 3.3.x (currently says 3.2.x).

---

## Area 2: Elasticsearch client strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Migrate to ElasticsearchClient (Recommended) | Rewrite SuggestionService, V3, V4 to new Java API Client now. Land modern client once. | |
| Keep RestHighLevelClient via compat dep | 7.17 HLRC compat against ES 8. Lower diff. Cost: HLRC EOL upstream; SDE 5.x HLRC templates gone. | |
| Migrate V4 only; drop V3 in this phase | V3 trio + frontend dead service deleted. V4 + SuggestionService migrated to new client. | ✓ |

**User's choice:** Migrate V4 only; drop V3 in this phase.
**Follow-up question asked:** Scope of the V3 drop — full backend trio + frontend dead service, or partial?
**Follow-up answer:** Full: drop SearchServiceV3, OracleSearchProviderV3, ElasticsearchSearchProviderV3, V3 endpoints in SearchController, frontend search.service.ts + spec. Keep + migrate SuggestionService (preserving /api/search/suggest URL contract) and ElasticsearchServiceV4.
**Notes:** Verified frontend consumers: `search-v5.service.ts:137` hits `/api/search/suggest` (SuggestionService — kept) and `/api/v4/*` (V4 — kept). The three V3 endpoints have no live frontend caller.

---

## Area 3: Spring Security scope

| Option | Description | Selected |
|--------|-------------|----------|
| Permit-all SecurityFilterChain + CSRF off (Recommended) | One bean per module. Satisfies BOOT-04 mechanically. Auth deferred to Phase 9. Zero behavior change. | ✓ |
| Permit-all + header-presence filter | Adds 401 rejection for missing/empty x-citiportal-loginid. Couples behavior change to a version bump. | |
| Defer to planning | Planner inspects current callers and picks. | |

**User's choice:** Permit-all SecurityFilterChain + CSRF off.
**Notes:** Header validation, CORS lock-down, auth mechanism all stay in Phase 9.

---

## Cross-module version alignment (user-raised mid-flow)

| Option | Description | Selected |
|--------|-------------|----------|
| Lock identical Boot + Java versions in both pom.xml | Both modules use the same spring-boot.version + java.version. Mechanical discipline. | ✓ (initial interpretation) |
| Also add a parent aggregator POM at repo root | Centralized dependencyManagement. Real maintenance win. Structural refactor coupled to a version bump. | |

**User's clarification:** The question wasn't about cross-module Maven version alignment — it was about the frontend's "V5" label vs backend's "V4" label being inconsistent.

---

## Frontend-backend version label alignment

| Option | Description | Selected |
|--------|-------------|----------|
| Convention: React uses V4 to match backend; Angular V5 dies as-is (Recommended) | No code changes. New React phase (2+) uses V4 nomenclature. Angular V5 deleted at decommission. Alignment by attrition. | ✓ |
| Rename Angular search-v5/ → search-v4/ in this phase | ~10 files. No URL contract change. Refactoring decommission-path code. | |
| Rename backend V4 → V5 in this phase | Largest blast radius (URL contracts, search-config filename, every HTTP call). Locks V5 forever. | |

**User's choice:** Convention: React uses V4 to match backend; Angular V5 dies as-is.
**Notes:** Captured as project-level convention D-1.18 in CONTEXT.md so Phase 2's discussion inherits it.

---

## Area 4: BOOT-08 cleanup scope

Multi-select on which CONCERNS items ride along with the upgrade:

| Option | Description | Selected |
|--------|-------------|----------|
| Replace printStackTrace + System.err with SLF4J | ScriptExecutor + ExecutionOrderService.clobToString. Mechanical. | ✓ |
| Remove show_sql=true from default profile | spring.jpa.show-sql=false; remove redundant Java property. Prod info-disclosure fix. | ✓ |
| Add HikariCP pool config to primary DataSource | Mirror AutosysDataSourceConfig pattern. CONCERNS HIGH. Cheap during upgrade. | ✓ |
| Delete empty AppConstants and inline loginid header constant | Either populate AppConstants or delete. Tiny. | ✓ |

**User's choice:** All four.
**Notes:** User signaled there will be a "Round 2 cleanup phase" for long-term maintainability later — file splits and deeper hygiene. Captured as deferred idea.

---

## Local-dev testing environment (user-raised at wrap)

User raised a hard constraint: laptop has no Citi VPN, so they need everything testable locally before code moves to Citi.

### Question 1: Level of integration

| Option | Description | Selected |
|--------|-------------|----------|
| Manual smoke profile: docker-compose + 'local' Spring profile (Recommended) | docker-compose.yml + sample data + application-local.properties. mvn test stays at context-load. | |
| Testcontainers in mvn test | Tests spin own containers. Most rigorous. Adds Docker dep to test run. Phase 0 D-06 rejected this. | |
| Both | Maximum coverage. Double setup work. | |

**User's clarification:** No docker-compose files in repo. No Docker mentions in code at all. User starts Oracle + ES manually; code just needs to be configurable to point at localhost.

### Question 2: How is the local-stack setup tracked?

| Option | Description | Selected |
|--------|-------------|----------|
| Your prerequisite — not a planning phase (Recommended) | CONTEXT.md notes the dependency. User sets up the stack outside GSD. | |
| New Phase 0.1: Local Dev Seed Bootstrap | Inserted phase. Produces sibling folder with DDL + seed scripts. | ✓ |
| Sample-data SQL scripts in repo behind local profile | Adds resources/sql/local-seed/*.sql. Violates 'no infrastructure artifacts in code'. | |

**User's clarification:** Can't manually create the seed data; needs help. Wants the seed artifacts in a sibling parent folder outside the project workspace so they don't ship to Citi.

**User's choice:** Insert Phase 0.1 before Phase 1.
**Notes:** Phase 0.1 produces `../rectrace-local-dev/` (a sibling directory). Phase 1 BOOT-09 smoke depends on Phase 0.1 completion. Roadmap mutation queued: run `/gsd-phase` to insert 0.1 after this CONTEXT.md is committed.

---

## Claude's Discretion

Per CONTEXT.md decisions section:
- Commit shape (incremental staged commits per BOOT-NN vs larger commits) — bias toward bisectable atomic commits per BOOT-NN.
- BOOT-09 smoke checklist content — planner shapes the step list as `01-SMOKE-CHECKLIST.md`.
- `application-local.properties` credential strategy (plaintext defaults vs env-var placeholders).
- `AppConstants` populate vs delete (populate preferred per D-1.13; delete if planner judges over-engineering).
- `SearchController` post-V3 shape (standalone vs fold into SearchControllerV4).
- Per-module Maven build order (no inter-module dep; likely backend/rectrace first).
- Concrete Hibernate 6 / Spring Data JPA 3 breakages discovered during execution.

## Deferred Ideas

Captured in CONTEXT.md `<deferred>` section. Headline items:
- Round 2 cleanup phase (long-file splits, deeper hygiene) — after Boot 3.3.x stable.
- Parent aggregator POM at repo root — build-hygiene phase, deferred.
- Angular search-v5 rename — rejected (decommission path).
- Backend V4 → V5 rename — rejected (blast radius).
- AG-Grid license env-var wiring — Phase 2 React Foundation.
- All `x-citiportal-loginid` header enforcement, CORS lock-down, ES SSL truststore, plaintext DB password — Phase 9 Domain Security.
- Uncomment `clobToString` lines, fix `statusses` typo, frontend `console.log` removal, dark-mode TLM filters fix, `TlmJdbcTemplateFactory` hardcoded path — Phase 8 polish.
- Testcontainers integration tests — reconsider per-phase; not Phase 1.
- TeamCity CI wiring — Phase 8 Ops or backlog.
- Spike on `oraclepki` + Java 21 — only if execution surfaces a real issue.

## Phase Dependencies Surfaced

- **Phase 0.1: Local Dev Seed Bootstrap** must be inserted between Phase 0 (complete) and Phase 1, and complete before Phase 1's BOOT-09 smoke can run. The seed work produces a sibling folder `../rectrace-local-dev/` outside this repo.
