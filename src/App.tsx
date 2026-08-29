/**
 * App.tsx — Pi-first rebuild frontend.
 *
 * Changes from the FastAPI version:
 * - Tutor replies arrive as a typed envelope: {prose, quiz?, mermaid?, svg?, phase?}
 *   — no client-side brace/fence parsing for quiz content.
 * - Quiz grading is server-side: submit {quizId, conceptId, selectedLabel, dontKnow}
 *   to /api/quiz-attempt; the client never knows the correct answer.
 * - Goal capture: first-session form posts /api/goal, tutor starts with probe.
 * - Progressive text: /api/turn-stream SSE during a turn (best-effort; final still authoritative).
 */
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const TOKEN_KEY = "workshop-participant-token";
const GOAL_KEY = "workshop-goal-set";

interface QuizOption { label: string; value: string }
interface Quiz {
  question: string;
  options: QuizOption[];
  explanation: string;
  quizId: string;
  conceptId: string;
}
interface Msg {
  role: "user" | "assistant";
  text: string;
  quiz?: Quiz;
  ask?: { question: string; options?: { label: string; description?: string }[] } | null;
  mermaidCode?: string;
  svgCode?: string;
  research?: { topic: string; facts: string } | null;
  isPlan?: boolean;
  planApproved?: boolean;
}

async function registerAndGetToken(): Promise<string> {
  const existing = localStorage.getItem(TOKEN_KEY);
  if (existing) return existing;
  const name = prompt("Nama kamu:") || "";
  if (!name) return "";
  const r = await fetch("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const d = await r.json();
  if (d.participant_token) {
    localStorage.setItem(TOKEN_KEY, d.participant_token);
    return d.participant_token;
  }
  return "";
}
function getToken(): string { return localStorage.getItem(TOKEN_KEY) || ""; }
function authHeaders(): Record<string, string> {
  return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` };
}

// mermaid loaded lazily — it's ~2.5MB of diagram engines; only needed when a
// diagram actually arrives (Vercel rule 2.4 dynamic imports for heavy deps).
let mermaidReady: Promise<typeof import("mermaid").default> | null = null;
function getMermaid() {
  mermaidReady ??= import("mermaid").then((m) => {
    m.default.initialize({ startOnLoad: false, theme: "dark", securityLevel: "strict" });
    return m.default;
  });
  return mermaidReady;
}

function looksLikePlan(text: string): boolean {
  const hasList = (/\n1[.)]/.test(text) || text.startsWith("1.")) && /\n2[.)]/.test(text);
  const asks = /setuju|lanjut\?|konfirmasi|mulai\?/i.test(text);
  return hasList && asks;
}

const Mermaid = memo(function Mermaid({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    const id = "m" + Math.random().toString(36).slice(2);
    getMermaid().then((mm) => mm.render(id, code)).then(({ svg }) => {
      if (alive && ref.current) ref.current.innerHTML = svg;
    }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [code]);
  if (failed) return <Card className="my-2 p-3 text-sm text-muted-foreground">Diagram tidak dapat dirender.</Card>;
  return (
    <Card className="mermaid-svg my-2 max-w-full overflow-x-auto p-3 sm:p-4">
      <div ref={ref} />
    </Card>
  );
});

function ResearchCard({ topic, facts }: { topic: string; facts: string }) {
  return (
    <Collapsible className="w-full">
      <Card className="my-2 p-3 sm:p-4">
        <CollapsibleTrigger className="flex w-full items-center justify-between text-left text-sm font-medium">
          <span>Riset: {topic}</span>
          <Badge variant="secondary">fakta</Badge>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Separator className="my-2" />
          <div className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{facts}</div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function sanitizeSvg(svg: string): string {
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/\son\w+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "")
    .replace(/\s(xlink:href|href)\s*=\s*("(?!#)[^"]*"|'(?!#)[^']*')/gi, "");
}

function Svg({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    try {
      ref.current.innerHTML = sanitizeSvg(code);
    } catch {
      setFailed(true);
    }
  }, [code]);
  if (failed) return <Card className="my-2 p-3 text-sm text-muted-foreground">Diagram tidak dapat dirender.</Card>;
  return (
    <Card className="my-2 max-w-full overflow-x-auto p-3 sm:p-4">
      <div ref={ref} className="svg-host [&>svg]:h-auto [&>svg]:max-w-full" />
    </Card>
  );
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function QuizBlock({ quiz, onAnswered, onContinue, onRegister }: {
  quiz: Quiz;
  onAnswered: (correct: boolean, label: string, dontKnow: boolean) => void;
  onContinue: (label: string, ok: boolean) => void;
  onRegister: (quiz: Quiz) => void;
}) {
  // Two-state, mirroring the reference quiz: select → instant feedback replaces
  // the option list (✓/✗ marks, key, explanation); then a single Continue.
  const [state, setState] = useState<"select" | "feedback">("select");
  const [picked, setPicked] = useState<string | null>(null);
  const [dontKnow, setDontKnow] = useState(false);
  const [correct, setCorrect] = useState<boolean | null>(null);
  const [fbExplanation, setFbExplanation] = useState<string | null>(null);
  const [fbCorrectLabel, setFbCorrectLabel] = useState<string | null>(null);
  const [opts] = useState(() => shuffle(quiz.options));
  const [stale, setStale] = useState(false);
  useEffect(() => { onRegister(quiz); }, []);

  const submit = async (label: string, dk: boolean) => {
    if (state !== "select") return;
    // Blur before the select→feedback swap removes the focused option button:
    // a removed focused element makes Chromium jump focus (and scroll) to body.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    if (dk) setDontKnow(true); else setPicked(label);
    try {
      const r = await fetch("/api/quiz-attempt", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ quizId: quiz.quizId, conceptId: quiz.conceptId, selectedLabel: label, dontKnow: dk }),
      });
      const d = await r.json();
      if (!d.recorded) {
        // restored turn: no live pendingQuiz on the server → show as answered archive
        setStale(true);
        setDontKnow(false);
        setFbExplanation(quiz.explanation);
        setFbCorrectLabel(null);
        setState("feedback");
        return;
      }
      setCorrect(dk ? false : Boolean(d.correct));
      setFbExplanation(typeof d.explanation === "string" && d.explanation ? d.explanation : quiz.explanation);
      setFbCorrectLabel(typeof d.correctLabel === "string" ? d.correctLabel : null);
      setState("feedback");
      onAnswered(dk ? false : Boolean(d.correct), label, dk);
    } catch {
      setCorrect(false);
      setFbExplanation(quiz.explanation);
      setFbCorrectLabel(null);
      setState("feedback");
      onAnswered(false, label, dk);
    }
  };

  if (state === "select") {
    return (
      <Card className="my-2 min-w-0 p-4">
        <p className="mb-3 text-sm font-medium break-words">{quiz.question}</p>
        <div className="flex flex-col gap-2">
          {opts.map((o) => (
            <Button key={o.value} variant="outline"
              className="h-auto min-h-9 justify-start whitespace-normal break-words py-2 text-left font-normal"
              onClick={() => submit(o.label, false)}>
              {o.label}
            </Button>
          ))}
          <Button variant="ghost"
            className="h-auto justify-start whitespace-normal break-words py-2 text-left font-normal text-muted-foreground"
            onClick={() => submit("tidak tahu", true)}>
            Saya tidak tahu
          </Button>
        </div>
      </Card>
    );
  }

  const verdictLabel = dontKnow ? "tidak tahu" : (opts.find(o => o.value === picked)?.label || "");
  return (
    <Card className="anim-card-in my-2 min-w-0 p-4">
      <p className="mb-3 text-sm font-medium break-words">{quiz.question}</p>
      <div className="flex flex-col gap-2">
        {opts.map((o) => {
          const isKey = fbCorrectLabel ? o.label === fbCorrectLabel : false;
          const isPick = !dontKnow && picked === o.label;
          return (
            <div key={o.value}
              className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm whitespace-normal break-words transition-colors duration-300 ease-out ${isKey ? "border-green-500/60 bg-green-500/10" : isPick ? "border-red-500/60 bg-red-500/10" : "opacity-60"}`}>
              <span aria-hidden>{isKey ? "✓" : isPick ? "✗" : "·"}</span>
              <span className="min-w-0 flex-1">{o.label}</span>
            </div>
          );
        })}
        {dontKnow && <p className="anim-card-in text-sm font-medium text-yellow-500">Tidak apa-apa — ini gap yang akan kita isi.</p>}
      </div>
      <div className="anim-card-in mt-3 space-y-2">
        <Badge variant="secondary" className="text-[10px]">{stale ? "Dari sesi sebelumnya" : "Terjawab"}</Badge>
        {!dontKnow && !stale && (
          <p className={`text-sm font-medium ${correct ? "text-green-500" : "text-red-500"}`}>
            {correct ? "Benar!" : `Kurang tepat — jawabannya: ${fbCorrectLabel || "(lihat di atas)"}`}
          </p>
        )}
        <p className="text-sm text-muted-foreground">{fbExplanation ?? quiz.explanation}</p>
        {!stale && (
          <Button className="w-full" onClick={() => onContinue(verdictLabel, dontKnow ? false : Boolean(correct))}>
            Lanjut
          </Button>
        )}
        {stale && <p className="text-xs text-muted-foreground">Quiz ini dari sesi lama — balas di chat untuk lanjut.</p>}
      </div>
    </Card>
  );
}

// Non-graded question card (ask_user_question parity): preference/direction —
// no correct answer, no grading. Single-select + "Lainnya" custom route, or
// free-text when the tutor sent no options. Answer rides to the tutor as text.
function AskBlock({ ask, onAnswered }: { ask: NonNullable<Msg["ask"]>; onAnswered: (answer: string) => void }) {
  const hasOptions = Array.isArray(ask.options) && ask.options.length > 0;
  const [answered, setAnswered] = useState<string | null>(null);
  const [custom, setCustom] = useState(false);
  const [text, setText] = useState("");
  const submit = (v: string) => {
    if (!v.trim() || answered !== null) return;
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    setAnswered(v.trim());
    onAnswered(v.trim());
  };
  if (answered !== null) {
    return (
      <Card className="my-2 min-w-0 p-4">
        <p className="mb-3 text-sm font-medium break-words">{ask.question}</p>
        <div className="flex items-start gap-2 text-sm">
          <span className="text-green-500" aria-hidden>✓</span>
          <span className="min-w-0 flex-1 break-words">{answered}</span>
        </div>
      </Card>
    );
  }
  return (
    <Card className="my-2 min-w-0 border-primary/40 p-4">
      <Badge variant="secondary" className="mb-2 text-[10px]">Pertanyaan</Badge>
      <p className="mb-3 text-sm font-medium break-words">{ask.question}</p>
      {hasOptions && !custom && (
        <div className="flex flex-col gap-2">
          {ask.options!.map((o) => (
            <div key={o.label}>
              <Button variant="outline"
                className="h-auto min-h-9 w-full justify-start whitespace-normal break-words py-2 text-left font-normal"
                onClick={() => submit(o.label)}>
                {o.label}
              </Button>
              {o.description && <p className="pl-4 pt-1 text-xs text-muted-foreground break-words">{o.description}</p>}
            </div>
          ))}
          <Button variant="ghost"
            className="h-auto justify-start whitespace-normal break-words py-2 text-left font-normal text-muted-foreground"
            onClick={() => setCustom(true)}>
            Lainnya
          </Button>
        </div>
      )}
      {(custom || !hasOptions) && (
        <div className="space-y-2">
          {!hasOptions && <p className="text-xs text-muted-foreground">Tulis jawaban lo:</p>}
          <Input value={text} placeholder="Jawaban lo..."
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setText(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === "Enter" && submit(text)} />
          <Button className="w-full" disabled={!text.trim()} onClick={() => submit(text)}>Kirim</Button>
          {custom && (
            <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => { setCustom(false); setText(""); }}>
              Kembali ke pilihan
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

function downloadLesson(msgs: Msg[]) {
  // Callout format mirroring the reference md-log: [!quote] learner, [!abstract]
  // tutor, [!question] quiz (pre-answer, no key), [!success]/[!failure] verdict,
  // [!info] research. Non-Obsidian readers still see readable blockquotes.
  const lines = ["# Lesson Log", "", `> [!info] Sesi belajar`, `> ${new Date().toISOString().slice(0, 10)}`, ""];
  let quizNum = 0;
  for (const m of msgs) {
    if (m.role === "user") {
      lines.push(`> [!quote] Saya`, `> ${m.text.replace(/\n/g, "\n> ")}`, "");
    } else {
      if (m.text) lines.push(`> [!abstract] Tutor`, `> ${m.text.replace(/\n/g, "\n> ")}`, "");
      if (m.quiz) {
        quizNum++;
        lines.push(
          `> [!question] Quiz ${quizNum}: ${m.quiz.question}`,
          ...m.quiz.options.map((o) => `> - ${o.label}`),
          "",
        );
      }
      if (m.research) lines.push(`> [!info] Riset: ${m.research.topic}`, `> ${m.research.facts.replace(/\n/g, "\n> ")}`, "");
    }
  }
  lines.push("---", "", "*Dihasilkan oleh Workshop AI Learning — scaffolding ZPD.*");
  const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `lesson-${new Date().toISOString().slice(0, 10)}.md`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

// memo: during streaming, every text_delta re-renders App — without memo the
// ENTIRE history re-parses markdown per delta. Md/Mermaid only change when
// their own text/code changes (Vercel rule 5.6 extract to memoized components).
const Md = memo(function Md({ text }: { text: string }) {
  return (
    <div className="prose-sm space-y-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:leading-relaxed [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
});

function Thinking() {
  return (
    <Card className="inline-flex w-fit flex-col gap-2 p-3">
      <div className="flex items-center gap-1">
        {[0, 150, 300].map(d => (
          <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: `${d}ms` }} />
        ))}
        <span className="ml-2 text-xs text-muted-foreground">Tutor mikir…</span>
      </div>
    </Card>
  );
}

function GoalForm({ onSet }: { onSet: (topic: string, outcome: string) => void }) {
  const [topic, setTopic] = useState("");
  const [outcome, setOutcome] = useState("");
  return (
    <Card className="mb-3 p-4">
      <Badge className="mb-2">Goal belajar</Badge>
      <p className="mb-3 text-sm text-muted-foreground">Apa yang mau dicapai sesi ini? Tutor memakai ini untuk menyusun rencana.</p>
      <div className="space-y-2">
        <Input placeholder="Topik (contoh: Python dasar)" value={topic}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTopic(e.target.value)} />
        <Input placeholder="Hasil yang diinginkan (contoh: bisa bikin script otomatisasi sederhana)" value={outcome}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOutcome(e.target.value)} />
        <Button className="w-full" disabled={!topic.trim()}
          onClick={() => onSet(topic.trim(), outcome.trim())}>
          Mulai belajar
        </Button>
      </div>
    </Card>
  );
}

export default function App() {
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "assistant", text: "Isi goal belajar dulu, atau langsung ketik topik yang mau dibedah." },
  ]);
  const [inp, setInp] = useState("");
  const [busy, setBusy] = useState(false);
  const [goalDone, setGoalDone] = useState(() => localStorage.getItem(GOAL_KEY) === "1");
  const [streamText, setStreamText] = useState<string | null>(null);
  const activeQuiz = useRef<{ quiz: Quiz; answered: boolean; ok: boolean; label: string } | null>(null);
  const [dueConcepts, setDueConcepts] = useState<{ concept: string; label?: string; mastery: number }[]>([]);
  const [rail, setRail] = useState<{ topic: string; phase: string | null; planOk: boolean; node: string | null } | null>(null);
  const inFlight = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);
  // Auto-scroll only when the user is already near the bottom — never yank
  // them back down while reading earlier messages (scroll-up or answering a
  // quiz triggers msgs/streamText re-renders).
  // The real scroll container is the window/document (outer layout is normal
  // flow), so read scroll position from document.scrollingElement — an inner
  // div without overflow has scrollHeight === clientHeight, which would make
  // nearBottom always true and yank the view on every msgs/streamText change.
  useEffect(() => {
    const sc = document.scrollingElement;
    if (!sc) return;
    const nearBottom = sc.scrollHeight - sc.scrollTop - sc.clientHeight < 160;
    if (nearBottom) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, streamText]);

  useEffect(() => {
    (async () => {
      let tok = getToken();
      if (!tok) {
        tok = await registerAndGetToken();
        if (!tok) return;
      }
      try {
        const r = await fetch("/api/restore", { headers: { Authorization: `Bearer ${tok}` } });
        const d = await r.json();
        if (d.messages && d.messages.length > 0) {
          setMsgs(prev => [...prev, ...d.messages.map((m: { role: string; content: string; quiz?: Quiz; mermaid?: string; svg?: string }) => ({
            role: m.role as "user" | "assistant",
            text: m.content,
            quiz: m.quiz,
            mermaidCode: m.mermaid,
            svgCode: m.svg,
          }))]);
          if (d.messages.length > 0) setGoalDone(true);
        }
      } catch { /* first session */ }
      try {
        const rr = await fetch("/api/rail", { headers: { Authorization: `Bearer ${tok}` } });
        const rd = await rr.json();
        if (rd.rail) setRail(rd.rail);
      } catch { /* no rail yet */ }
      try {
        const mr = await fetch("/api/mastery", { headers: { Authorization: `Bearer ${tok}` } });
        const md = await mr.json();
        if (md.due && md.due.length > 0) setDueConcepts(md.due);
      } catch { /* no mastery yet */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setGoal = useCallback(async (topic: string, outcome: string) => {
    setGoalDone(true);
    localStorage.setItem(GOAL_KEY, "1");
    setMsgs(m => [...m, { role: "user", text: `Goal: ${topic} — ${outcome}` }]);
    setBusy(true);
    try {
      const r = await fetch("/api/goal", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ topic, outcome }),
      });
      const d = await r.json();
      if (d.error) {
        setMsgs(m => [...m, { role: "assistant", text: "Error: " + d.error }]);
        return;
      }
      const quiz: Quiz | undefined = d.quiz ?? undefined;
      setMsgs(m => [...m, {
        role: "assistant",
        text: d.reply ?? "Goal dicatat.",
        quiz,
        ask: d.ask ?? null,
        mermaidCode: d.mermaid ?? undefined,
        svgCode: d.svg ?? undefined,
        isPlan: looksLikePlan(d.reply ?? "") && !quiz,
      }]);
    } catch {
      setMsgs(m => [...m, { role: "assistant", text: "Gagal menyimpan goal." }]);
    } finally {
      setBusy(false);
    }
  }, []);

  const send = useCallback(async (text: string, verdict?: { correct: boolean; selectedLabel: string; dontKnow: boolean; conceptId: string }) => {
    if (!text || inFlight.current) return;
    inFlight.current = true;
    setInp("");
    setBusy(true);
    let fullText = text;
    const aq = activeQuiz.current;
    if (aq && !aq.answered) {
      fullText = `${text}\n[jawaban quiz] ${aq.label}`;
      aq.answered = true;
    }
    activeQuiz.current = null;
    setMsgs(m => [...m, { role: "user", text: fullText }]);
    // Progressive stream: open SSE after posting; display-only until final.
    const streamTimer = window.setTimeout(() => {
      try {
        const es = new EventSource(`/api/turn-stream?token=${encodeURIComponent(getToken())}`);
        es.onmessage = (ev) => {
          const d = JSON.parse(ev.data) as { type: string; delta?: string };
          if (d.type === "text_delta" && d.delta) setStreamText(prev => (prev ?? "") + d.delta!);
          if (d.type === "final" || d.type === "idle") { es.close(); }
        };
        setTimeout(() => es.close(), 120_000);
      } catch { /* streaming is best-effort */ }
    }, 800);
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(verdict ? { message: fullText, verdict } : { message: fullText }),
      });
      const data = await r.json();
      window.clearTimeout(streamTimer);
      setStreamText(null);
      if (data.error) {
        setMsgs(m => [...m, { role: "assistant", text: "Error: " + data.error }]);
        return;
      }
      const reply: string = data.reply ?? "";
      const quiz: Quiz | undefined = data.quiz ?? undefined;
      const mermaidCode: string | undefined = data.mermaid ?? undefined;
      const svgCode: string | undefined = data.svg ?? undefined;
      const research = data.researchTopic
        ? { topic: data.researchTopic as string, facts: "Fakta terverifikasi tersimpan di sesi. Lihat kartu riset." }
        : null;
      setMsgs(m => [...m, {
        role: "assistant",
        text: reply,
        quiz,
        ask: data.ask ?? null,
        mermaidCode,
        svgCode,
        research,
        isPlan: looksLikePlan(reply) && !quiz,
      }]);
      // refresh due-review + rail after each turn (mastery/phase may have moved)
      try {
        const mr = await fetch("/api/mastery", { headers: authHeaders() });
        const md = await mr.json();
        setDueConcepts(md.due ?? []);
        const rr = await fetch("/api/rail", { headers: authHeaders() });
        const rd = await rr.json();
        if (rd.rail) setRail(rd.rail);
      } catch { /* ignore */ }
    } catch {
      setStreamText(null);
      setMsgs(m => [...m, { role: "assistant", text: "Gagal terhubung." }]);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, []);

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4">
      <header className="flex items-start justify-between py-4 sm:py-6">
        <div>
          <h1 className="text-xl font-semibold">Workshop AI Learning</h1>
          <p className="text-sm text-muted-foreground">
            Self-learning dengan scaffolding{" "}
            <a
              href="https://doi.org/10.1007/s10639-024-13112-0"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Zone of Proximal Development
            </a>{" "}
            — tutor mengukur level lo, lalu mengajar tepat di zona itu.
          </p>
        </div>
        <div className="flex gap-2">
          {msgs.length > 1 && (
            <Button variant="outline" size="sm" onClick={() => downloadLesson(msgs)}>Simpan</Button>
          )}
          <Button
            variant="ghost" size="sm"
            className="text-muted-foreground"
            onClick={() => {
              if (!confirm("Mulai sesi baru? Riwayat sesi ini dihapus (mastery ikut reset).")) return;
              fetch("/api/reset", { method: "POST", headers: authHeaders() }).finally(() => {
                localStorage.removeItem(GOAL_KEY);
                activeQuiz.current = null;
                setDueConcepts([]);
                setGoalDone(false);
                setMsgs([{ role: "assistant", text: "Sesi baru dimulai. Isi goal belajar, atau langsung ketik topik yang mau dibedah." }]);
              });
            }}
          >Sesi baru</Button>
          {new URLSearchParams(window.location.search).has("host") && (
            <Button variant="secondary" size="sm" onClick={() => { window.open("/host", "_blank"); }}>Host view</Button>
          )}
        </div>
      </header>
      {!goalDone && (
        <GoalForm onSet={(t, o) => setGoal(t, o)} />
      )}
      {dueConcepts.length > 0 && (
        <Card className="mb-3 border-yellow-500/40 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="text-sm">
              <Badge variant="secondary" className="mb-1">Review</Badge>
              <p className="font-medium">Konsep yang perlu diingatkan:</p>
              <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                {dueConcepts.map(d => (
                  <li key={d.concept}>{d.label ?? d.concept} <span className="text-xs">(masih {Math.round(d.mastery * 100)}% mantap)</span></li>
                ))}
              </ul>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setDueConcepts([])}>×</Button>
          </div>
          <Button size="sm" className="mt-2 w-full"
            onClick={() => {
              const c = dueConcepts.map(d => d.concept).join("; ");
              setDueConcepts([]);
              send(`Review dulu konsep ini sebelum lanjut: ${c}. Buatkan 1 soal review.`);
            }}>
            Review sekarang
          </Button>
        </Card>
      )}
      {rail && (
        <Card className="mb-3 border-l-4 border-l-[#E68A3C] p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 text-sm">
              <span className="font-medium">{rail.topic}</span>
              <span className="text-muted-foreground"> · {rail.phase === "teach" ? "Sedang belajar" : rail.phase === "plan" ? (rail.planOk ? "Rencana disetujui" : "Nunggu setuju rencana") : rail.phase === "probe" ? "Pemetaan level" : "Mulai"}</span>
              {rail.node && <p className="text-xs text-muted-foreground break-words mt-0.5">Fokus sekarang: {rail.node}</p>}
            </div>
          </div>
        </Card>
      )}
      <div className="flex-1 space-y-3 pb-32">
        {msgs.map((m, i) => (
          <div key={i} className={`space-y-1 ${m.role === "user" ? "text-right" : ""}`}>
            <Badge variant={m.role === "user" ? "default" : "secondary"} className="text-[10px]">
              {m.role === "user" ? "Saya" : "Tutor"}
            </Badge>
            {m.isPlan && !m.quiz && (
              <Card className="w-fit max-w-[95%] border-primary/40 p-3 sm:p-4">
                <div className="flex items-center gap-2">
                  <Badge className="mb-2">Rencana belajar</Badge>
                  {m.planApproved && <Badge variant="secondary" className="mb-2 text-[10px]">Disetujui</Badge>}
                </div>
                <div className="text-sm"><Md text={m.text} /></div>
                {m.mermaidCode && <Mermaid code={m.mermaidCode} />}
                {!m.planApproved && (
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" onClick={() => { setMsgs(prev => prev.map((p, j) => (j === i ? { ...p, planApproved: true } : p))); send("[plan] disetujui. Mulai dari node pertama."); }}>
                      Setuju, mulai
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => send("[plan] Ubah rencananya:")}>Ubah</Button>
                  </div>
                )}
                {m.planApproved && <p className="mt-2 text-xs text-muted-foreground">Lanjut belajar sesuai rencana.</p>}
              </Card>
            )}
            {!m.isPlan && (
              <Card className={`inline-block w-fit max-w-[95%] p-3 sm:p-4 text-left break-words text-sm ${m.role === "user" ? "whitespace-pre-wrap bg-primary text-primary-foreground" : ""}`}>
                {m.role === "user" ? m.text : <Md text={m.text} />}
              </Card>
            )}
            {m.mermaidCode && <Mermaid code={m.mermaidCode} />}
            {m.svgCode && <Svg code={m.svgCode} />}
            {m.research && <ResearchCard topic={m.research.topic} facts={m.research.facts} />}
            {busy && i === msgs.length - 1 && m.role === "assistant" && !m.quiz && <Thinking />}
            {!busy && m.quiz && (
              <QuizBlock quiz={m.quiz}
                onRegister={(q) => { activeQuiz.current = { quiz: q, answered: false, ok: false, label: "" }; }}
                onAnswered={(ok, label, dk) => {
                  if (activeQuiz.current) { activeQuiz.current.answered = true; activeQuiz.current.ok = ok; activeQuiz.current.label = label; }
                  void dk;
                }}
                onContinue={(label, ok) => {
                  send("[quiz] Lanjutkan.", {
                    correct: ok,
                    selectedLabel: label,
                    dontKnow: label === "tidak tahu",
                    conceptId: m.quiz!.conceptId,
                  });
                }}
              />
            )}
            {!busy && m.ask && (
              <AskBlock ask={m.ask} onAnswered={(ans) => send(`[ask] ${m.ask!.question} — jawaban: ${ans}`)} />
            )}
          </div>
        ))}
        {streamText && (
          <div className="space-y-1">
            <Badge variant="secondary" className="text-[10px]">Tutor</Badge>
            <Card className="inline-block w-fit max-w-[95%] p-3 text-left break-words text-sm opacity-80">
              <Md text={streamText} />
            </Card>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="pb-safe fixed inset-x-0 bottom-0 border-t bg-background p-3">
        <div className="mx-auto flex max-w-2xl gap-2">
          <Input
            value={inp}
            placeholder="Ketik pesan / topik..."
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInp(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === "Enter" && send(inp.trim())}
          />
          <Button onClick={() => send(inp.trim())} disabled={busy || !inp.trim()}>{busy ? "…" : "Kirim"}</Button>
        </div>
      </div>
    </div>
  );
}
