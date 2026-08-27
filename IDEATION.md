# Ideation: workshop-learn improvements (gap vs amosblomqvist/learn)

Run: 2026-08-27 · Mode: repo-grounded · Grounding: codebase scan + web research + ideation fleet (4 frames, 12 ideas → critique → top 5)

## Top 5 (ranked)

### 1. Resumable participant sessions — Effort: M
Private durable identity per participant; persist transcript, approved plan, quiz events, mastery state, last position. Reload/return reopens the session.
Why: workshops = unreliable Wi-Fi + accidental reloads. Without resume, every other feature is temporary.
Reuse: token auth boundary, lesson .md representation, quiz payloads.

### 2. Persisted quiz evidence + minimal concept mastery — Effort: M
Save each quiz result with concept tags; simple 0-1 confidence per learner/concept (correct raises, wrong/I-don't-know lowers more). Score steers next probe/plan/reteach.
Why: distinguishes "finished the screen" from "can retrieve the concept" without full BKT complexity.
Reuse: quiz verdict, "tidak tahu" signal, explanations, one-question-per-turn loop.

### 3. Facilitator misconception heatmap — Effort: M
Host-only dashboard: participants × concept matrix, red = repeated misses, amber = uncertain, green = recalled. Click red to see the dominant wrong answer → pause room for targeted intervention.
Why: turns isolated chats into a workshop the facilitator can actually run.
Reuse: quiz events from #2, token auth for host access, React rendering.

### 4. Due-review queue (spaced retrieval) — Effort: S
Missed/uncertain concepts enter a simple queue (later today → 1 day → 3/7 days). New session opens with 1-2 due retrieval questions before new material.
Why: highest-leverage retention feature once quiz evidence exists; extends learning past the live session.
Reuse: quiz result format, "tidak tahu" signal, session entry point.

### 5. SVG visual authoring with render verification — Effort: M
Port reference svg-maker: generate SVG for spatial concepts (geometry, vectors, number lines), render → verify → embed. Mermaid stays for graphs/flows; prompt routing rule: mermaid=relational, svg=spatial, none=prose.
Why: many workshop concepts aren't node-edge diagrams; verify loop prevents wrong-looking-but-plausible diagrams.
Reuse: reference svg_tools.ts + write/edit/render loop pattern, existing Mermaid fallback pattern.

## Rejected ideas (with reasons)
- Live roster with status — weak without durable identity + quiz data (needs #1, #2 first)
- End-of-workshop export — derivative view once persistence + dashboard exist
- Render-verify-publish as standalone — it's an acceptance rule inside #5, not a feature
- Visual selection rule — prompt-level, ships alongside #5, not a slot of its own
- Workshop join codes — implementation detail of #1, not a separate outcome
- Session library/archive — resume + server-persisted transcripts covers the need

## Dependencies
#1 → #2 → (3, 4) ; #5 independent.
Recommended order: 1, 2, then 3+4, then 5.
