# Rectrace — Citi VM Deployment Guide

End-to-end steps to clone, configure, build, and run **rectrace** on a Citi Linux VM. The frontend is bundled into the Spring Boot jar; you deploy ONE service.

> **Sibling app**: rectrace's TLM-stats modal embeds dashboards from **RecViz** (separate repo: `aarun1811/RecStats`). Deploy RecViz first or in parallel — see `RecViz/DEPLOY.md`. Rectrace's frontend needs to know RecViz's URL (covered in step 4 below).

---

## 1. Prerequisites on the Citi VM

| Item | Version | Why |
|---|---|---|
| Java JDK | 21 | Spring Boot 3.5.14 + Java 21 modernization (Phase 1) |
| Maven | 3.6+ | Build the backend |
| Node.js | 20+ | Build the React frontend |
| pnpm | 9+ | Frontend package manager (`npm i -g pnpm@9`) |
| Oracle wallet directory | n/a | Required for `jdbc:oracle:thin:@...?TNS_ADMIN=<path>` URLs |
| Citi CA truststore | n/a | For HTTPS Oracle / Elasticsearch (`-Djavax.net.ssl.trustStore=...`) |
| Citi password-fetch script | n/a | Sources env vars from your secrets vault (CyberArk / equivalent) |

Recommend a service user (e.g. `rectrace`) with home directory `/opt/rectrace`. All paths below assume this.

---

## 2. Clone + checkout

```bash
# As the rectrace service user
cd /opt/rectrace
git clone git@github.com:aarun1811/autosys-job-explorer.git rectrace
cd rectrace
git checkout main
```

To update later: `git pull origin main` from `/opt/rectrace/rectrace`.

---

## 3. One-time config changes — `application.properties`

The base `backend/rectrace/src/main/resources/application.properties` currently has dev-only values inlined (a local macOS Wallet path, a literal TNS alias, etc.). Replace those with env-var placeholders so the deployed jar reads from env vars at startup.

### 3.1 Edit `backend/rectrace/src/main/resources/application.properties`

Find these lines and change them as shown:

| Line | Current (dev) | Change to (env-driven) |
|---|---|---|
| 10 | `datasource.url=jdbc:oracle:thin:@sy2i7xwjpd05u21s_high?TNS_ADMIN=/Users/arun/Workspace/Keys/Wallet_SY2I7XWJPD05U21S` | `datasource.url=${RECTRACE_DB_URL:}` |
| 11 | `datasource.username=ADMIN` | `datasource.username=${RECTRACE_DB_USER:}` |
| (new) | (no `datasource.password=`) | Add `datasource.password=${RECTRACE_DB_PASSWORD:}` |
| 13 | `datasource.service-name=SY2I7XWJPD05U21S` | `datasource.service-name=${RECTRACE_DB_SERVICE:}` |
| 14 | `datasource.db-schema=RECTRACE` | `datasource.db-schema=${RECTRACE_DB_SCHEMA:RECTRACE}` |
| 17 | `spring.elasticsearch.uris=https://localhost:9200` | `spring.elasticsearch.uris=${RECTRACE_ES_URIS:}` |
| 18 | `spring.elasticsearch.username=username` | `spring.elasticsearch.username=${RECTRACE_ES_USERNAME:}` |
| 19 | `spring.elasticsearch.password=password` | `spring.elasticsearch.password=${RECTRACE_ES_PASSWORD:}` |
| 29 | `autosys.db.url=jdbc:oracle:thin:@sy2i7xwjpd05u21s_high?TNS_ADMIN=/Users/arun/Workspace/Keys/Wallet_SY2I7XWJPD05U21S` | `autosys.db.url=${AUTOSYS_DB_URL:}` |
| 30 | `autosys.db.username=ADMIN` | `autosys.db.username=${AUTOSYS_DB_USER:}` |

`autosys.db.password` on line 35 already uses the env-var pattern (`${AUTOSYS_DB_PASSWORD:}`) — leave as is.

> Move the current literal values into `application-local.properties` if you want to preserve your local dev loop (Mac + sibling `rectrace-local-dev` Docker stack).

### 3.2 Fill in `application-prod.properties` (and `-uat.properties`)

The file currently only has CORS + Splunk placeholders. Replace `<TO_BE_FILLED>` with real values:

```properties
# Splunk HEC — real Citi prod values
splunk.hec.host=<citi-prod-splunk-host>
splunk.hec.port=<port, typically 9997>
# Token only used when Splunk flips to HTTPS-HEC — leave as <TO_BE_FILLED> for now
splunk.hec.token=<TO_BE_FILLED>

# CORS allow-list — comma-separated, prod portal origin(s)
app.cors.allowed-origins=https://portal.citi.intra,https://rectrace.citi.intra

# RecViz origin — where rectrace's React app loads the embedded TLM/QuickRec dashboards from
app.recviz.origin=${RECVIZ_ORIGIN_PROD:}
```

Duplicate the same shape into `application-uat.properties` with `_UAT` suffixes on env vars and UAT-appropriate URLs.

---

## 4. Tell the React frontend where RecViz lives

**This is already implemented — you only need to set `app.recviz.origin`.** The backend `ConfigController` already exposes `GET /rectrace/api/config` → `{"recvizOrigin": ...}` (from `@Value("${app.recviz.origin:}")`), and `frontend-react/src/search/recviz/recvizConfig.ts` already fetches `/rectrace/api/config` at boot and caches it (falling back to `VITE_RECVIZ_ORIGIN`, then `http://localhost:8000`). So a single jar works across environments — just set `app.recviz.origin` per profile (step 3.2 / the `RECVIZ_ORIGIN_*` env var in step 5).

> **⚠ Blocker — `app.recviz.origin` is NOT yet committed in any `application-*.properties`.** Until you add it (step 3.2), `ConfigController` returns an empty string and the React app falls back to `http://localhost:8000`, so TLM/QuickRec cell clicks embed a dead URL. Add `app.recviz.origin=${RECVIZ_ORIGIN_PROD:}` (and the UAT equivalent).

> **⚠ Blocker — RecViz CORS + frame-ancestors must list this origin.** RecViz currently **hardcodes** its allowed CORS origins to `localhost:5173/3000/4200` (`RecViz/backend/app/main.py:219`) and **ignores** the `RECVIZ_CORS_ALLOWED_ORIGINS` env var. RecViz's embed framing is driven by `RECVIZ_EMBED_FRAME_ANCESTORS` (default `http://localhost:5173`). For a non-localhost rectrace origin you must EITHER patch RecViz to read the env var, OR serve RecViz same-origin behind a reverse proxy (making CORS moot). Set `RECVIZ_EMBED_FRAME_ANCESTORS` to the rectrace origin regardless.

> **⚠ Also seed the RecViz dashboards** `dash-tlm-stats` and `dash-quickrec-stats` per environment via `RecViz/scripts/seed-oracle.py` — the rectrace renderers hardcode those IDs; without the seed, cell clicks 404.

---

## 5. Set up env vars (via Citi password-fetch script)

Citi's existing password-retrieval script needs to export these. The exact script name is org-specific — wrap it in `/opt/rectrace/config/rectrace-env.sh`:

```bash
#!/bin/bash
# Sources Citi's password-fetch script + sets all rectrace env vars.
# Called by systemd before starting the service.

# Adjust path to Citi's actual script
source /opt/citi/cyberark/fetch-secret.sh rectrace-prod

# Oracle (production)
export RECTRACE_DB_URL="jdbc:oracle:thin:@<prod_tns_alias>?TNS_ADMIN=/opt/rectrace/oracle-wallet"
export RECTRACE_DB_USER="<prod_user>"
# RECTRACE_DB_PASSWORD set by the fetch-secret.sh above
export RECTRACE_DB_SERVICE="<prod_service_name>"

# Elasticsearch
export RECTRACE_ES_URIS="https://<prod_es_host>:9200"
export RECTRACE_ES_USERNAME="<es_user>"
# RECTRACE_ES_PASSWORD set by the fetch-secret.sh above

# Autosys DB
export AUTOSYS_DB_URL="jdbc:oracle:thin:@<autosys_tns_alias>?TNS_ADMIN=/opt/rectrace/oracle-wallet"
export AUTOSYS_DB_USER="<autosys_user>"
# AUTOSYS_DB_PASSWORD set by the fetch-secret.sh above

# RecViz origin (where the embedded dashboards live)
export RECVIZ_ORIGIN_PROD="https://recviz.citi.intra"

# Spring profile
export SPRING_PROFILES_ACTIVE="prod"
```

`chmod 700 /opt/rectrace/config/rectrace-env.sh` so only the service user can read it.

---

## 6. Oracle wallet

Copy the Citi prod Oracle wallet (cwallet.sso, ewallet.p12, tnsnames.ora, sqlnet.ora) into:

```
/opt/rectrace/oracle-wallet/
```

The JDBC URLs in step 5 use `TNS_ADMIN=/opt/rectrace/oracle-wallet` — they'll read the wallet from there.

If you use TLS for Oracle, ensure `sqlnet.ora` in the wallet has `SSL_SERVER_DN_MATCH=YES` and the wallet location is set correctly.

---

## 7. Build

From `/opt/rectrace/rectrace`:

```bash
# 7.1 Build the React frontend into dist/
cd frontend-react
pnpm install --frozen-lockfile
pnpm build

# 7.2 Copy frontend dist into backend's static resources
cd ..
ops/build.sh react

# 7.3 Build the Spring Boot jar (tests skipped for deploy)
cd backend/rectrace
mvn clean package -DskipTests
# Output: target/rectrace-*.jar
```

The jar at `backend/rectrace/target/rectrace-*.jar` now contains both backend code + frontend bundle. Move it to a stable path:

```bash
cp target/rectrace-*.jar /opt/rectrace/rectrace.jar
```

---

## 8. Run

### Manual (smoke-test the deploy)

```bash
source /opt/rectrace/config/rectrace-env.sh
java -jar /opt/rectrace/rectrace.jar
```

You should see Spring Boot start; the app listens on `http://localhost:6088`.

### systemd (for production)

Create `/etc/systemd/system/rectrace.service`:

```ini
[Unit]
Description=Rectrace Spring Boot service
After=network.target

[Service]
Type=simple
User=rectrace
Group=rectrace
WorkingDirectory=/opt/rectrace
EnvironmentFile=-/opt/rectrace/config/rectrace.env
# OR source the password-fetch wrapper inside an ExecStartPre:
ExecStartPre=/bin/bash -c 'source /opt/rectrace/config/rectrace-env.sh && env | grep -E "^(RECTRACE_|AUTOSYS_|RECVIZ_|SPRING_)" > /opt/rectrace/config/rectrace.env'
ExecStart=/usr/bin/java -jar /opt/rectrace/rectrace.jar
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable rectrace
sudo systemctl start rectrace
sudo systemctl status rectrace
```

> The `ExecStartPre` trick writes the fetched env into a file that `EnvironmentFile=` reads. If your Citi password script lets systemd source it directly (via `EnvironmentFile=`), use that instead.

---

## 9. Verify

```bash
# Health (anonymous returns just status; details when authorized)
curl http://localhost:6088/rectrace/actuator/health

# Search config (proves the JSON file loaded + Oracle reachable)
curl http://localhost:6088/rectrace/api/v4/search/config | python -m json.tool | head -20

# The React UI
# Open in a browser pointed at this VM:
#   http://<vm-host>:6088/rectrace/
```

Expected:
- `/actuator/health` → `{"status":"UP"}`
- `/api/v4/search/config` → JSON with `categories: [...]`
- The React shell loads at `/rectrace/`

---

## 10. Re-deploy (when you push new commits)

```bash
cd /opt/rectrace/rectrace
git pull origin main
cd frontend-react && pnpm install --frozen-lockfile && pnpm build
cd .. && ops/build.sh react
cd backend/rectrace && mvn clean package -DskipTests
cp target/rectrace-*.jar /opt/rectrace/rectrace.jar
sudo systemctl restart rectrace
```

Or wrap as `/opt/rectrace/deploy.sh` and `sudo` it.

---

## 11. Logs

systemd journal captures stdout/stderr:

```bash
sudo journalctl -u rectrace -f                  # tail live
sudo journalctl -u rectrace --since "1 hour ago"
```

In production, Spring Boot's logback-spring.xml is configured for **Splunk HEC** (Phase 7). Logs flow to Splunk based on `splunk.hec.host` and `splunk.hec.port` in `application-prod.properties` — verify they reach Splunk after deploy.

---

## 12. Common issues

| Symptom | Cause | Fix |
|---|---|---|
| `ORA-12541: TNS: no listener` | Wallet path wrong | Verify `TNS_ADMIN` env / JDBC URL param points at the wallet directory and that `tnsnames.ora` is there |
| `/actuator/health` returns 503 (status DOWN) | A health indicator failing — most often the `loaderRunAge` indicator on a freshly-deployed app where the ES loader hasn't run yet | Either wait for the next ShedLock-scheduled load OR run the loader once via `/api/v4/loader-admin/run` |
| `400 Bad Request` on `/api/v4/search/...` | `search-config-v4.json` not on the classpath OR malformed | Confirm it's in `src/main/resources/` and the jar was rebuilt after edits |
| Cells render but no TLM modal opens on click | Frontend can't reach RecViz origin | Verify `app.recviz.origin` value in the active profile + that RecViz is running at that URL |
| `Failed to determine a suitable driver class` | OracleDriver not on classpath | The Maven pom includes `com.oracle.database.jdbc:ojdbc8` — verify the dependency wasn't excluded |
| CORS errors in browser | Origin not in `app.cors.allowed-origins` | Add the calling origin to the comma-separated list and restart |
| App fails to boot under the UAT profile (`InvalidConfigDataPropertyException`) | `application-uat.properties:2` sets `spring.profiles.active=uat` — forbidden in a profile-specific file (Boot 3.x) | Remove that line; activate the profile via the `SPRING_PROFILES_ACTIVE=uat` env var (step 5) instead |
| RecViz iframe stuck on "loading"; console shows a `frame-ancestors`/CORS refusal | rectrace origin not allowed by RecViz | Patch RecViz CORS (`RecViz/backend/app/main.py:219`) + set `RECVIZ_EMBED_FRAME_ANCESTORS` to the rectrace origin, or proxy RecViz same-origin (step 4) |
| TLM/QuickRec modal opens but shows a 404 / empty dashboard | RecViz dashboards not seeded in this env | Run `RecViz/scripts/seed-oracle.py` to create `dash-tlm-stats` / `dash-quickrec-stats` |

---

## Appendix: env vars cheat sheet

These are the env vars the active profile reads. Set them via the Citi password-fetch wrapper (`/opt/rectrace/config/rectrace-env.sh`).

| Var | Example | Used by |
|---|---|---|
| `RECTRACE_DB_URL` | `jdbc:oracle:thin:@<tns>?TNS_ADMIN=/opt/rectrace/oracle-wallet` | rectrace main DB |
| `RECTRACE_DB_USER` | `RECTRACE_PROD` | |
| `RECTRACE_DB_PASSWORD` | (secret) | |
| `RECTRACE_DB_SERVICE` | `RECTRACE_PROD_SVC` | |
| `RECTRACE_DB_SCHEMA` | `RECTRACE` (default) | |
| `RECTRACE_ES_URIS` | `https://es.citi.intra:9200` | Search index |
| `RECTRACE_ES_USERNAME` | `rectrace_es` | |
| `RECTRACE_ES_PASSWORD` | (secret) | |
| `AUTOSYS_DB_URL` | similar to RECTRACE_DB_URL | Autosys metadata DB (Phase 1) |
| `AUTOSYS_DB_USER` / `AUTOSYS_DB_PASSWORD` | | |
| `RECVIZ_ORIGIN_PROD` | `https://recviz.citi.intra` | The React app's embed URLs (step 4) |
| `SPRING_PROFILES_ACTIVE` | `prod` or `uat` | Picks the right `application-<env>.properties` |

---

For the embedded TLM / QuickRec dashboard side, see **`RecViz/DEPLOY.md`** in the sibling repo.
