# Wayfinder Map: UI/UX Parity dengan Referensi

*Label: wayfinder:map · Tracker: local-markdown (tickets di `wayfinder/tickets/`)*

## Destination

Learner experience workshop-learn **identik dengan amosblomqvist/learn** (quiz instant-feedback, ask-user-question popup, plan approval gate, visualize) — **plus** fitur khas workshop: mastery tracking, due review, host heatmap. Keputusan user: *"Lebih baik dari referensi: identik tapi di atasnya tambah mastery/heatmap khas kita"*; goal form mengikuti pola ask_user_question referensi mentah.

## Notes

- Referensi: `amosblomqvist/learn` @ `7cfd894` — spec lengkap learner-facing UX sudah diekstrak ke **`LEARNER_UX_SPEC.md`** di root repo (baca dulu sebelum kerja tiket mana pun).
- Skills: `grilling`, `domain-modeling`, `prototype` untuk tiket HITL.
- Stack: React 19 + shadcn/ui + Tailwind v4, TS server `pi-runtime/src/server.ts`, envelope typed di `types.ts`, quiz state di SQLite.
- Bahasa UI: Bahasa Indonesia santai-tegas (bukan copy verbatim English dari referensi — struktur & perilaku yang diikuti, wording diadaptasi).
- Anti-regression: semua kapabilitas existing (mastery, due review, heatmap, restore, guardrails) tidak boleh rusak.

## Decisions so far

- [Goal form mengikuti pola referensi](tickets/002-goal-form-ala-ask-user-question.md): goal bukan layar terpisah — jadi kartu `ask_user_question` non-graded dalam alur probe.

## Not yet specified

- Detail transisi antar-fase di UI (badge phase? pesan sistem?) — menunggu tiket quiz & plan selesai.
- Bagaimana md-log dipetakan ke export lesson existing (download .md) — bentuk final menunggu keputusan format callout.

## Out of scope

- *(kosong — belum ada yang diruled out)*