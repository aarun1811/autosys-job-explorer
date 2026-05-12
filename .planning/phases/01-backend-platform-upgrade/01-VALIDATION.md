---
phase: 1
slug: backend-platform-upgrade
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-12
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Sourced from `01-RESEARCH.md` § Validation Architecture (lines 1056–1149).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | JUnit 5 (Jupiter) + Spring Boot Test, pulled by `spring-boot-starter-test` (BOM-managed under Spring Boot 3.5.14) |
| **Config files** | `backend/rectrace/src/test/resources/application-test.properties` (Phase 0 D-05); `rectrace-tlm-stats/src/test/resources/application-test.properties` (Phase 0 D-05) |
| **Quick run command (backend/rectrace)** | `mvn -f backend/rectrace/pom.xml test -Dtest=ContextLoadsTest -DskipITs` |
| **Quick run command (rectrace-tlm-stats)** | `mvn -f rectrace-tlm-stats/pom.xml test -Dtest=TlmStatsApplicationTests -DskipITs` |
| **Full suite command** | `mvn -f backend/rectrace/pom.xml clean test && mvn -f rectrace-tlm-stats/pom.xml clean test` |
| **Estimated runtime — quick** | ~15–20 s per module |
| **Estimated runtime — full** | ~60–90 s combined |

---

## Sampling Rate

- **After every task commit:** Run the quick command for the module touched by the commit (`ContextLoadsTest` or `TlmStatsApplicationTests`). ~15–20 s feedback.
- **After every plan wave merges:** Run the full suite command across both modules.
- **Before `/gsd-verify-work`:** Full suite must be green AND the BOOT-09 manual smoke checklist (`01-SMOKE-CHECKLIST.md`, authored by planner) must be executed against the `local` profile.
- **Max feedback latency:** 90 s (full suite).

---

## Per-Task Verification Map

Concrete task IDs will be filled in by the gsd-planner. The mapping below is the **requirement-level** verification contract that every planned task must trace to.

| Req ID | Behavior | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists |
|--------|----------|------------|-----------------|-----------|-------------------|-------------|
| **BOOT-01** | Java 21 toolchain compiles both modules | — | N/A | build | `mvn -f backend/rectrace/pom.xml -q -DskipTests compile && mvn -f rectrace-tlm-stats/pom.xml -q -DskipTests compile` | ✅ |
| **BOOT-02** | Spring Boot 3.5.14 BOM resolves cleanly in both modules | — | N/A | build | `mvn -f backend/rectrace/pom.xml dependency:tree -q \| grep 'spring-boot.*3.5.14'` (presence assertion) | ✅ |
| **BOOT-03** | No Jakarta-EE `javax.*` imports remain (JDK packages `javax.sql`, `javax.net.ssl`, `javax.crypto`, `javax.xml.*` stay) | — | N/A | grep | `! grep -rn '^import javax\.\(servlet\|persistence\|annotation\|transaction\|validation\|ws\|inject\)' backend/rectrace/src/main rectrace-tlm-stats/src/main` (corrected 2026-05-12: `sql` removed from deny-list — `javax.sql.DataSource` is JDK, not Jakarta EE) | ✅ |
| **BOOT-04** | `SecurityFilterChain` bean loads in both modules; permit-all passes anonymous calls; CSRF disabled | T-1-SEC-01 (deferred) | Permit-all (Phase 1 intentional per D-1.8); real authz Phase 9 | integration | `ContextLoadsTest` boots with `spring-boot-starter-security` on classpath; smoke: `curl -s -o /dev/null -w "%{http_code}" http://localhost:6088/rectrace/api/search/suggest?prefix=ABC` → `200` | ✅ |
| **BOOT-05** | Hibernate 6 / Spring Data JPA 3 context loads against new `OracleDialect` | — | N/A | unit + manual smoke | `ContextLoadsTest` (test profile bypasses Oracle); live smoke against `local` profile boots without `ClassNotFoundException` | ✅ |
| **BOOT-06** | `SuggestionService` returns suggestions on the new `ElasticsearchClient`; `ElasticsearchServiceV4` returns search results | — | N/A | manual smoke | `curl -s http://localhost:6088/rectrace/api/search/suggest?prefix=SET` → JSON array, HTTP 200; V4 search returns rows | ✅ |
| **BOOT-07** | No version overrides; Boot 3.5.14 BOM resolves all transitives | — | N/A | build | `! grep -A1 dependencyManagement backend/rectrace/pom.xml`; `mvn dependency:tree -q \| grep -E 'lombok\|micrometer\|hibernate-core'` shows BOM-managed versions only | ✅ |
| **BOOT-08** | No `printStackTrace`, no `System.err`, no `show_sql=true`; V3 trio + frontend `search.service.ts` deleted | T-1-LOG-01 | SLF4J error logging (V7 ASVS) | grep | `! grep -rn 'printStackTrace\|System\.err' backend/rectrace/src/main rectrace-tlm-stats/src/main`; `! grep -rn 'show-sql=true\|hibernate\.show_sql.*true' backend/rectrace/src/main rectrace-tlm-stats/src/main`; `! find backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v3 -type f`; `! ls frontend/rectrace/src/app/services/search.service.ts 2>/dev/null` | ✅ |
| **BOOT-09** | All Phase 0 tests pass on Boot 3.5.14 + manual smoke green against `local` profile | — | N/A | full suite + manual | `mvn -f backend/rectrace/pom.xml clean test && mvn -f rectrace-tlm-stats/pom.xml clean test` + `01-SMOKE-CHECKLIST.md` execution | ✅ (existing tests; smoke checklist authored by planner) |

*Status legend: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky — gsd-planner sets a per-task status row that maps each task to one of the requirement rows above.*

---

## BOOT-09 Manual Smoke (curl + browser; against `local` profile)

Adapted from `01-RESEARCH.md` § Validation Architecture. Detailed step list lives in the planner-authored `01-SMOKE-CHECKLIST.md`.

```bash
# Pre-flight: sibling repo stack up
cd ../rectrace-local-dev && docker compose ps  # both containers running
./bin/apply.py --verify                        # 5 rows in Oracle + 5 ES docs

# 1. backend/rectrace boots on local profile
cd ../autosys-job-explorer/backend/rectrace
JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn spring-boot:run -Dspring-boot.run.profiles=local
# Expected: "Tomcat started on port 6088" + "Using dialect: org.hibernate.dialect.OracleDialect"
# Expected: NO "Using generated security password" line

# 2. V4 keyword search returns SAMPLE_* rows
curl -s 'http://localhost:6088/rectrace/api/v4/search/initial?searchTerm=SAMPLE&category=rectrace_core' \
  -H 'x-citiportal-loginid: smoke-test' | jq '.results | length'
# Expected: 3

# 3. /api/search/suggest endpoint responds 200
curl -s -o /dev/null -w "%{http_code}\n" \
  'http://localhost:6088/rectrace/api/search/suggest?prefix=SET'
# Expected: 200

# 4. Hyphenated keyword path still works (Phase 8 dry-run prerequisite)
curl -s 'http://localhost:6088/rectrace/api/v4/search/initial?searchTerm=SET-ABC-123&category=rectrace_core' \
  -H 'x-citiportal-loginid: smoke-test' | jq '.results | length'
# Expected: 1

# 5. SecurityFilterChain permit-all passes anonymous requests
curl -s -o /dev/null -w "%{http_code}\n" \
  'http://localhost:6088/rectrace/api/search/suggest?prefix=AB'
# Expected: 200 (NOT 401)

# 6. execution-order endpoint returns sequence
curl -s 'http://localhost:6088/rectrace/api/execution-order/LOAD-ABC-123' \
  -H 'x-citiportal-loginid: smoke-test' | jq '.executionSequence | length'
# Expected: >= 1

# 7. printStackTrace / show_sql absent from startup log
JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn spring-boot:run -Dspring-boot.run.profiles=local 2>&1 | grep -E "show_sql|printStackTrace"
# Expected: empty output

# 8. rectrace-tlm-stats boots on local profile
cd ../../rectrace-tlm-stats
JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn spring-boot:run -Dspring-boot.run.profiles=local
# Expected: "Tomcat started on port 8080"

# 9. tlm-stats actuator health
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/actuator/health
# Expected: 200

# (UI smoke deferred to user — same 3 items as Phase 00.1 P07: execution-order graph, TLM-stats modal, QuickRec modal)
```

---

## Wave 0 Requirements

- [x] `backend/rectrace/src/test/java/com/citi/gru/rectrace/ContextLoadsTest.java` — already exists (Phase 0 plan 00-01). **Verify still green post-upgrade** (Boot 3.5 may surface deprecation warnings worth fixing in place).
- [x] `rectrace-tlm-stats/src/test/java/com/citi/gru/rectrace/tlmstats/TlmStatsApplicationTests.java` — already exists (Phase 0 plan 00-02). **Verify `@MockBean` still works** on Boot 3.5 (note: `@MockBean` is deprecated in Boot 3.4+ — migrate to `@MockitoBean` if a deprecation warning surfaces; non-blocking but worth folding into the upgrade if low-cost).
- [ ] `.planning/phases/01-backend-platform-upgrade/01-SMOKE-CHECKLIST.md` — gsd-planner authors during planning (CONTEXT.md Discretion call).

*No new test framework install needed; both modules already have `spring-boot-starter-test` pulled by the Boot BOM.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Execution-order graph renders correctly post-upgrade | BOOT-09 (UI smoke) | UI rendering not covered by Spring tests; Angular SPA path | Open browser at `http://localhost:4200`, search for `LOAD-ABC-123`, click execution-order button, confirm Cytoscape graph renders without console errors. (Deferred to user same as Phase 00.1 P07.) |
| TLM-stats modal opens and displays data | BOOT-09 (UI smoke) | UI rendering not covered by Spring tests | Open browser, find a row with a Set ID renderer, click it, confirm modal opens with `rectrace-tlm-stats` data populated. (Deferred to user.) |
| QuickRec modal opens and displays data | BOOT-09 (UI smoke) | UI rendering not covered by Spring tests | Open browser, find a row with a Recon ID renderer, click it, confirm QuickRec modal opens with data populated. (Deferred to user.) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references — 1 outstanding: `01-SMOKE-CHECKLIST.md` (planner-authored)
- [ ] No watch-mode flags
- [ ] Feedback latency < 90 s (full suite)
- [ ] `nyquist_compliant: true` set in frontmatter (set by planner once each task has a verify command)

**Approval:** pending
