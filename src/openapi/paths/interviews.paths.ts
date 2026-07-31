import type { PathsObject } from "../openapi.types.js";

export const interviewsPaths: PathsObject = {
  "/api/v1/interviews": {
    get: {
      tags: ["Interviews"],
      summary: "List interviews",
      operationId: "listInterviewConfigurations",
      description: "Retrieve a paginated list of interviews for the authenticated user.",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "page",
          in: "query",
          schema: { type: "integer", default: 1 },
        },
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", default: 20 },
        },
        {
          name: "sortBy",
          in: "query",
          schema: { type: "string", enum: ["createdAt", "updatedAt"], default: "createdAt" },
        },
        {
          name: "sortDir",
          in: "query",
          schema: { type: "string", enum: ["asc", "desc"], default: "desc" },
        },
      ],
      responses: {
        "200": {
          description: "Successful response",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/PaginatedInterviewsResponse" },
            },
          },
        },
        "401": { $ref: "#/components/responses/Unauthorized" },
        "403": { $ref: "#/components/responses/Forbidden" },
      },
    },
    post: {
      tags: ["Interviews"],
      summary: "Create interview",
      operationId: "createInterviewConfiguration",
      description: "Creates a new interview configuration.",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/CreateInterviewBody" },
          },
        },
      },
      responses: {
        "201": {
          description: "Interview created successfully",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/InterviewDetailResponse" },
            },
          },
        },
        "400": { $ref: "#/components/responses/ValidationError" },
        "401": { $ref: "#/components/responses/Unauthorized" },
        "403": { $ref: "#/components/responses/Forbidden" },
      },
    },
  },
  "/api/v1/interviews/{interviewId}": {
    get: {
      tags: ["Interviews"],
      summary: "Get interview detail",
      operationId: "getInterviewConfiguration",
      description: "Retrieve details of a specific interview.",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "interviewId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      responses: {
        "200": {
          description: "Successful response",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/InterviewDetailResponse" },
            },
          },
        },
        "401": { $ref: "#/components/responses/Unauthorized" },
        "403": { $ref: "#/components/responses/Forbidden" },
        "404": { $ref: "#/components/responses/NotFound" },
      },
    },
    patch: {
      tags: ["Interviews"],
      summary: "Update interview",
      operationId: "updateInterviewConfiguration",
      description:
        "Updates an existing interview configuration. Expects concurrency control via expectedUpdatedAt.",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "interviewId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/UpdateInterviewBody" },
          },
        },
      },
      responses: {
        "200": {
          description: "Interview updated successfully",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/InterviewDetailResponse" },
            },
          },
        },
        "400": { $ref: "#/components/responses/ValidationError" },
        "401": { $ref: "#/components/responses/Unauthorized" },
        "403": { $ref: "#/components/responses/Forbidden" },
        "404": { $ref: "#/components/responses/NotFound" },
        "409": { $ref: "#/components/responses/Conflict" },
      },
    },
  },
  "/api/v1/interviews/{interviewId}/sessions": {
    get: {
      tags: ["Interviews"],
      summary: "List interview sessions",
      operationId: "listInterviewSessions",
      description: "Retrieve a list of sessions for a specific interview.",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "interviewId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
        {
          name: "page",
          in: "query",
          schema: { type: "integer", default: 1 },
        },
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", default: 20 },
        },
      ],
      responses: {
        "200": {
          description: "Successful response",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/PaginatedSessionsResponse" },
            },
          },
        },
        "401": { $ref: "#/components/responses/Unauthorized" },
        "403": { $ref: "#/components/responses/Forbidden" },
        "404": { $ref: "#/components/responses/NotFound" },
      },
    },
  },
  "/api/v1/interviews/{interviewId}/sessions/{sessionId}": {
    get: {
      tags: ["Interviews"],
      summary: "Get session detail",
      operationId: "getInterviewSession",
      description: "Retrieve details of a specific interview session.",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "interviewId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
        {
          name: "sessionId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      responses: {
        "200": {
          description: "Successful response",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/InterviewSessionResponse" },
            },
          },
        },
        "401": { $ref: "#/components/responses/Unauthorized" },
        "403": { $ref: "#/components/responses/Forbidden" },
        "404": { $ref: "#/components/responses/NotFound" },
      },
    },
  },
  "/api/v1/interviews/{interviewId}/sessions/{sessionId}/questions": {
    get: {
      tags: ["Interviews"],
      summary: "List session questions",
      operationId: "listInterviewSessionQuestions",
      description:
        "Retrieve the list of questions for a specific session. Returns 409 if the session is still in ready state.",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "interviewId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
        {
          name: "sessionId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
        {
          name: "page",
          in: "query",
          schema: { type: "integer", default: 1 },
        },
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", default: 20 },
        },
      ],
      responses: {
        "200": {
          description: "Successful response",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/PaginatedSessionQuestionsResponse" },
            },
          },
        },
        "401": { $ref: "#/components/responses/Unauthorized" },
        "403": { $ref: "#/components/responses/Forbidden" },
        "404": { $ref: "#/components/responses/NotFound" },
        "409": { $ref: "#/components/responses/Conflict" },
      },
    },
  },
  "/api/v1/interviews/{interviewId}/sessions/{sessionId}/questions/{sessionQuestionId}": {
    get: {
      tags: ["Interviews"],
      summary: "Get session question detail",
      operationId: "getInterviewSessionQuestion",
      description:
        "Retrieve details of a specific session question. Returns 409 if the session is still in ready state.",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "interviewId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
        {
          name: "sessionId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
        {
          name: "sessionQuestionId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      responses: {
        "200": {
          description: "Successful response",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SessionQuestionResponse" },
            },
          },
        },
        "401": { $ref: "#/components/responses/Unauthorized" },
        "403": { $ref: "#/components/responses/Forbidden" },
        "404": { $ref: "#/components/responses/NotFound" },
        "409": { $ref: "#/components/responses/Conflict" },
      },
    },
  },
  "/api/v1/interviews/{interviewId}/sessions/{sessionId}/start": {
    post: {
      tags: ["Interviews"],
      summary: "Start interview session",
      operationId: "startInterviewSession",
      description: "Starts a ready interview session.",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "Idempotency-Key",
          in: "header",
          required: true,
          schema: { type: "string" },
        },
        {
          name: "interviewId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
        {
          name: "sessionId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              additionalProperties: false,
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Successful response",
          headers: {
            "X-Idempotency-Replay": {
              schema: { type: "string" },
              description:
                "Indicates if the response was replayed from a previous idempotent request.",
            },
          },
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/InterviewSessionResponse" },
            },
          },
        },
        "400": { $ref: "#/components/responses/BadRequest" },
        "401": { $ref: "#/components/responses/Unauthorized" },
        "403": { $ref: "#/components/responses/Forbidden" },
        "404": { $ref: "#/components/responses/NotFound" },
        "409": { $ref: "#/components/responses/Conflict" },
        "422": { $ref: "#/components/responses/ValidationError" },
      },
    },
  },
  "/api/v1/interviews/{interviewId}/sessions/{sessionId}/pause": {
    post: {
      tags: ["Interviews"],
      summary: "Pause interview session",
      operationId: "pauseInterviewSession",
      description: "Pauses an in-progress interview session.",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "Idempotency-Key",
          in: "header",
          required: true,
          schema: { type: "string" },
        },
        {
          name: "interviewId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
        {
          name: "sessionId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              additionalProperties: false,
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Successful response",
          headers: {
            "X-Idempotency-Replay": {
              schema: { type: "string" },
            },
          },
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/InterviewSessionResponse" },
            },
          },
        },
        "400": { $ref: "#/components/responses/BadRequest" },
        "401": { $ref: "#/components/responses/Unauthorized" },
        "403": { $ref: "#/components/responses/Forbidden" },
        "404": { $ref: "#/components/responses/NotFound" },
        "409": { $ref: "#/components/responses/Conflict" },
        "422": { $ref: "#/components/responses/ValidationError" },
      },
    },
  },
  "/api/v1/interviews/{interviewId}/sessions/{sessionId}/resume": {
    post: {
      tags: ["Interviews"],
      summary: "Resume interview session",
      operationId: "resumeInterviewSession",
      description: "Resumes a paused interview session.",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "Idempotency-Key",
          in: "header",
          required: true,
          schema: { type: "string" },
        },
        {
          name: "interviewId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
        {
          name: "sessionId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              additionalProperties: false,
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Successful response",
          headers: {
            "X-Idempotency-Replay": {
              schema: { type: "string" },
            },
          },
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/InterviewSessionResponse" },
            },
          },
        },
        "400": { $ref: "#/components/responses/BadRequest" },
        "401": { $ref: "#/components/responses/Unauthorized" },
        "403": { $ref: "#/components/responses/Forbidden" },
        "404": { $ref: "#/components/responses/NotFound" },
        "409": { $ref: "#/components/responses/Conflict" },
        "422": { $ref: "#/components/responses/ValidationError" },
      },
    },
  },
  "/api/v1/interviews/{interviewId}/sessions/{sessionId}/complete": {
    post: {
      tags: ["Interviews"],
      summary: "Complete interview session",
      operationId: "completeInterviewSession",
      description: "Completes an in-progress or paused interview session.",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "Idempotency-Key",
          in: "header",
          required: true,
          schema: { type: "string" },
        },
        {
          name: "interviewId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
        {
          name: "sessionId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              additionalProperties: false,
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Successful response",
          headers: {
            "X-Idempotency-Replay": {
              schema: { type: "string" },
            },
          },
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/InterviewSessionResponse" },
            },
          },
        },
        "400": { $ref: "#/components/responses/BadRequest" },
        "401": { $ref: "#/components/responses/Unauthorized" },
        "403": { $ref: "#/components/responses/Forbidden" },
        "404": { $ref: "#/components/responses/NotFound" },
        "409": { $ref: "#/components/responses/Conflict" },
        "422": { $ref: "#/components/responses/ValidationError" },
      },
    },
  },
};
