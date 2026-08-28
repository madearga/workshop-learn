# Quiz instant feedback (dua-state) — RESOLVED

*Label: wayfinder:research · Status: CLOSED (implementasi shipped; verifikasi model menunggu Z.ai quota reset 12:16)*

## Question

Kartu quiz sekarang: pilih → verdict text muncul setelah "Lanjut" (satu giliran penuh). Referensi: **dua-state** — pilih opsi → interface langsung diganti feedback (✓/✗ per opsi, kunci jawaban, penjelasan) → lanjut. `I don't know` jadi outcome terpisah (bukan salah, tanpa ✗). Shuffle opsi default; order post-shuffle yang di-grade.

## Resolution

**Keputusan: dua-state penuh, grading tetap server-side.**

- Kartu quiz React dua state: `select` (opsi + "Saya tidak tahu") → `feedback` (✓ kunci hijau, ✗ pilihan merah, lainnya redup; kunci + penjelasan; tombol Lanjut).
- Kunci & penjelasan **tidak dikirim saat quiz dibuat** — baru dibalikin `/api/quiz-attempt` SETELAH pilihan terekam (idempotent tetap jalan). Client fallback ke explanation envelope kalau respons kosong.
- Shuffle client-side sekali per mount; grading by label → tak ada state shuffle yang perlu disinkronkan server. ponytail note: pendingQuiz in-memory — restart server antara attempt & grading grade salah; persist ke SQLite kalau jadi keluhan nyata.
- "Saya tidak tahu": feedback khusus tanpa ✗, teks "Tidak apa-apa — ini gap yang akan kita isi."
- tsc + build pass; smoke E2E tertunda Z.ai 429 (reset 12:16) — verifikasi model menyusul.

*Commit: cb476d1.*