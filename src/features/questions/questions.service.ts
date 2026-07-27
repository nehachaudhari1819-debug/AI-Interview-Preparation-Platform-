import type { GetQuestionsQuery, TaxonomyType, TaxonomyRow } from "./questions.schemas.js";
import type { QuestionWithMappings } from "./questions-response.mapper.js";

export interface PaginatedQuestionsResult {
  data: QuestionWithMappings[];
  count: number;
}

export interface IQuestionsRepository {
  getQuestions(query: GetQuestionsQuery): Promise<PaginatedQuestionsResult>;
  getQuestionById(id: string): Promise<QuestionWithMappings | null>;
  getTaxonomies(type: TaxonomyType): Promise<TaxonomyRow[]>;
}

export class QuestionsService {
  constructor(private readonly repository: IQuestionsRepository) {}

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

export function createQuestionsService(repository: IQuestionsRepository): QuestionsService {
  return new QuestionsService(repository);
}
