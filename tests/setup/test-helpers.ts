import type { ApiErrorResponse, ApiSuccessResponse } from "../../src/types/api-response.types.js";

export function isApiSuccessResponse(body: unknown): body is ApiSuccessResponse<unknown> {
  return typeof body === "object" && body !== null && (body as Record<string, unknown>).success === true;
}

export function isApiErrorResponse(body: unknown): body is ApiErrorResponse {
  return typeof body === "object" && body !== null && (body as Record<string, unknown>).success === false;
}

export const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
