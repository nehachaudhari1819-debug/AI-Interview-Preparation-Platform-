import { AppError } from "../../errors/app-error.js";
import type { UserPreferencesRepository } from "../../persistence/users/user-preferences.repository.js";
import type { UpdateUserPreferencesInput, UserPreferences } from "./user-preferences.types.js";

export class UserPreferencesService {
  constructor(private readonly repository: UserPreferencesRepository) {}

  /**
   * Retrieves the user preferences for a given user.
   *
   * @param userId the user's ID
   * @returns the preferences
   */
  async getPreferences(userId: string): Promise<UserPreferences> {
    const preferences = await this.repository.findByUserId(userId);
    if (!preferences) {
      throw new AppError({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "User preferences not found",
      });
    }
    return preferences;
  }

  /**
   * Updates the user preferences.
   *
   * @param userId the user's ID
   * @param input validated partial updates
   * @returns the updated preferences
   */
  async updatePreferences(
    userId: string,
    input: UpdateUserPreferencesInput,
  ): Promise<UserPreferences> {
    const updated = await this.repository.updateByUserId(userId, input);
    if (!updated) {
      throw new AppError({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "User preferences not found or update failed",
      });
    }
    return updated;
  }
}
