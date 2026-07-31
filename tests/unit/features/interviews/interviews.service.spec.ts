import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { InterviewsService } from "../../../../src/features/interviews/interviews.service.js";
import type { IInterviewsRepository } from "../../../../src/features/interviews/interviews.repository.js";
import { HTTP_STATUS } from "../../../../src/constants/http.constants.js";
import { ERROR_CODES } from "../../../../src/constants/error-codes.constants.js";
import { NotFoundError } from "../../../../src/errors/not-found.error.js";
import type {
  DbInterview,
  DbSession,
  DbSessionQuestion,
} from "../../../../src/persistence/interviews/supabase-interviews.repository.js";

function buildDbInterview(overrides: Partial<DbInterview> = {}): DbInterview {
  return {
    id: "test-interview-id",
    title: "Test Interview",
    target_role: "Software Engineer",
    question_count: 5,
    time_limit_minutes: 30,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    question_interview_types: { id: "type-id", name: "Mock" },
    question_difficulties: { id: "diff-id", name: "Hard" },
    interview_skill_mappings: [],
    interview_topic_mappings: [],
    ...overrides,
  };
}

function buildDbSession(overrides: Partial<DbSession> = {}): DbSession {
  return {
    id: "test-session-id",
    interview_id: "test-interview-id",
    status: "ready",
    config_snapshot: {},
    started_at: null,
    paused_at: null,
    total_paused_seconds: 0,
    completed_at: null,
    last_transition_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function buildDbSessionQuestion(overrides: Partial<DbSessionQuestion> = {}): DbSessionQuestion {
  return {
    id: "test-question-id",
    session_id: "test-session-id",
    display_order: 1,
    question_text_snapshot: "What is testing?",
    taxonomy_snapshot: {},
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("InterviewsService", () => {
  let mockRepository: jest.Mocked<IInterviewsRepository>;
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
      startSession: jest.fn(),
      pauseSession: jest.fn(),
      resumeSession: jest.fn(),
      completeSession: jest.fn(),
    } as unknown as jest.Mocked<IInterviewsRepository>;
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
      mockRepository.getInterviewById.mockResolvedValue(buildDbInterview({ id: "i-id" }));
      mockRepository.getInterviewSessionById.mockResolvedValue(null);

      await expect(
        service.getSessionQuestions("i-id", "s-id", sessionQuestionsQuery),
      ).rejects.toThrow(NotFoundError);
    });

    it("should reject with RESOURCE_CONFLICT when session is ready", async () => {
      mockRepository.getInterviewById.mockResolvedValue(buildDbInterview({ id: "i-id" }));
      mockRepository.getInterviewSessionById.mockResolvedValue(buildDbSession({ status: "ready" }));

      await expect(
        service.getSessionQuestions("i-id", "s-id", sessionQuestionsQuery),
      ).rejects.toMatchObject({
        statusCode: HTTP_STATUS.CONFLICT,
        code: ERROR_CODES.RESOURCE_CONFLICT,
      });
    });

    it("should allow if session is in_progress", async () => {
      mockRepository.getInterviewById.mockResolvedValue(buildDbInterview({ id: "i-id" }));
      mockRepository.getInterviewSessionById.mockResolvedValue(
        buildDbSession({ status: "in_progress" }),
      );
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
      mockRepository.getInterviewById.mockResolvedValue(buildDbInterview({ id: "i-id" }));
      mockRepository.getInterviewSessionById.mockResolvedValue(null);

      await expect(service.getSessionQuestionById("i-id", "s-id", "q-id")).rejects.toThrow(
        NotFoundError,
      );
    });

    it("should reject with RESOURCE_CONFLICT when session is ready", async () => {
      mockRepository.getInterviewById.mockResolvedValue(buildDbInterview({ id: "i-id" }));
      mockRepository.getInterviewSessionById.mockResolvedValue(buildDbSession({ status: "ready" }));

      await expect(service.getSessionQuestionById("i-id", "s-id", "q-id")).rejects.toMatchObject({
        statusCode: HTTP_STATUS.CONFLICT,
        code: ERROR_CODES.RESOURCE_CONFLICT,
      });
    });

    it("should throw NotFoundError if question missing after valid parent chain", async () => {
      mockRepository.getInterviewById.mockResolvedValue(buildDbInterview({ id: "i-id" }));
      mockRepository.getInterviewSessionById.mockResolvedValue(
        buildDbSession({ status: "in_progress" }),
      );
      mockRepository.getSessionQuestionById.mockResolvedValue(null);

      await expect(service.getSessionQuestionById("i-id", "s-id", "q-id")).rejects.toThrow(
        NotFoundError,
      );
    });

    it("should return question if session is in_progress", async () => {
      mockRepository.getInterviewById.mockResolvedValue(buildDbInterview({ id: "i-id" }));
      mockRepository.getInterviewSessionById.mockResolvedValue(
        buildDbSession({ status: "in_progress" }),
      );
      mockRepository.getSessionQuestionById.mockResolvedValue(
        buildDbSessionQuestion({ id: "q-id" }),
      );

      const res = await service.getSessionQuestionById("i-id", "s-id", "q-id");
      expect(res.id).toEqual("q-id");
    });
  });
  describe("lifecycle methods", () => {
    it("should generate fingerprint and call startSession", async () => {
      const snapshot = buildDbSession({ id: "s1" });
      mockRepository.startSession.mockResolvedValue({ replayed: false, snapshot });
      const res = await service.startSession("i1", "s1", "key1");
      expect(mockRepository.startSession).toHaveBeenCalledWith(
        "i1",
        "s1",
        "key1",
        expect.any(String),
      );
      expect(res).toEqual({ replayed: false, snapshot });
    });

    it("should generate fingerprint and call pauseSession", async () => {
      const snapshot = buildDbSession({ id: "s1" });
      mockRepository.pauseSession.mockResolvedValue({ replayed: false, snapshot });
      const res = await service.pauseSession("i1", "s1", "key1");
      expect(mockRepository.pauseSession).toHaveBeenCalledWith(
        "i1",
        "s1",
        "key1",
        expect.any(String),
      );
      expect(res).toEqual({ replayed: false, snapshot });
    });

    it("should generate fingerprint and call resumeSession", async () => {
      const snapshot = buildDbSession({ id: "s1" });
      mockRepository.resumeSession.mockResolvedValue({ replayed: false, snapshot });
      const res = await service.resumeSession("i1", "s1", "key1");
      expect(mockRepository.resumeSession).toHaveBeenCalledWith(
        "i1",
        "s1",
        "key1",
        expect.any(String),
      );
      expect(res).toEqual({ replayed: false, snapshot });
    });

    it("should generate fingerprint and call completeSession", async () => {
      const snapshot = buildDbSession({ id: "s1" });
      mockRepository.completeSession.mockResolvedValue({ replayed: false, snapshot });
      const res = await service.completeSession("i1", "s1", "key1");
      expect(mockRepository.completeSession).toHaveBeenCalledWith(
        "i1",
        "s1",
        "key1",
        expect.any(String),
      );
      expect(res).toEqual({ replayed: false, snapshot });
    });
  });
});
