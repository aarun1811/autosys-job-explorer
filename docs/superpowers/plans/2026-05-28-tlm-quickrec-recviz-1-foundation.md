# RecViz Embed Foundation — Implementation Plan (Plan 1 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make RecViz managed datasets carry server-side `filter_mappings` and `database_routing`, and allow cross-origin framing of `/embed/*`, so that embedded dashboards filtered by URL (`?filter.recon_id=X`) actually narrow the SQL and TLM instance routing works — the shared prerequisite for the QuickRec and TLM dashboards.

**Architecture:** RecViz's `query_engine` already consumes `filter_mappings` + `database_routing` (`_build_sql`, `_resolve_database`), but the persistence path gates them off: `RecvizDataset` lacks the columns, `ConfigStore._build_config` hardcodes `filter_mappings=[]`/`static`, the seed strips `{{filters}}`, and the API contract omits them. This plan adds the two JSON columns (+ Alembic migration), wires `ConfigStore` and the managed-dataset CRUD/seed to persist & apply them, and replaces the blanket `X-Frame-Options: SAMEORIGIN` with a per-environment CSP `frame-ancestors` allow-list on `/embed/*`. It also registers a RecViz connection to the local `recportal` schema (QuickRec's data).

**Tech Stack:** FastAPI, SQLAlchemy 2 (sync), Alembic, oracledb (thick), Pydantic 2 (`CamelModel`), pytest + in-memory SQLite for tests.

**Repo & branch:** ALL work is in the **RecViz repo** `/Users/aarun/Workspace/Projects/recviz`, on a **dedicated feature branch** (per project rule — RecViz changes never go on its `main`). RecViz API runs on `:8000`, frontend on `:5173`.

**Spec:** `docs/superpowers/specs/2026-05-28-tlm-quickrec-recviz-modals-design.md` (this is §12.10 + §5.5 + §12.2).

**Test/run commands (RecViz backend, from `recviz/backend/`):**
- Tests: `cd /Users/aarun/Workspace/Projects/recviz/backend && PYTHONPATH=. pytest tests/ -v`
- Server: `cd /Users/aarun/Workspace/Projects/recviz/backend && uvicorn app.main:app --reload --port 8000`
- Migrations: `cd /Users/aarun/Workspace/Projects/recviz/backend && PYTHONPATH=. alembic -c app/migrations/alembic.ini upgrade head`
- Seed: `cd /Users/aarun/Workspace/Projects/recviz/backend && PYTHONPATH=. python ../scripts/seed-oracle.py`
- Requires env `RECVIZ_ENCRYPTION_KEY`, `RECVIZ_DB_URL`, `ORACLE_CLIENT_LIB_DIR` (see `recviz/backend/.env`). Tests need only `RECVIZ_ENCRYPTION_KEY` (set by `tests/conftest.py`); SQLite is used in-memory.

---

## File Structure

**Created:**
- `recviz/backend/app/migrations/versions/002_dataset_filter_mappings_routing.py` — Alembic migration adding the two JSON columns + IS JSON constraints.
- `recviz/backend/app/middleware/__init__.py` — package marker (if `app/middleware/` doesn't exist).
- `recviz/backend/app/middleware/framing.py` — pure `frame_headers_for_path()` helper (no config import, so unit-testable in isolation).
- `recviz/backend/tests/test_dataset_config_store.py` — ConfigStore + query-engine wiring tests.
- `recviz/backend/tests/test_managed_dataset_crud.py` — CRUD persistence tests.
- `recviz/backend/tests/test_framing.py` — framing-helper tests.

**Modified:**
- `recviz/backend/app/db/models/dataset.py` — add `filter_mappings`, `database_routing` columns.
- `recviz/backend/app/services/config_store.py:36-61` — `_build_config` reads the new columns (fallback to current static behavior).
- `recviz/backend/app/models/managed_dataset.py` — add fields to `DatasetCreate`/`DatasetUpdate`/`DatasetResponse`.
- `recviz/backend/app/api/managed_datasets.py` — persist/read the fields in create/update/`_to_response`.
- `recviz/scripts/seed-oracle.py:3506-3518` — keep `{{filters}}`, persist `filter_mappings` + `database_routing`; add a `recportal` connection.
- `recviz/backend/app/config.py` — add `recviz_embed_frame_ancestors` setting.
- `recviz/backend/app/main.py:225-233` — replace `XFrameOptionsMiddleware` body with the path-aware helper.
- `recviz/backend/tests/conftest.py` — add `RECVIZ_DB_URL` setdefault (needed once a test imports `app.config`/`app.main`).

---

### Task 1: Create the RecViz feature branch

**Files:** none (git only).

- [ ] **Step 1: Create and switch to the branch**

```bash
cd /Users/aarun/Workspace/Projects/recviz
git checkout -b feature/embed-foundation
git status   # Expect: On branch feature/embed-foundation, clean (or only untracked .venv)
```

Expected: branch `feature/embed-foundation` created off whatever RecViz's current branch is. All subsequent commits in this plan land here, never on `main`.

---

### Task 2: Add `filter_mappings` + `database_routing` columns to `RecvizDataset`

**Files:**
- Modify: `recviz/backend/app/db/models/dataset.py`
- Create: `recviz/backend/tests/test_dataset_config_store.py`
- Modify: `recviz/backend/tests/conftest.py`

- [ ] **Step 1: Ensure conftest sets `RECVIZ_DB_URL`** (config_store imports stay safe, but tests in Task 4 import `app.config` transitively via `managed_datasets`).

Replace the body of `recviz/backend/tests/conftest.py` with:

```python
"""Test configuration. Sets required env vars before app modules import at collection."""

from __future__ import annotations

import os

os.environ.setdefault("RECVIZ_ENCRYPTION_KEY", "test-encryption-key-do-not-use-in-prod")
os.environ.setdefault("RECVIZ_DB_URL", "sqlite:///:memory:")
```

- [ ] **Step 2: Write the failing test** (column round-trip on SQLite)

Create `recviz/backend/tests/test_dataset_config_store.py`:

```python
from __future__ import annotations

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.db.base import Base
from app.db.models.connection import RecvizConnection
from app.db.models.dataset import RecvizDataset


@pytest.fixture
def sqlite_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    engine.dispose()


def _seed_conn(session: Session, name: str = "oracle-local") -> RecvizConnection:
    conn = RecvizConnection(
        id="conn-x", name=name, display_name="X", backend="oracle",
        host="localhost", port=1521, database_name="FREEPDB1", username="recviz",
        encrypted_password="x", schema_name="RECVIZ", status="active",
    )
    session.add(conn)
    session.flush()
    return conn


def test_dataset_persists_filter_mappings_and_routing(sqlite_session: Session):
    _seed_conn(sqlite_session)
    ds = RecvizDataset(
        id="ds-x", name="X", database_id="conn-x",
        sql="SELECT 1 FROM t WHERE 1=1 {{filters}}",
        columns=[],
        filter_mappings=[{"filter_id": "recon_id", "sql_expr": "recon_id = '{{value}}'"}],
        database_routing={"type": "static", "database": "oracle-local"},
    )
    sqlite_session.add(ds)
    sqlite_session.flush()
    sqlite_session.expire_all()

    reloaded = sqlite_session.get(RecvizDataset, "ds-x")
    assert reloaded.filter_mappings == [{"filter_id": "recon_id", "sql_expr": "recon_id = '{{value}}'"}]
    assert reloaded.database_routing == {"type": "static", "database": "oracle-local"}
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd /Users/aarun/Workspace/Projects/recviz/backend && PYTHONPATH=. pytest tests/test_dataset_config_store.py::test_dataset_persists_filter_mappings_and_routing -v`
Expected: FAIL — `TypeError: 'filter_mappings' is an invalid keyword argument for RecvizDataset`.

- [ ] **Step 4: Add the columns**

In `recviz/backend/app/db/models/dataset.py`, after the `columns` mapping (line 22), add:

```python
    filter_mappings: Mapped[list] = mapped_column(OracleJSON(), nullable=True, default=None)
    database_routing: Mapped[dict | None] = mapped_column(OracleJSON(), nullable=True, default=None)
```

(`OracleJSON` is already imported at line 4. Both nullable so existing prod rows backfill as NULL; `ConfigStore` coerces NULL → defaults in Task 4. On Oracle, the `IS JSON` check passes for NULL because `NULL IS JSON` evaluates to UNKNOWN.)

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd /Users/aarun/Workspace/Projects/recviz/backend && PYTHONPATH=. pytest tests/test_dataset_config_store.py::test_dataset_persists_filter_mappings_and_routing -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/aarun/Workspace/Projects/recviz
git add backend/app/db/models/dataset.py backend/tests/test_dataset_config_store.py backend/tests/conftest.py
git commit -m "feat(datasets): add filter_mappings + database_routing JSON columns

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 3: Alembic migration 002 for the two columns (prod DDL)

**Files:**
- Create: `recviz/backend/app/migrations/versions/002_dataset_filter_mappings_routing.py`

- [ ] **Step 1: Write the migration**

Create `recviz/backend/app/migrations/versions/002_dataset_filter_mappings_routing.py`:

```python
"""add filter_mappings and database_routing to recviz_datasets

Revision ID: 002
Revises: 001
Create Date: 2026-05-28

Oracle note: each DDL statement auto-commits. If a later statement fails,
earlier ones are already committed; recovery is manual ALTER TABLE DROP COLUMN.
The IS JSON check uses the bare form (matches OracleJSON._set_table); NULL passes
because `NULL IS JSON` evaluates to UNKNOWN, which a CHECK constraint does not reject.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("recviz_datasets", sa.Column("filter_mappings", sa.BLOB(), nullable=True))
    op.add_column("recviz_datasets", sa.Column("database_routing", sa.BLOB(), nullable=True))
    op.create_check_constraint(
        "ck_recviz_datasets_filter_mappings_json", "recviz_datasets", "filter_mappings IS JSON"
    )
    op.create_check_constraint(
        "ck_recviz_datasets_database_routing_json", "recviz_datasets", "database_routing IS JSON"
    )


def downgrade() -> None:
    op.drop_constraint("ck_recviz_datasets_database_routing_json", "recviz_datasets", type_="check")
    op.drop_constraint("ck_recviz_datasets_filter_mappings_json", "recviz_datasets", type_="check")
    op.drop_column("recviz_datasets", "database_routing")
    op.drop_column("recviz_datasets", "filter_mappings")
```

- [ ] **Step 2: Apply the migration against local Oracle and verify**

Run: `cd /Users/aarun/Workspace/Projects/recviz/backend && PYTHONPATH=. alembic -c app/migrations/alembic.ini upgrade head`
Expected: `Running upgrade 001 -> 002`. No error.

Verify the columns exist:
Run: `cd /Users/aarun/Workspace/Projects/recviz/backend && PYTHONPATH=. python -c "import os; import oracledb; oracledb.init_oracle_client(lib_dir=os.environ['ORACLE_CLIENT_LIB_DIR']); c=oracledb.connect(user='recviz', password='recviz_dev', dsn='localhost:1521/FREEPDB1'); cur=c.cursor(); cur.execute(\"SELECT column_name FROM user_tab_columns WHERE table_name='RECVIZ_DATASETS' AND column_name IN ('FILTER_MAPPINGS','DATABASE_ROUTING')\"); print(sorted(r[0] for r in cur))"`
Expected: `['DATABASE_ROUTING', 'FILTER_MAPPINGS']`.

(If local Oracle isn't running, start the sibling stack first per the project's local-dev instructions. The migration is prod DDL; Task 2/4/5 tests don't depend on it — they use SQLite `create_all`.)

- [ ] **Step 3: Commit**

```bash
cd /Users/aarun/Workspace/Projects/recviz
git add backend/app/migrations/versions/002_dataset_filter_mappings_routing.py
git commit -m "feat(db): migration 002 — dataset filter_mappings + database_routing columns

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 4: `ConfigStore._build_config` reads the new columns (with static fallback)

**Files:**
- Modify: `recviz/backend/app/services/config_store.py:36-61`
- Modify: `recviz/backend/tests/test_dataset_config_store.py`

- [ ] **Step 1: Write the failing tests** (ConfigStore surfaces mappings + routing; query engine narrows SQL through them)

Append to `recviz/backend/tests/test_dataset_config_store.py`:

```python
from app.services.config_store import ConfigStore
from app.services.query_engine import QueryExecutor


def test_config_store_surfaces_filter_mappings_and_dynamic_routing(sqlite_session: Session):
    _seed_conn(sqlite_session)
    sqlite_session.add(RecvizDataset(
        id="ds-dyn", name="Dyn", database_id="conn-x",
        sql="SELECT 1 FROM t WHERE 1=1 {{filters}}",
        columns=[{"name": "recon_id", "type": "string"}],
        filter_mappings=[{"filter_id": "recon_id", "sql_expr": "recon_id = '{{value}}'"}],
        database_routing={"type": "dynamic", "route_by_filter": "tlm_instance",
                          "mapping": {"TLMP_CONSUMER": "tcosprd"}},
    ))
    sqlite_session.flush()

    cfg = ConfigStore(sqlite_session).get_data_source("ds-dyn")
    assert cfg.filter_mappings[0].filter_id == "recon_id"
    assert cfg.database_routing.type == "dynamic"
    assert cfg.database_routing.mapping == {"TLMP_CONSUMER": "tcosprd"}


def test_config_store_defaults_to_static_when_routing_null(sqlite_session: Session):
    _seed_conn(sqlite_session)
    sqlite_session.add(RecvizDataset(
        id="ds-legacy", name="Legacy", database_id="conn-x",
        sql="SELECT 1", columns=[], filter_mappings=None, database_routing=None,
    ))
    sqlite_session.flush()

    cfg = ConfigStore(sqlite_session).get_data_source("ds-legacy")
    assert cfg.database_routing.type == "static"
    assert cfg.database_routing.database == "oracle-local"   # = connection.name
    assert cfg.filter_mappings == []


def test_filter_mapping_narrows_generated_sql(sqlite_session: Session):
    _seed_conn(sqlite_session)
    sqlite_session.add(RecvizDataset(
        id="ds-f", name="F", database_id="conn-x",
        sql="SELECT * FROM t WHERE 1=1 {{filters}}", columns=[],
        filter_mappings=[{"filter_id": "recon_id", "sql_expr": "recon_id = '{{value}}'"}],
        database_routing={"type": "static", "database": "oracle-local"},
    ))
    sqlite_session.flush()
    cfg = ConfigStore(sqlite_session).get_data_source("ds-f")

    qe = QueryExecutor(engine_manager=None, connection_resolver=None)
    sql = qe._build_sql(cfg, {"recon_id": "RECON_42"}, dialect="sqlite")
    assert "recon_id = 'RECON_42'" in sql
    assert "{{filters}}" not in sql
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /Users/aarun/Workspace/Projects/recviz/backend && PYTHONPATH=. pytest tests/test_dataset_config_store.py -v`
Expected: the three new tests FAIL — `cfg.filter_mappings` is `[]` and `cfg.database_routing.type` is always `"static"` (hardcoded). The narrow-SQL test fails because `{{filters}}` is stripped to empty.

- [ ] **Step 3: Rewrite `_build_config`**

In `recviz/backend/app/services/config_store.py`, add `FilterMapping` to the import (line 10-14) so it reads:

```python
from app.models.data_source_config import (
    ColumnDef,
    DatabaseRoutingMapping,
    DataSourceConfig,
    FilterMapping,
)
```

Replace the `return DataSourceConfig(...)` block (lines 51-61) with:

```python
        if dataset.database_routing:
            routing = DatabaseRoutingMapping(**dataset.database_routing)
        else:
            routing = DatabaseRoutingMapping(type="static", database=connection.name)

        filter_mappings = [
            FilterMapping(**fm) for fm in (dataset.filter_mappings or [])
        ]

        return DataSourceConfig(
            id=dataset.id,
            name=dataset.name,
            database_routing=routing,
            query=dataset.sql,
            filter_mappings=filter_mappings,
            columns=columns,
        )
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd /Users/aarun/Workspace/Projects/recviz/backend && PYTHONPATH=. pytest tests/test_dataset_config_store.py -v`
Expected: all PASS (including the Task 2 round-trip test).

- [ ] **Step 5: Commit**

```bash
cd /Users/aarun/Workspace/Projects/recviz
git add backend/app/services/config_store.py backend/tests/test_dataset_config_store.py
git commit -m "feat(config): ConfigStore applies dataset filter_mappings + database_routing

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 5: Managed-dataset CRUD + Pydantic contract carry the fields

**Files:**
- Modify: `recviz/backend/app/models/managed_dataset.py`
- Modify: `recviz/backend/app/api/managed_datasets.py`
- Create: `recviz/backend/tests/test_managed_dataset_crud.py`

- [ ] **Step 1: Write the failing test** (create persists mappings/routing; round-trips through response)

Create `recviz/backend/tests/test_managed_dataset_crud.py`:

```python
from __future__ import annotations

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.db.base import Base
from app.db.models.dataset import RecvizDataset


@pytest.fixture
def sqlite_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    engine.dispose()


def test_create_persists_filter_mappings_and_routing(sqlite_session: Session):
    from app.api.managed_datasets import create_managed_dataset
    from app.models.managed_dataset import DatasetCreate

    body = DatasetCreate(
        name="QR Automatch",
        databaseId="conn-recportal",
        sql="SELECT * FROM quickrec_stats_table WHERE 1=1 {{filters}}",
        columns=[{"name": "recon_id", "displayName": "Recon ID", "dataType": "string", "role": "dimension"}],
        filterMappings=[{"filterId": "recon_id", "sqlExpr": "recon_id = '{{value}}'"}],
        databaseRouting={"type": "static", "database": "recportal"},
    )
    resp = create_managed_dataset(body=body, session=sqlite_session)

    assert resp.filter_mappings[0].filter_id == "recon_id"
    assert resp.database_routing.type == "static"

    stored = sqlite_session.get(RecvizDataset, resp.id)
    assert stored.filter_mappings == [{"filterId": "recon_id", "sqlExpr": "recon_id = {{value}}"}]
    assert stored.database_routing == {"type": "static", "database": "recportal"}
```

(Note: `CamelModel` serializes with `by_alias=True`, so the JSON column stores camelCase keys `filterId`/`sqlExpr`. The runtime `FilterMapping` Pydantic model uses snake_case `filter_id`/`sql_expr` — so `ConfigStore` must accept camelCase. We make the API-layer Pydantic models alias-aware in Step 3 and store the snake_case form to match `FilterMapping`. See Step 3 for the exact dump.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/aarun/Workspace/Projects/recviz/backend && PYTHONPATH=. pytest tests/test_managed_dataset_crud.py -v`
Expected: FAIL — `DatasetCreate` has no `filterMappings`/`databaseRouting` fields (Pydantic validation error / unexpected keyword).

- [ ] **Step 3: Add fields to the Pydantic models + persist them**

In `recviz/backend/app/models/managed_dataset.py`, add two `CamelModel` shapes near the top (after `ColumnMetaSchema`):

```python
class FilterMappingSchema(CamelModel):
    filter_id: str
    sql_expr: str


class DatabaseRoutingSchema(CamelModel):
    type: str
    database: str | None = None
    route_by_filter: str | None = None
    mapping: dict[str, str] | None = None
```

Add to `DatasetCreate`:

```python
    filter_mappings: list[FilterMappingSchema] = []
    database_routing: DatabaseRoutingSchema | None = None
```

Add to `DatasetUpdate`:

```python
    filter_mappings: list[FilterMappingSchema] | None = None
    database_routing: DatabaseRoutingSchema | None = None
```

Add to `DatasetResponse`:

```python
    filter_mappings: list[FilterMappingSchema] = []
    database_routing: DatabaseRoutingSchema | None = None
```

In `recviz/backend/app/api/managed_datasets.py` `create_managed_dataset` (line 70-72 area), add to the `RecvizDataset(...)` constructor — storing the **snake_case** form so `ConfigStore`/`FilterMapping` reads cleanly:

```python
        filter_mappings=[fm.model_dump() for fm in body.filter_mappings],
        database_routing=body.database_routing.model_dump() if body.database_routing else None,
```

In `update_managed_dataset`, after the `columns` block add:

```python
    if body.filter_mappings is not None:
        dataset.filter_mappings = [fm.model_dump() for fm in body.filter_mappings]
    if body.database_routing is not None:
        dataset.database_routing = body.database_routing.model_dump()
```

In `_to_response` (line 28-47), add:

```python
        filter_mappings=ds.filter_mappings or [],
        database_routing=ds.database_routing,
```

Update the test's stored-assertion to snake_case (the model dumps without alias by default):

```python
    assert stored.filter_mappings == [{"filter_id": "recon_id", "sql_expr": "recon_id = '{{value}}'"}]
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /Users/aarun/Workspace/Projects/recviz/backend && PYTHONPATH=. pytest tests/test_managed_dataset_crud.py -v`
Expected: PASS.

- [ ] **Step 5: Run the full backend test suite (no regressions)**

Run: `cd /Users/aarun/Workspace/Projects/recviz/backend && PYTHONPATH=. pytest tests/ -v`
Expected: **no NEW failures vs baseline**. NOTE: the pre-existing `tests/test_seed_script.py` is already broken on main (its `_load_seed_module` points at a non-existent `scripts/seed-postgres.py`) — those failures are unrelated to this plan; gate on "this plan's new tests all green + nothing else regressed."

- [ ] **Step 6: Commit**

```bash
cd /Users/aarun/Workspace/Projects/recviz
git add backend/app/models/managed_dataset.py backend/app/api/managed_datasets.py backend/tests/test_managed_dataset_crud.py
git commit -m "feat(api): managed-dataset CRUD persists filter_mappings + database_routing

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 6: Seed keeps `{{filters}}` and persists mappings/routing

**Files:**
- Modify: `recviz/scripts/seed-oracle.py:3506-3518` (`seed_managed_datasets`)

- [ ] **Step 1: Rewrite `seed_managed_datasets`**

Replace the function body (lines 3506-3518) with — **stop stripping `{{filters}}`**, write the two new columns, default routing to static:

```python
def seed_managed_datasets(cur) -> None:
    """Insert dataset rows into recviz_datasets (keeps {{filters}}; persists mappings/routing)."""
    for ds in CURATED_DATASETS:
        routing = ds.get("database_routing", {"type": "static", "database": CONNECTION_NAME})
        cur.execute(
            "INSERT INTO recviz_datasets "
            "(id, name, description, database_id, sql, columns, "
            "filter_mappings, database_routing, schema_version, created_at, updated_at) "
            "VALUES (:1, :2, :3, :4, :5, :6, :7, :8, 1, SYSTIMESTAMP, SYSTIMESTAMP)",
            (
                ds["id"], ds["name"], ds["description"], CONNECTION_ID,
                ds["sql_template"],
                _jb(ds["columns"]),
                _jb(ds.get("filter_mappings", [])),
                _jb(routing),
            ),
        )
```

(`CONNECTION_NAME = "oracle-local"` and `CONNECTION_ID = "conn-oracle-local"` are module constants at `seed-oracle.py:63-64`. `_jb` is the JSON→BLOB helper at line 132.)

- [ ] **Step 2: Re-seed local Oracle and verify a dataset retained `{{filters}}` + mappings**

Run: `cd /Users/aarun/Workspace/Projects/recviz/backend && PYTHONPATH=. python ../scripts/seed-oracle.py`
Expected: completes; summary prints `recviz_datasets: 23 rows`.

Verify via the running RecViz API (start the server first in another shell: `uvicorn app.main:app --reload --port 8000`):
Run: `curl -s "http://localhost:8000/api/datasets/managed" | python -c "import sys,json; d=json.load(sys.stdin); x=[r for r in d if r['id']=='ds-recon-transactions-daily'][0]; print('FILTERS_KEPT' if '{{filters}}' in x['sql'] else 'STRIPPED'); print(x['filterMappings'])"`
Expected: `FILTERS_KEPT` and a non-empty `filterMappings` list containing `date_range_days`.

- [ ] **Step 3: Commit**

```bash
cd /Users/aarun/Workspace/Projects/recviz
git add scripts/seed-oracle.py
git commit -m "feat(seed): persist dataset filter_mappings + routing; keep {{filters}}

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 7: Cross-origin framing for `/embed/*` (CSP frame-ancestors)

**Files:**
- Create: `recviz/backend/app/middleware/__init__.py` (if absent)
- Create: `recviz/backend/app/middleware/framing.py`
- Create: `recviz/backend/tests/test_framing.py`
- Modify: `recviz/backend/app/config.py`
- Modify: `recviz/backend/app/main.py:225-233`

- [ ] **Step 1: Write the failing test**

Create `recviz/backend/tests/test_framing.py`:

```python
from __future__ import annotations

from app.middleware.framing import frame_headers_for_path


def test_embed_path_gets_frame_ancestors():
    h = frame_headers_for_path("/embed/dashboards/quickrec-stats", ["http://localhost:5173"])
    assert h == {"Content-Security-Policy": "frame-ancestors 'self' http://localhost:5173"}


def test_embed_path_multiple_origins():
    h = frame_headers_for_path("/embed/x", ["http://localhost:5173", "https://rectrace.example"])
    assert h["Content-Security-Policy"] == (
        "frame-ancestors 'self' http://localhost:5173 https://rectrace.example"
    )


def test_non_embed_keeps_x_frame_options():
    h = frame_headers_for_path("/dashboards", ["http://localhost:5173"])
    assert h == {"X-Frame-Options": "SAMEORIGIN"}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/aarun/Workspace/Projects/recviz/backend && PYTHONPATH=. pytest tests/test_framing.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.middleware.framing'`.

- [ ] **Step 3: Implement the helper**

Create `recviz/backend/app/middleware/__init__.py` (empty, if the package doesn't exist).

Create `recviz/backend/app/middleware/framing.py`:

```python
"""Framing-policy headers. /embed/* is cross-origin embeddable via CSP frame-ancestors;
everything else stays same-origin only. Pure function — no config import — so it is
unit-testable in isolation."""

from __future__ import annotations


def frame_headers_for_path(path: str, frame_ancestors: list[str]) -> dict[str, str]:
    if path.startswith("/embed"):
        ancestors = " ".join(["'self'", *frame_ancestors])
        return {"Content-Security-Policy": f"frame-ancestors {ancestors}"}
    return {"X-Frame-Options": "SAMEORIGIN"}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /Users/aarun/Workspace/Projects/recviz/backend && PYTHONPATH=. pytest tests/test_framing.py -v`
Expected: PASS.

- [ ] **Step 5: Add the setting and wire the middleware**

In `recviz/backend/app/config.py`, add to the `Settings` class:

```python
    recviz_embed_frame_ancestors: str = "http://localhost:5173"
```

(Comma-separated per environment. Empty string → only `'self'`.)

In `recviz/backend/app/main.py`, replace the `XFrameOptionsMiddleware` class body (lines 225-231) with the path-aware version, importing the helper at the top of the file:

```python
from app.middleware.framing import frame_headers_for_path
```

```python
class XFrameOptionsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        response: Response = await call_next(request)
        ancestors = [o.strip() for o in settings.recviz_embed_frame_ancestors.split(",") if o.strip()]
        for key, value in frame_headers_for_path(request.url.path, ancestors).items():
            response.headers[key] = value
        return response
```

(`settings` is already imported in `main.py`. Leave `app.add_middleware(XFrameOptionsMiddleware)` at line 233 unchanged.)

- [ ] **Step 6: Verify the header end-to-end against the running server**

Start the server (`uvicorn app.main:app --reload --port 8000`), then:
Run: `curl -sI "http://localhost:8000/embed/dashboards/dash-sla-health" | grep -iE "content-security-policy|x-frame-options"`
Expected: `content-security-policy: frame-ancestors 'self' http://localhost:5173` and NO `x-frame-options`.

Run: `curl -sI "http://localhost:8000/dashboards" | grep -iE "content-security-policy|x-frame-options"`
Expected: `x-frame-options: SAMEORIGIN` and NO CSP.

- [ ] **Step 7: Commit**

```bash
cd /Users/aarun/Workspace/Projects/recviz
git add backend/app/middleware/ backend/tests/test_framing.py backend/app/config.py backend/app/main.py
git commit -m "feat(embed): allow cross-origin framing of /embed via CSP frame-ancestors

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 8: Register a RecViz connection to the local `recportal` schema

**Files:**
- Modify: `recviz/scripts/seed-oracle.py` (`seed_connection` area, ~line 3585)

- [ ] **Step 1: Add a recportal connection to the seed**

Find `seed_connection` (`seed-oracle.py:3585`). After it inserts the `conn-oracle-local` row, add a second insert for `recportal` (mirror the existing row's columns; password Fernet-encrypted via the same `_encrypt` helper the seed already uses — locate the encrypt call in `seed_connection` and reuse it). Add:

```python
    cur.execute(
        "INSERT INTO recviz_connections "
        "(id, name, display_name, backend, host, port, database_name, username, "
        "encrypted_password, schema_name, status, extra_params, created_at, updated_at) "
        "VALUES (:1, :2, :3, 'oracle', 'localhost', 1521, :4, :5, :6, :7, 'active', :8, "
        "SYSTIMESTAMP, SYSTIMESTAMP)",
        (
            "conn-recportal", "recportal", "RecPortal Oracle",
            "FREEPDB1", "recportal", _encrypt_password("recportal_pwd"), "RECPORTAL",
            _jb({"timeout": 30}),
        ),
    )
```

(Helper is `_encrypt_password` at `seed-oracle.py:137`; the local recportal password is `recportal_pwd` per `rectrace-local-dev/init/01-create-schema-users.sql:23`. Schema owner `RECPORTAL` owns `quickrec_stats_table` and `recportal_manual_match_table`.)

- [ ] **Step 2: Re-seed and verify the connection is registered + reachable**

Run: `cd /Users/aarun/Workspace/Projects/recviz/backend && PYTHONPATH=. python ../scripts/seed-oracle.py`
Expected: completes.

With the server running:
Run: `curl -s "http://localhost:8000/api/databases" | python -c "import sys,json; d=json.load(sys.stdin); print([c for c in d if c.get('name')=='recportal'])"`
Expected: a non-empty list with the recportal connection.

Run: `curl -s "http://localhost:8000/api/databases/conn-recportal/tables" | python -c "import sys,json; t=json.load(sys.stdin); print('quickrec_stats_table' in [x.lower() for x in (t if isinstance(t,list) else t.get('tables',[]))])"`
Expected: `True` (the recportal user can see its own `quickrec_stats_table`).

- [ ] **Step 3: Commit**

```bash
cd /Users/aarun/Workspace/Projects/recviz
git add scripts/seed-oracle.py
git commit -m "feat(seed): register recportal Oracle connection for QuickRec datasets

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Done criteria for Plan 1

- `cd /Users/aarun/Workspace/Projects/recviz/backend && PYTHONPATH=. pytest tests/ -v` — all green.
- A managed dataset created with `filterMappings`/`databaseRouting` round-trips through the API and narrows the SQL via `query_engine` (Task 4/5 tests prove it).
- `GET /embed/...` returns `Content-Security-Policy: frame-ancestors 'self' http://localhost:5173`; other paths keep `X-Frame-Options: SAMEORIGIN`.
- A `recportal` RecViz connection exists and can introspect `quickrec_stats_table`.
- All commits on `feature/embed-foundation` in the recviz repo; nothing on `main`.

This unblocks **Plan 2 (QuickRec dashboard + React modal)**.

## Self-review notes (writing-plans checklist)

- **Spec coverage:** §12.10 (Tasks 2-6), §5.5 framing (Task 7), §12.2 recportal connection (Task 8). QuickRec dashboard/modal, TLM seed, TLM dashboard are Plans 2-4 (out of scope here).
- **Placeholder scan:** Task 8 leaves the exact encrypt-helper name + recportal password to be read from the seed/`rectrace-local-dev` at execution — flagged explicitly, not hidden; everything else is concrete.
- **Type consistency:** JSON columns store snake_case (`filter_id`/`sql_expr`, `type`/`database`/`route_by_filter`/`mapping`) so `ConfigStore` builds `FilterMapping`/`DatabaseRoutingMapping` (`data_source_config.py`) without alias gymnastics; the API contract is camelCase via `CamelModel`, dumped to snake_case with `model_dump()` (no alias) before persistence.
