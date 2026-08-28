# Visualize threshold & LaTeX

*Label: wayfinder:task · Status: OPEN · Blocked by: —*

## Question

Dua gap prompt terhadap referensi: (1) **Visualize threshold** — diagram hanya jika picture > prose (dependency/flow/spatial), max ~5-7 elemen, satu ide, diperkenalkan satu kalimat. Prompt kita sudah punya rule mermaid/SVG tapi belum ada threshold "jangan kalau prose cukup". (2) **LaTeX** — referensi format math sebagai `$...$`/`$$...$$`, bukan ASCII. Frontend kita belum render LaTeX.

Kerja: tambah rule visualize ke AGENTS.md; kalau diputuskan LaTeX perlu → tambah KaTeX ke frontend (dependency baru — perlu justifikasi dari frekuensi materi math di workshop aktual). Detail: `LEARNER_UX_SPEC.md` §5.