import type { ComponentsObject } from "../openapi.types.js";

export const userPreferencesSchemas: ComponentsObject["schemas"] = {
  UserPreferencesResponse: {
    type: "object",
    description: "The canonical user preferences object",
    properties: {
      locale: { type: "string", description: "The IETF BCP 47 language tag", example: "en" },
      timeZone: { type: "string", description: "The IANA time zone identifier", example: "UTC" },
      practiceRemindersEnabled: {
        type: "boolean",
        description: "Whether practice reminders are enabled",
        example: false,
      },
      weeklyProgressSummaryEnabled: {
        type: "boolean",
        description: "Whether weekly progress summaries are enabled",
        example: false,
      },
      productUpdatesEnabled: {
        type: "boolean",
        description: "Whether product updates are enabled",
        example: false,
      },
      createdAt: {
        type: "string",
        format: "date-time",
        description: "When the preferences were created",
      },
      updatedAt: {
        type: "string",
        format: "date-time",
        description: "When the preferences were last updated",
      },
    },
    required: [
      "locale",
      "timeZone",
      "practiceRemindersEnabled",
      "weeklyProgressSummaryEnabled",
      "productUpdatesEnabled",
      "createdAt",
      "updatedAt",
    ],
  },
  UpdateUserPreferencesRequest: {
    type: "object",
    description: "Request to update user preferences",
    properties: {
      locale: { type: "string", description: "The IETF BCP 47 language tag", example: "fr-FR" },
      timeZone: {
        type: "string",
        description: "The IANA time zone identifier",
        example: "Europe/Paris",
      },
      practiceRemindersEnabled: {
        type: "boolean",
        description: "Whether practice reminders are enabled",
        example: true,
      },
      weeklyProgressSummaryEnabled: {
        type: "boolean",
        description: "Whether weekly progress summaries are enabled",
        example: true,
      },
      productUpdatesEnabled: {
        type: "boolean",
        description: "Whether product updates are enabled",
        example: true,
      },
    },
    additionalProperties: false,
  },
};
