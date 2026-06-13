# Citi Production Release Runbook — Rectrace + RecViz

**Flow:** GitHub → download ZIP on the Citi laptop → fill prod config → build React into the backend → `mvn` JAR → run on the RHEL server. RecViz deploys as its own Python service. Citi ES is already populated (loader not needed yet). No CI/CD yet.

**Deploy profile: `prod`** (now a complete, bootable profile — see the pre-release fixes below).

> Derived from the 2026-06-13 prod-readiness audit. The code-side fixes are already committed (rectrace `405702e`, RecViz `a775285`). This runbook is the *operator* side: what to fill in and run.

---

## 0. What was already fixed in the code (so the laptop work is fill-in-the-blanks)

- `application-prod.properties` is now a **complete** profile (datasource + readonly + autosys + ES + recviz + classpath search-config). Primary/readonly Oracle passwords are **blank on purpose** (fetched by `get_password.sh`); Autosys + ES are filled directly.
- Base `application.properties` no longer carries dev values (an unconfigured profile fails loud).
- `AutosysDataSourceConfig` now supports the `get_password.sh` fallback (blank password → script) — direct password works today.
- `logback-spring.xml` writes a **rotating JSON log file** under `prod`.
- `routeTree.gen.ts` is committed (so the zip builds); the React router uses `basepath=/rectrace`.
- RecViz CORS is env-driven; frame-ancestors tolerates comma/space.

---

## Prerequisites

**Laptop (Windows, build machine):** Java 21, Maven 3.8+, Node 20+, pnpm **9** (`npm i -g pnpm@9` — avoids the pnpm-11 ignored-builds gate), Git Bash, the Citi **AG-Grid Enterprise license key**.

**RHEL server (run):** Java 21; `/opt/rectify/control/scripts/get_password.sh` present (Oracle password fetch); the Citi **CA in a JVM truststore** (for `https` Oracle/ES); for RecViz — **Oracle Instant Client 21+** (Basic+SDK).

---

## STAGE 1 — Rectrace (the JAR)

### 1.1 Get the code
Download the `autosys-job-explorer` repo as ZIP on the laptop and unzip. (The zip omits `node_modules`, `dist`, `target`, and `.env.local` — all regenerated below. `routeTree.gen.ts` **is** in the zip now.)

### 1.2 AG-Grid license (build-time)
Create **`frontend-react/.env.local`**:
```
VITE_AG_GRID_LICENSE_KEY=<your Citi AG-Grid Enterprise key>
```
(Leave `VITE_RECVIZ_ORIGIN` unset — RecViz origin comes at runtime.)

### 1.3 Fill `backend/rectrace/src/main/resources/application-prod.properties`
Replace the `<CITI_*>` placeholders. **Leave the two blank passwords blank.**

| Key | Fill with | Note |
|---|---|---|
| `datasource.url` / `.service-name` / `.db-schema` / `.username` | primary Oracle (RECTRACE) coords | |
| `datasource.password` | **(leave BLANK)** | fetched via `get_password.sh @<service> <schema>` |
| `datasource.readonly.*` | read-only Oracle user coords | password **BLANK** → script |
| `autosys.db.*` incl. `autosys.db.password` | AUTOSYS coords + **direct password** | (script next week — blank it + set `autosys.db.service-name`) |
| `spring.elasticsearch.uris/username/password` | Citi ES (basic auth) | filled directly |
| `app.recviz.origin` | RecViz server origin (Stage 2) | or set at runtime — see 1.5 |
| `app.cors.allowed-origins` | the **Citi portal origin(s)** | the browser origin, comma-separated |
| `logging.file.path` | e.g. `/opt/rectrace/logs` | rotating `rectrace.log` lands here |
| `splunk.hec.host/port` | Citi Splunk (optional) | unreachable = harmless; logs still hit file+journald |

> **`get_password.sh` contract to verify:** the script is called as `get_password.sh @<SERVICE> <SCHEMA>` for the primary and read-only pools. Confirm it returns the correct password for **each** pool given its `service-name`+`db-schema` (the read-only user may differ from primary).

### 1.4 Build the JAR (Git Bash)
```bash
cd frontend-react && pnpm install && pnpm build && cd ..
ops/build.sh react                        # copies frontend-react/dist into the backend's static/
cd backend/rectrace && mvn -DskipTests clean package
# → target/rectrace-0.0.1-SNAPSHOT.jar  (contains backend + React UI)
```
`scp` the jar to the RHEL server (e.g. `/opt/rectrace/rectrace.jar`).

### 1.5 Run on the server
```bash
SPRING_PROFILES_ACTIVE=prod \
java -Djavax.net.ssl.trustStore=/opt/rectrace/citi-truststore.jks \
     -Djavax.net.ssl.trustStorePassword=<truststore-pwd> \
     -jar /opt/rectrace/rectrace.jar
```
- **TLS truststore is mandatory** for `https` Oracle/ES (no in-app SSL bypass anymore).
- **`app.recviz.origin` without rebuild:** set it at runtime instead of in the file — `APP_RECVIZ_ORIGIN=https://recviz.citi.intra:8000` env var (Spring relaxed binding) or `--app.recviz.origin=...`. Highest-priority source, no jar rebuild — handy when the RecViz URL is only known at Stage 2.
- Run under **systemd** for journald capture + restart-on-failure (see DEPLOY.md for a unit template).

### 1.6 Verify
```bash
curl -s http://localhost:6088/rectrace/actuator/health          # {"status":"UP"}
curl -s "http://localhost:6088/rectrace/api/v4/search/initial?keyword=<real-term>" | head -c 300
ls -la /opt/rectrace/logs/rectrace.log                          # rotating JSON file
```
Open the UI via the portal at `…/rectrace/` — confirm search returns Citi data and deep-links work (router basepath).

> **Portal topology to verify:** the React app calls **relative** `/rectrace/api/*`. The portal must reverse-proxy `/rectrace/*` to this backend. If instead the UI loads from one origin and must call the backend on a *different* absolute host, set the API base URL at build time (tell me and I'll wire `VITE_API_BASE_URL`/`queryClient` BASE_URL).

---

## STAGE 2 — RecViz + integration

RecViz is a separate native FastAPI/uvicorn service (not in the jar). Download the `RecStats` repo as ZIP.

### 2.1 Backend
1. Install **Oracle Instant Client 21+**; DBA grants `SELECT ON v_$session_connect_info` to the RecViz user.
2. Create `backend/.env` from `backend/.env.citi.example`:
   - `RECVIZ_DB_URL` (RecViz schema), `ORACLE_CLIENT_LIB_DIR`, `RECVIZ_ENCRYPTION_KEY` (**generate ONCE via Fernet, store in vault, reuse forever**).
   - `RECVIZ_EMBED_FRAME_ANCESTORS=<the Citi portal/browser origin of rectrace>` (this is the gate that lets the iframe load — comma or space separated).
   - `RECVIZ_CORS_ALLOWED_ORIGINS=<same origin>` (now read; defense-in-depth).
   - `VITE_API_BASE_URL=` (empty → same-origin).
3. `python -m venv venv && source venv/Scripts/activate && pip install -r requirements.txt`
4. `PYTHONPATH=. alembic -c app/migrations/alembic.ini upgrade head` (creates `recviz_*` tables).
5. Seed the TLM dashboard: `python scripts/setup-tlm-citi.py`. **Do NOT run `seed-oracle.py` against Citi Oracle** (it is destructive + refuses prod).

### 2.2 Frontend
Create `frontend/.env.local` with `VITE_AG_GRID_LICENSE_KEY=<same Citi key>`, then `pnpm install && pnpm build` (FastAPI serves `frontend/dist`).

### 2.3 Run + wire
- `uvicorn app.main:app --host 0.0.0.0 --port 8000` under systemd — **single worker, no `--reload`** (in-memory state).
- Point rectrace at it: `APP_RECVIZ_ORIGIN=<RecViz origin>` (Stage 1.5).
- The two strings that must agree: rectrace **`app.recviz.origin`** = RecViz origin; RecViz **`RECVIZ_EMBED_FRAME_ANCESTORS`** = rectrace's **portal/browser** origin.

### 2.4 Verify
Click a **TLM-stats** cell in rectrace → the modal embeds the RecViz dashboard with Citi data.

> **QuickRec is deferred** (see Open Items). The QuickRec dashboard has no prod-safe seed yet, so QuickRec cells will open an empty modal until that's built. Decide: hide the QuickRec cell for this release (one-liner) or leave it.

---

## STAGE 3 — Loader (later, not blocking)

Citi ES is already populated, so the loader is out of scope for this release. When needed: author `rectrace-loader/src/main/resources/application-prod.properties` (mirror the backend's datasource + `spring.elasticsearch.*` + loader-config), build/run on `:6089` with `SPRING_PROFILES_ACTIVE=prod`.

---

## Open items / decisions

1. **QuickRec dashboard** — build a prod-safe seeder, or hide the `QuickRecStatsCellRenderer` for this release. (Deferred per plan.)
2. **`get_password.sh` per-pool contract** — verify it returns the right password for primary vs read-only (vs autosys next week) given each pool's service+schema.
3. **Portal proxy** — confirm `/rectrace/*` is reverse-proxied to the backend so the React app's relative API calls resolve (else set a build-time API base URL).
4. **Autosys → script** (next week) — blank `autosys.db.password`, set `autosys.db.service-name`; the code fallback is already in place.
5. **SSO/auth** — `x-citiportal-loginid` is logged, not enforced (Phase 9). Treat any backend reachable outside the portal as unauthenticated.
6. **CI/CD** — next week.

---

*Full audit detail: the 2026-06-13 prod-readiness pass. Code fixes: rectrace commit `405702e`, RecViz commit `a775285`.*
