---
phase: 1
slug: backend-platform-upgrade
artifact: BOOT-09 manual smoke checklist
authored: 2026-05-12
status: authored (Results table pending live execution + user UI sign-off)
references:
  - 01-VALIDATION.md § BOOT-09 Manual Smoke (lines 60-114)
  - 01-PLAN.md Wave 8 Task 8.1
  - 01-CONTEXT.md line 87 (planner Discretion)
  - .planning/phases/00.1-local-dev-seed-bootstrap/00.1-07-SUMMARY.md (3-UI-deferred pattern)
---

# Phase 1 — BOOT-09 Manual Smoke Checklist

> The final phase-exit verification gate for the Spring Boot 2.7.16 → 3.5.14 + Java 17 → 21 + `javax` → `jakarta` upgrade. Run against the `local` profile with the sibling `../rectrace-local-dev/` stack as backing infrastructure.
>
> Nine automatable steps (1–9) below are executable from a terminal. Three UI steps (UI-a, UI-b, UI-c) are deferred to the user — same pattern as Phase 00.1 P07 (`00.1-07-SUMMARY.md` lines 92–94). The Results table at the bottom captures pass/fail per step at execution time.
>
> **Threat-model closures exercised here:** T-1-SEC-04 (SecurityFilterChain permit-all anonymous-200, step 5), T-1-LOG-01 + T-1-CFG-01 (no `printStackTrace` / `show_sql` in startup log, step 7).

---

## Pre-flight

The sibling `../rectrace-local-dev/` stack must be running and seeded before any smoke step runs. The 8-item seed-verify checklist was already executed at Phase 00.1 P07 exit (`00.1-07-SUMMARY.md`); these two assertions confirm the stack is still up.

```bash
# (i) Both Docker containers are running
cd ../rectrace-local-dev && docker compose ps
# Expected: oracle-free + elasticsearch both 'Up' / 'healthy'

# (ii) Seed is intact — 5 Oracle rows + 5 ES docs, 14/14 baseline checks pass
./bin/apply.py --verify
# Expected: "14/14 checks passed" (zero red lines)
```

If either pre-flight check fails, halt — fix the sibling stack first (see `../rectrace-local-dev/README.md` Troubleshooting), then resume.

---

## Local-profile credentials

The Wave 7 conditional-wrap landed in `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/DataSourceConfig.java` and `rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/config/DatabaseConfig.java` (lines 80 + 108). Under the `local` profile the password-from-script path is skipped entirely when a plaintext `datasource.password` is supplied — either via the `application-local.properties` files (Phase 00.1 P07) or via shell env (`LOCAL_DB_PASSWORD=oracle`).

The local profile's HikariCP pool names — observable in the startup log — are:
- `Rectrace-HikariCP` (primary RECTRACE schema, backend/rectrace)
- `Reconmgmt-HikariCP` (rectrace-tlm-stats)
- `Recportal-HikariCP` (rectrace-tlm-stats)

These three pool-name strings are asserted in step 1 / step 8 below as proof that the Wave 6 BOOT-08 explicit HikariCP wiring (D-1.12) is intact.

---

## Step 1 — `backend/rectrace` boots on `local` profile

**Type:** Automatable

```bash
cd backend/rectrace
JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn spring-boot:run -Dspring-boot.run.profiles=local
```

**Expected log lines** (in order, within ~5 s of boot):
- `Starting RectraceApplication using Java 21`
- `HikariPool-… - Starting...` followed by `HikariPool-… - Start completed.` for **`Rectrace-HikariCP`** (D-1.12 explicit pool name — Wave 6 task 6.3)
- `Using dialect: org.hibernate.dialect.OracleDialect` (Wave 2 task 2.2 — D-1.11 + BOOT-05)
- `Tomcat started on port 6088 (http)`
- `Started RectraceApplication in <N> seconds`

**Must NOT appear:**
- `ORA-` errors (would indicate the conditional-wrap regression)
- Stack traces during startup

**Informational only (not blocking):**
- `Using generated security password: …` from `UserDetailsServiceAutoConfiguration` may appear because the in-built Spring Security autoconfig provisions an in-memory user manager regardless of the explicit `SecurityFilterChain` bean. The presence of this line is benign — it does **not** override the permit-all chain (verified at step 5). VALIDATION.md line 73 originally read "Expected: NO 'Using generated security password' line"; that expectation is relaxed here to "informational" pending a Phase 9 lockdown (SEC-01) that will explicitly exclude `UserDetailsServiceAutoConfiguration`.

**Status:** PASS = all "Expected" log lines present and no `ORA-` errors. FAIL = any expected line missing or any `ORA-` line present.

---

## Step 2 — V4 keyword search returns `SAMPLE_*` rows

**Type:** Automatable

With the backend from step 1 still running:

```bash
curl -s 'http://localhost:6088/rectrace/api/v4/search/initial?searchTerm=SAMPLE&category=rectrace_core' \
  -H 'x-citiportal-loginid: smoke-test' | jq '.results | length'
```

**Expected output:** `3` (the three `SAMPLE_*` rows in the Phase 00.1 P07 seed).

**Status:** PASS = `3`. FAIL = anything else (0, 404, error JSON).

---

## Step 3 — `/api/search/suggest` returns HTTP 200

**Type:** Automatable

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  'http://localhost:6088/rectrace/api/search/suggest?prefix=SET'
```

**Expected output:** `200`.

**Status:** PASS = `200`. FAIL = `401` (would indicate SecurityFilterChain regression), `404` (Wave 3 `SearchController` deletion regression), or `500`.

---

## Step 4 — Hyphenated keyword path (Phase 8 dry-run prerequisite)

**Type:** Automatable

```bash
curl -s 'http://localhost:6088/rectrace/api/v4/search/initial?searchTerm=SET-ABC-123&category=rectrace_core' \
  -H 'x-citiportal-loginid: smoke-test' | jq '.results | length'
```

**Expected output:** `1` (the `LOAD-ABC-123` job whose `set_id` field equals `SET-ABC-123`).

This step confirms the `.keyword` multi-field plumbing seeded in Phase 00.1 P04 survives the platform upgrade. The actual hyphen-search **bug fix** is Phase 8; this is the dry-run prerequisite VALIDATION.md line 86 demands.

**Status:** PASS = `1`. FAIL = `0` (hyphen regression) or error.

---

## Step 5 — SecurityFilterChain permit-all passes anonymous requests (T-1-SEC-04 closure)

**Type:** Automatable

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  'http://localhost:6088/rectrace/api/search/suggest?prefix=AB'
```

**Expected output:** `200` (and explicitly **NOT** `401`).

This proves the Wave 5 `SecurityFilterChain` bean (BOOT-04) wires the permit-all chain correctly. A `401` would indicate the in-memory user manager from step 1's "informational" warning is overriding the explicit chain — a Wave 5 regression.

**Status:** PASS = `200`. FAIL = `401` (T-1-SEC-04 regression — block wave-exit).

---

## Step 6 — execution-order endpoint returns a sequence

**Type:** Automatable

```bash
curl -s 'http://localhost:6088/rectrace/api/execution-order/LOAD-ABC-123' \
  -H 'x-citiportal-loginid: smoke-test' | jq '.executionSequence | length'
```

**Expected output:** integer `>= 1` (the seed includes a PRE/MAIN/POST sequence for `LOAD-ABC-123`).

**Status:** PASS = `>= 1`. FAIL = `0` or HTTP error.

---

## Step 7 — `printStackTrace` / `show_sql` absent from startup log (T-1-LOG-01 + T-1-CFG-01 closure)

**Type:** Automatable

Stop the backend from step 1 (Ctrl-C in its window), then re-run with stdout piped through grep:

```bash
cd backend/rectrace
JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn spring-boot:run -Dspring-boot.run.profiles=local 2>&1 | \
  tee /tmp/rectrace-startup.log | \
  grep -E "show_sql|printStackTrace"
```

Wait for `Started RectraceApplication`, then Ctrl-C and grep the captured log file:

```bash
grep -cE 'show_sql|printStackTrace' /tmp/rectrace-startup.log
```

**Expected output:** `0` (zero hits — both grep-gates clean post-Wave-3 + Wave-6).

**Status:** PASS = `0`. FAIL = any non-zero count.

---

## Step 8 — `rectrace-tlm-stats` boots on `local` profile

**Type:** Automatable

In a fresh terminal (backend can stay running from step 1):

```bash
cd rectrace-tlm-stats
JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn spring-boot:run -Dspring-boot.run.profiles=local
```

**Expected log lines:**
- `Starting TlmStatsApplication using Java 21`
- `HikariPool-… - Starting...` followed by `Start completed.` for **`Reconmgmt-HikariCP`** AND **`Recportal-HikariCP`** (two pools — D-1.12 / Wave 6 task 6.3)
- `Tomcat started on port 8080`
- `Started TlmStatsApplication in <N> seconds`

**Must NOT appear:** `ORA-` errors (Wave 7 conditional-wrap regression check for `DatabaseConfig.java:80,108`).

**Status:** PASS = both pool names visible + tomcat on 8080 + no `ORA-`. FAIL = any expected element missing.

---

## Step 9 — `rectrace-tlm-stats` actuator health is up

**Type:** Automatable

With the tlm-stats service from step 8 still running:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/actuator/health
```

**Expected output:** `200`.

**Status:** PASS = `200`. FAIL = anything else.

---

## UI smoke — Deferred to user (same 3-item pattern as Phase 00.1 P07)

These three steps exercise the Angular SPA against the upgraded backend. They cannot be executed in a headless orchestrator context — the user must run them manually and record the outcome in the Results table below.

### UI-a — Execution-order graph renders multi-node

**Type:** `DEFERRED-TO-USER`

**Pre-req:** Steps 1, 6 PASS. Backend from step 1 still running.

**Recipe:**
1. In a new terminal: `cd frontend/rectrace && npm start` (Angular dev server on `http://localhost:4200`).
2. Browse to `http://localhost:4200`.
3. In the search box, type `LOAD-ABC-123` and run a search against the `rectrace_core` category.
4. On the result row, click the **execution-order** button (the Cytoscape-icon button — see `frontend/rectrace/src/app/custom-interactions/components/renderers/execution-order-button.component.ts`).
5. The modal opens; the Cytoscape canvas renders the job dependency graph with **≥ 1 node** (the seed places a PRE / MAIN / POST 3-node sequence on `LOAD-ABC-123`).
6. No console errors in the browser devtools.

**PASS criterion:** modal opens, graph renders, no console errors. **FAIL:** modal blank / console errors / network 4xx-5xx.

### UI-b — TLM-stats modal opens and displays data

**Type:** `DEFERRED-TO-USER`

**Pre-req:** Steps 1, 8 PASS. Both backend (port 6088) and tlm-stats (port 8080) running.

**Recipe:**
1. From the same Angular UI as UI-a, search again for `SAMPLE` against `rectrace_core`.
2. On a result row, click the **Set ID renderer** (the `set-id-v2-renderer` cell — see `frontend/rectrace/src/app/custom-interactions/components/renderers/v2/set-id-v2-renderer.component.ts`).
3. The TLM-stats modal opens and displays the BreakStats / AutoMatchStats / ManualMatchStats charts.
4. Network tab shows successful `200` responses to `/api/tlm-stats/...` endpoints against `localhost:8080`.

**PASS criterion:** modal opens, charts visible, network 200. **FAIL:** modal blank / `ECONNREFUSED:8080` / 401/403/500.

### UI-c — QuickRec modal opens and displays data

**Type:** `DEFERRED-TO-USER`

**Pre-req:** Steps 1, 8 PASS. Both backend (port 6088) and tlm-stats (port 8080) running.

**Recipe:**
1. From the Angular UI, search for a QuickRec-bearing row.
2. Click the **Recon ID renderer** (see `frontend/rectrace/src/app/custom-interactions/components/renderers/recon-id-renderer/recon-id-renderer.component.ts`).
3. The QuickRec modal opens and displays the QuickRec stats.
4. Network 200 against `/api/quickrec-stats/...` endpoints on `localhost:8080`.

**PASS criterion:** modal opens, stats visible, network 200. **FAIL:** modal blank / connection error / 5xx.

---

## Results

> Filled in at smoke execution time. Steps 1–9 are blocking (must be PASS to declare BOOT-09 closed). UI-a/b/c are non-blocking — `DEFERRED` is acceptable per the Phase 00.1 P07 precedent.

| # | Step | Disposition | Notes | Date |
|---|------|-------------|-------|------|
| 1 | Backend boots on `local` (Rectrace-HikariCP + OracleDialect + Tomcat:6088) | _pending_ | | |
| 2 | V4 keyword search returns 3 rows for `SAMPLE` | _pending_ | | |
| 3 | `/api/search/suggest?prefix=SET` returns 200 | _pending_ | | |
| 4 | Hyphenated keyword `SET-ABC-123` returns 1 row | _pending_ | | |
| 5 | SecurityFilterChain permit-all → anonymous 200 (T-1-SEC-04) | _pending_ | | |
| 6 | execution-order endpoint returns sequence ≥ 1 | _pending_ | | |
| 7 | No `printStackTrace`/`show_sql` in startup log (T-1-LOG-01 + T-1-CFG-01) | _pending_ | | |
| 8 | tlm-stats boots on `local` (Reconmgmt-HikariCP + Recportal-HikariCP + Tomcat:8080) | _pending_ | | |
| 9 | tlm-stats actuator/health → 200 | _pending_ | | |
| UI-a | Execution-order graph renders multi-node (Cytoscape, ≥ 1 node) | **DEFERRED-TO-USER** | Recipe above. Same pattern as Phase 00.1 P07. | |
| UI-b | TLM-stats modal opens with charts | **DEFERRED-TO-USER** | Recipe above. | |
| UI-c | QuickRec modal opens with data | **DEFERRED-TO-USER** | Recipe above. | |

---

## Verifier sign-off

After running steps 1–9 and recording the result table above, the user signs off the three deferred UI items by checking the boxes below.

- [ ] **UI-a** Execution-order graph renders correctly post-upgrade. Verifier initials + date:
- [ ] **UI-b** TLM-stats modal opens and displays data. Verifier initials + date:
- [ ] **UI-c** QuickRec modal opens and displays data. Verifier initials + date:

When all three UI boxes are checked AND steps 1–9 are PASS in the Results table, **BOOT-09 is closed** and Phase 1 is ready for `/gsd-verifier`.

---

## Anomaly handling

If any blocking step (1–9) fails:
1. Halt execution at that step.
2. Record the failure verbatim in the Notes column of the Results row (full error text + first 20 lines of stack trace if any).
3. Open a phase-exit blocker entry in `.planning/STATE.md` referencing the failed step.
4. Do NOT proceed to wave-exit commit until the failure is root-caused. Phase 1 stays open.

Pre-existing flaky tests or unrelated warnings that surface during execution but were not introduced by Waves 1–7 should be flagged for the verifier (not auto-fixed in Wave 8 per the planner's Wave 8 scope rule).

---

*Authored 2026-05-12 by the Wave 8 executor. Format mirrors Phase 00.1 P07 (`00.1-07-SUMMARY.md` lines 85-98) per planner Discretion call in CONTEXT.md line 87.*
