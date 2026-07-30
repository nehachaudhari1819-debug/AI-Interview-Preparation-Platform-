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
  status: "ready" | "in_progress" | "paused" | "completed" | "expired";
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
