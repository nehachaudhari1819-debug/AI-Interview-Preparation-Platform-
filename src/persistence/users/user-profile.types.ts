import { z } from "zod";

/**
 * Zod schema defining the domain boundaries of a User Profile.
 * Matches the public.users database schema.
 */
export const UserProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string().min(1).max(100),
  college: z.string().max(150).nullable(),
  branch: z.string().max(100).nullable(),
  graduationYear: z.number().int().min(2000).max(2100).nullable(),
  experienceLevel: z.enum(["fresher", "beginner", "intermediate", "advanced"]).nullable(),
  preferredRoles: z.array(z.string()).default([]),
  bio: z.string().max(500).nullable(),
  avatarUrl: z.string().url().nullable(),
  role: z.enum(["student", "admin"]),
  accountStatus: z.enum(["active", "suspended", "deletion_pending", "deleted"]),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;

/**
 * Fields that a user is allowed to update on their own profile
 */
export const UserProfileUpdateSchema = z.object({
  fullName: z.string().min(1).max(100).optional(),
  college: z.string().max(150).nullable().optional(),
  branch: z.string().max(100).nullable().optional(),
  graduationYear: z.number().int().min(2000).max(2100).nullable().optional(),
  experienceLevel: z
    .enum(["fresher", "beginner", "intermediate", "advanced"])
    .nullable()
    .optional(),
  preferredRoles: z.array(z.string()).optional(),
  bio: z.string().max(500).nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
});

export type UserProfileUpdate = z.infer<typeof UserProfileUpdateSchema>;
