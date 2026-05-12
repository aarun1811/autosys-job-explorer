# Pitfalls Research

**Domain:** Enterprise Angular→React (net-new) migration + Spring Boot extensions on a Citi VM, with ES/Oracle search, iframe micro-frontend, config-driven SQL, scheduled ingest, observability, and Citi-domain auth.
**Researched:** 2026-05-12
**Confidence:** HIGH for items grounded in the existing codebase (`CONCERNS.md` already documents many root causes); MEDIUM for items dependent on the still-undecided observability/auth stack.

---

## Critical Pitfalls

### Pitfall 1: React app reaches "looks ready" without Angular feature parity, and Angular silently becomes the production path forever

**What goes wrong:**
The React app ships a beautiful search screen, an executive demo happens, but the Angular app still owns: V5 quick-rec popovers, recon ID renderer, TLM stats v2 modal, execution-order graph with status legend, group expansion via SSRM, AG-Grid enterprise filters, copy-to-clipboard cell semantics, dark mode forms, and a dozen edge-case renderer keys referenced in `search-config.json`. Users keep being routed to Angular for "just this one screen," nobody decommissions it, and the team now maintains two SPAs indefinitely.

**Why it happens:**
- Net-new builds chase greenfield novelty (shadcn theming, Vite DX) and underestimate the long tail of behaviors encoded in 6+ years of Angular components.
- `search-config.json` is the actual contract; nobody enumerates every `cellRenderer` string key the JSON references before starting the React build.
- AG-Grid Enterprise behaviors (server-side row model, group expansion, master/detail, status bar, set filters) are 1-line in Angular but require careful state plumbing in React.

**How to avoid:**
1. Before any React code, produce a **parity matrix**: every category in `search-config.json` × every `cellRenderer` / `cellEditor` / modal it references × the V5 grid behaviors it depends on. Mark each cell as `port | drop | replace-with-recviz-iframe`.
2. Designate the React app as **the** UI from day one — give it a different URL path (`/v6/`) and gate Angular behind a "legacy" toggle so it visibly degrades to second-class.
3. Define a **decommission date** for the Angular app as a roadmap milestone, not a vibe. Tie it to the parity matrix being 100% green.
4. Port the **latest** flows only (per PROJECT.md). Anything older than V5/V4 is `drop`, not `port` — write the deprecation note in the matrix.

**Warning signs:**
- "We'll figure out the renderer mapping later" appears in any planning doc.
- The React `cellRenderer` registry is shorter than the union of strings referenced in `search-config.json`.
- Engineers say "just use the Angular one for that screen."
- No date attached to Angular shutdown.

**Phase to address:**
React-foundations phase (planning sub-step) — the parity matrix is a Phase-0 artifact, not a Phase-N retrospective.

---

### Pitfall 2: shadcn design tokens diverge from recviz and become un-undoable

**What goes wrong:**
shadcn is a copy-paste-into-your-repo library, not a versioned dependency. Engineers tweak `button.tsx`, override Tailwind tokens inline, hand-pick colors that "look close enough" to recviz, and three months later the React app and the embedded recviz iframe look like two different products with subtly clashing primaries, different focus rings, off-by-2px paddings, and mismatched dark-mode contrast. There is no upgrade path because every component has been edited.

**Why it happens:**
- shadcn's value prop ("you own the code") is also its trap — no automated drift detection between your fork and upstream.
- Designers iterate on individual screens; tokens are an afterthought.
- recviz's design tokens are not extracted as a shared package — they live in recviz's repo.
- Dark mode is bolted on per component instead of token-driven.

**How to avoid:**
1. **Extract a tokens layer first.** Before touching components, define `colors`, `radius`, `spacing`, `typography`, `motion` as CSS variables (or a single Tailwind preset) sourced from recviz. Document them in one file.
2. **No component-level color literals.** Lint rule (ESLint `no-restricted-syntax` on hex/`rgb(`) or Stylelint with `color-no-hex` enforces token-only colors.
3. **Snapshot shadcn registry version** — record the commit hash / CLI version used to scaffold each component. Add a script that diffs your components against that hash so upgrades are reviewable.
4. **Dark mode is a token swap, not a component rewrite.** Define every color twice in the tokens file (`--bg-default` in `:root` and `.dark`), then components reference variables only.
5. **Visual regression on the recviz↔React boundary** — at least one Playwright/Chromatic test that screenshots the new app embedding a recviz iframe and confirms button/heading/form-field primitives are within tolerance.

**Warning signs:**
- A hex code appears in a `.tsx` file.
- A dark-mode bug is "fix this one component" instead of "fix the token."
- recviz and the React app open side-by-side and the primaries don't match.
- No file named `tokens.css` / `theme.ts` is the single source of truth.

**Phase to address:**
Design-system phase (DESIGN-SHADCN) — must precede any production screen.

---

### Pitfall 3: iframe embedding of recviz breaks in production due to cookies, CSP, and double auth

**What goes wrong:**
recviz embeds fine on `localhost` but in production:
- The Citi portal sets session cookies with `SameSite=Lax` (or `Strict`); the iframe is treated as a third-party context and ships no cookies, so recviz prompts for auth again inside the iframe.
- The portal sends `Content-Security-Policy: frame-ancestors 'self'` or `X-Frame-Options: DENY` on recviz responses, and the iframe renders as a blank white box.
- A SiteMinder / SPNEGO challenge inside the iframe pops a browser auth dialog that the user can't satisfy (Kerberos works for the parent, not the embedded child).
- `postMessage` calls from the iframe to the parent (or vice versa) use `targetOrigin: '*'` and either silently fail when blocked by enterprise security tools, or expose the channel to any embedding origin.

**Why it happens:**
- iframe behavior depends on three independent layers (cookie attributes, CSP/XFO headers, SSO challenge flow) that all "work" in isolation and conspire only in production.
- Developers assume "same Citi network" = "same origin" — it doesn't, browsers care about scheme+host+port.
- recviz's CSP/XFO is controlled by recviz's team, not yours.
- `targetOrigin: '*'` looks fine and is the default-ish example in MDN.

**How to avoid:**
1. **Build a contract with recviz's team** before writing iframe code. Confirm:
   - recviz will set `Content-Security-Policy: frame-ancestors <your-portal-origin>;` and **remove** `X-Frame-Options: DENY`.
   - recviz's auth cookies use `SameSite=None; Secure` if it must be cross-site, or the apps share a parent domain (`*.citi.net`) and use `SameSite=Lax` with same-site cookies.
   - SSO entry is satisfied at the portal layer (single SiteMinder/SPNEGO challenge for both apps) — recviz must not trigger an independent challenge inside the iframe.
2. **Always pin `postMessage` `targetOrigin` to the literal recviz origin.** Receiving side validates `event.origin === RECVIZ_ORIGIN` before reading data. Write a single `postMessageBus.ts` that wraps `window.postMessage` and refuses `'*'`.
3. **Sandbox the iframe** with `sandbox="allow-scripts allow-same-origin allow-forms"` (drop `allow-same-origin` if recviz really is cross-origin — then it can't share cookies anyway).
4. **End-to-end smoke test in UAT** (which is the closest thing to prod) that opens a tab with a recviz iframe, logs in once, and asserts no second auth challenge fires.
5. **Build a "recviz health check" panel** in the new app that probes the iframe URL with `fetch(url, { credentials: 'include', mode: 'cors' })` and reports the CSP, XFO, and cookie status before the user even tries to embed.

**Warning signs:**
- A blank white iframe in any non-localhost environment.
- A browser-native auth dialog inside the iframe.
- `event.origin` is not checked in any `message` listener.
- `targetOrigin: '*'` anywhere in code review.
- The two apps are on different parent domains and nobody has agreed on a cookie strategy.

**Phase to address:**
RECVIZ-INTEGRATION phase — block on a written contract with recviz's team before implementation. Add a UAT smoke test as exit criterion.

---

### Pitfall 4: The hyphen search bug "fix" requires a full reindex and stalls for two weeks

**What goes wrong:**
You identify the cause (standard analyzer splits `ABC-123` into `ABC` and `123`) and change the index mapping to use a `keyword` field or a custom analyzer. ES rejects the mapping update because **analyzer changes on existing fields are not supported** — you have to create a new index, reindex everything, and swap aliases. The Oracle→ES loader is mid-flight, the swap happens at a bad time, partial duplicates appear, and live users see stale results for hours. Worse: the loader writes to the *new* index but read clients still point at the old alias.

**Why it happens:**
- ES analyzer/normalizer changes on existing fields are immutable; people only learn this when they try.
- Reindex is treated as "just rerun the loader" without accounting for delta windows during the swap.
- No alias indirection from day one — read clients hardcode index names.
- The fix is "add a `.keyword` subfield" but search code keeps querying the analyzed parent field.

**How to avoid:**
1. **Diagnose first, don't reindex yet.** Use `GET <index>/_analyze {"analyzer":"...", "text":"ABC-123"}` to confirm the tokenization. Compare against `keyword` and `simple` analyzers, and a custom analyzer using `whitespace` tokenizer + lowercase filter, or `pattern` tokenizer with a pattern that preserves `-`.
2. **Prefer multi-field over re-analyze.** Add a `.keyword` (or `.exact`) subfield to the existing mapping — this **is** allowed on an existing index in most cases (new sub-field, no data rewrite needed for new docs; for existing docs you `_update_by_query` to populate). Update the query DSL to search the new subfield for exact-match cases (hyphenated IDs).
3. **If a true reindex is needed**, do it via alias indirection:
   - Create `index_v2` with the new mapping.
   - `_reindex` from `index_v1` to `index_v2`.
   - Pause the loader, run a final delta, atomically swap alias `index_alias` from `v1`→`v2` in one `_aliases` POST.
   - Keep `v1` around for 1–2 days as rollback.
4. **Add a unit/integration test** that asserts `ABC-123` is found by exact query before merging any analyzer change.
5. **Wire the loader to write through an alias**, never a literal index name.

**Warning signs:**
- The phrase "we'll just reindex everything" with no swap plan.
- Index names hardcoded in `application.properties` instead of an alias.
- No `_analyze` exploration in the bug investigation thread.
- The fix is tested only with `ABC-123` and not with edge cases (`ABC-123-XYZ`, leading hyphen, all-numeric with hyphen).

**Phase to address:**
SEARCH-BUG-HYPHEN phase — first task is the `_analyze` diagnostic, second is alias indirection (regardless of whether reindex ends up being needed).

---

### Pitfall 5: "SELECT-only" config queries still cause data loss, runaway scans, or privilege escalation

**What goes wrong:**
The team adds a feature where a tab in `search-config.json` can specify an arbitrary `SELECT` query. The "safety" is a regex like `query.toLowerCase().startsWith("select")`. Then:
- A query says `SELECT * FROM ( DELETE FROM ... RETURNING * )` — Oracle doesn't support that exactly, but `MERGE`, `UPDATE ... RETURNING`, anonymous PL/SQL blocks (`BEGIN ... END;`), or chained statements via `;` slip past the regex.
- A query has no `WHERE` clause and triggers a full-table scan on a 200M-row table at noon Monday.
- A query uses `${userInput}` interpolation because devs wanted "dynamic filters" — back to SQL injection.
- A query uses a DB user with `SELECT ANY TABLE` and reads tables the app shouldn't expose.
- A query takes 6 minutes; the connection pool exhausts; the entire app stalls.

**Why it happens:**
- "Devs/admins author it, not end users" feels like the security boundary. It isn't — config files get edited under pressure, copy-pasted from chat, never reviewed as code.
- Oracle accepts surprising things (anonymous blocks, hints that bypass query plans, `DBMS_*` calls).
- No query timeout means "slow" becomes "indefinite."
- Connection pool sizing is already weak (`CONCERNS.md` HIGH: rectrace primary DataSource lacks pool config).

**How to avoid:**
1. **Use a read-only DB user.** Grant `SELECT` only on the specific schemas/tables the feature should expose. This is the real safety, not a regex.
2. **Parse the query, don't regex it.** Use a SQL parser (e.g., JSqlParser, `oracle.sql.parser`, or a hand-written AST check) to confirm the statement is a single `SELECT`, has no `INTO`, no PL/SQL block, no `MERGE`/`UPDATE`/`DELETE`/`INSERT`, no `EXECUTE IMMEDIATE`.
3. **Enforce statement timeout** at the JDBC level: `statement.setQueryTimeout(N)` (e.g., 30s). For HikariCP set `connectionTimeout` and a dedicated short-running pool for these queries, separate from the main pool.
4. **Mandatory `WHERE` clause** check at parse time (or a `ROWNUM <= X` / `FETCH FIRST N ROWS ONLY` wrapper injected by the app).
5. **No string interpolation of user input into the query.** Filters are parameter-bound (`:foo`) and validated against a column whitelist exactly like `CONCERNS.md` recommends for the existing `buildOrderByClause` SQL injection issue.
6. **Code-review the config file like code.** `search-config.json` lives in git; PR review is required; protected branch.
7. **Pre-flight EXPLAIN PLAN** in CI for any new config query — block the merge if the plan shows a full table scan over a flagged table.

**Warning signs:**
- A regex anywhere named `isSelectOnly` or `SAFE_SQL_REGEX`.
- The configured DB user has `DBA` or `RESOURCE` roles.
- No `setQueryTimeout` call in the new query path.
- A `${...}` template substitution appears in a config-driven query.

**Phase to address:**
CONFIG-DIRECT-SQL phase. The read-only DB user and timeout enforcement must land **before** the first config query goes live.

---

### Pitfall 6: `@Scheduled` ES loader overlaps, drifts, and loses jobs on JVM restart

**What goes wrong:**
The team picks Spring's `@Scheduled(fixedDelay=...)` because it's "one annotation." Then:
- A long-running job (full reindex) is still executing when the next tick fires. Default `@Scheduled` uses a single-threaded scheduler, so the next tick **waits** — fine — but if you switch to `@Async` or a pool to "fix concurrency," now two reindexes run in parallel, both writing to the same alias, producing duplicates.
- The JVM restarts at 14:32 between scheduled runs (12:00 and 16:00). The 16:00 run fires per its cron, but the 12:00 run never completed — there is no record that it didn't, no retry, no replay.
- Two backend instances run for HA — both fire `@Scheduled` independently. The loader runs twice every interval.
- Cron expressions in `@Scheduled(cron="...")` use the Spring 6-field syntax; an engineer pastes a 5-field Linux crontab expression and silently changes the schedule.
- The job runs at the JVM's local timezone, which on the Citi VM is UTC, but everyone reading dashboards thinks in EST. The job appears to run at the wrong time.

**Why it happens:**
- `@Scheduled` is documented as the simple option and works in trivial cases.
- "Built-in scheduler" in PROJECT.md is interpreted as "no external dependency," not "no rigor."
- No leader election → multiple instances trigger same job.
- No durable state of last successful run → restart loses context.

**How to avoid:**
1. **Use Quartz with a JDBC JobStore** (Spring Boot 2.7 has first-class Quartz support via `spring-boot-starter-quartz`). Quartz JDBC JobStore gives you durable state, misfire policies, and leader-only execution out of the box.
   - Set `org.quartz.jobStore.misfireThreshold` and choose a misfire instruction per trigger (`MISFIRE_INSTRUCTION_FIRE_ONCE_NOW` for "make up the missed run" vs `MISFIRE_INSTRUCTION_DO_NOTHING` for "skip and resume schedule").
   - Set `org.quartz.scheduler.instanceId = AUTO` and `org.quartz.jobStore.isClustered = true` for multi-instance leader election.
2. **If staying with `@Scheduled`** (single-instance only, deliberately):
   - Annotate jobs with `@SchedulerLock` from ShedLock (`net.javacrumbs.shedlock`) backed by a JDBC lock table, so a future second instance doesn't double-fire.
   - Use `fixedDelayString = "${...}"` with explicit timezone in `cron` (`@Scheduled(cron = "0 0 12 * * *", zone = "America/New_York")`).
   - Persist last-success-time per job to a small `loader_state` table; on startup, check if a run was missed.
3. **Track per-job state**: `id, last_run_at, last_status, last_error, in_flight_since`. Expose via a `/api/admin/loader/status` endpoint. Operators see drift instantly.
4. **Concurrency policy is explicit per job**: `disallowConcurrent=true` (Quartz `@DisallowConcurrentExecution`) or a per-job mutex. Never "fix" overlap by adding threads.
5. **Idempotent writes to ES**: use document IDs derived from the source row's natural key, so a duplicate run overwrites instead of duplicating.

**Warning signs:**
- `@Scheduled` annotations and no ShedLock / Quartz cluster config.
- No `loader_state`-equivalent table.
- The team can't answer "what happens if the JVM dies mid-run?"
- Two prod instances scheduled for HA but the same scheduled job appears in both logs.
- Cron expressions have no `zone = ` attribute.

**Phase to address:**
ES-LOADER phase. Decide Quartz vs `@Scheduled+ShedLock` as a Phase-1 decision, not Phase-N rescue.

---

### Pitfall 7: Observability sweep produces logs nobody can grep and metrics nobody scrapes

**What goes wrong:**
The team adds Logback patterns, a correlation-ID filter, Micrometer counters, `/actuator/prometheus`, and ships. Then in production:
- Logback pattern conflicts: an autoconfigured pattern + a manual `logback-spring.xml` both apply, producing double timestamps or missing MDC fields. Spring Boot 2.7's default `CONSOLE_LOG_PATTERN` competes with anything in `logback.xml` (note: must be `logback-spring.xml` to get Spring's `${...}` substitution).
- Correlation IDs are set via `MDC.put("traceId", ...)` in a filter but lost across `@Async` boundaries and across the script subprocess in `ScriptExecutor`.
- Micrometer's version is pinned by the Spring Boot BOM (`io.micrometer:micrometer-core:1.9.x` for SB 2.7.16). An engineer adds `micrometer-registry-prometheus:1.12.x` directly → classpath conflict, silent fallback, no metrics exported.
- Health checks (`/actuator/health`) are exposed publicly and leak DB hostnames + ES URLs via the `details` block, because `management.endpoint.health.show-details=always` was set "to debug" and never removed.
- "Log aggregation surface" is undecided, so logs go to local files on the VM; they're not shipped anywhere; operators still SSH.
- Slow-query visibility ends up as `hibernate.show_sql=true` (which `CONCERNS.md` already flags as a prod problem) instead of a P95 latency metric.

**Why it happens:**
- Spring Boot's autoconfiguration silently overlaps with manual configuration.
- Micrometer's API changed between 1.9 and 1.10+ (e.g., `Counter.builder` tag semantics, `Observation` API in 1.10+). SB 2.7 is stuck on 1.9.
- "Pick a log aggregation target" is deferred per PROJECT.md, so logs land nowhere by default.
- Health endpoint defaults differ across SB versions.

**How to avoid:**
1. **Pin Micrometer transitively only.** Do not add `io.micrometer:*` direct dependencies. Use `spring-boot-starter-actuator` and let the BOM resolve Micrometer 1.9.x.
2. **Use `logback-spring.xml`** (not `logback.xml`), include `<include resource="org/springframework/boot/logging/logback/defaults.xml"/>` to inherit Spring's MDC-aware pattern, and **then** override with explicit `<appender>` definitions. Never run with both `logback-spring.xml` and `logback.xml` on the classpath.
3. **Correlation ID propagation**:
   - Filter sets `traceId` into MDC on inbound request.
   - For `@Async` boundaries, use a `TaskDecorator` that copies MDC into the worker thread.
   - For subprocesses (`ScriptExecutor`), pass `traceId` as an env var and have the script echo it back.
   - For scheduled jobs, generate a fresh `traceId` at job start.
4. **Lock down actuator**:
   - `management.endpoints.web.exposure.include=health,info,prometheus,loggers` — explicit list, no wildcards.
   - `management.endpoint.health.show-details=when-authorized` (or `never` in prod).
   - Bind actuator to a separate management port if reachable from outside the VM.
5. **Decide the log aggregation target before adding correlation IDs.** Splunk, ELK, OpenTelemetry collector — whichever Citi has — write JSON logs (`net.logstash.logback:logstash-logback-encoder`) targeted at it. Otherwise correlation IDs are decorative.
6. **Slow-query visibility = a timer, not `show_sql`.** Wrap JDBC with `p6spy` or instrument `JdbcTemplate` to record `Timer` per query class with bucketed histograms.

**Warning signs:**
- `logback.xml` (not `-spring.xml`) in `src/main/resources/`.
- `hibernate.show_sql=true` re-appears as the "slow query" answer.
- `management.endpoint.health.show-details=always` in any profile.
- Micrometer or Prometheus registry version is overridden in `pom.xml` away from the BOM.
- "Where do logs go?" has no answer at the end of the phase.

**Phase to address:**
OBSERVABILITY phase — choose log aggregation target as a Phase-0 decision before any code lands. The Micrometer pinning issue is a Phase-1 dependency-review checkbox.

---

### Pitfall 8: Bash ops script becomes a footgun on macOS↔Linux, leaks zombies, and lies about status

**What goes wrong:**
The team writes `rectrace.sh start|stop|status|restart`. It works on the laptop. In production:
- `stop` reads a PID file written by `start`, but the JVM crashed and was replaced by an unrelated process with the same PID — `stop` kills `cron` or `postgres`.
- `start` runs `java -jar ... &` and the script exits before the JVM is actually listening; `status` reports "started" but `curl localhost:6088` 404s for 30 seconds.
- `kill -9` on the JVM leaves child processes (the password-retrieval script's subprocess, any forked tooling) as zombies/orphans.
- The script uses macOS BSD-flavored `ps`, `sed -i ''`, `readlink -f`, `date -j` — none work on the Citi Linux VM, or vice versa.
- `start` doesn't redirect stdout/stderr properly; logs go to a file that's never rotated and fills the disk.
- Signal handling is missing — `Ctrl-C` during `start` leaves a half-started JVM.
- The ES loader and TLM stats service have separate start paths; "start all" fires them in parallel and the loader connects to ES before ES is up because ES isn't managed by this script.

**Why it happens:**
- Bash portability between BSD (macOS) and GNU (Linux) is full of subtle differences.
- PID files are the obvious mechanism and the obviously-broken one.
- "It works on the laptop" is the test bar.

**How to avoid:**
1. **Verify the process before killing it.** Don't just `kill $(cat pidfile)`. Read the PID, then check that `/proc/$PID/comm` (Linux) or `ps -p $PID -o comm=` (portable) matches the expected command. Refuse to kill if it doesn't.
2. **Use `pgrep -f <unique-marker>`** instead of PID files where possible, with a marker like `-Drectrace.service=backend` passed as a JVM arg so the search is unambiguous.
3. **Wait for readiness, not for process start.** `start` polls `curl -fs http://localhost:6088/actuator/health` with a timeout (60s) before returning success. Same for the React dev server (`/`) and the loader (`/actuator/health`).
4. **Trap signals**: `trap 'cleanup' INT TERM EXIT` so partial state is cleaned up.
5. **Redirect output properly**: `nohup java -jar ... >> "$LOG_FILE" 2>&1 &` and configure log rotation via `logrotate` (Linux) or a built-in Logback `RollingFileAppender`. Don't rely on the script for rotation.
6. **Portability discipline**:
   - `#!/usr/bin/env bash` not `#!/bin/sh`.
   - `set -euo pipefail` at the top.
   - Avoid `sed -i` (use `sed -i.bak` then `rm`, portable), `readlink -f` (use a function), `date` arithmetic (use `date -u +%s` and integer math).
   - Test on both macOS and Linux in CI (matrix on a `shellcheck` + `bats` job).
7. **`status` reports liveness AND readiness.** "PID exists" ≠ "service is responding." Probe the HTTP health endpoint.
8. **Components are managed individually with composable verbs**: `rectrace.sh start backend`, `rectrace.sh start loader`, `rectrace.sh start all`. "All" has explicit ordering and waits between dependencies (ES must be reachable before loader).
9. **Run `shellcheck` in CI.** Treat warnings as errors.

**Warning signs:**
- The script kills by PID without verifying the command name.
- `start` returns 0 the instant `&` is appended.
- `set -e` is not set.
- The script has no test on Linux.
- Logs are not rotated.

**Phase to address:**
OPS-SCRIPT phase. Phase exit criterion: script passes `shellcheck`, runs in macOS + Linux CI, and `start` blocks until readiness probe succeeds.

---

### Pitfall 9: Citi-network gotchas (proxy, no public CDN, Kerberos keytabs, internal artifact repos) bite at deployment time

**What goes wrong:**
The React app builds fine on the laptop. On the Citi VM:
- `npm install` fails because npmjs.org is blocked; the VM only sees the internal Citi Nexus/Artifactory.
- `mvn install` fails for the same reason — Maven Central is unreachable; the team has to discover the internal repo URL and add `~/.m2/settings.xml` mirror.
- The React app loads `fonts.googleapis.com` and Tailwind's CDN preview script — both blocked by egress filtering. Pages render with fallback fonts and missing CSS.
- Spring Boot's `RestTemplate` / `WebClient` ignores the system HTTP proxy because it's not configured per-client; outbound calls to ES or a sidecar service silently time out.
- Kerberos keytab for the service account expires every N days; nobody owns rotation; the loader stops working on day 91; the on-call has no playbook.
- The JVM's `cacerts` truststore doesn't have Citi's internal CA, so HTTPS to internal services fails with `PKIX path building failed` (and someone "fixes" it by disabling SSL validation — exactly the `ElasticsearchDevConfiguration` pattern flagged in `CONCERNS.md` CRITICAL).
- Browser users behind a corporate proxy hit the new React app via a reverse proxy that strips or rewrites headers, breaking SSO.

**Why it happens:**
- Laptop dev environment has direct internet; VM doesn't. Nobody tests the artifact-fetch path on the VM until deploy day.
- Kerberos keytabs are a credential nobody thinks of as "credentials needing rotation policy."
- Citi's internal CA is implicit on locked-down corporate machines, explicit on freshly imaged VMs.

**How to avoid:**
1. **Reproduce the VM network constraints on the laptop.** Run `npm install` and `mvn install` once with `--registry=<citi-nexus>` / a `settings.xml` pointing only at the internal repo. Catch the missing-package problem before the VM.
2. **Audit all external URLs in the React build.** `grep -r "googleapis.com\|cdn.jsdelivr\|unpkg.com\|fonts.gstatic"` — replace with locally hosted assets bundled into the SPA. Same for Tailwind — use the PostCSS build, never the CDN script.
3. **Configure proxy at the JVM level**, not per-client: `-Dhttp.proxyHost=... -Dhttps.proxyHost=... -Dhttp.nonProxyHosts=...`. Spring's `RestTemplate` and `WebClient` then inherit it via `ProxySelector.getDefault()`. Document this in the ops script.
4. **Citi CA truststore**: import the CA cert into `$JAVA_HOME/lib/security/cacerts` (or a per-app truststore via `-Djavax.net.ssl.trustStore=`). Never disable validation — when you see `PKIX path building failed`, fix the truststore. Audit `ElasticsearchDevConfiguration` (already flagged in `CONCERNS.md` as production-active) as the prime example of what not to do.
5. **Kerberos keytab lifecycle**: document the keytab's owner, expiry, rotation procedure, and where it lives on disk (`/etc/krb5.keytab` or an app-specific location with 600 perms). Add a metric `keytab_days_until_expiry` and alert at 14 days. Decide keytab-vs-Vault during the security phase; pick one and write the rotation runbook.
6. **Internal-repo-only npm and Maven config in the repo itself** — commit `.npmrc` pointing at the internal registry and `pom.xml` with the internal Nexus mirror, so checkout-and-build works on the VM out of the box.
7. **Maintain a "Citi-network preflight" checklist** that a deploy must pass before promotion: artifact-fetch works, all egress URLs are internal, keytab present and not expiring within 30 days, truststore contains internal CA.

**Warning signs:**
- A laptop demo includes `npm install` and the VM has never been tested with that command.
- An HTTPS call works "after we disabled SSL validation."
- The React app has external `<link>` or `<script>` URLs.
- No keytab rotation procedure documented.
- HTTP proxy is configured per-client instead of via JVM system properties.

**Phase to address:**
DOMAIN-SECURITY phase owns keytab/truststore lifecycle. OPS-SCRIPT phase owns the preflight checklist. REACT-MIGRATION phase owns external-URL audit. Each must explicitly verify on the Citi VM, not just the laptop.

---

### Pitfall 10: New features land on the backend with `maven.test.skip=true` and silently regress everything

**What goes wrong:**
Per `CONCERNS.md`, both backend Maven projects have `maven.test.skip=true` set as a default and **zero** test classes in `src/test`. The new milestone adds: config-driven SQL, a Quartz/scheduled loader, observability filters, security hardening. Each ships without tests because "tests are skipped anyway." A change to `OracleServiceV4.buildOrderByClause()` breaks the existing column-whitelist fix; the loader's misfire policy changes silently; the observability filter swallows exceptions. CI is green because there are no tests. The regression surfaces in UAT or prod.

**Why it happens:**
- Inherited `maven.test.skip=true` is treated as immutable.
- Writing the first test in an empty `src/test` directory feels like infrastructure work, not feature work.
- Engineers say "I'll add tests later" and "later" never comes because there's no failing CI to force it.

**How to avoid:**
1. **Remove `maven.test.skip` from `pom.xml` properties** as the first commit of the milestone, before any feature work. Replace with `-DskipTests` on the rare manual command where skipping is genuinely needed.
2. **Bootstrap minimum test scaffolding**: a single passing context-load test (like TLM stats already has), `spring-boot-starter-test` already on the classpath, a CI job that runs `mvn test` and fails on red.
3. **Test-first the high-risk new features**:
   - Config SQL parser: tests for `SELECT`-only acceptance, rejection of `MERGE`/`UPDATE`/`DELETE`/anonymous-block/multi-statement.
   - Scheduler misfire policy: Quartz misfire instructions tested with `Awaitility`.
   - SQL injection regressions: tests for `buildOrderByClause` whitelist (per `CONCERNS.md` CRITICAL).
4. **Coverage gate for new code only.** Tools like JaCoCo with `--differential` configuration or `jacoco-aggregate` + Sonar can enforce coverage on changed lines without requiring backfill of the whole codebase. Set the threshold at 70% for new code, 0% for legacy.
5. **PR checklist mandates a test reference** for any new public method or service.

**Warning signs:**
- `maven.test.skip` still in `pom.xml` after the first PR of the milestone.
- A new `@Service` class lands with no corresponding `@Test`.
- CI's "tests" step takes <2 seconds.
- "I'll add tests later" appears in any PR.

**Phase to address:**
Every phase — but the **first commit** of the milestone removes `maven.test.skip` and adds the CI gate. This is a roadmap-level Phase-0 prerequisite, not a per-feature task.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Inline shadcn component edits instead of token-driven theming | Fast iteration on individual screens | Un-undoable drift from upstream; recviz↔React visual divergence | Never beyond a 1-screen prototype |
| `@Scheduled` without ShedLock for "single-instance only" loader | One annotation, zero deps | Becomes a double-firing bug the moment HA is added | Only if the deployment topology explicitly forbids multi-instance and that's enforced |
| Keeping the Angular app running indefinitely "until React is ready" | Avoid forcing parity decisions early | Permanent two-SPA maintenance burden | Only with a committed Angular shutdown date on the roadmap |
| `targetOrigin: '*'` in `postMessage` "for now" | Iframe demo works | Cross-origin data leak; failure inside Citi's enterprise security tooling | Never in production code; only in local-only test harnesses |
| Skipping JDBC `setQueryTimeout` on config-driven SELECTs | Faster initial wire-up | Single bad query stalls the pool, takes down search | Never in the config-SQL feature |
| Logging via `e.printStackTrace()` (per `CONCERNS.md`) | Already works without adding a logger import | Errors invisible to log aggregation; correlation IDs lost | Never — replace as part of the observability phase |
| Hardcoded internal hostnames / index names in `application.properties` | Quick to wire | Breaks ES alias swap during reindex; environment-specific rebuilds | Only if a single env is in scope and there is no reindex story |
| Bash script kills by PID without command verification | One line shorter | Kills unrelated processes after a PID reuse | Never on a shared VM |
| shadcn dark mode bolted on per component | Demo dark mode for one screen | Multiplies maintenance N-fold; never consistent | Never beyond a spike |
| Treating `search-config.json` as data, not code | Edits feel low-risk | SQL injection / broken renderers ship without review | Never — config-as-data is code review evaded |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| recviz iframe | `targetOrigin: '*'` in `postMessage` | Pin to literal recviz origin; validate `event.origin` in receivers; centralize in one bus module |
| recviz iframe | Assume cookies "just work" same-network | Negotiate `SameSite` and parent-domain alignment with recviz team; document explicitly |
| recviz iframe | Ignore CSP/XFO until prod | Confirm `frame-ancestors` and absence of `X-Frame-Options: DENY` in UAT smoke test |
| Elasticsearch | Disable SSL validation to bypass cert issues (already present in `ElasticsearchDevConfiguration`) | Add internal CA to truststore; gate the bypass class with `@Profile("dev")` minimum |
| Elasticsearch | Hardcode index name in app config | Use aliases; loader writes through alias; clients read through alias |
| Elasticsearch | Change analyzer on existing field | Add `.keyword` subfield (allowed) or create new index + reindex + atomic alias swap |
| Oracle (read-only SELECT feature) | Trust regex-based "SELECT-only" | Use parser + read-only DB user + statement timeout |
| Oracle | Concatenate column names into SQL (already flagged in `CONCERNS.md`) | Whitelist columns from `CategoryConfigV4.columns` before SQL build |
| Citi portal SSO | Assume `x-citiportal-loginid` header is always present and trusted (already flagged in `CONCERNS.md`) | Spring Security filter validates presence + signature/source; reject direct calls |
| Quartz scheduler | Default misfire policy | Choose per-trigger: `FIRE_ONCE_NOW` for catch-up, `DO_NOTHING` for skip-and-resume |
| Quartz scheduler | Single-instance assumption + 2-instance prod deployment | `org.quartz.jobStore.isClustered = true` with JDBC JobStore |
| Kerberos / keytab | Treat keytab as install-once secret | Owner, rotation procedure, expiry metric, alert at 14 days |
| HTTP proxy | Configure proxy per HTTP client | Set at JVM level (`-Dhttp.proxyHost=...`); all clients inherit |
| Internal Nexus / Artifactory | Discover the URL on deploy day | Commit `.npmrc` and Maven `settings.xml` mirror config in the repo |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Config-driven SELECT with no `WHERE` against a large table | Single search hangs the whole app for minutes | Mandatory `WHERE`/`ROWNUM` cap; statement timeout; separate small pool | First time a config query targets a 100M+ row table |
| Primary `rectrace` Oracle DataSource without pool config (per `CONCERNS.md`) | Connection starvation under concurrent search | HikariCP explicit config matching `AutosysDataSourceConfig` | At ~10–20 concurrent searches |
| ES loader running while user search uses the same index | Latency spikes during loader runs | Loader writes to a `_v2` index; alias swap atomically when complete | Visible at 100s of docs/sec ingest |
| `hibernate.show_sql=true` in prod (per `CONCERNS.md`) | Verbose stdout, slow log writes, possible PII leak | Set `false` in prod profile; use timer metrics instead | Always in prod — already broken |
| Iframe reload on every tab change instead of mount-once + `postMessage` for navigation | recviz takes 2–4s to reauth and re-render on each click | Persist iframe across tab switches; navigate via `postMessage` | Visible immediately to users; worsens under network latency |
| AG-Grid SSRM with no group expansion cache | Re-fetches on every expand/collapse | Cache expansion results client-side keyed by group path | At deep group hierarchies and >500 rows |
| Cytoscape graph re-layouts on every minor update | UI freezes for seconds | Recompute layout only on structural changes, not on data updates | At >200 nodes |
| Loader concurrency = 1 thread shared across all jobs | One slow job blocks all others; misses schedules | Quartz thread pool sized > job count; per-job `@DisallowConcurrentExecution` | When 2nd loader job is added |
| React app pulls fonts from `fonts.googleapis.com` | Pages render with fallback fonts on Citi VM (egress blocked) | Bundle fonts locally via @fontsource | First production deploy |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| "SELECT-only" enforced by regex on free-form SQL in config | Data modification via `MERGE`/`UPDATE RETURNING`/PL/SQL block; full-table reads from unintended tables | Parser-based validation + read-only DB user + statement timeout + EXPLAIN PLAN in CI |
| Column names interpolated into SQL (already flagged CRITICAL in `CONCERNS.md`) | SQL injection via `colId` or filter column | Whitelist against `CategoryConfigV4.columns` |
| `ElasticsearchDevConfiguration` disabling SSL with no `@Profile` (already flagged CRITICAL) | MITM in prod/UAT | Add `@Profile("dev")`; use truststore-based config in non-dev |
| Plaintext DB password in `application.properties` (already flagged CRITICAL) | Repo read access = prod DB credential | Externalize via env var or Vault; rotate immediately |
| CORS `allowedOrigins("*")` + `allowCredentials(true)` (already flagged CRITICAL in TLM stats) | CSRF; any origin can call APIs | Explicit allowed origins; never wildcard with credentials |
| `x-citiportal-loginid` accepted as truth, never enforced (already flagged HIGH) | Direct API call from anywhere spoofs any user | Spring Security filter rejects requests without portal-injected, validated header |
| `postMessage` from recviz iframe without origin check | Any embedding origin can inject events into the app | Wrap `addEventListener('message')` so `event.origin` is checked centrally |
| Iframe lacks `sandbox` attribute | Embedded content has more privileges than needed | Add `sandbox` with minimum required `allow-*` tokens |
| Keytab file owned by `root:root` mode 644 | Local user on VM reads service credential | mode 600, owned by service account; auditable rotation |
| Health endpoint `show-details=always` exposed without auth | Leaks DB hostnames, ES URLs, internal IPs | `show-details=when-authorized` or `never`; bind to mgmt port |
| Loader's DB user has broad write permissions | One compromised query becomes a destructive query | Separate read-only user for query exec; loader's user writes only to ES |
| `console.log` of request/response bodies in React (similar pattern already in Angular per `CONCERNS.md`) | PII / internal IDs in browser dev tools and any log scraper | Centralized error handler; lint rule banning `console.*` in prod build |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| New React app and embedded recviz iframe have visibly different design tokens | Users perceive product as "two apps duct-taped together" | Token-driven theme shared from a single source; visual regression test on the boundary |
| Iframe re-loads on every tab switch | 2–4s blank screen between tabs | Mount-once iframe; navigate inside via `postMessage` |
| Status of long-running config SQL query is "spinner forever" | User assumes hung; refreshes; orphans the query | Show elapsed time; allow cancel; cap at statement timeout with clear error |
| Hyphen search bug "fixed" only for ID-shaped strings | Users still find hyphens broken in other fields | Test matrix across all categories; document analyzer behavior in the search help |
| Dark mode broken in one form field (already flagged in `CONCERNS.md` TODO) | Illegible text in TLM filters | Token-driven dark mode applied consistently in React; don't carry forward as TODO |
| Loader job failures invisible to users | Search returns stale results with no indication | Surface "last successful sync at HH:MM" in the UI per index; alert if >2× schedule interval |
| Generic "Error 500" toast | Users can't self-diagnose or include a useful detail in tickets | Surface correlation ID in error UI; "include this code when reporting" |
| AG-Grid Enterprise watermark in prod (already flagged in `CONCERNS.md` — license placeholder) | Trust erosion; users think the product is unlicensed | Register the real key at startup; CI check that `agGridLicenseKey !== 'License_Value'` |

---

## "Looks Done But Isn't" Checklist

- [ ] **React migration:** Often missing parity for V5 renderers and config-driven `cellRenderer` keys — verify every string in `search-config.json` has a React equivalent registered.
- [ ] **shadcn theme:** Often missing token-driven dark mode — verify no hex codes exist in `.tsx`/`.scss` files (lint).
- [ ] **recviz iframe:** Often missing origin-checked `postMessage` — verify every `addEventListener('message')` checks `event.origin`.
- [ ] **recviz iframe:** Often missing UAT validation of CSP/cookie/SSO — verify a recorded UAT smoke test, not a localhost demo.
- [ ] **Hyphen bug fix:** Often missing alias indirection — verify the loader and search both reference an alias, not a raw index name.
- [ ] **Hyphen bug fix:** Often missing regression test — verify a test that searches `ABC-123` and asserts the expected document is returned.
- [ ] **Config SQL:** Often missing `setQueryTimeout` — verify on the JDBC path, not just in the parser.
- [ ] **Config SQL:** Often missing read-only DB user — verify `GRANT SELECT` only, no other privileges, on a dedicated user.
- [ ] **Scheduler:** Often missing misfire policy — verify the choice is explicit per trigger, not defaulted.
- [ ] **Scheduler:** Often missing leader-only execution in multi-instance — verify ShedLock or Quartz cluster config exists.
- [ ] **Observability:** Often missing log aggregation target — verify logs actually reach the chosen system, not just stdout.
- [ ] **Observability:** Often missing MDC propagation across `@Async` and subprocess — verify a trace passes through end-to-end.
- [ ] **Ops script:** Often missing readiness wait — verify `start` blocks until `/actuator/health` returns 200.
- [ ] **Ops script:** Often missing Linux test — verify CI runs the script on Linux (not only macOS).
- [ ] **Domain security:** Often missing keytab rotation runbook — verify owner, expiry, procedure are documented.
- [ ] **Domain security:** Often missing truststore for internal CA — verify HTTPS to internal services succeeds without disabling validation.
- [ ] **Backend tests:** Often missing the removal of `maven.test.skip=true` — verify `pom.xml` does not skip tests by default.
- [ ] **Backend tests:** Often missing CI red on test failure — verify CI fails when a test fails.
- [ ] **AG-Grid license:** Often missing real key (already flagged) — verify `LicenseManager.setLicenseKey` is called and key is not `'License_Value'`.
- [ ] **Angular decommission:** Often missing a shutdown date — verify roadmap has a dated milestone for Angular sunset.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| React app drifts from Angular parity | MEDIUM | Stop new React work; produce parity matrix; backfill missing renderers; only then resume |
| shadcn tokens diverged from recviz | HIGH | Inventory every overridden component; rebuild tokens file from recviz source; rerun visual regression; refactor components to use tokens (likely a sub-milestone) |
| Iframe broken in prod by CSP/cookie | MEDIUM | Coordinate with recviz team for header/cookie changes; deploy via recviz, not your app; UAT verify; retry |
| Hyphen fix required full reindex | MEDIUM | Build alias indirection retroactively; reindex into `_v2`; atomic alias swap; keep v1 for rollback |
| Config SQL allowed a write or runaway scan | HIGH | Immediately revoke non-SELECT privileges on the DB user; audit query log for past damage; ship parser-based validation as hotfix |
| Loader overlapped or missed runs | LOW-MEDIUM | Add ShedLock or migrate to Quartz JDBC JobStore; backfill missed data via manual job invocation; add `loader_state` table |
| Logback pattern conflict produces unusable logs | LOW | Rename `logback.xml` → `logback-spring.xml`; include Spring defaults; restart; logs become parseable |
| Bash script killed wrong process | HIGH (if it killed something critical) | Add command-verification check; add `pgrep -f` with marker; add Linux CI test; postmortem |
| Citi-network deploy failure (npm/maven/proxy) | LOW-MEDIUM | Commit internal-repo config; document proxy JVM args; add VM preflight checklist; retry |
| Keytab expired in prod | LOW (if caught) / HIGH (if outage) | Rotate keytab; restart service; add 14-day expiry alert; document rotation owner |
| Regression shipped because tests skipped | MEDIUM | Remove `maven.test.skip`; add CI gate; write tests for the regressed code path before any further feature work |

---

## Pitfall-to-Phase Mapping

Phase names below are domain-aligned with the Active requirements in `PROJECT.md`; the roadmap may rename or reorder them.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| #1 React drifts from Angular parity | REACT-MIGRATION (planning sub-step) | Parity matrix committed; Angular shutdown date on roadmap |
| #2 shadcn theming drift | DESIGN-SHADCN | Lint passes (no hex in `.tsx`); visual regression at recviz boundary green |
| #3 iframe CSP/cookie/SSO/postMessage | RECVIZ-INTEGRATION | UAT smoke test recorded; `postMessage` origin check enforced via lint or central bus |
| #4 ES analyzer reindex stall | SEARCH-BUG-HYPHEN | `_analyze` diagnostic in PR; alias indirection in place; regression test for hyphen |
| #5 Config SQL escape / runaway | CONFIG-DIRECT-SQL | Parser-based validation tests; read-only user grants; `setQueryTimeout` in code; EXPLAIN PLAN CI step |
| #6 Scheduler overlap / drift / loss | ES-LOADER | Quartz cluster config OR ShedLock; per-job state table; misfire policy explicit per trigger |
| #7 Observability misconfig | OBSERVABILITY | Logback uses `-spring.xml`; Micrometer not version-overridden; actuator details locked down; logs reach aggregation target |
| #8 Bash ops script fragility | OPS-SCRIPT | `shellcheck` passes; Linux CI runs; `start` blocks until readiness; trap on signals |
| #9 Citi-network deploy gotchas | DOMAIN-SECURITY (keytab/truststore) + OPS-SCRIPT (preflight) + REACT-MIGRATION (external URL audit) | Internal Nexus/npmrc committed; truststore has internal CA; keytab rotation runbook; no external CDN URLs |
| #10 `maven.test.skip=true` regression risk | Phase-0 prerequisite (applies across all phases) | `pom.xml` no longer skips tests; CI fails on red; new code has tests |

---

## Sources

- `/Users/aarun/Workspace/Projects/autosys-job-explorer/.planning/PROJECT.md` — current milestone scope, requirements, constraints, deferred decisions.
- `/Users/aarun/Workspace/Projects/autosys-job-explorer/.planning/codebase/CONCERNS.md` — already-identified security and quality issues (CRITICAL: plaintext password, ES SSL bypass, SQL injection in column names, CORS wildcard; HIGH: tests skipped, password script, SB 2.7 EOL, missing pool, missing recportal config; MEDIUM: AG-Grid license placeholder, dead code, `hibernate.show_sql`, `printStackTrace`).
- `/Users/aarun/Workspace/Projects/autosys-job-explorer/CLAUDE.md` — project structure, ports, conventions.
- Spring Boot 2.7 reference (Micrometer 1.9.x pinning, `logback-spring.xml` resolution, actuator endpoint exposure defaults) — HIGH confidence from training data, verified against `pom.xml` parent version `2.7.16`.
- Quartz scheduler documentation (`MISFIRE_INSTRUCTION_*`, `isClustered`, `@DisallowConcurrentExecution`) — HIGH confidence.
- ShedLock documentation (`@SchedulerLock`, JDBC LockProvider) — HIGH confidence.
- Elasticsearch mapping immutability rules (analyzer changes require reindex; `.keyword` subfield additions allowed) — HIGH confidence.
- `postMessage` security guidance (MDN `Window.postMessage` — always set `targetOrigin`, always validate `event.origin`) — HIGH confidence.
- CSP `frame-ancestors` and `X-Frame-Options` semantics — HIGH confidence.
- Cookie `SameSite` behavior in iframe contexts (Chrome's third-party cookie phase-out, `SameSite=None; Secure` requirement for cross-site) — HIGH confidence.
- Bash portability (BSD vs GNU `sed`, `readlink`, `date`) and `shellcheck` — HIGH confidence.
- shadcn/ui design philosophy (copy-into-repo model, no upstream upgrade path) — HIGH confidence.

---
*Pitfalls research for: Rectrace — React migration + backend extensions milestone*
*Researched: 2026-05-12*
