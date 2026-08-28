# Kartu pertanyaan non-graded (ask_user_question) terpisah dari quiz

*Label: wayfinder:prototype · Status: OPEN · Blocked by: —*

## Question

Referensi punya DUA kartu berbeda: `quiz` (graded, ada kunci) dan `ask_user_question` (non-graded: preferensi, konfirmasi, arah — tanpa kunci, boleh free-text + opsi "Other"). App kita sekarang cuma punya quiz. Kapan tutor butuh pertanyaan non-graded (misal: "mau fokus ke mana", konfirmasi plan, klarifikasi goal)?

Pertanyaan keputusan: envelope type baru `question` (non-graded, single-select + Other + free-text) di sisi server + kartu React terpisah? Wording Indonesia untuk struktur persis referensi (footer nav, "Other", custom answer). Detail: `LEARNER_UX_SPEC.md` §2.

Prototype dulu: stub kartu di App.tsx atau mockup HTML untuk direaksi user sebelum wiring ke server.