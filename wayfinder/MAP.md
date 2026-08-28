# Wayfinder Map: UI/UX Parity dengan Referensi

*Label: wayfinder:map · Tracker: local-markdown (tickets di `wayfinder/tickets/`)*

## Destination

Learner experience workshop-learn **identik dengan amosblomqvist/learn** (quiz instant-feedback, ask-user-question popup, plan approval gate, visualize) — **plus** fitur khas workshop: mastery tracking, due review, host heatmap. Keputusan user: *"Lebih baik dari referensi: identik tapi di atasnya tambah mastery/heatmap khas kita"*; goal form mengikuti pola ask_user_question referensi mentah.

## Notes

- Referensi: `amosblomqvist/learn` — spec lengkap learner-facing UX diekstrak ke **`LEARNER_UX_SPEC.md`**; source clone di `/tmp/learn-ref`.
- Skills: `grilling`, `domain-modeling`, `prototype` untuk tiket HITL.
- Stack: React 19 + shadcn/ui + Tailwind v4, TS server `pi-runtime/src/server.ts`, envelope typed di `types.ts`, quiz state di SQLite.
- Bahasa UI: Bahasa Indonesia santai-tegas (bukan copy verbatim English dari referensi — struktur & perilaku yang diikuti, wording diadaptasi).
- Anti-regression: semua kapabilitas existing (mastery, due review, heatmap, restore, guardrails) tidak boleh rusak.
- `pi-agent/AGENTS.md` = protected file; write butuh approval user (approval prompt kadang ga nyampe — ulang saat user online).

## Decisions so far

- [Quiz instant feedback (dua-state)](tickets/001-quiz-instant-feedback.md): kartu select→feedback, kunci+penjelasan dibalikin server setelah attempt, I-don't-know jalur terpisah; shuffle client-side, grading by label.
- [Goal form mengikuti pola referensi](tickets/002-goal-form-ala-ask-user-question.md): goal bukan layar terpisah — jadi kartu `ask_user_question` non-graded dalam alur probe.
- [Kartu ask non-graded](tickets/002-goal-form-ala-ask-user-question.md): envelope `ask` + AskBlock (pilihan + "Lainnya" custom / free-text), jawaban sebagai `[ask] ...` ke tutor; AGENTS.md terdokumentasi.
- [Plan approval gate + DAG](tickets/003-plan-approval-gate-dag.md): plan = prose + Mermaid DAG wajib (truths→turunan→goal sink), stop sampai `[plan] disetujui`; plan card frontend dengan state Disetujui.
- [Lesson log callout](tickets/004-lesson-log-md-callout.md): export .md pakai callout format referensi ([!quote]/[!abstract]/[!question]/[!info]); verdict success/failure di-skip (data di SQLite).
- [Visualize threshold + LaTeX](tickets/005-visualize-threshold-latex.md): threshold shipped ke AGENTS.md (gambar > prose, max 5-7 elemen); LaTeX deferred — tanpa justifikasi pemakaian.

## Not yet specified

- Transisi antar-fase di UI (badge phase / pesan sistem) — semua tiket selesai; jadi kandidat tiket baru kalau mau.
- Migrasi GoalForm penuh ke kartu `ask` (sekarang goal masih form terpisah + kartu ask sudah siap).

## Out of scope

- KaTeX/LaTeX rendering — deferred sampai ada materi math yang sering (lihat #005).
- Verdict success/failure di lesson export — data attempt ada di SQLite, bukan di msgs.