import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types.js";
import { PersistenceError, PersistenceErrorCode } from "../persistence-error.js";
import type { UserProfileRepository } from "./user-profile.repository.js";
import type { UserProfile, UpdateUserProfileInput } from "../../features/users/index.js";
import {
  mapUserProfileRowToDomain,
  mapUserProfileUpdateToDatabase,
} from "./user-profile.mapper.js";

const SAFE_PROFILE_COLUMNS =
  "id, email, full_name, college, branch, graduation_year, experience_level, preferred_roles, bio, avatar_url, role, account_status, created_at, updated_at, deleted_at";

export class SupabaseUserProfileRepository implements UserProfileRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async findById(id: string): Promise<UserProfile> {
    const { data, error } = await this.supabase
      .from("users")
      .select(SAFE_PROFILE_COLUMNS)
      .eq("id", id)
      .maybeSingle();

    if (error !== null) {
      throw new PersistenceError(
        PersistenceErrorCode.OPERATION_FAILED,
        "Failed to query user profile",
      );
    }

    if (!data) {
      throw new PersistenceError(PersistenceErrorCode.RECORD_NOT_FOUND, "User profile not found");
    }

    return mapUserProfileRowToDomain(data);
  }

  async updateOwnProfile(id: string, updates: UpdateUserProfileInput): Promise<UserProfile> {
    const dbUpdates = mapUserProfileUpdateToDatabase(updates);

    const { data, error } = await this.supabase
      .from("users")
      .update(dbUpdates)
      .eq("id", id)
      .select(SAFE_PROFILE_COLUMNS)
      .maybeSingle();

    if (error !== null) {
      throw new PersistenceError(
        PersistenceErrorCode.OPERATION_FAILED,
        "Failed to update user profile",
      );
    }

    if (!data) {
      // Because RLS filters rows that don't match auth.uid(), a missing row on update
      // generally means the profile wasn't found OR the user lacks permission to update it.
      throw new PersistenceError(
        PersistenceErrorCode.RECORD_NOT_FOUND,
        "User profile not found or access denied",
      );
    }

    return mapUserProfileRowToDomain(data);
  }

  async isActive(id: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from("users")
        .select("account_status, deleted_at")
        .eq("id", id)
        .maybeSingle();

      if (error !== null || !data) return false;
      return data.account_status === "active" && data.deleted_at === null;
    } catch {
      return false;
    }
  }
}
