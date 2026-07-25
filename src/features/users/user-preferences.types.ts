import type { z } from "zod";
import type {
  UpdateUserPreferencesInputSchema,
  UserPreferencesSchema,
} from "./user-preferences.schemas.js";

/**
 * Canonical domain model representing User Preferences.
 */
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

/**
 * Validated and normalized input for updating User Preferences.
 */
export type UpdateUserPreferencesInput = z.infer<typeof UpdateUserPreferencesInputSchema>;
