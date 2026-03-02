# DB Schema Explorer

A full-stack application for connecting to a SQL database, extracting its complete schema (tables, columns, relationships, enums, indexes, views, functions), exploring it through an interactive UI, and optionally translating natural language questions into executable SQL queries.

---

## Table of Contents

1. [Architecture](#architecture)
2. [How It Works](#how-it-works)
3. [Extraction Logic](#extraction-logic)
4. [Frontend Walkthrough](#frontend-walkthrough)
5. [Text-to-SQL](#text-to-sql)
6. [Security Model](#security-model)
7. [Requirements](#requirements)
8. [Setup & Running](#setup--running)
9. [API Reference](#api-reference)
10. [Testing](#testing)
11. [Project Structure](#project-structure)

---

## Architecture

The application follows a decoupled client-server architecture:

```
┌──────────────────┐         ┌──────────────────────┐         ┌────────────┐
│   React Frontend │  HTTP   │   FastAPI Backend     │  SQL    │  Target DB │
│   (Vite, port    │ ──────> │   (uvicorn, port      │ ──────> │  (PG/MySQL)│
│    3000)         │  /api/* │    8000)              │         │            │
└──────────────────┘         └──────────────────────┘         └────────────┘
```

- **Backend** — Python 3.11+, FastAPI, SQLAlchemy 2.0. Handles connection management, schema introspection, query execution, and LLM-based SQL generation.
- **Frontend** — React 18, Vite 6, React Flow (for ER diagrams), Lucide icons. Provides the credential form, schema browser, visual explorer, and query interface.
- **Communication** — The Vite dev server proxies all `/api/*` requests to the backend, so both servers run on different ports without CORS issues during development.

---

## How It Works

1. The user enters database credentials (host, port, username, password, database name, dialect) through the frontend connection form.
2. The frontend sends a `POST /api/connect` request. The backend builds a SQLAlchemy engine, verifies connectivity with a `SELECT 1` probe, and returns a session identifier.
3. The frontend immediately calls `GET /api/schema/{session_id}` to trigger full extraction. The backend introspects every object in the `public` schema and returns a structured JSON payload.
4. The frontend renders the schema across four tabs: Overview (aggregate stats), Detail (per-object column/index/FK grids), ER Diagram (interactive graph), and Text-to-SQL (natural language querying).
5. The user can download the full JSON at any time, or disconnect to dispose of the engine and clear server-side state.

---

## Extraction Logic

All extraction runs through `extractor.py`. The engine uses SQLAlchemy's `inspect()` interface for portable metadata queries, supplemented by raw catalog queries for dialect-specific objects.

### Tables

For each table in the `public` schema, the extractor collects:

| Attribute | Source |
|---|---|
| Columns (name, type, nullable, default, autoincrement, comment) | `inspector.get_columns()` |
| Primary key constraint (name, constituent columns) | `inspector.get_pk_constraint()` |
| Foreign keys (constraint name, local columns, referred table, referred columns) | `inspector.get_foreign_keys()` |
| Indexes (name, columns, uniqueness) | `inspector.get_indexes()` |
| Unique constraints | `inspector.get_unique_constraints()` |
| Check constraints | `inspector.get_check_constraints()` |

### Views

Standard views are extracted via `inspector.get_view_names()`. Each view entry includes its column list and its defining SQL statement (from `inspector.get_view_definition()`).

### Enums

- **PostgreSQL**: Queries `pg_type` joined with `pg_enum` to get enum type names and their ordered label values, scoped to the `public` namespace.
- **MySQL**: Queries `information_schema.COLUMNS` where `DATA_TYPE = 'enum'`, parses the `COLUMN_TYPE` string to extract allowed values. Enum names are formatted as `table.column`.

### Interfaces

"Interfaces" refers to database objects that application code depends on but that are not standard tables. The extractor captures:

- **Materialized Views** (PostgreSQL only): Extracted from `pg_matviews`, including the materialization query.
- **Stored Functions & Procedures**: PostgreSQL queries `pg_proc` for function name, arguments, return type, and kind (function/procedure/aggregate/window). MySQL queries `information_schema.ROUTINES` for routine name and type.

### Output Format

The final JSON structure:

```json
{
  "dialect": "postgresql",
  "tables": {
    "users": {
      "columns": [...],
      "primary_key": { "name": "...", "columns": [...] },
      "foreign_keys": [...],
      "indexes": [...],
      "unique_constraints": [...],
      "check_constraints": [...]
    }
  },
  "views": {
    "active_users": { "columns": [...], "definition": "SELECT ..." }
  },
  "enums": [
    { "name": "status_type", "values": ["active", "inactive", "suspended"] }
  ],
  "interfaces": {
    "materialized_views": [{ "name": "...", "definition": "..." }],
    "functions": [{ "name": "...", "arguments": "...", "return_type": "...", "kind": "function" }]
  }
}
```

---

## Frontend Walkthrough

### Connection Screen

A single form collects database type (PostgreSQL or MySQL), host, port, username, password, and database name. Port defaults update automatically when the dialect changes (5432 for PostgreSQL, 3306 for MySQL). On submission, the form disables to prevent duplicate connections and displays errors inline if the backend rejects the credentials.

### Overview Tab

Displays aggregate statistics: total tables, views, enums, materialized views, functions, total columns, total foreign keys, and total indexes. Enum types are rendered as cards with their values listed as inline badges.

### Detail Tab

Selecting any object from the sidebar opens its detail view. For tables, this includes a column grid (with primary key and foreign key indicators), foreign key references, indexes, unique constraints, and check constraints. For views, it shows the column list and the defining SQL. Enum and function objects have their own detail layouts.

### ER Diagram Tab

Builds an interactive entity-relationship diagram using React Flow. Each table is a draggable node showing its columns (with PK/FK annotations). Foreign key relationships are rendered as animated edges between nodes. The diagram supports zoom, pan, fit-to-view, and a minimap for orientation in large schemas.

### Text-to-SQL Tab

Covered in the next section.

### Sidebar

A searchable, collapsible tree view of all extracted objects grouped by type (Tables, Views, Enums, Materialized Views, Functions). The search field filters across all categories. The footer shows the active session and a disconnect button.

---

## Text-to-SQL

The Text-to-SQL feature allows users to type a plain English question and receive a syntactically valid SQL query derived from the extracted schema.

### How it works

1. When the user submits a question, the frontend calls `POST /api/text-to-sql` with the session ID and the question text.
2. The backend (`text_to_sql.py`) constructs a minimized schema context string from the cached extraction result. This context includes table names, column names with types, primary key annotations, foreign key references, view signatures, and enum definitions. Keeping the context compact reduces token usage.
3. The context and the user question are sent to OpenAI's `gpt-4o` model with a system prompt that instructs it to output only valid, read-only SQL. Temperature is set to 0 for deterministic output.
4. The response is cleaned (markdown code fences are stripped) and returned to the frontend.
5. The user can then copy the generated SQL or execute it directly. Execution hits `POST /api/execute-sql`, which runs the query against the connected database and returns up to 500 rows.

### Query safety

The `execute_readonly_query` function enforces two layers of protection:
- **Keyword blocklist**: Rejects any query containing `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `TRUNCATE`, `CREATE`, `GRANT`, or `REVOKE` (case-insensitive).
- **Statement whitelist**: Only allows queries that begin with `SELECT`, `WITH`, or `EXPLAIN`.

This is in addition to the expectation that the connected user has read-only database privileges.

---

## Security Model

- **No credential persistence**: Database credentials are used to create an in-memory SQLAlchemy engine and are not written to disk, logged, or stored in any persistent data structure. The connection string exists only within the engine object, which is disposed on disconnect or server shutdown.
- **Session-scoped engines**: Each connection produces a session ID (`host:port/dbname`). Engines are held in a Python dict and cleaned up via the FastAPI lifespan handler on shutdown.
- **Read-only enforcement**: Even if the connected database user has write privileges, the application blocks destructive SQL at the application layer before execution.
- **CORS**: Configured permissively (`*`) for local development. Should be restricted to the frontend origin in any deployed environment.

---

## Requirements

### Backend

- Python 3.11 or later
- Dependencies (installed via `pip`):

| Package | Version | Purpose |
|---|---|---|
| fastapi | 0.115.6 | HTTP framework |
| uvicorn | 0.34.0 | ASGI server |
| sqlalchemy | 2.0.36 | Database introspection and query execution |
| psycopg2-binary | 2.9.10 | PostgreSQL driver |
| pymysql | 1.1.1 | MySQL driver |
| pydantic | 2.10.3 | Request/response validation |
| openai | 1.58.1 | Text-to-SQL via GPT-4o |
| python-dotenv | 1.0.1 | Environment variable loading |
| cryptography | 44.0.0 | Required by PyMySQL for secure connections |

### Frontend

- Node.js 18 or later
- Dependencies (installed via `npm`):

| Package | Version | Purpose |
|---|---|---|
| react | 18.3.1 | UI framework |
| react-dom | 18.3.1 | DOM rendering |
| @xyflow/react | 12.4.0 | ER diagram rendering |
| lucide-react | 0.468.0 | Icon set |
| vite | 6.0.3 | Build tool and dev server |
| @vitejs/plugin-react | 4.3.4 | React fast refresh |

### Optional

- An OpenAI API key (for the Text-to-SQL feature). Without it, all other features work normally.

---

## Setup & Running

### 1. Clone and enter the project

```bash
cd takehome-dearlegal
```

### 2. Backend setup

```bash
cd backend
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
```

To enable Text-to-SQL, create a `.env` file in the `backend/` directory:

```
OPENAI_API_KEY=sk-...
```

Start the backend:

```bash
./venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Frontend setup

```bash
cd frontend
npm install
npm run dev
```

### 4. Quick start (both servers)

From the project root:

```bash
./start.sh
```

This launches the backend on port 8000 and the frontend on port 3000 in parallel. Open http://localhost:3000 in a browser.

---

## API Reference

All endpoints are prefixed with `/api`.

| Method | Path | Description |
|---|---|---|
| `POST` | `/connect` | Accepts `{ db_type, host, port, user, password, dbname }`. Returns `{ session_id, status }`. |
| `GET` | `/schema/{session_id}` | Extracts and returns the full schema JSON for the given session. |
| `GET` | `/schema/{session_id}/download` | Returns the cached schema JSON (does not re-extract). |
| `POST` | `/text-to-sql` | Accepts `{ session_id, question }`. Returns `{ sql }`. Requires `OPENAI_API_KEY`. |
| `POST` | `/execute-sql` | Accepts `{ session_id, sql }`. Runs the query (read-only enforced) and returns `{ columns, rows, truncated }`. |
| `POST` | `/disconnect/{session_id}` | Disposes the engine and clears cached schema. Returns `{ status }`. |

FastAPI auto-generates interactive API docs at http://localhost:8000/docs (Swagger UI) and http://localhost:8000/redoc.

---

## Testing

### Verifying the backend starts correctly

```bash
cd backend
./venv/bin/python -c "from main import app; print('OK')"
```

This confirms all imports resolve and the FastAPI app object is constructed without errors.

### Verifying the frontend builds

```bash
cd frontend
npm run build
```

A successful build produces optimized assets in `frontend/dist/` with no errors.

### Manual end-to-end testing

1. Start both servers (see [Setup](#setup--running)).
2. Open http://localhost:3000.
3. Enter credentials for a PostgreSQL or MySQL database.
4. Verify the Overview tab shows correct table/view/enum counts.
5. Click a table in the sidebar and confirm columns, types, foreign keys, and indexes appear.
6. Switch to the ER Diagram tab. Verify nodes represent tables and edges represent foreign key relationships. Drag nodes to confirm interactivity.
7. Switch to the Text-to-SQL tab. Enter a question like "Show all tables with more than 5 columns" (or any question appropriate to the connected schema). Confirm a SQL query is returned. Click Run and verify results render.
8. Click "Download JSON" in the header. Open the downloaded `schema.json` and verify it contains the expected structure (tables, views, enums, interfaces).
9. Click Disconnect in the sidebar footer. Confirm the app returns to the connection screen.

### Testing against a local PostgreSQL instance

If you have Docker installed, you can spin up a test database quickly:

```bash
docker run --name test-pg -e POSTGRES_PASSWORD=testpass -p 5432:5432 -d postgres:16
```

Then connect with:
- Host: `localhost`
- Port: `5432`
- User: `postgres`
- Password: `testpass`
- Database: `postgres`

The schema will be minimal (system defaults), but it verifies the full connection and extraction pipeline.

### Testing the read-only enforcement

From the Text-to-SQL tab or by calling the API directly, attempt to run a destructive query:

```sql
DROP TABLE users;
```

The backend should reject it with a 403 response: `Forbidden SQL keyword detected: DROP`.

---

## Project Structure

```
takehome-dearlegal/
├── start.sh                    # Launches both servers
├── backend/
│   ├── requirements.txt        # Python dependencies
│   ├── .env.example            # Template for environment variables
│   ├── main.py                 # FastAPI application, routes, session management
│   ├── extractor.py            # Schema introspection engine
│   └── text_to_sql.py          # LLM-based natural language to SQL translation
└── frontend/
    ├── package.json            # Node dependencies and scripts
    ├── vite.config.js          # Vite config with API proxy
    ├── index.html              # Entry HTML
    └── src/
        ├── main.jsx            # React entry point
        ├── App.jsx             # Root component, routing, state management
        ├── index.css           # Global styles (dark theme)
        ├── api/
        │   └── client.js       # API client functions
        └── components/
            ├── ConnectionForm.jsx  # Database credential input
            ├── Sidebar.jsx         # Searchable object tree
            ├── SchemaOverview.jsx  # Aggregate stats dashboard
            ├── TableDetail.jsx     # Column/FK/index detail grids
            ├── ERDiagram.jsx       # Interactive ER diagram (React Flow)
            └── TextToSQL.jsx       # Natural language query interface
```
