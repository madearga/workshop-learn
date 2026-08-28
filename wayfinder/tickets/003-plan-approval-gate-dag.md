# Plan approval gate dengan dependency DAG — RESOLVED

*Label: wayfinder:task · Status: CLOSED (implementasi shipped)*

## Question

Referensi Phase 2 (plan): tutor posting plan = prose + **Mermaid DAG kecil** (unconditional truths di root, derived concepts tergantung, goal peserta sebagai sink), lalu **BERHENTI menunggu approval** — teaching tidak boleh mulai sebelum go-ahead. App kita punya plan card tapi tidak mewajibkan DAG dan gate-nya bisa dilewati.

## Resolution

**Keputusan: DAG wajib di prompt, approval sebagai protocol `[plan]`.**

- AGENTS.md Phase 2 direwrite: plan = prose + mermaid DAG (akar = unconditional truths, anak = konsep turunan, goal = sink). Setelah posting, STOP — teaching dilarang sampai `[plan] disetujui`. Minta ubah → revisi + stop lagi.
- Tambahan dari source review (baris 118 SKILL.md referensi): stress-test roots — node foundational dicek dulu, kalau masih bisa diturunkan dari sesuatu yang lebih sederhana, didorong ke bawah.
- Plan card frontend: badge "Rencana belajar" + badge "Disetujui" setelah approval; tombol Setuju kirim `[plan] disetujui. Mulai dari node pertama.` + tandai card approved (tombol hilang); tombol Ubah kirim `[plan] Ubah rencananya:`.
- DAG mermaid kini dirender di DALAM plan card (sebelumnya di luar).

**Verified live:** tutor produce `phase: "plan"` + DAG mermaid valid (`graph TD; Subjek → Keseimbangan → Rule of thirds → Latihan; goal sink`).

*Commit: 80a2c74. Source review: /tmp/learn-ref (amosblomqvist/learn @ main, SKILL.md lines 113-120).*