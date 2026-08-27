# workshop-learn

Web tutor AI untuk workshop — peserta belajar via chat dengan metode **probe → plan → teach** (diadaptasi dari [amosblomqvist/learn](https://github.com/amosblomqvist/learn)).

## Fitur
- **Tutor Socratic** — quiz probe buat petakan level, plan approval, teaching per konsep (Bahasa Indonesia)
- **Quiz interaktif** — opsi diacak, grading instan, "Saya tidak tahu" sebagai sinyal jujur, penjelasan setelah jawab
- **Diagram** — Mermaid (struktur/relasi) + SVG (spasial/geometri), sanitasi otomatis
- **Riset fakta** — tutor bisa minta verifikasi `[RESEARCH] <topik>`, hasil tampil sebagai collapsible card
- **Persistensi** — sesi resumable per peserta (SQLite), riwayat chat + quiz evidence tersimpan
- **Mastery tracking** — skor penguasaan 0-1 per konsep, due-review queue buat konsep lemah
- **Host dashboard** (`/host`) — heatmap peserta × konsep buat facilitator
- **Lesson export** — download transcript `.md`

## Stack
- Frontend: React 19 + TypeScript + Vite + Tailwind v4 + shadcn/ui + Mermaid.js + react-markdown
- Backend: FastAPI (Python) + SQLite (stdlib)
- LLM: Z.ai `glm-5.3-flash` (key server-side, tidak pernah ke client)

## Setup
```bash
npm install
npx shadcn@latest add button card input badge separator collapsible skeleton --yes
npm run build

pip install fastapi uvicorn pydantic
export ZAI_API_KEY=<key dari Z.ai>
export WORKSHOP_TOKEN=<token workshop>   # opsional: auth tambahan
python -m uvicorn server:app --host 127.0.0.1 --port 8000
```

## Pakai
- Peserta: buka app → isi nama → belajar (sesi auto-resume)
- Host: buka `/host` → masukkan `WORKSHOP_TOKEN` → heatmap pemahaman peserta

## Catatan
- `tutor_system.txt` = prompt tutor (server-side, bisa diedit)
- Ekspor konsep tag masih pakai teks pertanyaan quiz; bisa dipertajam dengan konsep graph nanti
