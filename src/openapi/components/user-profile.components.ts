import type { SchemaObject } from "../openapi.types.js";

export const userProfileSchemas: Record<string, SchemaObject> = {
  UserProfileResponse: {
    type: "object",
    description: "The safe public API representation of a user profile.",
    required: [
      "id",
      "email",
      "fullName",
      "college",
      "branch",
      "graduationYear",
      "experienceLevel",
      "preferredRoles",
      "bio",
      "avatarUrl",
      "role",
      "accountStatus",
      "createdAt",
      "updatedAt",
    ],
    properties: {
      id: { type: "string", format: "uuid" },
      email: { type: "string", format: "email" },
      fullName: { type: "string" },
      college: { type: "string", nullable: true },
      branch: { type: "string", nullable: true },
      graduationYear: { type: "integer", nullable: true },
      experienceLevel: {
        type: "string",
        enum: ["fresher", "beginner", "intermediate", "advanced"],
        nullable: true,
      },
      preferredRoles: {
        type: "array",
        items: { type: "string" },
      },
      bio: { type: "string", nullable: true },
      avatarUrl: { type: "string", format: "uri", nullable: true },
      role: { type: "string", enum: ["student", "admin"] },
      accountStatus: {
        type: "string",
        enum: ["active", "suspended", "deletion_pending", "deleted"],
      },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },
};
