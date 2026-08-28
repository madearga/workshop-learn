# Plan approval gate dengan dependency DAG

*Label: wayfinder:task · Status: OPEN · Blocked by: 001*

## Question

Referensi Phase 2 (plan): tutor posting plan = prose + **Mermaid DAG kecil** (unconditional truths di root, derived concepts tergantung, goal peserta sebagai sink), lalu **BERHENTI menunggu approval** — teaching tidak boleh mulai sebelum go-ahead. App kita punya plan card tapi tidak mewajibkan DAG dan gate-nya bisa dilewati.

Kerja: pastikan prompt tutor (pi-agent/AGENTS.md) selalu emit DAG mermaid di fase plan; frontend render DAG inline + tombol approval eksplisit; envelope `phase: "plan"` mengunci input free-text sampai disetujui (satu input per giliran). Detail: `LEARNER_UX_SPEC.md` §1 Phase 2, §5 Plan diagram.