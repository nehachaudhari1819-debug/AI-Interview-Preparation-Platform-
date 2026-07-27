import { describe, expect, it } from "@jest/globals";
import {
  parseGetQuestionsQuery,
  parseQuestionId,
  parseTaxonomyType,
} from "../../../src/features/questions/questions.schemas.js";
import { ValidationError } from "../../../src/errors/validation.error.js";
import { randomUUID } from "node:crypto";

describe("Questions Schemas Validation", () => {
  describe("parseGetQuestionsQuery", () => {
    it("should provide defaults for missing optional values", () => {
      const result = parseGetQuestionsQuery({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.sortBy).toBe("createdAt");
      expect(result.sortDir).toBe("desc");
      expect(result.search).toBeUndefined();
    });

    it("should validate and parse page and limit", () => {
      const result = parseGetQuestionsQuery({ page: "2", limit: "50" });
      expect(result.page).toBe(2);
      expect(result.limit).toBe(50);
    });

    it("should reject invalid page and limit values", () => {
      expect(() => parseGetQuestionsQuery({ page: 0 })).toThrow(ValidationError);
      expect(() => parseGetQuestionsQuery({ limit: 0 })).toThrow(ValidationError);
      expect(() => parseGetQuestionsQuery({ limit: 101 })).toThrow(ValidationError);
    });

    it("should handle search validation correctly", () => {
      const result = parseGetQuestionsQuery({ search: "Node.js" });
      expect(result.search).toBe("Node.js");

      // Removes empty search
      const emptyResult = parseGetQuestionsQuery({ search: "  " });
      expect(emptyResult.search).toBeUndefined();

      // Too short
      expect(() => parseGetQuestionsQuery({ search: "No" })).toThrow(ValidationError);
      // Too long
      expect(() => parseGetQuestionsQuery({ search: "a".repeat(101) })).toThrow(ValidationError);
    });

    it("should validate and transform UUID array filters", () => {
      const uuid1 = randomUUID();
      const uuid2 = randomUUID();

      // String comma separated
      const resultStr = parseGetQuestionsQuery({ categoryId: `${uuid1},${uuid2}` });
      expect(resultStr.categoryId).toEqual([uuid1, uuid2]);

      // Array format
      const resultArray = parseGetQuestionsQuery({ categoryId: [uuid1, uuid2] });
      expect(resultArray.categoryId).toEqual([uuid1, uuid2]);

      // Invalid UUID
      expect(() => parseGetQuestionsQuery({ categoryId: "not-a-uuid" })).toThrow(ValidationError);
    });

    it("should validate sort field and order", () => {
      const result = parseGetQuestionsQuery({ sortBy: "updatedAt", sortDir: "asc" });
      expect(result.sortBy).toBe("updatedAt");
      expect(result.sortDir).toBe("asc");

      expect(() => parseGetQuestionsQuery({ sortBy: "invalidField" })).toThrow(ValidationError);
      expect(() => parseGetQuestionsQuery({ sortDir: "invalidDir" })).toThrow(ValidationError);
    });
  });

  describe("parseQuestionId", () => {
    it("should validate correct UUID", () => {
      const uuid = randomUUID();
      expect(parseQuestionId(uuid)).toBe(uuid);
    });

    it("should reject invalid UUIDs", () => {
      expect(() => parseQuestionId("not-a-uuid")).toThrow(ValidationError);
    });
  });

  describe("parseTaxonomyType", () => {
    it("should validate correct taxonomy types", () => {
      expect(parseTaxonomyType("categories")).toBe("categories");
      expect(parseTaxonomyType("difficulties")).toBe("difficulties");
    });

    it("should reject invalid taxonomy types", () => {
      expect(() => parseTaxonomyType("invalid-type")).toThrow(ValidationError);
    });
  });
});
