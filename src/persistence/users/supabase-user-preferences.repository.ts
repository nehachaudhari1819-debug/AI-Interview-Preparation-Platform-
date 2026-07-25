import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types.js";
import type { UserPreferencesRepository } from "./user-preferences.repository.js";
import type {
  UpdateUserPreferencesInput,
  UserPreferences,
} from "../../features/users/user-preferences.types.js";
import { mapUpdateUserPreferencesToDb } from "./user-preferences.mapper.js";
import { mapUserPreferencesResponse } from "../../features/users/user-preferences-response.mapper.js";

const SAFE_PREF_COLUMNS =
  "locale, time_zone, practice_reminders_enabled, weekly_progress_summary_enabled, product_updates_enabled, created_at, updated_at";

export class SupabaseUserPreferencesRepository implements UserPreferencesRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async findByUserId(userId: string): Promise<UserPreferences | null> {
    const { data, error } = await this.supabase
      .from("user_preferences")
      .select(SAFE_PREF_COLUMNS)
      .eq("user_id", userId)
      .maybeSingle();

    if (error !== null) {
      throw new Error(`Failed to query user preferences: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return mapUserPreferencesResponse(data);
  }

  async updateByUserId(
    userId: string,
    input: UpdateUserPreferencesInput,
  ): Promise<UserPreferences | null> {
    const dbUpdates = mapUpdateUserPreferencesToDb(input);

    const { data, error } = await this.supabase
      .from("user_preferences")
      .update(dbUpdates)
      .eq("user_id", userId)
      .select(SAFE_PREF_COLUMNS)
      .maybeSingle();

    if (error !== null) {
      throw new Error(`Failed to update user preferences: ${error.message}`);
    }

    if (!data) {
      // Due to RLS, missing data implies either missing row or lack of access
      return null;
    }

    return mapUserPreferencesResponse(data);
  }
}
