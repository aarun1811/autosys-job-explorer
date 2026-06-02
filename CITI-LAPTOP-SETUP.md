# Rectrace on a Citi laptop — first-run setup

This is the minimal path to get rectrace (backend + React frontend) running on a Citi-internal Windows laptop pointed at the real Citi Oracle + Elasticsearch. RecViz runs separately (see its own repo's setup doc). Tlm-stats and rectrace-loader are out of scope for the first laptop deploy.

**Prereqs on the laptop**
- Java 21 (matches `backend/rectrace/pom.xml` and `rectrace-tlm-stats/pom.xml`)
- Maven 3.8+
- Node 20+
- pnpm 9+ (install via `npm install -g pnpm` if absent)
- Git Bash (for running `pnpm dev` and any ops scripts — Windows native CMD/PowerShell won't run the bash scripts under `ops/`, but you don't need them for the laptop flow)
- IntelliJ IDEA (for running the backend)
- Network access to your Citi Oracle DB host and Citi Elasticsearch URL

## 1. Clone the repo

Clone from your Citi-internal git host into your workspace, e.g. `C:\Users\<you>\Workspace\autosys-job-explorer`.

## 2. Fill in `application-citi.properties`

Open `backend/rectrace/src/main/resources/application-citi.properties`. Every key with a `<CITI_*>` placeholder is required:

- `datasource.*` — primary Oracle (RECTRACE schema): host, port, service name, username, password, schema name
- `datasource.readonly.*` — read-only Oracle pool for the SQL tab. If Citi doesn't have a separate read-only user yet, point this at the same RECTRACE credentials as a temporary measure
- `autosys.db.*` — secondary Oracle (AUTOSYS schema). Often on the same Oracle instance as primary — copy the host/port/service if so
- `spring.elasticsearch.uris` — Citi ES URL with scheme (`https://es.citi.intra/...` or similar)
- `spring.elasticsearch.username` / `password` — Citi ES credentials

**Security**: this file is tracked in git with placeholder values. After you fill it in with real Citi credentials, DO NOT `git push` the filled version back. Same convention as `application-local.properties`. If you accidentally commit it, rotate the credentials before pushing.

## 3. Run backend in IntelliJ

1. Open `backend/rectrace/pom.xml` as a project in IntelliJ. Wait for Maven to import.
2. Find `RectraceApplication` (`backend/rectrace/src/main/java/com/citi/gru/rectrace/RectraceApplication.java`). Right-click → Run.
3. Open the run configuration that IntelliJ created. In **VM options** (or **Active profiles** if available), add:
   ```
   -Dspring.profiles.active=citi
   ```
4. Re-run. Watch the console for `Started RectraceApplication in <N> seconds`.

**Smoke check (in another terminal)**:
```bash
curl -s http://localhost:6088/rectrace/actuator/health
# expected: {"status":"UP",...}

curl -s "http://localhost:6088/rectrace/api/v4/search/config" | head -c 200
# expected: JSON starting with {"categories":[...

curl -s "http://localhost:6088/rectrace/api/v4/search/initial?keyword=<a-real-job-name-or-tlm-instance>" | head -c 400
# expected: JSON with categoryResults — non-zero counts on at least one category
```

If the first curl returns 503 / DOWN, the JSON body's `components` block names the failing health indicator — most commonly Oracle or ES connectivity. Verify the corresponding `application-citi.properties` block.

## 4. Run React frontend in Git Bash

In a separate Git Bash terminal:

```bash
cd C:/Users/<you>/Workspace/autosys-job-explorer/frontend-react
pnpm install
pnpm dev
```

Vite serves on `http://localhost:5173`. It proxies `/api/v4/*` to backend on `:6088` per `vite.config.ts` — no extra config needed.

Open `http://localhost:5173` in a browser. You should see the rectrace search shell. Try a search; results should render from Citi data.

## 5. RecViz (cell-click modal embeds)

Cell-click on TLM / Recon cells opens an iframe pointing at RecViz on `http://localhost:8000` by default. To make that work on the laptop:

1. Clone the RecViz repo separately and bring it up locally (BE + FE) per its own setup doc.
2. RecViz dashboards `dash-tlm-stats` and `dash-quickrec-stats` need their Citi Oracle data-source configs filled in — that's a separate small piece of work in the RecViz repo (placeholder YAMLs + a setup note like this one).
3. If you want a different RecViz origin (e.g. a Citi-internal RecViz server), set `VITE_RECVIZ_ORIGIN` in `frontend-react/.env`:
   ```
   VITE_RECVIZ_ORIGIN=http://citi-internal-recviz.example
   ```
   Then restart `pnpm dev`.

## 6. Things deliberately out of scope for the first laptop run

- **rectrace-loader** (`rectrace-loader/`, port 6089) — the ES write-side worker. Citi ES is assumed already populated, so the loader isn't needed for the laptop test. If you later want to populate Citi ES from Citi Oracle on the laptop, create a sibling `application-citi.properties` in `rectrace-loader/src/main/resources/` mirroring this file's pattern.
- **rectrace-tlm-stats** (`rectrace-tlm-stats/`, port 8080) — functionality has moved to RecViz dashboards.
- **Phase 9 Citi domain security** (CitiPortal / SiteMinder / SPNEGO, ES SSL re-enable, prod CORS allow-list) — `SecurityConfig` is permit-all under the `citi` profile, same as local. Real auth lands when the separate Citi auth team integrates.

## 7. Known gotchas on Windows

- **Git Bash is required for `pnpm dev`** if you want consistent path handling. PowerShell can also run pnpm; CMD usually can't.
- **Oracle JDBC driver** comes via Maven (`ojdbc8`) — no manual install needed.
- **Splunk HEC token** — `application-prod.properties` has a `<TO_BE_FILLED>` Splunk HEC token. The citi profile doesn't ship Splunk by default; logs go to console. If you want Splunk shipping on the laptop too, copy the Splunk block from `application-prod.properties` into your `application-citi.properties` and fill in the Citi Splunk endpoint.

## 8. Reference

- Spec: `docs/superpowers/specs/2026-05-31-loader-extraction-design.md` (loader extraction)
- Spec: `docs/superpowers/specs/2026-05-31-a1a-remove-dashboard-config.md` (empty-state fix)
- CLAUDE.md — repository-wide conventions, module table, ops surface
- DEPLOY.md — production deploy notes (Citi VM)
