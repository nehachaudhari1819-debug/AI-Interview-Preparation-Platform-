import type { UserProfile } from "./user-profile.types.js";
import type { UserProfileResponse } from "./user-profile-api.types.js";

/**
 * Maps a canonical UserProfile domain object to the safe public API response.
 * Excludes protected fields like `deletedAt` and explicitly formats timestamps.
 */
export function mapUserProfileToResponse(profile: Readonly<UserProfile>): UserProfileResponse {
  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.fullName,
    college: profile.college,
    branch: profile.branch,
    graduationYear: profile.graduationYear,
    experienceLevel: profile.experienceLevel,
    preferredRoles: profile.preferredRoles,
    bio: profile.bio,
    avatarUrl: profile.avatarUrl,
    role: profile.role,
    accountStatus: profile.accountStatus,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}
