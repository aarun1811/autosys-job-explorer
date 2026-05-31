# Loader Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the ES Loader subsystem (20 main + 9 test Java files + `loader-config-v4.json`) from `backend/rectrace` into a new sibling Spring Boot module `rectrace-loader/` on port 6089, leaving backend as a strict read-side API with zero loader awareness.

**Architecture:** 6 phases, each direct-to-main with a known-good intermediate state. Phase 1 stands up an empty loader module skeleton. Phase 2 gates backend's loader behind `@ConditionalOnProperty(rectrace.loader.enabled)` so it can be toggled off without code moves. Phase 3 moves all loader code into the new module. Phase 4 deletes loader code from backend + prunes 3 ShedLock deps + 1 properties key. Phase 5 wires the loader into `ops/components.sh`. Phase 6 re-points smoke scripts to :6089 and updates `CLAUDE.md`.

**Tech Stack:** Spring Boot 3.5.14, Java 21, ShedLock 7.7.0 (`shedlock-spring` + `shedlock-provider-jdbc-template`), co.elastic.clients ES Java BulkIngester, Maven (no parent pom — each module standalone with `spring-boot-starter-parent`), no Lombok in the new module (manual SLF4J `LoggerFactory.getLogger(Class)`), Bash 3.2 portable ops scripts.

**Constraints (carry through every task):**
- Direct-to-main commits per task. Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com> footer.
- No raw hex in TS/TSX (N/A for this backend work but standing rule).
- Bash 3.2 portability for everything under `ops/` — no associative arrays, no `mapfile`, POSIX `case` for prefix matching, `shellcheck -x` is the gate.
- No Lombok in `rectrace-loader/`. Rewrite every `@Slf4j` to `private static final Logger log = LoggerFactory.getLogger(<ClassName>.class)`. Rewrite every `@RequiredArgsConstructor` to an explicit constructor.
- Live stack assumed up: rectrace `:6088`, recviz `:8000`, react `:5173`, Oracle `:1521`, ES `:9200`. Tasks 1, 3, 5 also bring the new loader on `:6089`.
- TDD anchor for Task 1 is the auto-generated `contextLoads` test. Other tasks are mechanical moves — verification is the test gate.

**Source-tree reference** (paths assume CWD is the repo root `/Users/aarun/Workspace/Projects/autosys-job-explorer`):

| Existing surface (backend) | New home (loader) |
|---|---|
| `backend/rectrace/src/main/java/com/citi/gru/rectrace/loader/*` (14 files: 7 top + 7 dto/) | `rectrace-loader/src/main/java/com/citi/gru/rectrace/loader/*` (same shape, package unchanged) |
| `backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/v4/LoaderAdminControllerV4.java` | `rectrace-loader/src/main/java/com/citi/gru/rectrace/loader/controller/LoaderAdminControllerV4.java` (class name unchanged; package now `loader.controller`) |
| `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/{LoaderShedLockConfig,LoaderJdbcConfig}.java` | `rectrace-loader/src/main/java/com/citi/gru/rectrace/loader/config/*` |
| `backend/rectrace/src/main/java/com/citi/gru/rectrace/dto/v4/{LoaderJobSummaryV4,RunNowConflictResponseV4}.java` | `rectrace-loader/src/main/java/com/citi/gru/rectrace/loader/dto/*` (merged with existing 7 loader DTOs under `loader.dto`) |
| `backend/rectrace/src/main/java/com/citi/gru/rectrace/observability/health/LoaderRunAgeHealthIndicator.java` | `rectrace-loader/src/main/java/com/citi/gru/rectrace/loader/health/LoaderRunAgeHealthIndicator.java` |
| `backend/rectrace/src/main/resources/loader-config-v4.json` | `rectrace-loader/src/main/resources/loader-config-v4.json` (verbatim) |
| `backend/rectrace/src/test/java/com/citi/gru/rectrace/loader/*` (7 files) | `rectrace-loader/src/test/java/com/citi/gru/rectrace/loader/*` |
| `backend/rectrace/src/test/java/com/citi/gru/rectrace/controller/v4/LoaderAdminControllerV4Test.java` | `rectrace-loader/src/test/java/com/citi/gru/rectrace/loader/controller/LoaderAdminControllerV4Test.java` |
| `backend/rectrace/src/test/java/com/citi/gru/rectrace/observability/health/LoaderRunAgeHealthIndicatorTest.java` | `rectrace-loader/src/test/java/com/citi/gru/rectrace/loader/health/LoaderRunAgeHealthIndicatorTest.java` |

**Class name convention.** All class names stay the same after the move. Only the Java packages change (controller and health indicator move under the `loader.*` package family; everything else keeps its existing package suffix).

**Endpoint paths stay the same**: `/api/v4/loader-admin/jobs`, `/api/v4/loader-admin/jobs/{key}/run-now`, `/api/v4/loader-admin/jobs/{key}/runs`. **But the host base changes**: today they are reachable at `http://localhost:6088/rectrace/api/v4/loader-admin/*` (backend has `server.servlet.context-path=/rectrace`). After the move, the loader module has **no context path** (mirrors tlm-stats), so endpoints are at `http://localhost:6089/api/v4/loader-admin/*`. Smoke scripts must drop `/rectrace` AND change port.

---

## Task 1: Phase 1 — SKELETON

**Goal:** Create a new `rectrace-loader/` Maven module that boots on port 6089 with an empty Spring Boot application. No loader beans yet — just the skeleton.

**Files:**
- Create: `rectrace-loader/pom.xml`
- Create: `rectrace-loader/src/main/java/com/citi/gru/rectrace/loader/RectraceLoaderApplication.java`
- Create: `rectrace-loader/src/main/resources/application.properties`
- Create: `rectrace-loader/src/main/resources/application-local.properties`
- Create: `rectrace-loader/src/main/resources/logback-spring.xml`
- Create: `rectrace-loader/src/test/java/com/citi/gru/rectrace/loader/RectraceLoaderApplicationTests.java`
- Reference (READ ONLY, do not modify): `rectrace-tlm-stats/pom.xml`, `rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/TlmStatsApplication.java`, `rectrace-tlm-stats/src/main/resources/{application,application-local}.properties`, `rectrace-tlm-stats/src/main/resources/logback-spring.xml`

- [ ] **Step 1: Create the module directory**

```bash
mkdir -p rectrace-loader/src/main/java/com/citi/gru/rectrace/loader
mkdir -p rectrace-loader/src/main/resources
mkdir -p rectrace-loader/src/test/java/com/citi/gru/rectrace/loader
```

- [ ] **Step 2: Write `rectrace-loader/pom.xml`**

Mirror `rectrace-tlm-stats/pom.xml` exactly. Differences:
- `<artifactId>loader</artifactId>` (was `tlm-stats`)
- `<name>rectrace-loader</name>` (was `rectrace-tlm-stats`)
- `<description>Citi GRU Rectrace ES Loader Worker</description>`
- Add 3 ShedLock deps (under the Database Dependencies block, before ojdbc8):
  ```xml
  <dependency>
      <groupId>net.javacrumbs.shedlock</groupId>
      <artifactId>shedlock-spring</artifactId>
      <version>7.7.0</version>
  </dependency>
  <dependency>
      <groupId>net.javacrumbs.shedlock</groupId>
      <artifactId>shedlock-provider-jdbc-template</artifactId>
      <version>7.7.0</version>
  </dependency>
  <dependency>
      <groupId>net.javacrumbs.shedlock</groupId>
      <artifactId>shedlock-provider-inmemory</artifactId>
      <version>7.7.0</version>
      <scope>test</scope>
  </dependency>
  ```
- Add the co.elastic.clients dep:
  ```xml
  <dependency>
      <groupId>co.elastic.clients</groupId>
      <artifactId>elasticsearch-java</artifactId>
      <version>8.13.4</version>
  </dependency>
  ```
- Keep everything else from tlm-stats (spring-boot-starter-web, -test, -actuator, -aop, -security, devtools, -data-jpa, ojdbc8, jackson-databind, micrometer-tracing-bridge-brave, logstash-logback-encoder 8.0, micrometer-registry-prometheus, the spring-boot-maven-plugin, AND the entire maven-enforcer-plugin block with all three executions for micrometer pinning).

- [ ] **Step 3: Write `RectraceLoaderApplication.java`**

```java
package com.citi.gru.rectrace.loader;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class RectraceLoaderApplication {

    public static void main(String[] args) {
        SpringApplication.run(RectraceLoaderApplication.class, args);
    }
}
```

- [ ] **Step 4: Write `application.properties`**

```properties
# Server Configuration
server.port=6089

# Application Name
spring.application.name=rectrace-loader

# Logging
logging.level.com.citi.gru.rectrace.loader=INFO
logging.level.org.springframework.web=INFO
logging.level.org.springframework.jdbc=DEBUG

# OBS-03 / OBS-08 — actuator lockdown (mirror backend + tlm-stats)
management.endpoints.web.exposure.include=health,info,prometheus,loggers,metrics
management.endpoints.web.exposure.exclude=env,heapdump,shutdown,beans,configprops,threaddump,scheduledtasks
management.endpoint.health.show-details=when-authorized
management.endpoint.health.show-components=when-authorized
management.observations.annotations.enabled=true
management.endpoint.health.probes.enabled=true

# Phase 6 LOADER-09 / Pitfall L3: extend graceful-shutdown so BulkIngester.close()
# can flush in-flight ops on SIGTERM. Mirror of backend's value.
spring.lifecycle.timeout-per-shutdown-phase=60s

# CORS allow-list — loader has no browser consumer, but the field is required for
# CorsConfig in shared patterns. Empty value rejects all cross-origin requests.
app.cors.allowed-origins=

# Loader Configuration (filled in Task 3)
# loader-config.location=classpath:loader-config-v4.json
```

- [ ] **Step 5: Write `application-local.properties`**

```properties
# Local development profile for the sibling repo's Docker stack.
# Activated with: mvn spring-boot:run -Dspring.profiles.active=local
# See backend/rectrace/.../application-local.properties for the broader rationale.
#
# SECURITY: Plaintext credentials below are LOCAL-DEV ONLY. DO NOT enable this
# profile in any deployed environment.

spring.application.name=rectrace-loader
server.port=6089

logging.level.com.citi.gru.rectrace.loader=INFO
logging.level.org.springframework.web=INFO
logging.level.org.springframework.jdbc=INFO

management.endpoints.web.exposure.include=health,info
management.endpoint.health.show-details=always

# Primary Oracle (RECTRACE schema user in local FREEPDB1) — same as backend's local
datasource.url=jdbc:oracle:thin:@localhost:1521/FREEPDB1
datasource.username=rectrace
datasource.password=rectrace_pwd
datasource.driver-class-name=oracle.jdbc.OracleDriver
datasource.service-name=FREEPDB1
datasource.db-schema=RECTRACE

# Elasticsearch (security disabled per D-0.1.16) — same as backend's local
spring.elasticsearch.uris=http://localhost:9200

# Micrometer Tracing — Brave bridge
management.tracing.sampling.probability=1.0

# Loader has no browser consumer locally either; empty CORS allow-list is fine.
app.cors.allowed-origins=
```

- [ ] **Step 6: Write `logback-spring.xml`**

Copy `backend/rectrace/src/main/resources/logback-spring.xml` verbatim into `rectrace-loader/src/main/resources/logback-spring.xml`. (It's profile-aware Splunk HEC. Loader logs ship to the same Splunk index. Same tracing-aware MDC pattern.)

```bash
cp backend/rectrace/src/main/resources/logback-spring.xml rectrace-loader/src/main/resources/logback-spring.xml
```

- [ ] **Step 7: Write the contextLoads test**

```java
package com.citi.gru.rectrace.loader;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class RectraceLoaderApplicationTests {

    @Test
    void contextLoads() {
    }
}
```

- [ ] **Step 8: Run `mvn test` to verify the skeleton builds + contextLoads passes**

```bash
cd rectrace-loader && mvn test 2>&1 | tail -20
```

Expected: `BUILD SUCCESS`, `Tests run: 1, Failures: 0, Errors: 0, Skipped: 0`.

- [ ] **Step 9: Boot the skeleton and verify health endpoint UP**

In one terminal:
```bash
cd rectrace-loader && mvn spring-boot:run -Dspring-boot.run.profiles=local
```

Wait for `Started RectraceLoaderApplication in ...`. In another terminal:
```bash
curl -s http://localhost:6089/actuator/health | grep -q '"status":"UP"' && echo "PASS: loader health UP"
```

Expected: `PASS: loader health UP`. (Exact JSON shape depends on `show-details`/`probes` settings — local profile has `show-details=always`, so you'll also see component info. The presence of `"status":"UP"` is the gate.) Kill the running app with Ctrl+C.

- [ ] **Step 10: Commit**

```bash
git add rectrace-loader/
git commit -m "$(cat <<'EOF'
feat(loader): skeleton — empty rectrace-loader module on :6089

Mirrors rectrace-tlm-stats's module shape: Boot 3.5.14, Java 21,
standalone spring-boot-starter-parent, no Lombok. Adds the 3 ShedLock
artifacts (shedlock-spring, shedlock-provider-jdbc-template main scope
+ shedlock-provider-inmemory test scope) and elasticsearch-java 8.13.4
in advance of the Phase 3 code move. Includes profile-aware Splunk
logback (copied verbatim from backend) so loader logs stream to the
same Splunk index for ops continuity.

Phase 1 of docs/superpowers/plans/2026-05-31-loader-extraction.md.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Task 2: Phase 2 — BACKEND LOADER OFF (no code move)

**Goal:** Add an `@ConditionalOnProperty("rectrace.loader.enabled", havingValue="true", matchIfMissing=true)` annotation to every backend loader bean. Default `true` preserves current behavior. Flip to `false` in the local profile so backend boots clean WITHOUT activating any loader bean. No code is moved or deleted in this task.

**Files:**
- Modify: `backend/rectrace/src/main/java/com/citi/gru/rectrace/loader/LoaderTicker.java`
- Modify: `backend/rectrace/src/main/java/com/citi/gru/rectrace/loader/LoaderJobRegistry.java`
- Modify: `backend/rectrace/src/main/java/com/citi/gru/rectrace/loader/LoaderConfigService.java`
- Modify: `backend/rectrace/src/main/java/com/citi/gru/rectrace/loader/LoaderRunHistoryService.java`
- Modify: `backend/rectrace/src/main/java/com/citi/gru/rectrace/loader/OracleToEsLoaderJob.java`
- Modify: `backend/rectrace/src/main/java/com/citi/gru/rectrace/loader/DocumentIdHasher.java`
- Modify: `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/LoaderShedLockConfig.java`
- Modify: `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/LoaderJdbcConfig.java`
- Modify: `backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/v4/LoaderAdminControllerV4.java`
- Modify: `backend/rectrace/src/main/java/com/citi/gru/rectrace/observability/health/LoaderRunAgeHealthIndicator.java`
- Modify: `backend/rectrace/src/main/resources/application-local.properties` (set `rectrace.loader.enabled=false`)

(NOTE: `LoaderBulkListener` is NOT in this list — it has only `@Slf4j` and no bean stereotype. It's instantiated programmatically by `OracleToEsLoaderJob` when constructing the BulkIngester, not by Spring. Don't gate it.)

- [ ] **Step 1: Inventory the loader beans to gate**

Run this to confirm every `@Component`, `@Service`, `@Configuration`, `@RestController` that's loader-related:

```bash
grep -lE "^@(Component|Service|Configuration|RestController)" \
  backend/rectrace/src/main/java/com/citi/gru/rectrace/loader/*.java \
  backend/rectrace/src/main/java/com/citi/gru/rectrace/config/Loader*.java \
  backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/v4/LoaderAdminControllerV4.java \
  backend/rectrace/src/main/java/com/citi/gru/rectrace/observability/health/LoaderRunAgeHealthIndicator.java
```

Expected: exactly 10 file paths. If you get 11 it usually means `LoaderBulkListener` got matched somehow — confirm it does NOT have a top-level stereotype.

- [ ] **Step 2: Add `@ConditionalOnProperty` to every loader bean class**

For each of the 10 classes identified in Step 1, add **above** its existing bean stereotype annotation:

```java
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
// ...
@ConditionalOnProperty(name = "rectrace.loader.enabled", havingValue = "true", matchIfMissing = true)
@Component  // or @Service, @Configuration, @RestController — keep the existing annotation
public class LoaderTicker {
    // ...
}
```

The `matchIfMissing = true` makes the flag default to ON, so backend behavior is unchanged with no property set. Setting it to `false` (Step 3) silences ALL loader beans.

Apply the annotation to all 10 classes:
- `LoaderTicker`, `LoaderJobRegistry`, `LoaderConfigService`, `LoaderRunHistoryService`, `OracleToEsLoaderJob`, `DocumentIdHasher` (6 in `loader/`)
- `LoaderShedLockConfig`, `LoaderJdbcConfig` (2 in `config/`)
- `LoaderAdminControllerV4` (1 in `controller/v4/`)
- `LoaderRunAgeHealthIndicator` (1 in `observability/health/`)

**Important**: `LoaderRunAgeHealthIndicator` has `@Component("loaderRunAge")`. Preserve the bean name argument: `@Component("loaderRunAge")` (keep) + `@ConditionalOnProperty(...)` (add).

**Important**: classes that have `@Profile("!test")` keep that gate AND add the new one. The two compose (bean activates only when both are satisfied).

**Do NOT gate** `LoaderBulkListener` — no bean stereotype, instantiated programmatically by `OracleToEsLoaderJob`. The OracleToEsLoaderJob gate alone ensures the BulkIngester (and therefore the listener) never gets constructed when the flag is off.

- [ ] **Step 3: Flip the flag off in the local profile**

Append to `backend/rectrace/src/main/resources/application-local.properties`:

```properties

# Phase 2 / Loader extraction: gate the in-backend loader OFF in the local profile.
# The rectrace-loader module owns the loader subsystem on :6089 starting in Phase 3.
# Phase 4 removes this property entirely along with the loader code.
rectrace.loader.enabled=false
```

- [ ] **Step 4: Run backend mvn test to verify nothing broken**

```bash
cd backend/rectrace && mvn test 2>&1 | tail -20
```

Expected: `BUILD SUCCESS`. Tests use `@ActiveProfiles("test")` or no profile (which is NOT `local`), so the flag stays at its default `true` for tests — loader test classes still wire their beans normally and pass.

- [ ] **Step 5: Restart backend on local profile + verify loader is off**

The live backend is currently running on `:6088` (per session state). Kill it cleanly:

```bash
JVM_PID=$(lsof -nP -iTCP:6088 -sTCP:LISTEN -t 2>/dev/null)
./ops/rectrace-ops.sh stop backend
[ -n "$JVM_PID" ] && kill -TERM $JVM_PID 2>/dev/null
sleep 3
lsof -nP -iTCP:6088 -sTCP:LISTEN 2>/dev/null || echo "no listener on :6088"
```

Restart:
```bash
./ops/rectrace-ops.sh start backend
```

Wait for backend healthy (poll up to 2 minutes):
```bash
until curl -fs http://localhost:6088/rectrace/actuator/health >/dev/null 2>&1; do sleep 6; done && echo "backend up"
```

- [ ] **Step 6: Verify loader endpoints are gone + search still works**

```bash
# Loader admin endpoint should now return 404 (controller bean absent)
curl -s -o /dev/null -w "loader-admin/jobs → %{http_code}\n" \
  http://localhost:6088/rectrace/api/v4/loader-admin/jobs
# Expected: 404

# Search config endpoint still works
curl -s -o /dev/null -w "search/config → %{http_code}\n" \
  http://localhost:6088/rectrace/api/v4/search/config
# Expected: 200

# Initial search still works (real data)
curl -s "http://localhost:6088/rectrace/api/v4/search/initial?keyword=tlm" | \
  python3 -c 'import sys,json; d=json.load(sys.stdin); print("categories with hits:", [k for k,v in d.get("categoryResults",{}).items() if v.get("count",0)>0])'
# Expected: non-empty list including tlmInstance
```

- [ ] **Step 7: Verify backend log clean of loader scheduling errors**

```bash
grep -c "LoaderTicker\|loader-config" logs/backend.log | tail -5
# Pre-Phase-2: ticker logs every 30s; post-Phase-2: only setup/init lines from earlier runs (or zero if log was rotated)
```

Also confirm the new backend startup chunk in the log has NO `LoaderTicker` lines after the "Started RectraceApplication" line.

- [ ] **Step 8: Commit**

```bash
git add backend/rectrace/src/main/java backend/rectrace/src/main/resources/application-local.properties
git commit -m "$(cat <<'EOF'
feat(loader): gate backend loader behind rectrace.loader.enabled (default ON)

Adds @ConditionalOnProperty("rectrace.loader.enabled", havingValue="true",
matchIfMissing=true) to all 11 backend loader beans (Ticker, JobRegistry,
ConfigService, RunHistoryService, BulkListener, OracleToEsLoaderJob,
DocumentIdHasher, ShedLockConfig, JdbcConfig, AdminController, RunAgeHealthIndicator).
Default true preserves current behavior; local profile flips to false so the
rectrace-loader module on :6089 (Phase 3) is the sole loader instance during
the cutover. Tests untouched — test profile uses default true so existing
loader unit tests still wire correctly.

Phase 2 of docs/superpowers/plans/2026-05-31-loader-extraction.md.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Task 3: Phase 3 — MOVE LOADER CODE INTO `rectrace-loader`

**Goal:** Copy all 20 main + 9 test files + `loader-config-v4.json` into `rectrace-loader/`. Rewrite `@Slf4j` → manual SLF4J. Rewrite `@RequiredArgsConstructor` → explicit constructor. Re-anchor `@SpringBootTest` to `RectraceLoaderApplication`. Wire the loader-specific properties into the new module's `application.properties` + `application-local.properties`. Verify loader boots on :6089, ShedLock acquires, one ingestion cycle completes, admin endpoints respond.

**Files:**
- Create (copy + rewrite): 20 main Java files under `rectrace-loader/src/main/java/com/citi/gru/rectrace/loader/`
- Create (copy + re-anchor): 9 test Java files under `rectrace-loader/src/test/java/com/citi/gru/rectrace/loader/`
- Create: `rectrace-loader/src/main/resources/loader-config-v4.json` (copy verbatim)
- Modify: `rectrace-loader/src/main/resources/application.properties` (uncomment + add loader props)
- Modify: `rectrace-loader/src/main/resources/application-local.properties` (add loader props)

**Lombok rewrite scope** (verified file-by-file 2026-05-31):

`@Slf4j` rewrites — **7 files**:
- `loader/LoaderBulkListener.java`
- `loader/LoaderConfigService.java`
- `loader/LoaderJobRegistry.java`
- `loader/LoaderRunHistoryService.java`
- `loader/LoaderTicker.java`
- `loader/OracleToEsLoaderJob.java`
- `controller/v4/LoaderAdminControllerV4.java`

`@RequiredArgsConstructor` rewrites — **2 files** (subset of the @Slf4j list):
- `loader/LoaderJobRegistry.java`
- `loader/LoaderTicker.java`

Files moving WITHOUT Lombok touch:
- `loader/DocumentIdHasher.java` — `@Component` only, no Lombok
- All 7 DTOs in `loader/dto/`
- `config/LoaderShedLockConfig.java`, `config/LoaderJdbcConfig.java` — `@Configuration` + `@Profile("!test")` only
- `observability/health/LoaderRunAgeHealthIndicator.java` — extends `AbstractHealthIndicator` with its own logger field
- `dto/v4/LoaderJobSummaryV4.java`, `dto/v4/RunNowConflictResponseV4.java` — pure DTOs

(Run `grep -lE "@(Slf4j|RequiredArgsConstructor)" backend/rectrace/src/main/java/com/citi/gru/rectrace/loader/*.java backend/rectrace/src/main/java/com/citi/gru/rectrace/config/Loader*.java backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/v4/LoaderAdminControllerV4.java` to confirm the actual set before starting.)

- [ ] **Step 1: Copy the 14 files in `loader/` package verbatim**

```bash
mkdir -p rectrace-loader/src/main/java/com/citi/gru/rectrace/loader/dto
cp backend/rectrace/src/main/java/com/citi/gru/rectrace/loader/*.java \
   rectrace-loader/src/main/java/com/citi/gru/rectrace/loader/
cp backend/rectrace/src/main/java/com/citi/gru/rectrace/loader/dto/*.java \
   rectrace-loader/src/main/java/com/citi/gru/rectrace/loader/dto/
```

- [ ] **Step 2: Copy + relocate the 4 cross-package files**

```bash
mkdir -p rectrace-loader/src/main/java/com/citi/gru/rectrace/loader/config
mkdir -p rectrace-loader/src/main/java/com/citi/gru/rectrace/loader/controller
mkdir -p rectrace-loader/src/main/java/com/citi/gru/rectrace/loader/health

cp backend/rectrace/src/main/java/com/citi/gru/rectrace/config/LoaderShedLockConfig.java \
   rectrace-loader/src/main/java/com/citi/gru/rectrace/loader/config/
cp backend/rectrace/src/main/java/com/citi/gru/rectrace/config/LoaderJdbcConfig.java \
   rectrace-loader/src/main/java/com/citi/gru/rectrace/loader/config/
cp backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/v4/LoaderAdminControllerV4.java \
   rectrace-loader/src/main/java/com/citi/gru/rectrace/loader/controller/
cp backend/rectrace/src/main/java/com/citi/gru/rectrace/observability/health/LoaderRunAgeHealthIndicator.java \
   rectrace-loader/src/main/java/com/citi/gru/rectrace/loader/health/
```

- [ ] **Step 3: Copy + relocate the 2 cross-package DTOs into `loader/dto/`**

```bash
cp backend/rectrace/src/main/java/com/citi/gru/rectrace/dto/v4/LoaderJobSummaryV4.java \
   rectrace-loader/src/main/java/com/citi/gru/rectrace/loader/dto/
cp backend/rectrace/src/main/java/com/citi/gru/rectrace/dto/v4/RunNowConflictResponseV4.java \
   rectrace-loader/src/main/java/com/citi/gru/rectrace/loader/dto/
```

- [ ] **Step 4: Fix package declarations in the 4 relocated cross-package files**

For `LoaderShedLockConfig.java` and `LoaderJdbcConfig.java`:
```java
// was
package com.citi.gru.rectrace.config;
// becomes
package com.citi.gru.rectrace.loader.config;
```

For `LoaderAdminControllerV4.java`:
```java
package com.citi.gru.rectrace.loader.controller;
```

For `LoaderRunAgeHealthIndicator.java`:
```java
package com.citi.gru.rectrace.loader.health;
```

For `LoaderJobSummaryV4.java` and `RunNowConflictResponseV4.java`:
```java
// was
package com.citi.gru.rectrace.dto.v4;
// becomes
package com.citi.gru.rectrace.loader.dto;
```

- [ ] **Step 5: Update imports in the 4 cross-package files that referenced sibling `loader.*` classes**

`LoaderShedLockConfig`, `LoaderJdbcConfig`, `LoaderAdminControllerV4`, `LoaderRunAgeHealthIndicator` and the 2 DTOs may import from the old `com.citi.gru.rectrace.config` / `com.citi.gru.rectrace.dto.v4` packages. After the move, ALL loader-internal references resolve under `com.citi.gru.rectrace.loader.*`. Run after each file:

```bash
javac -d /tmp/lcheck -cp "$(cd rectrace-loader && mvn dependency:build-classpath -q -DincludeScope=compile -Dmdep.outputFile=/tmp/cp.txt && cat /tmp/cp.txt)" \
  rectrace-loader/src/main/java/com/citi/gru/rectrace/loader/**/*.java
# Any "cannot find symbol" → resolve by adding the right loader.* import
```

Search-and-replace the old package references in imports across the 6 relocated files:
- `import com.citi.gru.rectrace.config.LoaderShedLockConfig;` → `import com.citi.gru.rectrace.loader.config.LoaderShedLockConfig;`
- `import com.citi.gru.rectrace.config.LoaderJdbcConfig;` → `import com.citi.gru.rectrace.loader.config.LoaderJdbcConfig;`
- `import com.citi.gru.rectrace.dto.v4.LoaderJobSummaryV4;` → `import com.citi.gru.rectrace.loader.dto.LoaderJobSummaryV4;`
- `import com.citi.gru.rectrace.dto.v4.RunNowConflictResponseV4;` → `import com.citi.gru.rectrace.loader.dto.RunNowConflictResponseV4;`

The 14 files in the `loader/` package stay at the same package, so cross-references within them work unchanged.

- [ ] **Step 6: Rewrite `@Slf4j` to manual SLF4J in the 7 Lombok-using files**

For each of the 7 files identified above, find:

```java
import lombok.extern.slf4j.Slf4j;
// ...
@Slf4j
@Component  // or @Service, @Configuration, etc.
public class LoaderTicker {
```

Replace with:

```java
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
// ...
@Component
public class LoaderTicker {
    private static final Logger log = LoggerFactory.getLogger(LoaderTicker.class);
```

**Important**: drop the `lombok.extern.slf4j.Slf4j` import too. The bean stereotype annotation order doesn't matter; just remove the standalone `@Slf4j` line.

- [ ] **Step 7: Rewrite `@RequiredArgsConstructor` to explicit constructors (2 files)**

For `LoaderJobRegistry` and `LoaderTicker`, identify the `final` fields and write an explicit constructor. Example for `LoaderTicker`:

```java
// Before
@RequiredArgsConstructor
public class LoaderTicker {
    private final LoaderJobRegistry registry;
    private final LockingTaskExecutor executor;
    // ...
}

// After
public class LoaderTicker {
    private final LoaderJobRegistry registry;
    private final LockingTaskExecutor executor;
    // ...

    public LoaderTicker(LoaderJobRegistry registry, LockingTaskExecutor executor) {
        this.registry = registry;
        this.executor = executor;
    }
}
```

Drop the `lombok.RequiredArgsConstructor` import.

If a class has `@Autowired` on the constructor (some health indicators do), preserve the `@Autowired` annotation. If a class has `@Autowired(required = false)` fields, leave them as field injection — only rewrite the `@RequiredArgsConstructor` group.

- [ ] **Step 8: Remove the `@ConditionalOnProperty` annotation added in Task 2**

In the NEW loader module (`rectrace-loader/`), the beans are unconditional — the entire module IS the loader. Remove the `@ConditionalOnProperty("rectrace.loader.enabled", ...)` annotation lines and the matching `import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;` from all 10 gated classes (the set from Task 2 Step 2). (Backend keeps them until Phase 4 deletion.)

- [ ] **Step 9: Remove `@Profile("!test")` annotations**

Loader module beans don't need the `!test` gate — they're the only beans in the module, and tests use a separate test slice configuration. Remove every `@Profile("!test")` annotation + the matching `import org.springframework.context.annotation.Profile;` from the loader files in `rectrace-loader/`.

(Slice tests using `@SpringBootTest(properties = "spring.profiles.active=test")` will see the beans as expected.)

- [ ] **Step 10: Copy `loader-config-v4.json`**

```bash
cp backend/rectrace/src/main/resources/loader-config-v4.json \
   rectrace-loader/src/main/resources/loader-config-v4.json
```

- [ ] **Step 11: Wire loader properties in `rectrace-loader/src/main/resources/application.properties`**

Replace the commented `# loader-config.location=...` stub from Task 1 Step 4 with the real value, and add the related keys. Append (or edit):

```properties
# Loader Configuration
loader-config.location=classpath:loader-config-v4.json
```

- [ ] **Step 12: Wire loader properties in `rectrace-loader/src/main/resources/application-local.properties`**

Append:

```properties
# Loader Configuration (Phase 6 / LOADER-01)
loader-config.location=classpath:loader-config-v4.json
```

- [ ] **Step 13: Copy the 7 in-package test files**

```bash
mkdir -p rectrace-loader/src/test/java/com/citi/gru/rectrace/loader
cp backend/rectrace/src/test/java/com/citi/gru/rectrace/loader/*.java \
   rectrace-loader/src/test/java/com/citi/gru/rectrace/loader/
```

- [ ] **Step 14: Copy + relocate the 2 cross-package test files**

```bash
mkdir -p rectrace-loader/src/test/java/com/citi/gru/rectrace/loader/controller
mkdir -p rectrace-loader/src/test/java/com/citi/gru/rectrace/loader/health

cp backend/rectrace/src/test/java/com/citi/gru/rectrace/controller/v4/LoaderAdminControllerV4Test.java \
   rectrace-loader/src/test/java/com/citi/gru/rectrace/loader/controller/
cp backend/rectrace/src/test/java/com/citi/gru/rectrace/observability/health/LoaderRunAgeHealthIndicatorTest.java \
   rectrace-loader/src/test/java/com/citi/gru/rectrace/loader/health/
```

- [ ] **Step 15: Fix package declarations + imports in the 2 relocated test files**

`LoaderAdminControllerV4Test.java`:
```java
package com.citi.gru.rectrace.loader.controller;
```

`LoaderRunAgeHealthIndicatorTest.java`:
```java
package com.citi.gru.rectrace.loader.health;
```

In each, update any imports of `com.citi.gru.rectrace.config.*`, `com.citi.gru.rectrace.dto.v4.LoaderJobSummaryV4` etc. to the new `com.citi.gru.rectrace.loader.*` paths.

- [ ] **Step 16: Re-anchor `@SpringBootTest` to `RectraceLoaderApplication`**

Tests that bootstrap a full Spring context (`LoaderJobLockTest`, `OracleToEsLoaderJobTest`, `LoaderRunHistoryServiceTest`, `LoaderAdminControllerV4Test`, possibly others) may use `@SpringBootTest(classes = ...)` referencing the old backend's main class. Update each to:

```java
import com.citi.gru.rectrace.loader.RectraceLoaderApplication;
// ...
@SpringBootTest(classes = RectraceLoaderApplication.class)
```

If a test uses `@SpringBootTest` without `classes=`, Spring Boot auto-detects the nearest `@SpringBootApplication` — that's `RectraceLoaderApplication` once the test is in the loader module's tree. Leave un-classed `@SpringBootTest` as-is.

- [ ] **Step 17: Update `LoaderPackageStructureTest` for the new package set**

`LoaderPackageStructureTest` likely uses ArchUnit (`com.tngtech.archunit`) assertions like "classes in `com.citi.gru.rectrace.loader` package must follow rule X". The new module's package set is:
- `com.citi.gru.rectrace.loader.*` (7 top-level + 7 dto)
- `com.citi.gru.rectrace.loader.config.*` (2)
- `com.citi.gru.rectrace.loader.controller.*` (1)
- `com.citi.gru.rectrace.loader.health.*` (1)

Update any base-package assertions to match. (Open the file, run `mvn test -Dtest=LoaderPackageStructureTest` to see what fails, then patch.)

If the test currently asserts "loader classes do not depend on classes in `com.citi.gru.rectrace.controller.v4`" or similar, remove or relax those (the controller IS a loader class now). If it asserts "loader-package classes do not import from `com.citi.gru.rectrace.search.*`", that should still hold and is good to keep.

- [ ] **Step 18: Remove the ArchUnit assertion (if any) that gates the OLD package**

If `LoaderPackageStructureTest` had assertions specifically about the backend package layout (`com.citi.gru.rectrace.controller.v4.LoaderAdminControllerV4 must extend BaseControllerV4` or similar), those don't apply in the loader module. Drop them.

- [ ] **Step 19: Run loader module tests**

```bash
cd rectrace-loader && mvn test 2>&1 | tail -30
```

Expected: `BUILD SUCCESS`, total tests = 1 (contextLoads from Task 1) + 9 (moved loader tests) = 10. If any fail, diagnose the compile/import/wiring issue and fix before moving on.

Common likely failures:
- Missing import after the package move → add it.
- `LoaderRunAgeHealthIndicator` has `@Autowired(required = false)` for `LoaderConfigService` + `LoaderRunHistoryService` so it boots in test profile (per the existing comment). In the loader module those beans ARE present (the @Profile gate is gone), so the indicator wires fully. If a test asserted the "not configured" path that won't reach you in the new module — adjust the test to use a Mockito-driven fixture instead.
- Slice tests expecting backend's `server.servlet.context-path=/rectrace` will fail — the loader has no context path. Update test URLs to drop `/rectrace`.

- [ ] **Step 20: Boot the loader on :6089 + run one full ingestion cycle**

```bash
cd rectrace-loader && mvn spring-boot:run -Dspring-boot.run.profiles=local
```

Wait for `Started RectraceLoaderApplication`. In another terminal:

```bash
curl -s http://localhost:6089/api/v4/loader-admin/jobs | python3 -m json.tool
# Expected: [{"key":"rectrace_core_loader","alias":"rectrace_core_alias",...}]

curl -s -X POST http://localhost:6089/api/v4/loader-admin/jobs/rectrace_core_loader/run-now --max-time 60 | python3 -m json.tool
# Expected: a record with "status": "SUCCESS"

curl -s http://localhost:6089/api/v4/loader-admin/jobs/rectrace_core_loader/runs | python3 -m json.tool
# Expected: array with at least the run from above, each record has "jobKey", "startedAt"
```

Verify Oracle row was appended to `loader_run_history`:

```bash
docker exec rectrace-oracle bash -c "echo 'SELECT COUNT(*) FROM rectrace.loader_run_history WHERE job_key = '\''rectrace_core_loader'\'';' | sqlplus -S rectrace/rectrace_pwd@FREEPDB1"
# Expected: a positive count
```

Verify ES alias is populated:

```bash
curl -s "http://localhost:9200/rectrace_core_alias/_count" | python3 -m json.tool
# Expected: {"count": <positive>, ...}
```

Stop the loader (Ctrl+C in the mvn terminal).

- [ ] **Step 21: Commit**

```bash
git add rectrace-loader/
git commit -m "$(cat <<'EOF'
feat(loader): move loader code into rectrace-loader module

Copies 20 main + 9 test files + loader-config-v4.json from backend/rectrace
into rectrace-loader/. Repackages:
  - config/LoaderShedLockConfig.java → loader/config/
  - config/LoaderJdbcConfig.java → loader/config/
  - controller/v4/LoaderAdminControllerV4.java → loader/controller/
  - observability/health/LoaderRunAgeHealthIndicator.java → loader/health/
  - dto/v4/{LoaderJobSummaryV4,RunNowConflictResponseV4}.java → loader/dto/

Strips Lombok per the no-Lombok-in-this-module convention: 7 @Slf4j
classes rewritten to manual SLF4J Logger fields and 2 of those (Ticker,
JobRegistry) also rewritten from @RequiredArgsConstructor to explicit
constructors. Drops the
@ConditionalOnProperty gates added in Phase 2 (beans are unconditional
in their dedicated module) and the @Profile("!test") gates (loader
module IS the loader, no need for the test/non-test split).

Slice tests re-anchored to RectraceLoaderApplication; LoaderPackageStructureTest
package assertions updated for the new loader.* package family.

Verified live: mvn test green; loader boots on :6089; admin endpoints
serve at /api/v4/loader-admin/*; one ingestion cycle completes; ES
alias rectrace_core_alias populated; loader_run_history row appended.

Backend's loader (gated off by Phase 2's rectrace.loader.enabled=false
in local profile) and the new module coexist; ShedLock arbitration
ensures no double-runs. Phase 4 will delete backend's loader code.

Phase 3 of docs/superpowers/plans/2026-05-31-loader-extraction.md.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Task 4: Phase 4 — DELETE LOADER FROM BACKEND

**Goal:** Delete all 20 main + 9 test files + `loader-config-v4.json` from `backend/rectrace`. Remove the `@ConditionalOnProperty` flag + the property. Prune exactly 3 ShedLock deps from `backend/rectrace/pom.xml`. Prune `loader-config.location` key + the deferred-health-group comment from `application*.properties`. Backend remains fully functional as pure read-side API.

**Files:**
- Delete: `backend/rectrace/src/main/java/com/citi/gru/rectrace/loader/` (entire directory, 14 files)
- Delete: `backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/v4/LoaderAdminControllerV4.java`
- Delete: `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/LoaderShedLockConfig.java`
- Delete: `backend/rectrace/src/main/java/com/citi/gru/rectrace/config/LoaderJdbcConfig.java`
- Delete: `backend/rectrace/src/main/java/com/citi/gru/rectrace/dto/v4/LoaderJobSummaryV4.java`
- Delete: `backend/rectrace/src/main/java/com/citi/gru/rectrace/dto/v4/RunNowConflictResponseV4.java`
- Delete: `backend/rectrace/src/main/java/com/citi/gru/rectrace/observability/health/LoaderRunAgeHealthIndicator.java`
- Delete: `backend/rectrace/src/main/resources/loader-config-v4.json`
- Delete: `backend/rectrace/src/test/java/com/citi/gru/rectrace/loader/` (entire directory, 7 files)
- Delete: `backend/rectrace/src/test/java/com/citi/gru/rectrace/controller/v4/LoaderAdminControllerV4Test.java`
- Delete: `backend/rectrace/src/test/java/com/citi/gru/rectrace/observability/health/LoaderRunAgeHealthIndicatorTest.java`
- Modify: `backend/rectrace/pom.xml` (remove 3 ShedLock deps)
- Modify: `backend/rectrace/src/main/resources/application.properties` (remove `loader-config.location` line + lines 64-68 comment)
- Modify: `backend/rectrace/src/main/resources/application-local.properties` (remove `loader-config.location` line + the `rectrace.loader.enabled=false` line added in Task 2)

- [ ] **Step 1: Pre-flight — confirm no non-loader code references the loader classes**

```bash
grep -rln "LoaderTicker\|LoaderJobRegistry\|LoaderConfigService\|LoaderRunHistoryService\|LoaderBulkListener\|OracleToEsLoaderJob\|DocumentIdHasher\|LoaderShedLockConfig\|LoaderJdbcConfig\|LoaderAdminController\|LoaderRunAgeHealthIndicator\|LoaderJobSummaryV4\|RunNowConflictResponseV4" \
  backend/rectrace/src/main/java --include="*.java" | \
  grep -v "/loader/" | grep -v "/config/Loader" | grep -v "/controller/v4/LoaderAdminControllerV4" | \
  grep -v "/dto/v4/LoaderJobSummaryV4" | grep -v "/dto/v4/RunNowConflictResponseV4" | \
  grep -v "/observability/health/LoaderRunAgeHealthIndicator"
```

Expected: empty output (no non-loader file references loader classes). If anything shows up, investigate before deleting.

- [ ] **Step 2: Delete loader package + relocated files**

```bash
rm -rf backend/rectrace/src/main/java/com/citi/gru/rectrace/loader
rm backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/v4/LoaderAdminControllerV4.java
rm backend/rectrace/src/main/java/com/citi/gru/rectrace/config/LoaderShedLockConfig.java
rm backend/rectrace/src/main/java/com/citi/gru/rectrace/config/LoaderJdbcConfig.java
rm backend/rectrace/src/main/java/com/citi/gru/rectrace/dto/v4/LoaderJobSummaryV4.java
rm backend/rectrace/src/main/java/com/citi/gru/rectrace/dto/v4/RunNowConflictResponseV4.java
rm backend/rectrace/src/main/java/com/citi/gru/rectrace/observability/health/LoaderRunAgeHealthIndicator.java
rm backend/rectrace/src/main/resources/loader-config-v4.json
```

- [ ] **Step 3: Delete loader tests**

```bash
rm -rf backend/rectrace/src/test/java/com/citi/gru/rectrace/loader
rm backend/rectrace/src/test/java/com/citi/gru/rectrace/controller/v4/LoaderAdminControllerV4Test.java
rm backend/rectrace/src/test/java/com/citi/gru/rectrace/observability/health/LoaderRunAgeHealthIndicatorTest.java
```

- [ ] **Step 4: Prune ShedLock deps from `backend/rectrace/pom.xml`**

Find and delete these exact dependency blocks (use `Edit` with surrounding context for uniqueness):

```xml
<!-- Phase 6 / LOADER-02: ShedLock 7.7.0 for @Scheduled mutual exclusion. -->
<dependency>
    <groupId>net.javacrumbs.shedlock</groupId>
    <artifactId>shedlock-spring</artifactId>
    <version>7.7.0</version>
</dependency>
```

```xml
<dependency>
    <groupId>net.javacrumbs.shedlock</groupId>
    <artifactId>shedlock-provider-jdbc-template</artifactId>
    <version>7.7.0</version>
</dependency>
```

```xml
<!-- Phase 6 / Plan 06-04: in-memory LockProvider for ShedLock tests so the
     ShedLock-aware @SpringBootTest slices don't need a real lock table. -->
<dependency>
    <groupId>net.javacrumbs.shedlock</groupId>
    <artifactId>shedlock-provider-inmemory</artifactId>
    <version>7.7.0</version>
    <scope>test</scope>
</dependency>
```

Run `grep -n "shedlock" backend/rectrace/pom.xml` after — expected: empty output.

**Do NOT prune**: `spring-boot-starter-data-elasticsearch`, `co.elastic.clients:elasticsearch-java`, `micrometer-*`, `spring-boot-starter-aop`, `spring-boot-starter-scheduling` (if explicitly present — usually transitive via -web). Backend's search + observability still needs all of them.

- [ ] **Step 5: Prune `loader-config.location` + the deferred-health-group comment from `application.properties`**

Edit `backend/rectrace/src/main/resources/application.properties`:

Delete line 24-25:
```properties
# Loader Configuration (Phase 6 / LOADER-01)
loader-config.location=classpath:loader-config-v4.json
```

Delete lines 64-69 (the 6-line comment block about the deferred loader health group):
```properties
# Phase 7 — loader run-age health group (Pitfall P-11 / D-7.12) is DEFERRED to
# Plan 07-03. Boot validates HealthEndpointGroup membership at startup and
# fails with NoSuchHealthContributorException if a referenced contributor is
# absent. Plan 07-03 declares both the LoaderRunAgeHealthIndicator @Component
# AND the `management.endpoint.health.group.loader.include=loaderRunAge`
# line in the same commit so neither side ever sees a dangling reference.
```

- [ ] **Step 6: Prune `loader-config.location` + the Phase-2 flag from `application-local.properties`**

Edit `backend/rectrace/src/main/resources/application-local.properties`:

Delete line 40-41:
```properties
# Loader Configuration (Phase 6 / LOADER-01)
loader-config.location=classpath:loader-config-v4.json
```

Delete the Phase-2 flag block added in Task 2 Step 3:
```properties

# Phase 2 / Loader extraction: gate the in-backend loader OFF in the local profile.
# The rectrace-loader module owns the loader subsystem on :6089 starting in Phase 3.
# Phase 4 removes this property entirely along with the loader code.
rectrace.loader.enabled=false
```

- [ ] **Step 7: Run backend mvn test — verify nothing broken**

```bash
cd backend/rectrace && mvn test 2>&1 | tail -30
```

Expected: `BUILD SUCCESS`. Any compile errors will be a leftover reference to a deleted class — fix by removing the reference (it must be in a non-loader file that imported a loader class without our pre-flight catching it).

- [ ] **Step 8: Restart backend on local profile**

```bash
JVM_PID=$(lsof -nP -iTCP:6088 -sTCP:LISTEN -t 2>/dev/null)
./ops/rectrace-ops.sh stop backend
[ -n "$JVM_PID" ] && kill -TERM $JVM_PID 2>/dev/null
sleep 3
./ops/rectrace-ops.sh start backend
until curl -fs http://localhost:6088/rectrace/actuator/health >/dev/null 2>&1; do sleep 6; done && echo "backend up"
```

- [ ] **Step 9: Verify backend is clean of loader**

```bash
# Search endpoints work
curl -s -o /dev/null -w "search/config → %{http_code}\n" http://localhost:6088/rectrace/api/v4/search/config
# Expected: 200

curl -s "http://localhost:6088/rectrace/api/v4/search/initial?keyword=tlm" | \
  python3 -c 'import sys,json; d=json.load(sys.stdin); print("hit categories:", [k for k,v in d.get("categoryResults",{}).items() if v.get("count",0)>0])'
# Expected: includes tlmInstance

# Loader admin endpoint is GONE entirely (not just disabled)
curl -s -o /dev/null -w "loader-admin/jobs → %{http_code}\n" http://localhost:6088/rectrace/api/v4/loader-admin/jobs
# Expected: 404

# Backend log clean of loader references
grep -ci "Loader" logs/backend.log | tail -1
# Expected: low number — only old lines from before the restart, no new ones
```

- [ ] **Step 10: Playwright sanity — search + cell-click modal still work**

(If working in the foreground, run this once via Playwright MCP or the existing E2E spec. Otherwise, manual verification.)

Open `http://localhost:5173/search?q=tlm` → see TLM Instance tab with hits. Expand TLMP_CONSUMER group → click a recon cell → RecViz modal opens with TLM Statistics. No regressions.

- [ ] **Step 11: Commit**

```bash
git add backend/rectrace
git commit -m "$(cat <<'EOF'
feat(loader): delete loader subsystem from backend/rectrace

Removes 20 main + 9 test files + loader-config-v4.json from
backend/rectrace. Prunes 3 ShedLock deps (shedlock-spring,
shedlock-provider-jdbc-template, shedlock-provider-inmemory) from
backend's pom.xml. Prunes the loader-config.location key (1 line in
application.properties + 1 line in application-local.properties) and
the 6-line deferred-health-group comment block from
application.properties. Drops the rectrace.loader.enabled=false flag
added by Phase 2 — backend no longer carries loader code.

Backend is now pure read-side API: search config + /initial + /ssrm,
cell-renderer support data, observability, security. Loader code lives
exclusively in rectrace-loader (Phase 3).

Verified live: backend mvn test green; backend boots clean on :6088
without any Loader* lines in startup log; search end-to-end works;
RecViz cell-click modal unchanged.

Phase 4 of docs/superpowers/plans/2026-05-31-loader-extraction.md.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Task 5: Phase 5 — OPS WIRING

**Goal:** Add `rectrace-loader` as a managed component in `ops/components.sh` mirroring the tlm-stats entry. Verify all `ops/rectrace-ops.sh` subcommands (`start`, `stop`, `status`, `logs`, `start all`) work for the new component. Run `ops/ci-smoke.sh` to verify Bash 3.2 portability.

**Files:**
- Modify: `ops/components.sh` (add 1 line to `REGISTRY` array)

- [ ] **Step 1: Add the loader entry to `REGISTRY` in `ops/components.sh`**

Find the existing `REGISTRY=(` block in `ops/components.sh` and add the loader line BETWEEN `tlm-stats` and `react` (order matters per the `start all` rationale comment in the file):

```bash
REGISTRY=(
  "backend|6088|run/backend.pid|logs/backend.log|http://localhost:6088/rectrace/actuator/health|-|mvn spring-boot:run -f backend/rectrace/pom.xml -Dspring-boot.run.profiles=local"
  "tlm-stats|8080|run/tlmstats.pid|logs/tlmstats.log|http://localhost:8080/actuator/health|-|mvn spring-boot:run -f rectrace-tlm-stats/pom.xml -Dspring-boot.run.profiles=local"
  "loader|6089|run/loader.pid|logs/loader.log|http://localhost:6089/actuator/health|-|mvn spring-boot:run -f rectrace-loader/pom.xml -Dspring-boot.run.profiles=local"
  "react|5173|run/react.pid|logs/react.log|http://localhost:5173/|frontend-react|$REACT_START_CMD"
)
```

**Naming**: the component name is `loader` (not `rectrace-loader`) — matches the existing convention where `backend` ≠ "rectrace-backend" and `tlm-stats` ≠ "rectrace-tlm-stats". The literal artifact name `rectrace-loader` is only used in the `-f rectrace-loader/pom.xml` path.

- [ ] **Step 2: Verify `registry_names` lists the new component**

```bash
bash -c 'source ops/components.sh && registry_names'
```

Expected output (4 lines):
```
backend
tlm-stats
loader
react
```

- [ ] **Step 3: Verify `registry_lookup loader` returns the new entry**

```bash
bash -c 'source ops/components.sh && registry_lookup loader'
```

Expected: the loader entry line in full.

- [ ] **Step 4: Run `ops/ci-smoke.sh` for Bash 3.2 portability + shellcheck**

```bash
./ops/ci-smoke.sh 2>&1 | tail -20
```

Expected: PASS. If shellcheck flags anything in `components.sh` from the new line, fix and re-run. Specifically watch for:
- Quoting issues with `mvn spring-boot:run -f rectrace-loader/pom.xml -Dspring-boot.run.profiles=local` (the string is single-`|`-delimited, no internal quotes needed because the field is `eval`'d later — match the tlm-stats line exactly).

- [ ] **Step 5: Test `ops/rectrace-ops.sh start loader`**

If a previous run of `mvn spring-boot:run` in `rectrace-loader/` is still active, kill it first:

```bash
JVM_PID=$(lsof -nP -iTCP:6089 -sTCP:LISTEN -t 2>/dev/null)
[ -n "$JVM_PID" ] && kill -TERM $JVM_PID 2>/dev/null
sleep 3
lsof -nP -iTCP:6089 -sTCP:LISTEN 2>/dev/null || echo "no listener on :6089"
```

Then:
```bash
./ops/rectrace-ops.sh start loader
```

Expected output: `Starting loader ...`, `loader: started (pid <N>). Log: <repo>/logs/loader.log`, `Waiting for loader at http://localhost:6089/actuator/health (timeout 30s) ...`. Spring Boot first-boot can exceed 30s; wait up to 90s:

```bash
until curl -fs http://localhost:6089/actuator/health >/dev/null 2>&1; do sleep 6; done && echo "loader up"
```

- [ ] **Step 6: Test `status`, `logs`, `stop`**

```bash
./ops/rectrace-ops.sh status loader
# Expected: loader RUNNING (pid N) port 6089

./ops/rectrace-ops.sh logs loader 2>&1 | head -5
# Expected: tail of logs/loader.log starting

# Ctrl+C the logs tail
./ops/rectrace-ops.sh stop loader
# Expected: loader: stopped

# Verify :6089 free
lsof -nP -iTCP:6089 -sTCP:LISTEN 2>/dev/null || echo "no listener on :6089"
```

- [ ] **Step 7: Test `start all` brings up everything healthy**

```bash
./ops/rectrace-ops.sh stop all 2>&1 | tail -5
./ops/rectrace-ops.sh start all 2>&1 | tail -20
```

Expected: each of `backend`, `tlm-stats`, `loader`, `react` reports `started (pid N)` and `ready`. Some may time out at the 30s gate but recover in the background — verify with a wait loop:

```bash
for port in 6088 6089 8080 5173; do
  until curl -fs http://localhost:$port/ >/dev/null 2>&1 || curl -fs http://localhost:$port/actuator/health >/dev/null 2>&1 || curl -fs http://localhost:$port/rectrace/actuator/health >/dev/null 2>&1; do
    sleep 5
  done
  echo ":$port up"
done
```

Expected: 4 lines of `:<port> up`.

- [ ] **Step 8: Commit**

```bash
git add ops/components.sh
git commit -m "$(cat <<'EOF'
feat(loader): register rectrace-loader in ops/components.sh

Adds the loader component to the REGISTRY array between tlm-stats and
react. Port 6089, pid_file run/loader.pid, log_file logs/loader.log,
health http://localhost:6089/actuator/health, command
mvn spring-boot:run -f rectrace-loader/pom.xml -Dspring-boot.run.profiles=local.

Verified ops/rectrace-ops.sh subcommands (start, stop, status, logs,
start all) all work for `loader`. ops/ci-smoke.sh PASS — no Bash 3.2
portability regressions.

Phase 5 of docs/superpowers/plans/2026-05-31-loader-extraction.md.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Task 6: Phase 6 — SMOKE + DOCS

**Goal:** Re-point `scripts/smoke-loader-admin.sh` and `scripts/smoke-loader-sigterm.sh` from `:6088/rectrace` to `:6089`. Update `CLAUDE.md` to reflect the new module landscape. Run both smoke scripts end-to-end.

**Files:**
- Modify: `scripts/smoke-loader-admin.sh` (change `BASE_URL` default)
- Modify: `scripts/smoke-loader-sigterm.sh` (change loader URL/port references)
- Modify: `CLAUDE.md` (module table + sections)

- [ ] **Step 1: Update `scripts/smoke-loader-admin.sh`**

Find line 23:
```bash
BASE_URL="${BASE_URL:-http://localhost:6088/rectrace}"
```

Replace with:
```bash
BASE_URL="${BASE_URL:-http://localhost:6089}"
```

Update the "Prerequisites" comment block (around line 16-17) to reference the loader module instead of backend:

```bash
# Prerequisites:
#   - Docker stack up: cd ../rectrace-local-dev && docker compose up -d
#   - Seed applied:   cd ../rectrace-local-dev && .venv/bin/python apply.py
#   - Loader running on :6089 (ops script): ./ops/rectrace-ops.sh start loader
```

- [ ] **Step 2: Update `scripts/smoke-loader-sigterm.sh`**

Open the file and find every reference to `:6088`, `/rectrace`, `backend` (in URL contexts), and update to `:6089` with no `/rectrace` prefix and `loader` instead of `backend`.

```bash
grep -nE "6088|/rectrace|backend" scripts/smoke-loader-sigterm.sh
```

Update each occurrence. The general patterns:
- `http://localhost:6088/rectrace/api/v4/loader-admin/...` → `http://localhost:6089/api/v4/loader-admin/...`
- `./ops/rectrace-ops.sh start backend` → `./ops/rectrace-ops.sh start loader`
- `lsof -iTCP:6088` (if the script kills the backend listener) → `lsof -iTCP:6089`
- Pid file `run/backend.pid` → `run/loader.pid`
- Log file `logs/backend.log` → `logs/loader.log`

- [ ] **Step 3: Update `CLAUDE.md` module table**

Open `CLAUDE.md`. Find the module table near the top (starts with `| Module | Stack | Port (dev) | Status |`). Add the loader row between `rectrace-tlm-stats` and `frontend/rectrace`:

```markdown
| Module | Stack | Port (dev) | Status |
|---|---|---|---|
| `backend/rectrace` | Spring Boot 3.5.14, Java 21, jakarta | 6088 | Active |
| `rectrace-tlm-stats` | Spring Boot 3.5.14, Java 21 | 8080 | Active |
| `rectrace-loader` | Spring Boot 3.5.14, Java 21 (no Lombok) | 6089 | Active |
| `frontend/rectrace` | Angular 18.2.14, AG-Grid 32, RxJS | 4200 | Legacy — frozen, replaced incrementally |
| `frontend-react` | Vite 7 + React 19 + shadcn (Tailwind v4) + AG-Grid 35 + TanStack | 5173 | Net-new vertical-slice port |
```

- [ ] **Step 4: Update `CLAUDE.md` Essential Commands section**

Add a new sub-section after the `### TLM Stats Service` sub-section (likely around line 90):

```markdown
### Loader Service
` ` ` bash
cd rectrace-loader
mvn spring-boot:run -Dspring-boot.run.profiles=local
` ` `
Boots on `http://localhost:6089`. Owns the ES Loader subsystem (ShedLock-coordinated ticker + admin endpoints at `/api/v4/loader-admin/*`). Backend (`backend/rectrace`) no longer carries any loader code as of Phase 4 of the loader-extraction work.
```

(Use real triple backticks; the spaces above are to keep this plan file's fences from terminating early.)

- [ ] **Step 5: Trim backend description in CLAUDE.md "Architecture & Key Patterns"**

Open `CLAUDE.md`. Find the `### Backend` sub-section under `## Architecture & Key Patterns`. Find and DELETE the loader-related bullet:

```markdown
- **Loader subsystem** uses ShedLock 7.7.0 + `@Scheduled` + ES BulkIngester writing to aliases, with run-history and admin endpoints at `/api/v4/loader-admin`.
```

Add a new bullet at the same level documenting the loader as a separate module:

```markdown
- **Loader subsystem extracted to `rectrace-loader/`** (Boot 3.5.14, port 6089). Backend has zero loader awareness as of 2026-05-31 loader-extraction work — see `docs/superpowers/specs/2026-05-31-loader-extraction-design.md`.
```

- [ ] **Step 6: Update the loader smoke-scripts mention in CLAUDE.md**

Under `### Smoke Scripts` find:
```markdown
- `smoke-loader-{admin,alias,sigterm}.sh` — Phase 6 loader paths
```

(If the entry mentions specific ports/hosts, update them. If it just says "Phase 6 loader paths", append):
```markdown
- `smoke-loader-{admin,alias,sigterm}.sh` — Phase 6 loader paths (post-extraction: targets `:6089`, no context path)
```

- [ ] **Step 7: Ensure all services are running for the smoke scripts**

```bash
./ops/rectrace-ops.sh status loader
# If not running:
./ops/rectrace-ops.sh start loader
until curl -fs http://localhost:6089/actuator/health >/dev/null 2>&1; do sleep 6; done
```

Verify the ES alias + Oracle table are populated by triggering a one-off ingestion:

```bash
curl -s -X POST http://localhost:6089/api/v4/loader-admin/jobs/rectrace_core_loader/run-now --max-time 60 | python3 -m json.tool
# Expected: a SUCCESS record
```

- [ ] **Step 8: Run `scripts/smoke-loader-admin.sh`**

```bash
./scripts/smoke-loader-admin.sh
```

Expected last line: `PASS: loader admin smoke green`. If FAIL, the script will print the failing assertion + URL it tried — fix and re-run.

- [ ] **Step 9: Run `scripts/smoke-loader-sigterm.sh`**

```bash
./scripts/smoke-loader-sigterm.sh
```

Expected: PASS. (This script stops + restarts the loader to verify graceful shutdown + ShedLock release.)

- [ ] **Step 10: Final cross-module smoke — verify everything still healthy**

```bash
printf "backend  :6088 → "; curl -s -o /dev/null -w "%{http_code}\n" http://localhost:6088/rectrace/actuator/health
printf "tlm-stats:8080 → "; curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/actuator/health
printf "loader   :6089 → "; curl -s -o /dev/null -w "%{http_code}\n" http://localhost:6089/actuator/health
printf "react    :5173 → "; curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/
printf "recviz   :8000 → "; curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/health
```

Expected: all 200. (Backend health may report DOWN if there's an unrelated pre-existing issue — that's fine as long as `/api/v4/search/config` returns 200.)

- [ ] **Step 11: Commit**

```bash
git add scripts/smoke-loader-admin.sh scripts/smoke-loader-sigterm.sh CLAUDE.md
git commit -m "$(cat <<'EOF'
docs+smoke(loader): repoint smoke scripts + CLAUDE.md to rectrace-loader

scripts/smoke-loader-admin.sh: BASE_URL default flips from
http://localhost:6088/rectrace to http://localhost:6089; prerequisites
comment updated to reference `./ops/rectrace-ops.sh start loader`.

scripts/smoke-loader-sigterm.sh: every :6088/rectrace URL, backend pid/log
path, and `start backend` invocation now targets :6089 / run/loader.pid /
logs/loader.log / `start loader`.

CLAUDE.md: adds rectrace-loader to the module table (Boot 3.5.14, port
6089, Active); adds an Essential Commands sub-section for the loader;
trims the "Loader subsystem" bullet under Architecture & Key Patterns
to a one-liner pointing at the extraction spec; updates the smoke-
scripts mention to reflect the new port + no-context-path posture.

Verified live: both smoke scripts PASS against :6089; all 5 services
healthy in cross-module smoke.

Phase 6 (final) of docs/superpowers/plans/2026-05-31-loader-extraction.md.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Final Acceptance Checklist

After all 6 tasks ship:

- [ ] `ops/rectrace-ops.sh start all` brings up 4 services (backend `:6088`, tlm-stats `:8080`, loader `:6089`, react `:5173`) all healthy.
- [ ] `scripts/smoke-loader-admin.sh` PASS against `:6089`.
- [ ] `scripts/smoke-loader-sigterm.sh` PASS (graceful shutdown + ShedLock release).
- [ ] `cd ../rectrace-local-dev && .venv/bin/python apply.py --volume 100` re-seeds cleanly; loader picks up the seed; backend `?q=tlm` returns expected rows.
- [ ] `grep -ri "Loader" backend/rectrace/src/main` is empty (no leftover loader references in backend source).
- [ ] `grep -i "shedlock" backend/rectrace/pom.xml` is empty.
- [ ] Backend boot log (after a clean restart) has zero `Loader*` lines after `Started RectraceApplication`.
- [ ] `cd backend/rectrace && mvn test` green.
- [ ] `cd rectrace-loader && mvn test` green.
- [ ] React E2E smoke (Playwright): search `tlm` → tab bar → cell-click → RecViz modal opens normally.

## Rollback

If anything post-merge surfaces:

- **Phase 6 issues only**: `git revert` the Phase 6 commit. Smoke scripts revert to backend paths (but loader is on :6089, so they'll fail until you fix smoke scripts manually). Low-stakes — docs/smoke only.
- **Phase 5 issues only**: `git revert` the Phase 5 commit. `ops/rectrace-ops.sh` no longer manages loader; you fall back to `cd rectrace-loader && mvn spring-boot:run -Dspring-boot.run.profiles=local`. Smoke scripts still work since they don't depend on the ops registry.
- **Phase 4 issues** (backend broken after delete): `git revert` Phase 4 commit. Backend's loader code is restored + the `rectrace.loader.enabled` flag is back at `false` in local profile → backend boots, loader silent in backend. The rectrace-loader module is still running on :6089 — no service interruption.
- **Phase 3 issues** (loader module broken): leave Phase 3 commit but disable the loader module via `./ops/rectrace-ops.sh stop loader`. Flip `rectrace.loader.enabled=true` back in backend's local profile → backend's in-process loader resumes.
- **Phase 1/2 issues**: `git revert` independently; both are additive-only and cleanly reversible.

Full rollback path (worst case): revert Phases 4-6, set `rectrace.loader.enabled=true` in `backend/rectrace/src/main/resources/application-local.properties`, restart backend → original behavior restored within ~2 minutes.
