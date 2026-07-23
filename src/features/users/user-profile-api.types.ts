import type { UserProfile } from "./user-profile.types.js";

/**
 * Public API response representation of a User Profile.
 * Ensures `deletedAt` and other internal domain fields are stripped,
 * and timestamps are serialized to ISO strings.
 */
export type UserProfileResponse = Omit<UserProfile, "deletedAt" | "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};
