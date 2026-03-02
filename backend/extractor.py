from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine
from typing import Any


def build_connection_url(db_type: str, host: str, port: int, user: str, password: str, dbname: str) -> str:
    drivers = {
        "postgresql": "postgresql+psycopg2",
        "mysql": "mysql+pymysql",
    }
    driver = drivers.get(db_type)
    if not driver:
        raise ValueError(f"Unsupported database type: {db_type}")
    return f"{driver}://{user}:{password}@{host}:{port}/{dbname}"


def connect(connection_url: str) -> Engine:
    engine = create_engine(connection_url, pool_pre_ping=True, connect_args={"connect_timeout": 10})
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return engine


def extract_schema(engine: Engine) -> dict[str, Any]:
    inspector = inspect(engine)
    dialect = engine.dialect.name
    schema: dict[str, Any] = {
        "dialect": dialect,
        "tables": {},
        "views": {},
        "enums": [],
        "interfaces": {
            "materialized_views": [],
            "functions": [],
        },
    }

    for table_name in inspector.get_table_names():
        schema["tables"][table_name] = _extract_table(inspector, table_name)

    for view_name in inspector.get_view_names():
        schema["views"][view_name] = _extract_view(inspector, view_name, engine)

    if dialect == "postgresql":
        schema["enums"] = _extract_pg_enums(engine)
        schema["interfaces"]["materialized_views"] = _extract_pg_materialized_views(engine)
        schema["interfaces"]["functions"] = _extract_pg_functions(engine)
    elif dialect == "mysql":
        schema["enums"] = _extract_mysql_enums(engine)
        schema["interfaces"]["functions"] = _extract_mysql_functions(engine)

    return schema


def _extract_table(inspector, table_name: str) -> dict:
    columns = []
    for col in inspector.get_columns(table_name):
        columns.append({
            "name": col["name"],
            "type": str(col["type"]),
            "nullable": col.get("nullable", True),
            "default": str(col["default"]) if col.get("default") is not None else None,
            "autoincrement": col.get("autoincrement", False),
            "comment": col.get("comment"),
        })

    pk = inspector.get_pk_constraint(table_name)
    primary_key = {
        "name": pk.get("name"),
        "columns": pk.get("constrained_columns", []),
    }

    foreign_keys = []
    for fk in inspector.get_foreign_keys(table_name):
        foreign_keys.append({
            "name": fk.get("name"),
            "constrained_columns": fk.get("constrained_columns", []),
            "referred_table": fk.get("referred_table"),
            "referred_columns": fk.get("referred_columns", []),
            "referred_schema": fk.get("referred_schema"),
        })

    indexes = []
    for idx in inspector.get_indexes(table_name):
        indexes.append({
            "name": idx.get("name"),
            "columns": idx.get("column_names", []),
            "unique": idx.get("unique", False),
        })

    unique_constraints = []
    try:
        for uc in inspector.get_unique_constraints(table_name):
            unique_constraints.append({
                "name": uc.get("name"),
                "columns": uc.get("column_names", []),
            })
    except Exception:
        pass

    check_constraints = []
    try:
        for cc in inspector.get_check_constraints(table_name):
            check_constraints.append({
                "name": cc.get("name"),
                "sqltext": str(cc.get("sqltext", "")),
            })
    except Exception:
        pass

    return {
        "columns": columns,
        "primary_key": primary_key,
        "foreign_keys": foreign_keys,
        "indexes": indexes,
        "unique_constraints": unique_constraints,
        "check_constraints": check_constraints,
    }


def _extract_view(inspector, view_name: str, engine: Engine) -> dict:
    columns = []
    for col in inspector.get_columns(view_name):
        columns.append({
            "name": col["name"],
            "type": str(col["type"]),
            "nullable": col.get("nullable", True),
        })

    definition = None
    try:
        definition = inspector.get_view_definition(view_name)
    except Exception:
        pass

    return {
        "columns": columns,
        "definition": definition,
    }


def _extract_pg_enums(engine: Engine) -> list[dict]:
    query = text("""
        SELECT t.typname AS enum_name,
               array_agg(e.enumlabel ORDER BY e.enumsortorder) AS values
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
        GROUP BY t.typname
        ORDER BY t.typname;
    """)
    enums = []
    with engine.connect() as conn:
        for row in conn.execute(query):
            enums.append({"name": row[0], "values": list(row[1])})
    return enums


def _extract_pg_materialized_views(engine: Engine) -> list[dict]:
    query = text("""
        SELECT matviewname, definition
        FROM pg_matviews
        WHERE schemaname = 'public'
        ORDER BY matviewname;
    """)
    views = []
    with engine.connect() as conn:
        for row in conn.execute(query):
            views.append({"name": row[0], "definition": row[1]})
    return views


def _extract_pg_functions(engine: Engine) -> list[dict]:
    query = text("""
        SELECT p.proname AS name,
               pg_get_function_arguments(p.oid) AS arguments,
               pg_get_function_result(p.oid) AS return_type,
               CASE p.prokind
                   WHEN 'f' THEN 'function'
                   WHEN 'p' THEN 'procedure'
                   WHEN 'a' THEN 'aggregate'
                   WHEN 'w' THEN 'window'
               END AS kind
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        ORDER BY p.proname;
    """)
    functions = []
    with engine.connect() as conn:
        for row in conn.execute(query):
            functions.append({
                "name": row[0],
                "arguments": row[1],
                "return_type": row[2],
                "kind": row[3],
            })
    return functions


def _extract_mysql_enums(engine: Engine) -> list[dict]:
    query = text("""
        SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE
        FROM information_schema.COLUMNS
        WHERE DATA_TYPE = 'enum'
          AND TABLE_SCHEMA = DATABASE()
        ORDER BY TABLE_NAME, COLUMN_NAME;
    """)
    enums = []
    with engine.connect() as conn:
        for row in conn.execute(query):
            type_str = row[2]
            values = [v.strip("'") for v in type_str[5:-1].split(",")]
            enums.append({
                "name": f"{row[0]}.{row[1]}",
                "values": values,
            })
    return enums


def _extract_mysql_functions(engine: Engine) -> list[dict]:
    query = text("""
        SELECT ROUTINE_NAME, ROUTINE_TYPE
        FROM information_schema.ROUTINES
        WHERE ROUTINE_SCHEMA = DATABASE()
        ORDER BY ROUTINE_NAME;
    """)
    functions = []
    with engine.connect() as conn:
        for row in conn.execute(query):
            functions.append({
                "name": row[0],
                "kind": row[1].lower(),
            })
    return functions


def execute_readonly_query(engine: Engine, sql: str) -> dict:
    forbidden = ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE", "CREATE", "GRANT", "REVOKE"]
    upper = sql.upper().strip()
    for keyword in forbidden:
        if keyword in upper:
            raise ValueError(f"Forbidden SQL keyword detected: {keyword}")

    if not upper.startswith("SELECT") and not upper.startswith("WITH") and not upper.startswith("EXPLAIN"):
        raise ValueError("Only SELECT, WITH, and EXPLAIN statements are allowed")

    with engine.connect() as conn:
        result = conn.execute(text(sql))
        columns = list(result.keys())
        rows = [dict(zip(columns, row)) for row in result.fetchmany(500)]
        return {"columns": columns, "rows": rows, "truncated": len(rows) == 500}
