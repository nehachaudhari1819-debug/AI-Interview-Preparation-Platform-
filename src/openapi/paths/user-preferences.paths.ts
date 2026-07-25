import type { PathItemObject } from "../openapi.types.js";

export const userPreferencesPaths: Record<string, PathItemObject> = {
  "/api/v1/users/me/preferences": {
    get: {
      tags: ["Users"],
      summary: "Get current user preferences",
      description:
        "Retrieves the canonical preferences of the currently authenticated active user.",
      security: [{ bearerAuth: [] }],
      responses: {
        "200": {
          description: "Successful response containing the user preferences.",
          headers: {
            "Cache-Control": {
              description: "Directives for caching mechanisms in both requests and responses.",
              schema: {
                type: "string",
                example: "no-store",
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
                    $ref: "#/components/schemas/UserPreferencesResponse",
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
      summary: "Update current user preferences",
      description:
        "Partially updates the authenticated user's preferences. Rejects unknown fields. Omitted fields remain unchanged.",
      security: [{ bearerAuth: [] }],
      requestBody: {
        description: "The partial preferences data to update.",
        required: true,
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/UpdateUserPreferencesRequest",
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Successful response containing the updated user preferences.",
          headers: {
            "Cache-Control": {
              description: "Directives for caching mechanisms in both requests and responses.",
              schema: {
                type: "string",
                example: "no-store",
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
                    $ref: "#/components/schemas/UserPreferencesResponse",
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
        "422": { $ref: "#/components/responses/ValidationError" },
        "429": { $ref: "#/components/responses/TooManyRequests" },
        "500": { $ref: "#/components/responses/InternalServerError" },
        "503": { $ref: "#/components/responses/ServiceUnavailable" },
      },
    },
  },
};
