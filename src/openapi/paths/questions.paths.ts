import type { PathsObject } from "../openapi.types.js";

export const questionPaths: PathsObject = {
  "/api/v1/questions": {
    get: {
      tags: ["Student Questions"],
      summary: "List Published Questions",
      operationId: "listPublishedQuestions",
      description:
        "Returns a paginated list of published questions with optional filtering and sorting.",
      security: [{ BearerAuth: [] }],
      parameters: [
        { $ref: "#/components/parameters/QueryPage" },
        { $ref: "#/components/parameters/QueryLimit" },
        { $ref: "#/components/parameters/QuerySearch" },
        { $ref: "#/components/parameters/StudentQuerySortBy" },
        { $ref: "#/components/parameters/QuerySortDir" },
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
                required: ["success", "data", "meta", "pagination"],
                properties: {
                  success: { type: "boolean" },
                  message: { type: "string" },
                  data: {
                    type: "array",
                    items: { $ref: "#/components/schemas/QuestionSummary" },
                  },
                  meta: { $ref: "#/components/schemas/ApiMeta" },
                  pagination: {
                    type: "object",
                    required: [
                      "page",
                      "limit",
                      "totalItems",
                      "totalPages",
                      "hasNextPage",
                      "hasPreviousPage",
                    ],
                    properties: {
                      page: { type: "integer" },
                      limit: { type: "integer" },
                      totalItems: { type: "integer" },
                      totalPages: { type: "integer" },
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
                      createdAt: "2024-01-01T00:00:00.000Z",
                      updatedAt: "2024-01-01T00:00:00.000Z",
                    },
                  ],
                  meta: { requestId: "req-1234" },
                  pagination: {
                    page: 1,
                    limit: 20,
                    totalItems: 1,
                    totalPages: 1,
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
      },
    },
  },
  "/api/v1/questions/{questionId}": {
    get: {
      tags: ["Student Questions"],
      summary: "Get Published Question Details",
      operationId: "getPublishedQuestion",
      description: "Returns the details of a specific published question.",
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
                  data: { $ref: "#/components/schemas/QuestionSummary" },
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
        "404": { $ref: "#/components/responses/QuestionNotFound" },
      },
    },
  },
  "/api/v1/questions/categories": {
    get: {
      tags: ["Student Questions"],
      summary: "Get Categories",
      operationId: "listCategories",
      description: "Returns active category taxonomy items.",
      security: [{ BearerAuth: [] }],
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
                    items: { $ref: "#/components/schemas/TaxonomyResponse" },
                  },
                  meta: { $ref: "#/components/schemas/ApiMeta" },
                },
                example: {
                  success: true,
                  data: [
                    {
                      id: "00000000-0000-4000-8000-000000000010",
                      slug: "frontend",
                      name: "Frontend Development",
                      description: "Frontend questions",
                      displayOrder: 1,
                      isActive: true,
                    },
                  ],
                  meta: { requestId: "req-1234" },
                },
              },
            },
          },
        },
        "400": { $ref: "#/components/responses/QuestionValidationError" },
        "401": { $ref: "#/components/responses/QuestionAuthRequired" },
      },
    },
  },
  "/api/v1/questions/difficulties": {
    get: {
      tags: ["Student Questions"],
      summary: "Get Difficulties",
      operationId: "listDifficulties",
      description: "Returns active difficulty taxonomy items.",
      security: [{ BearerAuth: [] }],
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
                    items: { $ref: "#/components/schemas/TaxonomyResponse" },
                  },
                  meta: { $ref: "#/components/schemas/ApiMeta" },
                },
                example: {
                  success: true,
                  data: [
                    {
                      id: "00000000-0000-4000-8000-000000000011",
                      slug: "medium",
                      name: "Medium",
                      description: "Medium difficulty",
                      displayOrder: 2,
                      isActive: true,
                    },
                  ],
                  meta: { requestId: "req-1234" },
                },
              },
            },
          },
        },
        "400": { $ref: "#/components/responses/QuestionValidationError" },
        "401": { $ref: "#/components/responses/QuestionAuthRequired" },
      },
    },
  },
  "/api/v1/questions/interview-types": {
    get: {
      tags: ["Student Questions"],
      summary: "Get Interview Types",
      operationId: "listInterviewTypes",
      description: "Returns active interview type taxonomy items.",
      security: [{ BearerAuth: [] }],
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
                    items: { $ref: "#/components/schemas/TaxonomyResponse" },
                  },
                  meta: { $ref: "#/components/schemas/ApiMeta" },
                },
                example: {
                  success: true,
                  data: [
                    {
                      id: "00000000-0000-4000-8000-000000000012",
                      slug: "technical",
                      name: "Technical",
                      description: "Technical interview",
                      displayOrder: 1,
                      isActive: true,
                    },
                  ],
                  meta: { requestId: "req-1234" },
                },
              },
            },
          },
        },
        "400": { $ref: "#/components/responses/QuestionValidationError" },
        "401": { $ref: "#/components/responses/QuestionAuthRequired" },
      },
    },
  },
  "/api/v1/questions/skills": {
    get: {
      tags: ["Student Questions"],
      summary: "Get Skills",
      operationId: "listSkills",
      description: "Returns active skill taxonomy items.",
      security: [{ BearerAuth: [] }],
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
                    items: { $ref: "#/components/schemas/TaxonomyResponse" },
                  },
                  meta: { $ref: "#/components/schemas/ApiMeta" },
                },
                example: {
                  success: true,
                  data: [
                    {
                      id: "00000000-0000-4000-8000-000000000013",
                      slug: "javascript",
                      name: "JavaScript",
                      description: "JS questions",
                      displayOrder: 1,
                      isActive: true,
                    },
                  ],
                  meta: { requestId: "req-1234" },
                },
              },
            },
          },
        },
        "400": { $ref: "#/components/responses/QuestionValidationError" },
        "401": { $ref: "#/components/responses/QuestionAuthRequired" },
      },
    },
  },
  "/api/v1/questions/topics": {
    get: {
      tags: ["Student Questions"],
      summary: "Get Topics",
      operationId: "listTopics",
      description: "Returns active topic taxonomy items.",
      security: [{ BearerAuth: [] }],
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
                    items: { $ref: "#/components/schemas/TaxonomyResponse" },
                  },
                  meta: { $ref: "#/components/schemas/ApiMeta" },
                },
                example: {
                  success: true,
                  data: [
                    {
                      id: "00000000-0000-4000-8000-000000000014",
                      slug: "async-await",
                      name: "Async Await",
                      description: "Async/Await questions",
                      displayOrder: 1,
                      isActive: true,
                    },
                  ],
                  meta: { requestId: "req-1234" },
                },
              },
            },
          },
        },
        "400": { $ref: "#/components/responses/QuestionValidationError" },
        "401": { $ref: "#/components/responses/QuestionAuthRequired" },
      },
    },
  },
};
