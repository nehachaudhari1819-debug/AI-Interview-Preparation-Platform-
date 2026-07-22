import type { UserProfile, UserProfileUpdate } from "./user-profile.types.ts";

/**
 * Interface defining the persistence operations for User Profiles.
 * This abstracts away the underlying database technology (e.g., Supabase)
 * from the core domain logic.
 */
export interface UserProfileRepository {
  /**
   * Retrieves a user profile by ID.
   * Throws a RECORD_NOT_FOUND PersistenceError if the profile does not exist.
   */
  findById(id: string): Promise<UserProfile>;

  /**
   * Updates an existing user's editable profile fields.
   * Throws a RECORD_NOT_FOUND PersistenceError if the profile does not exist.
   * Note: RLS ensures that the authenticated user client can only update their own row.
   */
  updateOwnProfile(id: string, updates: UserProfileUpdate): Promise<UserProfile>;

  /**
   * Checks if a user profile exists and has an 'active' account status.
   * Does not throw if not found; returns boolean.
   */
  isActive(id: string): Promise<boolean>;
}
