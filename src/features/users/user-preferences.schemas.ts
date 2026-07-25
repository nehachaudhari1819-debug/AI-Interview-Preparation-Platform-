import { z } from "zod";
import { normalizeLocale, normalizeTimeZone } from "./user-preferences.normalizers.js";

const VALID_TIMEZONES = new Set(Intl.supportedValuesOf("timeZone"));

// eslint-disable-next-line no-control-regex
const ControlCharacterRegex = /[\x00-\x1F\x7F-\x9F]/;

/**
 * Full Domain Schema representing UserPreferences
 */
export const UserPreferencesSchema = z
  .object({
    locale: z.string(),
    timeZone: z.string(),
    practiceRemindersEnabled: z.boolean(),
    weeklyProgressSummaryEnabled: z.boolean(),
    productUpdatesEnabled: z.boolean(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .strict();

/**
 * Input Schema for PATCH /api/v1/users/me/preferences
 */
export const UpdateUserPreferencesInputSchema = z
  .object({
    locale: z
      .string()
      .transform((val) => normalizeLocale(val))
      .refine((val) => val.length > 0, { message: "Locale cannot be empty." })
      .refine((val) => val.length <= 35, { message: "Locale cannot exceed 35 characters." })
      .refine((val) => !ControlCharacterRegex.test(val), {
        message: "Locale cannot contain control characters.",
      })
      .refine(
        (val) => {
          try {
            new Intl.Locale(val);
            return true;
          } catch {
            return false;
          }
        },
        { message: "Invalid locale format." },
      )
      .optional(),

    timeZone: z
      .string()
      .transform((val) => normalizeTimeZone(val))
      .refine((val) => val.length > 0, { message: "Time zone cannot be empty." })
      .refine((val) => val.length <= 64, { message: "Time zone cannot exceed 64 characters." })
      .refine((val) => !ControlCharacterRegex.test(val), {
        message: "Time zone cannot contain control characters.",
      })
      .refine((val) => VALID_TIMEZONES.has(val) || val === "UTC", {
        message: "Unrecognized IANA time zone.",
      })
      .optional(),

    practiceRemindersEnabled: z
      .boolean({
        required_error: "practiceRemindersEnabled is required.",
        invalid_type_error: "practiceRemindersEnabled must be a strict boolean.",
      })
      .optional(),

    weeklyProgressSummaryEnabled: z
      .boolean({
        required_error: "weeklyProgressSummaryEnabled is required.",
        invalid_type_error: "weeklyProgressSummaryEnabled must be a strict boolean.",
      })
      .optional(),

    productUpdatesEnabled: z
      .boolean({
        required_error: "productUpdatesEnabled is required.",
        invalid_type_error: "productUpdatesEnabled must be a strict boolean.",
      })
      .optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one valid preference field must be provided for update.",
  });
