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
  UpdateUserProfileRequest: {
    type: "object",
    description: "Request body for updating the current user profile. Accepts partial updates.",
    additionalProperties: false,
    minProperties: 1,
    properties: {
      fullName: {
        type: "string",
        minLength: 1,
        maxLength: 100,
        description: "The full name of the user.",
      },
      college: {
        type: "string",
        maxLength: 150,
        nullable: true,
      },
      branch: {
        type: "string",
        maxLength: 100,
        nullable: true,
      },
      graduationYear: {
        type: "integer",
        minimum: 2000,
        maximum: 2100,
        nullable: true,
      },
      experienceLevel: {
        type: "string",
        enum: ["fresher", "beginner", "intermediate", "advanced"],
        nullable: true,
      },
      preferredRoles: {
        type: "array",
        items: {
          type: "string",
          minLength: 1,
          maxLength: 50,
        },
        maxItems: 10,
        nullable: true,
      },
      bio: {
        type: "string",
        maxLength: 500,
        nullable: true,
      },
      avatarUrl: {
        type: "string",
        format: "uri",
        maxLength: 2048,
        description: "Must be a valid HTTPS URL.",
        nullable: true,
      },
    },
  },
};
