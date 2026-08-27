"""Workshop learning server — FastAPI backend + static React build.

Holds the Z.ai key server-side; the browser talks to /api/chat only.
Method adapted from amosblomqvist/learn (teach skill).
"""
import json
import os
import threading
import time
import urllib.request
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import store
import pi_bridge

app = FastAPI()

ZAI_KEY = os.environ.get("ZAI_API_KEY", "")
ZAI_URL = "https://api.z.ai/api/coding/paas/v4/chat/completions"
MODEL = os.environ.get("WORKSHOP_MODEL", "glm-5.3-flash")
TUTOR_ENGINE = os.environ.get("TUTOR_ENGINE", "pi")  # "pi" | "zai"
DIST = Path(__file__).parent / "dist"

ACCESS_TOKEN = os.environ.get("WORKSHOP_TOKEN", "")  # demo: single static token
MAX_UPSTREAM = threading.Semaphore(3)  # #5: cap in-flight upstream calls


def _check_auth(authorization: str | None) -> None:
    if ACCESS_TOKEN and authorization != f"Bearer {ACCESS_TOKEN}":
        raise HTTPException(status_code=401, detail="unauthorized")


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]


class ResearchRequest(BaseModel):
    topic: str


class RegisterRequest(BaseModel):
    name: str


class QuizEventRequest(BaseModel):
    question: str
    concept_tag: str = ""
    correct: bool
    dont_know: bool = False
    picked_label: str = ""


@app.post("/api/quiz-event")
def quiz_event(req: QuizEventRequest, authorization: str | None = Header(default=None)):
    """Persist a quiz attempt as concept evidence."""
    pid = _participant_id(authorization)
    if pid is None:
        return JSONResponse({"error": "participant identity required"}, status_code=401)
    store.save_quiz_event(pid, req.question[:500], req.concept_tag[:80],
                          req.correct, req.dont_know, req.picked_label[:100])
    return {"ok": True}


@app.get("/api/host-matrix")
def host_matrix(authorization: str | None = Header(default=None)):
    """Host-only: all participants x concept mastery."""
    if ACCESS_TOKEN and authorization != f"Bearer {ACCESS_TOKEN}":
        raise HTTPException(status_code=403, detail="host only")
    return {"participants": store.host_matrix()}


@app.get("/api/restore")
def restore(authorization: str | None = Header(default=None)):
    """Return the participant's saved transcript for session resume."""
    pid = _participant_id(authorization)
    if pid is None:
        return JSONResponse({"error": "participant identity required"}, status_code=401)
    return {"messages": store.load_messages(pid)}


@app.get("/api/mastery")
def mastery(authorization: str | None = Header(default=None)):
    """Per-concept mastery for the current participant."""
    pid = _participant_id(authorization)
    if pid is None:
        return JSONResponse({"error": "participant identity required"}, status_code=401)
    return {"mastery": store.mastery_by_concept(pid), "due": store.due_review_concepts(pid)}


@app.post("/api/register")
def register(req: RegisterRequest):
    """Exchange a display name for a participant token (identity). Demo-scope."""
    name = req.name.strip()[:40]
    if not name:
        return JSONResponse({"error": "empty name"}, status_code=400)
    token = f"pt-{name.lower().replace(' ', '-')}-{int(time.time())}"
    pid = store.ensure_participant(name, token)
    return {"participant_token": token, "name": name}


def _participant_id(authorization: str | None) -> int | None:
    """Resolve participant from their Bearer token. Returns None for legacy shared token."""
    tok = (authorization or "").removeprefix("Bearer ").strip()
    if not tok or tok == ACCESS_TOKEN:
        return None
    row = store.get_participant_by_token(tok)
    return row["id"] if row else None


RESEARCH_SYSTEM = (
    "Kamu peneliti faktual. Diberikan topik, kembalikan 3-5 fakta kunci yang TERVERIFIKASI "
    "seputar topik tersebut dalam Bahasa Indonesia, format markdown list. "
    "Setiap fakta disertai sumber (nama situs/institusi). Jika tidak yakin, tandai [perlu verifikasi]."
)


@app.post("/api/research")
def research(req: ResearchRequest, authorization: str | None = Header(default=None)):
    """Researcher subagent: verify facts about a topic via Z.ai."""
    _check_auth(authorization)
    if not ZAI_KEY:
        return JSONResponse({"error": "server not configured (ZAI_API_KEY)"}, status_code=500)
    topic = req.topic.strip()[:300]  # cap input
    if not topic:
        return JSONResponse({"error": "empty topic"}, status_code=400)
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": RESEARCH_SYSTEM},
            {"role": "user", "content": f"Topik: {topic}"},
        ],
        "temperature": 0.3,
    }
    body = json.dumps(payload).encode()
    r = urllib.request.Request(
        ZAI_URL, data=body, headers={
            "Authorization": f"Bearer {ZAI_KEY}",
            "Content-Type": "application/json",
        },
    )
    try:
        with MAX_UPSTREAM:
            with urllib.request.urlopen(r, timeout=45) as resp:
                data = json.loads(resp.read().decode())
        return {"facts": data["choices"][0]["message"]["content"]}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=502)


TUTOR_SYSTEM_FILE = Path(__file__).parent / "tutor_system.txt"


@app.post("/api/chat")
def chat(req: ChatRequest, authorization: str | None = Header(default=None)):
    """Proxy a chat completion to Z.ai. The key and tutor prompt never leave the server."""
    # Accept EITHER the shared workshop token OR a participant token.
    pid = _participant_id(authorization)
    if ACCESS_TOKEN and not pid and authorization != f"Bearer {ACCESS_TOKEN}":
        _check_auth(authorization)
    if TUTOR_ENGINE != "pi" and not ZAI_KEY:
        return JSONResponse({"error": "server not configured (ZAI_API_KEY)"}, status_code=500)
    # #1: system prompt is server-controlled; client sends conversation only.
    # Research-reference blocks arrive as assistant messages (untrusted material).
    tutor_system = TUTOR_SYSTEM_FILE.read_text(encoding="utf-8") if TUTOR_SYSTEM_FILE.exists() else ""
    msgs = [{"role": m.role, "content": m.content} for m in req.messages if m.role in ("user", "assistant")]
    if pid is not None:
        # persist the newest user message (client sends full history; last user msg is new)
        for m in reversed(msgs):
            if m["role"] == "user":
                store.save_message(pid, "user", m["content"])
                break
    if TUTOR_ENGINE == "pi" and pid is not None:
        # Pi engine: AGENTS.md is the system prompt, session is Pi-native
        pkey = f"p{pid}"
        try:
            reply = pi_bridge.ask(pkey, msgs[-1]["content"] if msgs else "")
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=502)
        if pid is not None:
            store.save_message(pid, "assistant", reply)
        return {"reply": reply}

    # Z.ai direct engine (fallback)
    payload = {
        "model": MODEL,
        "messages": ([{"role": "system", "content": tutor_system}] if tutor_system else []) + msgs,
        "temperature": 1,
        "top_p": 0.95,
    }
    body = json.dumps(payload).encode()
    r = urllib.request.Request(
        ZAI_URL, data=body, headers={
            "Authorization": f"Bearer {ZAI_KEY}",
            "Content-Type": "application/json",
        },
    )
    try:
        with MAX_UPSTREAM:
            with urllib.request.urlopen(r, timeout=45) as resp:
                data = json.loads(resp.read().decode())
        reply = data["choices"][0]["message"]["content"]
        if pid is not None:
            store.save_message(pid, "assistant", reply)
        return {"reply": reply}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=502)


# Serve the React build (must be mounted after /api routes)
app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")


@app.get("/")
def index():
    return FileResponse(DIST / "index.html")


@app.get("/host")
def host():
    return FileResponse(DIST / "host.html")