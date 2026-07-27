import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../database.types.js";
import type {
  AdminGetQuestionsQuery,
  CreateQuestionBody,
  UpdateQuestionBody,
  CreateTaxonomyBody,
  UpdateTaxonomyBody,
} from "../../features/questions/admin-questions.schemas.js";
import type { TaxonomyType, TaxonomyRow } from "../../features/questions/questions.schemas.js";
import type {
  IAdminQuestionsRepository,
  AdminQuestionDetail,
} from "../../features/questions/admin-questions.repository.js";
import { PersistenceError, PersistenceErrorCode } from "../persistence-error.js";

type DBQuestion = Database["public"]["Tables"]["questions"]["Row"];
type DBInternalData = Database["public"]["Tables"]["question_internal_data"]["Row"];
type SkillMapping = { skill_id: string };
type TopicMapping = { topic_id: string };

type RawAdminQuestionWithRelations = DBQuestion & {
  question_skill_mappings: SkillMapping[];
  question_topic_mappings: TopicMapping[];
  question_internal_data: DBInternalData | null;
};

export class SupabaseAdminQuestionsRepository implements IAdminQuestionsRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  private mapToAdminQuestionDetail(row: RawAdminQuestionWithRelations): AdminQuestionDetail {
    return {
      id: row.id,
      questionText: row.question_text,
      categoryId: row.category_id,
      difficultyId: row.difficulty_id,
      interviewTypeId: row.interview_type_id,
      skillIds: row.question_skill_mappings.map((m) => m.skill_id),
      topicIds: row.question_topic_mappings.map((m) => m.topic_id),
      status: row.status,
      publishedAt: row.published_at,
      archivedAt: row.archived_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      referenceAnswer: row.question_internal_data?.reference_answer ?? "",
      evaluationGuidance: (row.question_internal_data?.evaluation_guidance ?? {}) as Record<
        string,
        unknown
      >,
    };
  }

  public async getQuestions(
    query: AdminGetQuestionsQuery,
  ): Promise<{ questions: AdminQuestionDetail[]; total: number }> {
    const {
      page,
      limit,
      search,
      sortBy,
      sortDir,
      categoryId,
      difficultyId,
      interviewTypeId,
      skillId,
      topicId,
      status,
    } = query;

    const skillJoin = skillId ? "question_skill_mappings!inner" : "question_skill_mappings";
    const topicJoin = topicId ? "question_topic_mappings!inner" : "question_topic_mappings";

    let dbQuery = this.supabase.from("questions").select(
      `
        *,
        ${skillJoin} ( skill_id ),
        ${topicJoin} ( topic_id ),
        question_internal_data ( reference_answer, evaluation_guidance )
      `,
      { count: "exact" },
    );

    if (search) {
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
    if (status) dbQuery = dbQuery.in("status", status);

    const sortColumn =
      sortBy === "updatedAt"
        ? "updated_at"
        : sortBy === "publishedAt"
          ? "published_at"
          : "created_at";

    const ascending = sortDir === "asc";
    dbQuery = dbQuery
      .order(sortColumn, { ascending, nullsFirst: false })
      .order("id", { ascending: true });

    const offset = (page - 1) * limit;
    dbQuery = dbQuery.range(offset, offset + limit - 1);

    const { data, count, error } = await dbQuery.overrideTypes<
      RawAdminQuestionWithRelations[],
      { merge: false }
    >();

    if (error) {
      throw new PersistenceError(
        PersistenceErrorCode.OPERATION_FAILED,
        "Failed to fetch admin questions",
        error,
      );
    }

    return {
      questions: data.map((row) => this.mapToAdminQuestionDetail(row)),
      total: count ?? 0,
    };
  }

  public async getQuestionById(id: string): Promise<AdminQuestionDetail | null> {
    const { data, error } = await this.supabase
      .from("questions")
      .select(
        `
          *,
          question_skill_mappings ( skill_id ),
          question_topic_mappings ( topic_id ),
          question_internal_data ( reference_answer, evaluation_guidance )
        `,
      )
      .eq("id", id)
      .maybeSingle()
      .overrideTypes<RawAdminQuestionWithRelations, { merge: false }>();

    if (error) {
      throw new PersistenceError(
        PersistenceErrorCode.OPERATION_FAILED,
        "Failed to fetch question by ID",
        error,
      );
    }

    return data ? this.mapToAdminQuestionDetail(data) : null;
  }

  public async createQuestion(data: CreateQuestionBody): Promise<AdminQuestionDetail> {
    const {
      questionText,
      categoryId,
      difficultyId,
      interviewTypeId,
      skillIds,
      topicIds,
      referenceAnswer,
      evaluationGuidance,
    } = data;

    const args: Database["public"]["Functions"]["admin_create_question"]["Args"] = {
      p_question_text: questionText,
      p_category_id: categoryId,
      p_difficulty_id: difficultyId,
      p_interview_type_id: interviewTypeId,
      p_reference_answer: referenceAnswer,
      p_evaluation_guidance: evaluationGuidance as Json,
      p_skill_ids: skillIds,
    };

    if (topicIds.length > 0) {
      args.p_topic_ids = topicIds;
    }

    const { data: qid, error } = await this.supabase.rpc("admin_create_question", args);

    if (error) {
      throw new PersistenceError(
        PersistenceErrorCode.OPERATION_FAILED,
        "Failed to create question atomically",
        error,
      );
    }

    const created = await this.getQuestionById(qid);
    if (!created) {
      throw new PersistenceError(
        PersistenceErrorCode.OPERATION_FAILED,
        "Failed to load created question",
      );
    }
    return created;
  }

  public async updateQuestion(id: string, data: UpdateQuestionBody): Promise<AdminQuestionDetail> {
    // We construct the payload, which Supabase treats as Json. We use an intermediate object to build it.
    const rawPayload: Record<string, unknown> = {};

    if (data.questionText !== undefined) rawPayload.question_text = data.questionText;
    if (data.categoryId !== undefined) rawPayload.category_id = data.categoryId;
    if (data.difficultyId !== undefined) rawPayload.difficulty_id = data.difficultyId;
    if (data.interviewTypeId !== undefined) rawPayload.interview_type_id = data.interviewTypeId;
    if (data.referenceAnswer !== undefined) rawPayload.reference_answer = data.referenceAnswer;
    if (data.evaluationGuidance !== undefined)
      rawPayload.evaluation_guidance = data.evaluationGuidance;
    if (data.skillIds !== undefined) rawPayload.skill_ids = data.skillIds;
    if (data.topicIds !== undefined) rawPayload.topic_ids = data.topicIds;

    const { error } = await this.supabase.rpc("admin_update_question", {
      p_question_id: id,
      p_payload: rawPayload as Json,
    });

    if (error) {
      throw new PersistenceError(
        PersistenceErrorCode.OPERATION_FAILED,
        "Failed to update question atomically",
        error,
      );
    }

    const updated = await this.getQuestionById(id);
    if (!updated) {
      throw new PersistenceError(
        PersistenceErrorCode.OPERATION_FAILED,
        "Failed to load updated question",
      );
    }
    return updated;
  }

  public async updateQuestionStatus(
    id: string,
    status: "published" | "archived" | "draft",
  ): Promise<AdminQuestionDetail> {
    const payload: Database["public"]["Tables"]["questions"]["Update"] = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === "published") {
      payload.published_at = new Date().toISOString();
    } else if (status === "archived") {
      payload.archived_at = new Date().toISOString();
    } else {
      // restore behavior sets it to draft only
      payload.archived_at = null;
      payload.published_at = null;
    }

    const { error } = await this.supabase.from("questions").update(payload).eq("id", id);

    if (error) {
      throw new PersistenceError(
        PersistenceErrorCode.OPERATION_FAILED,
        "Failed to update status",
        error,
      );
    }

    const updated = await this.getQuestionById(id);
    if (!updated)
      throw new PersistenceError(
        PersistenceErrorCode.OPERATION_FAILED,
        "Failed to load updated question",
      );
    return updated;
  }

  private getTaxonomyTableName(type: TaxonomyType) {
    switch (type) {
      case "categories":
        return "question_categories";
      case "difficulties":
        return "question_difficulties";
      case "interview-types":
        return "question_interview_types";
      case "skills":
        return "question_skills";
      case "topics":
        return "question_topics";
    }
  }

  public async createTaxonomy(type: TaxonomyType, data: CreateTaxonomyBody): Promise<TaxonomyRow> {
    const table = this.getTaxonomyTableName(type);
    const { data: row, error } = await this.supabase
      .from(table)
      .insert({
        slug: data.slug,
        name: data.name,
        description: data.description,
        display_order: data.displayOrder,
        is_active: data.isActive,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new PersistenceError(
          PersistenceErrorCode.RECORD_ALREADY_EXISTS,
          "Taxonomy slug already exists",
          error,
        );
      }
      throw new PersistenceError(
        PersistenceErrorCode.OPERATION_FAILED,
        "Failed to create taxonomy",
        error,
      );
    }
    return row;
  }

  public async updateTaxonomy(
    type: TaxonomyType,
    id: string,
    data: UpdateTaxonomyBody,
  ): Promise<TaxonomyRow> {
    const table = this.getTaxonomyTableName(type);

    const payload: Database["public"]["Tables"]["question_categories"]["Update"] = {
      updated_at: new Date().toISOString(),
    };
    if (data.slug !== undefined) payload.slug = data.slug;
    if (data.name !== undefined) payload.name = data.name;
    if (data.description !== undefined) payload.description = data.description;
    if (data.displayOrder !== undefined) payload.display_order = data.displayOrder;
    if (data.isActive !== undefined) payload.is_active = data.isActive;

    const { data: row, error } = await this.supabase
      .from(table)
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new PersistenceError(
          PersistenceErrorCode.RECORD_ALREADY_EXISTS,
          "Taxonomy slug already exists",
          error,
        );
      }
      throw new PersistenceError(
        PersistenceErrorCode.OPERATION_FAILED,
        "Failed to update taxonomy",
        error,
      );
    }
    return row;
  }

  public async archiveTaxonomy(type: TaxonomyType, id: string): Promise<TaxonomyRow> {
    const table = this.getTaxonomyTableName(type);
    const { data: row, error } = await this.supabase
      .from(table)
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      // Map constraint violations to validation errors or standard persistence errors
      throw new PersistenceError(
        PersistenceErrorCode.OPERATION_FAILED,
        "Failed to archive taxonomy. It may be in use by existing questions.",
        error,
      );
    }
    return row;
  }

  public async restoreTaxonomy(type: TaxonomyType, id: string): Promise<TaxonomyRow> {
    const table = this.getTaxonomyTableName(type);
    const { data: row, error } = await this.supabase
      .from(table)
      .update({
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new PersistenceError(
        PersistenceErrorCode.OPERATION_FAILED,
        "Failed to restore taxonomy",
        error,
      );
    }
    return row;
  }
}
