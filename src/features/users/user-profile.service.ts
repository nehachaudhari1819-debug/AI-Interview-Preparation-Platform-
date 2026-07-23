import type { UserProfile } from "./user-profile.types.js";
import type { UserProfileRepository } from "../../persistence/users/user-profile.repository.js";
import { UserProfileNotFoundError } from "../../errors/user-profile-not-found.error.js";
import { AccountDisabledError } from "../../errors/account-disabled.error.js";
import { AccountDeletedError } from "../../errors/account-deleted.error.js";
import { PersistenceError, PersistenceErrorCode } from "../../persistence/persistence-error.js";
import { ServiceUnavailableError } from "../../errors/service-unavailable.error.js";

export class UserProfileService {
  public constructor(
    private readonly repository: UserProfileRepository,
    private readonly adminRepository?: UserProfileRepository,
  ) {}

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
      if (profile.accountStatus === "deleted" || profile.deletedAt !== null) {
        throw new AccountDeletedError();
      }

      return profile;
    } catch (error) {
      if (
        error instanceof PersistenceError &&
        error.code === PersistenceErrorCode.RECORD_NOT_FOUND
      ) {
        // Fallback: If RLS hides the profile because it is suspended/deleted,
        // we use the admin repository to fetch the actual status to return the correct 403.
        if (this.adminRepository) {
          try {
            const adminProfile = await this.adminRepository.findById(userId);
            if (adminProfile.accountStatus === "suspended") {
              throw new AccountDisabledError();
            }
            if (adminProfile.accountStatus === "deleted" || adminProfile.deletedAt !== null) {
              throw new AccountDeletedError();
            }
          } catch (adminError) {
            if (
              adminError instanceof PersistenceError &&
              adminError.code === PersistenceErrorCode.RECORD_NOT_FOUND
            ) {
              throw new UserProfileNotFoundError();
            }
            throw adminError;
          }
        }
        throw new UserProfileNotFoundError();
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

export function createUserProfileService(
  repository: UserProfileRepository,
  adminRepository?: UserProfileRepository,
): UserProfileService {
  return new UserProfileService(repository, adminRepository);
}
