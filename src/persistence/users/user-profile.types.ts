/**
 * COMPATIBILITY EXPORT
 * These types have been moved to the canonical domain layer in src/features/users/.
 * This file remains temporarily to prevent breaking existing Phase 2 authentication logic
 * and tests that directly import from this path.
 *
 * TODO(P3): Remove this file once all imports are migrated to the feature layer.
 */
export * from "../../features/users/user-profile.types.js";
export * from "../../features/users/user-profile.schemas.js";

import { UpdateUserProfileInputSchema } from "../../features/users/user-profile.schemas.js";
import type { UpdateUserProfileInput } from "../../features/users/user-profile.types.js";

// Re-export UpdateUserProfileInput with the old name for backward compatibility
export type UserProfileUpdate = UpdateUserProfileInput;
export const UserProfileUpdateSchema = UpdateUserProfileInputSchema;
