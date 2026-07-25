import type {
  UpdateUserPreferencesInput,
  UserPreferences,
} from "../../features/users/user-preferences.types.js";

/**
 * Interface defining the persistence operations for User Preferences.
 */
export interface UserPreferencesRepository {
  /**
   * Finds the user preferences by user ID.
   *
   * @param userId The unique identifier of the user
   * @returns The UserPreferences, or null if not found
   */
  findByUserId(userId: string): Promise<UserPreferences | null>;

  /**
   * Updates the user preferences for a given user ID.
   * Note: This is an owner-scoped operation enforcing RLS.
   *
   * @param userId The unique identifier of the user
   * @param input The validated partial updates to apply
   * @returns The completely updated UserPreferences, or null if not found/unauthorized
   */
  updateByUserId(
    userId: string,
    input: UpdateUserPreferencesInput,
  ): Promise<UserPreferences | null>;
}
