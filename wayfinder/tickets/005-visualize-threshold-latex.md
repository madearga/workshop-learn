# Visualize threshold & LaTeX — RESOLVED (LaTeX deferred)

*Label: wayfinder:task · Status: CLOSED — threshold shipped; LaTeX deferred*

## Question

Dua gap prompt terhadap referensi: (1) **Visualize threshold** — diagram hanya jika picture > prose (dependency/flow/spatial), max ~5-7 elemen, satu ide, diperkenalkan satu kalimat. (2) **LaTeX** — referensi format math sebagai `$...$`/`$$...$$`, bukan ASCII. Frontend belum render LaTeX.

## Resolution

**1. Visualize threshold: shipped.** AGENTS.md DIAGRAM rule diupdate — diagram HANYA jika gambar > prose (dependency/flow/spatial sulit dijelaskan teks); prose cukup = tanpa diagram; max 5-7 elemen, satu ide per diagram, diperkenalkan satu kalimat.

**2. LaTeX: DEFERRED — tidak diimplementasikan sekarang.** Alasan: workshop content aktual (fotografi, coding, bisnis) nyaris tanpa formula; KaTeX = dependency frontend baru + setup render, tanpa justifikasi pemakaian. Prompt LaTeX rule tidak ditambahkan (write keblok). Revisit kalau ada materi math yang sering — tambahkan KaTeX + rule prompt dalam satu perubahan kecil.

*Commit: bagian threshold di commit setelah 85d14e3.*
