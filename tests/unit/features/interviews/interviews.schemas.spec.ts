import {
  parseCreateInterviewBody,
  parseUpdateInterviewBody,
  parseStrictEmptyBody,
  parseSaveDraftAnswerBody,
  parseUpdateDraftAnswerBody,
  parseFinalizeAnswerBody,
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

      expect(() => {
        parseCreateInterviewBody(invalid);
      }).toThrow(ValidationError);
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

      expect(() => {
        parseCreateInterviewBody(invalid);
      }).toThrow(ValidationError);
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

      expect(() => {
        parseUpdateInterviewBody(invalid);
      }).toThrow(ValidationError);
    });
  });

  describe("StrictEmptyBodySchema", () => {
    it("should accept empty object", () => {
      expect(() => {
        parseStrictEmptyBody({});
      }).not.toThrow();
    });

    it("should reject object with unknown fields", () => {
      expect(() => {
        parseStrictEmptyBody({ someField: "value" });
      }).toThrow(ValidationError);
    });

    it("should reject non-objects", () => {
      expect(() => {
        parseStrictEmptyBody("string");
      }).toThrow(ValidationError);
      expect(() => {
        parseStrictEmptyBody(null);
      }).toThrow(ValidationError);
      expect(() => {
        parseStrictEmptyBody(123);
      }).toThrow(ValidationError);
    });
  });

  describe("SaveDraftAnswerSchema", () => {
    it("should parse valid text response", () => {
      const valid = {
        responseType: "text",
        textResponse: "This is my answer.",
      };
      const result = parseSaveDraftAnswerBody(valid);
      expect(result).toEqual(valid);
    });

    it("should parse valid code response", () => {
      const valid = {
        responseType: "code",
        codeResponse: {
          source: "console.log('hello')",
          language: "javascript",
          explanation: "Testing",
        },
      };
      const result = parseSaveDraftAnswerBody(valid);
      expect(result).toEqual(valid);
    });

    it("should reject invalid response type", () => {
      expect(() => {
        parseSaveDraftAnswerBody({ responseType: "audio", audioUrl: "foo" });
      }).toThrow(ValidationError);
    });

    it("should reject text response without textResponse field", () => {
      expect(() => {
        parseSaveDraftAnswerBody({ responseType: "text" });
      }).toThrow(ValidationError);
    });

    it("should reject extra fields due to strict", () => {
      expect(() => {
        parseSaveDraftAnswerBody({
          responseType: "text",
          textResponse: "answer",
          extraField: "invalid",
        });
      }).toThrow(ValidationError);
    });
  });

  describe("UpdateDraftAnswerSchema", () => {
    it("should parse valid text update", () => {
      const valid = {
        responseType: "text",
        textResponse: "Updated answer.",
        expectedVersion: 1,
      };
      const result = parseUpdateDraftAnswerBody(valid);
      expect(result).toEqual(valid);
    });

    it("should parse valid code update", () => {
      const valid = {
        responseType: "code",
        codeResponse: {
          source: "print('hello')",
          language: "python",
          explanation: "Testing python",
        },
        expectedVersion: 2,
      };
      const result = parseUpdateDraftAnswerBody(valid);
      expect(result).toEqual(valid);
    });

    it("should reject missing expectedVersion", () => {
      expect(() => {
        parseUpdateDraftAnswerBody({
          responseType: "text",
          textResponse: "Updated answer.",
        });
      }).toThrow(ValidationError);
    });

    it("should reject zero expectedVersion", () => {
      expect(() => {
        parseUpdateDraftAnswerBody({
          responseType: "text",
          textResponse: "Updated answer.",
          expectedVersion: 0,
        });
      }).toThrow(ValidationError);
    });
  });

  describe("FinalizeAnswerSchema", () => {
    it("should parse valid input", () => {
      const valid = { expectedVersion: 3 };
      const result = parseFinalizeAnswerBody(valid);
      expect(result).toEqual(valid);
    });

    it("should reject missing expectedVersion", () => {
      expect(() => {
        parseFinalizeAnswerBody({});
      }).toThrow(ValidationError);
    });

    it("should reject negative expectedVersion", () => {
      expect(() => {
        parseFinalizeAnswerBody({ expectedVersion: -1 });
      }).toThrow(ValidationError);
    });

    it("should reject extra fields", () => {
      expect(() => {
        parseFinalizeAnswerBody({ expectedVersion: 1, extraField: "invalid" });
      }).toThrow(ValidationError);
    });
  });
});
