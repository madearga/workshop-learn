# Learner-experience prior art and 2025–26 signals

Run: 2026-08-28 · Scope: next-generation learner UX for **workshop-learn** (Indonesian, mobile-first, facilitator-led corporate workshops). Sources are primarily first-party product material and one peer-reviewed field experiment.

## Executive take

The parity baseline—Socratic probe → plan → teach, instant quiz feedback, mastery and reset—is now table stakes. The 2025 market is converging on **guided practice rather than answer chat**, **multimodal, source-grounded study**, and **short feedback loops with visible agency**. The differentiated opportunity is to connect those patterns to the workshop moment: make individual practice private and low-friction, while turning aggregate evidence into a facilitator intervention at the right time.

Do **not** add an elaborate gamification layer first. Durable identity, quiz evidence, mastery and due review remain prerequisites (see `IDEATION.md`).

## Prior art: what learners now expect

| Product / pattern | Learner-facing interaction | Transferable lesson for workshop-learn |
|---|---|---|
| **ChatGPT Study Mode** (2025) | asks where the learner is stuck, uses guiding questions, staged explanations, open-ended checks, self-reflection, and optionally personal memory / uploaded materials | Make help a deliberate *mode* with an explicit “hint / show one step / check my reasoning” ladder, not a generic chat answer. Offer an easy “explain why you are asking this” affordance. |
| **Gemini Guided Learning / LearnLM** (2025) | creates a plan, progresses step-by-step, checks understanding, and combines text with images/video; Google’s NotebookLM adds source-derived flashcards, quizzes and audio overviews | Let a facilitator attach the workshop deck, case study or policy. Generate cited micro-practice from that bounded corpus; offer a mobile-friendly 60–90 second recap/audio alternative, but preserve an active retrieval checkpoint. |
| **Duolingo Max Video Call + roleplay** (2024–25) | low-stakes character conversation, transcript review, adaptive level; 2025 additions include captions, push-to-talk, actionable post-call feedback and an XP target tied to longer responses | Add an optional **role rehearsal**: simulate a client/manager objection and score the learner’s own spoken/text response against workshop criteria. On iPhone, push-to-talk + transcript/captions is materially more useful than a decorative avatar. |
| **Duolingo course UX** | progressive challenge, path/score, streaks, lightweight social accountability, cooperative Friends Quests | Progress needs a comprehensible competency signal, not only points. If adding social motivation, use opt-in, workshop-cohort cooperative goals—never public ranks by mastery. |
| **Anki / FSRS and SuperMemo** | active recall before answer; individual review scheduling; explicit response grades and *next-review time* | A due-review queue should ask the learner to retrieve, then reveal. Show “next review” and allow an honest “not now”; cap daily burden so a workshop does not create an intimidating debt queue. |
| **Khanmigo / reimagined Khan Academy** (2025–26) | AI appears inside assigned practice; encourage an attempt and gentle hints before submit; instructor has assignment/progress visibility and unit mastery goals | Do not make learners leave the practice surface to “ask AI.” Tie tutor help to the active task and reveal facilitator-level aggregate status without exposing individual chat content by default. |

## Strong 2025–26 market signals

1. **Answers → guided learning is now an explicit product category.** OpenAI launched Study Mode (July 2025); Google launched Guided Learning (August 2025). Both sell probing, scaffolding, checks for understanding and learner-level calibration—not unrestricted response generation.
2. **Multimodal and source-grounded study is becoming normal.** Google positions course-material uploads, cited NotebookLM notebooks, flashcards/quizzes, and audio overviews together. The useful version for workshops is *artifact-grounded practice*, not generic “AI summary.”
3. **Voice practice is maturing from novelty to controlled turn-taking.** Duolingo’s 2025 Video Call changes—captions, push-to-talk, post-call feedback—signal the UX details that make voice viable on mobile: learner control, accessibility, and a reviewable artifact.
4. **AI tutoring is moving into the practice flow, with teacher visibility.** Khan Academy reports the learner need as classroom-aligned practice, help when stuck, and simple monitorability rather than a separate bot. This matches the facilitator’s role much better than a standalone “chat with AI” tab.
5. **Guardrails are a learning feature, not merely safety.** The 2025 PNAS field experiment found unrestricted GPT-4 improved assisted practice but reduced later no-AI exam performance by 17%; teacher-designed hints substantially mitigated the harm. Product implication: require an attempt or a prediction before revealing a worked step, and schedule an unaided transfer check.
6. **Indonesia is suitable for mobile-first, not bandwidth-assumptive.** APJII reporting cited by Kompas says 2025 internet penetration was 80.66%, but access varies substantially by region; World Bank material reports only 22% of Indonesian schools at 100+ Mbps. Keep critical learning flows text-first, resumable, and cheap; make voice/media optional and downloadable only on demand.

## Recommended bets beyond baseline (ranked)

### 1. Try → hint → explain ladder with an unaided transfer check — **S**

**UX:** Before any substantive help, ask for a prediction, a first step, or a confidence tap. The learner can choose: “beri petunjuk kecil,” “cek langkah saya,” or “contoh serupa”—not “give answer.” After teaching, ask one fresh, unaided application question.

**Why now:** directly implements the PNAS safeguard and matches Study Mode / Guided Learning. It also makes existing ZPD and fading behavior visible instead of prompt-only.

**Measure:** hint-depth distribution; attempts before help; immediate quiz vs 24h unaided transfer accuracy.

### 2. Workshop artifact companion: cited micro-practice + 90-second recap — **M**

**UX:** A facilitator attaches slides/case/source. Each learner sees a “Dari materi workshop ini” card: one retrieval question, one scenario, and optional audio recap. Every generated claim links to the source slide/page.

**Why now:** mirrors the course-material grounding signal while producing trustable, locally relevant practice. It is more defensible than open-web AI chat for corporate workshops.

**Constraint:** do not promise that generated source citations are correct without retrieval/verification; show source excerpts and allow “laporkan masalah.”

### 3. Role rehearsal with transcript, rubric and replayable feedback — **M**

**UX:** Pick a workshop-relevant persona (customer, manager, teammate); use text first and optional push-to-talk voice. On completion: transcript, two observed strengths, one next attempt, then “coba ulang 30 detik.”

**Why now:** Duolingo proves a conversational rehearsal UX, while corporate workshops have a clearer real-world transfer target than language small talk.

**Mobile constraint:** captions/transcript are mandatory; audio must be opt-in and degrade gracefully to text.

### 4. Learner-owned “confidence × evidence” map — **S**

**UX:** After a concept, learner selects `yakin / lumayan / belum yakin`; the UI pairs that self-report with quiz evidence and says only what to do next: “kuat—coba kasus baru,” “rapuh—ulangi besok,” or “perlu contoh lain.”

**Why now:** this builds metacognition, avoids a falsely precise mastery number, and yields a useful signal when the learner is confidently wrong.

**Avoid:** public leaderboards and red/green dashboards aimed at participants; they turn diagnostic evidence into social threat.

### 5. Cohort challenge, not cohort ranking — **S after durable identity**

**UX:** An opt-in shared target such as “80% peserta mencoba ulang kasus X,” with celebration of participation and no person-level ordering. Facilitator sees private heatmap; participants see only cohort progress.

**Why now:** imports Duolingo’s accountability mechanism without making corporate learners compete on competence.

**Measure:** return rate and voluntary re-attempt rate; watch for opt-out / negative sentiment.

### 6. Two-minute return loop and forgiving review queue — **S after persisted review state**

**UX:** A WhatsApp/email/deep-link reminder opens exactly one due question; shows the expected time (`~2 menit`) and lets users snooze or stop reminders. “I don’t know” produces an immediate minimal refresher then a shorter interval.

**Why now:** Anki/SuperMemo validate individualized retrieval timing, but workshop learners need a low-burden version. This extends value beyond the event without reproducing a full flashcard product.

## Cross-domain analogies worth borrowing

- **Fitness:** a trainer asks for one rep before correcting form; a post-workout plan is short, scheduled and measurable. Translate to “attempt first,” one observable correction, then next practice date.
- **Flight/clinical simulation:** practice is scenario-based, debrief is evidence-led, and retry follows immediately. Use role rehearsal → transcript/rubric → fast retry; do not turn feedback into a long lecture.
- **Language calls:** real-time conversation needs turn-taking control and a review artifact. Push-to-talk, captions and a transcript solve more than a photorealistic tutor face.
- **Git/code review:** comments are anchored to a concrete diff, not generic advice. Anchor tutor feedback to the learner’s submitted step, chosen option, or spoken sentence.
- **Wearables:** one clear next action beats an analytics dashboard. Learner analytics should answer “what should I do in the next two minutes?”; richer aggregation belongs to the facilitator.

## Deliberate non-bets

- **Tutor avatar / always-on voice:** costly and bandwidth-sensitive; add only if a text-first role rehearsal shows demand.
- **Leaderboards, XP economy, streak freeze:** familiar but weakly tied to workplace learning and can reward volume over retrieval. A simple return cue is enough initially.
- **Full adaptive-learning/BKT engine:** existing quiz mastery, confidence input and a simple due queue provide a testable first rung. Upgrade only after enough longitudinal item data exists.
- **Automatic affect/emotion inference:** high privacy risk and error-prone; use an explicit “butuh jeda / bingung / lanjut” self-report instead.

## Sources

### Primary product sources

- OpenAI, “[Introducing study mode](https://openai.com/index/chatgpt-study-mode/)” (29 Jul 2025); [Study Mode FAQ](https://help.openai.com/en/articles/11780217-chatgpt-study-mode-faq%EF%BC%89).
- Google, “[Guided Learning in Gemini: From answers to understanding](https://blog.google/products-and-platforms/products/education/guided-learning/)” (6 Aug 2025); “[How Gemini’s Guided Learning can help you study more effectively](https://blog.google/products-and-platforms/products/gemini/guided-learning-google-gemini)” (23 Sep 2025).
- Duolingo, “[2025 Duolingo Highlights](https://blog.duolingo.com/product-highlights/)”; “[Video Call](https://blog.duolingo.com/video-call/)”; “[How to use Duolingo](https://blog.duolingo.com/duolingo-101-how-to-learn-a-language-on-duolingo/)”; “[Social features](https://blog.duolingo.com/friends-social-features/)”. Product metrics are vendor-reported, not causal evidence.
- Khan Academy, “[Reimagined Khan Academy](https://blog.khanacademy.org/built-in-the-open-how-pilot-districts-shaped-the-reimagined-khan-academy/)”; “[Building a better AI tutor](https://blog.khanacademy.org/how-khan-academy-is-building-a-better-ai-tutor-our-most-recent-learnings/)”.
- Anki Manual, “[Background](https://docs.ankiweb.net/background.html)” and “[Studying](https://docs.ankiweb.net/studying.html)”; SuperMemo, “[How often should material be repeated?](https://supermemo.com/en/faq/how-often-should-the-material-be-repeated)”.

### Research and market context

- Bastani et al., “[Generative AI without guardrails can harm learning: Evidence from high school mathematics](https://www.pnas.org/doi/10.1073/pnas.2422633122),” *PNAS* 122(26), 2025. This is a specific high-school-math context; use the direction of evidence, not its exact effect size, as the design rationale.
- World Bank, *Indonesia Economic Prospects: Digital Foundations for Growth* (Dec 2025), [presentation PDF](https://thedocs.worldbank.org/en/doc/2058d67adda4a910ceab72209ddec8f3-0070012025/related/IEP-December-2025-Digital-Presentation.pdf).
- Kompas report of APJII 2025 survey, “[Expanding Digital Connectivity Towards the AI Era](https://kompas.id/artikel/en-memperluas-konektivitas-digital-menuju-era-ai)” (reports 80.66% penetration; secondary reporting).
