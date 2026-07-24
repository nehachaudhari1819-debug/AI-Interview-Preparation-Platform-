import type { PathItemObject } from "../openapi.types.js";

export const userProfilePaths: Record<string, PathItemObject> = {
  "/api/v1/users/me": {
    get: {
      tags: ["Users"],
      summary: "Get current user profile",
      description: "Retrieves the canonical profile of the currently authenticated active user.",
      security: [{ bearerAuth: [] }],
      responses: {
        "200": {
          description: "Successful response containing the user profile.",
          headers: {
            "Cache-Control": {
              description: "Directives for caching mechanisms in both requests and responses.",
              schema: {
                type: "string",
                example: "no-store, no-cache, must-revalidate, proxy-revalidate",
              },
            },
            "X-Request-ID": { $ref: "#/components/headers/RequestId" },
          },
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    type: "object",
                    properties: {
                      user: {
                        $ref: "#/components/schemas/UserProfileResponse",
                      },
                    },
                    required: ["user"],
                  },
                  meta: {
                    $ref: "#/components/schemas/ApiMeta",
                  },
                },
                required: ["success", "data", "meta"],
              },
            },
          },
        },
        "401": { $ref: "#/components/responses/Unauthorized" },
        "403": { $ref: "#/components/responses/Forbidden" },
        "404": { $ref: "#/components/responses/NotFound" },
        "429": { $ref: "#/components/responses/TooManyRequests" },
        "500": { $ref: "#/components/responses/InternalServerError" },
        "503": { $ref: "#/components/responses/ServiceUnavailable" },
      },
    },
    patch: {
      tags: ["Users"],
      summary: "Update current user profile",
      description:
        "Partially updates the authenticated user's profile. Rejects unknown or protected fields. Omitted fields remain unchanged.",
      security: [{ bearerAuth: [] }],
      requestBody: {
        description: "The partial profile data to update.",
        required: true,
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/UpdateUserProfileRequest",
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Successful response containing the updated user profile.",
          headers: {
            "Cache-Control": {
              description: "Directives for caching mechanisms in both requests and responses.",
              schema: {
                type: "string",
                example: "no-store, no-cache, must-revalidate, proxy-revalidate",
              },
            },
            "X-Request-ID": { $ref: "#/components/headers/RequestId" },
          },
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    type: "object",
                    properties: {
                      user: {
                        $ref: "#/components/schemas/UserProfileResponse",
                      },
                    },
                    required: ["user"],
                  },
                  meta: {
                    $ref: "#/components/schemas/ApiMeta",
                  },
                },
                required: ["success", "data", "meta"],
              },
            },
          },
        },
        "400": { $ref: "#/components/responses/BadRequest" },
        "401": { $ref: "#/components/responses/Unauthorized" },
        "403": { $ref: "#/components/responses/Forbidden" },
        "404": { $ref: "#/components/responses/NotFound" },
        "415": { $ref: "#/components/responses/UnsupportedMediaType" },
        "422": { $ref: "#/components/responses/ValidationError" },
        "429": { $ref: "#/components/responses/TooManyRequests" },
        "500": { $ref: "#/components/responses/InternalServerError" },
        "503": { $ref: "#/components/responses/ServiceUnavailable" },
      },
    },
    delete: {
      tags: ["Users", "Profile"],
      summary: "Deactivate and soft-delete current user account",
      description:
        "Soft-deletes the authenticated user's account, sets status to `deleted`, revokes active sessions, and clears the refresh cookie. " +
        "Existing access JWT may remain valid until expiration. Requires `Idempotency-Key` header.",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "Idempotency-Key",
          in: "header",
          required: true,
          description: "Unique key (max 255 chars) to prevent duplicate deactivation execution.",
          schema: {
            type: "string",
            minLength: 1,
            maxLength: 255,
          },
        },
      ],
      responses: {
        "200": {
          description: "Successful response confirming account deactivation/soft-deletion.",
          headers: {
            "Cache-Control": {
              description: "Directives for caching mechanisms in both requests and responses.",
              schema: {
                type: "string",
                example: "no-store, no-cache, must-revalidate, proxy-revalidate",
              },
            },
            "Set-Cookie": {
              description: "Sets expired refresh cookie to clear it.",
              schema: { type: "string" },
            },
            "X-Request-ID": { $ref: "#/components/headers/RequestId" },
          },
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    $ref: "#/components/schemas/AccountDeletionResponse",
                  },
                  meta: {
                    $ref: "#/components/schemas/ApiMeta",
                  },
                },
                required: ["success", "data", "meta"],
              },
            },
          },
        },
        "400": { $ref: "#/components/responses/BadRequest" },
        "401": { $ref: "#/components/responses/Unauthorized" },
        "403": { $ref: "#/components/responses/Forbidden" },
        "404": { $ref: "#/components/responses/NotFound" },
        "409": { $ref: "#/components/responses/Conflict" },
        "429": { $ref: "#/components/responses/TooManyRequests" },
        "500": { $ref: "#/components/responses/InternalServerError" },
        "503": { $ref: "#/components/responses/ServiceUnavailable" },
      },
    },
  },
};
