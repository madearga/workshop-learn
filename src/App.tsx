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
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import mermaid from "mermaid";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const TOKEN_KEY = "workshop-participant-token";
const NAME_KEY = "workshop-name";
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
  mermaidCode?: string;
  svgCode?: string;
  research?: { topic: string; facts: string } | null;
  isPlan?: boolean;
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
    localStorage.setItem(NAME_KEY, d.name);
    return d.participant_token;
  }
  return "";
}
function getToken(): string { return localStorage.getItem(TOKEN_KEY) || ""; }
function authHeaders(): Record<string, string> {
  return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` };
}

mermaid.initialize({ startOnLoad: false, theme: "dark", securityLevel: "strict" });

function looksLikePlan(text: string): boolean {
  const hasList = (/\n1[.)]/.test(text) || text.startsWith("1.")) && /\n2[.)]/.test(text);
  const asks = /setuju|lanjut\?|konfirmasi|mulai\?/i.test(text);
  return hasList && asks;
}

function Mermaid({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const id = "m" + Math.random().toString(36).slice(2);
    mermaid.render(id, code).then(({ svg }) => {
      if (ref.current) ref.current.innerHTML = svg;
    }).catch(() => setFailed(true));
  }, [code]);
  if (failed) return <Card className="my-2 p-3 text-sm text-muted-foreground">Diagram tidak dapat dirender.</Card>;
  return (
    <Card className="mermaid-svg my-2 max-w-full overflow-x-auto p-3 sm:p-4">
      <div ref={ref} />
    </Card>
  );
}

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
  const [picked, setPicked] = useState<string | null>(null);
  const [dontKnow, setDontKnow] = useState(false);
  const [correct, setCorrect] = useState<boolean | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [opts] = useState(() => shuffle(quiz.options));
  useEffect(() => { onRegister(quiz); }, []);
  const done = picked !== null || dontKnow;

  const submit = async (label: string, dk: boolean) => {
    if (dk) { setDontKnow(true); } else { setPicked(label); }
    try {
      const r = await fetch("/api/quiz-attempt", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ quizId: quiz.quizId, conceptId: quiz.conceptId, selectedLabel: label, dontKnow: dk }),
      });
      const d = await r.json();
      setCorrect(dk ? false : Boolean(d.correct));
      onAnswered(dk ? false : Boolean(d.correct), label, dk);
    } catch {
      setCorrect(false);
      onAnswered(false, label, dk);
    }
  };

  const verdictLabel = dontKnow ? "tidak tahu" : (opts.find(o => o.value === picked)?.label || "");
  return (
    <Card className="my-2 min-w-0 p-4">
      <p className="mb-3 text-sm font-medium break-words">{quiz.question}</p>
      <div className="flex flex-col gap-2">
        {opts.map((o) => (
          <Button
            key={o.value}
            variant={done && picked === o.value ? "default" : "outline"}
            className="h-auto min-h-9 justify-start whitespace-normal break-words py-2 text-left font-normal"
            disabled={done}
            onClick={() => submit(o.label, false)}
          >
            {o.label}
          </Button>
        ))}
        {!done && (
          <Button variant="ghost" className="h-auto justify-start whitespace-normal break-words py-2 text-left font-normal text-muted-foreground"
            onClick={() => submit("tidak tahu", true)}>
            Saya tidak tahu
          </Button>
        )}
      </div>
      {done && (
        <div className="mt-3 space-y-2">
          <Badge variant="secondary" className="text-[10px]">Terjawab — tekan Lanjut</Badge>
          <p className={`text-sm font-medium ${dontKnow ? "text-yellow-500" : correct ? "text-green-500" : "text-red-500"}`}>
            {dontKnow ? "Tidak apa-apa — ini gap yang akan kita isi." : correct ? "Benar!" : "Kurang tepat."}
          </p>
          <p className="text-sm text-muted-foreground">{quiz.explanation}</p>
          {!advanced && (
            <Button className="w-full" onClick={() => { setAdvanced(true); onContinue(verdictLabel, dontKnow ? false : Boolean(correct)); }}>
              Lanjut
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

function downloadLesson(msgs: Msg[]) {
  const lines = ["# Lesson Log", "", new Date().toISOString().slice(0, 10), ""];
  for (const m of msgs) {
    if (m.role === "user") lines.push(`**Saya:** ${m.text}`, "");
    else {
      if (m.text) lines.push(`**Tutor:** ${m.text}`, "");
      if (m.quiz) {
        lines.push(`> **Quiz:** ${m.quiz.question}`, "");
        for (const o of m.quiz.options) lines.push(`> - [ ] ${o.label}`);
        lines.push("", `> Penjelasan: ${m.quiz.explanation}`, "");
      }
      if (m.research) lines.push(`> **Riset (${m.research.topic}):**`, "", m.research.facts, "");
    }
  }
  const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `lesson-${new Date().toISOString().slice(0, 10)}.md`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

function Md({ text }: { text: string }) {
  return (
    <div className="prose-sm space-y-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:leading-relaxed [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}

function Thinking({ phase }: { phase: "chat" | "research" }) {
  return (
    <Card className="inline-flex w-fit flex-col gap-2 p-3">
      <div className="flex items-center gap-1">
        {[0, 150, 300].map(d => (
          <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: `${d}ms` }} />
        ))}
        <span className="ml-2 text-xs text-muted-foreground">
          {phase === "research" ? "Memverifikasi fakta…" : "Tutor mikir…"}
        </span>
      </div>
      {phase === "research" && (
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-56" />
          <Skeleton className="h-3 w-44" />
          <Skeleton className="h-3 w-52" />
        </div>
      )}
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
  const [phase, setPhase] = useState<"chat" | "research">("chat");
  const [goalDone, setGoalDone] = useState(() => localStorage.getItem(GOAL_KEY) === "1");
  const [streamText, setStreamText] = useState<string | null>(null);
  const activeQuiz = useRef<{ quiz: Quiz; answered: boolean; ok: boolean; label: string } | null>(null);
  const [dueConcepts, setDueConcepts] = useState<{ concept: string; mastery: number }[]>([]);
  const inFlight = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, streamText]);

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
          setMsgs(prev => [...prev, ...d.messages.map((m: { role: string; content: string }) => ({
            role: m.role as "user" | "assistant",
            text: m.content,
          }))]);
          if (d.messages.length > 0) setGoalDone(true);
        }
      } catch { /* first session */ }
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
      await fetch("/api/goal", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ topic, outcome }),
      });
      // The goal turn produces the first probe reply — fetch it via restore-free turn stream is
      // overkill; the tutor's next message arrives on the next /api/chat. Insert a placeholder.
      setMsgs(m => [...m, { role: "assistant", text: "Goal dicatat. Cek pertanyaan probe dari tutor di bawah, jawab lewat chat." }]);
    } finally {
      setBusy(false);
    }
  }, []);

  const send = useCallback(async (text: string) => {
    if (!text || inFlight.current) return;
    inFlight.current = true;
    setInp("");
    setPhase("chat");
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
        body: JSON.stringify({ message: fullText }),
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
        mermaidCode,
        svgCode,
        research,
        isPlan: looksLikePlan(reply) && !quiz,
      }]);
      // refresh due-review after each turn (mastery may have moved)
      try {
        const mr = await fetch("/api/mastery", { headers: authHeaders() });
        const md = await mr.json();
        setDueConcepts(md.due ?? []);
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
          <p className="text-sm text-muted-foreground">Belajar dengan metode probe → plan → teach.</p>
        </div>
        <div className="flex gap-2">
          {msgs.length > 1 && (
            <Button variant="outline" size="sm" onClick={() => downloadLesson(msgs)}>Simpan</Button>
          )}
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
                  <li key={d.concept}>{d.concept} <span className="text-xs">({Math.round(d.mastery * 100)}%)</span></li>
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
      <div className="flex-1 space-y-3 pb-32">
        {msgs.map((m, i) => (
          <div key={i} className={`space-y-1 ${m.role === "user" ? "text-right" : ""}`}>
            <Badge variant={m.role === "user" ? "default" : "secondary"} className="text-[10px]">
              {m.role === "user" ? "Saya" : "Tutor"}
            </Badge>
            {m.isPlan && !m.quiz && (
              <Card className="w-fit max-w-[95%] border-primary/40 p-3 sm:p-4">
                <Badge className="mb-2">Rencana belajar</Badge>
                <div className="text-sm"><Md text={m.text} /></div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={() => send("Setuju, mulai dari poin 1.")}>Setuju, mulai</Button>
                  <Button size="sm" variant="outline" onClick={() => send("Ubah rencananya:")}>Ubah</Button>
                </div>
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
            {busy && i === msgs.length - 1 && <Thinking phase={phase} />}
            {!busy && m.quiz && (
              <QuizBlock quiz={m.quiz}
                onRegister={(q) => { activeQuiz.current = { quiz: q, answered: false, ok: false, label: "" }; }}
                onAnswered={(ok, label, dk) => {
                  if (activeQuiz.current) { activeQuiz.current.answered = true; activeQuiz.current.ok = ok; activeQuiz.current.label = label; }
                  void dk;
                }}
                onContinue={(label, ok) => {
                  send(`[quiz] ${ok ? "benar" : "salah"} — pilih: ${label}. Lanjutkan.`);
                }}
              />
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
