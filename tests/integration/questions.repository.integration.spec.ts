import { describe, expect, it, jest } from "@jest/globals";
import { SupabaseQuestionsRepository } from "../../src/persistence/questions/supabase-questions.repository.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/persistence/database.types.js";
import type {
  GetQuestionsQuery,
  TaxonomyType,
} from "../../src/features/questions/questions.schemas.js";

// Helper to create a deep mocked supabase query builder
function createMockSupabase() {
  const queryBuilder: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    textSearch: jest.fn().mockReturnThis(),
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

describe("SupabaseQuestionsRepository Integration", () => {
  describe("getQuestions", () => {
    it("should query the secure published_questions view for student reads", async () => {
      const { supabase, from, queryBuilder } = createMockSupabase();
      queryBuilder.then.mockImplementationOnce((resolve: any) =>
        resolve({ data: [], count: 0, error: null }),
      );
      const repo = new SupabaseQuestionsRepository(supabase);

      const query = {
        page: 1,
        limit: 10,
        sortBy: "createdAt",
        sortDir: "desc",
      } as GetQuestionsQuery;
      await repo.getQuestions(query);

      expect(from).toHaveBeenCalledWith("published_questions");
      expect(queryBuilder.select).toHaveBeenCalled();
    });

    it("should apply search and all filters correctly", async () => {
      const { supabase, from, queryBuilder } = createMockSupabase();
      queryBuilder.then.mockImplementationOnce((resolve: any) =>
        resolve({ data: [], count: 0, error: null }),
      );
      const repo = new SupabaseQuestionsRepository(supabase);

      const query: GetQuestionsQuery = {
        page: 1,
        limit: 10,
        sortBy: "createdAt",
        sortDir: "desc",
        search: "Node",
        categoryId: ["cat-1"],
        difficultyId: ["diff-1"],
        interviewTypeId: ["int-1"],
        skillId: ["skill-1"],
        topicId: ["topic-1"],
      };

      await repo.getQuestions(query);

      expect(from).toHaveBeenCalledWith("published_questions");
      expect(queryBuilder.textSearch).toHaveBeenCalledWith("question_text", "Node", {
        type: "websearch",
        config: "english",
      });
      expect(queryBuilder.in).toHaveBeenCalledWith("category_id", ["cat-1"]);
      expect(queryBuilder.in).toHaveBeenCalledWith("difficulty_id", ["diff-1"]);
      expect(queryBuilder.in).toHaveBeenCalledWith("interview_type_id", ["int-1"]);
      expect(queryBuilder.in).toHaveBeenCalledWith("question_skill_mappings.skill_id", ["skill-1"]);
      expect(queryBuilder.in).toHaveBeenCalledWith("question_topic_mappings.topic_id", ["topic-1"]);
    });

    it("should apply sorting and pagination", async () => {
      const { supabase, from, queryBuilder } = createMockSupabase();
      queryBuilder.then.mockImplementationOnce((resolve: any) =>
        resolve({ data: [], count: 0, error: null }),
      );
      const repo = new SupabaseQuestionsRepository(supabase);

      const query = {
        page: 2,
        limit: 15,
        sortBy: "updatedAt",
        sortDir: "asc",
      } as GetQuestionsQuery;

      await repo.getQuestions(query);

      expect(queryBuilder.order).toHaveBeenCalledWith("updated_at", {
        ascending: true,
        nullsFirst: false,
      });
      expect(queryBuilder.order).toHaveBeenCalledWith("id", { ascending: true });
      expect(queryBuilder.range).toHaveBeenCalledWith(15, 29); // (2-1)*15 to 2*15 - 1
    });
  });

  describe("getTaxonomies", () => {
    it("should fetch taxonomy with explicit columns and sort", async () => {
      const { supabase, from, queryBuilder } = createMockSupabase();
      queryBuilder.then.mockImplementationOnce((resolve: any) =>
        resolve({ data: [], error: null }),
      );
      const repo = new SupabaseQuestionsRepository(supabase);

      await repo.getTaxonomies("categories");

      expect(from).toHaveBeenCalledWith("question_categories");
      expect(queryBuilder.select).toHaveBeenCalledWith(
        "id, slug, name, description, display_order, is_active",
      );
      expect(queryBuilder.order).toHaveBeenCalledWith("display_order", { ascending: true });
      expect(queryBuilder.order).toHaveBeenCalledWith("name", { ascending: true });
    });
  });
});
