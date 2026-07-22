import type { PathItemObject } from "../openapi.types.js";

export const authPaths: Record<string, PathItemObject> = {
  "/api/v1/auth/register": {
    post: {
      tags: ["Authentication"],
      summary: "Register a new user",
      description:
        "Registers a new user. Returns a session if auto-confirm is enabled, otherwise returns a pending verification status.",
      operationId: "registerUser",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/RegisterRequest" },
          },
        },
      },
      responses: {
        "200": { $ref: "#/components/responses/RegistrationSuccess" },
        "400": { $ref: "#/components/responses/BadRequest" },
        "409": { $ref: "#/components/responses/Conflict" },
        "429": { $ref: "#/components/responses/TooManyRequests" },
      },
    },
  },
  "/api/v1/auth/login": {
    post: {
      tags: ["Authentication"],
      summary: "Authenticate a user",
      description:
        "Authenticates a user with email and password, returning an access token and setting a secure HttpOnly refresh cookie.",
      operationId: "loginUser",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/LoginRequest" },
          },
        },
      },
      responses: {
        "200": { $ref: "#/components/responses/LoginSuccess" },
        "400": { $ref: "#/components/responses/BadRequest" },
        "401": { $ref: "#/components/responses/Unauthorized" },
        "429": { $ref: "#/components/responses/TooManyRequests" },
      },
    },
  },
  "/api/v1/auth/refresh": {
    post: {
      tags: ["Authentication"],
      summary: "Refresh session",
      description: "Exchanges a valid refresh cookie for a new access token.",
      operationId: "refreshSession",
      security: [{ CookieAuth: [] }],
      responses: {
        "200": { $ref: "#/components/responses/LoginSuccess" },
        "401": { $ref: "#/components/responses/Unauthorized" },
        "429": { $ref: "#/components/responses/TooManyRequests" },
      },
    },
  },
  "/api/v1/auth/logout": {
    post: {
      tags: ["Authentication"],
      summary: "Logout user",
      description: "Logs out the user and clears the session cookie.",
      operationId: "logoutUser",
      responses: {
        "200": { $ref: "#/components/responses/LogoutSuccess" },
      },
    },
  },
  "/api/v1/auth/me": {
    get: {
      tags: ["Authentication"],
      summary: "Get current user profile",
      description: "Retrieves the authenticated user's profile information.",
      operationId: "getCurrentUser",
      security: [{ BearerAuth: [] }],
      responses: {
        "200": { $ref: "#/components/responses/MeSuccess" },
        "401": { $ref: "#/components/responses/Unauthorized" },
      },
    },
  },
};
