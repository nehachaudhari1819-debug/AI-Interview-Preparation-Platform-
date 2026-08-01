import { describe, expect, it } from "@jest/globals";
import {
  mapSessionToResponse,
  mapSessionQuestionToResponse,
} from "../../../../src/features/interviews/interviews-response.mapper.js";

describe("Interviews Response Mapper", () => {
  it("should redact internal config properties", () => {
    const row = {
      id: "session-1",
      interview_id: "int-1",
      status: "in_progress",
      config_snapshot: {
        title: "Test",
        targetRole: "Dev",
        questionCount: 3,
        timeLimitMinutes: 30,
        interviewType: { id: "type-1", name: "Type" },
        difficulty: { id: "diff-1", name: "Diff" },
        skills: [{ id: "skill-1", name: "Skill" }],
        topics: [{ id: "topic-1", name: "Topic" }],
        internalData: "SECRET",
      },
      started_at: "2026-01-01T00:00:00Z",
      paused_at: null,
      total_paused_seconds: 0,
      completed_at: null,
      last_transition_at: "2026-01-01T00:00:00Z",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    } as any;

    const res = mapSessionToResponse(row);
    expect((res.configSnapshot as any).internalData).toBeUndefined();
    expect((res.configSnapshot as any).title).toBe("Test");
  });

  it("should redact internal taxonomy properties", () => {
    const row = {
      id: "q-1",
      session_id: "session-1",
      display_order: 1,
      question_text_snapshot: "Q1",
      taxonomy_snapshot: {
        question_categories: { id: "cat-1" },
        question_difficulties: { id: "diff-1" },
        question_interview_types: { id: "type-1" },
        question_internal_data: { evaluation_guidance: "SECRET" },
      },
      created_at: "2026-01-01T00:00:00Z",
    } as any;

    const res = mapSessionQuestionToResponse(row);
    expect((res.taxonomySnapshot as any).question_internal_data).toBeUndefined();
    expect((res.taxonomySnapshot as any).question_categories).toBeDefined();
  });
});
