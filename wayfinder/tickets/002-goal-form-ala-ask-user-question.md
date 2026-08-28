# Kartu pertanyaan non-graded (ask_user_question) — RESOLVED

*Label: wayfinder:prototype · Status: CLOSED (implementasi shipped)*

## Question

Referensi punya DUA kartu berbeda: `quiz` (graded, ada kunci) dan `ask_user_question` (non-graded: preferensi, konfirmasi, arah — tanpa kunci, boleh free-text + opsi "Other"). App kita sekarang cuma punya quiz. Kapan tutor butuh pertanyaan non-graded (misal: "mau fokus ke mana", konfirmasi plan, klarifikasi goal)?

## Resolution

**Keputusan: envelope type baru `ask` — kartu terpisah, non-graded, tanpa grading server.**

- Envelope: `{ask: {question, options?: [{label, description?}]}}` — tanpa `options` = free-text question.
- `AskBlock` React: single-select + "Lainnya" (custom text route, bisa balik ke pilihan), atau langsung free-text kalau tanpa opsi. Setelah dijawab → `✓ <jawaban>`.
- Jawaban dikirim ke tutor sebagai pesan `[ask] <question> — jawaban: <ans>` — tutor baca sebagai konteks, bukan grading.
- Parser (`tutor-reply.ts`) meneruskan field `ask` (sebelumnya ke-drop di buildEnvelope); 13 tests tetap pass.
- Mobile adaptation dari spec referensi: keyboard nav ↑↓/Enter diganti tap; "Other" → "Lainnya"; deskripsi opsi muted di bawah label.
- Goal form akan dimigrasi ke kartu ini (merged nanti) — dan tutor perlu tahu format `ask` di AGENTS.md (write keblok, butuh approval user).

*Commit: 7dcad32.*