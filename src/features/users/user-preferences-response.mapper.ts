import type { UserPreferences } from "./user-preferences.types.js";

/**
 * Interface representing the database row for user preferences.
 * This should match the generated Supabase types.
 */
export interface UserPreferencesRow {
  locale: string;
  time_zone: string;
  practice_reminders_enabled: boolean;
  weekly_progress_summary_enabled: boolean;
  product_updates_enabled: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Maps a database user preferences row to the canonical domain model.
 * Safely drops internal fields like user_id and converts snake_case to camelCase.
 *
 * @param row The raw database row
 * @returns The canonical UserPreferences object
 */
export function mapUserPreferencesResponse(row: UserPreferencesRow): UserPreferences {
  return {
    locale: row.locale,
    timeZone: row.time_zone,
    practiceRemindersEnabled: row.practice_reminders_enabled,
    weeklyProgressSummaryEnabled: row.weekly_progress_summary_enabled,
    productUpdatesEnabled: row.product_updates_enabled,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}
