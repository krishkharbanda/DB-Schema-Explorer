import os
from openai import OpenAI


def get_client() -> OpenAI:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY environment variable is not set")
    return OpenAI(api_key=api_key)


def build_schema_context(schema: dict) -> str:
    lines = [f"Database dialect: {schema['dialect']}\n"]

    for table_name, table_info in schema.get("tables", {}).items():
        cols = ", ".join(
            f"{c['name']} {c['type']}" + (" PK" if c["name"] in table_info.get("primary_key", {}).get("columns", []) else "")
            for c in table_info["columns"]
        )
        lines.append(f"TABLE {table_name} ({cols})")

        for fk in table_info.get("foreign_keys", []):
            lines.append(
                f"  FK: {', '.join(fk['constrained_columns'])} -> "
                f"{fk['referred_table']}({', '.join(fk['referred_columns'])})"
            )

    for view_name, view_info in schema.get("views", {}).items():
        cols = ", ".join(f"{c['name']} {c['type']}" for c in view_info["columns"])
        lines.append(f"VIEW {view_name} ({cols})")

    for enum in schema.get("enums", []):
        lines.append(f"ENUM {enum['name']}: {', '.join(enum['values'])}")

    return "\n".join(lines)


def natural_language_to_sql(schema: dict, question: str) -> str:
    client = get_client()
    context = build_schema_context(schema)

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a SQL expert. Given a database schema and a natural language question, "
                    "generate a valid, read-only SQL query. Output ONLY the SQL query, no explanation. "
                    "Never generate INSERT, UPDATE, DELETE, DROP, ALTER, or any destructive SQL. "
                    "Always use SELECT statements only.\n\n"
                    f"DATABASE SCHEMA:\n{context}"
                ),
            },
            {"role": "user", "content": question},
        ],
        temperature=0,
        max_tokens=1024,
    )

    sql = response.choices[0].message.content.strip()
    if sql.startswith("```"):
        sql = sql.split("\n", 1)[1] if "\n" in sql else sql[3:]
        if sql.endswith("```"):
            sql = sql[:-3]
        sql = sql.strip()
    return sql
