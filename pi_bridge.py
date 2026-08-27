#!/usr/bin/env python3
"""Pi RPC bridge: spawn/manage one `pi --mode rpc` process per participant session.

Sitegeist-style: the Pi agent IS the tutor engine; this bridge owns the processes
and translates HTTP (FastAPI) <-> JSONL RPC. Session persistence is Pi-native
(--session-id + --session-dir), so resume survives server restarts.

ponytail: one process per active participant, lazy spawn, idle keep-alive.
"""
import json
import os
import shutil
import subprocess
import threading
import uuid

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SESSION_DIR = os.path.join(BASE_DIR, "pi-sessions")
os.makedirs(SESSION_DIR, exist_ok=True)

PROVIDER = os.environ.get("PI_PROVIDER", "zai")
MODEL = os.environ.get("PI_MODEL", "glm-5.3-flash")
CWD = os.path.join(BASE_DIR, "pi-agent")  # AGENTS.md lives here

_lock = threading.Lock()
_sessions: dict[str, dict] = {}  # key: participant key -> proc/state


def _pi_bin() -> str:
    path = shutil.which("pi")
    if not path:
        raise RuntimeError("pi binary not found")
    return path


def ask(participant_key: str, message: str, timeout: int = 120) -> str:
    """Run one Pi headless turn; Pi owns the durable JSONL session."""
    session_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"workshop-learn:{participant_key}"))
    cmd = [
        _pi_bin(), "-p",
        "--provider", PROVIDER,
        "--model", MODEL,
        "--session-id", session_id,
        "--session-dir", SESSION_DIR,
        "--mode", "json",
        message,
    ]
    proc = subprocess.run(cmd, cwd=CWD, capture_output=True, text=True,
                          encoding="utf-8", timeout=timeout, check=False)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or f"pi exited {proc.returncode}")
    last_error = ""
    for line in proc.stdout.splitlines():
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        if event.get("type") == "message_end" and event.get("message", {}).get("role") == "assistant":
            message_obj = event["message"]
            reply = "".join(block.get("text", "") for block in message_obj.get("content", []) if block.get("type") == "text")
            last_error = message_obj.get("errorMessage", "")
    if not reply:
        raise RuntimeError(last_error or "Pi returned no assistant text")
    return reply


def resume_file(participant_key: str) -> str:
    session_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"workshop-learn:{participant_key}"))
    return os.path.join(SESSION_DIR, session_id + ".jsonl")
