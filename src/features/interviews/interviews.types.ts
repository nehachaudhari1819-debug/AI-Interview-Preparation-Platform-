export interface TaxonomyReference {
  id: string;
  name: string;
}

export interface InterviewDetail {
  id: string;
  title: string;
  targetRole: string;
  interviewType: TaxonomyReference;
  difficulty: TaxonomyReference;
  skills: TaxonomyReference[];
  topics: TaxonomyReference[];
  questionCount: number;
  timeLimitMinutes: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface InterviewSession {
  id: string;
  interviewId: string;
  status: "ready" | "in_progress" | "paused" | "completed";
  configSnapshot: Record<string, unknown>;
  startedAt: string | null;
  pausedAt: string | null;
  totalPausedSeconds: number;
  completedAt: string | null;
  lastTransitionAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionQuestion {
  id: string;
  sessionId: string;
  displayOrder: number;
  questionTextSnapshot: string | null; // Nullable if undisclosed
  taxonomySnapshot: Record<string, unknown> | null; // Nullable if undisclosed
  createdAt: string;
}

export interface CodeResponse {
  source: string;
  language: string;
  explanation: string;
}

export interface AnswerDetail {
  id: string;
  sessionQuestionId: string;
  responseType: "text" | "code" | null;
  textResponse: string | null;
  codeResponse: CodeResponse | null;
  status: "draft" | "finalized" | "skipped";
  version: number;
  finalizedAt: string | null;
  skippedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
