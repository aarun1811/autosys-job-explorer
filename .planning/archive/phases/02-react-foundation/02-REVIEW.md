---
phase: 02-react-foundation
reviewed: 2026-05-13T10:00:00Z
depth: standard
files_reviewed: 43
files_reviewed_list:
  - frontend-react/package.json
  - frontend-react/vite.config.ts
  - frontend-react/tsconfig.json
  - frontend-react/tsconfig.app.json
  - frontend-react/tsconfig.node.json
  - frontend-react/tsconfig.eslint.json
  - frontend-react/components.json
  - frontend-react/vitest.config.ts
  - frontend-react/eslint.config.js
  - frontend-react/src/index.css
  - frontend-react/src/lib/theme.ts
  - frontend-react/src/lib/utils.ts
  - frontend-react/src/lib/queryClient.ts
  - frontend-react/src/test-setup.ts
  - frontend-react/src/vite-env.d.ts
  - frontend-react/src/main.tsx
  - frontend-react/src/App.tsx
  - frontend-react/src/components/layout/theme-provider.tsx
  - frontend-react/src/components/layout/theme-switch.tsx
  - frontend-react/src/components/app-shell/footer.tsx
  - frontend-react/src/routes/__root.tsx
  - frontend-react/src/routes/index.tsx
  - frontend-react/src/grid/SmokeGrid.tsx
  - frontend-react/src/components/ui/button.tsx
  - frontend-react/src/components/ui/sonner.tsx
  - frontend-react/src/components/ui/card.tsx
  - frontend-react/src/components/layout/theme-provider.test.tsx
  - frontend-react/src/lib/queryClient.test.ts
  - frontend-react/src/grid/SmokeGrid.test.tsx
  - frontend-react/tests/fixtures/raw-hex.tsx
  - frontend-react/README.md
  - frontend-react/.gitignore
  - frontend-react/.env.local.example
  - backend/rectrace/pom.xml
  - rectrace-tlm-stats/pom.xml
  - backend/rectrace/src/main/java/com/citi/gru/rectrace/config/CorrelationIdPropagationConfig.java
  - rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/config/CorrelationIdPropagationConfig.java
  - backend/rectrace/src/main/resources/logback-spring.xml
  - rectrace-tlm-stats/src/main/resources/logback-spring.xml
  - backend/rectrace/src/main/resources/application-local.properties
  - rectrace-tlm-stats/src/main/resources/application-local.properties
  - ops/rectrace-ops.sh
  - ops/build.sh
  - scripts/smoke-ssrm.sh
  - scripts/smoke-correlation-id.sh
findings:
  critical: 4
  warning: 8
  info: 5
  total: 17
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-05-13T10:00:00Z
**Depth:** standard
**Files Reviewed:** 43
**Status:** issues_found

## Summary

Phase 02 establishes the React foundation (Vite 7 / React 19 / shadcn / TanStack), wires Micrometer Brave correlation-ID propagation into both Spring Boot modules, and ships ops/smoke scripts. The architecture is sound and the major design decisions are implemented correctly. However, the review surfaces four Critical findings that require attention before this code handles production traffic or is extended by the next phase.

The most serious issues are: (1) the `sonner.tsx` component imports `useTheme` from `next-themes` — a library that is NOT installed — causing a runtime crash whenever the Toaster renders; (2) the `SmokeGrid.tsx` SSRM datasource is a module-level singleton, meaning AG-Grid will share one datasource instance across all mounts and cannot be properly destroyed; (3) the `ops/rectrace-ops.sh` `stop_component` sends SIGTERM but never waits for the process to actually die before returning, meaning a rapid stop-then-start can produce two running instances; and (4) the `build.sh` `STATIC_DIR` empty-variable guard fires only when the shell variable is empty string, but the guard is logically misplaced — the `rm -rf` executes even when the guard condition is triggered because there is no `exit 1` path that actually short-circuits the `rm` after the `fi`.

---

## Critical Issues

### CR-01: `sonner.tsx` imports `useTheme` from `next-themes` — package not installed

**File:** `frontend-react/src/components/ui/sonner.tsx:8`
**Issue:** `sonner.tsx` (a vendored shadcn component) imports `useTheme` from `"next-themes"`, but `next-themes` is not listed in `frontend-react/package.json`. The project uses its own `ThemeProvider` / `useTheme` from `@/components/layout/theme-provider`. At runtime the `import` will resolve to a missing module and the entire app will fail to load (Vite will throw a resolution error at build time, or at dev-server start). The `Toaster` component is rendered unconditionally in `__root.tsx` line 33, so every page visit will trigger this failure.

**Reproduction:**
```
pnpm build
# → Module not found: next-themes
```

**Fix:** Replace the `next-themes` import with the project's own `useTheme`, or map the Sonner theme to the resolved theme from context:

```tsx
// frontend-react/src/components/ui/sonner.tsx
import { useTheme } from "@/components/layout/theme-provider"

const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme } = useTheme()
  return (
    <Sonner
      theme={resolvedTheme as ToasterProps["theme"]}
      ...
    />
  )
}
```

Alternatively, add `next-themes` to `package.json` if the intent was to use it as the theme source, but that conflicts with the project's custom `ThemeProvider` which is already wired at the root.

---

### CR-02: `build.sh` STATIC_DIR guard does not prevent `rm -rf` execution

**File:** `ops/build.sh:23-28`
**Issue:** The T-2-05 guard checks `if [ -z "$STATIC_DIR" ]` and prints an error then calls `exit 1`, but `STATIC_DIR` is set unconditionally at line 8 from a `$REPO_ROOT` subshell expansion. If `REPO_ROOT` itself were ever empty (e.g., if `${BASH_SOURCE[0]}` is empty on a non-bash shell or the `cd` fails silently), `STATIC_DIR` would be set to `/backend/rectrace/src/main/resources/static` — a valid-looking absolute path — not to an empty string. The guard `[ -z "$STATIC_DIR" ]` would pass without triggering, and `rm -rf "/backend/rectrace/src/main/resources/static"` would execute.

More immediately: the guard is placed *after* the `pnpm build` / `npm run build` step (line 14) which itself runs `cd "$REPO_ROOT/frontend-react"`. If the `cd` on line 14 fails, execution `exit 1`s correctly, but the `cd` is done via `|| { exit 1; }` not `set -e`, meaning any intermediate failure between line 14 and line 27 is silently ignored. There is no `set -e` in this script.

**Fix:**
```bash
#!/usr/bin/env bash
set -euo pipefail   # add at top of script

# Validate STATIC_DIR is both non-empty AND a descendant of REPO_ROOT
STATIC_DIR="$REPO_ROOT/backend/rectrace/src/main/resources/static"
if [ -z "$REPO_ROOT" ] || [ -z "$STATIC_DIR" ] || [[ "$STATIC_DIR" != "$REPO_ROOT"* ]]; then
  echo "ERROR: STATIC_DIR safety check failed (REPO_ROOT='$REPO_ROOT', STATIC_DIR='$STATIC_DIR'). Aborting."
  exit 1
fi
rm -rf "$STATIC_DIR"
```

---

### CR-03: `rectrace-ops.sh` `stop_component` does not wait for process exit — start after stop races

**File:** `ops/rectrace-ops.sh:88-97`
**Issue:** `stop_component` sends `kill "$pid"` (SIGTERM) then unconditionally `sleep 3` and removes the PID file, returning success. It does not verify the process actually terminated. For a JVM process (backend / tlm-stats), 3 seconds is often insufficient for graceful shutdown — Spring Boot's default graceful shutdown timeout is 30 seconds and the actuator health endpoint stays UP until the JVM exits. After `stop_component` returns, the next `start_component` call finds no PID file and launches a second JVM. The result is two backend processes binding port 6088, with the second one failing to bind but the first process now ungoverned.

This bites in the `restart` flow (line 205-235) where `stop_component` + `start_component` are called back-to-back with no wait between them.

**Fix:**
```bash
stop_component() {
  local label="$1" pid_file="$2"
  [ -f "$pid_file" ] || { echo "$label: not running (no pid file)"; return 0; }
  local pid
  pid=$(cat "$pid_file")
  if kill -0 "$pid" 2>/dev/null; then
    echo "Stopping $label (pid $pid) ..."
    kill "$pid"
    local waited=0
    while kill -0 "$pid" 2>/dev/null && [ "$waited" -lt 30 ]; do
      sleep 1
      waited=$((waited + 1))
    done
    if kill -0 "$pid" 2>/dev/null; then
      echo "WARN: $label (pid $pid) did not stop in 30s — sending SIGKILL"
      kill -9 "$pid" 2>/dev/null || true
    fi
    rm -f "$pid_file"
    echo "$label stopped."
  else
    echo "$label: process $pid not found (stale pid file removed)"
    rm -f "$pid_file"
  fi
}
```

---

### CR-04: `SmokeGrid.tsx` datasource is a module-level singleton — leaks across remounts

**File:** `frontend-react/src/grid/SmokeGrid.tsx:12-37`
**Issue:** `datasource` is declared as a `const` at module scope (outside the `SmokeGrid` function). AG-Grid's SSRM contract requires each grid instance to receive its own datasource so that `destroy()` / cleanup can be scoped per-instance. With a singleton:

1. When `SmokeGrid` unmounts and remounts (e.g., during React Strict Mode double-invoke, or when navigating away and back), the same datasource object is passed to two AG-Grid instances that may both have in-flight `getRows` calls. The second grid's `params.success()` or `params.fail()` calls are routed to the first grid's SSRM context, causing phantom row updates or errors in the now-detached instance.
2. In React 18+ Strict Mode (used via `StrictMode` in `main.tsx`), components are mounted-unmounted-remounted in development. A shared datasource receiving two concurrent `getRows` calls will race on `params.success`.

There is no abort/cancel mechanism on the `apiFetch` call, so even after a grid unmounts, the fetch can complete and call `params.success` on the defunct params object.

**Fix:** Move datasource construction inside the component and add an `AbortController`:

```tsx
export function SmokeGrid() {
  const datasource = useMemo<IServerSideDatasource>(() => {
    const controller = new AbortController()
    return {
      getRows: async (params) => {
        try {
          const res = await apiFetch('/rectrace/api/v4/search/ssrm/fileName', {
            method: 'POST',
            body: JSON.stringify({ /* body */ }),
            signal: controller.signal,
          })
          const data = await res.json() as { rows: Record<string, unknown>[]; lastRow: number }
          params.success({ rowData: data.rows, rowCount: data.lastRow })
        } catch (err) {
          if ((err as { name?: string }).name !== 'AbortError') {
            console.error('SSRM fail', err)
            params.fail()
          }
        }
      },
      destroy: () => controller.abort(),
    }
  }, [])
  // ...
}
```

Note: `apiFetch` in `queryClient.ts` does not accept a `signal` in its current signature — the `RequestInit` is spread via `...init`, so passing `signal` in `init` would work for the underlying `fetch`, but the caller needs to include it explicitly. Ensure `apiFetch` passes `init` headers correctly when merging (current line 11 overrides `init.headers` correctly but positionally resets `Content-Type`).

---

## Warnings

### WR-01: `theme-provider.tsx` reads `localStorage` synchronously in `useState` initializer — will throw if `localStorage` is inaccessible

**File:** `frontend-react/src/components/layout/theme-provider.tsx:20-23`
**Issue:** The `useState` initializer calls `localStorage.getItem(STORAGE_KEY)` directly. In environments where `localStorage` is blocked (Safari ITP with storage restriction, Firefox containers, or private browsing with cookies disabled), `localStorage.getItem` throws `DOMException: SecurityError`. The `typeof window === 'undefined'` guard on line 21 guards against SSR but not against a live DOM with blocked storage.

**Fix:**
```tsx
const [theme, setThemeState] = useState<Theme>(() => {
  if (typeof window === 'undefined') return 'system'
  try {
    return (localStorage.getItem(STORAGE_KEY) as Theme) ?? 'system'
  } catch {
    return 'system'
  }
})
```

Apply the same guard to the `setTheme` function's `localStorage.setItem` call (line 47).

---

### WR-02: `theme-provider.tsx` system-theme `useEffect` handler does not update `resolvedTheme` via state — direct DOM mutation bypasses React

**File:** `frontend-react/src/components/layout/theme-provider.tsx:33-44`
**Issue:** When `theme === 'system'`, the `matchMedia` `change` handler (line 39) directly mutates `document.documentElement.classList` without calling `setThemeState`. This means `resolvedTheme` in the context value is stale — it continues to report the theme at mount time rather than the current resolved theme. Components that read `resolvedTheme` (e.g., `ThemeSwitch` showing the wrong icon after an OS-level theme change) will not update. The test at line 6 of `theme-provider.test.tsx` only checks the initial render, so this is not caught.

**Fix:** The handler should trigger a re-render by updating state, not mutating the DOM directly:

```tsx
// Replace the mq change handler's body with:
const handler = () => {
  // Force re-render by toggling a derived state value;
  // getSystemTheme() is called fresh each render via resolvedTheme computation.
  setThemeState('system') // triggers re-render; resolvedTheme recomputes
}
```

Or use a local `[, forceUpdate] = useReducer(x => x + 1, 0)` trigger. The current DOM-direct approach means `resolvedTheme` in `ThemeContextValue` diverges from what is actually applied to `<html>`.

---

### WR-03: `queryClient.ts` `onError` callback casts `error` with an unsafe type assertion to extract `correlationId`

**File:** `frontend-react/src/lib/queryClient.ts:24-25`
**Issue:** The `onError` callback casts `error as { correlationId?: string }`. This cast is unchecked — if a non-`apiFetch` error (e.g., a network timeout, a `JSON.parse` failure, or an error thrown by a third-party library) is passed, the cast succeeds silently and `corrId` is `undefined`. The toast falls back gracefully to the generic message, which is acceptable. However, the cast pattern is also used in the test file (`queryClient.test.ts:21`) as `{ correlationId: string }` (non-optional) — if the correlationId is absent, the assertion is a lie that TypeScript accepts. This is a maintainability hazard that will mislead future developers adding error-path code.

**Fix:**
```typescript
onError: (error) => {
  const corrId = error != null && typeof (error as Record<string, unknown>)['correlationId'] === 'string'
    ? (error as Record<string, unknown>)['correlationId'] as string
    : undefined
  toast.error(...)
}
```

Or better, define a typed error class:
```typescript
class ApiFetchError extends Error {
  constructor(message: string, public readonly correlationId: string) {
    super(message)
  }
}
```

---

### WR-04: `CorrelationIdPropagationConfig` uses same `spanId` as `traceId` low bits — breaks distributed trace topology

**File:** `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/CorrelationIdPropagationConfig.java:71`
**File:** `rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/config/CorrelationIdPropagationConfig.java:71`
**Issue:** The extractor sets `spanId(lo)` where `lo` is the low 64 bits of the traceId. This means spanId === traceId-low for every inbound root span. While this is noted as "best-effort root spanId" in the comment, it violates the W3C traceparent spec which requires the spanId (parent-id) to be unique within the trace. When a future phase enables Zipkin/Jaeger export (Phase 7 OBS-01), traces that carry a self-referencing parent span will be rejected or mis-rendered by the trace UI as a single-node cycle. Phase 7 may not surface this as obviously broken if the test traces work individually.

**Fix:** Generate a random spanId independent of the traceId:
```java
import brave.internal.Platform;
// ...
long spanId = Platform.get().nextTraceIdHigh(); // or use SecureRandom.nextLong()
TraceContext ctx = TraceContext.newBuilder()
    .traceIdHigh(hi).traceId(lo)
    .spanId(spanId)
    .sampled(true)
    .build();
```

Or use `lo ^ System.nanoTime()` as a cheap differentiation until Phase 7 hardens this.

---

### WR-05: `smoke-correlation-id.sh` `tail -n +"$PRE_COUNT"` off-by-one — misses the first new log line

**File:** `scripts/smoke-correlation-id.sh:53`
**Issue:** `PRE_COUNT` is set to `wc -l < "$LOG_FILE"` (line 27), which counts the number of newline-terminated lines. `tail -n +N` starts at line N (1-indexed). So if the log has 10 lines before the request, `PRE_COUNT=10` and `tail -n +10` starts at line 10 (the last pre-existing line), not line 11. The log line immediately before the request is included in the grep window, which could cause a false PASS if a previous run happened to write the same `CORR_ID` to that final line. More importantly, if the test `CORR_ID` (`0000000000000000000000000001cafe`) appears anywhere in pre-existing log content (e.g., from a prior run of the smoke script), `MATCHES` will be nonzero before the request even arrives, producing a guaranteed false PASS.

**Fix:** Use `PRE_COUNT=$(($(wc -l < "$LOG_FILE") + 1))` to skip to the line *after* all existing content:
```bash
PRE_COUNT=$(( $(wc -l < "$LOG_FILE") + 1 ))
```
And note that re-running the script multiple times produces an ever-growing `backend.log` that will eventually always contain the fixed `CORR_ID` value, making the test permanently pass regardless of whether the propagation is working. Consider using a random CORR_ID per run.

---

### WR-06: `smoke-ssrm.sh` exit code from `curl` is lost — silent failure on network error

**File:** `scripts/smoke-ssrm.sh:21-28`
**Issue:** `curl -sf` is used with the response captured in `RESPONSE=$(curl -sf ...)`. The `$?` check on line 26 checks the exit code of the last command in the subshell, which is the assignment — not necessarily the exit code of `curl`. In bash, `VAR=$(command)` captures the exit code of `command` correctly when the assignment is a simple statement, so `$?` after line 21-24 is the `curl` exit code. This is actually correct in bash. However, `curl -sf` exits non-zero on HTTP errors (4xx/5xx) due to the `-f` flag, and the script treats that as "FAIL: curl request failed." This means a 400 Bad Request or 500 Internal Server Error from the backend will produce the same error message as a connection refused, making it impossible to distinguish whether the backend is unreachable or whether the request body is malformed.

**Fix:** Capture the HTTP status separately and report it:
```bash
RESPONSE=$(curl -s -w '\n%{http_code}' -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "X-Correlation-Id: $SMOKE_CORR_ID" \
  -d "$REQUEST_BODY" 2>&1)
HTTP_STATUS=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)
if [ "$HTTP_STATUS" != "200" ]; then
  echo "FAIL: HTTP $HTTP_STATUS from $ENDPOINT. Body: $BODY"
  exit 1
fi
```

---

### WR-07: `rectrace-ops.sh` `start_component` changes `$PWD` with bare `cd` — affects subsequent commands in the same process if subshell exits abnormally

**File:** `ops/rectrace-ops.sh:68-71`
**Issue:** `start_component` calls `cd "$dir"` then `cd - > /dev/null || true` to restore the working directory. If the `$cmd >> "$log_file" 2>&1 &` invocation between the two `cd` calls exits or errors in a way that short-circuits (which it cannot in the current code, but maintenance may add error handling), the working directory of the parent shell process is left as `$dir`. Additionally, `cd -` returns `OLDPWD`, which may not be what was expected if the script was already inside a changed-directory context from a prior `start_component` call in the `all` case. The safer pattern uses a subshell.

**Fix:**
```bash
if [ -n "$dir" ]; then
  (cd "$dir" && $cmd >> "$log_file" 2>&1) &
  local pid=$!
else
  $cmd >> "$log_file" 2>&1 &
  local pid=$!
fi
```

Note: Wrapping in a subshell means the `&` backgrounds the subshell, and `$!` captures the subshell PID. The actual process PID seen by `kill` will be the child process. This is a trade-off; a proper solution uses `setsid` or a wrapper.

---

### WR-08: `vitest.config.ts` does not include `tsconfig.app.json`'s path alias — `@/*` may not resolve in test files that are outside `src/`

**File:** `frontend-react/vitest.config.ts:13-15`
**Issue:** `vitest.config.ts` sets `resolve.alias` for `@` to `./src`. Tests under `src/` resolve correctly. However, `tsconfig.eslint.json` (line 7) includes `["src", "tests", "vite.config.ts", "vitest.config.ts"]`, meaning the `tests/` directory is part of the TypeScript project. If a future test file in `tests/` (not `src/`) imports using `@/`, Vitest's alias resolves it, but `tsc -b` through `tsconfig.eslint.json` (which extends `tsconfig.app.json` with `"include": ["src"]` being overridden by `tsconfig.eslint.json`'s own include) may not resolve the path. This is a latent issue since no tests currently live in `tests/` that use `@/` imports, but `tests/fixtures/raw-hex.tsx` already exists and imports nothing, so the risk is imminent.

**Fix:** The `vitest.config.ts` alias is correctly configured. The gap is that `tsconfig.app.json` only includes `src`, but `tsconfig.eslint.json` extends it and adds `tests`. Ensure the base `tsconfig.json` paths include `tests/` or that `tsconfig.eslint.json` independently declares the paths entry.

---

## Info

### IN-01: `main.tsx` uses non-null assertion `document.getElementById('root')!` without fallback

**File:** `frontend-react/src/main.tsx:15`
**Issue:** `document.getElementById('root')!` will throw a TypeScript-suppressed `null` dereference if the `index.html` is ever served without the `<div id="root">` element. The bang operator silences TypeScript but not the runtime crash. This is idiomatic for Vite scaffolds but worth noting for an enterprise codebase where `index.html` may be modified by backend templating.

**Fix:** Add a guard:
```tsx
const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element #root not found in DOM')
createRoot(rootElement).render(...)
```

---

### IN-02: `RootErrorComponent` renders `error?.message` directly in JSX — potential XSS if error message contains HTML

**File:** `frontend-react/src/routes/__root.tsx:17`
**Issue:** `{error?.message || 'An unexpected error occurred.'}` renders error message text as a React text node, which React escapes automatically. This is NOT an XSS risk for standard React text rendering. However, if the error message is ever passed to `dangerouslySetInnerHTML` in a future refactor, the pattern established here would become a vector. The current implementation is safe.

This is informational only — React's text interpolation is safe, and no `dangerouslySetInnerHTML` is present.

---

### IN-03: `overlayNoRowsTemplate` in `SmokeGrid.tsx` uses raw HTML string — bypasses React's XSS protection

**File:** `frontend-react/src/grid/SmokeGrid.tsx:47`
**Issue:** `overlayNoRowsTemplate="<span>No seed data found</span>"` is passed to AG-Grid which injects it as `innerHTML`. The content is a static string with no user data, so there is no immediate XSS risk. However, the pattern establishes that raw HTML is acceptable for overlay templates. When this component is extended with dynamic content (e.g., showing a search term in the overlay), the same pattern will be unsafe.

**Fix:** Use AG-Grid's `noRowsOverlayComponent` prop with a React component instead of `overlayNoRowsTemplate`:
```tsx
const NoRowsOverlay = () => <span>No seed data found</span>
// in AgGridReact props:
noRowsOverlayComponent={NoRowsOverlay}
```

---

### IN-04: `pom.xml` (backend) Spring Boot version `3.5.14` is an unusual version string

**File:** `backend/rectrace/pom.xml:8`
**File:** `rectrace-tlm-stats/pom.xml:8`
**Issue:** Both POMs declare `spring-boot-starter-parent` version `3.5.14`. Spring Boot 3.5.x is a future minor series (as of mid-2026, 3.5.0 is recent). `3.5.14` is a patch version that may not exist yet or may have been auto-incremented incorrectly. The CLAUDE.md constraint specifies "Spring Boot 3.2.x (LTS-style)". If this version does not exist in Maven Central, the build will fail with a resolution error; if it does exist, it may include unreleased dependencies. Verify this version resolves against Maven Central.

**Fix:** Verify with:
```bash
mvn dependency:resolve -f backend/rectrace/pom.xml
```
If `3.5.14` does not resolve, downgrade to the latest stable Spring Boot 3.3.x or 3.2.x per the CLAUDE.md constraint.

---

### IN-05: `sonner.tsx` is in `src/components/ui/` (excluded from ESLint) but uses `next-themes` — ESLint hex rule gap is correct but the exclusion hides this import error

**File:** `frontend-react/eslint.config.js:9`
**Issue:** `globalIgnores(['dist', 'src/components/ui/**', 'src/routeTree.gen.ts'])` correctly excludes vendored shadcn components from the hex-rejection rule. However, it also excludes them from ALL ESLint rules including import validation. The broken `next-themes` import in `sonner.tsx` (CR-01) would have been caught if ESLint's `import/no-unresolved` rule were enabled. Consider excluding `src/components/ui/**` only from the hex-restriction rule rather than from all rules:

```js
// Instead of globalIgnores, use per-rule overrides:
{
  files: ['src/components/ui/**'],
  rules: {
    'no-restricted-syntax': 'off', // allow raw hex in vendored shadcn
  },
}
```

This preserves import and hook rules for vendored components.

---

_Reviewed: 2026-05-13T10:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
