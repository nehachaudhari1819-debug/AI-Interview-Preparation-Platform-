import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types.js";
import { PersistenceError, PersistenceErrorCode } from "../persistence-error.js";
import type { UserProfileRepository } from "./user-profile.repository.js";
import { UserProfileSchema } from "./user-profile.types.js";
import type { UserProfile, UserProfileUpdate } from "./user-profile.types.js";

export class SupabaseUserProfileRepository implements UserProfileRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  private mapDatabaseRowToDomain(row: Database["public"]["Tables"]["users"]["Row"]): UserProfile {
    // Parse the date strings into JavaScript Date objects
    const profile = {
      ...row,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
      fullName: row.full_name,
      graduationYear: row.graduation_year,
      experienceLevel: row.experience_level,
      preferredRoles: row.preferred_roles ?? [],
      avatarUrl: row.avatar_url,
      accountStatus: row.account_status,
    };

    const parsed = UserProfileSchema.safeParse(profile);
    if (!parsed.success) {
      throw new PersistenceError(
        PersistenceErrorCode.VALIDATION_FAILED,
        "Database returned an invalid user profile format",
        parsed.error,
      );
    }

    return parsed.data;
  }

  async findById(id: string): Promise<UserProfile> {
    const { data, error } = await this.supabase
      .from("users")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error !== null) {
      throw new PersistenceError(
        PersistenceErrorCode.OPERATION_FAILED,
        "Failed to query user profile",
        error,
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!data) {
      throw new PersistenceError(
        PersistenceErrorCode.RECORD_NOT_FOUND,
        `User profile not found for id: ${id}`,
      );
    }

    return this.mapDatabaseRowToDomain(data);
  }

  async updateOwnProfile(id: string, updates: UserProfileUpdate): Promise<UserProfile> {
    // Map domain fields to DB schema fields
    const dbUpdates: Database["public"]["Tables"]["users"]["Update"] = {
      ...(updates.fullName !== undefined && { full_name: updates.fullName }),
      ...(updates.college !== undefined && { college: updates.college }),
      ...(updates.branch !== undefined && { branch: updates.branch }),
      ...(updates.graduationYear !== undefined && {
        graduation_year: updates.graduationYear,
      }),
      ...(updates.experienceLevel !== undefined && {
        experience_level: updates.experienceLevel,
      }),
      ...(updates.preferredRoles !== undefined && {
        preferred_roles: updates.preferredRoles,
      }),
      ...(updates.bio !== undefined && { bio: updates.bio }),
      ...(updates.avatarUrl !== undefined && { avatar_url: updates.avatarUrl }),
    };

    const { data, error } = await this.supabase
      .from("users")
      .update(dbUpdates as never)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error !== null) {
      throw new PersistenceError(
        PersistenceErrorCode.OPERATION_FAILED,
        "Failed to update user profile",
        error,
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!data) {
      // Because RLS filters rows that don't match auth.uid(), a missing row on update
      // generally means the profile wasn't found OR the user lacks permission to update it.
      throw new PersistenceError(
        PersistenceErrorCode.RECORD_NOT_FOUND,
        `User profile not found or access denied for id: ${id}`,
      );
    }

    return this.mapDatabaseRowToDomain(data);
  }

  async isActive(_id: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase.rpc("is_active_user");

      if (error !== null) return false;
      return data === true;
    } catch {
      return false;
    }
  }
}
