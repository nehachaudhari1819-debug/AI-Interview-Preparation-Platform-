import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseUserProfileRepository } from "../../../src/persistence/users/supabase-user-profile.repository.js";
import {
  PersistenceError,
  PersistenceErrorCode,
} from "../../../src/persistence/persistence-error.js";
import type { Database } from "../../../src/persistence/database.types.js";

describe("SupabaseUserProfileRepository", () => {
  let mockSupabaseClient: jest.Mocked<SupabaseClient<Database>>;
  let repository: SupabaseUserProfileRepository;

  beforeEach(() => {
    mockSupabaseClient = {
      from: jest.fn(),
      rpc: jest.fn(),
    } as unknown as jest.Mocked<SupabaseClient<Database>>;
    repository = new SupabaseUserProfileRepository(mockSupabaseClient);
  });

  describe("findById", () => {
    it("returns user profile successfully", async () => {
      const mockData = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        email: "test@example.com",
        full_name: "Test User",
        college: null,
        branch: null,
        graduation_year: null,
        experience_level: null,
        preferred_roles: [],
        bio: null,
        avatar_url: null,
        role: "student",
        account_status: "active",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      const mockMaybeSingle = jest.fn().mockResolvedValue({ data: mockData, error: null } as never);
      const mockEq = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
      mockSupabaseClient.from.mockReturnValue({ select: mockSelect });

      const result = await repository.findById(mockData.id);

      expect(result.id).toBe(mockData.id);
      expect(result.fullName).toBe(mockData.full_name);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith("users");
    });

    it("throws RECORD_NOT_FOUND when user is missing", async () => {
      const mockMaybeSingle = jest.fn().mockResolvedValue({ data: null, error: null } as never);
      const mockEq = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
      mockSupabaseClient.from.mockReturnValue({ select: mockSelect });

      await expect(repository.findById("123")).rejects.toThrowError(
        new PersistenceError(
          PersistenceErrorCode.RECORD_NOT_FOUND,
          "User profile not found for id: 123",
        ),
      );
    });

    it("throws OPERATION_FAILED when supabase throws", async () => {
      const mockError = new Error("DB Error");
      const mockMaybeSingle = jest
        .fn()
        .mockResolvedValue({ data: null, error: mockError } as never);
      const mockEq = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
      mockSupabaseClient.from.mockReturnValue({ select: mockSelect });

      await expect(repository.findById("123")).rejects.toThrowError(
        new PersistenceError(PersistenceErrorCode.OPERATION_FAILED, "Failed to query user profile"),
      );
    });
  });

  describe("isActive", () => {
    it("returns true when profile is active", async () => {
      const mockMaybeSingle = jest.fn().mockResolvedValue({
        data: { account_status: "active", deleted_at: null },
        error: null,
      } as never);
      const mockEq = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
      mockSupabaseClient.from.mockReturnValue({ select: mockSelect });

      const result = await repository.isActive("123");
      expect(result).toBe(true);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith("users");
      expect(mockSelect).toHaveBeenCalledWith("account_status, deleted_at");
      expect(mockEq).toHaveBeenCalledWith("id", "123");
    });

    it("returns false when profile is not active", async () => {
      const mockMaybeSingle = jest.fn().mockResolvedValue({
        data: { account_status: "suspended", deleted_at: null },
        error: null,
      } as never);
      const mockEq = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
      mockSupabaseClient.from.mockReturnValue({ select: mockSelect });

      const result = await repository.isActive("123");
      expect(result).toBe(false);
    });

    it("returns false when profile is not found", async () => {
      const mockMaybeSingle = jest.fn().mockResolvedValue({ data: null, error: null } as never);
      const mockEq = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
      mockSupabaseClient.from.mockReturnValue({ select: mockSelect });

      const result = await repository.isActive("123");
      expect(result).toBe(false);
    });

    it("returns false when db errors out securely", async () => {
      const mockMaybeSingle = jest.fn().mockRejectedValue(new Error("Network Error") as never);
      const mockEq = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
      mockSupabaseClient.from.mockReturnValue({ select: mockSelect });

      const result = await repository.isActive("123");
      expect(result).toBe(false); // Fail closed securely
    });
  });
});
