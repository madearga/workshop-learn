/**
 * Workshop-learn Pi runtime server — Sitegeist-style embedded Pi agent.
 *
 * One AgentSession per participant (lazy, in-memory), Pi JSONL persists the
 * transcript (SessionManager.create with per-participant session dir), SSE
 * streams app-owned events, Fastify serves auth + quiz + mastery + host APIs.
 *
 * ponytail: sessions evicted after 30 min idle; per-turn timeout; Z.ai direct
 * fallback lives in the caller (nginx can't do this) — keep the Python server
 * around until this one passes smoke tests, then swap ports.
 */
import Fastify from "fastify";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createAgentSession,
  DefaultResourceLoader,
  ModelRuntime,
  SessionManager,
  SettingsManager,
  defineTool,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import Database from "better-sqlite3";
import { parseTutorReply } from "./tutor-reply.js";
import type { QuizCard, TurnEnvelope } from "./types.js";
import { messageText, piSessionFile, readTranscript, type LiveSession } from "./participant-session.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const PORT = Number(process.env.PORT ?? 8001);
const MODEL_PROVIDER = process.env.PI_PROVIDER ?? "zai";
const MODEL_ID = process.env.PI_MODEL ?? "glm-5.3-flash";
const HOST_TOKEN = process.env.WORKSHOP_TOKEN ?? "";
const SESSIONS_DIR = path.join(ROOT, "pi-sessions");
const TUTOR_PROMPT = fs.readFileSync(path.join(ROOT, "tutor_system.txt"), "utf8");
const TURN_TIMEOUT_MS = 120_000;
const IDLE_EVICT_MS = 30 * 60_000;
const MAX_ACTIVE = 30;

fs.mkdirSync(SESSIONS_DIR, { recursive: true });

// ---------- persistence (learning domain; Pi owns the transcript) ----------
const db = new Database(path.join(ROOT, "workshop.db"));
db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  token TEXT UNIQUE NOT NULL,
  goal_topic TEXT DEFAULT '',
  goal_outcome TEXT DEFAULT '',
  pi_session_file TEXT DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  participant_id INTEGER NOT NULL REFERENCES participants(id),
  quiz_id TEXT NOT NULL,
  concept_id TEXT NOT NULL,
  selected_label TEXT NOT NULL DEFAULT '',
  correct INTEGER NOT NULL,
  dont_know INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  UNIQUE(participant_id, quiz_id)
);
CREATE TABLE IF NOT EXISTS research_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  participant_id INTEGER NOT NULL REFERENCES participants(id),
  topic TEXT NOT NULL,
  facts TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
`);
try { db.exec(`ALTER TABLE participants ADD COLUMN pi_session_file TEXT DEFAULT ''`); } catch { /* column exists */ }
for (const col of ["goal_topic TEXT DEFAULT ''", "goal_outcome TEXT DEFAULT ''"]) {
  try { db.exec(`ALTER TABLE participants ADD COLUMN ${col}`); } catch { /* column exists */ }
}

const q = {
  participantByToken: db.prepare("SELECT * FROM participants WHERE token = ?"),
  participantById: db.prepare("SELECT * FROM participants WHERE id = ?"),
  ensureParticipant: db.prepare("INSERT INTO participants (name, token, created_at) VALUES (?, ?, ?)"),
  setSessionFile: db.prepare("UPDATE participants SET pi_session_file = ? WHERE id = ?"),
  setGoal: db.prepare("UPDATE participants SET goal_topic = ?, goal_outcome = ? WHERE id = ?"),
  saveQuiz: db.prepare(`INSERT INTO quiz_attempts (participant_id, quiz_id, concept_id, selected_label, correct, dont_know, created_at)
    VALUES (@pid, @quizId, @conceptId, @label, @correct, @dontKnow, @ts)
    ON CONFLICT(participant_id, quiz_id) DO NOTHING`),
  quizRows: db.prepare("SELECT concept_id, correct, dont_know FROM quiz_attempts WHERE participant_id = ?"),
  saveResearch: db.prepare("INSERT INTO research_items (participant_id, topic, facts, created_at) VALUES (?, ?, ?, ?)"),
  allParticipants: db.prepare("SELECT id, name FROM participants WHERE name != '__selftest__'"),
};

function masteryByConcept(pid: number): Record<string, number> {
  const rows = q.quizRows.all(pid) as { concept_id: string; correct: number; dont_know: number }[];
  const scores: Record<string, number[]> = {};
  for (const r of rows) {
    (scores[r.concept_id] ??= []).push(r.dont_know ? 0 : r.correct ? 1 : 0.1);
  }
  const out: Record<string, number> = {};
  for (const [concept, vals] of Object.entries(scores)) {
    out[concept] = Math.round(Math.min(1, Math.max(0, (vals.reduce((a, b) => a + b, 0) + 1) / (vals.length + 2))) * 100) / 100;
  }
  return out;
}

// ---------- tutor turn envelope (types in types.ts) ----------
type PublicQuiz = NonNullable<TurnEnvelope["quiz"]> & { quizId: string; conceptId: string };

const live = new Map<number, LiveSession>();

function sessionDirFor(pid: number) {
  const dir = path.join(SESSIONS_DIR, `p${pid}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function getLive(pid: number): Promise<LiveSession> {
  const existing = live.get(pid);
  if (existing) { existing.lastUsed = Date.now(); return existing; }
  if (live.size >= MAX_ACTIVE) {
    // evict oldest idle
    const oldest = [...live.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed)[0];
    if (oldest) { oldest[1].session.dispose(); live.delete(oldest[0]); }
  }
  const cwd = path.join(ROOT, "pi-agent");
  const modelRuntime = await ModelRuntime.create();
  const model = modelRuntime.getModel(MODEL_PROVIDER, MODEL_ID);
  if (!model) throw new Error(`model ${MODEL_PROVIDER}/${MODEL_ID} unavailable`);
  const loader = new DefaultResourceLoader({ cwd, agentDir: path.join(cwd, ".pi-agent-home") });
  await loader.reload();
  const { session } = await createAgentSession({
    cwd,
    modelRuntime,
    model,
    resourceLoader: loader,
    sessionManager: SessionManager.create(cwd, sessionDirFor(pid)),
    settingsManager: SettingsManager.create(cwd),
    noTools: "all", // guardrails: no shell/filesystem for the tutor
  });
  const s: LiveSession = { session, lastUsed: Date.now(), turnBuf: "", turnEvents: [], turnId: 0, done: true };
  live.set(pid, s);
  return s;
}

setInterval(() => {
  const now = Date.now();
  for (const [pid, s] of live) {
    if (now - s.lastUsed > IDLE_EVICT_MS) { s.session.dispose(); live.delete(pid); }
  }
}, 60_000).unref();

// ---------- the research tool (bounded, allowlisted) ----------
function researchTool(pid: number) {
  return defineTool({
    name: "verify_facts",
    label: "Verify facts",
    description: "Kembalikan 3-5 fakta kunci terverifikasi tentang satu topik. Gunakan saat butuh angka/tanggal/klaim spesifik.",
    parameters: Type.Object({ topic: Type.String({ maxLength: 300 }) }),
    execute: async (_id, params) => {
      // ponytail: reuse direct Z.ai call, not a second Pi session — bounded single-shot
      const facts = await directZai([
        { role: "system", content: RESEARCH_SYSTEM },
        { role: "user", content: `Topik: ${params.topic.slice(0, 300)}` },
      ], 0.3);
      q.saveResearch.run(pid, params.topic.slice(0, 300), facts, Date.now());
      return { content: [{ type: "text" as const, text: facts }], details: { topic: params.topic, facts } };
    },
  });
}

const RESEARCH_SYSTEM = "Kamu peneliti faktual. Diberikan topik, kembalikan 3-5 fakta kunci TERVERIFIKASI dalam Bahasa Indonesia, markdown list, setiap fakta dengan sumber (nama situs/institusi). Jika tidak yakin tandai [perlu verifikasi].";

async function directZai(messages: { role: string; content: string }[], temperature: number, timeoutMs = 45_000): Promise<string> {
  const key = process.env.ZAI_API_KEY;
  if (!key) throw new Error("ZAI_API_KEY not set");
  const res = await fetch("https://api.z.ai/api/coding/paas/v4/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL_ID, messages, temperature }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Z.ai ${res.status}`);
  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  return data.choices[0]?.message?.content ?? "";
}

// Attach a server-side quizId + hidden correctLabel to an envelope's quiz (if any).
/** Make mermaid@11-safe: quote node labels containing (), ", :, etc. */
function sanitizeMermaid(code: string): string {
  return code.replace(
    /\b(\w+)\[([^\]\n]+)\]/g,
    (full, id: string, label: string) =>
      // already quoted → neutralize inner double quotes only; else wrap in quotes
      label.startsWith('"') && label.endsWith('"')
        ? `${id}["${label.slice(1, -1).replace(/"/g, "'")}"]`
        : `${id}["${label.replace(/"/g, "'")}"]`,
  );
}

function attachQuiz(s: LiveSession, env: TurnEnvelope): PublicQuiz | undefined {
  if (!env.quiz || !env.quiz.question || !Array.isArray(env.quiz.options)) return undefined;
  const quizId = randomBytes(8).toString("hex");
  const conceptId = env.quiz.conceptId ?? env.quiz.question.slice(0, 80);
  // Preserve the model's original option order; the CLIENT shuffles for display
  // and grades by label, so no server-side shuffle to keep in sync.
  s.pendingQuiz = {
    question: env.quiz.question,
    options: env.quiz.options,
    correctLabel: env.quiz.correct ?? "",
    explanation: env.quiz.explanation ?? "",
    quizId, conceptId,
  };
  return { ...env.quiz, quizId, conceptId };
}

// envelope parsing moved to tutor-reply.ts (deep module, table-tested)

// ---------- fastify ----------
const app = Fastify({ logger: false });

function authPid(req: import("fastify").FastifyRequest): number {
  const tok = (req.headers.authorization ?? "").replace(/^Bearer /, "").trim();
  if (!tok || tok === HOST_TOKEN) throw Object.assign(new Error("participant identity required"), { statusCode: 401 });
  const row = q.participantByToken.get(tok) as { id: number } | undefined;
  if (!row) throw Object.assign(new Error("invalid participant token"), { statusCode: 401 });
  return row.id;
}
app.setErrorHandler((err, _req, reply) => {
  const code = (err as { statusCode?: number }).statusCode ?? 500;
  reply.code(code).send({ error: err.message });
});

app.post("/api/register", async (req) => {
  const body = req.body as { name?: string };
  const name = (body.name ?? "").trim().slice(0, 40);
  if (!name) throw Object.assign(new Error("empty name"), { statusCode: 400 });
  const token = "pt-" + randomBytes(24).toString("base64url"); // guardrail: opaque token
  const info = q.ensureParticipant.run(name, token, Date.now());
  return { participant_token: token, name };
});

// ---------- TutorTurn: the one deep module. Both HTTP routes are thin adapters over this. ----------
interface TurnResult {
  turnId: number;
  prose: string;
  phase?: TurnEnvelope["phase"];
  quiz?: PublicQuiz;
  mermaid?: string;
  svg?: string;
  researchTopic?: string;
}
/** Structured context that rides beside the text — the model never re-parses invented syntax. */
interface TurnContext {
  quizVerdict?: { correct: boolean; selectedLabel: string; dontKnow: boolean; conceptId: string };
}

async function runTurn(pid: number, prompt: string, ctx?: TurnContext): Promise<TurnResult> {
  const fullPrompt = ctx?.quizVerdict
    ? `${prompt}\n\n[KONTEKS TURN] Hasil quiz terakhir peserta: ${ctx.quizVerdict.dontKnow ? "menjawab tidak tahu" : ctx.quizVerdict.correct ? "BENAR" : "SALAH"}${ctx.quizVerdict.dontKnow ? "" : ` (memilih: ${ctx.quizVerdict.selectedLabel})`} — konsep: ${ctx.quizVerdict.conceptId}.`
    : prompt;
  const s = await getLive(pid);
  s.turnBuf = ""; s.turnEvents = []; s.done = false; s.turnId++;
  const turnId = s.turnId;
  let finalText = "";
  const unsub = s.session.subscribe((event) => {
    const anyEvt = event as {
      type: string;
      assistantMessageEvent?: { type?: string; delta?: string };
      message?: { role?: string; content?: unknown };
    };
    if (anyEvt.type === "message_update" && anyEvt.assistantMessageEvent?.type === "text_delta") {
      s.turnBuf += anyEvt.assistantMessageEvent.delta ?? "";
      s.turnEvents.push({ type: "text_delta", turnId, seq: s.turnEvents.length, delta: anyEvt.assistantMessageEvent.delta ?? "" });
    } else if (anyEvt.type === "message_end" && anyEvt.message?.role === "assistant") {
      finalText = messageText(anyEvt.message.content);
    }
  });
  try {
    await s.session.prompt(fullPrompt);
    await s.session.waitForIdle();
  } finally {
    unsub();
  }
  const raw = finalText || s.turnBuf;
  const env = parseTutorReply(raw).envelope;
  if (env.mermaid) env.mermaid = sanitizeMermaid(env.mermaid);
  const quiz = attachQuiz(s, env);
  const sessFile = piSessionFile(s.session);
  if (sessFile) q.setSessionFile.run(sessFile, pid);
  s.done = true;
  return {
    turnId,
    prose: env.prose || raw,
    phase: env.phase,
    quiz,
    mermaid: env.mermaid,
    svg: env.svg,
    researchTopic: env.researchTopic,
  };
}

app.post("/api/goal", async (req) => {
  const pid = authPid(req);
  const b = req.body as { topic?: string; outcome?: string };
  q.setGoal.run((b.topic ?? "").slice(0, 200), (b.outcome ?? "").slice(0, 300), pid);
  const result = await runTurn(
    pid,
    `GOAL PESERTA — topik: ${b.topic ?? "(belum diisi)"}; hasil yang diinginkan: ${b.outcome ?? "(belum diisi)"}.\n` +
    `Simpan goal ini sebagai acuan. Mulai PROBE sekarang: satu pertanyaan quiz singkat untuk memetakan level. Jangan jelaskan teori dulu.`,
  );
  return { ok: true, ...result };
});

app.get("/api/mastery", async (req) => {
  const pid = authPid(req);
  const mastery = masteryByConcept(pid);
  const due = Object.entries(mastery).filter(([, m]) => m < 0.5)
    .sort((a, b) => a[1] - b[1]).slice(0, 2)
    .map(([concept, m]) => ({ concept, mastery: m }));
  return { mastery, due };
});

app.post("/api/quiz-attempt", async (req) => {
  const pid = authPid(req);
  const b = req.body as { quizId?: string; conceptId?: string; selectedLabel?: string; dontKnow?: boolean };
  if (!b.quizId || !b.conceptId) throw Object.assign(new Error("quizId and conceptId required"), { statusCode: 400 });
  // Server-side grading: the client never sends `correct`.
  const s = live.get(pid);
  const card = s?.pendingQuiz?.quizId === b.quizId ? s.pendingQuiz : undefined;
  const correct = b.dontKnow ? 0 : card ? (card.correctLabel === b.selectedLabel ? 1 : 0) : 0;
  const info = q.saveQuiz.run({
    pid, quizId: b.quizId.slice(0, 64), conceptId: b.conceptId.slice(0, 80),
    label: (b.selectedLabel ?? "").slice(0, 100), correct, dontKnow: b.dontKnow ? 1 : 0, ts: Date.now(),
  });
  // Instant feedback: reveal the key + explanation only AFTER the choice is recorded.
  // ponytail: grading needs the pendingQuiz to still be in memory — restart between
  // attempt and grading grades wrong (recorded but correct=false). Persist pendingQuiz
  // to SQLite if server restarts mid-quiz become a real complaint.
  return {
    ok: true, recorded: info.changes > 0, correct: Boolean(correct),
    correctLabel: card?.correctLabel ?? "",
    explanation: card?.explanation ?? "",
  };
});

app.get("/api/host-matrix", async (req) => {
  const tok = (req.headers.authorization ?? "").replace(/^Bearer /, "").trim();
  if (!HOST_TOKEN || tok !== HOST_TOKEN) throw Object.assign(new Error("host only"), { statusCode: 403 });
  const out: { name: string; mastery: Record<string, number>; weakest: [string, number][] }[] = [];
  for (const row of q.allParticipants.all() as { id: number; name: string }[]) {
    const m = masteryByConcept(row.id);
    out.push({ name: row.name, mastery: m, weakest: Object.entries(m).sort((a, b) => a[1] - b[1]).slice(0, 5) });
  }
  return { participants: out };
});

// restore: rebuild transcript from Pi session file (via ParticipantSession facade)
app.get("/api/restore", async (req) => {
  const pid = authPid(req);
  const row = q.participantById.get(pid) as { pi_session_file: string } | undefined;
  return { messages: readTranscript(row?.pi_session_file) };
});

// chat: POST starts a turn; SSE delivers it. Keep POST /api/chat for the old UI (non-streaming).
app.post("/api/chat", async (req, reply) => {
  const pid = authPid(req);
  const body = req.body as {
    message?: string;
    messages?: { role: string; content: string }[];
    verdict?: { correct: boolean; selectedLabel: string; dontKnow: boolean; conceptId: string };
  };
  const text = body.message ?? body.messages?.filter((m) => m.role === "user").at(-1)?.content ?? "";
  if (!text.trim()) throw Object.assign(new Error("empty message"), { statusCode: 400 });
  const isQuizVerdict = text.startsWith("[quiz]");
  const r = await runTurn(pid, isQuizVerdict ? "Lanjutkan pengajaran berdasarkan hasil quiz berikut." : text, isQuizVerdict && body.verdict ? { quizVerdict: body.verdict } : undefined);
  reply.send({
    reply: r.prose,
    phase: r.phase,
    quiz: r.quiz,
    mermaid: r.mermaid,
    svg: r.svg,
    researchTopic: r.researchTopic,
    turnId: r.turnId,
  });
});

// SSE stream endpoint — normalized app-owned events with replay
// Auth: EventSource can't set headers, so allow ?token= (still participant-scoped).
app.get("/api/turn-stream", async (req, reply) => {
  const qp = (req.query as { token?: string }).token;
  const header = (req.headers.authorization ?? "").replace(/^Bearer /, "").trim();
  const tok = qp || header;
  const row = tok && tok !== HOST_TOKEN ? q.participantByToken.get(tok) as { id: number } | undefined : undefined;
  if (!row) { reply.code(401).send({ error: "invalid participant token" }); return; }
  const pid = row.id;
  const s = live.get(pid);
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  const send = (obj: object) => reply.raw.write(`data: ${JSON.stringify(obj)}\n\n`);
  if (!s) { send({ type: "idle" }); return reply.raw.end(); }
  for (const evt of s.turnEvents) send(evt);
  if (s.done) { send({ type: "final", turnId: s.turnId }); return reply.raw.end(); }
  // live follow
  const timer = setInterval(() => {
    if (s.done) { send({ type: "final", turnId: s.turnId }); clearInterval(timer); reply.raw.end(); }
  }, 500);
  req.raw.on("close", () => clearInterval(timer));
});

app.get("/api/health", async () => ({ ok: true, engine: "pi", model: `${MODEL_PROVIDER}/${MODEL_ID}` }));

// Serve the React build (same dist as before)
const DIST = path.join(ROOT, "dist");
app.register(import("@fastify/static"), {
  root: path.join(DIST, "assets"),
  prefix: "/assets/",
});
app.setNotFoundHandler((req, reply) => {
  if (req.url.startsWith("/api/")) { reply.code(404).send({ error: "not found" }); return; }
  const file = req.url === "/host" ? "host.html" : "index.html";
  reply.type("text/html").send(fs.readFileSync(path.join(DIST, file)));
});

app.listen({ port: PORT, host: "127.0.0.1" }, (err) => {
  if (err) { console.error(err); process.exit(1); }
  console.log(`pi-runtime listening on ${PORT}`);
});
