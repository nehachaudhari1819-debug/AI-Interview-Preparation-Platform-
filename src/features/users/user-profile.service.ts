import type { UserProfile } from "./user-profile.types.js";
import type { UserProfileRepository } from "../../persistence/users/user-profile.repository.js";
import { UserProfileNotFoundError } from "../../errors/user-profile-not-found.error.js";
import { AccountDisabledError } from "../../errors/account-disabled.error.js";
import { AccountDeletedError } from "../../errors/account-deleted.error.js";
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

      if (profile.accountStatus !== "active") {
        throw new AccountDisabledError();
      }

      if (profile.deletedAt !== null) {
        throw new AccountDeletedError();
      }

      return profile;
    } catch (error) {
      if (error instanceof AccountDisabledError || error instanceof AccountDeletedError) {
        throw error;
      }

      if (error instanceof PersistenceError) {
        if (error.code === PersistenceErrorCode.RECORD_NOT_FOUND) {
          throw new UserProfileNotFoundError();
        }
      }

      throw error;
    }
  }
}

export function createUserProfileService(repository: UserProfileRepository): UserProfileService {
  return new UserProfileService(repository);
}
