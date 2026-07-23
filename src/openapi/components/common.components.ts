import type { ComponentsObject, SchemaObject, ResponseObject } from "../openapi.types.js";

const apiMetaSchema: SchemaObject = {
  type: "object",
  required: ["requestId"],
  properties: {
    requestId: {
      type: "string",
      format: "uuid",
      description: "A unique identifier for the request, useful for tracing and debugging.",
      example: "00000000-0000-4000-8000-000000000000",
    },
  },
};

const apiFieldErrorSchema: SchemaObject = {
  type: "object",
  required: ["message"],
  properties: {
    field: {
      type: "string",
      description: "The name of the field that failed validation (if applicable).",
    },
    message: {
      type: "string",
      description: "A human-readable explanation of the validation error.",
    },
  },
};

const standardErrorResponseSchema: SchemaObject = {
  type: "object",
  required: ["success", "message", "code", "meta"],
  properties: {
    success: {
      type: "boolean",
      description: "Indicates that the request failed.",
      example: false,
    },
    message: {
      type: "string",
      description: "A human-readable error message.",
    },
    code: {
      type: "string",
      description: "A machine-readable error code string.",
    },
    errors: {
      type: "array",
      description: "Detailed validation errors, if applicable.",
      items: { $ref: "#/components/schemas/ApiFieldError" },
    },
    meta: {
      $ref: "#/components/schemas/ApiMeta",
    },
  },
};

export const commonSchemas: Record<string, SchemaObject> = {
  ApiMeta: apiMetaSchema,
  ApiFieldError: apiFieldErrorSchema,
  StandardErrorResponse: standardErrorResponseSchema,
};

export const commonResponses: Record<string, ResponseObject> = {
  BadRequest: {
    description: "Bad Request - The request was invalid or could not be served.",
    headers: {
      "X-Request-ID": { $ref: "#/components/headers/RequestId" },
    },
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/StandardErrorResponse" },
        example: {
          success: false,
          message: "Validation failed",
          code: "VALIDATION_ERROR",
          errors: [{ field: "email", message: "Invalid email address" }],
          meta: { requestId: "00000000-0000-4000-8000-000000000000" },
        },
      },
    },
  },
  Unauthorized: {
    description:
      "Unauthorized - Authentication is required and has failed or has not yet been provided.",
    headers: {
      "X-Request-ID": { $ref: "#/components/headers/RequestId" },
    },
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/StandardErrorResponse" },
        example: {
          success: false,
          message: "Unauthorized",
          code: "UNAUTHORIZED",
          meta: { requestId: "00000000-0000-4000-8000-000000000000" },
        },
      },
    },
  },
  Forbidden: {
    description:
      "Forbidden - The request was a valid request, but the server is refusing to respond to it. The user might be logged in but does not have the necessary permissions for the resource.",
    headers: {
      "X-Request-ID": { $ref: "#/components/headers/RequestId" },
    },
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/StandardErrorResponse" },
        example: {
          success: false,
          message: "Forbidden",
          code: "FORBIDDEN",
          meta: { requestId: "00000000-0000-4000-8000-000000000000" },
        },
      },
    },
  },
  NotFound: {
    description: "Not Found - The requested resource could not be found.",
    headers: {
      "X-Request-ID": { $ref: "#/components/headers/RequestId" },
    },
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/StandardErrorResponse" },
        example: {
          success: false,
          message: "Not found",
          code: "NOT_FOUND",
          meta: { requestId: "00000000-0000-4000-8000-000000000000" },
        },
      },
    },
  },
  Conflict: {
    description:
      "Conflict - The request could not be completed due to a conflict with the current state of the resource.",
    headers: {
      "X-Request-ID": { $ref: "#/components/headers/RequestId" },
    },
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/StandardErrorResponse" },
        example: {
          success: false,
          message: "Resource already exists",
          code: "CONFLICT",
          meta: { requestId: "00000000-0000-4000-8000-000000000000" },
        },
      },
    },
  },
  TooManyRequests: {
    description:
      "Too Many Requests - The user has sent too many requests in a given amount of time.",
    headers: {
      "X-Request-ID": { $ref: "#/components/headers/RequestId" },
      "Retry-After": {
        description: "The number of seconds to wait before making a new request.",
        schema: { type: "integer" },
      },
      "RateLimit-Limit": {
        description: "The maximum number of requests allowed in the current window.",
        schema: { type: "integer" },
      },
      "RateLimit-Remaining": {
        description: "The number of requests remaining in the current window.",
        schema: { type: "integer" },
      },
      "RateLimit-Reset": {
        description: "The time at which the current window resets, in UTC epoch seconds.",
        schema: { type: "integer" },
      },
    },
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/StandardErrorResponse" },
        example: {
          success: false,
          message: "Too many requests, please try again later.",
          code: "RATE_LIMIT_EXCEEDED",
          meta: { requestId: "00000000-0000-4000-8000-000000000000" },
        },
      },
    },
  },
  InternalServerError: {
    description:
      "Internal Server Error - The server encountered an unexpected condition that prevented it from fulfilling the request.",
    headers: {
      "X-Request-ID": { $ref: "#/components/headers/RequestId" },
    },
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/StandardErrorResponse" },
        example: {
          success: false,
          message: "An unexpected error occurred",
          code: "INTERNAL_SERVER_ERROR",
          meta: { requestId: "00000000-0000-4000-8000-000000000000" },
        },
      },
    },
  },
  ServiceUnavailable: {
    description:
      "Service Unavailable - The server is currently unable to handle the request due to a temporary overload or scheduled maintenance.",
    headers: {
      "X-Request-ID": { $ref: "#/components/headers/RequestId" },
      "Retry-After": {
        description: "The number of seconds to wait before making a new request.",
        schema: { type: "integer" },
      },
    },
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/StandardErrorResponse" },
        example: {
          success: false,
          message: "Service Unavailable",
          code: "SERVICE_UNAVAILABLE",
          meta: { requestId: "00000000-0000-4000-8000-000000000000" },
        },
      },
    },
  },
  UnsupportedMediaType: {
    description: "Unsupported Media Type - The request format is not supported (e.g. non-JSON payload).",
    headers: {
      "X-Request-ID": { $ref: "#/components/headers/RequestId" },
    },
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/StandardErrorResponse" },
        example: {
          success: false,
          message: "Unsupported Media Type",
          code: "UNSUPPORTED_MEDIA_TYPE",
          meta: { requestId: "00000000-0000-4000-8000-000000000000" },
        },
      },
    },
  },
  ValidationError: {
    description: "Unprocessable Entity - The request payload failed schema validation.",
    headers: {
      "X-Request-ID": { $ref: "#/components/headers/RequestId" },
    },
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/StandardErrorResponse" },
        example: {
          success: false,
          message: "Validation failed",
          code: "VALIDATION_ERROR",
          errors: [
            { field: "email", message: "Invalid email format" },
          ],
          meta: { requestId: "00000000-0000-4000-8000-000000000000" },
        },
      },
    },
  },
};

export const commonHeaders: ComponentsObject["headers"] = {
  RequestId: {
    description:
      "A unique identifier for the request, useful for tracing and debugging. Typically a UUID.",
    schema: {
      type: "string",
      format: "uuid",
    },
  },
};

export const commonSecuritySchemes: ComponentsObject["securitySchemes"] = {
  BearerAuth: {
    type: "http",
    scheme: "bearer",
    description: "Provide the JWT access token as a Bearer token in the Authorization header.",
  },
  CookieAuth: {
    type: "apiKey",
    in: "cookie",
    name: "auth_session",
    description: "The HttpOnly refresh session cookie used to obtain a new access token.",
  },
};
