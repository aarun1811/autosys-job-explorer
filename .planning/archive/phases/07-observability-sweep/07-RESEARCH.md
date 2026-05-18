# Phase 7: Observability Sweep — Research

**Researched:** 2026-05-17
**Domain:** Spring Boot 3.5 / Java 21 observability — structured logging, actuator health, slow-query AOP, Prometheus metrics, MDC propagation through `@Async` / `@Scheduled` / subprocess boundaries
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-7.0 — Log aggregator target**: Splunk HEC compatible JSON over `LogstashTcpSocketAppender`. Production endpoint placeholder `[NEEDS USER REVIEW]`. Local-dev = `ConsoleAppender` no-op fallback. `logback-spring.xml` is the only file that switches behaviour between profiles.
- **D-7.1 — Encoder + dep**: `net.logstash.logback:logstash-logback-encoder:8.0` (Java 11+, Logback 1.5.x compatible, Jackson 2.x). Configuration lives in `logback-spring.xml` (NOT `logback.xml`). Both `backend/rectrace` AND `rectrace-tlm-stats` get it. JSON MDC keys: `traceId`, `userId`, `path`, `method`, `status`, `durationMs` (OBS-01).
- **D-7.2 — Four `HealthIndicator` beans** (OBS-02): `OracleHealthIndicator` (`SELECT 1 FROM DUAL` against primary DS), `ElasticsearchHealthIndicator` (`esClient.ping()`), `LoaderRunAgeHealthIndicator` (DOWN if any configured job's most-recent SUCCESS > 2× cron interval old), `SearchConfigHealthIndicator` (UP/DOWN mirror of `SearchConfigServiceV4`/`SqlSearchConfigServiceV4` post-boot validation state).
- **D-7.3 — Actuator exposure** (OBS-03): `management.endpoints.web.exposure.include=health,info,prometheus,loggers,metrics`. NO wildcards, NO `env`, NO `heapdump`, NO `shutdown`. `management.endpoint.health.show-details=when-authorized`.
- **D-7.4 — Slow-query AOP** (OBS-04): `@Aspect` bean `SlowQueryLoggerAspect` matching `JdbcOperations.query*` / `JdbcOperations.update*` and methods annotated `@SlowLog`. Threshold default **500ms**, configurable via `observability.slow-query-threshold-ms`. WARN level. Bind args truncated to 200 chars/arg.
- **D-7.5 — Prometheus metrics** (OBS-05): `io.micrometer:micrometer-registry-prometheus` (BOM-managed). `@Timed` selective on controllers + hot service methods. JVM + Hikari + Tomcat metrics auto-registered.
- **D-7.6 — Correlation ID propagation** (OBS-06): `TaskDecorator` for `@Async` MDC propagation (wired into `AsyncConfig.taskExecutor()`); scheduler entry-point aspect that injects fresh `traceId` per fire on `@Scheduled` methods; `ScriptExecutor` passes `RECTRACE_CORRELATION_ID` env var to subprocess.
- **D-7.7 — Log forwarder** (OBS-07): Splunk HEC via `LogstashTcpSocketAppender` in prod profile; `ConsoleAppender` in local/test. Hostname / token in `application-prod.properties` as placeholders.
- **D-7.8 — Micrometer pinning + CI guard** (OBS-08): Micrometer 1.14+ pinned by Spring Boot 3.5.14 BOM. `maven-enforcer-plugin` rule (`dependencyConvergence` + `bannedDependencies` on Micrometer above the BOM-managed version) fails the build if any sub-dep tries to override.

### Claude's Discretion

- **D-7.9** [judgment]: 500ms slow-query threshold default (configurable).
- **D-7.10** [judgment]: 32-char hex traceId (no dashes) — already enforced by `CorrelationIdPropagationConfig` from Phase 2.
- **D-7.11** [judgment]: `userId` MDC key sourced from `x-citiportal-loginid` request header.
- **D-7.12** [judgment]: Loader-run-age threshold: 2× cron interval (configurable per job).
- **D-7.13** [judgment]: Slow-query log line is WARN (not ERROR).
- **D-7.14** [judgment]: `application-prod.properties` Splunk HEC fields are placeholders (`splunk.hec.host=splunk.citi.intra.example`, `splunk.hec.token=<TO_BE_FILLED>`).

### Deferred Ideas (OUT OF SCOPE)

- Per-tenant log shards.
- Distributed tracing collector wiring (Zipkin / Jaeger / OTel). Brave spans are *created* (already, from Phase 2) but no exporter is attached.
- Alerting rules / PromQL.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OBS-01 | JSON logs via `logstash-logback-encoder` in `logback-spring.xml` for both modules with `traceId/userId/path/method/status/durationMs` | §3.1 logstash-logback-encoder config; §3.2 access-log filter populates path/method/status/durationMs; existing `traceId` MDC populated by Phase 2 Micrometer Tracing |
| OBS-02 | Four custom `HealthIndicator` beans at `/actuator/health` | §3.3 — `AbstractHealthIndicator` pattern, per-indicator code sketches |
| OBS-03 | Locked-down actuator exposure list, `show-details=when-authorized` | §3.4 — Boot 3.5 exposure properties, Spring Security interaction |
| OBS-04 | Slow-query AOP for `JdbcTemplate` and ES calls, threshold-driven WARN | §3.5 — `@Aspect` on `JdbcOperations.*` + `@SlowLog` annotation for ES service-layer calls; double-fire pitfall noted |
| OBS-05 | Prometheus metrics at `/actuator/prometheus` | §3.6 — `micrometer-registry-prometheus` dep + `@Timed` annotation strategy |
| OBS-06 | Correlation-ID propagation through `@Async`, scheduler fires, subprocess invocations | §3.7 — `ContextPropagatingTaskDecorator` (Boot 3.2+ built-in) wired into `AsyncConfig`; aspect on `@Scheduled`; `ScriptExecutor` env var injection |
| OBS-07 | Log aggregator forwarder wired | §3.1 — `LogstashTcpSocketAppender` for Splunk HEC; profile-gated |
| OBS-08 | Micrometer pinned by BOM + CI guard against override | §3.8 — `maven-enforcer-plugin` with `dependencyConvergence` + `bannedDependencies` on Micrometer >1.14 ceiling |
</phase_requirements>

## Summary

The phase is **horizontal instrumentation** layered over an already-modernized Spring Boot 3.5.14 / Java 21 stack. Spring Boot 3.5 provides most of the primitives already: Micrometer Tracing (Brave bridge) is wired from Phase 2 and populates `traceId`/`spanId` in MDC; `spring-boot-starter-actuator` is on the classpath in both modules; `micrometer-tracing-bridge-brave` is declared. Phase 7's job is to (a) **swap the console pattern encoder for `LogstashEncoder`** profile-aware in `logback-spring.xml`, (b) **add four bean-based `HealthIndicator`s**, (c) **lock the actuator exposure list**, (d) **add an `@Aspect` for slow-query timing**, (e) **add the Prometheus registry**, and (f) **close three thread-boundary holes** where MDC currently doesn't propagate (`@Async`, `@Scheduled`, subprocess).

Two important findings during research:

1. **Spring Boot 3.5 ships `ContextPropagatingTaskDecorator`** ([`org.springframework.core.task.support.ContextPropagatingTaskDecorator`](https://docs.spring.io/spring-boot/3.5/reference/actuator/observability.html)) — a built-in `TaskDecorator` that propagates Micrometer's `ContextSnapshot` (which carries the traceContext and MDC) from the calling thread to the async thread. We do not need to hand-roll a `MDC.getCopyOfContextMap()`-based decorator. Wiring it as a bean (or via `executor.setTaskDecorator(...)` in `AsyncConfig`) is the standard approach. `[CITED: docs.spring.io/spring-boot/3.5/reference/actuator/observability.html]`

2. **The Maven Enforcer rule for the Micrometer pin is `dependencyConvergence` plus `bannedDependencies`** — NOT `requireUpperBoundDeps`. `requireUpperBoundDeps` forces *upgrades* to the highest declared version (the opposite of what we want); `bannedDependencies` with a range like `(1.99.999]` or `[2.0.0,)` is the idiom that fails the build if a transitive dep tries to pull Micrometer above the BOM. `dependencyConvergence` independently asserts all transitive paths agree on a single version. `[CITED: maven.apache.org/enforcer/enforcer-rules/bannedDependencies.html]`

**Primary recommendation:** Layer changes module-by-module — `backend/rectrace` first (richer surface: loader, search-config, JDBC, ES), then mirror to `rectrace-tlm-stats` (no loader, no ES, no search-config — fewer indicators, simpler aspect surface). Build a single `logback-spring.xml` template you copy verbatim into both modules and parameterise via Spring properties (`spring.application.name`, `splunk.hec.host`). Tests come first per Nyquist D-8.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Structured log emission | Each Boot module's logging tier (Logback) | — | Logback owns the encoder; Spring Boot's `logback-spring.xml` resolver owns profile selection |
| Health indicators | Backend service tier | Actuator endpoint (HTTP) | Indicators are Spring beans; actuator endpoint aggregates and exposes |
| Actuator exposure config | Backend properties tier | Spring Security filter chain | Exposure is property-driven; SecurityConfig already routes `/actuator/**` |
| Slow-query AOP | Backend AOP cross-cut | JDBC / ES adapter beans | Aspect wraps the JDBC bean's calls (proxy-based for Spring beans only) |
| Prometheus metrics | Backend metrics tier (Micrometer) | Actuator endpoint (HTTP) | Registry collects; endpoint exposes |
| MDC propagation through `@Async` | Backend concurrency tier (`AsyncConfig`) | Logback MDC | TaskDecorator copies context at thread boundary |
| MDC propagation through `@Scheduled` | Backend AOP cross-cut OR scheduled-method body | Logback MDC | Fresh trace per fire — no caller traceId exists |
| Subprocess correlation | Backend `ScriptExecutor` | OS process env | Env var hand-off; shell script echoes back for log correlation |
| CI guard (dep pin) | Build tier (Maven Enforcer) | — | Pure build-time |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `net.logstash.logback:logstash-logback-encoder` | **8.0** (locked, D-7.1) | JSON encoder + `LogstashTcpSocketAppender` for Logback | De-facto standard for ELK/Splunk-HEC compatible JSON in Logback; Java 11+, Logback 1.5.x compatible. `[VERIFIED: Context7 /logfellow/logstash-logback-encoder; GitHub releases]` Newer 9.0 (Oct 2024) migrated to Jackson 3 and requires Java 17+ — DO NOT auto-upgrade; Spring Boot 3.5 BOM still uses Jackson 2.x. `[VERIFIED: WebFetch github.com/logfellow/logstash-logback-encoder/releases]` |
| `io.micrometer:micrometer-registry-prometheus` | BOM-managed (1.14+, transitively 1.16.5 in Boot 4.x; in Boot 3.5.x it tracks the 1.14 line) | Prometheus exposition format at `/actuator/prometheus` | Standard Micrometer registry; auto-discovered by Spring Boot when on classpath. `[CITED: docs.spring.io/spring-boot/3.5/reference/actuator/endpoints.html]` |
| `io.micrometer:micrometer-tracing-bridge-brave` | BOM-managed | Span context + MDC `traceId`/`spanId` population | Already declared in BOTH pom.xml files (verified). `[VERIFIED: grep of pom.xml]` |
| `org.springframework.boot:spring-boot-starter-aop` | BOM-managed | `@Aspect` + AspectJ weaver for slow-query advice and `@Scheduled` aspect | Needed because neither module currently declares it (verified). `[VERIFIED: grep of pom.xml]` |
| `org.springframework.boot:spring-boot-starter-actuator` | BOM-managed | `/actuator/*` endpoints, `HealthIndicator` API | Already declared in both modules. `[VERIFIED: grep of pom.xml]` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `org.aspectj:aspectjweaver` | BOM-managed (transitively via `spring-boot-starter-aop`) | AspectJ runtime weaver | Required for `@Observed`/`@Timed`/`@Counted` annotation scanning per `management.observations.annotations.enabled=true`. `[CITED: docs.spring.io/spring-boot/3.5/reference/actuator/observability.html]` |
| `org.apache.maven.plugins:maven-enforcer-plugin` | 3.6.2 | Build-time dependency convergence + ban Micrometer overrides | OBS-08 CI guard. `[CITED: maven.apache.org/enforcer/]` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `logstash-logback-encoder` 8.0 | Spring Boot 3.4+ built-in `logging.structured.format.console=logstash` | Built-in support emits the same Logstash-shape JSON to console/file but **does NOT support remote TCP socket appenders** to Splunk HEC. We need the encoder library for the production forwarder; using both would duplicate config. **Reject.** `[CITED: docs.spring.io/spring-boot/reference/features/logging.html]` |
| `logstash-logback-encoder` 8.0 | Version **9.0** | 9.0 requires Java 17 (we have 21 — OK) but **migrated to Jackson 3**. Boot 3.5 BOM uses Jackson 2.x — pulling Jackson 3 transitively would force a parallel-tree split. **Reject** until Boot bumps to Jackson 3. `[VERIFIED: GitHub releases]` |
| Custom `MDC`-copying `TaskDecorator` | Boot 3.5's `ContextPropagatingTaskDecorator` | The built-in handles Micrometer ContextSnapshot AND MDC. A hand-rolled `MDC.getCopyOfContextMap()` decorator only copies MDC; it loses the Brave `TraceContext`, which means new spans started on the async thread would have a different trace ID than the MDC `traceId`. **Use built-in.** `[CITED: docs.spring.io/spring-boot/3.5/reference/actuator/observability.html]` |
| `requireUpperBoundDeps` enforcer rule | `bannedDependencies` + `dependencyConvergence` | `requireUpperBoundDeps` mandates that resolved version equals the highest declared — which would *encourage* transitive overrides to win. We want the opposite: BOM-pinned version is the ceiling. **Use bannedDependencies** with a range that bans known-bad future overrides, plus `dependencyConvergence` for convergence assertion. `[CITED: maven.apache.org/enforcer/enforcer-rules/bannedDependencies.html]` |
| Proxy-based Spring AOP on `JdbcTemplate` | Full AspectJ weaving (`aspectj-maven-plugin`) | Full AspectJ catches `this.method()` internal calls but adds compile-time weaving complexity. Proxy-based AOP (default in Boot's `spring-boot-starter-aop`) is enough: `JdbcTemplate` is a Spring bean; **calls from service beans through the injected reference go through the proxy**. Internal-to-JdbcTemplate calls (rare in app code) are out of scope. **Stay proxy-based.** `[CITED: Baeldung "Spring Performance Logging"]` |

**Installation (backend/rectrace + rectrace-tlm-stats, both POMs):**

```xml
<!-- D-7.1 — JSON encoder + Logstash TCP appender. NOT BOM-managed; pin explicitly. -->
<dependency>
  <groupId>net.logstash.logback</groupId>
  <artifactId>logstash-logback-encoder</artifactId>
  <version>8.0</version>
</dependency>
<!-- D-7.5 — Prometheus exposition format. BOM-managed, version omitted. -->
<dependency>
  <groupId>io.micrometer</groupId>
  <artifactId>micrometer-registry-prometheus</artifactId>
</dependency>
<!-- D-7.4 — Spring AOP starter (NOT currently declared in either POM). BOM-managed. -->
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-aop</artifactId>
</dependency>
```

**Version verification (performed during research):**

- `logstash-logback-encoder` 8.0 (Jul 27, 2024) — requires Java 11+, Logback 1.5.x. `[VERIFIED: github.com/logfellow/logstash-logback-encoder/releases]`
- Spring Boot 3.5.14 BOM pins Micrometer in the 1.14 line; the Boot 4 BOM tracks 1.16.5 — both >1.14 floor required by OBS-08. **NOT BOM-managed**: `logstash-logback-encoder` (must be pinned explicitly). **BOM-managed**: `micrometer-core`, `micrometer-registry-prometheus`, `micrometer-tracing-bridge-brave`, `spring-boot-starter-aop`. `[VERIFIED: WebFetch docs.spring.io/spring-boot/appendix/dependency-versions/coordinates.html]`

## Architecture Patterns

### System Architecture Diagram

```
  HTTP request                  Subprocess (get_password.sh)
  ─────────────                 ──────────────────────────
       │                                │
       │ X-Correlation-Id header        │ RECTRACE_CORRELATION_ID env var
       ▼                                ▲
  ┌─────────────────────────────────────┴───────────────┐
  │  Brave Tracer (Phase 2 — already in place)          │
  │   • Reads X-Correlation-Id → seeds TraceContext     │
  │   • Populates MDC: traceId, spanId                  │
  └─────────┬───────────────────────────────────────────┘
            │
            ├──> userId MDC enricher filter (NEW, this phase)
            │       reads x-citiportal-loginid → MDC.put("userId", ...)
            │
            ├──> Access-log filter (NEW, this phase)
            │       OncePerRequestFilter that:
            │       1. Captures start nanos
            │       2. Wraps response to capture status
            │       3. After chain: MDC.put("path", "method", "status", "durationMs")
            │       4. logger.info("request completed") — emits one JSON line
            │       5. MDC.remove(...) (Pitfall P-3)
            │
            ▼
  ┌─────────────────────────────────────────────────────┐
  │  Service / Controller (business logic)              │
  │   • Slow-query @Aspect wraps JdbcOperations.*       │
  │   • Slow-call @Aspect wraps @SlowLog methods (ES)   │
  │   • @Timed annotations on hot service methods       │
  │   • @Async methods inherit MDC via TaskDecorator    │
  │   • @Scheduled methods get fresh traceId per fire   │
  └─────────┬───────────────────────────────────────────┘
            │
            ▼
  ┌─────────────────────────────────────────────────────┐
  │  Logback (logback-spring.xml)                       │
  │                                                     │
  │  <springProfile name="!prod">                       │
  │    ConsoleAppender + human-readable pattern         │
  │  </springProfile>                                   │
  │  <springProfile name="prod">                        │
  │    LogstashTcpSocketAppender → Splunk HEC           │
  │    AsyncAppender wrapping LogstashEncoder           │
  │  </springProfile>                                   │
  └─────────────────────────────────────────────────────┘

  /actuator/health    /actuator/prometheus    /actuator/metrics
       │                       │                     │
       ▼                       ▼                     ▼
  Aggregates 4              MeterRegistry        Drill-down per
  HealthIndicators:         (Prometheus)         meter (JVM,
   • Oracle                                       Hikari, Tomcat,
   • Elasticsearch                                @Timed methods)
   • LoaderRunAge
   • SearchConfig
```

### Recommended Project Structure

```
backend/rectrace/src/main/java/com/citi/gru/rectrace/
├── config/
│   ├── AsyncConfig.java                 # EDIT — set TaskDecorator
│   ├── ActuatorSecurityConfig.java      # NEW — actuator endpoint security
│   └── EnforcerConfig (none — Maven POM only)
├── observability/                       # NEW PACKAGE
│   ├── filter/
│   │   ├── AccessLogFilter.java         # NEW — path/method/status/durationMs
│   │   └── UserIdMdcFilter.java         # NEW — userId from header
│   ├── health/
│   │   ├── OracleHealthIndicator.java
│   │   ├── ElasticsearchHealthIndicator.java
│   │   ├── LoaderRunAgeHealthIndicator.java
│   │   └── SearchConfigHealthIndicator.java
│   └── aop/
│       ├── SlowQueryLoggerAspect.java   # NEW — JdbcOperations.* + @SlowLog
│       ├── ScheduledTraceIdAspect.java  # NEW — fresh traceId per fire
│       └── SlowLog.java                 # NEW — annotation
└── util/
    └── ScriptExecutor.java              # EDIT — env var injection

backend/rectrace/src/main/resources/
├── logback-spring.xml                   # REWRITE — profile-aware JSON
└── application.properties               # EDIT — actuator + observability props

rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/
├── config/
│   └── ActuatorSecurityConfig.java      # NEW — mirror of rectrace
└── observability/                       # NEW PACKAGE (subset of rectrace)
    ├── filter/
    │   ├── AccessLogFilter.java
    │   └── UserIdMdcFilter.java
    └── health/
        └── OracleHealthIndicator.java   # ONLY this; no ES, no loader, no search-config

rectrace-tlm-stats/src/main/resources/
└── logback-spring.xml                   # REWRITE — copy of rectrace version
```

### §3.1 Pattern — `logback-spring.xml` profile-aware JSON encoder

**What:** One file per module, identical structure, parameterised by Spring properties. Local/dev profile uses `ConsoleAppender` with human-readable pattern; `prod` profile uses `LogstashTcpSocketAppender` to Splunk HEC.

**Why `logback-spring.xml` not `logback.xml`:** Plain `logback.xml` is loaded by Logback BEFORE Spring profile activation — `<springProfile>` tags inside `logback.xml` are silently ignored. The `-spring.xml` suffix triggers Spring Boot's `LogbackLoggingSystemProperties` initializer, which activates `<springProfile>` blocks. `[CITED: docs.spring.io/spring-boot/reference/features/logging.html]`

**Template (verified against Context7 `/logfellow/logstash-logback-encoder` snippets):**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <include resource="org/springframework/boot/logging/logback/defaults.xml"/>

  <!-- Local / dev / test / uat — human-readable console -->
  <springProfile name="!prod">
    <appender name="CONSOLE" class="ch.qos.logback.core.ConsoleAppender">
      <encoder>
        <pattern>%d{yyyy-MM-dd HH:mm:ss.SSS} [%thread] %-5level
          [traceId=%X{traceId:-} userId=%X{userId:-}] %logger{36} - %msg%n</pattern>
      </encoder>
    </appender>
    <root level="INFO">
      <appender-ref ref="CONSOLE"/>
    </root>
  </springProfile>

  <!-- Production — Splunk HEC compatible JSON over TCP -->
  <springProfile name="prod">
    <springProperty scope="context" name="appName" source="spring.application.name"/>
    <springProperty scope="context" name="splunkHost" source="splunk.hec.host"
                    defaultValue="splunk.citi.intra.example"/>
    <springProperty scope="context" name="splunkPort" source="splunk.hec.port"
                    defaultValue="9997"/>

    <appender name="STDOUT_JSON" class="ch.qos.logback.core.ConsoleAppender">
      <!-- Local fallback when LogstashTcpSocketAppender can't reach Splunk:
           Logback's STDOUT is captured by the VM's systemd/journald, so
           operators always have a recovery surface. -->
      <encoder class="net.logstash.logback.encoder.LogstashEncoder">
        <includeMdc>true</includeMdc>
        <includeContext>false</includeContext>
        <customFields>{"application":"${appName}","environment":"prod"}</customFields>
        <timestampPattern>yyyy-MM-dd'T'HH:mm:ss.SSS'Z'</timestampPattern>
        <timeZone>UTC</timeZone>
      </encoder>
    </appender>

    <appender name="SPLUNK_HEC"
              class="net.logstash.logback.appender.LogstashTcpSocketAppender">
      <destination>${splunkHost}:${splunkPort}</destination>
      <reconnectionDelay>30 seconds</reconnectionDelay>
      <writeTimeout>10 seconds</writeTimeout>
      <keepAliveDuration>5 minutes</keepAliveDuration>
      <ringBufferSize>8192</ringBufferSize>
      <encoder class="net.logstash.logback.encoder.LogstashEncoder">
        <includeMdc>true</includeMdc>
        <customFields>{"application":"${appName}","environment":"prod"}</customFields>
      </encoder>
    </appender>

    <!-- Async wrapper — prevents Splunk slowness from blocking app threads.
         appender's neverBlock=true means a slow Splunk drops messages rather
         than back-pressuring; trade visibility for availability. -->
    <appender name="SPLUNK_ASYNC" class="ch.qos.logback.classic.AsyncAppender">
      <appender-ref ref="SPLUNK_HEC"/>
      <queueSize>2048</queueSize>
      <discardingThreshold>0</discardingThreshold>
      <neverBlock>true</neverBlock>
    </appender>

    <root level="INFO">
      <appender-ref ref="STDOUT_JSON"/>
      <appender-ref ref="SPLUNK_ASYNC"/>
    </root>
  </springProfile>
</configuration>
```

Source: synthesised from `[CITED: Context7 /logfellow/logstash-logback-encoder llms.txt — LogstashTcpSocketAppender + LogstashEncoder snippets]` and `[CITED: docs.spring.io/spring-boot/reference/features/logging.html — springProfile and springProperty]`

### §3.2 Pattern — Access-log filter (`OncePerRequestFilter`)

**What:** A `@Component` filter that runs LAST in the chain, captures request start nanos and response status, then emits ONE structured log line per request with `path/method/status/durationMs` in MDC.

**Why a filter (not a `HandlerInterceptor`):** Filters wrap the full Servlet chain — they see static-resource requests, 404s, exception-converted responses. Interceptors don't fire on unhandled paths. We want every HTTP request logged.

**Skeleton:**

```java
// Source: standard Spring Boot OncePerRequestFilter idiom; verified MDC pitfall via
// Logback docs (MDC.remove must happen in finally — leaks otherwise across thread reuse).
@Component
@Order(Ordered.LOWEST_PRECEDENCE)  // run after Brave / userId filters
public class AccessLogFilter extends OncePerRequestFilter {
    private static final Logger access = LoggerFactory.getLogger("access");
    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res,
                                    FilterChain chain) throws ServletException, IOException {
        long startNs = System.nanoTime();
        try {
            chain.doFilter(req, res);
        } finally {
            long durationMs = (System.nanoTime() - startNs) / 1_000_000L;
            MDC.put("path", req.getRequestURI());
            MDC.put("method", req.getMethod());
            MDC.put("status", Integer.toString(res.getStatus()));
            MDC.put("durationMs", Long.toString(durationMs));
            try {
                access.info("request");
            } finally {
                MDC.remove("path"); MDC.remove("method");
                MDC.remove("status"); MDC.remove("durationMs");
            }
        }
    }
}
```

### §3.3 Pattern — Custom `HealthIndicator` beans

**Base pattern (Spring Boot 3.5 — `AbstractHealthIndicator`):** `[CITED: docs.spring.io/spring-boot/3.5/reference/actuator/endpoints.html]`

```java
@Component
public class OracleHealthIndicator extends AbstractHealthIndicator {
    private final JdbcTemplate primaryJdbc;
    public OracleHealthIndicator(@Qualifier("primaryJdbcTemplate") JdbcTemplate t) {
        this.primaryJdbc = t;
        // Pitfall P-5 — bound the SELECT 1 with a 2s query timeout so a hung
        // Oracle doesn't hang /actuator/health requests.
        this.primaryJdbc.setQueryTimeout(2);  // SEE WARNING BELOW
    }
    @Override
    protected void doHealthCheck(Health.Builder builder) {
        Integer one = primaryJdbc.queryForObject("SELECT 1 FROM DUAL", Integer.class);
        if (one != null && one == 1) builder.up().withDetail("query", "SELECT 1 FROM DUAL");
        else builder.down().withDetail("reason", "unexpected result");
    }
}
```

**WARNING (Pitfall P-7):** Do NOT call `setQueryTimeout` on the shared singleton `JdbcTemplate` — Phase 5 D-5.x explicitly forbids it. Use a **dedicated `JdbcTemplate` bean for the health indicator**, or use the `Statement.setQueryTimeout` per call via `JdbcTemplate.execute(StatementCallback)`. The skeleton above is illustrative; the plan must use a dedicated bean.

| Indicator | Module(s) | Probe | DOWN condition | Key details |
|-----------|-----------|-------|----------------|-------------|
| `OracleHealthIndicator` | both | `SELECT 1 FROM DUAL` (each module's primary DS) | SQLException or non-1 result | `withDetail("query", ...)` + 2s timeout via dedicated template |
| `ElasticsearchHealthIndicator` | `backend/rectrace` ONLY | `esClient.ping()` returning `BooleanResponse` | `value()==false` or `IOException` | Wrap with 2s `RequestOptions` timeout; `withDetail("cluster", uri)` |
| `LoaderRunAgeHealthIndicator` | `backend/rectrace` ONLY | per-job `SELECT MAX(finished_at) FROM loader_run_history WHERE job_key=? AND status='SUCCESS'` | any job's max age > `2 × cronInterval` | One detail entry per job: `{lastSuccess: instant, ageMs: long, status: UP|DOWN}`. `cronInterval` derived from `LoaderJobRegistry.cronExpressions.get(key).next(now).minus(now)` |
| `SearchConfigHealthIndicator` | `backend/rectrace` ONLY | `SearchConfigServiceV4.getCategories().isEmpty()` + `SqlSearchConfigServiceV4.getCategories().isEmpty()` | either is empty (boot would normally fail, but this is the runtime reporter) | `withDetail("v4Loaded", true/false).withDetail("sqlLoaded", true/false)` |

`rectrace-tlm-stats` only needs `OracleHealthIndicator` (against its own reconmgmt/recportal/dynamic-TLM datasources). The dynamic per-TLM-instance DS is a special case — the planner should decide whether to ping ALL TLM instances or only the static reconmgmt one (recommendation: only the static one; per-TLM checks belong in dedicated endpoints).

### §3.4 Pattern — Actuator lockdown

**`application.properties` for BOTH modules:**

```properties
# OBS-03 — explicit allow-list, no wildcards
management.endpoints.web.exposure.include=health,info,prometheus,loggers,metrics
management.endpoint.health.show-details=when-authorized
management.endpoint.health.show-components=when-authorized
management.endpoints.web.exposure.exclude=env,heapdump,shutdown,beans,configprops,threaddump

# OBS-08 — Micrometer observability annotations (@Observed/@Timed)
management.observations.annotations.enabled=true
```

**Default in Boot 3.x:** Only `/actuator/health` is exposed by default. Once we add Spring Security to the classpath (already present in both modules), all actuator endpoints other than `/actuator/health` are secured by `SecurityFilterChain`. `show-details=when-authorized` means full health details show only to authenticated principals — anonymous callers see only `{"status":"UP"}`. `[CITED: docs.spring.io/spring-boot/3.5/reference/actuator/endpoints.html, innoq.com Spring Boot Actuator Endpoints]`

**`ActuatorSecurityConfig.java` (NEW):** Add a `SecurityFilterChain` bean that explicitly permits `/actuator/health` (anonymous summary), `/actuator/info`, and `/actuator/prometheus` (Prometheus scraper IP allow-list — IP-bound, not auth), while requiring authentication for `/actuator/loggers` and `/actuator/metrics`. Wave with Phase 9's SEC scope — Phase 7 ships the **exposure** lockdown; the auth lockdown stays Phase 9's domain. The planner should add a stub `ActuatorSecurityConfig` that PERMITS anonymous access (matching today's behaviour) but is structured so Phase 9 can drop in auth requirements with minimal changes.

### §3.5 Pattern — Slow-query `@Aspect`

**Two pointcuts:** (1) all `JdbcOperations.query*` / `update*` / `batchUpdate*` / `execute*` calls (catches both JdbcTemplate and NamedParameterJdbcTemplate); (2) any method annotated `@SlowLog` (planner adds this to ES service-layer methods).

```java
@Aspect
@Component
@Slf4j
@RequiredArgsConstructor
public class SlowQueryLoggerAspect {
    @Value("${observability.slow-query-threshold-ms:500}")
    private long thresholdMs;

    // (1) JdbcOperations — broad pointcut. Matches the proxied JdbcTemplate bean.
    // Pitfall P-6 — NamedParameterJdbcTemplate delegates to its inner JdbcTemplate.
    // Because both are Spring beans with proxies, the SAME query can fire the advice
    // twice: once on the NPJT call, once on the inner JT call. Mitigate by matching
    // ONLY JdbcTemplate (concrete) and NOT NamedParameterJdbcOperations:
    @Around("execution(* org.springframework.jdbc.core.JdbcTemplate.query*(..)) || "
          + "execution(* org.springframework.jdbc.core.JdbcTemplate.update*(..)) || "
          + "execution(* org.springframework.jdbc.core.JdbcTemplate.execute*(..)) || "
          + "execution(* org.springframework.jdbc.core.JdbcTemplate.batchUpdate*(..))")
    public Object timeJdbc(ProceedingJoinPoint pjp) throws Throwable {
        return timeAndMaybeWarn(pjp, "jdbc");
    }

    // (2) @SlowLog annotation — opt-in for ES and other adapter calls.
    @Around("@annotation(com.citi.gru.rectrace.observability.aop.SlowLog)")
    public Object timeAnnotated(ProceedingJoinPoint pjp) throws Throwable {
        return timeAndMaybeWarn(pjp, "slowlog");
    }

    private Object timeAndMaybeWarn(ProceedingJoinPoint pjp, String tag) throws Throwable {
        long start = System.nanoTime();
        try {
            return pjp.proceed();
        } finally {
            long ms = (System.nanoTime() - start) / 1_000_000L;
            if (ms >= thresholdMs) {
                Object[] args = pjp.getArgs();
                String firstArg = args.length > 0 && args[0] != null
                        ? truncate(args[0].toString(), 200) : "";
                log.warn("slow-{} method={} durationMs={} arg0={}",
                        tag, pjp.getSignature().toShortString(), ms, firstArg);
            }
        }
    }
    private static String truncate(String s, int max) {
        return s.length() <= max ? s : s.substring(0, max) + "...";
    }
}
```

**ES calls:** Annotate `ElasticsearchServiceV4.search(...)`, `SuggestionService.suggest(...)`, `LoaderJobRegistry`/`OracleToEsLoaderJob` bulk operations with `@SlowLog`. The planner should enumerate the exact methods.

### §3.6 Pattern — Prometheus + `@Timed`

Adding `micrometer-registry-prometheus` to the classpath auto-registers a `PrometheusMeterRegistry` and auto-configures the `/actuator/prometheus` endpoint. `[CITED: docs.spring.io/spring-boot/3.5/reference/actuator/endpoints.html]` Default exposure does NOT include `prometheus` — we already added it to the allow-list (§3.4).

**`@Timed` placement strategy:**

- `@Timed` on REST controllers `@RequestMapping`-annotated methods (already a Boot auto-config if `web.server.request.metrics.enabled=true`, which is default) — produces `http.server.requests` automatically without explicit annotation. **No action needed for controllers.**
- `@Timed` on `SearchServiceV4.search`, `OracleToEsLoaderJob.run`, `ExecutionOrderService.fetch*`, `ElasticsearchServiceV4.search` — manual, surfaces the most operationally interesting timers under `method.execution`.

**Aspectjweaver pulled by `spring-boot-starter-aop`** is the dependency that lets `@Timed`/`@Observed` be intercepted. With `management.observations.annotations.enabled=true` (set in §3.4), Boot's `ObservationAutoConfiguration` registers the `TimedAspect` and `CountedAspect` automatically. `[CITED: docs.spring.io/spring-boot/3.5/reference/actuator/observability.html]`

### §3.7 Pattern — Correlation-ID propagation

**(a) `@Async` — `ContextPropagatingTaskDecorator`** (Boot 3.2+ built-in):

```java
// EDIT AsyncConfig.java
@Configuration
public class AsyncConfig {
    @Bean(name = "taskExecutor")
    public Executor taskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(10);
        executor.setMaxPoolSize(20);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("AsyncSearch-");
        executor.setTaskDecorator(new ContextPropagatingTaskDecorator());  // NEW
        executor.initialize();
        return executor;
    }
}
```

`ContextPropagatingTaskDecorator` propagates the Micrometer `ContextSnapshot` — which carries Brave `TraceContext`, SLF4J MDC, RequestContextHolder, and SecurityContextHolder — from the calling thread to the async thread. The async thread sees the SAME `traceId` MDC value as the caller. `[CITED: docs.spring.io/spring-boot/3.5/reference/actuator/observability.html]`

**(b) `@Scheduled` — `ScheduledTraceIdAspect`** (fresh traceId per fire):

```java
@Aspect
@Component
public class ScheduledTraceIdAspect {
    private final Tracer tracer;  // io.micrometer.tracing.Tracer
    public ScheduledTraceIdAspect(Tracer tracer) { this.tracer = tracer; }

    @Around("@annotation(org.springframework.scheduling.annotation.Scheduled)")
    public Object freshTrace(ProceedingJoinPoint pjp) throws Throwable {
        // Start a brand-new span (and trace) for this fire. Brave will populate
        // the MDC traceId/spanId via its MDC scope decorator.
        Span span = tracer.nextSpan().name(pjp.getSignature().toShortString()).start();
        try (Tracer.SpanInScope ws = tracer.withSpan(span)) {
            return pjp.proceed();
        } finally {
            span.end();
        }
    }
}
```

This covers `LoaderTicker.tick()` and the `OracleToEsLoaderJob`'s `@Scheduled` (if any). The planner should grep `@Scheduled` across both modules to enumerate all targets.

Alternative if AOP on `@Scheduled` is fragile: a manual `MDC.put("traceId", randomHex())` / `MDC.clear()` block inside the method body. The aspect approach is preferred because it doesn't pollute business code.

**(c) `ScriptExecutor` — env var injection:**

```java
public String executeScript(String scriptPath, String serviceName, String dbSchema) {
    ProcessBuilder pb = new ProcessBuilder(scriptPath, "@" + serviceName, dbSchema);
    pb.redirectErrorStream(true);
    // OBS-06 — pass current traceId to subprocess. Convention: scripts that want
    // to correlate their stdout/stderr with backend logs should echo this value.
    String traceId = MDC.get("traceId");
    if (traceId != null) {
        pb.environment().put("RECTRACE_CORRELATION_ID", traceId);
    }
    // ... existing logic
}
```

Document the `RECTRACE_CORRELATION_ID` convention in `ScriptExecutor.java`'s Javadoc so future script authors know to consume it. (Note: at the moment `ScriptExecutor` is called during application bootstrap to fetch DB passwords — there is NO active traceId. The env var will be absent at boot. That's fine; the contract is "if present, use it." The user-driven call paths that invoke subprocesses in the future can populate MDC first.)

### §3.8 Pattern — Maven Enforcer for Micrometer pin

Add to **both** POM `<build><plugins>`:

```xml
<plugin>
  <groupId>org.apache.maven.plugins</groupId>
  <artifactId>maven-enforcer-plugin</artifactId>
  <version>3.6.2</version>
  <executions>
    <execution>
      <id>enforce-micrometer-pin</id>
      <goals><goal>enforce</goal></goals>
      <configuration>
        <rules>
          <!-- OBS-08 — fail build if any sub-dep tries to pull a Micrometer
               version disagreeing with the Boot BOM. -->
          <dependencyConvergence/>
          <!-- Belt-and-braces ban on any 2.x Micrometer in case Micrometer goes
               2.0 before we re-evaluate. Pin documented intentionally; lift this
               ban when we upgrade Boot to a BOM that ships Micrometer 2.x. -->
          <bannedDependencies>
            <excludes>
              <exclude>io.micrometer:*:[2.0.0,)</exclude>
            </excludes>
          </bannedDependencies>
        </rules>
      </configuration>
    </execution>
  </executions>
</plugin>
```

`[CITED: maven.apache.org/enforcer/enforcer-rules/bannedDependencies.html — bracket notation pins exact range]`

### Anti-Patterns to Avoid

- **`logback.xml` instead of `logback-spring.xml`:** Spring profile blocks are silently ignored. Use the `-spring.xml` suffix.
- **`MDC.put` without `MDC.remove` / `MDC.clear`:** thread reuse leaks MDC into the next request handled by the same thread. Always pair in `try/finally`.
- **Setting `setQueryTimeout` on the shared `JdbcTemplate` singleton:** breaks every other caller. Use a dedicated bean (Pitfall P-7).
- **Wildcard actuator exposure (`*`):** leaks `/actuator/env` (secrets), `/actuator/heapdump`, `/actuator/shutdown`. Explicit allow-list always.
- **Hand-rolling an MDC-copying `TaskDecorator`:** loses Brave TraceContext. Use `ContextPropagatingTaskDecorator`.
- **Aspect on JdbcOperations interface instead of JdbcTemplate concrete:** double-fires through NamedParameterJdbcTemplate delegation (Pitfall P-6).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| MDC propagation across `@Async` thread boundary | Custom `TaskDecorator` that copies `MDC.getCopyOfContextMap()` | `org.springframework.core.task.support.ContextPropagatingTaskDecorator` | Built into Boot 3.2+; carries Brave TraceContext + Security context, not just MDC |
| Per-request structured log line | Custom Logback layout | `net.logstash.logback.encoder.LogstashEncoder` 8.0 + `LoggingEventCompositeJsonEncoder` for advanced needs | 140+ Context7 snippets cover every Splunk/ELK field shape; truncation, stack-shortening, MDC filtering — all configurable |
| Health endpoint JSON aggregation | Custom `@RestController` polling DB / ES | `AbstractHealthIndicator` + `/actuator/health` | Boot aggregates, applies `show-details`, maps to HTTP 200/503 |
| Prometheus exposition format | Custom `/metrics` endpoint | `micrometer-registry-prometheus` auto-configured `/actuator/prometheus` | Bundles JVM, Hikari, Tomcat, HTTP-server metrics out of the box |
| `@Timed` AOP wiring | Custom `MethodInterceptor` | `spring-boot-starter-aop` + `management.observations.annotations.enabled=true` | Boot auto-registers `TimedAspect`, `CountedAspect`, `ObservedAspect` |
| Splunk HEC HTTP forwarder | Custom HTTP client writing to `/services/collector/raw` | `LogstashTcpSocketAppender` with Splunk HEC TCP input | Splunk HEC supports raw TCP; the appender handles reconnect, backpressure, SSL |

**Key insight:** Spring Boot 3.5 has matured the observability stack such that nearly every Phase-7 capability is a bean wiring or property toggle. The temptation to write a custom filter for each concern (MDC enrichment, access logging, query timing) should be resisted — `OncePerRequestFilter` + `@Aspect` + `AbstractHealthIndicator` are the three primitives that compose the entire phase.

## Common Pitfalls

### Pitfall P-1: `logback.xml` instead of `logback-spring.xml`
**What goes wrong:** `<springProfile>` blocks inside `logback.xml` silently no-op. Production-only appenders fire in dev or vice-versa.
**Why it happens:** Logback loads `logback.xml` before Spring activates profiles. The `-spring.xml` suffix triggers Boot's profile-aware loader.
**How to avoid:** Always name the file `logback-spring.xml`. Both modules already use this name (verified) — keep it.
**Warning signs:** Dev console suddenly silent OR prod logs going to console as plain text.

### Pitfall P-2: Logstash appender silently dropping logs on shutdown
**What goes wrong:** `LogstashTcpSocketAppender` has an async ring buffer; on JVM shutdown, in-flight messages can be lost.
**Why it happens:** Default shutdown sequence doesn't give the appender time to drain.
**How to avoid:** Wrap with `AsyncAppender` setting `neverBlock=true`, and rely on Logback's shutdown hook (Boot registers it automatically). Verify `spring.lifecycle.timeout-per-shutdown-phase=60s` (already set in `application.properties` per Phase 6) covers the appender drain.
**Warning signs:** Missing tail of a crash log; "Logback context being closed" without preceding flush messages.

### Pitfall P-3: MDC leak across thread reuse
**What goes wrong:** Tomcat thread pool reuses threads; if a filter does `MDC.put("userId", ...)` without `MDC.remove`, the next request on that thread sees the prior request's `userId`.
**Why it happens:** SLF4J MDC is thread-local; thread-pool reuse means thread-local data outlives the request.
**How to avoid:** Every `MDC.put` is paired with `MDC.remove` (or `MDC.clear`) in a `finally` block. Better: use `MDC.MDCCloseable` (try-with-resources). The Brave-managed `traceId`/`spanId` is auto-cleared by the tracer's scope; only the manually-added keys (`userId`, `path`, `method`, `status`, `durationMs`) need explicit cleanup.
**Warning signs:** Log entries showing a `userId` for a health-check probe that has no `x-citiportal-loginid` header.

### Pitfall P-4: Health indicator inversion (200 vs 503)
**What goes wrong:** Indicator returns `Health.down()` but `/actuator/health` returns HTTP 200 anyway. Or returns UP-with-error-detail.
**Why it happens:** Default `HttpCodeStatusMapper` maps DOWN → 503, but custom mappers or `out-of-service` status can short-circuit. Also, exception thrown from `doHealthCheck` is caught by `AbstractHealthIndicator` and wrapped as DOWN — but the build-default-status property may say otherwise.
**How to avoid:** Use `AbstractHealthIndicator` (not raw `HealthIndicator`) — its exception handling is correct by default. Test with: `curl -i http://localhost:6088/rectrace/actuator/health` while Oracle is stopped — expect 503.
**Warning signs:** Kubernetes / load-balancer keeps routing traffic to a broken instance.

### Pitfall P-5: Oracle `SELECT 1 FROM DUAL` hangs the actuator
**What goes wrong:** Oracle connection pool exhausted or network issue causes the health probe to block indefinitely. `/actuator/health` request times out, alerting fires unnecessarily.
**Why it happens:** No query timeout on the health check.
**How to avoid:** Use a dedicated `JdbcTemplate` bean for the health indicator with `setQueryTimeout(2)`. Do NOT modify the shared singleton (Pitfall P-7). Alternative: use `Statement.setQueryTimeout` per call via `JdbcTemplate.execute(StatementCallback)`.
**Warning signs:** `/actuator/health` latency spikes correlate with Oracle latency spikes.

### Pitfall P-6: AOP double-fire on `NamedParameterJdbcTemplate`
**What goes wrong:** `NamedParameterJdbcTemplate.query(...)` delegates to its internal `JdbcTemplate.query(...)`. Both are Spring beans with proxies. The slow-query aspect fires TWICE for one logical query.
**Why it happens:** Proxy-based AOP catches every cross-bean call.
**How to avoid:** Pointcut targets `JdbcTemplate` concrete class (not the `JdbcOperations` interface). Verify with `grep -r "NamedParameterJdbcTemplate" backend/rectrace/src/main` — if used, ensure the aspect doesn't also intercept its public surface.
**Warning signs:** Slow-query log lines appear in pairs with the same `durationMs` and arg0.

### Pitfall P-7: Mutating the shared `JdbcTemplate` singleton
**What goes wrong:** Calling `primaryJdbcTemplate.setQueryTimeout(2)` in the health indicator changes the timeout for EVERY caller of that bean.
**Why it happens:** Spring beans are singletons by default; `setQueryTimeout` is on `JdbcAccessor` (a parent of `JdbcTemplate`) and mutates the bean's state.
**How to avoid:** Either create a dedicated `JdbcTemplate` bean for the health indicator (with its own timeout), or use `JdbcTemplate.execute(con -> { try (Statement s = con.createStatement()) { s.setQueryTimeout(2); ... } })` for per-call timeout.
**Warning signs:** Search queries start failing with `ORA-01013: user requested cancel of current operation` after the health indicator deploys.

### Pitfall P-8: Micrometer Tracing's `traceparent` header vs existing `X-Correlation-Id`
**What goes wrong:** Phase 2 React `apiFetch` sends `X-Correlation-Id`. Micrometer Tracing's default Brave Propagation also wants to inject/extract W3C `traceparent`. If both are sent, the precedence rules matter.
**Why it happens:** Two propagation schemes for the same concept.
**How to avoid:** Phase 2's `CorrelationIdPropagationConfig` (already verified) handles this: if `X-Correlation-Id` is a valid 32-hex, it is adopted as the trace ID; otherwise Brave falls back to B3/W3C extraction. Phase 7 should **not** modify this config — it works. Document the contract in the access-log filter's Javadoc: "traceId MDC value is sourced from Phase 2's correlation-id propagator; this filter never overwrites it."
**Warning signs:** A React request shows one `X-Correlation-Id` in the network panel but a different `traceId` in the log JSON.

### Pitfall P-9: Slow-query AOP on tests
**What goes wrong:** Test-context loading exercises `JdbcTemplate` calls that legitimately take >500ms (Testcontainers cold start, embedded H2 init). WARN logs spam the test output.
**Why it happens:** Aspect fires in test profile too.
**How to avoid:** Either `@Profile("!test")` on `SlowQueryLoggerAspect`, or raise the threshold in `application-test.properties` (`observability.slow-query-threshold-ms=60000`). Recommend the profile gate so test logs stay clean.
**Warning signs:** Test logs show 50+ slow-query warnings on every Spring context boot.

### Pitfall P-10: `@Scheduled` aspect interacting with ShedLock (Phase 6)
**What goes wrong:** `LoaderTicker.tick()` is annotated `@Scheduled` AND wrapped by ShedLock's `LockingTaskExecutor`. The `ScheduledTraceIdAspect` fires on the OUTER method; the lock-protected lambda runs in the same thread, so the MDC traceId is carried. BUT: the per-job dispatch loop inside `tick()` runs each `def` under a new lock; if any dispatch is on a different thread (it isn't, by `LockingTaskExecutor.executeWithLock` semantics), MDC wouldn't propagate.
**Why it happens:** ShedLock's executor runs the task on the caller thread by default.
**How to avoid:** Verified — `LockingTaskExecutor.executeWithLock` runs synchronously on the caller thread. MDC is fine. **No action needed**, but the planner should add a test that asserts the `traceId` is present in logs emitted by `OracleToEsLoaderJob.run`.
**Warning signs:** Loader logs show empty traceId.

### Pitfall P-11: Actuator `/health` 200 vs 503 affecting ops script
**What goes wrong:** `ops/rectrace-ops.sh status` (Phase 8) probes `/actuator/health` for readiness. If the LoaderRunAgeHealthIndicator returns DOWN whenever a job is mildly late, the ops script reports the service as failed.
**Why it happens:** Strict 2× cron threshold flips quickly under load.
**How to avoid:** Mark the LoaderRunAgeHealthIndicator with `@Component("loaderRunAge")` and **exclude** it from the aggregated `/actuator/health` HTTP-status mapping via `management.endpoint.health.status.order` + `management.endpoint.health.group.readiness.include` — put loader-age in a `liveness`/`details` group, not the readiness group. Or, expose it under a separate health group `/actuator/health/loader`. Decision deferred to planner; recommendation: separate group so ops/k8s probes don't flap on a late job.
**Warning signs:** Ops `status` reports DOWN at 3am every day when a job is a minute late.

## Runtime State Inventory

> Phase 7 is purely additive — new files, new beans, new properties. No rename / refactor / migration. Section omitted per scope.

## Code Examples

Verified patterns from official / Context7 sources:

### LogstashEncoder with MDC selection
```xml
<!-- Source: Context7 /logfellow/logstash-logback-encoder llms.txt -->
<encoder class="net.logstash.logback.encoder.LogstashEncoder">
  <includeMdc>true</includeMdc>
  <customFields>{"application":"rectrace","environment":"prod"}</customFields>
  <timestampPattern>yyyy-MM-dd'T'HH:mm:ss.SSS'Z'</timestampPattern>
  <timeZone>UTC</timeZone>
</encoder>
```

### LogstashTcpSocketAppender to remote endpoint
```xml
<!-- Source: Context7 /logfellow/logstash-logback-encoder llms.txt -->
<appender name="LOGSTASH" class="net.logstash.logback.appender.LogstashTcpSocketAppender">
  <destination>splunk-hec.citi.intra:9997</destination>
  <reconnectionDelay>30 seconds</reconnectionDelay>
  <writeTimeout>10 seconds</writeTimeout>
  <ringBufferSize>8192</ringBufferSize>
  <encoder class="net.logstash.logback.encoder.LogstashEncoder">
    <includeMdc>true</includeMdc>
  </encoder>
</appender>
```

### ContextPropagatingTaskDecorator wiring
```java
// Source: docs.spring.io/spring-boot/3.5/reference/actuator/observability.html
@Configuration
class ContextPropagationConfiguration {
    @Bean
    ContextPropagatingTaskDecorator contextPropagatingTaskDecorator() {
        return new ContextPropagatingTaskDecorator();
    }
}
// Or — directly on the executor:
executor.setTaskDecorator(new ContextPropagatingTaskDecorator());
```

### Custom HealthIndicator
```java
// Source: docs.spring.io/spring-boot/3.5/reference/actuator/endpoints.html
@Component
class MyHealthIndicator implements HealthIndicator {
    @Override public Health health() {
        int errorCode = check();
        if (errorCode != 0)
            return Health.down().withDetail("Error Code", errorCode).build();
        return Health.up().build();
    }
}
```

### Maven Enforcer bannedDependencies with version range
```xml
<!-- Source: maven.apache.org/enforcer/enforcer-rules/bannedDependencies.html -->
<bannedDependencies>
  <excludes>
    <exclude>io.micrometer:*:[2.0.0,)</exclude>  <!-- ban 2.0.0 and higher -->
  </excludes>
</bannedDependencies>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hand-rolled `OncePerRequestFilter` that sets `MDC.put("traceId", UUID)` | Micrometer Tracing (Brave bridge) populating MDC automatically | Spring Boot 3.0 | Phase 2 already done — Phase 7 does NOT re-add a correlation-id filter |
| Custom `Thread` MDC copy in `Runnable.run()` | `ContextPropagatingTaskDecorator` (Boot 3.2+) | Spring Boot 3.2 | Hand-rolled MDC `TaskDecorator` no longer recommended |
| `logback-classic` 1.2.x + `logstash-logback-encoder` 6.x | Logback 1.5.x + `logstash-logback-encoder` 8.x | Spring Boot 3.0 (jakarta) | 8.0 is the current stable line; 9.0 requires Jackson 3 which Boot hasn't shipped yet |
| `prometheus-simpleclient` registry | `io.micrometer:micrometer-registry-prometheus` (Micrometer 1.13+) | Micrometer 1.13 (Boot 3.3) | Old `simpleclient`-based artifact removed; new artifact uses Prometheus' official `prometheus-metrics-core` 1.x |
| `WebSecurityConfigurerAdapter` for actuator auth | `SecurityFilterChain` bean | Spring Security 6 (Boot 3.0) | Phase 1 already migrated; Phase 7 adds an actuator-specific filter chain on top |

**Deprecated / outdated:**
- `logback.xml` with `<springProfile>` blocks — silently ignored. Always `-spring.xml`.
- `requireUpperBoundDeps` for pinning a ceiling — it's an upgrade-forcer, not a ceiling-enforcer. Use `bannedDependencies` with a `[X,)` range or `dependencyConvergence`.
- `RestHighLevelClient.ping()` — deprecated; use `co.elastic.clients.elasticsearch.ElasticsearchClient.ping()` (codebase already uses the new client — verified).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Splunk HEC endpoint | OBS-07 prod profile | UNKNOWN (placeholder) | — | Local-dev = `ConsoleAppender`; ops can run prod with `STDOUT_JSON` only if Splunk down |
| Prometheus scraper | OBS-05 (operational consumer) | n/a (we emit; scraper is external) | — | None needed — endpoint just exists |
| Oracle (primary + autosys) | OracleHealthIndicator | ✓ (existing) | per Phase 6 | — |
| Elasticsearch | ElasticsearchHealthIndicator | ✓ (existing) | per Phase 6 | — |
| ShedLock JDBC table | already deployed (Phase 6) | ✓ | — | — |
| `aspectjweaver` (runtime) | `@Timed`/`@Observed` annotations | comes with `spring-boot-starter-aop` | BOM | — |

**Missing dependencies with no fallback:** Splunk HEC URL + token (`[NEEDS USER REVIEW]`). Block: **NO** — local-dev and CI run without it; prod can be deployed with `STDOUT_JSON` only and a tail-forwarder retrofitted later.

**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | JUnit 5 (Jupiter) + Spring Boot Test 3.5.14 + Mockito (transitive) |
| Config file | none separate — `spring-boot-starter-test` BOM-managed |
| Quick run command | `mvn -pl backend/rectrace test -Dtest=<TestClass>` |
| Full suite command | `mvn -pl backend/rectrace test && mvn -pl rectrace-tlm-stats test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OBS-01 | JSON log line contains `traceId`, `userId`, `path`, `method`, `status`, `durationMs` for an HTTP request | integration (with `MockMvc` + Logback `ListAppender`) | `mvn -pl backend/rectrace test -Dtest=AccessLogJsonShapeTest` | ❌ Wave 0 |
| OBS-01 | `logback-spring.xml` parses without error in `prod` profile and `LogstashTcpSocketAppender` is wired | integration (`@SpringBootTest(properties="spring.profiles.active=prod")` + Logback context introspection) | `mvn -pl backend/rectrace test -Dtest=LogbackProdProfileTest` | ❌ Wave 0 |
| OBS-02 | `/actuator/health` aggregates 4 indicators and returns 200 when all UP | `@SpringBootTest` + MockMvc against `/actuator/health` with mocked DS/ES | `mvn -pl backend/rectrace test -Dtest=ActuatorHealthIntegrationTest` | ❌ Wave 0 |
| OBS-02 | OracleHealthIndicator returns DOWN when `SELECT 1` throws | unit (Mockito on `JdbcTemplate`) | `mvn -pl backend/rectrace test -Dtest=OracleHealthIndicatorTest` | ❌ Wave 0 |
| OBS-02 | LoaderRunAgeHealthIndicator returns DOWN when last success > 2×cron old | unit (Mockito on `LoaderRunHistoryService` + injected `Clock`) | `mvn -pl backend/rectrace test -Dtest=LoaderRunAgeHealthIndicatorTest` | ❌ Wave 0 |
| OBS-03 | Actuator response on `/actuator/` lists exactly 5 endpoints, no `env`/`heapdump`/`shutdown` | `@SpringBootTest` + MockMvc + JSON-path assertion | `mvn -pl backend/rectrace test -Dtest=ActuatorExposureTest` | ❌ Wave 0 |
| OBS-04 | Slow-query aspect logs WARN when threshold exceeded; does NOT log when under threshold | unit (`Logback ListAppender` on `SlowQueryLoggerAspect` logger; AOP self-invocation via test `@Configuration`) | `mvn -pl backend/rectrace test -Dtest=SlowQueryLoggerAspectTest` | ❌ Wave 0 |
| OBS-05 | `/actuator/prometheus` returns text with `http_server_requests_seconds_count` after a request | `@SpringBootTest` + MockMvc + content-string contains | `mvn -pl backend/rectrace test -Dtest=PrometheusEndpointTest` | ❌ Wave 0 |
| OBS-06 | `@Async` method observes the caller's `traceId` MDC value | `@SpringBootTest` + `@Async` test bean that returns `MDC.get("traceId")` via `CompletableFuture` | `mvn -pl backend/rectrace test -Dtest=AsyncMdcPropagationTest` | ❌ Wave 0 |
| OBS-06 | `@Scheduled` method gets a fresh non-empty `traceId` | unit (synthetic `@Scheduled` bean + aspect + `ListAppender`) | `mvn -pl backend/rectrace test -Dtest=ScheduledTraceIdAspectTest` | ❌ Wave 0 |
| OBS-06 | `ScriptExecutor` passes `RECTRACE_CORRELATION_ID` env var when MDC has traceId | unit (mock `ProcessBuilder`; assert `environment()` map entry) | `mvn -pl backend/rectrace test -Dtest=ScriptExecutorEnvVarTest` | ❌ Wave 0 |
| OBS-07 | Same as OBS-01 prod-profile test | — | — | shared |
| OBS-08 | Maven enforce phase fails when a synthetic dep tries to pull Micrometer 2.0.0 | integration test in `enforcer-test/` submodule OR a Maven failsafe IT goal | `mvn -pl backend/rectrace verify -Penforce-test` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** the targeted test class (`mvn -pl <module> test -Dtest=<Class>`) — < 30s.
- **Per wave merge:** full module test (`mvn -pl <module> test`) — both modules.
- **Phase gate:** full multi-module suite green before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `backend/rectrace/src/test/java/com/citi/gru/rectrace/observability/AccessLogJsonShapeTest.java` — covers OBS-01 JSON shape.
- [ ] `backend/rectrace/src/test/java/com/citi/gru/rectrace/observability/LogbackProdProfileTest.java` — covers OBS-01 prod profile.
- [ ] `backend/rectrace/src/test/java/com/citi/gru/rectrace/observability/ActuatorHealthIntegrationTest.java` — covers OBS-02.
- [ ] `backend/rectrace/src/test/java/com/citi/gru/rectrace/observability/health/{Oracle,Elasticsearch,LoaderRunAge,SearchConfig}HealthIndicatorTest.java` — covers OBS-02 unit.
- [ ] `backend/rectrace/src/test/java/com/citi/gru/rectrace/observability/ActuatorExposureTest.java` — covers OBS-03.
- [ ] `backend/rectrace/src/test/java/com/citi/gru/rectrace/observability/aop/SlowQueryLoggerAspectTest.java` — covers OBS-04.
- [ ] `backend/rectrace/src/test/java/com/citi/gru/rectrace/observability/PrometheusEndpointTest.java` — covers OBS-05.
- [ ] `backend/rectrace/src/test/java/com/citi/gru/rectrace/observability/AsyncMdcPropagationTest.java` — covers OBS-06 async path.
- [ ] `backend/rectrace/src/test/java/com/citi/gru/rectrace/observability/aop/ScheduledTraceIdAspectTest.java` — covers OBS-06 scheduler path.
- [ ] `backend/rectrace/src/test/java/com/citi/gru/rectrace/util/ScriptExecutorEnvVarTest.java` — covers OBS-06 subprocess.
- [ ] Mirror trio for `rectrace-tlm-stats`: `AccessLogJsonShapeTest`, `ActuatorHealthIntegrationTest`, `ActuatorExposureTest`, `OracleHealthIndicatorTest`, `AsyncMdcPropagationTest`, `PrometheusEndpointTest`.
- [ ] No framework install needed — `spring-boot-starter-test` already on both POMs.
- [ ] `spring-boot-starter-aop` must be added to BOTH POMs before AOP-dependent tests can write.

## Security Domain

> `security_enforcement` is enabled (default). Section included.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (`/actuator/loggers`, `/actuator/metrics` require auth) | Existing `SecurityFilterChain` extended in Phase 9; Phase 7 stub config preserves anonymous-permit (no regression) |
| V3 Session Management | no | n/a — actuator endpoints stateless |
| V4 Access Control | yes (exposure allow-list IS access control) | `management.endpoints.web.exposure.include` explicit list (D-7.3) |
| V5 Input Validation | partial | `X-Correlation-Id` regex already enforced in Phase 2 `CorrelationIdPropagationConfig`; this phase relies on it |
| V6 Cryptography | no (until SSL on the Splunk TCP socket — Phase 9 may add) | `LogstashTcpSocketAppender` `<ssl>` block kept off for Phase 7; Phase 9 enables with truststore |
| V7 Error Handling and Logging | YES — this phase IS the logging story | JSON logs, MDC, no PII in MDC keys (`userId` is loginId only — same as today), bind-arg truncation in slow-query log |
| V9 Communication | yes (Splunk TCP) | Phase 9 adds SSL; Phase 7 plain TCP acceptable in pre-prod since Citi network is internal |
| V14 Configuration | yes (no wildcards, no secrets in actuator output) | `env` endpoint NEVER exposed; `splunk.hec.token` lives in `application-prod.properties` which is ops-managed |

### Known Threat Patterns for Spring Boot 3.5 + Java 21 observability

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Log injection via `X-Correlation-Id` value | Tampering | 32-hex regex enforcement in `CorrelationIdPropagationConfig` (Phase 2, verified) |
| Log injection via `userId` (loginId) value | Tampering | LoginId comes from the trusted `x-citiportal-loginid` header (today's auth — Phase 9 hardens). Truncate to 64 chars; reject CR/LF in `UserIdMdcFilter`. |
| Secret leakage via `/actuator/env` | Information Disclosure | `env` explicitly excluded from exposure list (D-7.3) |
| Secret leakage via `/actuator/configprops` | Information Disclosure | Same — excluded |
| Heap-dump exfiltration via `/actuator/heapdump` | Information Disclosure | Same — excluded |
| Remote shutdown via `/actuator/shutdown` | Denial of Service | Same — excluded; not exposed by default but doubly excluded for clarity |
| Sensitive bind args in slow-query log (e.g. passwords in a SQL string) | Information Disclosure | 200-char truncation per arg; manual review of `@SlowLog`-annotated methods to confirm they don't pass secrets as SQL parameters |
| Splunk HEC token in version control | Information Disclosure | Placeholder `<TO_BE_FILLED>` only; real token injected at VM deploy time via Citi's existing get_password.sh pathway or Phase 9 Vault/keytab |
| `/actuator/loggers` POST enabling DEBUG → log volume DoS | Denial of Service | Authentication required (when `show-details=when-authorized`); Phase 9 hardens the auth gate |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Splunk HEC is reachable on a single port (default 9997 for raw-TCP HEC). | §3.1, D-7.0 | If Splunk only accepts HTTPS-HEC at port 8088, we'd need a different appender (`logback-syslog4j` or a Splunk-specific HTTP appender). [ASSUMED — verify with ops] |
| A2 | `LoaderJobRegistry` exposes the parsed `CronExpression` for each job so the HealthIndicator can compute "2× interval" without re-parsing. | §3.3 | If not — minor refactor to expose `next(now).minus(now)` accessor. [VERIFIED via grep: `CronExpression cron = cronExpressions.get(key);` exists in `LoaderJobRegistry.java`] |
| A3 | `rectrace-tlm-stats` does NOT need a slow-query aspect (only Oracle DS, simpler shape). | §3.5 | If TLM queries are slow under load, we'd want it. Add the aspect for parity — cost is one bean. [ASSUMED — recommend adding for parity] |
| A4 | `ContextPropagatingTaskDecorator` propagates Brave's `TraceContext` AND SLF4J MDC. | §3.7 | If only one or the other propagates, the async-MDC test (OBS-06) will fail and we'd fall back to a hand-rolled decorator chaining both. [CITED: Spring docs say "context propagation" — Brave's `BraveContextPropagator` is registered by Boot's `BraveAutoConfiguration` so this should work; verify in Wave 0 test] |
| A5 | Spring Boot 3.5.14 BOM pins `logstash-logback-encoder` to NOTHING (we must pin). | Standard Stack table | If a Citi-internal BOM overrides this, our explicit pin still wins by Maven's nearest-definition rule. [VERIFIED via WebFetch — not in BOM] |
| A6 | `aspectjweaver` is transitively brought in by `spring-boot-starter-aop`. | §3.6 | If not, the planner adds explicit `org.aspectj:aspectjweaver` dep. [CITED: standard transitive — has been since Boot 1.x] |
| A7 | Existing `SecurityConfig` allows `/actuator/health` anonymously (since Phase 2 / Phase 6 health probes work). | §3.4 | If actuator is currently behind auth, `LoaderRunAge` probe would 401 from internal callers. [ASSUMED — verify by hitting `/actuator/health` against the Phase 6 build before Phase 7 lands] |
| A8 | The `traceId` MDC key remains `traceId` (default) — Phase 2's `logback-spring.xml` pattern uses `%X{traceId:-}`. | §3.1 | If Boot renames the default key, the pattern breaks. [CITED: docs.spring.io tracing.html says default key is `traceId`] |

**If this table contains entries:** A1, A3, A4, A7 carry the most operational risk. A1 should be confirmed with Citi ops before the prod profile is shipped; A3 is a planning toggle; A4 and A7 are verified in Wave 0 tests.

## Open Questions (RESOLVED)

1. **RESOLVED — Which encoder version: `logstash-logback-encoder` 8.0 or 9.0?**
   - **Answer:** 8.0. 9.0 migrated to Jackson 3 (released Oct 2024); Spring Boot 3.5.14 BOM ships Jackson 2.x. Pulling 9.0 forces Jackson 3 transitively and creates a parallel-tree split. Pin 8.0 explicitly; re-evaluate when Boot adopts Jackson 3. `[VERIFIED: GitHub releases]`

2. **RESOLVED — Use built-in `logging.structured.format.console=logstash` (Boot 3.4+) or the `logstash-logback-encoder` library?**
   - **Answer:** The library — because Splunk HEC requires a remote TCP socket appender (`LogstashTcpSocketAppender`) which the built-in support does NOT provide (it only writes to console/file). Using both would double-emit JSON. `[CITED: docs.spring.io/spring-boot/reference/features/logging.html]`

3. **RESOLVED — Hand-roll a `MDC.getCopyOfContextMap()` `TaskDecorator` or use Boot's `ContextPropagatingTaskDecorator`?**
   - **Answer:** `ContextPropagatingTaskDecorator` (Boot 3.2+). Built-in; carries Brave TraceContext + MDC + Security context. A hand-rolled MDC-only decorator loses the TraceContext, causing new spans created on the async thread to have a different trace ID than the propagated MDC. `[CITED: docs.spring.io/spring-boot/3.5/reference/actuator/observability.html]`

4. **RESOLVED — Maven Enforcer rule for the Micrometer pin: `requireUpperBoundDeps` or `bannedDependencies`?**
   - **Answer:** `bannedDependencies` (with version range `[2.0.0,)` to ban Micrometer 2.x) **plus** `dependencyConvergence` (asserts no two transitive paths declare different Micrometer versions). `requireUpperBoundDeps` is the WRONG rule — it forces upgrades to the highest declared version, the opposite of pinning. `[CITED: maven.apache.org/enforcer/enforcer-rules/]`

5. **RESOLVED — AOP pointcut: `JdbcOperations.*(String, ..)` interface or `JdbcTemplate.*` concrete class?**
   - **Answer:** Concrete `JdbcTemplate` only. NamedParameterJdbcTemplate delegates to JdbcTemplate; both are Spring beans with proxies — interface-level pointcut double-fires on a single logical query. `[VERIFIED: Pitfall P-6 reasoning + Baeldung]`

6. **RESOLVED — `@Scheduled` fresh-traceId: aspect on the annotation, manual `MDC.put` in method body, or Micrometer Observation handler?**
   - **Answer:** Aspect on `@annotation(org.springframework.scheduling.annotation.Scheduled)` using `tracer.nextSpan()`. Cleaner than manual `MDC.put` (no business-logic pollution); uses Brave to assign a real spanId/traceId that downstream calls (Oracle/ES from the scheduled method) inherit via Phase 2's propagator.

7. **RESOLVED — `ScriptExecutor` subprocess: env var (`RECTRACE_CORRELATION_ID`) or command-line arg?**
   - **Answer:** Env var. Env vars don't appear in `ps -ef` listings; command-line args do. Operational hygiene plus reduced log-leak risk. The shell-script convention is "if `$RECTRACE_CORRELATION_ID` is set, echo `[trace=$RECTRACE_CORRELATION_ID]` on every log line."

8. **RESOLVED — `userId` MDC key population: filter or interceptor?**
   - **Answer:** `OncePerRequestFilter` ordered AFTER the Brave correlation-id filter and BEFORE the access-log filter. Set MDC from `req.getHeader("x-citiportal-loginid")`, validated against an allow-list character class (`[A-Za-z0-9._-]{1,64}`) to prevent log injection. `finally` clears the MDC key.

9. **RESOLVED — `OracleHealthIndicator` for `rectrace-tlm-stats`: which datasource?**
   - **Answer:** The static `reconmgmt.datasource` only. The 9 dynamic per-TLM-instance datasources are created per-request and aren't a meaningful "is the service healthy" signal — they're a "is this specific TLM instance reachable" signal that belongs in a different endpoint. Recommendation: keep the actuator health surface lean.

10. **RESOLVED — `LoaderRunAge` indicator placement: aggregated `/actuator/health` or a separate `/actuator/health/loader` group?**
    - **Answer:** Separate group. The aggregated `/actuator/health` drives the ops script's readiness probe (Phase 8); a flapping loader-age check shouldn't take the service "down" from k8s' perspective. Use `management.endpoint.health.group.loader.include=loaderRunAge`. Aggregated `/actuator/health` includes Oracle, ES, and SearchConfig (which DO indicate genuine inability to serve traffic). `[Pitfall P-11]`

11. **RESOLVED — Slow-query threshold in test profile: keep 500ms or raise?**
    - **Answer:** Gate `SlowQueryLoggerAspect` with `@Profile("!test")` so it doesn't fire during context loading and test-fixture setup. Alternative (raise threshold) creates a false sense of "the aspect is working in tests" — better to enable it explicitly in the aspect's own unit test via a test `@Configuration`. `[Pitfall P-9]`

## Sources

### Primary (HIGH confidence)
- Context7 `/logfellow/logstash-logback-encoder` — `LogstashEncoder`, `LogstashTcpSocketAppender`, `LoggingEventCompositeJsonEncoder` providers (MDC, message, timestamp, stack-trace), Maven coordinates
- Context7 `/websites/spring_io_spring-boot_3_5` — `AbstractHealthIndicator`, `ContextPropagatingTaskDecorator`, `@Timed`/`@Observed` annotations support, `/actuator/health`, `/actuator/prometheus`, Boot 3.5 actuator endpoints reference
- https://docs.spring.io/spring-boot/3.5/reference/actuator/endpoints.html — actuator endpoint reference
- https://docs.spring.io/spring-boot/3.5/reference/actuator/observability.html — `ContextPropagatingTaskDecorator`, `management.observations.annotations.enabled`
- https://docs.spring.io/spring-boot/reference/actuator/tracing.html — MDC keys `traceId`/`spanId`, `logging.pattern.correlation`
- https://docs.spring.io/spring-boot/reference/features/logging.html — `springProfile`, `springProperty`, `logging.structured.format`
- https://maven.apache.org/enforcer/enforcer-rules/bannedDependencies.html — version range syntax `[2.0.0,)`
- https://maven.apache.org/enforcer/enforcer-rules/requireUpperBoundDeps.html — confirmed NOT the rule we want
- https://github.com/logfellow/logstash-logback-encoder/releases — 8.0 (Jul 27, 2024) / 8.1 (Apr 5, 2025) / 9.0 (Oct 26, 2024 — Jackson 3)

### Secondary (MEDIUM confidence)
- https://www.innoq.com/en/articles/2025/04/spring-boot-actuator-endpoints/ — defaults and exposure semantics
- https://www.gotoquiz.com/web-coding/programming/java-programming/profile-sql-statements-in-java-spring/ — slow-query AOP via JdbcOperations pointcut
- https://www.baeldung.com/spring-performance-logging — `@Around` timing pattern
- https://medium.com/@rodagevaibhav/end-to-end-guide-logging-distributed-tracing-with-spring-boot-3-5-3-elk-micrometer-e1bc08c9d6d6 — Boot 3.5 + Logstash encoder + Micrometer end-to-end shape

### Tertiary (LOW confidence — flagged for Wave 0 validation)
- Splunk HEC port 9997 raw-TCP assumption (A1) — verify with Citi ops before prod profile ships
- A3 — slow-query aspect parity for `rectrace-tlm-stats` — planner decision

## Project Constraints (from CLAUDE.md)

| Constraint | Compliance Plan |
|------------|----------------|
| Backend = Spring Boot 3.2.x or 3.5.x LTS, Java 17 or 21 | Verified: both POMs use Boot 3.5.14, Java 21. No deviation. |
| Macbook local dev without Citi VM | `logback-spring.xml` `<springProfile name="!prod">` block uses pure `ConsoleAppender` — no Splunk dependency locally. |
| All APIs expect `x-citiportal-loginid` header | `UserIdMdcFilter` reads it; if absent, MDC.userId stays empty (default value handled in pattern with `%X{userId:-}`). |
| Search Config in JSON only — never hardcode | N/A — this phase doesn't touch search config. |
| Error responses with `status/error_type/message` | N/A — actuator responses follow Spring's standard health-JSON shape, which is contract-compatible with monitoring tools. Application error responses untouched. |
| GSD workflow enforcement (no direct repo edits) | Plan/research/execute through `/gsd-execute-phase 7`. |
| Config-driven principle (Rectrace) | Threshold (`observability.slow-query-threshold-ms`), Splunk endpoint (`splunk.hec.host/port`), exposure list (`management.endpoints.web.exposure.include`) all live in `application*.properties` — no hardcoded values in Java. |

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every dep verified against Context7 + Boot 3.5 BOM coordinates table.
- Architecture: HIGH — all patterns sourced from official docs; existing codebase already has the prerequisites (Brave tracer, Micrometer-bridge, actuator starter).
- Pitfalls: HIGH for P-1, P-3, P-5, P-6, P-7 (well-documented Spring Boot landmines); MEDIUM for P-2, P-9, P-10, P-11 (project-specific reasoning).
- Splunk HEC config: MEDIUM — port/protocol assumption flagged A1.

**Research date:** 2026-05-17
**Valid until:** 2026-06-16 (30 days — stable stack)
