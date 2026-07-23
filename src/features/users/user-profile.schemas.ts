import { z } from "zod";
import {
  normalizeOptionalString,
  normalizePreferredRoles,
  normalizeRequiredString,
} from "./user-profile.normalizers.js";

/**
 * Valid Experience Levels
 */
const ExperienceLevelSchema = z.enum(["fresher", "beginner", "intermediate", "advanced"]);

/**
 * Valid Roles (Database Supported)
 */
const RoleSchema = z.enum(["student", "admin"]);

/**
 * Valid Account Statuses (Database Supported)
 */
const AccountStatusSchema = z.enum(["active", "suspended", "deletion_pending", "deleted"]);

/**
 * Schema for validating an internal mapped domain profile.
 * Represents the canonical truth of a UserProfile.
 */
export const UserProfileSchema = z.object({
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  id: z.string().uuid(),
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  email: z.string().email(),
  fullName: z.string().min(1).max(100),
  college: z.string().max(150).nullable(),
  branch: z.string().max(100).nullable(),
  graduationYear: z.number().int().min(2000).max(2100).nullable(),
  experienceLevel: ExperienceLevelSchema.nullable(),
  preferredRoles: z.array(z.string().min(1).max(50)).max(10),
  bio: z.string().max(500).nullable(),
  avatarUrl: z
    .string()
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    .url()
    .max(2048)
    .refine((url) => url.startsWith("https://"), {
      message: "Avatar URL must use HTTPS",
    })
    .nullable(),
  role: RoleSchema,

  accountStatus: AccountStatusSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
});

/**
 * Schema for validating and normalizing editable input.
 * Strict: rejects unknown fields.
 */
export const UpdateUserProfileInputSchema = z
  .object({
    fullName: z
      .string()
      .transform(normalizeRequiredString)
      .refine((val) => val.length >= 1, { message: "String must contain at least 1 character(s)" })
      .refine((val) => val.length <= 100, {
        message: "String must contain at most 100 character(s)",
      })
      .optional(),
    college: z
      .string()
      .nullable()
      .transform(normalizeOptionalString)
      .refine((val) => val === null || val.length <= 150, {
        message: "String must contain at most 150 character(s)",
      })
      .optional(),
    branch: z
      .string()
      .nullable()
      .transform(normalizeOptionalString)
      .refine((val) => val === null || val.length <= 100, {
        message: "String must contain at most 100 character(s)",
      })
      .optional(),
    graduationYear: z.number().int().min(2000).max(2100).nullable().optional(),
    experienceLevel: ExperienceLevelSchema.nullable().optional(),
    preferredRoles: z
      .array(z.string())
      .nullable()
      .transform(normalizePreferredRoles)
      .pipe(z.array(z.string().min(1).max(50)).max(10))
      .optional(),
    bio: z
      .string()
      .nullable()
      .transform(normalizeOptionalString)
      .refine((val) => val === null || val.length <= 500, {
        message: "String must contain at most 500 character(s)",
      })
      .optional(),
    avatarUrl: z
      .string()
      .nullable()
      .transform(normalizeOptionalString)
      .pipe(
        z
          .string()
          // eslint-disable-next-line @typescript-eslint/no-deprecated
          .url()
          .max(2048)
          .refine((url) => url.startsWith("https://"), {
            message: "Avatar URL must use HTTPS",
          })
          .nullable(),
      )
      .optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one approved editable field must be present",
  });
