# Pi-mono exploration: embed Pi as tutor engine

Date: 2026-08-27. Sources: pi-mono repo (cloned, inspected), pi.dev/docs, sitegeist repo README.

## Key findings

1. **`@earendil-works/pi-agent-core`** — `Agent` class, programmatic, no CLI needed:
   - `new Agent({ initialState: { systemPrompt, model }, streamFn })`
   - `agent.subscribe(fn)` → streaming events (message_update/text_delta etc.)
   - `await agent.prompt(text)`
   - Custom message types via declaration merging (quiz cards possible as UI-only messages)

2. **`@earendil-works/pi-ai`** — custom OpenAI-compatible provider is a first-class pattern:
   `createProvider({ id, baseUrl, auth: {apiKey...}, models: [...], api: openAICompletionsApi() })`
   → Z.ai glm-5.3-flash drop-in (baseUrl `https://api.z.ai/api/coding/paas/v4`).

3. **Sessions**: `@earendil-works/pi-session-backend-sqlite-node` — SqliteSessionRepository,
   create/appendMessage, FTS search built-in. Replaces our manual transcript persistence.

4. **`@earendil-works/pi-server` + `pi-client`** (experimental): session server over Unix socket /
   WebSocket transports with auth hooks + CBOR protocol. This is the Sitegeist-style architecture:
   one Node service, N sessions, transport to any UI.

5. **`AgentSessionConfig`** (coding-agent): skills/extensions loading via ResourceLoader,
   tool allowlist/denylist (lockdown for public use), customTools injection.

6. **Sitegeist pattern** (badlogic, same author as learn): browser extension embeds pi runtime as a
   library dependency (pi-mono sibling dir), BYOK multi-provider, sessions managed by the runtime.

## Recommended architecture

Two viable paths:
- **A. Node bridge (minimal change)**: keep React frontend + FastAPI; add a small Node service
  exposing HTTP/WS that wraps pi-agent-core (one Agent per participant, sqlite sessions).
  FastAPI proxies /api/chat → Node bridge for participant turns; keeps mastery/host endpoints.
- **B. Full TS backend**: port host-matrix etc. to the Node service, retire FastAPI. Cleaner
  long-term, more migration work.

Pick A first: smallest diff, demo keeps working while engine swaps.

Minimal sketch (bridge):

```ts
import { Agent } from "@earendil-works/pi-agent-core";
import { createModels, createProvider } from "@earendil-works/pi-ai";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";

const zai = createProvider({
  id: "zai", baseUrl: "https://api.z.ai/api/coding/paas/v4",
  auth: { apiKey: process.env.ZAI_API_KEY! },  // resolve shape per docs
  models: [{ id: "glm-5.3-flash", api: "openai-completions", provider: "zai",
             baseUrl: "https://api.z.ai/api/coding/paas/v4", ... }],
  api: openAICompletionsApi(),
});
const models = createModels(); models.setProvider(zai);

const agent = new Agent({
  initialState: { systemPrompt: fs.readFileSync("tutor_system.txt","utf8"), model: zaiModel },
  streamFn: models.streamSimple.bind(models),
});
agent.subscribe(e => ws.send(JSON.stringify(e)));  // stream to React
await agent.prompt(userMessage);                    // session persisted via sqlite backend
```

## Gotchas
- `pi-server` marked experimental (API unstable) — prefer direct `Agent` usage in a small bridge.
- Provider `auth` object shape must match current pi-ai version (verify at install time).
- Skill loading (`.pi/skills/teach`) is ResourceLoader/coding-agent territory; in pure
  pi-agent-core, skills are "just" the system prompt + tools we define manually (fine for us).
- Node 22 on VPS is available; one process, N Agents in-memory ≈ lightweight per session.

## Migration map (current → Pi engine)
- tutor_system.txt → initialState.systemPrompt (keep server-side load)
- /api/chat Z.ai call → agent.prompt() per participant (Agent map keyed by participant id)
- transcript SQLite (ours) → pi sqlite session backend OR keep ours in parallel
- mastery/quiz_events → stays in our store.py (FastAPI) — orthogonal to engine
- quiz rendering → keep custom JSON-block approach first; later define custom agent message type
