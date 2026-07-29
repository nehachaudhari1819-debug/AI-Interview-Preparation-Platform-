import type { SchemaObject, ResponseObject, ParameterObject } from "../openapi.types.js";
import { ERROR_CODES } from "../../constants/error-codes.constants.js";

// ============================================================================
// Schemas
// ============================================================================

const questionSummarySchema: SchemaObject = {
  type: "object",
  required: [
    "id",
    "questionText",
    "categoryId",
    "difficultyId",
    "interviewTypeId",
    "skillIds",
    "topicIds",
    "createdAt",
    "updatedAt",
  ],
  properties: {
    id: { type: "string", format: "uuid" },
    questionText: { type: "string" },
    categoryId: { type: "string", format: "uuid" },
    difficultyId: { type: "string", format: "uuid" },
    interviewTypeId: { type: "string", format: "uuid" },
    skillIds: { type: "array", items: { type: "string", format: "uuid" } },
    topicIds: { type: "array", items: { type: "string", format: "uuid" } },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
};

const adminQuestionDetailSchema: SchemaObject = {
  type: "object",
  required: [
    "id",
    "questionText",
    "categoryId",
    "difficultyId",
    "interviewTypeId",
    "skillIds",
    "topicIds",
    "status",
    "publishedAt",
    "archivedAt",
    "createdAt",
    "updatedAt",
    "referenceAnswer",
    "evaluationGuidance",
  ],
  properties: {
    id: { type: "string", format: "uuid" },
    questionText: { type: "string" },
    categoryId: { type: "string", format: "uuid" },
    difficultyId: { type: "string", format: "uuid" },
    interviewTypeId: { type: "string", format: "uuid" },
    skillIds: { type: "array", items: { type: "string", format: "uuid" } },
    topicIds: { type: "array", items: { type: "string", format: "uuid" } },
    status: { type: "string", enum: ["draft", "published", "archived"] },
    publishedAt: { type: "string", format: "date-time", nullable: true },
    archivedAt: { type: "string", format: "date-time", nullable: true },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    referenceAnswer: { type: "string" },
    evaluationGuidance: { type: "object", additionalProperties: true },
  },
};

const taxonomyResponseSchema: SchemaObject = {
  type: "object",
  required: ["id", "slug", "name", "description", "displayOrder", "isActive"],
  properties: {
    id: { type: "string", format: "uuid" },
    slug: { type: "string" },
    name: { type: "string" },
    description: { type: "string", nullable: true },
    displayOrder: { type: "integer" },
    isActive: { type: "boolean" },
  },
};

const adminTaxonomyRowSchema: SchemaObject = {
  type: "object",
  required: [
    "id",
    "slug",
    "name",
    "description",
    "display_order",
    "is_active",
    "created_at",
    "updated_at",
  ],
  properties: {
    id: { type: "string", format: "uuid" },
    slug: { type: "string" },
    name: { type: "string" },
    description: { type: "string", nullable: true },
    display_order: { type: "integer" },
    is_active: { type: "boolean" },
    created_at: { type: "string", format: "date-time" },
    updated_at: { type: "string", format: "date-time" },
  },
};

const createQuestionBodySchema: SchemaObject = {
  type: "object",
  required: [
    "questionText",
    "categoryId",
    "difficultyId",
    "interviewTypeId",
    "skillIds",
    "referenceAnswer",
  ],
  additionalProperties: false,
  properties: {
    questionText: { type: "string", minLength: 5, maxLength: 2000 },
    categoryId: { type: "string", format: "uuid" },
    difficultyId: { type: "string", format: "uuid" },
    interviewTypeId: { type: "string", format: "uuid" },
    skillIds: {
      type: "array",
      items: { type: "string", format: "uuid" },
      minItems: 1,
      maxItems: 10,
    },
    topicIds: {
      type: "array",
      items: { type: "string", format: "uuid" },
      maxItems: 10,
      default: [],
    },
    referenceAnswer: { type: "string", minLength: 5, maxLength: 5000 },
    evaluationGuidance: { type: "object", additionalProperties: true, default: {} },
  },
};

const updateQuestionBodySchema: SchemaObject = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    questionText: { type: "string", minLength: 5, maxLength: 2000 },
    categoryId: { type: "string", format: "uuid" },
    difficultyId: { type: "string", format: "uuid" },
    interviewTypeId: { type: "string", format: "uuid" },
    skillIds: {
      type: "array",
      items: { type: "string", format: "uuid" },
      minItems: 1,
      maxItems: 10,
    },
    topicIds: {
      type: "array",
      items: { type: "string", format: "uuid" },
      maxItems: 10,
      default: [],
    },
    referenceAnswer: { type: "string", minLength: 5, maxLength: 5000 },
    evaluationGuidance: { type: "object", additionalProperties: true, default: {} },
  },
};

const createTaxonomyBodySchema: SchemaObject = {
  type: "object",
  required: ["slug", "name"],
  additionalProperties: false,
  properties: {
    slug: { type: "string", minLength: 1, maxLength: 100 },
    name: { type: "string", minLength: 1, maxLength: 100 },
    description: { type: "string", maxLength: 500, nullable: true, default: null },
    displayOrder: { type: "integer", default: 0 },
    isActive: { type: "boolean", default: true },
  },
};

const updateTaxonomyBodySchema: SchemaObject = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    slug: { type: "string", minLength: 1, maxLength: 100 },
    name: { type: "string", minLength: 1, maxLength: 100 },
    description: { type: "string", maxLength: 500, nullable: true, default: null },
    displayOrder: { type: "integer", default: 0 },
    isActive: { type: "boolean", default: true },
  },
};

// ============================================================================
// Parameters
// ============================================================================

export const questionParameters: Record<string, ParameterObject> = {
  IdempotencyKey: {
    name: "Idempotency-Key",
    in: "header",
    required: true,
    description:
      "Stable uniqueness key to prevent duplicate mutations. Max 255 chars. Cannot be empty or contain control characters.",
    schema: { type: "string", maxLength: 255, minLength: 1 },
  },
  QuestionId: {
    name: "questionId",
    in: "path",
    required: true,
    description: "UUID of the question",
    schema: { type: "string", format: "uuid" },
  },
  TaxonomyType: {
    name: "taxonomyType",
    in: "path",
    required: true,
    description: "The type of taxonomy",
    schema: {
      type: "string",
      enum: ["categories", "difficulties", "interview-types", "skills", "topics"],
    },
  },
  TaxonomyId: {
    name: "taxonomyId",
    in: "path",
    required: true,
    description: "UUID of the taxonomy entry (uses questionId format under the hood)",
    schema: { type: "string", format: "uuid" },
  },
  // Pagination & Filtering
  QueryPage: {
    name: "page",
    in: "query",
    description: "Page number",
    schema: { type: "integer", minimum: 1, default: 1 },
  },
  QueryLimit: {
    name: "limit",
    in: "query",
    description: "Results per page",
    schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
  },
  QuerySearch: {
    name: "search",
    in: "query",
    description: "Full text search query. Min 3, max 100 chars.",
    schema: { type: "string", minLength: 3, maxLength: 100 },
  },
  QuerySortDir: {
    name: "sortDir",
    in: "query",
    schema: { type: "string", enum: ["asc", "desc"], default: "desc" },
  },
  StudentQuerySortBy: {
    name: "sortBy",
    in: "query",
    schema: { type: "string", enum: ["createdAt", "updatedAt"], default: "createdAt" },
  },
  AdminQuerySortBy: {
    name: "sortBy",
    in: "query",
    schema: {
      type: "string",
      enum: ["createdAt", "updatedAt", "publishedAt"],
      default: "createdAt",
    },
  },
  AdminQueryStatus: {
    name: "status",
    in: "query",
    description: "Filter by question statuses (comma separated or multiple). Max 3.",
    schema: {
      type: "array",
      items: { type: "string", enum: ["draft", "published", "archived"] },
      maxItems: 3,
    },
  },
  QueryCategoryId: {
    name: "categoryId",
    in: "query",
    schema: { type: "array", items: { type: "string", format: "uuid" }, maxItems: 10 },
  },
  QueryDifficultyId: {
    name: "difficultyId",
    in: "query",
    schema: { type: "array", items: { type: "string", format: "uuid" }, maxItems: 10 },
  },
  QueryInterviewTypeId: {
    name: "interviewTypeId",
    in: "query",
    schema: { type: "array", items: { type: "string", format: "uuid" }, maxItems: 10 },
  },
  QuerySkillId: {
    name: "skillId",
    in: "query",
    schema: { type: "array", items: { type: "string", format: "uuid" }, maxItems: 10 },
  },
  QueryTopicId: {
    name: "topicId",
    in: "query",
    schema: { type: "array", items: { type: "string", format: "uuid" }, maxItems: 10 },
  },
};

// ============================================================================
// Responses
// ============================================================================

export const questionResponses: Record<string, ResponseObject> = {
  QuestionAuthRequired: {
    description: "Authentication is required.",
    headers: { "X-Request-ID": { $ref: "#/components/headers/RequestId" } },
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/StandardErrorResponse" },
        example: {
          success: false,
          message: "Authentication required",
          code: ERROR_CODES.AUTHENTICATION_REQUIRED,
          meta: { requestId: "00000000-0000-4000-8000-000000000000" },
        },
      },
    },
  },
  QuestionForbidden: {
    description: "Access is forbidden. Requires Admin role.",
    headers: { "X-Request-ID": { $ref: "#/components/headers/RequestId" } },
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/StandardErrorResponse" },
        example: {
          success: false,
          message: "Forbidden access",
          code: ERROR_CODES.FORBIDDEN_ACCESS,
          meta: { requestId: "00000000-0000-4000-8000-000000000000" },
        },
      },
    },
  },
  QuestionNotFound: {
    description: "The requested question or resource was not found.",
    headers: { "X-Request-ID": { $ref: "#/components/headers/RequestId" } },
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/StandardErrorResponse" },
        example: {
          success: false,
          message: "Resource not found",
          code: ERROR_CODES.RESOURCE_NOT_FOUND,
          meta: { requestId: "00000000-0000-4000-8000-000000000000" },
        },
      },
    },
  },
  QuestionValidationError: {
    description: "Validation error (e.g. invalid request body or missing idempotency key).",
    headers: { "X-Request-ID": { $ref: "#/components/headers/RequestId" } },
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/StandardErrorResponse" },
        examples: {
          ValidationError: {
            value: {
              success: false,
              message: "Validation failed.",
              code: ERROR_CODES.VALIDATION_ERROR,
              meta: { requestId: "00000000-0000-4000-8000-000000000000" },
            },
          },
          IdempotencyKeyRequired: {
            value: {
              success: false,
              message: "Idempotency-Key header is required.",
              code: "IDEMPOTENCY_KEY_REQUIRED",
              meta: { requestId: "00000000-0000-4000-8000-000000000000" },
            },
          },
          IdempotencyKeyInvalid: {
            value: {
              success: false,
              message: "Invalid Idempotency-Key header format.",
              code: "IDEMPOTENCY_KEY_INVALID",
              meta: { requestId: "00000000-0000-4000-8000-000000000000" },
            },
          },
        },
      },
    },
  },
  QuestionConflict: {
    description:
      "Resource conflict (e.g. concurrent state modification, duplicate, or idempotency conflict).",
    headers: { "X-Request-ID": { $ref: "#/components/headers/RequestId" } },
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/StandardErrorResponse" },
        examples: {
          ResourceConflict: {
            value: {
              success: false,
              message: "Resource conflict",
              code: ERROR_CODES.RESOURCE_CONFLICT,
              meta: { requestId: "00000000-0000-4000-8000-000000000000" },
            },
          },
          IdempotencyConflict: {
            value: {
              success: false,
              message: "Idempotency key already exists with different request parameters.",
              code: "IDEMPOTENCY_CONFLICT",
              meta: { requestId: "00000000-0000-4000-8000-000000000000" },
            },
          },
          IdempotencyInProgress: {
            value: {
              success: false,
              message: "A request with this Idempotency-Key is currently in progress.",
              code: "IDEMPOTENCY_IN_PROGRESS",
              meta: { requestId: "00000000-0000-4000-8000-000000000000" },
            },
          },
        },
      },
    },
  },
  IdempotencyServiceUnavailableError: {
    description: "Idempotency service is currently unavailable.",
    headers: { "X-Request-ID": { $ref: "#/components/headers/RequestId" } },
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/StandardErrorResponse" },
        example: {
          success: false,
          message: "Idempotency service is currently unavailable.",
          code: "IDEMPOTENCY_SERVICE_UNAVAILABLE",
          meta: { requestId: "00000000-0000-4000-8000-000000000000" },
        },
      },
    },
  },
};

export const questionSchemas: Record<string, SchemaObject> = {
  QuestionSummary: questionSummarySchema,
  AdminQuestionDetail: adminQuestionDetailSchema,
  TaxonomyResponse: taxonomyResponseSchema,
  AdminTaxonomyRow: adminTaxonomyRowSchema,
  CreateQuestionBody: createQuestionBodySchema,
  UpdateQuestionBody: updateQuestionBodySchema,
  CreateTaxonomyBody: createTaxonomyBodySchema,
  UpdateTaxonomyBody: updateTaxonomyBodySchema,
};
