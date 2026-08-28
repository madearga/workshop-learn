# Learner-facing UX spec — reference parity

**Reference:** `amosblomqvist/learn` at `7cfd8942f82ab9476e63572387e1fe9bcea5082c` (read-only source review).  
**Scope:** learner-facing behavior of the Pi terminal UI, translated into observable requirements for `workshop-learn`’s React chat interface. Preserve the wording and state behavior below; visual treatment may use the app’s shadcn design system.

## 1. Session rhythm: probe → plan → teach

The learner experiences a deliberately gated three-phase lesson, not an unstructured chat.

### Phase 1 — Probe

1. The tutor first learns both (a) the learner’s current level and (b) their goal.
2. **Current level:** the learner receives a sequence of short, graded `quiz` cards. The tutor increases difficulty sharply after correct answers, narrows after misses, and probes around a miss before teaching. A strand is not considered mapped until there is both a known floor (a correct answer) and ceiling (a wrong answer or `I don't know`).
3. **Goal:** the learner receives a separate, non-graded `ask_user_question` prompt. The tutor should make a vague target concrete; this is a preference/direction conversation, not a test.
4. The learner therefore sees many small adaptive questions rather than one large diagnostic.

**Source:** `skills/teach/SKILL.md` §“The process: probe → plan → teach”, “Phase 1 — Probe” (lines 67–99); `extensions/quiz.ts` (lines 876–900); `extensions/ask-user-question.ts` (lines 568–584).

### Phase 2 — Plan (approval gate)

1. Before explaining, the tutor posts the plan in chat.
2. It contains exactly two learner-visible parts:
   - **Approach in prose:** what will be covered, in which order, and why that order fits the learner’s measured edge and stated goal.
   - **Dependency map:** a small Mermaid DAG: unconditional truths at roots, derived concepts attached to their dependencies, and the learner’s goal as the sink.
3. The tutor **stops and waits for the learner’s go-ahead**. Teaching must not begin until approval.

**Source:** `skills/teach/SKILL.md` §“Phase 2 — Plan” (lines 101–120).

### Phase 3 — Teach

For each concept/node, in order, the learner sees and does:

1. **Motivate** — why this concept is needed now / what gap it closes.
2. **Establish** — either a plain, caveat-free foundational truth or a motivated derivation from already established concepts. Socratic stretches ask the learner to attempt the next step; expository stretches narrate it.
3. **Connect** — explicit explanation of how the new concept depends on prior concepts.
4. **Quiz-check** — an immediate short graded quiz. If the learner misses it, the tutor repairs the node before building on it.

Math is formatted as LaTeX (`$f(x)$`, display `$$ … $$`) rather than ASCII approximations.

**Source:** `skills/teach/SKILL.md` §“Phase 3 — Teach (the loop)” (lines 122–146), §“Socratic vs expository — adaptive” (lines 59–65).

---

## 2. Non-graded question card (`ask_user_question`)

Use this only when there is **no correct answer**: preference, direction, missing requirement, or confirmation. One card asks **exactly one question**.

### Shared presentation

The modal/card is visually bounded by accent rules. It displays, in order:

```text
────────────────────────
<Question text>

<optional details/context>

<answer controls>

<keyboard help>
────────────────────────
```

Question text uses normal/high-emphasis text; optional details are muted. The selected row is accent-coloured and prefixed `> `. Option descriptions appear underneath their option, indented and muted.

**Source:** `extensions/ask-user-question.ts` `askSingleChoice.render` (lines 277–324) and `askMultiChoice.render` (lines 454–529).

### Free-text question

**Learner sees** the question, then (when supplied) the details in the editor title/body. There are no suggested options.

**Learner does** type a response and submit it. An empty submitted string is accepted and recorded as an empty response. Cancelling yields the visible transcript status `User cancelled the question` / `Cancelled`.

**Source:** `extensions/ask-user-question.ts` execution (lines 587–625), result rendering (lines 641–667).

### Single-select question

**Learner sees** every supplied option in author order plus an automatic final custom route:

```text
> 1. <option label>
     <optional option description>
  2. <option label>
  Other
```

If an authored option is already named `Other` (case-insensitive), the automatic row is instead `Other (custom)`.

**Learner does** use Up/Down to move the highlight and Enter to choose. Footer wording is exactly:

```text
↑↓ navigate • Enter select • Esc cancel
```

Choosing `Other` opens a text entry beneath the list:

```text
Write your custom answer:
<editor>

Enter to submit • Esc to go back
```

Blank custom answers do not submit. `Esc` in the custom editor returns to the choice list; `Esc` from the list cancels.

After answer, the persisted/transcript result shows a green `✓ ` followed by the answer: `✓ 1. <label>` for a supplied option; `✓ Other: <text>` for custom text; or `✓ <text>` for free text.

**Source:** `extensions/ask-user-question.ts` (lines 103–105, 203–333, 628–667).

### Multi-select question

**Learner sees** option rows with checkboxes, an automatic custom route, and a final submit row:

```text
> [ ] 1. <option label>
  [ ] 2. <option label>
  [ ] Other
  ○ Submit
```

A selected option is `[x]`; the submit row becomes `✓ Submit (N selected)`. The custom row becomes `[x] Other — <text>` after its text is saved.

**Learner does** use Up/Down to navigate; Space toggles; Enter toggles a regular option, opens `Other`, or submits when focused on `Submit`. The card will not submit with zero selections and visibly says:

```text
Select at least one answer before submitting.
↑↓ navigate • Space toggle • Enter edit/submit • Esc cancel
```

Custom entry uses `Write your custom answer:` and `Enter to save • Esc to go back`. A saved custom entry may be revisited with Enter and removed with Space.

**Source:** `extensions/ask-user-question.ts` (lines 336–538).

---

## 3. Graded quiz card (`quiz`)

A quiz always has at least two real options, a required correct answer, and a required explanation. It is options-only: no free-text answer and no `Other` route. Real options are shuffled by default before display; numbering and correctness must follow the **post-shuffle order** the learner actually saw. Preserve order only when it is meaningful.

The quiz is a two-state interaction: **select** → **instant feedback**. Do not show the answer or explanation before selection.

**Source:** `extensions/quiz.ts` (lines 14–23, 92–121, 915–930, 971–977).

### Quiz select state: single-select

**Learner sees:** accent border, question, optional muted context, numbered answer choices, then a visibly separated/dim `I don't know` row, followed by an always-present note input.

```text
────────────────────────
<Question>

<optional details>

> 1. <option>
  2. <option>

  I don't know

Note (optional):
<editor>

↑↓ navigate • Enter answer • Tab note • Esc cancel
────────────────────────
```

Optional option descriptions appear indented below the relevant option. The `I don't know` row is intentionally separated from gradable choices.

**Learner does:** Up/Down to focus a real option or `I don't know`; Enter immediately submits the selection and moves directly to feedback. Tab switches between choices and `Note (optional):`. In the note field, the learner can type a multiline note (`Ctrl+J` newline); `Enter` or `Esc` returns to options without clearing the note. `Esc` from options cancels the quiz.

**Source:** `extensions/quiz.ts` single-select (lines 421–598), shared `I don't know` and note presentation (lines 390–418).

### Quiz select state: multi-select

**Learner sees** checkboxes, then separated `I don't know`, `Submit`, and the optional note field:

```text
> [ ] 1. <option>
  [ ] 2. <option>

  [ ] I don't know
  ○ Submit

Note (optional):
<editor>
```

Selections display as `[x]`; `Submit` becomes `✓ Submit (N selected)`. Before any selection, show:

```text
Select at least one answer before submitting.
```

Footer wording is:

```text
↑↓ navigate • Space toggle • Enter submit • Tab note • Esc cancel
```

**Learner does:** Up/Down to navigate; Space or Enter toggles an answer; Enter on `Submit` produces feedback only if at least one answer is selected. `I don't know` is exclusive: selecting it clears real selections, and selecting any real option clears it. The note behavior is identical to single-select.

Multi-select grading is an exact-set match: every correct choice and no incorrect choice are required.

**Source:** `extensions/quiz.ts` multi-select (lines 601–843), exact-set grading (lines 217–222; 884–899).

### Instant feedback state (all quiz modes)

Immediately after submission, replace the selection interface with feedback. Enumerate the full shuffled option list, marking:

- `✓` green for a selected correct option;
- `✗` red for a selected incorrect option;
- `✓` green for a correct option the learner failed to select (correct-answer reveal);
- unselected incorrect options dim/no marker.

Then show one of the following exact verdict blocks:

```text
✓ Correct!
```

or

```text
✗ Incorrect.
Correct answer: <number>. <label>[, ...]
```

If a note was supplied, show:

```text
Your note: <note>
```

Then show the required explanation text, followed by:

```text
Enter/Esc to continue
```

Either Enter or Esc dismisses feedback and returns the response to the tutor. The conversation transcript re-renders equivalent feedback as `Correct!` / `Incorrect`, the note as `Note: <note>`, and the explanation.

**Source:** `extensions/quiz.ts` `renderFeedback` (lines 311–378), `renderResult` (lines 992–1059).

### `I don't know` is a distinct, honest-gap outcome

Choosing `I don't know` must not be treated as a wrong guess and must never render a red `✗`.

**Learner sees:** only the correct option(s) with green `✓`, then:

```text
· You said: I don't know
Correct answer: <number>. <label>[, ...]
<explanation>

Enter/Esc to continue
```

The tutor receives this as a genuine knowledge gap, not an incorrect attempt. A note can still accompany it.

**Source:** `extensions/quiz.ts` (lines 44–59, 270–290, 328–378, 1023–1057).

---

## 4. Markdown lesson log (`md-log`)

This is a learner-owned, renderable lesson mirror for comfortable reading outside the terminal/chat surface. It is append-only while active and intentionally omits operational/tool noise (bash, read, write, edit, etc.). It preserves learner prompts, tutor prose, and question/answer blocks; Markdown, code blocks, and `$...$` math render natively in a Markdown viewer such as Obsidian.

### Link and status

1. The learner runs `/md-log <filepath>` while the agent is idle.
2. The file **must already exist** and must be a file; the command does not create it.
3. On success, it backfills the active session branch, displays status `🗒 <basename>`, and notifies:

```text
Linked: <resolved path> (<N> entries backfilled)
```

4. `/md-unlog` stops mirroring, removes status, and notifies `Unlinked: <basename>`. If no file is linked, it says `No file linked`.

Errors: `Usage: /md-log <filepath>`, `Wait for the agent to finish before linking.`, `File does not exist: <path>`, and `Not a file: <path>`.

**Source:** `extensions/md-log.ts` (lines 20–25, 281–336).

### Rendered Markdown format

The mirror writes blocks separated by blank lines:

```md
> [!quote] YOU

<learner prompt>

> [!abstract] PI

<tutor lesson prose>
```

A non-graded question is written before it is answered, so it appears live:

```md
> [!question] Question
> <question>
>
> <optional details>
>
> 1. <option>
> 2. <option>
```

A quiz uses the same pre-answer callout titled `Quiz`; its options must use the true shuffled display order, not author order. Correct answers and explanations are deliberately absent before the learner answers, preventing answer leakage.

Afterward, quiz answer callouts are one of:

```md
> [!success] Quiz — correct ✓
> Your answer: <number>. <label>
> Correct answer: <number>[, ...]
>
> <explanation>
```

```md
> [!failure] Quiz — incorrect ✗
> Your answer: <number>. <label>
> Correct answer: <number>[, ...]
>
> <explanation>
```

```md
> [!question] Quiz — I don't know
> Your answer: I don't know
> Correct answer: <number>[, ...]
>
> <explanation>
```

A non-graded answer is:

```md
> [!example] Answer
> <answer>
```

Cancellation is a warning (`Quiz — cancelled` or `Question — cancelled`) with `(user skipped)`; unavailable states are warning callouts. A non-empty learner note is included as `Note: <note>`.

**Source:** `extensions/md-log.ts` formatting (lines 82–196), live events (lines 200–277), backfill behavior (lines 340–442).

---

## 5. Diagrams and inline visuals

Diagrams are not decorative. The learner sees one only when a picture conveys structure, direction, relationship, or geometry more clearly than prose/equations: dependency graphs, flows, sequences, state machines, trees, comparisons/containment, or spatial/geometric material such as coordinates, number lines, vectors, plots, or physical layouts.

Do **not** add a visual if prose or one equation already carries the idea.

### Plan diagram

Phase 2 always includes the small Mermaid dependency DAG in chat. In `workshop-learn`, render that Mermaid message inline; it is the lesson’s teaching order.

### Lesson diagram

When justified during teaching:

1. Use Mermaid for nodes/edges/relationships (dependency graph, flow, sequence, state machine, tree).
2. Use SVG for positions/shapes/geometry (coordinates, vectors, plots, number lines).
3. Keep one idea and roughly 5–7 or fewer carrying elements.
4. Introduce it in one sentence, then let it carry the idea rather than narrating every label.

The reference publishes a render-verified PNG to the lesson vault and embeds it directly in tutor prose as:

```md
![[viz-<slug>-<timestamp>.png|500]]
```

The Markdown log mirrors that exact embed, so Obsidian resolves and renders it inline. For this app’s existing Mermaid/SVG envelope, render the supplied diagram inline in the chat and preserve it in the lesson export; maintain the same “only when it clarifies” threshold.

**Source:** `skills/teach/SKILL.md` lines 113–120; `skills/visualize/SKILL.md` lines 8–19, 21–28, 30–39, 52–70.

## Implementation invariants for workshop-learn

- Keep `ask_user_question` (open choice) and `quiz` (known correct answer) semantically distinct.
- Only one interrupting question/quiz interaction should be active at a time.
- For quiz cards, save the displayed shuffled order with the attempt; grade and later render against that order.
- Do not expose correct answer or explanation in a quiz’s pre-answer transcript/event payload.
- Persist `I don't know` separately from incorrect, and retain an optional learner note for all quiz outcomes.
- Keep phase transitions visible in the typed envelope so the plan-approval gate cannot be skipped.

**Source:** `extensions/ask-user-question.ts` and `extensions/quiz.ts` shared UI lock (respectively lines 541–565 and 849–873); `extensions/quiz.ts` lines 921–930; `skills/teach/SKILL.md` lines 113–120.
