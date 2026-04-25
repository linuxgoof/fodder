"""
fodder — the tower's memory.

Records falls from all climbers. Serves them back to every climber.
"""
from __future__ import annotations

import os
import sqlite3
import time
from contextlib import asynccontextmanager, contextmanager
from typing import Iterator

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

DB_PATH = os.environ.get("FODDER_DB", "tower.db")
MAX_MARKS_PER_WALL = 500  # return at most this many, newest first


@asynccontextmanager
async def lifespan(_app: "FastAPI"):
    init_db()
    yield


app = FastAPI(title="fodder", lifespan=lifespan)

# In dev, the Vite server proxies /api -> here, so CORS isn't strictly needed.
# In prod, nginx proxies too. This is a belt-and-suspenders allowance.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


def init_db():
    with connect() as c:
        c.execute("PRAGMA journal_mode=WAL")
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS falls (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                wall TEXT NOT NULL,
                x REAL NOT NULL,
                y REAL NOT NULL,
                ts INTEGER NOT NULL DEFAULT (strftime('%s','now'))
            )
            """
        )
        cols = {row[1] for row in c.execute("PRAGMA table_info(falls)").fetchall()}
        if "whisper" not in cols:
            c.execute("ALTER TABLE falls ADD COLUMN whisper TEXT")
        c.execute("CREATE INDEX IF NOT EXISTS falls_wall_ts ON falls(wall, ts DESC)")


# Simple in-memory rate limit for POST /api/fall (per client IP)
_FALL_WINDOW_SEC = 60.0
_FALL_MAX = 50
_fall_hits: dict[str, list[float]] = {}


def _client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def _check_fall_rate(request: Request) -> None:
    now = time.monotonic()
    ip = _client_ip(request)
    q = _fall_hits.get(ip)
    if q is None:
        q = []
        _fall_hits[ip] = q
    while q and now - q[0] > _FALL_WINDOW_SEC:
        q.pop(0)
    if len(q) >= _FALL_MAX:
        raise HTTPException(429, "too many fall reports; try again in a moment")
    q.append(now)


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


class FallIn(BaseModel):
    wall: str = Field(..., min_length=1, max_length=64)
    x: float
    y: float
    whisper: str | None = Field(default=None, max_length=32)  # optional; empty/None = none


class FallMark(BaseModel):
    x: float
    y: float
    whisper: str | None = None


class MarksOut(BaseModel):
    marks: list[FallMark]


class WallOnly(BaseModel):
    wall: str = Field(..., min_length=1, max_length=64)


@app.get("/api/health")
def health():
    return {"ok": True}


@app.post("/api/clear_marks")
def clear_marks(w: WallOnly):
    with connect() as c:
        c.execute("DELETE FROM falls WHERE wall = ?", (w.wall,))
    return {"ok": True, "cleared": True}


@app.post("/api/fall")
def record_fall(fall: FallIn, request: Request):
    _check_fall_rate(request)
    # Sanity bounds. Reject absurd coordinates to keep the DB clean.
    if not (-10_000 < fall.x < 10_000) or not (-100_000 < fall.y < 100_000):
        raise HTTPException(400, "coordinates out of range")
    with connect() as c:
        w = (fall.whisper or "").strip() or None
        c.execute(
            "INSERT INTO falls (wall, x, y, whisper) VALUES (?, ?, ?, ?)",
            (fall.wall, fall.x, fall.y, w),
        )
    return {"ok": True}


@app.get("/api/marks", response_model=MarksOut)
def get_marks(wall: str):
    with connect() as c:
        rows = c.execute(
            "SELECT x, y, whisper FROM falls WHERE wall = ? ORDER BY ts DESC LIMIT ?",
            (wall, MAX_MARKS_PER_WALL),
        ).fetchall()
    return MarksOut(
        marks=[
            FallMark(
                x=r["x"],
                y=r["y"],
                whisper=r["whisper"] if r["whisper"] else None,
            )
            for r in rows
        ]
    )
