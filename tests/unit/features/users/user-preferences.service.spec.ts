import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mocked } from "vitest";
import { UserPreferencesService } from "../../../../src/features/users/user-preferences.service.js";
import { AppError } from "../../../../src/errors/app-error.js";
import type { UserPreferencesRepository } from "../../../../src/persistence/users/user-preferences.repository.js";
import type { UserPreferences } from "../../../../src/features/users/user-preferences.types.js";

describe("UserPreferencesService", () => {
  let repository: Mocked<UserPreferencesRepository>;
  let service: UserPreferencesService;

  beforeEach(() => {
    repository = {
      findByUserId: vi.fn(),
      updateByUserId: vi.fn(),
    };
    service = new UserPreferencesService(repository);
  });

  const mockPref: UserPreferences = {
    locale: "en",
    timeZone: "UTC",
    practiceRemindersEnabled: false,
    weeklyProgressSummaryEnabled: false,
    productUpdatesEnabled: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe("getPreferences", () => {
    it("should return preferences if found", async () => {
      repository.findByUserId.mockResolvedValue(mockPref);
      const result = await service.getPreferences("user-1");
      expect(result).toEqual(mockPref);
      expect(repository.findByUserId).toHaveBeenCalledWith("user-1");
    });

    it("should throw 404 if not found", async () => {
      repository.findByUserId.mockResolvedValue(null);
      await expect(service.getPreferences("user-1")).rejects.toThrow(AppError);
    });
  });

  describe("updatePreferences", () => {
    it("should return updated preferences on success", async () => {
      repository.updateByUserId.mockResolvedValue(mockPref);
      const result = await service.updatePreferences("user-1", { locale: "fr" });
      expect(result).toEqual(mockPref);
      expect(repository.updateByUserId).toHaveBeenCalledWith("user-1", { locale: "fr" });
    });

    it("should throw 404 if update returns null", async () => {
      repository.updateByUserId.mockResolvedValue(null);
      await expect(service.updatePreferences("user-1", { locale: "fr" })).rejects.toThrow(AppError);
    });
  });
});
