import { describe, it, expect } from "@jest/globals";
import {
  parseAdminGetQuestionsQuery,
  parseCreateQuestionBody,
  parseUpdateQuestionBody,
  parseCreateTaxonomyBody,
  parseUpdateTaxonomyBody,
} from "../../../../src/features/questions/admin-questions.schemas.js";
import { ValidationError } from "../../../../src/errors/validation.error.js";

describe("Admin Question Schemas", () => {
  describe("parseAdminGetQuestionsQuery", () => {
    it("should parse a valid query with default status", () => {
      const query = { page: 1, limit: 10 };
      const parsed = parseAdminGetQuestionsQuery(query);
      expect(parsed.page).toBe(1);
      expect(parsed.limit).toBe(10);
      expect(parsed.status).toBeUndefined();
    });

    it("should parse a single status correctly", () => {
      const query = { status: "published" };
      const parsed = parseAdminGetQuestionsQuery(query);
      expect(parsed.status).toEqual(["published"]);
    });

    it("should parse multiple statuses correctly from array", () => {
      const query = { status: ["draft", "archived"] };
      const parsed = parseAdminGetQuestionsQuery(query);
      expect(parsed.status).toEqual(["draft", "archived"]);
    });

    it("should throw on invalid status", () => {
      const query = { status: "invalid-status" };
      expect(() => parseAdminGetQuestionsQuery(query)).toThrow(ValidationError);
    });
  });

  describe("parseCreateQuestionBody", () => {
    const validBody = {
      questionText: "What is a closure?",
      categoryId: "123e4567-e89b-12d3-a456-426614174000",
      difficultyId: "123e4567-e89b-12d3-a456-426614174000",
      interviewTypeId: "123e4567-e89b-12d3-a456-426614174000",
      skillIds: ["123e4567-e89b-12d3-a456-426614174000"],
      topicIds: [],
      referenceAnswer: "A closure is...",
      evaluationGuidance: { rubric: "Must mention scope" },
    };

    it("should parse a valid body", () => {
      const parsed = parseCreateQuestionBody(validBody);
      expect(parsed.questionText).toBe(validBody.questionText);
    });

    it("should reject if skillIds is empty", () => {
      const invalid = { ...validBody, skillIds: [] };
      expect(() => parseCreateQuestionBody(invalid)).toThrow(ValidationError);
    });
  });
});
