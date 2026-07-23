import type { UserProfile } from "./user-profile.types.js";
import type { UserProfileRepository } from "../../persistence/users/user-profile.repository.js";
import { UserProfileNotFoundError } from "../../errors/user-profile-not-found.error.js";
import { AccountDisabledError } from "../../errors/account-disabled.error.js";
import { AccountDeletedError } from "../../errors/account-deleted.error.js";
import { PersistenceError, PersistenceErrorCode } from "../../persistence/persistence-error.js";

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

      if (profile.accountStatus === "suspended") {
        throw new AccountDisabledError();
      }
      if (
        profile.accountStatus === "deleted" ||
        profile.accountStatus === "deletion_pending" ||
        profile.deletedAt !== null
      ) {
        throw new AccountDeletedError();
      }

      return profile;
    } catch (error) {
      if (
        error instanceof PersistenceError &&
        error.code === PersistenceErrorCode.RECORD_NOT_FOUND
      ) {
        // NOTE: In Phase 3.3, RLS policies explicitly hide inactive (suspended/deleted) rows.
        // Therefore, we cannot differentiate between "account inactive" (403) and "not found" (404)
        // using just the authenticated client.
        // Exact inactive-status differentiation is deferred to P3.6, where RLS changes are authorized.
        throw new UserProfileNotFoundError();
      }

      throw error;
    }
  }
}

export function createUserProfileService(repository: UserProfileRepository): UserProfileService {
  return new UserProfileService(repository);
}
