import type {
  AdminGetQuestionsQuery,
  CreateQuestionBody,
  UpdateQuestionBody,
  CreateTaxonomyBody,
  UpdateTaxonomyBody,
} from "./admin-questions.schemas.js";
import type { TaxonomyType, TaxonomyRow } from "./questions.schemas.js";

// Extended question detail for admins
export interface AdminQuestionDetail {
  id: string;
  questionText: string;
  categoryId: string;
  difficultyId: string;
  interviewTypeId: string;
  skillIds: string[];
  topicIds: string[];
  status: "draft" | "published" | "archived";
  publishedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  referenceAnswer: string;
  evaluationGuidance: Record<string, unknown>;
}

export interface IAdminQuestionsRepository {
  getQuestions(
    query: AdminGetQuestionsQuery,
  ): Promise<{ questions: AdminQuestionDetail[]; total: number }>;
  getQuestionById(id: string): Promise<AdminQuestionDetail | null>;
  createQuestion(data: CreateQuestionBody): Promise<AdminQuestionDetail>;
  updateQuestion(id: string, data: UpdateQuestionBody): Promise<AdminQuestionDetail>;
  updateQuestionStatus(
    id: string,
    status: "published" | "archived" | "draft",
  ): Promise<AdminQuestionDetail>;
  createTaxonomy(type: TaxonomyType, data: CreateTaxonomyBody): Promise<TaxonomyRow>;
  updateTaxonomy(type: TaxonomyType, id: string, data: UpdateTaxonomyBody): Promise<TaxonomyRow>;
  archiveTaxonomy(type: TaxonomyType, id: string): Promise<TaxonomyRow>;
  restoreTaxonomy(type: TaxonomyType, id: string): Promise<TaxonomyRow>;
}
