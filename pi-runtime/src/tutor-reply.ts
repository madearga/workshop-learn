/**
 * TutorReply — parse raw model output into a validated TurnEnvelope.
 *
 * Deep module: bad/truncated/malformed model output in, safe envelope out.
 * Strategies, in order: fenced ```json block → balanced-brace scan → plain prose.
 * One repair attempt: if the JSON parses but fails validation, retry after
 * stripping common malformations (trailing commas, smart quotes).
 *
 * ponytail: heuristic repair, no LLM re-ask. If incident data shows specific
 * model tics, add them here — the test table below is the record.
 */
import type { TurnEnvelope } from "./types.js";

export interface ParsedReply {
  envelope: TurnEnvelope;
  /** How the envelope was recovered from raw output. */
  source: "fenced-json" | "balanced-json" | "repaired-json" | "plain-prose";
}

/** Validate the shape we actually rely on downstream. */
function isValid(e: unknown): e is TurnEnvelope {
  if (!e || typeof e !== "object") return false;
  const env = e as TurnEnvelope;
  if (typeof env.prose !== "string") return false;
  if (env.quiz) {
    const q = env.quiz as Record<string, unknown>;
    if (typeof q.question !== "string") return false;
    if (!Array.isArray(q.options) || q.options.length < 2) return false;
    for (const o of q.options as unknown[]) {
      const opt = o as Record<string, unknown>;
      if (typeof opt.label !== "string" || typeof opt.value !== "string") return false;
    }
  }
  return true;
}

/** One repair pass: fix the common model tics we've actually seen. */
function repair(json: string): string {
  // Escape raw control chars inside string values (model wrote literal newlines/tabs in prose).
  // Walk char-by-char so we only touch content INSIDE strings.
  let out = "";
  let inString = false;
  let escaped = false;
  for (const ch of json) {
    if (escaped) { out += ch; escaped = false; continue; }
    if (ch === "\\" && inString) { out += ch; escaped = true; continue; }
    if (ch === '"') { inString = !inString; out += ch; continue; }
    if (inString) {
      if (ch === "\n") { out += "\\n"; continue; }
      if (ch === "\t") { out += "\\t"; continue; }
      if (ch === "\r") { continue; }
      out += ch;
      continue;
    }
    // outside strings: still fix trailing commas + smart quotes
    out += ch;
  }
  return out
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'");
}

/** Balanced-brace scan: return the first complete top-level {...} object. */
function firstBalancedObject(text: string): string | undefined {
  const start = text.indexOf("{");
  if (start === -1) return undefined;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escaped) { escaped = false; continue; }
    if (ch === "\\") { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return undefined;
}

function buildEnvelope(parsed: TurnEnvelope, raw: string, fencedBlock?: string): TurnEnvelope {
  const prefix = fencedBlock ? raw.replace(fencedBlock, "").trim() : "";
  return {
    prose: [prefix, parsed.prose].filter(Boolean).join("\n\n"),
    phase: parsed.phase,
    quiz: parsed.quiz,
    ask: parsed.ask,
    mermaid: parsed.mermaid,
    svg: parsed.svg,
    researchTopic: parsed.researchTopic,
  };
}

export function parseTutorReply(raw: string): ParsedReply {
  // Strategy 1: fenced ```json block
  const fence = raw.match(/```json\s*\n([\s\S]*?)```/);
  if (fence?.[1]) {
    try {
      const parsed = JSON.parse(fence[1]) as TurnEnvelope;
      if (isValid(parsed)) return { envelope: buildEnvelope(parsed, raw, fence[0]), source: "fenced-json" };
    } catch { /* fall to repair */ }
    try {
      const parsed = JSON.parse(repair(fence[1])) as TurnEnvelope;
      if (isValid(parsed)) return { envelope: buildEnvelope(parsed, raw, fence[0]), source: "repaired-json" };
    } catch { /* fall through */ }
  }

  // Strategy 2: first balanced {...} object anywhere in the text
  const candidate = firstBalancedObject(raw);
  if (candidate) {
    try {
      const parsed = JSON.parse(candidate) as TurnEnvelope;
      if (isValid(parsed)) {
        return { envelope: buildEnvelope(parsed, raw.replace(candidate, "").trim() ? raw : raw), source: "balanced-json" };
      }
    } catch { /* fall to repair */ }
    try {
      const parsed = JSON.parse(repair(candidate)) as TurnEnvelope;
      if (isValid(parsed)) return { envelope: buildEnvelope(parsed, ""), source: "repaired-json" };
    } catch { /* fall through */ }
  }

  // Strategy 3: plain prose — always safe
  return { envelope: { prose: raw.trim() }, source: "plain-prose" };
}
