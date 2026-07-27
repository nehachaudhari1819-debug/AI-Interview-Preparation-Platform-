import { z } from "zod";
import { ValidationError } from "../../errors/validation.error.js";
import { GetQuestionsQuerySchema } from "./questions.schemas.js";

const AdminSortFieldSchema = z.enum(["createdAt", "updatedAt", "publishedAt"]);
export const QuestionStatusSchema = z.enum(["draft", "published", "archived"]);

export const AdminGetQuestionsQuerySchema = GetQuestionsQuerySchema.extend({
  sortBy: AdminSortFieldSchema.default("createdAt"),
  status: z
    .preprocess((val) => {
      if (typeof val === "string") {
        const trimmed = val.trim();
        if (trimmed === "") return [];
        return trimmed.split(",").map((s) => s.trim());
      }
      if (Array.isArray(val)) return val as string[];
      return undefined;
    }, z.array(QuestionStatusSchema).max(3).optional())
    .transform((arr) => (arr && arr.length > 0 ? arr : undefined)),
});

export type AdminGetQuestionsQuery = z.infer<typeof AdminGetQuestionsQuerySchema>;

export function parseAdminGetQuestionsQuery(query: unknown): AdminGetQuestionsQuery {
  const result = AdminGetQuestionsQuerySchema.safeParse(query);
  if (!result.success) {
    throw new ValidationError("Query validation failed.", result.error.issues);
  }
  return result.data;
}

export const CreateQuestionBodySchema = z
  .object({
    questionText: z.string().min(5).max(2000),
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    categoryId: z.string().uuid(),
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    difficultyId: z.string().uuid(),
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    interviewTypeId: z.string().uuid(),
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    skillIds: z.array(z.string().uuid()).min(1).max(10),
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    topicIds: z.array(z.string().uuid()).max(10).default([]),
    referenceAnswer: z.string().min(5).max(5000),
    evaluationGuidance: z.record(z.string(), z.unknown()).default({}), // Or stricter if we know the schema
  })
  .strict();

export type CreateQuestionBody = z.infer<typeof CreateQuestionBodySchema>;

export function parseCreateQuestionBody(body: unknown): CreateQuestionBody {
  const result = CreateQuestionBodySchema.safeParse(body);
  if (!result.success) {
    throw new ValidationError("Validation failed for CreateQuestionBody.", result.error.issues);
  }
  return result.data;
}

export const UpdateQuestionBodySchema = CreateQuestionBodySchema.partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, "Update body cannot be empty");

export type UpdateQuestionBody = z.infer<typeof UpdateQuestionBodySchema>;

export function parseUpdateQuestionBody(body: unknown): UpdateQuestionBody {
  const result = UpdateQuestionBodySchema.safeParse(body);
  if (!result.success) {
    throw new ValidationError("Validation failed for UpdateQuestionBody.", result.error.issues);
  }
  return result.data;
}

export const CreateTaxonomyBodySchema = z
  .object({
    slug: z.string().min(1).max(100),
    name: z.string().min(1).max(100),
    description: z.string().max(500).nullable().default(null),
    displayOrder: z.number().int().default(0),
    isActive: z.boolean().default(true),
  })
  .strict();

export type CreateTaxonomyBody = z.infer<typeof CreateTaxonomyBodySchema>;

export function parseCreateTaxonomyBody(body: unknown): CreateTaxonomyBody {
  const result = CreateTaxonomyBodySchema.safeParse(body);
  if (!result.success) {
    throw new ValidationError("Validation failed for CreateTaxonomyBody.", result.error.issues);
  }
  return result.data;
}

export const UpdateTaxonomyBodySchema = CreateTaxonomyBodySchema.partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, "Update body cannot be empty");

export type UpdateTaxonomyBody = z.infer<typeof UpdateTaxonomyBodySchema>;

export function parseUpdateTaxonomyBody(body: unknown): UpdateTaxonomyBody {
  const result = UpdateTaxonomyBodySchema.safeParse(body);
  if (!result.success) {
    throw new ValidationError("Validation failed for UpdateTaxonomyBody.", result.error.issues);
  }
  return result.data;
}
