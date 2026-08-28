# workshop-learn

Web tutor AI untuk workshop — peserta belajar via chat dengan metode **probe → plan → teach** (diadaptasi dari [amosblomqvist/learn](https://github.com/amosblomqvist/learn)).

Arsitektur: **Pi agent runtime tertanam di server TypeScript** (pola Sitegeist) — satu `AgentSession` per peserta, transcript tersimpan sebagai JSONL native Pi, learning-state di SQLite.

## Fitur
- **Tutor Socratic** — quiz probe buat petakan level, plan approval, teaching per konsep (Bahasa Indonesia)
- **Quiz interaktif** — grading server-side, idempotent (`quiz_id`), opsi diacak, "Saya tidak tahu"
- **Typed tutor envelope** — prose/quiz/diagram/fase tiba terstruktur & tervalidasi, bukan parsing teks
- **Diagram** — Mermaid (struktur/relasi) + SVG (spasial), sanitasi otomatis
- **Persistensi** — session Pi native (JSONL) + SQLite untuk identitas, quiz evidence, mastery
- **Mastery tracking** — skor 0-1 per `concept_id`, due-review queue buat konsep lemah
- **Host dashboard** (`/host`) — heatmap peserta × konsep
- **Lesson export** — download transcript `.md`
- **Goal** — form goal awal; tutor langsung mulai probe sesuai target peserta

## Stack
- Frontend: React 19 + TypeScript + Vite + Tailwind v4 + shadcn/ui + Mermaid.js + react-markdown
- Backend: TypeScript + Fastify + **@earendil-works/pi-coding-agent** (embedded AgentSession) + better-sqlite3
- LLM: Z.ai `glm-5.3-flash` (key server-side, tidak pernah ke client)

## Setup
```bash
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
cd pi-runtime && npm install --ignore-scripts && cd ..
npm install
npm run build

export ZAI_API_KEY=<key dari Z.ai>
export WORKSHOP_TOKEN=<token host>
./pi-runtime/run.sh   # listen di :8000, auto-restart
```

## Pakai
- Peserta: buka app → isi nama → isi goal → belajar (sesi auto-resume via Pi JSONL)
- Host: buka `/host` → masukkan `WORKSHOP_TOKEN` → heatmap pemahaman peserta

## Struktur
```
pi-runtime/src/
  server.ts               # Fastify routes — adapter tipis di atas runTurn
  tutor-reply.ts          # parse raw model output → envelope (table-tested)
  participant-session.ts  # facade: satu-satunya module yang tahu internal Pi
  types.ts                # TurnEnvelope, QuizCard
pi-agent/AGENTS.md        # instruksi tutor (dibaca Pi ResourceLoader)
```

## Catatan
- Rollback ke versi Python: branch `master`
- `tutor_system.txt` = prompt tutor canonical; `pi-agent/AGENTS.md` = versi Pi (sinkron manual)
