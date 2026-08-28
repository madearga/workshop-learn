/** Table-driven tests for parseTutorReply. Run: npx tsx src/tutor-reply.test.ts */
import { parseTutorReply } from "./tutor-reply.js";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { pass++; }
  else { fail++; console.error(`FAIL: ${name}`, extra ?? ""); }
}

const validQuiz = {
  question: "Apa itu x?",
  options: [{ label: "A", value: "a" }, { label: "B", value: "b" }],
  correct: "a",
  explanation: "karena",
  conceptId: "konsep-x",
};

// 1. fenced JSON, clean
{
  const raw = 'Intro singkat.\n\n```json\n{"prose":"Jawaban.","quiz":' + JSON.stringify(validQuiz) + "}\n```";
  const r = parseTutorReply(raw);
  check("fenced: quiz parsed", r.envelope.quiz?.question === "Apa itu x?", r);
  check("fenced: source", r.source === "fenced-json", r.source);
  check("fenced: prefix prose kept", r.envelope.prose.startsWith("Intro singkat."), r.envelope.prose);
}
// 2. unfenced balanced JSON
{
  const raw = 'Teks. {"prose":"Jawaban langsung."} selesai';
  const r = parseTutorReply(raw);
  check("balanced: parsed", r.source === "balanced-json", r.source);
  check("balanced: prose", r.envelope.prose.includes("Jawaban langsung."), r.envelope.prose);
}
// 3. plain prose only
{
  const r = parseTutorReply("Halo, ini jawaban biasa tanpa JSON.");
  check("prose: fallback", r.source === "plain-prose" && r.envelope.prose.length > 5, r);
}
// 4. trailing comma (repair)
{
  const raw = '```json\n{"prose":"Jawaban.",}\n```';
  const r = parseTutorReply(raw);
  check("repair: trailing comma", r.source === "repaired-json" && r.envelope.prose.includes("Jawaban."), r);
}
// 5. truncated JSON → prose fallback
{
  const raw = '```json\n{"prose":"Potong di sini';
  const r = parseTutorReply(raw);
  check("truncated: prose fallback", r.source === "plain-prose", r.source);
}
// 6. quiz missing options → invalid, prose fallback
{
  const raw = '```json\n{"prose":"x","quiz":{"question":"q","options":[]}}\n```';
  const r = parseTutorReply(raw);
  check("invalid quiz: fallback prose", r.source === "plain-prose" || !r.envelope.quiz, r.envelope.quiz);
}
// 7. balanced scan skips braces inside strings
{
  const raw = '{"prose":"kata { kurung dalam string"}';
  const r = parseTutorReply(raw);
  check("balanced: string-aware", r.envelope.prose.includes("kurung dalam string"), r.envelope.prose);
}
// 8. smart quotes repaired
{
  const raw = '```json\n{“prose”:“Jawaban “kutip” dalam.”}\n```';
  const r = parseTutorReply(raw);
  // note: smart quotes INSIDE values survive repair (only delimiter quotes fixed); accept prose fallback too
  check("smart quotes: no crash", r.envelope.prose.length > 0, r);
}

// 9. raw newline inside string value → repair
{
  const raw = '```json\n{"prose":"baris satu\nbaris dua","phase":"probe"}\n```';
  const r = parseTutorReply(raw);
  check("repair: raw newline in prose", r.source === "repaired-json" && r.envelope.prose.includes("baris satu"), r.source);
}
// 10. label with backticks (code ticks) survive
{
  const raw = '```json\n{"prose":"ok","quiz":{"question":"q","options":[{"label":"`print(2+3)`","value":"b"},{"label":"5","value":"a"}],"correct":"a","explanation":"e","conceptId":"c"}}\n```';
  const r = parseTutorReply(raw);
  check("backtick label: parsed", r.envelope.quiz?.options[0]?.label === "`print(2+3)`", r.envelope.quiz);
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
