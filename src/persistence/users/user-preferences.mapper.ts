import type { UpdateUserPreferencesInput } from "../../features/users/user-preferences.types.js";

/**
 * Maps the application-level UpdateUserPreferencesInput to the database column shape.
 * Drops undefined fields so Supabase only patches provided values.
 *
 * @param input The validated partial updates to apply
 * @returns An object matching the database schema for user_preferences
 */
export function mapUpdateUserPreferencesToDb(
  input: UpdateUserPreferencesInput,
): Record<string, unknown> {
  const dbInput: Record<string, unknown> = {};

  if (input.locale !== undefined) {
    dbInput.locale = input.locale;
  }
  if (input.timeZone !== undefined) {
    dbInput.time_zone = input.timeZone;
  }
  if (input.practiceRemindersEnabled !== undefined) {
    dbInput.practice_reminders_enabled = input.practiceRemindersEnabled;
  }
  if (input.weeklyProgressSummaryEnabled !== undefined) {
    dbInput.weekly_progress_summary_enabled = input.weeklyProgressSummaryEnabled;
  }
  if (input.productUpdatesEnabled !== undefined) {
    dbInput.product_updates_enabled = input.productUpdatesEnabled;
  }

  return dbInput;
}
