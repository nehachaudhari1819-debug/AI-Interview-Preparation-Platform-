import { describe, it, expect } from "vitest";
import { mapUpdateUserPreferencesToDb } from "../../../../src/persistence/users/user-preferences.mapper.js";

describe("mapUpdateUserPreferencesToDb", () => {
  it("should map domain partial updates to db shape", () => {
    const input = {
      locale: "fr",
      timeZone: "Europe/Paris",
      practiceRemindersEnabled: true,
      weeklyProgressSummaryEnabled: false,
      productUpdatesEnabled: true,
    };

    const db = mapUpdateUserPreferencesToDb(input);

    expect(db).toEqual({
      locale: "fr",
      time_zone: "Europe/Paris",
      practice_reminders_enabled: true,
      weekly_progress_summary_enabled: false,
      product_updates_enabled: true,
    });
  });

  it("should drop undefined fields", () => {
    const input = { locale: "es" };
    const db = mapUpdateUserPreferencesToDb(input);
    expect(db).toEqual({ locale: "es" });
    expect(db).not.toHaveProperty("time_zone");
  });
});
