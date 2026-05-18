---
phase: 0
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-12
---

# Phase 0 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | JUnit 5 (via `spring-boot-starter-test` 2.7.16) |
| **Config file** | `backend/rectrace/src/test/resources/application-test.properties` (new) and `rectrace-tlm-stats/src/test/resources/application-test.properties` (new) |
| **Quick run command** | `mvn -pl backend/rectrace test` (single module) |
| **Full suite command** | `mvn -pl backend/rectrace,rectrace-tlm-stats test` (both backend modules) |
| **Estimated runtime** | ~30–60 seconds (only context-load tests; no DB/ES, no Karma) |

Parity-matrix validation is content-level, not test-driven — verified by file-presence checks and row-count assertions against the day-0 inventory commands from RESEARCH.md.

---

## Sampling Rate

- **After every task commit:** Run `mvn -pl <module> test` for whichever module's source was touched (or both if the change is cross-module).
- **After every plan wave:** Run full suite `mvn -pl backend/rectrace,rectrace-tlm-stats test`.
- **Before `/gsd-verify-work`:** Full suite must be green AND `.planning/parity-matrix.md` must exist with every row's target = non-`tbd`.
- **Max feedback latency:** ~60 seconds (full suite).

---

## Per-Task Verification Map

This map will be filled by the planner — each plan's tasks reference back to this VALIDATION.md by task ID. Initial scaffold based on RESEARCH.md's 3-plan breakdown:

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 00-A-01 | A | 1 | FOUND-01 | — | N/A | manual | `grep -L 'maven.test.skip' backend/rectrace/pom.xml` | ✅ | ⬜ pending |
| 00-A-02 | A | 1 | FOUND-03 | — | N/A | unit | `mvn -pl backend/rectrace test -Dtest=ContextLoadsTest` | ❌ W0 | ⬜ pending |
| 00-A-03 | A | 1 | FOUND-03 | — | N/A | file | `test -f backend/rectrace/src/test/resources/application-test.properties` | ❌ W0 | ⬜ pending |
| 00-B-01 | B | 1 | FOUND-01 | — | N/A | manual | `grep -L 'maven.test.skip' rectrace-tlm-stats/pom.xml` | ✅ | ⬜ pending |
| 00-B-02 | B | 1 | FOUND-03 | — | N/A | unit | `mvn -pl rectrace-tlm-stats test -Dtest=TlmStatsApplicationTests` | ✅ | ⬜ pending |
| 00-B-03 | B | 1 | FOUND-03 | — | N/A | file | `test -f rectrace-tlm-stats/src/test/resources/application-test.properties` | ❌ W0 | ⬜ pending |
| 00-C-01 | C | 1 | FOUND-04 | — | N/A | file | `test -f .planning/parity-matrix.md` | ❌ W0 | ⬜ pending |
| 00-C-02 | C | 1 | FOUND-04 | — | N/A | content | `grep -c '^|' .planning/parity-matrix.md` (≥ expected row count from RESEARCH.md §inventory) | ❌ W0 | ⬜ pending |
| 00-C-03 | C | 1 | FOUND-04 | — | N/A | content | `grep -v ' tbd ' .planning/parity-matrix.md \| grep -c 'port\|replace-content-with-recviz\|replace-fully-with-recviz\|drop'` (every row has a non-tbd target) | ❌ W0 | ⬜ pending |
| 00-D-01 | A | 1 | FOUND-02 | — | mvn fails build on test red | manual | "Inject a deliberately failing test, `mvn -pl backend/rectrace test` exit code != 0, remove the test" | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Final task table is owned by the planner; this scaffold gives the planner the verification shape to follow.*

---

## Wave 0 Requirements

- [ ] `backend/rectrace/src/test/resources/application-test.properties` — exclude DataSource + Hibernate + Tx-Manager + Elasticsearch auto-configs per RESEARCH.md §"Spring profile exclusion recipe"
- [ ] `backend/rectrace/src/test/java/com/citi/recmgmt/rectrace/ContextLoadsTest.java` — minimum `@SpringBootTest @ActiveProfiles("test")` test for FOUND-03
- [ ] `rectrace-tlm-stats/src/test/resources/application-test.properties` — exclude DataSource auto-configs + provide test placeholder for `recportal.datasource.url` per RESEARCH.md
- [ ] `rectrace-tlm-stats/src/test/java/.../TlmStatsApplicationTests.java` already exists; verify it loads under the new test profile
- [ ] `@Profile("!test")` on `DataSourceConfig`, `AutosysDataSourceConfig` (in `backend/rectrace`) and `DatabaseConfig` (in `rectrace-tlm-stats`) per RESEARCH.md §"User-defined @Configuration classes call ScriptExecutor at bean creation"
- [ ] `.planning/parity-matrix.md` — day-0 rollup with the row set discovered by RESEARCH.md §"day-0 inventory" commands

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `mvn install` fails on test red (build gate) | FOUND-02 | Requires deliberately failing test + restoration; can't be in the regular test suite | 1. Add `assertEquals(1, 2)` to one of the ContextLoadsTest classes. 2. Run `mvn -pl <module> install` — confirm non-zero exit. 3. Restore the test. 4. Re-run `mvn install` — confirm success. |
| Parity matrix completeness | FOUND-04 | Subjective inspection that every Angular route/tab is represented | Cross-reference parity-matrix row count against `frontend/rectrace/src/app/app-routing.module.ts` and `backend/rectrace/src/main/resources/search-config-v4.json` category list — manually confirm no route is missing. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
