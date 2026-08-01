import { z } from "zod";
import { ValidationError } from "../../errors/validation.error.js";

// Helper for validating unique arrays
const uniqueArray = (arr: string[]): boolean => new Set(arr).size === arr.length;

export const CreateInterviewSchema = z
  .object({
    title: z.string().trim().min(1).max(100),
    targetRole: z.string().trim().min(1).max(100),
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    interviewTypeId: z.string().uuid(),
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    difficultyId: z.string().uuid(),
    questionCount: z.number().int().min(1).max(20),
    timeLimitMinutes: z.number().int().min(5).max(120).nullable(),
    skillIds: z
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      .array(z.string().uuid())
      .min(1)
      .max(10)
      .refine(uniqueArray, "Duplicate skill IDs are not allowed"),
    topicIds: z
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      .array(z.string().uuid())
      .max(10)
      .refine(uniqueArray, "Duplicate topic IDs are not allowed")
      .optional()
      .nullable(),
  })
  .strict();

export type CreateInterviewBody = z.infer<typeof CreateInterviewSchema>;

export function parseCreateInterviewBody(body: unknown): CreateInterviewBody {
  const result = CreateInterviewSchema.safeParse(body);
  if (!result.success) {
    throw new ValidationError("Invalid create interview payload", result.error.issues);
  }
  return result.data;
}

export const UpdateInterviewSchema = z
  .object({
    expectedUpdatedAt: z.iso.datetime({ offset: true }),
    payload: z
      .object({
        title: z.string().trim().min(1).max(100).optional(),
        targetRole: z.string().trim().min(1).max(100).optional(),
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        interviewTypeId: z.string().uuid().optional(),
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        difficultyId: z.string().uuid().optional(),
        questionCount: z.number().int().min(1).max(20).optional(),
        timeLimitMinutes: z.number().int().min(5).max(120).nullable().optional(),
        skillIds: z
          // eslint-disable-next-line @typescript-eslint/no-deprecated
          .array(z.string().uuid())
          .min(1)
          .max(10)
          .refine(uniqueArray, "Duplicate skill IDs are not allowed")
          .optional(),
        topicIds: z
          // eslint-disable-next-line @typescript-eslint/no-deprecated
          .array(z.string().uuid())
          .max(10)
          .refine(uniqueArray, "Duplicate topic IDs are not allowed")
          .optional(),
      })
      .strict()
      .refine((data) => Object.keys(data).length > 0, "Update payload cannot be empty"),
  })
  .strict();

export type UpdateInterviewBody = z.infer<typeof UpdateInterviewSchema>;

export function parseUpdateInterviewBody(body: unknown): UpdateInterviewBody {
  const result = UpdateInterviewSchema.safeParse(body);
  if (!result.success) {
    throw new ValidationError("Invalid update interview payload", result.error.issues);
  }
  return result.data;
}

const SortFieldSchema = z.enum(["createdAt", "updatedAt"]);
const SortDirectionSchema = z.enum(["asc", "desc"]);

export const GetInterviewsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: SortFieldSchema.default("createdAt"),
    sortDir: SortDirectionSchema.default("desc"),
  })
  .strict();

export type GetInterviewsQuery = z.infer<typeof GetInterviewsQuerySchema>;

export function parseGetInterviewsQuery(query: unknown): GetInterviewsQuery {
  const result = GetInterviewsQuerySchema.safeParse(query);
  if (!result.success) {
    throw new ValidationError("Invalid query parameters", result.error.issues);
  }
  return result.data;
}

const SessionStatusSchema = z.enum(["ready", "in_progress", "paused", "completed"]);

export const GetSessionsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: SortFieldSchema.default("createdAt"),
    sortDir: SortDirectionSchema.default("desc"),
    status: z
      .union([z.string(), z.array(z.string())])
      .transform((val) => (Array.isArray(val) ? val.join(",") : val))
      .transform((val) =>
        val
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      )
      .transform((arr) => [...new Set(arr)])
      .transform((arr) => {
        const parsed = arr.map((s) => SessionStatusSchema.safeParse(s));
        return parsed.filter((res) => res.success).map((res) => res.data);
      })
      .refine((arr) => arr.length > 0, "No valid status provided")
      .optional(),
    createdFrom: z.iso.datetime({ offset: true }).optional(),
    createdTo: z.iso.datetime({ offset: true }).optional(),
  })
  .strict()
  .refine(
    (data) => {
      if (data.createdFrom && data.createdTo) {
        return new Date(data.createdFrom) <= new Date(data.createdTo);
      }
      return true;
    },
    { message: "createdFrom must be less than or equal to createdTo", path: ["createdFrom"] },
  );

export type GetSessionsQuery = z.infer<typeof GetSessionsQuerySchema>;

export function parseGetSessionsQuery(query: unknown): GetSessionsQuery {
  const result = GetSessionsQuerySchema.safeParse(query);
  if (!result.success) {
    throw new ValidationError("Invalid query parameters", result.error.issues);
  }
  return result.data;
}

export const PaginationQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

export function parsePaginationQuery(query: unknown): PaginationQuery {
  const result = PaginationQuerySchema.safeParse(query);
  if (!result.success) {
    throw new ValidationError("Invalid pagination parameters", result.error.issues);
  }
  return result.data;
}

// eslint-disable-next-line @typescript-eslint/no-deprecated
export const UuidSchema = z.string().uuid();

export function parseId(id: unknown): string {
  const result = UuidSchema.safeParse(id);
  if (!result.success) {
    throw new ValidationError("Invalid UUID format", result.error.issues);
  }
  return result.data;
}

export const StrictEmptyBodySchema = z
  .object({})
  .strict()
  .refine((data) => Object.keys(data).length === 0, "Request body must be strictly empty");

export function parseStrictEmptyBody(body: unknown): void {
  const result = StrictEmptyBodySchema.safeParse(body);
  if (!result.success) {
    throw new ValidationError("Invalid request body", result.error.issues);
  }
}
