<!-- Generated from a verified deep-dive of the RecViz + rectrace code, 2026-06-13. Companion to CITI-RELEASE-RUNBOOK.md (Stage 1). -->

# Stage-2 Production Runbook — RecViz + rectrace TLM-Stats Embed

**Scope:** rectrace (Spring Boot, `profile=prod`) is already running on the Citi RHEL host (`:6088`, context path `/rectrace`). This brings up RecViz (FastAPI/uvicorn `:8000`) and wires the TLM-stats cell-click iframe end-to-end. **QuickRec is deferred — TLM only** (see §5.9).

**Two hosts referenced throughout — substitute your real values once and reuse:**
- `RECVIZ_HOST` — the RecViz RHEL server, browser-visible origin, e.g. `http://recviz.citi.intra:8000`
- `RECTRACE_PORTAL` — the origin the **user's browser** loads rectrace from. If users hit rectrace directly it is `http://rectrace.citi.intra:6088`; **if a Citi portal/proxy fronts it (e.g. `https://apps.citi.com`), use the proxy origin, not the raw `:6088`.** This value drives `frame-ancestors` — get it wrong and the iframe silently renders blank (§5.2).

---

## 1. PREREQUISITES on the RHEL server

These are **hard blockers** unless noted.

**1.1 Oracle Instant Client (thick mode is mandatory).** RecViz refuses to start without it — `main.py:24` reads `ORACLE_CLIENT_LIB_DIR` directly and dies with `FATAL: ORACLE_CLIENT_LIB_DIR is not set` before pydantic even runs; `main.py:32` then calls `oracledb.init_oracle_client(lib_dir=...)`. The Alembic runner (`migrations/env.py`) and the seed script (`setup-tlm-citi.py:595` `init_oracle_thick`) do the same. Confirm the directory containing `libclntsh.so` exists (same client rectrace's tlm-stats uses, e.g. `/opt/oraclient/19.3_64/lib`).
```bash
ls -l /opt/oraclient/19.3_64/lib/libclntsh.so   # must exist
```

**1.2 DBA — RecViz catalog schema user.** A dedicated Oracle user (e.g. `RECVIZ`) on the same Oracle instance/PDB as rectrace (different schema). Needs `CREATE SESSION`, `CREATE TABLE`, and quota — it owns the `recviz_*` tables Alembic creates and the seed script writes.

**1.3 DBA — `v$session_connect_info` grant (HARD BLOCKER).** The lifespan startup assertion (`main.py:80-98`) runs `SELECT client_driver FROM v$session_connect_info WHERE sid = SYS_CONTEXT('USERENV','SID')` and raises `RuntimeError("FATAL: Oracle thick mode not detected")` if the row is missing or contains `thn`. Without the grant the query returns no rows and **RecViz will not boot**:
```sql
GRANT SELECT ON v_$session_connect_info TO RECVIZ;
```

**1.4 DBA — SELECT on the TLM/recon source tables.** The seed script pre-flight (`setup-tlm-citi.py`, `ALL_TABLES` check ~line 644) verifies each connecting user can see its tables:
- Each TLM-instance user: `BANK`, `MESSAGE_FEED`, `ITEM`, `TLM_BDR_RELATIONSHIP_HEADER`
- The reconmgmt user: `MR_CSUM_MAN_MATCH_DETAILS`, `MR_CSUM_NETTING_HIST`

If the tables live in a different schema than the connecting user, that user needs explicit `SELECT` (the check uses `ALL_TABLES`, so the rows must be visible to it). Missing privileges fail pre-flight with a "Tables missing" error.

**1.5 Python 3.12 on the RHEL host** (for the venv in §2.3).

**1.6 The Fernet encryption key — generate ONCE, save in a vault, never rotate.** This single key encrypts every Oracle password stored in `recviz_connections.encrypted_password` and must be byte-identical at seed time and at runtime (§5.1 explains the footgun). Generate it now and store it securely:
```bash
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

**1.7 `get_password.sh` present** (nice-to-have / Citi-pattern). If you omit per-connection passwords in the JSON, the seed script calls `/opt/rectify/control/scripts/get_password.sh <SERVICE_UPPER> <SCHEMA_UPPER>` (§2.5). Confirm the script exists and works, or plan to hardcode passwords in the config JSON instead.

---

## 2. STEP-BY-STEP DEPLOY

### 2.a — Get the code + build the frontend (Windows laptop)

RecViz is a **same-origin deploy**: FastAPI serves the Vite-built `frontend/dist/` as static files. The mount path is computed as `Path(__file__).resolve().parents[2] / "frontend" / "dist"` (`main.py:277`) — i.e. `…/RecViz/frontend/dist/`. **If that directory is absent, the SPA is silently disabled** (`main.py:279 if FRONTEND_DIST.exists()`) — no crash, just 404 on the iframe HTML (§5.7).

1. Download the RecViz GitHub zip; unzip on the laptop (e.g. `C:\stage2\RecViz`).
2. Create `frontend\.env.local` from `frontend/.env.local.example`:
   ```
   VITE_AG_GRID_LICENSE_KEY=<AG-Grid+AG-Charts enterprise key>
   VITE_API_BASE_URL=
   ```
   - `VITE_AG_GRID_LICENSE_KEY` is a **build-time** bake-in (one key covers AG-Grid + AG-Charts Enterprise). If empty, the grid renders with a watermark.
   - `VITE_API_BASE_URL` **must be empty** — same-origin. A non-empty value hardcodes a host into the bundle and prod API calls go to the wrong place (§5.8).
3. Build:
   ```powershell
   cd C:\stage2\RecViz\frontend
   pnpm install
   pnpm build           # outputs frontend\dist\
   ```
4. Package the bundle **excluding** `node_modules`, `frontend/node_modules`, and any Python `venv`/`.venv`. Include `backend/` (with `requirements.txt`), `frontend/dist/`, and `scripts/`. Zip and transfer (CitiMover/scp) to the RHEL host, preserving structure, e.g. under `/opt/recviz/RecViz/`. **Verify `frontend/dist/index.html` exists on the server before starting uvicorn.**

### 2.b — `backend/.env` (or the file `RECVIZ_CONFIG_PATH` points at)

The settings loader reads the file named by `RECVIZ_CONFIG_PATH`, falling back to `.env` in the CWD (`config.py:13`). Three fields are **REQUIRED with no default** — missing any one raises `ValidationError` at import (`config.py:17-19`): `recviz_db_url`, `oracle_client_lib_dir`, `recviz_encryption_key`.

Create `/opt/recviz/recviz-prod.env`:
```ini
# REQUIRED — no defaults
RECVIZ_DB_URL=oracle+oracledb://RECVIZ:<RECVIZ_PWD>@<ORACLE_HOST>:1521/?service_name=<SERVICE>
ORACLE_CLIENT_LIB_DIR=/opt/oraclient/19.3_64/lib
RECVIZ_ENCRYPTION_KEY=<the key generated ONCE in step 1.6>

# Frame-ancestors — MUST be the rectrace PORTAL origin the browser sees (NOT RecViz's own origin)
RECVIZ_EMBED_FRAME_ANCESTORS=<RECTRACE_PORTAL>

# CORS — set to a non-empty value (rectrace portal origin is a safe choice)
RECVIZ_CORS_ALLOWED_ORIGINS=<RECTRACE_PORTAL>

# Do NOT set VITE_API_BASE_URL here — it is build-time only, already baked empty in 2.a
```

Why each non-obvious value:
- `RECVIZ_EMBED_FRAME_ANCESTORS` default is `http://localhost:5173` (`config.py:20`) — **not empty.** If you deploy without setting it, the CSP becomes `frame-ancestors 'self' http://localhost:5173` and the prod rectrace iframe is refused **silently** (§5.2). The middleware applies this CSP only to `/embed/*` paths (`framing.py:11`), which is exactly where the dashboard lives.
- `RECVIZ_CORS_ALLOWED_ORIGINS` default is the three localhost origins (`config.py:24`). For the iframe embed itself CORS is **not exercised** (the in-frame API calls are same-origin to `RECVIZ_HOST`), so this is effectively a nice-to-have for this release — but set it to a non-empty value to avoid surprises if anything ever calls the RecViz API cross-origin. An empty string yields `allow_origins=[]`, blocking all cross-origin calls (`main.py:220`).

> **`RECVIZ_CONFIG_PATH` bootstrap trap:** this var must be set in the systemd `Environment=` (§2.f), **not inside the env file it points to** — `config.py:13` reads it at import time. Putting it only inside `recviz-prod.env` means the loader reads `.env` in the CWD instead.

### 2.c — Python venv + dependencies (RHEL)
```bash
cd /opt/recviz/RecViz/backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt        # or --no-index --find-links=<wheelhouse> if no outbound pip
```
Pins include `oracledb>=3.3.0`, `fastapi`, `uvicorn`, `sqlalchemy 2.x`, `alembic`, `cryptography`.

### 2.d — Alembic migrations (creates `recviz_*` tables)

Run as the RECVIZ user. `env.py` initializes thick mode and reads `settings.recviz_db_url`, so both env vars below must be exported. The version table is `recviz_alembic_version` (custom, set in `env.py`).
```bash
cd /opt/recviz/RecViz/backend
source .venv/bin/activate
export RECVIZ_CONFIG_PATH=/opt/recviz/recviz-prod.env
export ORACLE_CLIENT_LIB_DIR=/opt/oraclient/19.3_64/lib
alembic -c app/migrations/alembic.ini upgrade head
```
This applies `001_initial_oracle_schema.py` (creates `recviz_connections`, `recviz_datasets`, `recviz_dashboards`, `recviz_charts`, `recviz_data_sources`, `recviz_kpis`) and `002_dataset_filter_mappings_routing.py` (adds the `filter_mappings` + `database_routing` columns the seed script requires).

> **Oracle DDL auto-commits.** If a migration fails partway, earlier statements are already committed — recovery is a manual `DROP`. The migration `001` header warns about this. Confirm `COMPATIBLE >= 12.2` with the DBA (the `IS JSON` check constraint needs it). Verify after:
```bash
# expect at least RECVIZ_CONNECTIONS, RECVIZ_DASHBOARDS, RECVIZ_DATASETS
echo "SELECT table_name FROM user_tables WHERE table_name LIKE 'RECVIZ_%' ORDER BY 1;" | sqlplus -s RECVIZ/<pwd>@<service>
```

### 2.e — Seed the dashboard with `setup-tlm-citi.py`

**Use `scripts/setup-tlm-citi.py`. Do NOT use `seed-oracle.py`** — `seed-oracle.py` is a dev-only seeder that **hard-refuses when `RECVIZ_ENV=production`** (`seed-oracle.py:38-39 → sys.exit("REFUSE: RECVIZ_ENV=production")`) and hardcodes only `TLMP_CONSUMER → tcosprd` in its `TLM_INSTANCE_MAPPING` (line 1277). `setup-tlm-citi.py` is the purpose-built Citi prod seeder: it is config-driven, has **no** prod guard, and creates exactly the IDs the rectrace cell embed hardcodes — `dash-tlm-stats`, `ds-tlm-automatch`, `ds-tlm-breaks`, `ds-tlm-manual-match` (docstring + `setup-tlm-citi.py:73-76`). **Do not change these IDs.** It does **not** create `dash-quickrec-stats` (TLM only).

**1) Create `scripts/citi-tlm.json`** from `scripts/setup-tlm-citi.config.example.json`. Fill the `reconmgmt` block and **one `tlm_instances` entry per LIVE TLM instance** (the example ships `TLMP_INV` + `TLMP_SNPB` as samples). Because this seeder is config-driven, the only mapping that exists is the one you write — **every TLM instance a user can click must appear here**, or the query fails at runtime with `Database '<name>' not registered` (§5.6).
```json
{
  "password_script_path": "/opt/rectify/control/scripts/get_password.sh",
  "reconmgmt": {
    "host": "<RECONMGMT_HOST>", "port": 1521,
    "service_name": "<RECONMGMT_SERVICE>",
    "username": "<RECONMGMT_USER>", "schema_name": "<RECONMGMT_SCHEMA>"
  },
  "tlm_instances": {
    "TLMP_INV":  { "host": "<HOST>", "port": 1521, "service_name": "<SVC>", "username": "<USER>", "schema_name": "<SCHEMA>" },
    "TLMP_SNPB": { "host": "<HOST>", "port": 1521, "service_name": "<SVC>", "username": "<USER>", "schema_name": "<SCHEMA>" }
    // add every additional live instance (TLMP_ASIA, TLMP_INV, TLMP_CONSUMER, …) here
  }
}
```
Key facts about the config:
- The `tlm_instances` **key** (e.g. `TLMP_INV`) is the value the dashboard `tlm_instance` filter shows AND the dynamic-routing key; it is uppercased at load. The stored connection `name` is the lowercased key.
- `schema_name` defaults to `username` if omitted (`setup-tlm-citi.py:472`). If the schema owner differs from the connecting user, set `schema_name` **explicitly** — otherwise the password script is called with the wrong schema arg.
- Per-connection `password` is **optional**: omit it (Citi VM pattern) to fetch via the password script, which is invoked as `get_password.sh <SERVICE_NAME_UPPER> <SCHEMA_NAME_UPPER>` (verified `setup-tlm-citi.py:527,590-591` — service first, schema second). Or add a literal `"password"` to hardcode (local override).

**2) Export the env (the Fernet key MUST match `recviz-prod.env`)** and dry-run first:
```bash
cd /opt/recviz/RecViz
source backend/.venv/bin/activate
export RECVIZ_DB_URL='oracle+oracledb://RECVIZ:<RECVIZ_PWD>@<ORACLE_HOST>:1521/?service_name=<SERVICE>'
export RECVIZ_ENCRYPTION_KEY='<the SAME key from step 1.6 / recviz-prod.env>'
export ORACLE_CLIENT_LIB_DIR=/opt/oraclient/19.3_64/lib

python scripts/setup-tlm-citi.py --config scripts/citi-tlm.json --dry-run
```
Pre-flight verifies: catalog DB reachable → `recviz_*` tables present → thick-mode init → password resolution → each Citi connection reachable + expected tables visible → row-collision check. **Any pre-flight error aborts before any write.**

**3) Apply** (drop `--dry-run`; `--yes` skips the interactive prompt, which only accepts the literal `yes`):
```bash
python scripts/setup-tlm-citi.py --config scripts/citi-tlm.json --yes
```
Writes are wrapped in a single transaction (rolls back as a unit on failure). On a **re-run after collision**, the default is to abort; pass `--overwrite` to `DELETE`-then-`INSERT` existing rows by name/id. Always `--overwrite --dry-run` first to see what would be deleted.

### 2.f — Run uvicorn under systemd

**Single worker only, no `--reload`.** The app uses sync SQLAlchemy with in-process state — `ConnectionStatusTracker` and `EngineManager` live in `app.state` per process; multiple workers each get independent pools/state and inconsistent connection status (§5.3). `LD_LIBRARY_PATH` must include the Instant Client dir for transitive `.so` resolution.

`/etc/systemd/system/recviz.service`:
```ini
[Unit]
Description=RecViz FastAPI service
After=network.target

[Service]
Type=simple
User=recviz
WorkingDirectory=/opt/recviz/RecViz/backend

# RECVIZ_CONFIG_PATH MUST be here, not inside the file it points to (bootstrap)
Environment=RECVIZ_CONFIG_PATH=/opt/recviz/recviz-prod.env
Environment=ORACLE_CLIENT_LIB_DIR=/opt/oraclient/19.3_64/lib
Environment=LD_LIBRARY_PATH=/opt/oraclient/19.3_64/lib

ExecStart=/opt/recviz/RecViz/backend/.venv/bin/uvicorn app.main:app \
    --host 0.0.0.0 --port 8000 --workers 1

Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now recviz
sudo journalctl -u recviz -f
```
Watch the startup log for: thick-mode init, `Oracle client driver: …` (not `thn`), one "pre-warmed engine" per connection, the health-check sweep result, and the resolver sync. A connection marked **unreachable** in the sweep is usually a Fernet-key mismatch (§5.1), wrong password, or unreachable Oracle host — it does **not** crash the server, but every query to it will fail.

---

## 3. WIRE THE INTEGRATION (two origin values, opposite directions)

There are exactly two origin values, and they point in opposite directions. Getting them swapped is the most common integration mistake.

**Value 1 — `app.recviz.origin` = the RecViz origin, set on the RECTRACE side.**
- Placeholder: `application-prod.properties:72` → `app.recviz.origin=<CITI_RECVIZ_ORIGIN>`.
- `ConfigController` reads `@Value("${app.recviz.origin:}")` (line 29-30) and serves `GET /rectrace/api/config → {"recvizOrigin":"…"}` (line 34). The React app fetches it once on module load and caches it (`recvizConfig.ts:25-31,41`).
- **No jar rebuild needed.** Spring relaxed binding lets you override at runtime via env var on the `java -jar` line:
  ```bash
  export APP_RECVIZ_ORIGIN=<RECVIZ_HOST>      # e.g. http://recviz.citi.intra:8000
  java -jar rectrace.jar --spring.profiles.active=prod
  ```
  (Or edit line 72 and rebuild — either works; the env-var override avoids a rebuild.)
- **Empty-string trap:** if the placeholder is left unfilled, `/rectrace/api/config` returns `{"recvizOrigin":""}`, and `recvizConfig.ts:30` discards empty strings (`cfg.recvizOrigin.length > 0`), silently falling back to `http://localhost:8000` → every iframe 404s with no UI error (§5.4). **Verify the config endpoint returns a non-empty origin (§4).**

**Value 2 — `RECVIZ_EMBED_FRAME_ANCESTORS` = the rectrace PORTAL origin, set on the RECVIZ side.**
- Set in `recviz-prod.env` (§2.b) to `RECTRACE_PORTAL` — the origin the **browser** loads rectrace from (portal/proxy URL if one fronts rectrace, including correct `http`/`https` and port).
- Enforced by `XFrameOptionsMiddleware` (`main.py:233`) + `framing.py:8-14`: for `/embed/*` paths it emits `Content-Security-Policy: frame-ancestors 'self' <ancestors>`. The dashboard URL `/embed/dashboards/dash-tlm-stats` matches, so it always gets the CSP header.
- A wrong or default value here is the **silent blank-iframe** failure (§5.2) — the browser refuses the frame and `onError` does **not** fire (`RecvizEmbed.tsx` NOTE at ~line 88-93).

Note: rectrace's own `app.cors.allowed-origins` (prod placeholder `<CITI_PORTAL_ORIGIN>`, line 77) does **not** need the RecViz origin — the embed never makes a cross-origin XHR back to rectrace.

---

## 4. VERIFY

**4.1 RecViz is up (thick mode):**
```bash
curl -s <RECVIZ_HOST>/health
# expect: {"status":"healthy","driver":"python-oracledb","mode":"thick"}
```

**4.2 Dashboard seeded:**
```bash
curl -s <RECVIZ_HOST>/api/dashboards/managed/dash-tlm-stats   # expect JSON with id "dash-tlm-stats"
```

**4.3 rectrace knows the RecViz origin (non-empty!):**
```bash
curl -s <RECTRACE_PORTAL>/rectrace/api/config
# expect: {"recvizOrigin":"<RECVIZ_HOST>"}   — if "" , fix APP_RECVIZ_ORIGIN before continuing
```

**4.4 frame-ancestors CSP carries the rectrace portal origin:**
```bash
curl -s -I "<RECVIZ_HOST>/embed/dashboards/dash-tlm-stats" | grep -i content-security-policy
# expect: Content-Security-Policy: frame-ancestors 'self' <RECTRACE_PORTAL>
```

**4.5 End-to-end (browser, DevTools open):** log into rectrace, find a recon/TLM row, click the TLM-stats cell. The modal opens and the iframe loads `<RECVIZ_HOST>/embed/dashboards/dash-tlm-stats?filter.tlm_instance=…&filter.lock=…&theme=…`, rendering live Citi data.

### Failure-triage table

| Symptom in browser | Most likely cause | Fix |
|---|---|---|
| Modal opens, brief skeleton, then **blank white iframe**, no error/Retry. Console: `Refused to display … 'frame-ancestors'` | `RECVIZ_EMBED_FRAME_ANCESTORS` wrong/default/scheme-mismatch (§5.2). `onError` never fires for CSP refusals | Set `RECVIZ_EMBED_FRAME_ANCESTORS` to the exact origin in the console message (right scheme/host/port); restart RecViz |
| Modal shows **"could not be loaded" + Retry** | Resource-level failure: RecViz down, or origin wrong so the browser can't connect (`onError` path) | Check `/health`; confirm `/rectrace/api/config` returns the right non-empty origin; check the iframe request in Network |
| iframe 404s / falls back to `localhost:8000` | `app.recviz.origin` unfilled → `{"recvizOrigin":""}` discarded (§5.4) | Set `APP_RECVIZ_ORIGIN` (no rebuild) and restart rectrace; re-verify 4.3 |
| iframe HTML itself 404s | `frontend/dist/` missing on server → SPA serving disabled (§5.7) | Place built `dist/` at `…/RecViz/frontend/dist/index.html`; restart uvicorn |
| Dashboard renders but **KPIs all 0 / empty** | TLM/recon Oracle connection misconfigured, unreachable host, or wrong source schema | Check RecViz logs for SQL errors; confirm `recviz_connections.status='connected'`; verify §1.4 grants |
| Error on a specific instance: `Database '<X>' not registered` | That `tlm_instance` was never listed in `citi-tlm.json` (§5.6) | Add the instance block, re-run `setup-tlm-citi.py --overwrite` |
| RecViz won't boot: `FATAL: Oracle thick mode not detected` | Missing `v$session_connect_info` grant, or missing/wrong Instant Client | Apply §1.3 grant; verify `ORACLE_CLIENT_LIB_DIR`/`LD_LIBRARY_PATH` |

---

## 5. GOTCHAS / EDGE CASES (first prod run)

**5.1 Fernet key must match the seed — silent, highest-risk footgun.** `RECVIZ_ENCRYPTION_KEY` is used at two independent moments: seed time (`setup-tlm-citi.py` encrypts each password) and runtime (`EngineManager.get_engine_for_connection` → `EncryptionService` decrypt; `EncryptionService` is constructed at `main.py:106`). If they differ, decryption raises `cryptography.fernet.InvalidToken`. RecViz **still starts** (the pre-warm loop catches the exception and marks the connection `unreachable`), but every TLM data query 500s — you only notice when a user clicks a cell. Generate the key **once** (§1.6), put the same value in `recviz-prod.env` and the seed env, and **never rotate** after seeding. Spot-check: `encrypted_password` should be a long base64url string starting `gAAAAA`. (Recovery if rotated: re-run `setup-tlm-citi.py --overwrite` with the new key.)

**5.2 frame-ancestors silent refusal.** Wrong `RECVIZ_EMBED_FRAME_ANCESTORS` (including the `http://localhost:5173` default, or an `http`/`https` or port mismatch vs the real portal) → browser refuses the frame, renders its own block page, and **fires `onLoad`, not `onError`** (`RecvizEmbed.tsx` NOTE ~line 88-93). The user sees a blank frame with no error and no retry; the only signal is the DevTools console. There is no timeout-based fallback in this release (flagged as a Phase-4 item). **Test this explicitly per §4.5** — don't trust the absence of an error toast.

**5.3 Single uvicorn worker, no `--reload`.** In-process `EngineManager` / `ConnectionStatusTracker` state means `--workers >1` gives inconsistent connection status across requests. `--reload` is a dev file-watcher, unsafe in prod. Keep `--workers 1`.

**5.4 `app.recviz.origin` empty-string fallback.** Unfilled placeholder → React silently falls back to `localhost:8000` (every iframe 404s). It is recoverable **without a jar rebuild** via `APP_RECVIZ_ORIGIN` (§3). Always confirm via §4.3.

**5.5 Instant Client `LD_LIBRARY_PATH`.** `ORACLE_CLIENT_LIB_DIR` tells oracledb where to `dlopen`, but `LD_LIBRARY_PATH` must also include that dir so transitive `.so` deps resolve at runtime. Set both in the systemd unit (§2.f).

**5.6 List every live TLM instance in `citi-tlm.json`.** `setup-tlm-citi.py` is config-driven — it seeds exactly the instances you list. Any `tlm_instance` a user can click that you didn't seed → `ValueError: Database '<name>' not registered` at query time → iframe shows the RecViz error state. (This is the real shape of the "incomplete mapping" risk — it does **not** come from a hardcoded list in this seeder, unlike `seed-oracle.py`.) Cross-check the full live instance set with the legacy Java map in `rectrace-tlm-stats/.../TlmStatsV2Service.java` (~lines 38-63) and seed all of them.

**5.7 `frontend/dist/` must be present before uvicorn starts.** Missing → SPA silently disabled (`main.py:279`), iframe HTML 404s. Verify `…/RecViz/frontend/dist/index.html` on the server.

**5.8 Keep `VITE_API_BASE_URL` empty at build.** Same-origin deploy; a non-empty value bakes a wrong host into the bundle. It is build-time only — do not put it in the server env file.

**5.9 QuickRec is deferred — TLM only.** `setup-tlm-citi.py` creates only `dash-tlm-stats` (no `dash-quickrec-stats`). The rectrace QuickRec cell (`quickRecStatsButtonRenderer`) will still render and, when clicked, build an embed URL for `dash-quickrec-stats` — which RecViz will **404** (or, depending on routing, error). To avoid a confusing broken cell in prod, **hide/disable the QuickRec stats column** in `search-config-v4.json` for this release, or accept that clicking it shows a "dashboard not found" state until the QuickRec dashboard is seeded in a later stage. This is a config-only decision on the rectrace side; flag it to the product owner before go-live.

**5.10 `--overwrite` re-runs delete by name/id.** Re-running the seed after a partial/failed run aborts by default (the unique `name` constraint would otherwise reject the second insert). Use `--overwrite` to DELETE-then-INSERT, and always `--overwrite --dry-run` first to see the deletions.

---

### Hard blockers vs nice-to-haves

**Hard blockers (RecViz won't boot or embed won't work):** Instant Client + `ORACLE_CLIENT_LIB_DIR`/`LD_LIBRARY_PATH` (§1.1, 5.5); `v$session_connect_info` grant (§1.3); the three required `.env` keys (§2.b); Alembic tables before seed (§2.d); Fernet-key match (§5.1); `app.recviz.origin` filled (§3/§5.4); `RECVIZ_EMBED_FRAME_ANCESTORS` = real portal origin (§3/§5.2); single worker (§5.3); `frontend/dist/` present (§5.7); every live TLM instance seeded (§5.6).

**Nice-to-haves / lower risk for this release:** `RECVIZ_CORS_ALLOWED_ORIGINS` (not exercised by the same-origin iframe, but set it non-empty anyway); `get_password.sh` (only if you don't hardcode passwords in the JSON); hiding the QuickRec cell (§5.9 — cosmetic but recommended to avoid a broken-looking button).

**Key files referenced:** RecViz — `backend/app/main.py` (`:24` lib-dir, `:32` thick init, `:80-98` startup assertion, `:220` CORS split, `:230-236` XFrame middleware, `:277-290` dist mount), `backend/app/config.py` (`:13` config-path, `:17-24` settings + defaults), `backend/app/middleware/framing.py` (`:8-14`), `scripts/setup-tlm-citi.py` (`:73-76` IDs, `:472` schema default, `:527/590-591` password-script args, `:833-838` flags), `scripts/setup-tlm-citi.config.example.json`, `scripts/seed-oracle.py` (`:38-39` prod refuse — **do not use**), `backend/app/migrations/versions/001_*.py`, `002_*.py`, `migrations/env.py`. rectrace — `backend/rectrace/src/main/resources/application-prod.properties` (`:72` `app.recviz.origin`, `:77` cors), `controller/ConfigController.java` (`:29-34`), `frontend-react/src/search/recviz/recvizConfig.ts` (`:30` empty-string discard, `:41` eager fetch), `frontend-react/src/search/RecvizEmbed.tsx` (onLoad/onError silent-refusal NOTE ~`:88-93`).