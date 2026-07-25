// Using Jest globals
import { mapUserPreferencesResponse } from "../../../../src/features/users/user-preferences-response.mapper.js";

describe("mapUserPreferencesResponse", () => {
  it("should map db row to camelCase domain model", () => {
    const row = {
      locale: "en",
      time_zone: "UTC",
      practice_reminders_enabled: true,
      weekly_progress_summary_enabled: false,
      product_updates_enabled: true,
      created_at: "2023-01-01T00:00:00.000Z",
      updated_at: "2023-01-02T00:00:00.000Z",
    };

    const domain = mapUserPreferencesResponse(row);

    expect(domain.locale).toBe("en");
    expect(domain.timeZone).toBe("UTC");
    expect(domain.practiceRemindersEnabled).toBe(true);
    expect(domain.weeklyProgressSummaryEnabled).toBe(false);
    expect(domain.productUpdatesEnabled).toBe(true);
    expect(domain.createdAt.toISOString()).toBe("2023-01-01T00:00:00.000Z");
    expect(domain.updatedAt.toISOString()).toBe("2023-01-02T00:00:00.000Z");
  });
});
