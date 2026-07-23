import type { Database } from "../database.types.js";
import {
  UserProfileSchema,
  type UserProfile,
  type UpdateUserProfileInput,
} from "../../features/users/index.js";
import { PersistenceError, PersistenceErrorCode } from "../persistence-error.js";

/**
 * Parses an ISO string or Date into a valid Date object.
 * Returns null if invalid or missing, to be caught by validation if required.
 */
function parseDateSafely(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

export function mapUserProfileRowToDomain(
  row: Database["public"]["Tables"]["users"]["Row"],
): UserProfile {
  // Explicitly map each field from the snake_case row to the camelCase domain format.
  // Avoid using `...row` spread to ensure no unexpected database columns leak into the domain.
  const profile = {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    college: row.college,
    branch: row.branch,
    graduationYear: row.graduation_year,
    experienceLevel: row.experience_level,
    preferredRoles: row.preferred_roles ?? [], // database null becomes empty array
    bio: row.bio,
    avatarUrl: row.avatar_url,
    role: row.role,
    accountStatus: row.account_status,
    createdAt: parseDateSafely(row.created_at),
    updatedAt: parseDateSafely(row.updated_at),
    deletedAt: row.deleted_at === null ? null : parseDateSafely(row.deleted_at),
  };

  const parsed = UserProfileSchema.safeParse(profile);
  if (!parsed.success) {
    throw new PersistenceError(
      PersistenceErrorCode.VALIDATION_FAILED,
      "Database returned an invalid user profile format",
    );
  }

  return parsed.data;
}

export function mapUserProfileUpdateToDatabase(
  updates: UpdateUserProfileInput,
): Database["public"]["Tables"]["users"]["Update"] {
  // Explicitly map editable fields only, avoiding spreading untrusted data.
  const dbUpdates: Database["public"]["Tables"]["users"]["Update"] = {};

  if (updates.fullName !== undefined) dbUpdates.full_name = updates.fullName;
  if (updates.college !== undefined) dbUpdates.college = updates.college;
  if (updates.branch !== undefined) dbUpdates.branch = updates.branch;
  if (updates.graduationYear !== undefined) dbUpdates.graduation_year = updates.graduationYear;
  if (updates.experienceLevel !== undefined) dbUpdates.experience_level = updates.experienceLevel;
  if (updates.preferredRoles !== undefined) dbUpdates.preferred_roles = updates.preferredRoles;
  if (updates.bio !== undefined) dbUpdates.bio = updates.bio;
  if (updates.avatarUrl !== undefined) dbUpdates.avatar_url = updates.avatarUrl;

  return dbUpdates;
}
