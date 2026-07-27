import { describe, expect, it, jest } from "@jest/globals";
import { SupabaseAdminQuestionsRepository } from "../../src/persistence/questions/supabase-admin-questions.repository.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/persistence/database.types.js";
import type { AdminGetQuestionsQuery } from "../../src/features/questions/admin-questions.schemas.js";

function createMockSupabase() {
  const queryBuilder: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    textSearch: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockReturnThis(),
    overrideTypes: jest.fn().mockReturnThis(),
    then: jest
      .fn()
      .mockImplementation((resolve: any) => resolve({ data: [], count: 0, error: null })),
  };

  const from = jest.fn().mockReturnValue(queryBuilder);
  const supabase = { from } as unknown as SupabaseClient<Database>;
  return { supabase, from, queryBuilder };
}

describe("SupabaseAdminQuestionsRepository Integration", () => {
  describe("getQuestions", () => {
    it("should query the questions table directly", async () => {
      const { supabase, from, queryBuilder } = createMockSupabase();
      queryBuilder.then.mockImplementationOnce((resolve: any) =>
        resolve({ data: [], count: 0, error: null }),
      );
      const repo = new SupabaseAdminQuestionsRepository(supabase);

      const query = {
        page: 1,
        limit: 10,
        sortBy: "createdAt",
        sortDir: "desc",
      } as AdminGetQuestionsQuery;
      await repo.getQuestions(query);

      expect(from).toHaveBeenCalledWith("questions");
      expect(queryBuilder.select).toHaveBeenCalled();
      expect(queryBuilder.overrideTypes).toHaveBeenCalled();
    });
  });

  describe("updateQuestionStatus", () => {
    it("should update status and return question", async () => {
      const { supabase, from, queryBuilder } = createMockSupabase();
      queryBuilder.then.mockImplementationOnce(
        (resolve: any) => resolve({ error: null }), // update response
      );
      queryBuilder.then.mockImplementationOnce(
        (resolve: any) =>
          resolve({
            data: {
              id: "123",
              question_skill_mappings: [],
              question_topic_mappings: [],
              question_internal_data: {},
              status: "published",
            },
            error: null,
          }), // getQuestionById response
      );

      const repo = new SupabaseAdminQuestionsRepository(supabase);

      const res = await repo.updateQuestionStatus("123", "published");

      expect(from).toHaveBeenCalledWith("questions");
      expect(queryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "published",
        }),
      );
      expect(queryBuilder.eq).toHaveBeenCalledWith("id", "123");
      expect(res.id).toBe("123");
      expect(res.status).toBe("published");
    });
  });
});
