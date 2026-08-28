# Lesson log ala md-log (callout format) — RESOLVED

*Label: wayfinder:grilling · Status: CLOSED*

## Question

Referensi punya `md-log`: mirror markdown live dari sesi — callout `[!quote] YOU` / `[!abstract] PI` / `[!question]` / `[!success]/[!failure] Quiz` — untuk dibaca di Obsidian. App kita punya lesson export .md tapi formatnya polos. Apakah export diubah ke format callout, dua mode, atau biarkan?

## Resolution

**Keputusan: satu mode — callout format penuh ala referensi.**

- `downloadLesson` sekarang emit: `[!info] Sesi belajar` (header) → `[!quote] Saya` / `[!abstract] Tutor` per pesan → `[!question] Quiz N` + opsi (pre-answer, tanpa kunci — parity md-log) → `[!info] Riset`.
- Multi-line di-`>` escape dengan benar; non-Obsidian reader tetap terbaca sebagai blockquote (graceful degradation, sama seperti referensi yang log-nya valid di mana saja).
- Timing live-log (backfill, dsb.) tidak direplikasi — tidak relevan untuk web app.
- Verdict `[!success]/[!failure]` tidak ditambahkan: attempt data ada di SQLite, bukan di `msgs` — kalau mau, jadi ticket kecil terpisah.

*Commit: d28455b.*