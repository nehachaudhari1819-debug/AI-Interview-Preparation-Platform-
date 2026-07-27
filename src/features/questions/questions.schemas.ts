import { z } from "zod";
import { ValidationError } from "../../errors/validation.error.js";

const SortFieldSchema = z.enum(["createdAt", "updatedAt"]);
const SortDirectionSchema = z.enum(["asc", "desc"]);
export const TaxonomyTypeSchema = z.enum([
  "categories",
  "difficulties",
  "interview-types",
  "skills",
  "topics",
]);

/**
 * Normalizes query parameters into an array of UUIDs.
 * Express parses single parameters as string, repeated as array.
 * We also support comma-separated strings.
 */
const uuidArrayTransformer = z.preprocess(
  (val) => {
    if (Array.isArray(val)) {
      return val as unknown;
    }
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (trimmed === "") return [];
      return trimmed.split(",").map((s) => s.trim());
    }
    return undefined; // Let optional handle it if not provided
  },
  z
    .array(
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      z.string().uuid(),
    )
    .max(10)
    .optional()
    .transform((arr) => (arr && arr.length > 0 ? arr : undefined)),
);

export const GetQuestionsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().min(3).max(100).optional(),
    sortBy: SortFieldSchema.default("createdAt"),
    sortDir: SortDirectionSchema.default("desc"),
    categoryId: uuidArrayTransformer,
    difficultyId: uuidArrayTransformer,
    interviewTypeId: uuidArrayTransformer,
    skillId: uuidArrayTransformer,
    topicId: uuidArrayTransformer,
  })
  .strict()
  .transform((data) => {
    // If search is empty string after trim, remove it
    if (data.search === "") {
      data.search = undefined;
    }
    return data;
  });

export type GetQuestionsQuery = z.infer<typeof GetQuestionsQuerySchema>;

export function parseGetQuestionsQuery(query: unknown): GetQuestionsQuery {
  const result = GetQuestionsQuerySchema.safeParse(query);
  if (!result.success) {
    throw new ValidationError("Query validation failed.", result.error.issues);
  }
  return result.data;
}

// eslint-disable-next-line @typescript-eslint/no-deprecated
export const QuestionIdSchema = z.string().uuid();

export function parseQuestionId(id: unknown): string {
  const result = QuestionIdSchema.safeParse(id);
  if (!result.success) {
    throw new ValidationError("Invalid question ID format.", result.error.issues);
  }
  return result.data;
}

export type TaxonomyType = z.infer<typeof TaxonomyTypeSchema>;

export function parseTaxonomyType(type: unknown): TaxonomyType {
  const result = TaxonomyTypeSchema.safeParse(type);
  if (!result.success) {
    throw new ValidationError("Invalid taxonomy type.", result.error.issues);
  }
  return result.data;
}
