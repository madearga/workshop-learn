"""Minimal persistence for workshop-learn. SQLite via stdlib.

Tables: participants, messages (full transcript), quiz_events (evidence).
ponytail: single global connection + lock; per-request locking via sqlite3's
own serialization is enough at workshop scale (<50 participants).
"""
import json
import sqlite3
import threading
import time
from pathlib import Path

DB_PATH = Path(__file__).parent / "workshop.db"
_lock = threading.Lock()
_conn: sqlite3.Connection | None = None


def _db() -> sqlite3.Connection:
    global _conn
    if _conn is None:
        _conn = sqlite3.connect(DB_PATH, check_same_thread=False)
        _conn.row_factory = sqlite3.Row
        _conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS participants (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                token TEXT UNIQUE NOT NULL,
                created_at REAL NOT NULL
            );
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                participant_id INTEGER NOT NULL REFERENCES participants(id),
                role TEXT NOT NULL CHECK (role IN ('user','assistant')),
                content TEXT NOT NULL,
                created_at REAL NOT NULL
            );
            CREATE TABLE IF NOT EXISTS quiz_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                participant_id INTEGER NOT NULL REFERENCES participants(id),
                question TEXT NOT NULL,
                concept_tag TEXT NOT NULL DEFAULT '',
                correct INTEGER NOT NULL,
                dont_know INTEGER NOT NULL DEFAULT 0,
                picked_label TEXT NOT NULL DEFAULT '',
                created_at REAL NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_messages_participant ON messages(participant_id, id);
            CREATE INDEX IF NOT EXISTS idx_quiz_participant ON quiz_events(participant_id, id);
            """
        )
        _conn.commit()
    return _conn


def _now() -> float:
    return time.time()


# --- participants ---

def ensure_participant(name: str, token: str) -> int:
    """Create participant if missing; return id. Name is the identity."""
    with _lock:
        db = _db()
        row = db.execute("SELECT id FROM participants WHERE name = ?", (name,)).fetchone()
        if row:
            return row["id"]
        cur = db.execute(
            "INSERT INTO participants (name, token, created_at) VALUES (?, ?, ?)",
            (name, token, _now()),
        )
        db.commit()
        return cur.lastrowid


def get_participant_by_token(token: str) -> sqlite3.Row | None:
    with _lock:
        row = _db().execute("SELECT * FROM participants WHERE token = ?", (token,)).fetchone()
        return row


# --- messages ---

def save_message(participant_id: int, role: str, content: str) -> None:
    with _lock:
        db = _db()
        db.execute(
            "INSERT INTO messages (participant_id, role, content, created_at) VALUES (?, ?, ?, ?)",
            (participant_id, role, content, _now()),
        )
        db.commit()


def load_messages(participant_id: int) -> list[dict]:
    with _lock:
        rows = _db().execute(
            "SELECT role, content FROM messages WHERE participant_id = ? ORDER BY id",
            (participant_id,),
        ).fetchall()
        return [{"role": r["role"], "content": r["content"]} for r in rows]


# --- quiz events ---

def save_quiz_event(participant_id: int, question: str, concept_tag: str,
                    correct: bool, dont_know: bool, picked_label: str) -> None:
    with _lock:
        db = _db()
        db.execute(
            "INSERT INTO quiz_events (participant_id, question, concept_tag, correct, dont_know, picked_label, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (participant_id, question, concept_tag, int(correct), int(dont_know), picked_label, _now()),
        )
        db.commit()


def mastery_by_concept(participant_id: int) -> dict[str, float]:
    """Simple mastery score per concept: (correct*1 - wrong*1 - dont_know*0.5 + 2) / (attempts + 4), clamped 0-1.

    ponytail: heuristic, not BKT. Add real learner model when data justifies it.
    """
    with _lock:
        rows = _db().execute(
            "SELECT concept_tag, correct, dont_know FROM quiz_events WHERE participant_id = ? AND concept_tag != ''",
            (participant_id,),
        ).fetchall()
    scores: dict[str, list[float]] = {}
    for r in rows:
        tag = r["concept_tag"]
        if tag not in scores:
            scores[tag] = []
        if r["dont_know"]:
            scores[tag].append(0.0)
        elif r["correct"]:
            scores[tag].append(1.0)
        else:
            scores[tag].append(0.1)
    out: dict[str, float] = {}
    for tag, vals in scores.items():
        # laplace-smoothed average: start neutral at 0.5
        out[tag] = round(min(1.0, max(0.0, (sum(vals) + 1) / (len(vals) + 2))), 2)
    return out


def host_matrix() -> list[dict]:
    """All participants with their per-concept mastery + worst quiz answers."""
    with _lock:
        parts = _db().execute("SELECT id, name FROM participants WHERE name != '__selftest__'").fetchall()
        ids = [(r["id"], r["name"]) for r in parts]
    out = []
    for pid, name in ids:  # lock released before calling mastery_by_concept (avoids deadlock)
        m = mastery_by_concept(pid)
        weak = sorted(m.items(), key=lambda kv: kv[1])[:5]
        out.append({"name": name, "mastery": m, "weakest": weak})
    return out


def due_review_concepts(participant_id: int, limit: int = 2) -> list[dict]:
    """Concepts with mastery < 0.5, weakest first. #4: spaced-retrieval seed.

    ponytail: no real SM-2 scheduling yet; interval logic can wrap this later.
    """
    mastery = mastery_by_concept(participant_id)
    weak = sorted(
        ({"concept": c, "mastery": m} for c, m in mastery.items() if m < 0.5),
        key=lambda x: x["mastery"],
    )
    return weak[:limit]


def save_quiz_json(participant_id: int, raw: dict) -> None:
    """Persist the full quiz payload for later analysis."""
    with _lock:
        db = _db()
        db.execute(
            "INSERT INTO messages (participant_id, role, content, created_at) VALUES (?, 'assistant', ?, ?)",
            (participant_id, json.dumps(raw), _now()),
        )
        db.commit()


def selfcheck() -> None:
    """Run-once smoke test: fails loudly if persistence is broken."""
    import os
    if os.environ.get("WORKSHOP_SELFTEST") != "1":
        return
    pid = ensure_participant("__selftest__", "__selftest_token__")
    save_message(pid, "user", "hello")
    save_message(pid, "assistant", "hi")
    save_quiz_event(pid, "Q?", "konsep-x", correct=True, dont_know=False, picked_label="a")
    save_quiz_event(pid, "Q?", "konsep-y", correct=False, dont_know=False, picked_label="b")
    msgs = load_messages(pid)
    assert len(msgs) >= 2
    m = mastery_by_concept(pid)
    assert m.get("konsep-x", 0) > m.get("konsep-y", 1)
    due = due_review_concepts(pid)
    assert any(d["concept"] == "konsep-y" for d in due)
    print(f"selfcheck OK: {len(msgs)} messages, mastery={m}, due={[d['concept'] for d in due]}")


selfcheck()
