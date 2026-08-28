/** Shared types for the tutor turn pipeline. */
export interface TurnEnvelope {
  prose: string;
  phase?: "probe" | "plan" | "teach";
  quiz?: {
    question: string;
    options: { label: string; value: string }[];
    correct?: string;
    explanation?: string;
    conceptId?: string;
  };
  mermaid?: string;
  svg?: string;
  researchTopic?: string;
}

/** Server-side quiz card: carries the hidden correct answer. */
export interface QuizCard {
  question: string;
  options: { label: string; value: string }[];
  correctLabel: string;
  explanation: string;
  quizId: string;
  conceptId: string;
}
