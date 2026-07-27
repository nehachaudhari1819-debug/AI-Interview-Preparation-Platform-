import type { SupabaseQuestionsRepository } from "../../persistence/questions/supabase-questions.repository.js";
import type { GetQuestionsQuery, TaxonomyType } from "./questions.schemas.js";

export class QuestionsService {
  constructor(private readonly repository: SupabaseQuestionsRepository) {}

  public async getQuestions(query: GetQuestionsQuery) {
    const { data, count } = await this.repository.getQuestions(query);

    const totalPages = Math.ceil(count / query.limit);

    return {
      items: data,
      pagination: {
        page: query.page,
        limit: query.limit,
        totalItems: count,
        totalPages,
        hasNextPage: query.page < totalPages,
        hasPreviousPage: query.page > 1,
      },
    };
  }

  public async getQuestionDetail(id: string) {
    return this.repository.getQuestionById(id);
  }

  public async getTaxonomies(type: TaxonomyType) {
    return this.repository.getTaxonomies(type);
  }
}

export function createQuestionsService(repository: SupabaseQuestionsRepository): QuestionsService {
  return new QuestionsService(repository);
}
