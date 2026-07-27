import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types.js";
import type { GetQuestionsQuery, TaxonomyType } from "../../features/questions/questions.schemas.js";
import type { QuestionWithMappings } from "../../features/questions/questions-response.mapper.js";
import { PersistenceError, PersistenceErrorCode } from "../persistence-error.js";

export type PaginatedQuestionsResult = {
  data: QuestionWithMappings[];
  count: number;
};

export class SupabaseQuestionsRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  public async getQuestions(query: GetQuestionsQuery): Promise<PaginatedQuestionsResult> {
    const { page, limit, search, sortBy, sortDir, categoryId, difficultyId, interviewTypeId, skillId, topicId } = query;

    // We must query public.published_questions for students.
    // We include the mappings which are joined by Supabase via foreign keys.
    // Use !inner ONLY if we are filtering by skill/topic, otherwise it excludes questions without them.
    const skillJoin = skillId ? "question_skill_mappings!inner" : "question_skill_mappings";
    const topicJoin = topicId ? "question_topic_mappings!inner" : "question_topic_mappings";

    let dbQuery = this.supabase
      .from("published_questions")
      .select(`
        id, question_text, category_id, difficulty_id, interview_type_id, created_at, updated_at,
        ${skillJoin} ( skill_id ),
        ${topicJoin} ( topic_id )
      `, { count: "exact" });

    if (search) {
      // Use websearch_to_tsquery for simple and safe full-text search against the question_text
      dbQuery = dbQuery.textSearch("question_text", search, {
        type: "websearch",
        config: "english",
      });
    }

    if (categoryId) dbQuery = dbQuery.in("category_id", categoryId);
    if (difficultyId) dbQuery = dbQuery.in("difficulty_id", difficultyId);
    if (interviewTypeId) dbQuery = dbQuery.in("interview_type_id", interviewTypeId);
    if (skillId) dbQuery = dbQuery.in("question_skill_mappings.skill_id", skillId);
    if (topicId) dbQuery = dbQuery.in("question_topic_mappings.topic_id", topicId);

    // Apply Sorting
    // Using created_at or updated_at (published_at is not exposed in the secure view)
    const orderColumn = sortBy === "createdAt" ? "created_at" : "updated_at";
    
    // Sort by primary condition then deterministically by id
    dbQuery = dbQuery
      .order(orderColumn, { ascending: sortDir === "asc", nullsFirst: false })
      .order("id", { ascending: true }); // secondary sort

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    dbQuery = dbQuery.range(from, to);

    const { data, count, error } = await dbQuery;

    if (error) {
      throw new PersistenceError(PersistenceErrorCode.OPERATION_FAILED, "Failed to fetch questions");
    }

    return {
      data: data as unknown as QuestionWithMappings[],
      count: count ?? 0,
    };
  }

  public async getQuestionById(id: string): Promise<QuestionWithMappings | null> {
    const { data, error } = await this.supabase
      .from("published_questions")
      .select(`
        id, question_text, category_id, difficulty_id, interview_type_id, created_at, updated_at,
        question_skill_mappings ( skill_id ),
        question_topic_mappings ( topic_id )
      `)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new PersistenceError(PersistenceErrorCode.OPERATION_FAILED, "Failed to fetch question detail");
    }

    return data as unknown as QuestionWithMappings | null;
  }

  public async getTaxonomies(type: TaxonomyType) {
    let tableName: string;
    switch (type) {
      case "categories":
        tableName = "question_categories";
        break;
      case "difficulties":
        tableName = "question_difficulties";
        break;
      case "interview-types":
        tableName = "question_interview_types";
        break;
      case "skills":
        tableName = "question_skills";
        break;
      case "topics":
        tableName = "question_topics";
        break;
      default:
        throw new Error(`Unsupported taxonomy type: ${type}`);
    }

    // Student RLS guarantees is_active = true is enforced
    const { data, error } = await this.supabase
      .from(tableName)
      .select("*")
      .order("display_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      throw new PersistenceError(PersistenceErrorCode.OPERATION_FAILED, `Failed to fetch ${type}`);
    }

    return data;
  }
}
