import type { ComponentsObject } from "../openapi.types.js";

export const interviewSchemas: ComponentsObject["schemas"] = {
  TaxonomyReference: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      name: { type: "string" },
    },
    required: ["id", "name"],
  },
  InterviewDetail: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      title: { type: "string" },
      targetRole: { type: "string" },
      interviewType: { $ref: "#/components/schemas/TaxonomyReference" },
      difficulty: { $ref: "#/components/schemas/TaxonomyReference" },
      skills: {
        type: "array",
        items: { $ref: "#/components/schemas/TaxonomyReference" },
      },
      topics: {
        type: "array",
        items: { $ref: "#/components/schemas/TaxonomyReference" },
      },
      questionCount: { type: "integer" },
      timeLimitMinutes: { type: "integer", nullable: true },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
    required: [
      "id",
      "title",
      "targetRole",
      "interviewType",
      "difficulty",
      "skills",
      "topics",
      "questionCount",
      "timeLimitMinutes",
      "createdAt",
      "updatedAt",
    ],
  },
  InterviewSession: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      interviewId: { type: "string", format: "uuid" },
      status: {
        type: "string",
        enum: ["ready", "in_progress", "paused", "completed"],
      },
      configSnapshot: { type: "object", additionalProperties: true },
      startedAt: { type: "string", format: "date-time", nullable: true },
      pausedAt: { type: "string", format: "date-time", nullable: true },
      totalPausedSeconds: { type: "integer" },
      completedAt: { type: "string", format: "date-time", nullable: true },
      lastTransitionAt: { type: "string", format: "date-time" },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
    required: [
      "id",
      "interviewId",
      "status",
      "configSnapshot",
      "startedAt",
      "pausedAt",
      "totalPausedSeconds",
      "completedAt",
      "lastTransitionAt",
      "createdAt",
      "updatedAt",
    ],
  },
  SessionQuestion: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      sessionId: { type: "string", format: "uuid" },
      displayOrder: { type: "integer" },
      questionTextSnapshot: { type: "string", nullable: true },
      taxonomySnapshot: { type: "object", additionalProperties: true, nullable: true },
      createdAt: { type: "string", format: "date-time" },
    },
    required: [
      "id",
      "sessionId",
      "displayOrder",
      "questionTextSnapshot",
      "taxonomySnapshot",
      "createdAt",
    ],
  },
  CreateInterviewBody: {
    type: "object",
    additionalProperties: false,
    properties: {
      title: { type: "string", minLength: 1, maxLength: 100 },
      targetRole: { type: "string", minLength: 1, maxLength: 100 },
      interviewTypeId: { type: "string", format: "uuid" },
      difficultyId: { type: "string", format: "uuid" },
      questionCount: { type: "integer", minimum: 1, maximum: 20 },
      timeLimitMinutes: { type: "integer", minimum: 5, maximum: 120, nullable: true },
      skillIds: {
        type: "array",
        items: { type: "string", format: "uuid" },
        minItems: 1,
        maxItems: 10,
        uniqueItems: true,
      },
      topicIds: {
        type: "array",
        items: { type: "string", format: "uuid" },
        maxItems: 10,
        uniqueItems: true,
        nullable: true,
      },
    },
    required: [
      "title",
      "targetRole",
      "interviewTypeId",
      "difficultyId",
      "questionCount",
      "skillIds",
    ],
  },
  UpdateInterviewBody: {
    type: "object",
    additionalProperties: false,
    properties: {
      expectedUpdatedAt: { type: "string", format: "date-time" },
      payload: {
        type: "object",
        additionalProperties: false,
        minProperties: 1,
        properties: {
          title: { type: "string", minLength: 1, maxLength: 100 },
          targetRole: { type: "string", minLength: 1, maxLength: 100 },
          interviewTypeId: { type: "string", format: "uuid" },
          difficultyId: { type: "string", format: "uuid" },
          questionCount: { type: "integer", minimum: 1, maximum: 20 },
          timeLimitMinutes: { type: "integer", minimum: 5, maximum: 120, nullable: true },
          skillIds: {
            type: "array",
            items: { type: "string", format: "uuid" },
            minItems: 1,
            maxItems: 10,
            uniqueItems: true,
          },
          topicIds: {
            type: "array",
            items: { type: "string", format: "uuid" },
            maxItems: 10,
            uniqueItems: true,
            nullable: true,
          },
        },
      },
    },
    required: ["expectedUpdatedAt", "payload"],
  },
  CollectionMeta: {
    type: "object",
    properties: {
      requestId: { type: "string", format: "uuid" },
      currentPage: { type: "integer" },
      limit: { type: "integer" },
      totalItems: { type: "integer" },
      totalPages: { type: "integer" },
      hasNextPage: { type: "boolean" },
      hasPreviousPage: { type: "boolean" },
    },
    required: [
      "requestId",
      "currentPage",
      "limit",
      "totalItems",
      "totalPages",
      "hasNextPage",
      "hasPreviousPage",
    ],
  },
  PaginatedInterviewsResponse: {
    type: "object",
    properties: {
      success: { type: "boolean", example: true },
      data: {
        type: "array",
        items: { $ref: "#/components/schemas/InterviewDetail" },
      },
      meta: { $ref: "#/components/schemas/CollectionMeta" },
    },
    required: ["success", "data", "meta"],
  },
  PaginatedSessionsResponse: {
    type: "object",
    properties: {
      success: { type: "boolean", example: true },
      data: {
        type: "array",
        items: { $ref: "#/components/schemas/InterviewSession" },
      },
      meta: { $ref: "#/components/schemas/CollectionMeta" },
    },
    required: ["success", "data", "meta"],
  },
  PaginatedSessionQuestionsResponse: {
    type: "object",
    properties: {
      success: { type: "boolean", example: true },
      data: {
        type: "array",
        items: { $ref: "#/components/schemas/SessionQuestion" },
      },
      meta: { $ref: "#/components/schemas/CollectionMeta" },
    },
    required: ["success", "data", "meta"],
  },
  InterviewDetailResponse: {
    type: "object",
    properties: {
      success: { type: "boolean", example: true },
      data: { $ref: "#/components/schemas/InterviewDetail" },
      meta: { $ref: "#/components/schemas/ApiMeta" },
    },
    required: ["success", "data", "meta"],
  },
  InterviewSessionResponse: {
    type: "object",
    properties: {
      success: { type: "boolean", example: true },
      data: { $ref: "#/components/schemas/InterviewSession" },
      meta: { $ref: "#/components/schemas/ApiMeta" },
    },
    required: ["success", "data", "meta"],
  },
  SessionQuestionResponse: {
    type: "object",
    properties: {
      success: { type: "boolean", example: true },
      data: { $ref: "#/components/schemas/SessionQuestion" },
      meta: { $ref: "#/components/schemas/ApiMeta" },
    },
    required: ["success", "data", "meta"],
  },

  // ---------------------------------------------------------------
  // P6.3 — Answer Schemas
  // ---------------------------------------------------------------
  CodeResponse: {
    type: "object",
    additionalProperties: false,
    properties: {
      source: { type: "string", minLength: 1, maxLength: 50000 },
      language: {
        type: "string",
        enum: ["python", "javascript", "typescript", "java", "cpp", "go", "rust"],
      },
      explanation: { type: "string", minLength: 1, maxLength: 10000 },
    },
    required: ["source", "language", "explanation"],
  },
  AnswerDetail: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      sessionQuestionId: { type: "string", format: "uuid" },
      responseType: { type: "string", enum: ["text", "code"], nullable: true },
      textResponse: { type: "string", nullable: true },
      codeResponse: { $ref: "#/components/schemas/CodeResponse", nullable: true },
      status: { type: "string", enum: ["draft", "finalized", "skipped"] },
      version: { type: "integer", minimum: 1 },
      finalizedAt: { type: "string", format: "date-time", nullable: true },
      skippedAt: { type: "string", format: "date-time", nullable: true },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
    required: [
      "id",
      "sessionQuestionId",
      "responseType",
      "textResponse",
      "codeResponse",
      "status",
      "version",
      "finalizedAt",
      "skippedAt",
      "createdAt",
      "updatedAt",
    ],
  },
  AnswerResponse: {
    type: "object",
    properties: {
      success: { type: "boolean", example: true },
      data: { $ref: "#/components/schemas/AnswerDetail" },
      meta: { $ref: "#/components/schemas/ApiMeta" },
    },
    required: ["success", "data", "meta"],
  },
  SaveDraftTextAnswerBody: {
    type: "object",
    additionalProperties: false,
    properties: {
      responseType: { type: "string", enum: ["text"] },
      textResponse: { type: "string", minLength: 1, maxLength: 10000 },
    },
    required: ["responseType", "textResponse"],
  },
  SaveDraftCodeAnswerBody: {
    type: "object",
    additionalProperties: false,
    properties: {
      responseType: { type: "string", enum: ["code"] },
      codeResponse: { $ref: "#/components/schemas/CodeResponse" },
    },
    required: ["responseType", "codeResponse"],
  },
  SaveDraftAnswerBody: {
    oneOf: [
      { $ref: "#/components/schemas/SaveDraftTextAnswerBody" },
      { $ref: "#/components/schemas/SaveDraftCodeAnswerBody" },
    ],
  },
  UpdateDraftTextAnswerBody: {
    type: "object",
    additionalProperties: false,
    properties: {
      responseType: { type: "string", enum: ["text"] },
      textResponse: { type: "string", minLength: 1, maxLength: 10000 },
      expectedVersion: { type: "integer", minimum: 1 },
    },
    required: ["responseType", "textResponse", "expectedVersion"],
  },
  UpdateDraftCodeAnswerBody: {
    type: "object",
    additionalProperties: false,
    properties: {
      responseType: { type: "string", enum: ["code"] },
      codeResponse: { $ref: "#/components/schemas/CodeResponse" },
      expectedVersion: { type: "integer", minimum: 1 },
    },
    required: ["responseType", "codeResponse", "expectedVersion"],
  },
  UpdateDraftAnswerBody: {
    oneOf: [
      { $ref: "#/components/schemas/UpdateDraftTextAnswerBody" },
      { $ref: "#/components/schemas/UpdateDraftCodeAnswerBody" },
    ],
  },
  FinalizeAnswerBody: {
    type: "object",
    additionalProperties: false,
    properties: {
      expectedVersion: { type: "integer", minimum: 1 },
    },
    required: ["expectedVersion"],
  },
};
