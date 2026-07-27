import { describe, expect, it } from "@jest/globals";
import {
  mapQuestionToSummary,
  mapQuestionToDetail,
  type QuestionWithMappings,
} from "../../../src/features/questions/questions-response.mapper.js";

describe("QuestionsResponseMapper", () => {
  const mockRow: QuestionWithMappings = {
    id: "question-id",
    question_text: "What is Node.js?",
    category_id: "cat-1",
    difficulty_id: "diff-1",
    interview_type_id: "int-1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    question_skill_mappings: [{ skill_id: "skill-1" }],
    question_topic_mappings: [{ topic_id: "topic-1" }],
  } as QuestionWithMappings;

  it("should map question to summary and exclude internal fields safely", () => {
    // Inject unsafe data simulating a database leak bypass
    const leakedRow = {
      ...mockRow,
      status: "draft",
      reference_answer: "Super secret answer",
      evaluation_guidance: "Do not tell student",
      created_by: "admin-id",
    } as unknown as QuestionWithMappings;

    const summary = mapQuestionToSummary(leakedRow);

    expect(summary.id).toBe("question-id");
    expect(summary.questionText).toBe("What is Node.js?");
    expect(summary.skillIds).toEqual(["skill-1"]);
    expect(summary.topicIds).toEqual(["topic-1"]);

    // Strict safety assertions
    expect((summary as any).status).toBeUndefined();
    expect((summary as any).reference_answer).toBeUndefined();
    expect((summary as any).referenceAnswer).toBeUndefined();
    expect((summary as any).evaluation_guidance).toBeUndefined();
    expect((summary as any).evaluationGuidance).toBeUndefined();
    expect((summary as any).created_by).toBeUndefined();
    expect((summary as any).createdBy).toBeUndefined();
  });

  it("should throw error if required database fields are missing (defense in depth)", () => {
    const brokenRow = {
      ...mockRow,
      question_text: null, // Should never happen from base table, but view types are nullable
    } as unknown as QuestionWithMappings;

    expect(() => mapQuestionToSummary(brokenRow)).toThrow("Invalid question row from database");
  });
});
