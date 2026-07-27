import type { Database } from "../../persistence/database.types.js";

type PublishedQuestionRow = Database["public"]["Views"]["published_questions"]["Row"];
type QuestionSkillMappingRow = Database["public"]["Tables"]["question_skill_mappings"]["Row"];
type QuestionTopicMappingRow = Database["public"]["Tables"]["question_topic_mappings"]["Row"];

export type QuestionWithMappings = PublishedQuestionRow & {
  question_skill_mappings: Pick<QuestionSkillMappingRow, "skill_id">[];
  question_topic_mappings: Pick<QuestionTopicMappingRow, "topic_id">[];
};

export type QuestionSummary = {
  id: string;
  questionText: string;
  categoryId: string;
  difficultyId: string;
  interviewTypeId: string;
  skillIds: string[];
  topicIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type QuestionDetail = QuestionSummary;

export type TaxonomyResponse = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
};

/**
 * Maps a database row from the `published_questions` secure view to a
 * safe student-facing DTO, guaranteeing no internal fields leak.
 */
export function mapQuestionToSummary(row: QuestionWithMappings): QuestionSummary {
  // The database view types are nullable because it's a view, but the base table guarantees NOT NULL
  if (
    !row.id ||
    !row.question_text ||
    !row.category_id ||
    !row.difficulty_id ||
    !row.interview_type_id ||
    !row.created_at ||
    !row.updated_at
  ) {
    throw new Error("Invalid question row from database: missing required fields");
  }

  return {
    id: row.id,
    questionText: row.question_text,
    categoryId: row.category_id,
    difficultyId: row.difficulty_id,
    interviewTypeId: row.interview_type_id,
    skillIds: row.question_skill_mappings.map((m) => m.skill_id),
    topicIds: row.question_topic_mappings.map((m) => m.topic_id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapQuestionToDetail(row: QuestionWithMappings): QuestionDetail {
  // Currently QuestionDetail has the exact same shape as QuestionSummary in the P4.1 contract
  return mapQuestionToSummary(row);
}

export function mapTaxonomyToResponse(
  row: Database["public"]["Tables"]["question_categories"]["Row"],
): TaxonomyResponse {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    displayOrder: row.display_order,
    isActive: row.is_active,
  };
}
