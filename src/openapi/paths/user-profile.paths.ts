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
  },
};
