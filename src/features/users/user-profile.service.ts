import type { UserProfile } from "./user-profile.types.js";
import type { UserProfileRepository } from "../../persistence/users/user-profile.repository.js";
import { UserProfileNotFoundError } from "../../errors/user-profile-not-found.error.js";
import { AccountInactiveError } from "../../errors/account-inactive.error.js";
import { PersistenceError, PersistenceErrorCode } from "../../persistence/persistence-error.js";
import { ServiceUnavailableError } from "../../errors/service-unavailable.error.js";

export class UserProfileService {
  public constructor(private readonly repository: UserProfileRepository) {}

  /**
   * Retrieves the current user profile.
   * Enforces that the profile exists and the account is active.
   * Translates persistence errors to safe application errors.
   */
  public async getCurrentUserProfile(userId: string): Promise<UserProfile> {
    try {
      const profile = await this.repository.findById(userId);

      if (profile.accountStatus !== "active" || profile.deletedAt !== null) {
        throw new AccountInactiveError();
      }

      return profile;
    } catch (error) {
      if (error instanceof AccountInactiveError) {
        throw error;
      }

      if (error instanceof PersistenceError) {
        if (error.code === PersistenceErrorCode.RECORD_NOT_FOUND) {
          throw new UserProfileNotFoundError();
        }
        throw new ServiceUnavailableError();
      }

      throw new ServiceUnavailableError();
    }
  }
}

export function createUserProfileService(repository: UserProfileRepository): UserProfileService {
  return new UserProfileService(repository);
}
