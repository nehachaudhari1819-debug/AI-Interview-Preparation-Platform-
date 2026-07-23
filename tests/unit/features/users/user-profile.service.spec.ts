import { jest } from "@jest/globals";
import { UserProfileService } from "../../../../src/features/users/user-profile.service.js";
import type { UserProfileRepository } from "../../../../src/persistence/users/user-profile.repository.js";
import { AccountDisabledError } from "../../../../src/errors/account-disabled.error.js";
import { AccountDeletedError } from "../../../../src/errors/account-deleted.error.js";
import { UserProfileNotFoundError } from "../../../../src/errors/user-profile-not-found.error.js";
import { ServiceUnavailableError } from "../../../../src/errors/service-unavailable.error.js";
import {
  PersistenceError,
  PersistenceErrorCode,
} from "../../../../src/persistence/persistence-error.js";

import type { UserProfile } from "../../../../src/features/users/user-profile.types.js";

describe("UserProfileService", () => {
  let mockRepository: jest.Mocked<UserProfileRepository>;
  let service: UserProfileService;

  const validProfile: UserProfile = {
    id: "d290f1ee-6c54-4b01-90e6-d701748f0851",
    email: "test@example.com",
    fullName: "Test User",
    college: null,
    branch: null,
    graduationYear: null,
    experienceLevel: null,
    preferredRoles: [],
    bio: null,
    avatarUrl: null,
    role: "student",
    accountStatus: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(() => {
    mockRepository = {
      findById: jest.fn<any>(),
      updateOwnProfile: jest.fn<any>(),
      isActive: jest.fn<any>(),
    };
    service = new UserProfileService(mockRepository);
  });

  it("returns profile if active and not deleted", async () => {
    mockRepository.findById.mockResolvedValue(validProfile);

    const result = await service.getCurrentUserProfile(validProfile.id);

    expect(result).toEqual(validProfile);
    expect(mockRepository.findById).toHaveBeenCalledWith(validProfile.id);
  });

  it("throws AccountDisabledError if accountStatus is not active", async () => {
    mockRepository.findById.mockResolvedValue({
      ...validProfile,
      accountStatus: "suspended",
    });

    await expect(service.getCurrentUserProfile(validProfile.id)).rejects.toThrow(
      AccountDisabledError,
    );
  });

  it("throws AccountDeletedError if deletedAt is not null", async () => {
    mockRepository.findById.mockResolvedValue({
      ...validProfile,
      deletedAt: new Date(),
    });

    await expect(service.getCurrentUserProfile(validProfile.id)).rejects.toThrow(
      AccountDeletedError,
    );
  });

  it("throws UserProfileNotFoundError if repository throws RECORD_NOT_FOUND", async () => {
    mockRepository.findById.mockRejectedValue(
      new PersistenceError(PersistenceErrorCode.RECORD_NOT_FOUND, "Not found"),
    );

    await expect(service.getCurrentUserProfile(validProfile.id)).rejects.toThrow(
      UserProfileNotFoundError,
    );
  });

  it("throws ServiceUnavailableError if repository throws OPERATION_FAILED", async () => {
    mockRepository.findById.mockRejectedValue(
      new PersistenceError(PersistenceErrorCode.OPERATION_FAILED, "Failed"),
    );

    await expect(service.getCurrentUserProfile(validProfile.id)).rejects.toThrow(
      ServiceUnavailableError,
    );
  });

  describe("updateCurrentUserProfile", () => {
    it("returns updated profile on success", async () => {
      const updates = { fullName: "Updated Test User" };
      const updatedProfile = { ...validProfile, fullName: "Updated Test User" };
      mockRepository.updateOwnProfile.mockResolvedValue(updatedProfile);

      const result = await service.updateCurrentUserProfile(validProfile.id, updates);

      expect(result).toEqual(updatedProfile);
      expect(mockRepository.updateOwnProfile).toHaveBeenCalledWith(validProfile.id, updates);
    });

    it("throws UserProfileNotFoundError if repository throws RECORD_NOT_FOUND", async () => {
      mockRepository.updateOwnProfile.mockRejectedValue(
        new PersistenceError(PersistenceErrorCode.RECORD_NOT_FOUND, "Not found"),
      );

      await expect(
        service.updateCurrentUserProfile(validProfile.id, { fullName: "Test" }),
      ).rejects.toThrow(UserProfileNotFoundError);
    });

    it("throws ServiceUnavailableError if repository throws OPERATION_FAILED", async () => {
      mockRepository.updateOwnProfile.mockRejectedValue(
        new PersistenceError(PersistenceErrorCode.OPERATION_FAILED, "Failed"),
      );

      await expect(
        service.updateCurrentUserProfile(validProfile.id, { fullName: "Test" }),
      ).rejects.toThrow(ServiceUnavailableError);
    });
  });
});
