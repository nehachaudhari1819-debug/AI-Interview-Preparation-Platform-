import { describe, expect, it, jest } from "@jest/globals";
import { QuestionsService } from "../../../src/features/questions/questions.service.js";
import type { SupabaseQuestionsRepository } from "../../../src/persistence/questions/supabase-questions.repository.js";
import type { GetQuestionsQuery } from "../../../src/features/questions/questions.schemas.js";

describe("QuestionsService", () => {
  it("should calculate pagination metadata correctly", async () => {
    const mockRepo = {
      getQuestions: async () => ({
        data: [{ id: "test-id" }],
        count: 55,
      }),
    } as unknown as SupabaseQuestionsRepository;

    const service = new QuestionsService(mockRepo);

    const query = {
      page: 2,
      limit: 20,
      sortBy: "createdAt",
      sortDir: "desc",
    };

    const result = await service.getQuestions(query as GetQuestionsQuery);

    expect(result.pagination.totalItems).toBe(55);
    expect(result.pagination.totalPages).toBe(3); // 55 / 20 = 2.75 -> 3
    expect(result.pagination.page).toBe(2);
    expect(result.pagination.limit).toBe(20);
    expect(result.pagination.hasNextPage).toBe(true); // page 2 < 3
    expect(result.pagination.hasPreviousPage).toBe(true); // page 2 > 1
  });

  it("should handle empty results gracefully", async () => {
    const mockRepo = {
      getQuestions: async () => ({
        data: [],
        count: 0,
      }),
    } as unknown as SupabaseQuestionsRepository;

    const service = new QuestionsService(mockRepo);

    const query = {
      page: 1,
      limit: 20,
      sortBy: "createdAt",
      sortDir: "desc",
    };

    const result = await service.getQuestions(query as GetQuestionsQuery);

    expect(result.pagination.totalItems).toBe(0);
    expect(result.pagination.totalPages).toBe(0);
    expect(result.pagination.hasNextPage).toBe(false);
    expect(result.pagination.hasPreviousPage).toBe(false);
  });
});
