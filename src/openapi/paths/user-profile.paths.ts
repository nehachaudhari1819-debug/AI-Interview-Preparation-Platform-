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
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: {
                    type: "object",
                    properties: {
                      user: {
                        $ref: "#/components/schemas/UserProfileResponse",
                      },
                    },
                    required: ["user"],
                  },
                },
              },
            },
          },
        },
        "401": {
          description: "Authentication is missing or invalid.",
        },
        "403": {
          description: "The user account is inactive or pending deletion.",
        },
        "404": {
          description: "The user profile could not be found.",
        },
        "429": {
          description: "Rate limit exceeded.",
        },
        "500": {
          description: "Internal server error.",
        },
        "503": {
          description: "Service unavailable (e.g., persistence layer unreachable).",
        },
      },
    },
  },
};
