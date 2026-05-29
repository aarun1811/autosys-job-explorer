---
status: complete
phase: 02-react-foundation
source:
  - 02-01-SUMMARY.md
  - 02-02-SUMMARY.md
  - 02-03-SUMMARY.md
  - 02-04-SUMMARY.md
  - 02-05-SUMMARY.md
  - 02-VERIFICATION.md
started: 2026-05-13T11:30:00Z
updated: 2026-05-13T12:15:00Z
---

## Notes

**2026-05-13T12:15Z — Test 1 first run blocked the backend.**
`./ops/rectrace-ops.sh start backend` started the JVM (PID 8513) but `wait_ready` timed
out after 30 s because `mvn spring-boot:run` failed to compile. Errors: ~80 `cannot find
symbol` failures for `log`, `builder()`, `getKey()`, `getInitialFilter()`, `getRowGroupCols()`,
`getGroupKeys()` etc. — every one a Lombok-generated symbol.

Root cause: `backend/rectrace/pom.xml` did not declare Lombok as an annotation processor
under `maven-compiler-plugin/annotationProcessorPaths`. On Java 16+ the compiler plugin
no longer auto-discovers processors from the classpath. Latent since the Phase 01
BOOT-UPGRADE; surfaced now because (a) the Phase 01 verifier ran against an existing
`target/` cache, and (b) `ops/rectrace-ops.sh start backend` does a clean `mvn
spring-boot:run` from this session.

Fix landed in commit `24622a9` — added the `maven-compiler-plugin` configuration block
with `lombok` (version `${lombok.version}` = 1.18.46, managed by Boot 3.5.14 parent) as
an annotation processor path. Verified: `cd backend/rectrace && mvn -DskipTests clean
compile` → exit 0.

`rectrace-tlm-stats` is currently safe — zero Lombok imports in its main source — but
the same missing config exists there. If/when Lombok lands in that module, the same
fix must follow.

**2026-05-13T12:30Z — Test 1 second run revealed another bug.**
With the Lombok fix in place the JVM did compile and reached Spring bean creation,
but the DataSource bean failed with `ORA-12263: Failed to access tnsnames.ora in
/Users/arun/Workspace/Keys/Wallet_SY2I7XWJPD05U21S`. That's the production wallet
path from base `application.properties`. The local profile (which points at
`localhost:1521/FREEPDB1`) was not active.

Root cause: `ops/rectrace-ops.sh` invoked `mvn spring-boot:run -Dspring.profiles.active=local`.
The spring-boot-maven-plugin forks a child JVM and does not propagate raw `-D` system
properties from the mvn CLI to that JVM — the plugin-specific flag is
`-Dspring-boot.run.profiles=local`. Empirically confirmed: switching the flag changed
the error from "wallet path missing" to "Connection refused on localhost:1521" (the
seed stack just isn't currently up — that's a user-owned infrastructure step, not a
code bug).

Fix landed in commit `501a9b1` — both `BACKEND_CMD` and `TLMSTATS_CMD` in
`ops/rectrace-ops.sh` now use `-Dspring-boot.run.profiles=local`.

Test 1 is now blocked by infrastructure only: Phase 0.1 seed stack must be running
(`cd ../rectrace-local-dev && docker compose up -d && python3 apply.py`) before the
backend can connect.

## Current Test

number: 1
name: SSRM Live Smoke Test
expected: |
  With Phase 0.1's Oracle + Elasticsearch seed running and the backend started via
  `./ops/rectrace-ops.sh start backend`, running `bash scripts/smoke-ssrm.sh`
  exits with code 0 and prints `PASS: SSRM returned rows from /rectrace/api/v4/search/ssrm/fileName`.
  The endpoint returns 5 rows from the seed.
awaiting: user response

## Tests

### 1. SSRM Live Smoke Test
expected: |
  Start backend: `./ops/rectrace-ops.sh start backend` (assumes Phase 0.1 seed already running).
  Then run: `bash scripts/smoke-ssrm.sh`.
  Script exits 0 with "PASS: SSRM returned N row(s) from /rectrace/api/v4/search/ssrm/fileName".
result: pass
verified_at: 2026-05-13T13:00:00Z
notes: |
  Required four code/config fixes to make the path runnable (Lombok annotation processor;
  ops-script profile flag; spring→server.servlet.context-path typo; actuator starter +
  Brave 5.12 API migration). After those, the rewritten smoke-ssrm.sh exercises the real
  two-step flow (/initial?keyword=csv → SSRM POST with the harvested fileName values).
  Final run reports "SSRM returned 3 row(s) from /rectrace/api/v4/search/ssrm/fileName".

### 2. Correlation-ID Log Round-Trip
expected: |
  With backend running (logs writing to `logs/backend.log`), run: `bash scripts/smoke-correlation-id.sh`.
  Script exits 0. The sent X-Correlation-Id appears in `logs/backend.log`
  inside the `[traceId=…]` MDC field on the request-handling log line.
result: pass
verified_at: 2026-05-13T13:00:00Z
notes: |
  Required the same backend fixes as Test 1, plus two smoke-script corrections:
  switched probe URL from /ssrm (logs at DEBUG, suppressed) to /initial (logs at
  INFO), and changed CORR_ID to one with non-zero high bits (Brave omits
  leading-zero high bits in TraceContext.traceIdString()). Final run reports
  "Found X-Correlation-Id 'ca570f1deadbeef000000000000001ca' in backend log as
  traceId (3 occurrence(s))" — verifying the Brave Propagation.Factory adopts the
  X-Correlation-Id end-to-end via Option B (D-2.10).

### 3. Dark/Light Theme Toggle
expected: |
  Start dev server: `cd frontend-react && pnpm dev`. Open http://localhost:5173/.
  Click the sun/moon toggle button in the header. The page switches between light and dark themes.
  `document.documentElement` gets the `.dark` class added/removed accordingly.
  `localStorage.getItem('rectrace-theme')` returns `'light'` or `'dark'` matching the current state.
  Refreshing the page restores the chosen theme.
  Footer shows a non-empty short git SHA string.
result: pass
verified_at: 2026-05-13T13:30:00Z
verified_via: playwright-mcp
notes: |
  Initial state: html.classList="light", localStorage['rectrace-theme']=null.
  After click: document.documentElement.className === "dark", localStorage="dark",
  body bg = oklch(0.148 0.004 228.8). After reload: still "dark" (persisted).
  Footer renders "Rectrace · Build: 09be9e4 · v0.1.0" — git SHA matches HEAD.
  Bidirectional confirmed (click again → "light", localStorage="light").
  Screenshots: test3-before-toggle-light.png, test3-after-toggle-dark.png.

### 4. Error Toast with Correlation ID
expected: |
  With dev server running but backend stopped (`./ops/rectrace-ops.sh stop backend`),
  load the React app at http://localhost:5173/. The SmokeGrid's SSRM request fails.
  A Sonner toast appears at the bottom-right with "Error reference: <32-char-hex>"
  where the hex ID is exactly 32 lowercase hex characters.
result: pass
verified_at: 2026-05-13T13:30:00Z
verified_via: playwright-mcp
notes: |
  Required three code fixes before this could pass:
    1. apiFetch now attaches correlationId to network-layer errors (not just HTTP errors)
    2. SmokeGrid catch block routes the failure through reportRequestFailure (exported
       from queryClient.ts) — bypasses React Query so the queryCache.onError handler
       wasn't firing for SSRM
    3. <Toaster> moved above <Outlet> in __root.tsx + setTimeout(0) wrapper on the
       toast call — closes a Sonner 2.x race where toasts dispatched before the
       Toaster subscriber attaches are silently dropped
  Playwright polling caught the toast: at t=0ms after navigation with backend down,
  bottom-right region had "Request failed | Error reference: 034a5c5610844795ab78611d7f99db1b"
  (exactly 32 lowercase hex chars). Auto-dismissed after ~4s as Sonner default.
  Screenshot: test4-error-toast.png.

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
