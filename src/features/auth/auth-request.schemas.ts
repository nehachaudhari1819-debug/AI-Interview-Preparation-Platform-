import { z } from "zod";
import { ValidationError } from "../../errors/validation.error.js";
import type { ApiFieldError } from "../../types/api-response.types.js";

export const registerRequestSchema = z
  .object({
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

function mapZodErrorToSafeFields(error: z.ZodError): ApiFieldError[] {
  return error.errors.map((issue) => {
    const field = issue.path.join(".");
    return {
      field: field === "" ? "body" : field,
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
