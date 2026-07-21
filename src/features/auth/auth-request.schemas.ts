import { z, type ZodError } from "zod";
import { ValidationError } from "../../errors/validation.error.js";
import type { ApiFieldError } from "../../types/api-response.types.js";

export const registerRequestSchema = z
  .object({
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(8).max(128),
  })
  .strict();

export const loginRequestSchema = z
  .object({
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(8).max(128),
  })
  .strict();

export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;

function mapZodErrorToSafeFields(error: z.ZodError<any>): ApiFieldError[] {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  return error.errors.map((issue: z.ZodIssue) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const field = issue.path.join(".");
    return {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      field: field === "" ? "body" : field,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      message: issue.message,
    };
  });
}

export function parseRegisterRequest(body: unknown): RegisterRequest {
  const result = registerRequestSchema.safeParse(body);
  if (!result.success) {
    throw new ValidationError("Invalid request body.", mapZodErrorToSafeFields(result.error));
  }
  return result.data;
}

export function parseLoginRequest(body: unknown): LoginRequest {
  const result = loginRequestSchema.safeParse(body);
  if (!result.success) {
    throw new ValidationError("Invalid request body.", mapZodErrorToSafeFields(result.error));
  }
  return result.data;
}
