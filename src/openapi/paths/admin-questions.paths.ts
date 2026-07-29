import type { PathsObject } from "../openapi.types.js";

export const adminQuestionPaths: PathsObject = {
  "/api/v1/admin/questions": {
    get: {
      tags: ["Admin Questions"],
      summary: "List Questions (Admin)",
      operationId: "listAdminQuestions",
      description: "Returns a paginated list of all questions with optional status filtering.",
      security: [{ BearerAuth: [] }],
      parameters: [
        { $ref: "#/components/parameters/QueryPage" },
        { $ref: "#/components/parameters/QueryLimit" },
        { $ref: "#/components/parameters/QuerySearch" },
        { $ref: "#/components/parameters/AdminQuerySortBy" },
        { $ref: "#/components/parameters/QuerySortDir" },
        { $ref: "#/components/parameters/AdminQueryStatus" },
        { $ref: "#/components/parameters/QueryCategoryId" },
        { $ref: "#/components/parameters/QueryDifficultyId" },
        { $ref: "#/components/parameters/QueryInterviewTypeId" },
        { $ref: "#/components/parameters/QuerySkillId" },
        { $ref: "#/components/parameters/QueryTopicId" },
      ],
      responses: {
        "200": {
          description: "Successful response",
          headers: { "X-Request-ID": { $ref: "#/components/headers/RequestId" } },
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["success", "data", "meta"],
                properties: {
                  success: { type: "boolean" },
                  message: { type: "string" },
                  data: {
                    type: "array",
                    items: { $ref: "#/components/schemas/AdminQuestionDetail" },
                  },
                  meta: {
                    type: "object",
                    required: [
                      "requestId",
                      "totalItems",
                      "totalPages",
                      "currentPage",
                      "limit",
                      "hasNextPage",
                      "hasPreviousPage",
                    ],
                    properties: {
                      requestId: { type: "string" },
                      totalItems: { type: "integer" },
                      totalPages: { type: "integer" },
                      currentPage: { type: "integer" },
                      limit: { type: "integer" },
                      hasNextPage: { type: "boolean" },
                      hasPreviousPage: { type: "boolean" },
                    },
                  },
                },
                example: {
                  success: true,
                  data: [
                    {
                      id: "00000000-0000-4000-8000-000000000001",
                      questionText: "What is a promise in JavaScript?",
                      categoryId: "00000000-0000-4000-8000-000000000010",
                      difficultyId: "00000000-0000-4000-8000-000000000011",
                      interviewTypeId: "00000000-0000-4000-8000-000000000012",
                      skillIds: ["00000000-0000-4000-8000-000000000013"],
                      topicIds: ["00000000-0000-4000-8000-000000000014"],
                      status: "draft",
                      publishedAt: null,
                      archivedAt: null,
                      createdAt: "2024-01-01T00:00:00.000Z",
                      updatedAt: "2024-01-01T00:00:00.000Z",
                      referenceAnswer: "A promise is an object...",
                      evaluationGuidance: {},
                    },
                  ],
                  meta: {
                    requestId: "req-1234",
                    totalItems: 1,
                    totalPages: 1,
                    currentPage: 1,
                    limit: 20,
                    hasNextPage: false,
                    hasPreviousPage: false,
                  },
                },
              },
            },
          },
        },
        "400": { $ref: "#/components/responses/QuestionValidationError" },
        "401": { $ref: "#/components/responses/QuestionAuthRequired" },
        "403": { $ref: "#/components/responses/QuestionForbidden" },
      },
    },
    post: {
      tags: ["Admin Questions"],
      summary: "Create Question (Admin)",
      operationId: "createAdminQuestion",
      description:
        "Creates a new draft question. Supports identical-key replay without duplicate mutation or audit event. Replays stored status/body on exact key match. Rejects duplicate mutations and handles concurrent lifecycle conflicts.",
      security: [{ BearerAuth: [] }],
      parameters: [{ $ref: "#/components/parameters/IdempotencyKey" }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/CreateQuestionBody" },
          },
        },
      },
      responses: {
        "201": {
          description: "Question created",
          headers: { "X-Request-ID": { $ref: "#/components/headers/RequestId" } },
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["success", "data", "meta"],
                properties: {
                  success: { type: "boolean" },
                  message: { type: "string" },
                  data: { $ref: "#/components/schemas/AdminQuestionDetail" },
                  meta: { $ref: "#/components/schemas/ApiMeta" },
                },
                example: {
                  success: true,
                  data: {
                    id: "00000000-0000-4000-8000-000000000001",
                    questionText: "What is a promise in JavaScript?",
                    categoryId: "00000000-0000-4000-8000-000000000010",
                    difficultyId: "00000000-0000-4000-8000-000000000011",
                    interviewTypeId: "00000000-0000-4000-8000-000000000012",
                    skillIds: ["00000000-0000-4000-8000-000000000013"],
                    topicIds: ["00000000-0000-4000-8000-000000000014"],
                    status: "draft",
                    publishedAt: null,
                    archivedAt: null,
                    createdAt: "2024-01-01T00:00:00.000Z",
                    updatedAt: "2024-01-01T00:00:00.000Z",
                    referenceAnswer: "A promise is an object...",
                    evaluationGuidance: {},
                  },
                  meta: { requestId: "req-1234" },
                },
              },
            },
          },
        },
        "400": { $ref: "#/components/responses/QuestionValidationError" },
        "401": { $ref: "#/components/responses/QuestionAuthRequired" },
        "403": { $ref: "#/components/responses/QuestionForbidden" },
        "409": { $ref: "#/components/responses/QuestionConflict" },
        "503": { $ref: "#/components/responses/IdempotencyServiceUnavailableError" },
      },
    },
  },
  "/api/v1/admin/questions/{questionId}": {
    get: {
      tags: ["Admin Questions"],
      summary: "Get Question Details (Admin)",
      operationId: "getAdminQuestion",
      description: "Returns the detailed schema of a specific question.",
      security: [{ BearerAuth: [] }],
      parameters: [{ $ref: "#/components/parameters/QuestionId" }],
      responses: {
        "200": {
          description: "Successful response",
          headers: { "X-Request-ID": { $ref: "#/components/headers/RequestId" } },
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["success", "data", "meta"],
                properties: {
                  success: { type: "boolean" },
                  message: { type: "string" },
                  data: { $ref: "#/components/schemas/AdminQuestionDetail" },
                  meta: { $ref: "#/components/schemas/ApiMeta" },
                },
                example: {
                  success: true,
                  data: {
                    id: "00000000-0000-4000-8000-000000000001",
                    questionText: "What is a promise in JavaScript?",
                    categoryId: "00000000-0000-4000-8000-000000000010",
                    difficultyId: "00000000-0000-4000-8000-000000000011",
                    interviewTypeId: "00000000-0000-4000-8000-000000000012",
                    skillIds: ["00000000-0000-4000-8000-000000000013"],
                    topicIds: ["00000000-0000-4000-8000-000000000014"],
                    status: "draft",
                    publishedAt: null,
                    archivedAt: null,
                    createdAt: "2024-01-01T00:00:00.000Z",
                    updatedAt: "2024-01-01T00:00:00.000Z",
                    referenceAnswer: "A promise is an object...",
                    evaluationGuidance: {},
                  },
                  meta: { requestId: "req-1234" },
                },
              },
            },
          },
        },
        "400": { $ref: "#/components/responses/QuestionValidationError" },
        "401": { $ref: "#/components/responses/QuestionAuthRequired" },
        "403": { $ref: "#/components/responses/QuestionForbidden" },
        "404": { $ref: "#/components/responses/QuestionNotFound" },
      },
    },
    patch: {
      tags: ["Admin Questions"],
      summary: "Update Question (Admin)",
      operationId: "updateAdminQuestion",
      description:
        "Updates a question. Supports identical-key replay returning the same stored status/body. Prevents duplicate mutations and audit events on replay. Exposes 409 QuestionConflict on concurrent modifications.",
      security: [{ BearerAuth: [] }],
      parameters: [
        { $ref: "#/components/parameters/IdempotencyKey" },
        { $ref: "#/components/parameters/QuestionId" },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/UpdateQuestionBody" },
          },
        },
      },
      responses: {
        "200": {
          description: "Question updated",
          headers: { "X-Request-ID": { $ref: "#/components/headers/RequestId" } },
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["success", "data", "meta"],
                properties: {
                  success: { type: "boolean" },
                  message: { type: "string" },
                  data: { $ref: "#/components/schemas/AdminQuestionDetail" },
                  meta: { $ref: "#/components/schemas/ApiMeta" },
                },
                example: {
                  success: true,
                  data: {
                    id: "00000000-0000-4000-8000-000000000001",
                    questionText: "What is a promise in JavaScript?",
                    categoryId: "00000000-0000-4000-8000-000000000010",
                    difficultyId: "00000000-0000-4000-8000-000000000011",
                    interviewTypeId: "00000000-0000-4000-8000-000000000012",
                    skillIds: ["00000000-0000-4000-8000-000000000013"],
                    topicIds: ["00000000-0000-4000-8000-000000000014"],
                    status: "draft",
                    publishedAt: null,
                    archivedAt: null,
                    createdAt: "2024-01-01T00:00:00.000Z",
                    updatedAt: "2024-01-01T00:00:00.000Z",
                    referenceAnswer: "A promise is an object...",
                    evaluationGuidance: {},
                  },
                  meta: { requestId: "req-1234" },
                },
              },
            },
          },
        },
        "400": { $ref: "#/components/responses/QuestionValidationError" },
        "401": { $ref: "#/components/responses/QuestionAuthRequired" },
        "403": { $ref: "#/components/responses/QuestionForbidden" },
        "404": { $ref: "#/components/responses/QuestionNotFound" },
        "409": { $ref: "#/components/responses/QuestionConflict" },
        "503": { $ref: "#/components/responses/IdempotencyServiceUnavailableError" },
      },
    },
  },
  "/api/v1/admin/questions/{questionId}/publish": {
    post: {
      tags: ["Admin Questions"],
      summary: "Publish Question (Admin)",
      operationId: "publishAdminQuestion",
      description:
        "Publishes a draft question. Emits audit events securely, blocks duplicate execution on replay, and returns stored body for identical idempotency keys. Rejects concurrent state mutation with a 409 conflict.",
      security: [{ BearerAuth: [] }],
      parameters: [
        { $ref: "#/components/parameters/IdempotencyKey" },
        { $ref: "#/components/parameters/QuestionId" },
      ],
      responses: {
        "200": {
          description: "Question published",
          headers: { "X-Request-ID": { $ref: "#/components/headers/RequestId" } },
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["success", "data", "meta"],
                properties: {
                  success: { type: "boolean" },
                  message: { type: "string" },
                  data: { $ref: "#/components/schemas/AdminQuestionDetail" },
                  meta: { $ref: "#/components/schemas/ApiMeta" },
                },
                example: {
                  success: true,
                  data: {
                    id: "00000000-0000-4000-8000-000000000001",
                    questionText: "What is a promise in JavaScript?",
                    categoryId: "00000000-0000-4000-8000-000000000010",
                    difficultyId: "00000000-0000-4000-8000-000000000011",
                    interviewTypeId: "00000000-0000-4000-8000-000000000012",
                    skillIds: ["00000000-0000-4000-8000-000000000013"],
                    topicIds: ["00000000-0000-4000-8000-000000000014"],
                    status: "published",
                    publishedAt: "2024-01-01T00:00:00.000Z",
                    archivedAt: null,
                    createdAt: "2024-01-01T00:00:00.000Z",
                    updatedAt: "2024-01-01T00:00:00.000Z",
                    referenceAnswer: "A promise is an object...",
                    evaluationGuidance: {},
                  },
                  meta: { requestId: "req-1234" },
                },
              },
            },
          },
        },
        "400": { $ref: "#/components/responses/QuestionValidationError" },
        "401": { $ref: "#/components/responses/QuestionAuthRequired" },
        "403": { $ref: "#/components/responses/QuestionForbidden" },
        "404": { $ref: "#/components/responses/QuestionNotFound" },
        "409": { $ref: "#/components/responses/QuestionConflict" },
        "503": { $ref: "#/components/responses/IdempotencyServiceUnavailableError" },
      },
    },
  },
  "/api/v1/admin/questions/{questionId}/archive": {
    post: {
      tags: ["Admin Questions"],
      summary: "Archive Question (Admin)",
      operationId: "archiveAdminQuestion",
      description:
        "Archives a published question. Emits audit events securely, blocks duplicate execution on replay, and returns stored body for identical idempotency keys. Rejects concurrent state mutation with a 409 conflict.",
      security: [{ BearerAuth: [] }],
      parameters: [
        { $ref: "#/components/parameters/IdempotencyKey" },
        { $ref: "#/components/parameters/QuestionId" },
      ],
      responses: {
        "200": {
          description: "Question archived",
          headers: { "X-Request-ID": { $ref: "#/components/headers/RequestId" } },
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["success", "data", "meta"],
                properties: {
                  success: { type: "boolean" },
                  message: { type: "string" },
                  data: { $ref: "#/components/schemas/AdminQuestionDetail" },
                  meta: { $ref: "#/components/schemas/ApiMeta" },
                },
                example: {
                  success: true,
                  data: {
                    id: "00000000-0000-4000-8000-000000000001",
                    questionText: "What is a promise in JavaScript?",
                    categoryId: "00000000-0000-4000-8000-000000000010",
                    difficultyId: "00000000-0000-4000-8000-000000000011",
                    interviewTypeId: "00000000-0000-4000-8000-000000000012",
                    skillIds: ["00000000-0000-4000-8000-000000000013"],
                    topicIds: ["00000000-0000-4000-8000-000000000014"],
                    status: "archived",
                    publishedAt: "2024-01-01T00:00:00.000Z",
                    archivedAt: "2024-01-02T00:00:00.000Z",
                    createdAt: "2024-01-01T00:00:00.000Z",
                    updatedAt: "2024-01-02T00:00:00.000Z",
                    referenceAnswer: "A promise is an object...",
                    evaluationGuidance: {},
                  },
                  meta: { requestId: "req-1234" },
                },
              },
            },
          },
        },
        "400": { $ref: "#/components/responses/QuestionValidationError" },
        "401": { $ref: "#/components/responses/QuestionAuthRequired" },
        "403": { $ref: "#/components/responses/QuestionForbidden" },
        "404": { $ref: "#/components/responses/QuestionNotFound" },
        "409": { $ref: "#/components/responses/QuestionConflict" },
        "503": { $ref: "#/components/responses/IdempotencyServiceUnavailableError" },
      },
    },
  },
  "/api/v1/admin/questions/{questionId}/restore": {
    post: {
      tags: ["Admin Questions"],
      summary: "Restore Question (Admin)",
      operationId: "restoreAdminQuestion",
      description:
        "Restores an archived question to draft. Emits audit events securely, blocks duplicate execution on replay, and returns stored body for identical idempotency keys. Rejects concurrent state mutation with a 409 conflict.",
      security: [{ BearerAuth: [] }],
      parameters: [
        { $ref: "#/components/parameters/IdempotencyKey" },
        { $ref: "#/components/parameters/QuestionId" },
      ],
      responses: {
        "200": {
          description: "Question restored",
          headers: { "X-Request-ID": { $ref: "#/components/headers/RequestId" } },
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["success", "data", "meta"],
                properties: {
                  success: { type: "boolean" },
                  message: { type: "string" },
                  data: { $ref: "#/components/schemas/AdminQuestionDetail" },
                  meta: { $ref: "#/components/schemas/ApiMeta" },
                },
                example: {
                  success: true,
                  data: {
                    id: "00000000-0000-4000-8000-000000000001",
                    questionText: "What is a promise in JavaScript?",
                    categoryId: "00000000-0000-4000-8000-000000000010",
                    difficultyId: "00000000-0000-4000-8000-000000000011",
                    interviewTypeId: "00000000-0000-4000-8000-000000000012",
                    skillIds: ["00000000-0000-4000-8000-000000000013"],
                    topicIds: ["00000000-0000-4000-8000-000000000014"],
                    status: "draft",
                    publishedAt: "2024-01-01T00:00:00.000Z",
                    archivedAt: null,
                    createdAt: "2024-01-01T00:00:00.000Z",
                    updatedAt: "2024-01-02T00:00:00.000Z",
                    referenceAnswer: "A promise is an object...",
                    evaluationGuidance: {},
                  },
                  meta: { requestId: "req-1234" },
                },
              },
            },
          },
        },
        "400": { $ref: "#/components/responses/QuestionValidationError" },
        "401": { $ref: "#/components/responses/QuestionAuthRequired" },
        "403": { $ref: "#/components/responses/QuestionForbidden" },
        "404": { $ref: "#/components/responses/QuestionNotFound" },
        "409": { $ref: "#/components/responses/QuestionConflict" },
        "503": { $ref: "#/components/responses/IdempotencyServiceUnavailableError" },
      },
    },
  },
  "/api/v1/admin/taxonomies/{taxonomyType}": {
    post: {
      tags: ["Admin Taxonomies"],
      summary: "Create Taxonomy (Admin)",
      operationId: "createAdminTaxonomy",
      description:
        "Creates a new taxonomy item. Follows strict idempotency. Returns stored response body and skips audit log on identical-key replay.",
      security: [{ BearerAuth: [] }],
      parameters: [
        { $ref: "#/components/parameters/IdempotencyKey" },
        { $ref: "#/components/parameters/TaxonomyType" },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/CreateTaxonomyBody" },
          },
        },
      },
      responses: {
        "201": {
          description: "Taxonomy created",
          headers: { "X-Request-ID": { $ref: "#/components/headers/RequestId" } },
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["success", "data", "meta"],
                properties: {
                  success: { type: "boolean" },
                  message: { type: "string" },
                  data: { $ref: "#/components/schemas/AdminTaxonomyRow" },
                  meta: { $ref: "#/components/schemas/ApiMeta" },
                },
                example: {
                  success: true,
                  data: {
                    id: "00000000-0000-4000-8000-000000000010",
                    slug: "frontend",
                    name: "Frontend",
                    description: "Frontend questions",
                    displayOrder: 1,
                    isActive: true,
                    createdAt: "2024-01-01T00:00:00.000Z",
                    updatedAt: "2024-01-01T00:00:00.000Z",
                  },
                  meta: { requestId: "req-1234" },
                },
              },
            },
          },
        },
        "400": { $ref: "#/components/responses/QuestionValidationError" },
        "401": { $ref: "#/components/responses/QuestionAuthRequired" },
        "403": { $ref: "#/components/responses/QuestionForbidden" },
        "409": { $ref: "#/components/responses/QuestionConflict" },
        "503": { $ref: "#/components/responses/IdempotencyServiceUnavailableError" },
      },
    },
  },
  "/api/v1/admin/taxonomies/{taxonomyType}/{taxonomyId}": {
    patch: {
      tags: ["Admin Taxonomies"],
      summary: "Update Taxonomy (Admin)",
      operationId: "updateAdminTaxonomy",
      description:
        "Updates an existing taxonomy item. Ensures replay safety with no duplicate mutation or audit logs.",
      security: [{ BearerAuth: [] }],
      parameters: [
        { $ref: "#/components/parameters/IdempotencyKey" },
        { $ref: "#/components/parameters/TaxonomyType" },
        { $ref: "#/components/parameters/TaxonomyId" },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/UpdateTaxonomyBody" },
          },
        },
      },
      responses: {
        "200": {
          description: "Taxonomy updated",
          headers: { "X-Request-ID": { $ref: "#/components/headers/RequestId" } },
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["success", "data", "meta"],
                properties: {
                  success: { type: "boolean" },
                  message: { type: "string" },
                  data: { $ref: "#/components/schemas/AdminTaxonomyRow" },
                  meta: { $ref: "#/components/schemas/ApiMeta" },
                },
                example: {
                  success: true,
                  data: {
                    id: "00000000-0000-4000-8000-000000000010",
                    slug: "frontend",
                    name: "Frontend",
                    description: "Frontend questions",
                    displayOrder: 1,
                    isActive: true,
                    createdAt: "2024-01-01T00:00:00.000Z",
                    updatedAt: "2024-01-01T00:00:00.000Z",
                  },
                  meta: { requestId: "req-1234" },
                },
              },
            },
          },
        },
        "400": { $ref: "#/components/responses/QuestionValidationError" },
        "401": { $ref: "#/components/responses/QuestionAuthRequired" },
        "403": { $ref: "#/components/responses/QuestionForbidden" },
        "409": { $ref: "#/components/responses/QuestionConflict" },
        "503": { $ref: "#/components/responses/IdempotencyServiceUnavailableError" },
      },
    },
  },
  "/api/v1/admin/taxonomies/{taxonomyType}/{taxonomyId}/archive": {
    post: {
      tags: ["Admin Taxonomies"],
      summary: "Archive Taxonomy (Admin)",
      operationId: "archiveAdminTaxonomy",
      description:
        "Archives a taxonomy item by setting is_active to false. Safely avoids duplicate audits on identical-key replays.",
      security: [{ BearerAuth: [] }],
      parameters: [
        { $ref: "#/components/parameters/IdempotencyKey" },
        { $ref: "#/components/parameters/TaxonomyType" },
        { $ref: "#/components/parameters/TaxonomyId" },
      ],
      responses: {
        "200": {
          description: "Taxonomy archived",
          headers: { "X-Request-ID": { $ref: "#/components/headers/RequestId" } },
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["success", "data", "meta"],
                properties: {
                  success: { type: "boolean" },
                  message: { type: "string" },
                  data: { $ref: "#/components/schemas/AdminTaxonomyRow" },
                  meta: { $ref: "#/components/schemas/ApiMeta" },
                },
                example: {
                  success: true,
                  data: {
                    id: "00000000-0000-4000-8000-000000000010",
                    slug: "frontend",
                    name: "Frontend",
                    description: "Frontend questions",
                    displayOrder: 1,
                    isActive: false,
                    createdAt: "2024-01-01T00:00:00.000Z",
                    updatedAt: "2024-01-01T00:00:00.000Z",
                  },
                  meta: { requestId: "req-1234" },
                },
              },
            },
          },
        },
        "400": { $ref: "#/components/responses/QuestionValidationError" },
        "401": { $ref: "#/components/responses/QuestionAuthRequired" },
        "403": { $ref: "#/components/responses/QuestionForbidden" },
        "409": { $ref: "#/components/responses/QuestionConflict" },
        "503": { $ref: "#/components/responses/IdempotencyServiceUnavailableError" },
      },
    },
  },
  "/api/v1/admin/taxonomies/{taxonomyType}/{taxonomyId}/restore": {
    post: {
      tags: ["Admin Taxonomies"],
      summary: "Restore Taxonomy (Admin)",
      operationId: "restoreAdminTaxonomy",
      description:
        "Restores a taxonomy item by setting is_active to true. Safely avoids duplicate audits on identical-key replays.",
      security: [{ BearerAuth: [] }],
      parameters: [
        { $ref: "#/components/parameters/IdempotencyKey" },
        { $ref: "#/components/parameters/TaxonomyType" },
        { $ref: "#/components/parameters/TaxonomyId" },
      ],
      responses: {
        "200": {
          description: "Taxonomy restored",
          headers: { "X-Request-ID": { $ref: "#/components/headers/RequestId" } },
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["success", "data", "meta"],
                properties: {
                  success: { type: "boolean" },
                  message: { type: "string" },
                  data: { $ref: "#/components/schemas/AdminTaxonomyRow" },
                  meta: { $ref: "#/components/schemas/ApiMeta" },
                },
                example: {
                  success: true,
                  data: {
                    id: "00000000-0000-4000-8000-000000000010",
                    slug: "frontend",
                    name: "Frontend",
                    description: "Frontend questions",
                    displayOrder: 1,
                    isActive: true,
                    createdAt: "2024-01-01T00:00:00.000Z",
                    updatedAt: "2024-01-01T00:00:00.000Z",
                  },
                  meta: { requestId: "req-1234" },
                },
              },
            },
          },
        },
        "400": { $ref: "#/components/responses/QuestionValidationError" },
        "401": { $ref: "#/components/responses/QuestionAuthRequired" },
        "403": { $ref: "#/components/responses/QuestionForbidden" },
        "409": { $ref: "#/components/responses/QuestionConflict" },
        "503": { $ref: "#/components/responses/IdempotencyServiceUnavailableError" },
      },
    },
  },
};
