import type {
  AdminGetQuestionsQuery,
  CreateQuestionBody,
  UpdateQuestionBody,
  CreateTaxonomyBody,
  UpdateTaxonomyBody,
} from "./admin-questions.schemas.js";
import type {
  IAdminQuestionsRepository,
  AdminQuestionDetail,
} from "./admin-questions.repository.js";
import type { TaxonomyType, TaxonomyRow } from "./questions.schemas.js";
import { NotFoundError } from "../../errors/not-found.error.js";
import { ValidationError } from "../../errors/validation.error.js";
import { AppError } from "../../errors/app-error.js";
import { PersistenceError, PersistenceErrorCode } from "../../persistence/persistence-error.js";
import { HTTP_STATUS } from "../../constants/http.constants.js";
import { ERROR_CODES } from "../../constants/error-codes.constants.js";

export interface IAdminQuestionsService {
  getQuestions(
    query: AdminGetQuestionsQuery,
  ): Promise<{ questions: AdminQuestionDetail[]; total: number }>;
  getQuestionById(id: string): Promise<AdminQuestionDetail>;
  createQuestion(data: CreateQuestionBody): Promise<AdminQuestionDetail>;
  updateQuestion(id: string, data: UpdateQuestionBody): Promise<AdminQuestionDetail>;
  publishQuestion(id: string): Promise<AdminQuestionDetail>;
  archiveQuestion(id: string): Promise<AdminQuestionDetail>;
  restoreQuestion(id: string): Promise<AdminQuestionDetail>;
  createTaxonomy(type: TaxonomyType, data: CreateTaxonomyBody): Promise<TaxonomyRow>;
  updateTaxonomy(type: TaxonomyType, id: string, data: UpdateTaxonomyBody): Promise<TaxonomyRow>;
  archiveTaxonomy(type: TaxonomyType, id: string): Promise<TaxonomyRow>;
  restoreTaxonomy(type: TaxonomyType, id: string): Promise<TaxonomyRow>;
}

export class AdminQuestionsService implements IAdminQuestionsService {
  constructor(private readonly repository: IAdminQuestionsRepository) {}

  public async getQuestions(
    query: AdminGetQuestionsQuery,
  ): Promise<{ questions: AdminQuestionDetail[]; total: number }> {
    return this.repository.getQuestions(query);
  }

  public async getQuestionById(id: string): Promise<AdminQuestionDetail> {
    const question = await this.repository.getQuestionById(id);
    if (!question) {
      throw new NotFoundError("Question not found");
    }
    return question;
  }

  public async createQuestion(data: CreateQuestionBody): Promise<AdminQuestionDetail> {
    // Basic validation / rules could go here.
    return this.repository.createQuestion(data);
  }

  public async updateQuestion(id: string, data: UpdateQuestionBody): Promise<AdminQuestionDetail> {
    await this.getQuestionById(id); // Ensures it exists before updating
    return this.repository.updateQuestion(id, data);
  }

  public async publishQuestion(id: string): Promise<AdminQuestionDetail> {
    const question = await this.getQuestionById(id);
    if (question.status === "published") {
      throw new ValidationError("Question is already published");
    }
    try {
      return await this.repository.updateQuestionStatus(id, "published", question.status);
    } catch (error: unknown) {
      if (PersistenceError.is(error, PersistenceErrorCode.RECORD_UPDATE_CONFLICT)) {
        throw new AppError({
          statusCode: HTTP_STATUS.CONFLICT,
          code: ERROR_CODES.RESOURCE_CONFLICT,
          message: "Question state changed concurrently",
        });
      }
      throw error;
    }
  }

  public async archiveQuestion(id: string): Promise<AdminQuestionDetail> {
    const question = await this.getQuestionById(id);
    if (question.status !== "published") {
      throw new ValidationError("Only published questions can be archived");
    }
    try {
      return await this.repository.updateQuestionStatus(id, "archived", "published");
    } catch (error: unknown) {
      if (PersistenceError.is(error, PersistenceErrorCode.RECORD_UPDATE_CONFLICT)) {
        throw new AppError({
          statusCode: HTTP_STATUS.CONFLICT,
          code: ERROR_CODES.RESOURCE_CONFLICT,
          message: "Question state changed concurrently",
        });
      }
      throw error;
    }
  }

  public async restoreQuestion(id: string): Promise<AdminQuestionDetail> {
    const question = await this.getQuestionById(id);
    if (question.status !== "archived") {
      throw new ValidationError("Only archived questions can be restored");
    }
    try {
      return await this.repository.updateQuestionStatus(id, "draft", "archived");
    } catch (error: unknown) {
      if (PersistenceError.is(error, PersistenceErrorCode.RECORD_UPDATE_CONFLICT)) {
        throw new AppError({
          statusCode: HTTP_STATUS.CONFLICT,
          code: ERROR_CODES.RESOURCE_CONFLICT,
          message: "Question state changed concurrently",
        });
      }
      throw error;
    }
  }

  public async createTaxonomy(type: TaxonomyType, data: CreateTaxonomyBody): Promise<TaxonomyRow> {
    try {
      return await this.repository.createTaxonomy(type, data);
    } catch (error: unknown) {
      if (PersistenceError.is(error, PersistenceErrorCode.RECORD_ALREADY_EXISTS)) {
        throw new AppError({
          statusCode: HTTP_STATUS.CONFLICT,
          code: ERROR_CODES.RESOURCE_CONFLICT,
          message: "A taxonomy with this slug already exists",
        });
      }
      throw error;
    }
  }

  public async updateTaxonomy(
    type: TaxonomyType,
    id: string,
    data: UpdateTaxonomyBody,
  ): Promise<TaxonomyRow> {
    try {
      return await this.repository.updateTaxonomy(type, id, data);
    } catch (error: unknown) {
      if (PersistenceError.is(error, PersistenceErrorCode.RECORD_ALREADY_EXISTS)) {
        throw new AppError({
          statusCode: HTTP_STATUS.CONFLICT,
          code: ERROR_CODES.RESOURCE_CONFLICT,
          message: "A taxonomy with this slug already exists",
        });
      }
      throw error;
    }
  }

  public async archiveTaxonomy(type: TaxonomyType, id: string): Promise<TaxonomyRow> {
    try {
      return await this.repository.archiveTaxonomy(type, id);
    } catch (error: unknown) {
      if (PersistenceError.is(error, PersistenceErrorCode.RECORD_UPDATE_CONFLICT)) {
        throw new AppError({
          statusCode: HTTP_STATUS.CONFLICT,
          code: ERROR_CODES.RESOURCE_CONFLICT,
          message: "Taxonomy state changed concurrently",
        });
      }
      throw error;
    }
  }

  public async restoreTaxonomy(type: TaxonomyType, id: string): Promise<TaxonomyRow> {
    try {
      return await this.repository.restoreTaxonomy(type, id);
    } catch (error: unknown) {
      if (PersistenceError.is(error, PersistenceErrorCode.RECORD_UPDATE_CONFLICT)) {
        throw new AppError({
          statusCode: HTTP_STATUS.CONFLICT,
          code: ERROR_CODES.RESOURCE_CONFLICT,
          message: "Taxonomy state changed concurrently",
        });
      }
      throw error;
    }
  }
}
