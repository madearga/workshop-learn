# Ideation: Pi-first rebuild workshop-learn

Date: 2026-08-27. Scope: Sitegeist-style Pi runtime while preserving current workshop capabilities.

## Grounding

Current app: React/shadcn UI, FastAPI façade, SQLite workshop evidence, Pi CLI bridge. Existing features to preserve: participant auth, transcript restore, quiz/grading, mastery, due review, host heatmap, research cards, Mermaid/SVG, markdown export, Z.ai fallback.

Pi facts: SDK `createAgentSession` supports session lifecycle and events; JSON mode emits JSONL events; RPC supports non-Node integrations; Pi sessions are tree-structured JSONL; ResourceLoader loads project instructions/skills; tool allowlists are available. Sitegeist validates custom browser UI + Pi runtime, but its legacy `pi-web-ui`/IndexedDB pattern should not be copied wholesale.

## 35 candidates → critique

Candidates were evaluated for demo value, YAGNI, complexity, and regression risk. Reject: full TypeScript rewrite (too large), SQLite transcript import (migration-only), third-party extensions (unsafe), raw Pi events in React (couples UI), full-duplex WebSocket (SSE+POST enough), telemetry UI (no learner value), Bayesian/FSRS models (no data), session library (resume enough), arbitrary browsing agent (cost/security), whiteboard (scope drift), SaaS RBAC/billing (no evidence), SVG vision loop (defer until failures), append-only ledger (only if retries duplicate).

## Top 7

1. **Long-lived Pi AgentSession behind FastAPI** — Node bridge, one session per participant, retain FastAPI/SQLite/Z.ai fallback. Effort M. Acceptance: two isolated sessions, restart resumes, fallback remains green.
2. **App-owned SSE contract** — normalize Pi into `turn_started`, `text_delta`, `final`, `error`, with IDs and active-turn replay. Effort M. Acceptance: visible progressive text, reconnect without duplicates.
3. **Pi JSONL as conversation authority** — SQLite stores participant→Pi session pointer plus workshop evidence only. Effort M. Acceptance: restored dialogue matches Pi; no duplicate transcript.
4. **Typed tutor turn envelope** — final turn has prose + optional quiz/visual/research/phase; validate server-side and repair once. Effort M. Acceptance: deterministic cards; malformed output safe; plain prose works.
5. **Authoritative quiz command + stable concept IDs** — server owns grading and idempotent `quiz_id`; mastery aggregates by `concept_id`. Effort M. Acceptance: replay is idempotent; differently worded quizzes share mastery.
6. **Runtime-owned bounded research tool** — allowlisted Pi tool, limits, provenance, typed research card. Effort M. Acceptance: one bounded call; result stays in Pi session; no browser-forged assistant message.
7. **Workshop guardrails** — opaque participant tokens, separate host secret, Pi tool allowlist, timeouts, concurrency cap, explicit Z.ai fallback. Effort S–M. Acceptance: no token guessing/escalation/tool escape; safe failure.

## Recommended order

1. #1 + #7
2. #2
3. #3
4. #4 + #5
5. #6
6. Revisit SVG verification only after real failures.

## Key decision

Do not rebuild the UI. Rebuild the engine seam first. Keep the current app deployable while Pi runtime is proven behind a feature flag.
