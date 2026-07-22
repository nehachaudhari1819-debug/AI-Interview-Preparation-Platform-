import type { SchemaObject, ResponseObject } from "../openapi.types.js";

const registerRequestSchema: SchemaObject = {
  type: "object",
  required: ["email", "password"],
  properties: {
    email: {
      type: "string",
      format: "email",
      description: "User's email address.",
      example: "user@example.com",
    },
    password: {
      type: "string",
      format: "password",
      description: "User's password (must be at least 8 characters).",
      example: "ExamplePass123!",
    },
  },
};

const loginRequestSchema: SchemaObject = {
  type: "object",
  required: ["email", "password"],
  properties: {
    email: {
      type: "string",
      format: "email",
      description: "User's email address.",
      example: "user@example.com",
    },
    password: {
      type: "string",
      format: "password",
      description: "User's password.",
      example: "ExamplePass123!",
    },
  },
};

const safeAuthUserSchema: SchemaObject = {
  type: "object",
  required: ["id", "isAnonymous"],
  properties: {
    id: {
      type: "string",
      format: "uuid",
      description: "User's unique identifier.",
      example: "11111111-2222-3333-4444-555555555555",
    },
    email: {
      type: "string",
      format: "email",
      description: "User's email address (if present).",
      example: "user@example.com",
    },
    emailConfirmedAt: {
      type: "string",
      format: "date-time",
      description: "When the email was confirmed.",
    },
    isAnonymous: {
      type: "boolean",
      description: "Whether the user is an anonymous guest.",
      example: false,
    },
  },
};

const authenticatedSessionResponseSchema: SchemaObject = {
  type: "object",
  required: ["status", "accessToken", "tokenType", "expiresIn", "expiresAt", "user"],
  properties: {
    status: {
      type: "string",
      enum: ["authenticated"],
      example: "authenticated",
    },
    accessToken: {
      type: "string",
      description: "JWT Access Token for Bearer authentication.",
      example: "example-access-token",
    },
    tokenType: {
      type: "string",
      enum: ["Bearer"],
      example: "Bearer",
    },
    expiresIn: {
      type: "integer",
      description: "Seconds until the access token expires.",
      example: 3600,
    },
    expiresAt: {
      type: "integer",
      description: "UTC epoch seconds when the token expires.",
      example: 1700000000,
    },
    user: {
      $ref: "#/components/schemas/SafeAuthUser",
    },
  },
};

const registrationPendingResponseSchema: SchemaObject = {
  type: "object",
  required: ["status", "message"],
  properties: {
    status: {
      type: "string",
      enum: ["verification_required"],
      example: "verification_required",
    },
    message: {
      type: "string",
      example: "Check your email to continue registration.",
    },
  },
};

const registrationResultSchema: SchemaObject = {
  oneOf: [
    { $ref: "#/components/schemas/AuthenticatedSessionResponse" },
    { $ref: "#/components/schemas/RegistrationPendingResponse" },
  ],
};

const emptySuccessResponseSchema: SchemaObject = {
  type: "object",
  description: "An empty success response object.",
};

export const authSchemas: Record<string, SchemaObject> = {
  RegisterRequest: registerRequestSchema,
  LoginRequest: loginRequestSchema,
  SafeAuthUser: safeAuthUserSchema,
  AuthenticatedSessionResponse: authenticatedSessionResponseSchema,
  RegistrationPendingResponse: registrationPendingResponseSchema,
  RegistrationResult: registrationResultSchema,
  EmptySuccessResponse: emptySuccessResponseSchema,
};

export const authResponses: Record<string, ResponseObject> = {
  RegistrationSuccess: {
    description: "Successful registration. May return a session or pending verification.",
    headers: {
      "X-Request-ID": { $ref: "#/components/headers/RequestId" },
      "Set-Cookie": {
        description: "The HttpOnly refresh session cookie, if authenticated.",
        schema: { type: "string" },
      },
    },
    content: {
      "application/json": {
        schema: {
          type: "object",
          required: ["success", "data", "meta"],
          properties: {
            success: { type: "boolean", enum: [true], example: true },
            data: { $ref: "#/components/schemas/RegistrationResult" },
            meta: { $ref: "#/components/schemas/ApiMeta" },
          },
        },
      },
    },
  },
  LoginSuccess: {
    description: "Successful login. Returns an authenticated session.",
    headers: {
      "X-Request-ID": { $ref: "#/components/headers/RequestId" },
      "Set-Cookie": {
        description: "The HttpOnly refresh session cookie.",
        schema: { type: "string" },
      },
    },
    content: {
      "application/json": {
        schema: {
          type: "object",
          required: ["success", "data", "meta"],
          properties: {
            success: { type: "boolean", enum: [true], example: true },
            data: { $ref: "#/components/schemas/AuthenticatedSessionResponse" },
            meta: { $ref: "#/components/schemas/ApiMeta" },
          },
        },
      },
    },
  },
  LogoutSuccess: {
    description: "Successfully logged out. Clears the refresh cookie.",
    headers: {
      "X-Request-ID": { $ref: "#/components/headers/RequestId" },
      "Set-Cookie": {
        description: "Clears the auth_session cookie.",
        schema: { type: "string" },
      },
    },
    content: {
      "application/json": {
        schema: {
          type: "object",
          required: ["success", "data", "meta"],
          properties: {
            success: { type: "boolean", enum: [true], example: true },
            data: { $ref: "#/components/schemas/EmptySuccessResponse" },
            meta: { $ref: "#/components/schemas/ApiMeta" },
          },
        },
      },
    },
  },
  MeSuccess: {
    description: "Successfully retrieved the current user.",
    headers: {
      "X-Request-ID": { $ref: "#/components/headers/RequestId" },
    },
    content: {
      "application/json": {
        schema: {
          type: "object",
          required: ["success", "data", "meta"],
          properties: {
            success: { type: "boolean", enum: [true], example: true },
            data: { $ref: "#/components/schemas/SafeAuthUser" },
            meta: { $ref: "#/components/schemas/ApiMeta" },
          },
        },
      },
    },
  },
};
