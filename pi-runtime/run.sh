#!/usr/bin/env bash
# workshop-learn Pi runtime — auto-restart wrapper (ponytail: simple loop, systemd when it matters)
# Model: gpt-5.6-luna via OpenAI Codex backend (ChatGPT OAuth in ~/.pi/agent/auth.json)
set -a
[ -f /root/.hermes/.env ] && . /root/.hermes/.env
set +a
unset PI_PROVIDER PI_MODEL
export WORKSHOP_TOKEN=demo-grill-2026
export PORT=8000
cd /root/workshop-learn/pi-runtime
while true; do
  npx tsx src/server.ts
  code=$?
  echo "[watchdog] server exited code=$code, restarting in 3s..."
  sleep 3
done
