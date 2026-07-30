import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { InterviewsService } from "../../../../src/features/interviews/interviews.service.js";
import { HTTP_STATUS } from "../../../../src/constants/http.constants.js";
import { ERROR_CODES } from "../../../../src/constants/error-codes.constants.js";
import { NotFoundError } from "../../../../src/errors/not-found.error.js";

describe("InterviewsService", () => {
  let mockRepository: any;
  let service: InterviewsService;

  beforeEach(() => {
    mockRepository = {
      createInterview: jest.fn(),
      updateInterview: jest.fn(),
      getInterviews: jest.fn(),
      getInterviewById: jest.fn(),
      getInterviewSessions: jest.fn(),
      getInterviewSessionById: jest.fn(),
      getSessionQuestions: jest.fn(),
      getSessionQuestionById: jest.fn(),
    };
    service = new InterviewsService(mockRepository);
  });

  describe("getSessionQuestions", () => {
    const sessionQuestionsQuery = {
      page: 1,
      limit: 20,
      sortBy: "createdAt" as const,
      sortDir: "desc" as const,
    };
    it("should throw NotFoundError if interview missing", async () => {
      mockRepository.getInterviewById.mockResolvedValue(null);

      await expect(
        service.getSessionQuestions("i-id", "s-id", sessionQuestionsQuery),
      ).rejects.toThrow(NotFoundError);
    });

    it("should throw NotFoundError if session missing", async () => {
      mockRepository.getInterviewById.mockResolvedValue({ id: "i-id" });
      mockRepository.getInterviewSessionById.mockResolvedValue(null);

      await expect(
        service.getSessionQuestions("i-id", "s-id", sessionQuestionsQuery),
      ).rejects.toThrow(NotFoundError);
    });

    it("should reject with RESOURCE_CONFLICT when session is ready", async () => {
      mockRepository.getInterviewById.mockResolvedValue({ id: "i-id" });
      mockRepository.getInterviewSessionById.mockResolvedValue({ status: "ready" });

      await expect(
        service.getSessionQuestions("i-id", "s-id", sessionQuestionsQuery),
      ).rejects.toMatchObject({
        statusCode: HTTP_STATUS.CONFLICT,
        code: ERROR_CODES.RESOURCE_CONFLICT,
      });
    });

    it("should allow if session is in_progress", async () => {
      mockRepository.getInterviewById.mockResolvedValue({ id: "i-id" });
      mockRepository.getInterviewSessionById.mockResolvedValue({ status: "in_progress" });
      mockRepository.getSessionQuestions.mockResolvedValue({ questions: [], total: 0 });

      const res = await service.getSessionQuestions("i-id", "s-id", sessionQuestionsQuery);

      expect(mockRepository.getSessionQuestions).toHaveBeenCalledWith(
        "i-id",
        "s-id",
        sessionQuestionsQuery,
      );
      expect(res).toEqual({
        items: [],
        pagination: {
          page: 1,
          limit: 20,
          totalItems: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      });
    });
  });

  describe("getSessionQuestionById", () => {
    it("should throw NotFoundError if interview missing", async () => {
      mockRepository.getInterviewById.mockResolvedValue(null);

      await expect(service.getSessionQuestionById("i-id", "s-id", "q-id")).rejects.toThrow(
        NotFoundError,
      );
    });

    it("should throw NotFoundError if session missing", async () => {
      mockRepository.getInterviewById.mockResolvedValue({ id: "i-id" });
      mockRepository.getInterviewSessionById.mockResolvedValue(null);

      await expect(service.getSessionQuestionById("i-id", "s-id", "q-id")).rejects.toThrow(
        NotFoundError,
      );
    });

    it("should reject with RESOURCE_CONFLICT when session is ready", async () => {
      mockRepository.getInterviewById.mockResolvedValue({ id: "i-id" });
      mockRepository.getInterviewSessionById.mockResolvedValue({ status: "ready" });

      await expect(service.getSessionQuestionById("i-id", "s-id", "q-id")).rejects.toMatchObject({
        statusCode: HTTP_STATUS.CONFLICT,
        code: ERROR_CODES.RESOURCE_CONFLICT,
      });
    });

    it("should throw NotFoundError if question missing after valid parent chain", async () => {
      mockRepository.getInterviewById.mockResolvedValue({ id: "i-id" });
      mockRepository.getInterviewSessionById.mockResolvedValue({ status: "in_progress" });
      mockRepository.getSessionQuestionById.mockResolvedValue(null);

      await expect(service.getSessionQuestionById("i-id", "s-id", "q-id")).rejects.toThrow(
        NotFoundError,
      );
    });

    it("should return question if session is in_progress", async () => {
      mockRepository.getInterviewById.mockResolvedValue({ id: "i-id" });
      mockRepository.getInterviewSessionById.mockResolvedValue({ status: "in_progress" });
      mockRepository.getSessionQuestionById.mockResolvedValue({ id: "q-id" });

      const res = await service.getSessionQuestionById("i-id", "s-id", "q-id");
      expect(res.id).toEqual("q-id");
    });
  });
});
