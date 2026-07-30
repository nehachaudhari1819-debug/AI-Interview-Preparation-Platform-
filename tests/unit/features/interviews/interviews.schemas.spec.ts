import {
  parseCreateInterviewBody,
  parseUpdateInterviewBody,
} from "../../../../src/features/interviews/interviews.schemas.js";
import { ValidationError } from "../../../../src/errors/validation.error.js";
import { randomUUID } from "crypto";

describe("Interviews Schemas", () => {
  describe("CreateInterviewSchema", () => {
    it("should parse valid input", () => {
      const valid = {
        title: "Frontend Engineer Mock",
        targetRole: "Frontend Engineer",
        interviewTypeId: randomUUID(),
        difficultyId: randomUUID(),
        questionCount: 10,
        timeLimitMinutes: 45,
        skillIds: [randomUUID(), randomUUID()],
        topicIds: [randomUUID()],
      };

      const result = parseCreateInterviewBody(valid);
      expect(result).toEqual(valid);
    });

    it("should reject duplicate skillIds", () => {
      const id = randomUUID();
      const invalid = {
        title: "Frontend Engineer Mock",
        targetRole: "Frontend Engineer",
        interviewTypeId: randomUUID(),
        difficultyId: randomUUID(),
        questionCount: 10,
        timeLimitMinutes: 45,
        skillIds: [id, id],
      };

      expect(() => parseCreateInterviewBody(invalid)).toThrow(ValidationError);
    });

    it("should reject more than 20 questions", () => {
      const invalid = {
        title: "Mock",
        targetRole: "Dev",
        interviewTypeId: randomUUID(),
        difficultyId: randomUUID(),
        questionCount: 21,
        skillIds: [randomUUID()],
      };

      expect(() => parseCreateInterviewBody(invalid)).toThrow(ValidationError);
    });
  });

  describe("UpdateInterviewSchema", () => {
    it("should parse valid input", () => {
      const valid = {
        expectedUpdatedAt: new Date().toISOString(),
        payload: {
          title: "Updated Title",
        },
      };

      const result = parseUpdateInterviewBody(valid);
      expect(result).toEqual(valid);
    });

    it("should reject empty payload", () => {
      const invalid = {
        expectedUpdatedAt: new Date().toISOString(),
        payload: {},
      };

      expect(() => parseUpdateInterviewBody(invalid)).toThrow(ValidationError);
    });
  });
});
