# Quiz instant feedback (dua-state)

*Label: wayfinder:research · Status: OPEN · Blocks: 003, 004, 006*

## Question

Kartu quiz sekarang: pilih → verdict text muncul setelah "Lanjut" (satu giliran penuh). Referensi: **dua-state** — pilih opsi → interface langsung diganti feedback (✓/✗ per opsi, kunci jawaban, penjelasan, note) → Enter/Esc lanjut. `I don't know` jadi outcome terpisah (bukan salah, tanpa ✗). Shuffle opsi default; order post-shuffle yang di-grade.

Keputusan yang harus diambil: apakah semua ini dipindah ke kartu quiz React sekarang (select state → instant feedback state dalam satu card, tanpa giliran tutor)? Termasuk: opsi `I don't know` terpisah visual, note opsional per-quiz, grading exact-set untuk multi-select.

Detail perilaku: `LEARNER_UX_SPEC.md` §3. Perhatian: opsi sekarang di-shuffle di backend? Cek `attachQuiz` di server.ts — shuffle harus persist order yang dilihat learner.