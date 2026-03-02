import json
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from extractor import build_connection_url, connect, extract_schema, execute_readonly_query
from text_to_sql import natural_language_to_sql

engines: dict = {}
schemas: dict = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    for engine in engines.values():
        engine.dispose()


app = FastAPI(title="DB Schema Extractor", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ConnectionRequest(BaseModel):
    db_type: str = "postgresql"
    host: str
    port: int = 5432
    user: str
    password: str
    dbname: str


class QueryRequest(BaseModel):
    session_id: str
    question: str


class RawSQLRequest(BaseModel):
    session_id: str
    sql: str


@app.post("/api/connect")
def connect_db(req: ConnectionRequest):
    try:
        url = build_connection_url(req.db_type, req.host, req.port, req.user, req.password, req.dbname)
        engine = connect(url)
        session_id = f"{req.host}:{req.port}/{req.dbname}"
        engines[session_id] = engine
        return {"session_id": session_id, "status": "connected"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/schema/{session_id:path}")
def get_schema(session_id: str):
    engine = engines.get(session_id)
    if not engine:
        raise HTTPException(status_code=404, detail="Session not found. Please connect first.")
    try:
        schema = extract_schema(engine)
        schemas[session_id] = schema
        return schema
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/schema/{session_id:path}/download")
def download_schema(session_id: str):
    schema = schemas.get(session_id)
    if not schema:
        raise HTTPException(status_code=404, detail="Schema not extracted yet.")
    return schema


@app.post("/api/text-to-sql")
def text_to_sql(req: QueryRequest):
    engine = engines.get(req.session_id)
    schema = schemas.get(req.session_id)
    if not engine or not schema:
        raise HTTPException(status_code=404, detail="Session not found. Extract schema first.")
    try:
        sql = natural_language_to_sql(schema, req.question)
        return {"sql": sql}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/execute-sql")
def run_sql(req: RawSQLRequest):
    engine = engines.get(req.session_id)
    if not engine:
        raise HTTPException(status_code=404, detail="Session not found.")
    try:
        result = execute_readonly_query(engine, req.sql)
        return result
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/disconnect/{session_id:path}")
def disconnect(session_id: str):
    engine = engines.pop(session_id, None)
    schemas.pop(session_id, None)
    if engine:
        engine.dispose()
    return {"status": "disconnected"}
