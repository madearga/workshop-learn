/**
 * ParticipantSession — the app-owned facade over one Pi AgentSession.
 *
 * Only this module knows Pi's types, the JSONL transcript format, and the
 * live-session lifecycle. HTTP routes and runTurn see plain data.
 *
 * ponytail: transcript() re-reads the JSONL file per call — fine at workshop
 * scale (<50 participants, small files). Add an in-memory cache if profiling
 * ever disagrees.
 */
import fs from "node:fs";
import path from "node:path";
import type { AgentSession } from "@earendil-works/pi-coding-agent";
import type { QuizCard } from "./types.js";

export interface LiveSession {
  session: AgentSession;
  lastUsed: number;
  turnBuf: string;
  turnEvents: object[];
  turnId: number;
  done: boolean;
  pendingQuiz?: QuizCard;
}

/** Extract plain text from a Pi message content field (string | content blocks). */
export function messageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((b: { type?: string }) => b.type === "text")
      .map((b: { text?: string }) => b.text ?? "")
      .join("");
  }
  return "";
}

/** Read the Pi JSONL session file into ordered display messages. */
export function readTranscript(file: string | undefined | null): { role: string; content: string }[] {
  if (!file || !fs.existsSync(file)) return [];
  const messages: { role: string; content: string }[] = [];
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line) as { type?: string; message?: { role?: string; content?: unknown } };
      const msg = entry.message;
      if (!msg?.role) continue;
      const text = messageText(msg.content);
      if (!text) continue;
      messages.push({ role: msg.role, content: text });
    } catch { /* skip malformed line */ }
  }
  return messages;
}

/** Pi's session file path, via the one type-cast allowed to know about it. */
export function piSessionFile(session: AgentSession): string | undefined {
  return (session as unknown as { sessionFile?: string }).sessionFile;
}
