---
phase: 02-react-foundation
plan: 02
subsystem: backend-observability
tags: [tracing, micrometer, brave, correlation-id, logback, mdc]
dependency_graph:
  requires: [02-01]
  provides: [X-Correlation-Id as traceId in MDC, logback traceId pattern, local sampling=1.0]
  affects: [backend/rectrace, rectrace-tlm-stats]
tech_stack:
  added:
    - io.micrometer:micrometer-tracing-bridge-brave (BOM-managed, Boot 3.5.14 BOM provides 1.5.11)
  patterns:
    - Custom Brave Propagation.Factory (Option B: X-Correlation-Id IS the traceId, no separate baggage)
    - 32-hex regex validation at trust boundary (T-2-02 mitigation)
    - logback-spring.xml with %X{traceId:-} MDC pattern (NOT logback.xml — Spring loads logback-spring.xml after context)
key_files:
  created:
    - backend/rectrace/pom.xml (modified: +micrometer-tracing-bridge-brave)
    - rectrace-tlm-stats/pom.xml (modified: +micrometer-tracing-bridge-brave)
    - backend/rectrace/src/main/java/com/citi/gru/rectrace/config/CorrelationIdPropagationConfig.java
    - rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/config/CorrelationIdPropagationConfig.java
    - backend/rectrace/src/main/resources/logback-spring.xml
    - rectrace-tlm-stats/src/main/resources/logback-spring.xml
  modified:
    - backend/rectrace/src/main/resources/application-local.properties (appended sampling=1.0)
    - rectrace-tlm-stats/src/main/resources/application-local.properties (appended sampling=1.0)
decisions:
  - "Option B (custom Propagation.Factory) used over Option A (baggage config): X-Correlation-Id header IS adopted as traceId, not carried as a separate baggage field — single ID end-to-end per D-2.10"
  - "No Zipkin/Jaeger/OTel exporter added — MDC population only in Phase 2; Phase 7 OBS-01 owns the full pipeline (D-2.9)"
  - "logback-spring.xml used (NOT logback.xml): Spring Boot loads logback-spring.xml after context ready, enabling Spring Environment property substitution"
  - "sampling.probability=1.0 in application-local.properties only — production defaults to 0.1 (Boot default); local dev needs full visibility"
metrics:
  duration: "~12 minutes"
  completed: "2026-05-13T02:26:06Z"
  tasks_completed: 2
  files_changed: 8
requirements_closed: [REACT-07]
---

# Phase 2 Plan 02: Correlation ID Tracing (Brave Bridge) Summary

Wired Micrometer Tracing (Brave bridge) into both Maven modules. X-Correlation-Id HTTP header is adopted as the backend's 128-bit traceId via a custom Brave Propagation.Factory and written to every log line via `%X{traceId}` in MDC.

## Files Modified

| File | Change Type | Description |
|------|-------------|-------------|
| `backend/rectrace/pom.xml` | modify | Added `io.micrometer:micrometer-tracing-bridge-brave` (BOM-managed, no explicit version) |
| `rectrace-tlm-stats/pom.xml` | modify | Same dependency added |
| `backend/rectrace/.../config/CorrelationIdPropagationConfig.java` | new | Custom Propagation.Factory bean with @Profile(!test), HEX32 regex validation, X-Correlation-Id → traceId mapping |
| `rectrace-tlm-stats/.../tlmstats/config/CorrelationIdPropagationConfig.java` | new | Identical module mirror (package: com.citi.gru.rectrace.tlmstats.config) |
| `backend/rectrace/src/main/resources/logback-spring.xml` | new | Console appender with `%X{traceId:-}` MDC pattern; no `%X{x-correlation-id:-}` key |
| `rectrace-tlm-stats/src/main/resources/logback-spring.xml` | new | Identical for TLM stats module |
| `backend/rectrace/src/main/resources/application-local.properties` | append | Added `management.tracing.sampling.probability=1.0` (2 lines: comment + property) |
| `rectrace-tlm-stats/src/main/resources/application-local.properties` | append | Same 2 lines appended |

## Tracing Propagation: Option B vs Option A

**Option B (custom Propagation.Factory) was implemented per D-2.10.** This is the correct choice because:

| Aspect | Option A (baggage config) | Option B (custom factory) — CHOSEN |
|--------|--------------------------|-------------------------------------|
| IDs per request | Two: X-Correlation-Id baggage + Brave's own traceId | One: X-Correlation-Id IS the traceId |
| Config | `management.tracing.baggage.remote-fields` + `correlation.fields` in properties | Zero properties; all propagation in Java |
| MDC key | `x-correlation-id` (separate baggage field) | `traceId` (Brave's native MDC key) |
| Confusion risk | User sees two IDs for same request in logs | No confusion — single ID end-to-end |
| Phase 7 migration | More complex (decouple baggage from traceId) | Simpler (Brave already owns the MDC key) |

The custom factory's `extractor()` reads `X-Correlation-Id`, validates against `^[a-fA-F0-9]{32}$`, then builds a 128-bit `TraceContext` with `traceIdHigh + traceId` from the 32-hex UUID (dashes stripped). Invalid or absent headers fall back to B3 upstream extraction — Brave generates a fresh traceId.

## T-2-02 Mitigation Confirmation

The injection boundary for threat T-2-02 (header injection → MDC → log output) is the `HEX32` regex pattern inside `CorrelationIdPropagationConfig.extractor()`:

```java
private static final Pattern HEX32 = Pattern.compile("^[a-fA-F0-9]{32}$");
```

- Only `[a-fA-F0-9]` characters — no newlines, no `%n`, no format-string sequences
- Exactly 32 characters — no truncation or padding ambiguity
- `^...$` anchors — no prefix/suffix bypass
- Malformed values fall back to B3; Brave generates a fresh traceId (no tainted data reaches MDC)
- No `OncePerRequestFilter` needed — the Propagation.Factory IS the validation boundary

## Logback Pattern Confirmation

Both `logback-spring.xml` files use `%X{traceId:-}` ONLY:

```xml
<pattern>%d{yyyy-MM-dd HH:mm:ss.SSS} [%thread] %-5level [traceId=%X{traceId:-}] %logger{36} - %msg%n</pattern>
```

- No `%X{x-correlation-id:-}` — that MDC key belongs to Option A/baggage which is NOT used
- The `:-` fallback renders empty string when no traceId is in MDC (non-traced requests)
- File name is `logback-spring.xml` (NOT `logback.xml`) — Spring Boot loads this after the context is ready, enabling Spring Environment property substitution needed by Phase 7's JSON layout

## application-local.properties Confirmation

Both files have ONLY the sampling probability appended:

```properties
# Micrometer Tracing — Brave bridge (Phase 2 D-2.9, D-2.10, D-2.12)
management.tracing.sampling.probability=1.0
```

**Zero baggage properties.** Neither file contains `management.tracing.baggage.remote-fields` or `management.tracing.baggage.correlation.fields` — those are Option A constructs that would interfere with Option B's custom factory.

## Deferred Items Confirmed

Per D-2.9 and D-2.12, the following are intentionally NOT in this plan:

- No Zipkin/Jaeger/OTel exporter — Phase 7 OBS-01 owns the export pipeline
- No slow-query AOP — Phase 7 owns query-level instrumentation
- No HealthIndicator — Phase 7 owns health endpoint enhancements
- No structured JSON logging — Phase 7 will replace `logback-spring.xml` with `logstash-logback-encoder` JSON layout

## Build Notes

- Backend `rectrace-tlm-stats` module: `mvn clean compile` exits 0 (clean)
- Backend `backend/rectrace` module: pre-existing compile failures in `SearchControllerV4.java`, `ElasticsearchServiceV4.java`, `OracleServiceV4.java`, `SearchServiceV4.java` (411 errors from prior state — all unrelated to this plan's changes). `CorrelationIdPropagationConfig.java` compiled successfully (no errors; one deprecation warning from Brave API usage — expected).
- The pre-existing compile failures are out of scope (scoped boundary: only files changed by this plan are verified).

## Commits

| Task | Commit | Files |
|------|--------|-------|
| Task 1: Brave bridge + CorrelationIdPropagationConfig | 0ee84dc | 4 files (2 pom.xml + 2 Java config files) |
| Task 2: logback-spring.xml + sampling properties | 983ec66 | 4 files (2 logback-spring.xml + 2 application-local.properties) |

## Known Stubs

None. This plan is infrastructure-only (dependency + config + propagation logic). No UI rendering, no data stubs.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes introduced beyond what the plan's threat model covers. T-2-02 mitigation is confirmed implemented (see above).

## Self-Check: PASSED

Files exist:
- backend/rectrace/pom.xml — contains `micrometer-tracing-bridge-brave`
- rectrace-tlm-stats/pom.xml — contains `micrometer-tracing-bridge-brave`
- backend/rectrace/src/main/java/com/citi/gru/rectrace/config/CorrelationIdPropagationConfig.java
- rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/config/CorrelationIdPropagationConfig.java
- backend/rectrace/src/main/resources/logback-spring.xml
- rectrace-tlm-stats/src/main/resources/logback-spring.xml
- backend/rectrace/src/main/resources/application-local.properties — contains `management.tracing.sampling.probability=1.0`
- rectrace-tlm-stats/src/main/resources/application-local.properties — contains `management.tracing.sampling.probability=1.0`

Commits exist: 0ee84dc (Task 1), 983ec66 (Task 2)
