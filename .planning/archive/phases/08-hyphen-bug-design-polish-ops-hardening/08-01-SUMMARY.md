---
phase: 08-hyphen-bug-design-polish-ops-hardening
plan: 01
subsystem: api

tags: [elasticsearch, wildcard, search, java, spring-boot, junit, regression, smoke]

requires:
  - phase: 00.1-local-dev-seed-bootstrap
    provides: rectrace_core_index mapping with .keyword multi-fields on the 13 hyphen-sensitive fields; seed values RID-XYZ-42 / RECON-XYZ-42 / SET-ABC-123 / LOAD-ABC-123
  - phase: 01-boot-upgrade
    provides: Elasticsearch Java API Client 8.x on the live ES path (WildcardQuery.caseInsensitive(Boolean) builder method)
  - phase: 02-react-foundation
    provides: scripts/smoke-ssrm.sh style template + ops/rectrace-ops.sh start/stop lifecycle
  - phase: 07-observability
    provides: /actuator/health/readiness probe (canonical "app accepting traffic" check used by the smoke)
provides:
  - Case-insensitive wildcard search on `.keyword` subfields in ElasticsearchServiceV4 — hyphenated identifiers now return ≥1 hit
  - `HyphenSearchRegressionTest` — boot+ES regression gated by `-Des.live=true` (4 tests, SKIP cleanly in CI without flag)
  - `scripts/smoke-hyphen-search.sh` — live-stack 6-assertion smoke (PASS verified)
  - `HYPHEN-DIAGNOSTIC.md` — `_analyze` evidence + root cause + production-stack runbook
affects: [phase-08-02-ops-hardening, phase-09-domain-security, frontend-react-search-vertical-slice]

tech-stack:
  added: []
  patterns:
    - "ES wildcard `.keyword`-branch routing: split single WildcardQuery builder into `buildWildcard(field, pattern)` helper that applies `caseInsensitive(true)` to fields ending in `.keyword`"
    - "JUnit live-ES regression gate: `@SpringBootTest` + `@ActiveProfiles(\"local\")` + `@EnabledIfSystemProperty(named=\"es.live\", matches=\"true\")` — runs against live ES locally with the flag, SKIPs cleanly in CI without"
    - "Live-stack smoke uses `/actuator/health/readiness` (not aggregate `/health`) so unrelated indicator DOWNs (Oracle DS, loader-run-age) don't block the search-API smoke"

key-files:
  created:
    - ".planning/phases/08-hyphen-bug-design-polish-ops-hardening/HYPHEN-DIAGNOSTIC.md"
    - "backend/rectrace/src/test/java/com/citi/gru/rectrace/service/v4/HyphenSearchRegressionTest.java"
    - "scripts/smoke-hyphen-search.sh"
  modified:
    - "backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v4/ElasticsearchServiceV4.java"

key-decisions:
  - "D-8.2 locked: fix is additive — caseInsensitive(true) on the .keyword wildcard branch only. No reindex, no search-config-v4.json edit, no DTO change."
  - "Keep `pattern = '*' + keyword.toLowerCase() + '*'` — the text-field wildcard branch still benefits from lowercasing (analyzer-aligned). The .keyword branch ignores case anyway via the new flag."
  - "Regression test gated by `-Des.live=true` rather than test-profile mock — keeps the assertion honest against the real ES seed; CI without ES skips cleanly via JUnit's `@EnabledIfSystemProperty`."
  - "Smoke step 1 uses `/actuator/health/readiness` instead of `/actuator/health` — the aggregate is DOWN on a laptop dev stack for reasons unrelated to search (Oracle DS, loader-run-age indicator); readiness reflects the contract this smoke actually cares about."
  - "Test-input alignment with the seed (Rule 1 fix): plan body uses `RECON-XYZ-42` for the reconId category, but the seed has `recon_id=RID-XYZ-42` (the literal `RECON-XYZ-42` lives in `job_name`). Tests use the seed's actual values, mapped to the right categories."

patterns-established:
  - "ES .keyword wildcard with caseInsensitive(true): canonical way to handle case-preserving keyword fields when user input case is uncontrolled. Re-usable for future search fields that need 'literal substring on a hyphenated identifier' semantics."
  - "Live-ES regression gate (-Des.live=true): adopt for any future test that boots Spring + hits a live infrastructure service (ES, Oracle, recviz). Avoids the test-profile-mock divergence trap; CI default = SKIP."

requirements-completed: [BUG-01, BUG-02, BUG-03]

duration: ~25min
completed: 2026-05-17
---

# Phase 8 Plan 01: Hyphen-Search Bug — Diagnostic, Fix, Regression-Lock Summary

**Root-cause fix in `ElasticsearchServiceV4`: route `.keyword`-subfield wildcards through `caseInsensitive(true)` so hyphenated identifiers like `RECON-XYZ-42`, `RID-XYZ-42`, `SET-ABC-123` return hits instead of zero. Locked by a `@SpringBootTest` regression and a 6/6-green live-stack smoke.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-17T21:19:00Z
- **Completed:** 2026-05-17T21:38:00Z
- **Tasks:** 3 (RED + GREEN counted under Task 2)
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments

- **BUG-01 diagnosed against live ES:** captured `_analyze` output for `standard` vs `recon_id.keyword` analyzers; reproduced the zero-hit bug with the lowercased wildcard pattern and proved the `case_insensitive=true` fix path against the seed. Documented at `HYPHEN-DIAGNOSTIC.md` with the runbook for the production-stack mapping PUT (additive, no reindex).
- **BUG-02 fixed in code (3-line core change, ~20 lines incl. docstring + helper):** `ElasticsearchServiceV4.getUniqueValues` now routes `.keyword`-suffixed search fields through a `buildWildcard(field, pattern)` helper that applies `WildcardQuery.of(w -> w.field(field).value(pattern).caseInsensitive(true))`. Text-field wildcards unchanged.
- **BUG-02 locked by JUnit regression:** `HyphenSearchRegressionTest` boots Spring with the `local` profile and exercises `getUniqueValues` against the live ES seed across three categories (`reconId`, `jobName`, `setId`) plus a mixed-case typing case. RED → GREEN verified: 4/4 fail before the fix, 4/4 pass after.
- **BUG-03 locked by live smoke:** `scripts/smoke-hyphen-search.sh` exits 0 with 6/6 assertions PASS against the running backend (health readiness + 3 categories × hyphenated keywords + mixed-case + negative control).

## Task Commits

Each task was committed atomically:

1. **Task 1: `_analyze` diagnostic + HYPHEN-DIAGNOSTIC.md** — `03c91ea` (docs)
2. **Task 2 RED: failing regression test** — `3358296` (test)
3. **Task 2 GREEN: caseInsensitive(true) fix** — `4835e9d` (fix)
4. **Task 3: smoke-hyphen-search.sh** — `21b0f73` (feat)

_Plan metadata commit (this SUMMARY + STATE/ROADMAP updates) lands after self-check below._

## Files Created/Modified

- **`.planning/phases/08-hyphen-bug-design-polish-ops-hardening/HYPHEN-DIAGNOSTIC.md`** (created, 12 KB) — Verbatim `_analyze` + `_search` curl outputs, root cause cited at `ElasticsearchServiceV4.java:35`, locked fix path (D-8.2), seed-mapping audit table, production-stack PUT runbook, test-input alignment note.
- **`backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v4/ElasticsearchServiceV4.java`** (modified, +35/-2 lines) — Split single-lambda wildcard builder into a `buildWildcard(field, pattern)` helper that applies `caseInsensitive(true)` on `.keyword`-suffixed fields. DEBUG-log line records the keyword-branch count per category.
- **`backend/rectrace/src/test/java/com/citi/gru/rectrace/service/v4/HyphenSearchRegressionTest.java`** (created, 106 lines) — `@SpringBootTest` + `@ActiveProfiles("local")` + `@EnabledIfSystemProperty(named="es.live", matches="true")`. Four `@Test` methods covering `reconId`/`jobName`/`setId` + mixed-case typing. AssertJ assertions. SKIPs cleanly in CI without the flag.
- **`scripts/smoke-hyphen-search.sh`** (created, 166 lines, `chmod +x`, shellcheck-clean) — Six-assertion live-stack smoke against `http://localhost:6088`. Uses `/actuator/health/readiness` not `/actuator/health`. Color-coded `OK`/`FAIL` output, exits non-zero on first failure with the offending body.

## Decisions Made

- **Smoke uses `/actuator/health/readiness`, not `/actuator/health`** — see Auto-fixed Issue #2 below.
- **Test inputs aligned with seed (not plan body)** — see Auto-fixed Issue #1 below.
- **Mapping PUT documented as a Phase 8 runbook, not executed** — local-dev seed already has the `.keyword` subfields per Phase 0.1; the production-stack `PUT /_mapping` is the deploy-phase action recorded inside `HYPHEN-DIAGNOSTIC.md` section (d).
- **No REFACTOR commit** — the GREEN diff is a minimal, well-commented helper-method extraction. A separate refactor commit would not add value.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test/smoke keyword inputs aligned to seed values, not plan body**

- **Found during:** Task 1 diagnostic (`curl /_search` returned 0 hits for the plan's expected reconId / `RECON-XYZ-42` pair even with the case-insensitive fix in place).
- **Issue:** Plan body proposes `getUniqueValues("RECON-XYZ-42", reconIdConfig)` and a smoke `category=reconId&keyword=RECON-XYZ-42`. The seed (per the plan's own `<context>` line 109 and live verification against `localhost:9200`) has `recon_id=RID-XYZ-42`. The literal `RECON-XYZ-42` exists in `job_name`, not `recon_id`. Running the plan-body inputs verbatim against the real seed would produce a misleading GREEN/PASS (0=0 false success) or a misleading RED that hides the real bug.
- **Fix:** Use the seed values that actually exist, mapped to the correct categories: `reconId / RID-XYZ-42`, `jobName / RECON-XYZ-42`, `setId / SET-ABC-123`. Mixed-case proof uses `jobName / recon-xyz-42` (lowercase user typing vs uppercase indexed term). All four cases are recorded in `HYPHEN-DIAGNOSTIC.md` "Test-input alignment" table.
- **Files modified:** `HyphenSearchRegressionTest.java`, `smoke-hyphen-search.sh`, `HYPHEN-DIAGNOSTIC.md` (alignment table).
- **Verification:** Regression test 4/4 PASS with `-Des.live=true`; smoke 6/6 PASS against live backend. Both prove the fix on real seed data instead of a hypothetical that doesn't exist.
- **Committed in:** `3358296` (RED test commit) and `21b0f73` (smoke commit).

**2. [Rule 1 - Bug] Smoke health-probe target switched from `/health` to `/health/readiness`**

- **Found during:** Task 3 (smoke step 1 returned `503 {"status":"DOWN","groups":["liveness","readiness"]}` even though `/readiness` and `/liveness` both returned `{"status":"UP"}` individually).
- **Issue:** The aggregate `/actuator/health` was DOWN on the laptop dev stack because of unrelated indicators (Oracle data-source indicator without prod wallet, loader-run-age indicator before the first scheduled tick — pre-existing behaviour outside this plan's scope). The smoke was about to FAIL at step 1 even though the search API was healthy and returning the expected hits.
- **Fix:** Smoke uses `/actuator/health/readiness` — the canonical "app accepting traffic" probe per Spring Boot conventions. This is exactly the contract the smoke cares about (can we hit `/api/v4/search/initial`?), and it isolates the smoke from unrelated health indicators on a dev stack.
- **Files modified:** `scripts/smoke-hyphen-search.sh` (lines 22-29).
- **Verification:** Smoke now reports `OK actuator/health returned 200` and proceeds through all 6 assertions.
- **Committed in:** `21b0f73` (single Task 3 commit; the fix was applied before the first commit).

### Out-of-scope discoveries (logged, NOT fixed)

- `LoaderTicker.tick()` throws every 30s in the backend log (`Loader ticker: dueAt() threw — skipping this tick`). Phase 6 pre-existing surface; not introduced or worsened by this plan. Not added to `deferred-items.md` because it is already a Phase 6 known surface — see STATE.md Plan 06-* entries.

---

**Total deviations:** 2 auto-fixed (both Rule 1 — test/smoke input correctness).
**Impact on plan:** Both auto-fixes were necessary for the assertions to be honest. Plan intent satisfied verbatim. No scope creep.

## Issues Encountered

- **Backend `Started RectraceApplication` but aggregate health DOWN** — diagnosed as unrelated Oracle / loader indicators (Phase 6 territory). Switched smoke to readiness probe; recorded in Auto-fixed Issue #2.
- **First sentinel-managed `Bash` call after `Write`** wrote `HYPHEN-DIAGNOSTIC.md` into the main repo path instead of the worktree path (worktree-mode `#3099` absolute-path drift). Caught immediately by the `git add` step refusing the missing path; moved the file into the worktree and proceeded. Documented here as a one-shot tool surface, not a code issue.

## TDD Gate Compliance

Plan-level TDD on Task 2 fully observed:

- **RED gate:** `3358296` — `test(08-01): add failing hyphen-search regression test (RED)`. Verified 4/4 fail with `Expecting actual not to be empty` against the unfixed code (`returned 0 unique values`).
- **GREEN gate:** `4835e9d` — `fix(08-01): caseInsensitive(true) on .keyword wildcards (GREEN)`. Verified 4/4 pass; full backend suite 86/0/0 (4 skipped — the hyphen tests SKIP cleanly without the `-Des.live=true` flag, as designed).
- **REFACTOR gate:** Not invoked — GREEN diff is already minimal and idiomatic.

## Verification Results

### `mvn test` (full backend suite)

```
[INFO] Tests run: 86, Failures: 0, Errors: 0, Skipped: 4
[INFO] BUILD SUCCESS
```

The 4 skipped tests are the gated `HyphenSearchRegressionTest` cases — by design.

### `mvn test -Dtest=HyphenSearchRegressionTest -Des.live=true -Dspring.profiles.active=local`

```
[INFO] Tests run: 4, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 2.641 s -- in com.citi.gru.rectrace.service.v4.HyphenSearchRegressionTest
[INFO] BUILD SUCCESS
```

### `bash scripts/smoke-hyphen-search.sh`

```
[INFO] === Hyphen-Search Smoke (Phase 8 / BUG-01..03) ===
[INFO] Backend:         http://localhost:6088
[INFO] X-Correlation-Id: 00000000000000000000000000011111
[INFO] Step 1/6: GET http://localhost:6088/rectrace/actuator/health/readiness
[ OK ] actuator/health returned 200
[INFO] Step 2/6: GET http://localhost:6088/rectrace/api/v4/search/initial?keyword=RID-XYZ-42&category=reconId
[ OK ] category=reconId keyword='RID-XYZ-42' → 1 hit(s), first='RID-XYZ-42'
[INFO] Step 3/6: GET http://localhost:6088/rectrace/api/v4/search/initial?keyword=RECON-XYZ-42&category=jobName
[ OK ] category=jobName keyword='RECON-XYZ-42' → 1 hit(s), first='RECON-XYZ-42'
[INFO] Step 4/6: GET http://localhost:6088/rectrace/api/v4/search/initial?keyword=SET-ABC-123&category=setId
[ OK ] category=setId keyword='SET-ABC-123' → 1 hit(s), first='SET-ABC-123'
[INFO] Step 5/6: GET http://localhost:6088/rectrace/api/v4/search/initial?keyword=recon-xyz-42&category=jobName
[ OK ] category=jobName keyword='recon-xyz-42' → 1 hit(s), first='RECON-XYZ-42'
[INFO] Step 6/6: GET http://localhost:6088/rectrace/api/v4/search/initial?keyword=DEFINITELY-NOT-A-RECON-9999&category=reconId
[ OK ] category=reconId keyword='DEFINITELY-NOT-A-RECON-9999' → 0 hits (negative control passed)

[ OK ] [PASS] hyphen-search smoke: 6/6
```

Exit 0.

### Plan-stipulated zero-diff guard

- `git diff backend/rectrace/src/main/resources/search-config-v4.json`: **empty** — config not touched, satisfying D-8.2 additive-only constraint.

## Success Criteria

1. **Hyphenated user input returns ≥1 hit** — verified by smoke steps 2-5 and JUnit tests 1-4. PASS.
2. **JUnit regression exists, gated, green** — `HyphenSearchRegressionTest` 4/4 with `-Des.live=true`, SKIPS without it. PASS.
3. **Live smoke 6/6 PASS** — output above. PASS.
4. **Additive only** — no reindex, no mapping mutation on local-dev, no `search-config-v4.json` change. PASS.
5. **Root cause documented at `ElasticsearchServiceV4.java:35`** — captured in `HYPHEN-DIAGNOSTIC.md` (a)-(e). PASS.

## User Setup Required

None — fix is additive, no environment variables, no external service config. Production-stack mapping PUT is documented in `HYPHEN-DIAGNOSTIC.md` (section e) as a runbook step for the deploy phase, not this plan.

## Next Phase Readiness

- **Plan 08-02 (OPS hardening)** ready to start: this plan touched no `ops/` surface, no shared script other than the new `smoke-hyphen-search.sh` (which 08-02 may chain into a master `smoke-all.sh` if it wants).
- **Phase 9 (Domain Security)** unaffected: the fix is on the wildcard build path, not on auth or transport.
- **Frontend React search vertical slice** (Phase 3+) immediately benefits: any hyphenated user typing in the search box now produces hits via the unchanged `/api/v4/search/initial` contract.

## Self-Check: PASSED

All 5 expected artifacts present on disk:

- `.planning/phases/08-hyphen-bug-design-polish-ops-hardening/HYPHEN-DIAGNOSTIC.md`
- `.planning/phases/08-hyphen-bug-design-polish-ops-hardening/08-01-SUMMARY.md`
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v4/ElasticsearchServiceV4.java`
- `backend/rectrace/src/test/java/com/citi/gru/rectrace/service/v4/HyphenSearchRegressionTest.java`
- `scripts/smoke-hyphen-search.sh`

All 4 expected commit hashes present in git log:

- `03c91ea` (Task 1 — diagnostic)
- `3358296` (Task 2 RED — failing test)
- `4835e9d` (Task 2 GREEN — fix)
- `21b0f73` (Task 3 — smoke)

---
*Phase: 08-hyphen-bug-design-polish-ops-hardening*
*Completed: 2026-05-17*
