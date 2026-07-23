import type { z } from "zod";
import type { UpdateUserProfileInputSchema, UserProfileSchema } from "./user-profile.schemas.js";

/**
 * Canonical domain model representing a User Profile.
 * This is decoupled from database-specific shapes and only uses standard JS types.
 */
export type UserProfile = z.infer<typeof UserProfileSchema>;

/**
 * Validated and normalized input for updating a User Profile.
 */
export type UpdateUserProfileInput = z.infer<typeof UpdateUserProfileInputSchema>;
