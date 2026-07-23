import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { sendSuccess } from "../../utils/api-response.js";
import { HTTP_STATUS } from "../../constants/http.constants.js";
import { requireAuthenticatedPrincipal } from "../../auth/require-authenticated-principal.js";
import { AppError } from "../../errors/app-error.js";
import { IdempotencyKeySchema } from "./account-deletion.schemas.js";
import type { AccountDeletionService } from "./account-deletion.service.js";
import { mapAccountDeletionToResponse } from "./account-deletion-response.mapper.js";
import { clearRefreshTokenCookie } from "../auth/auth-cookie.js";
import type { ApplicationConfig } from "../../config/app-config.js";

export function createDeleteMeController(config: Readonly<ApplicationConfig>) {
  return asyncHandler(async (req: Request, res: Response) => {
    // 1. Require authenticated principal
    const principal = requireAuthenticatedPrincipal(req);

    // 2. Validate empty body
    if (
      req.body &&
      typeof req.body === "object" &&
      Object.keys(req.body as Record<string, unknown>).length > 0
    ) {
      throw new AppError({
        statusCode: 422,
        code: "VALIDATION_ERROR",
        message: "Request body is not allowed for this operation.",
      });
    }

    // 3. Validate Idempotency-Key
    const rawKey = req.headers["idempotency-key"];
    if (!rawKey) {
      throw new AppError({
        statusCode: 400,
        code: "IDEMPOTENCY_KEY_REQUIRED",
        message: "Idempotency-Key header is required.",
      });
    }

    // Prevent duplicate headers logic (express gives array if duplicated)
    if (Array.isArray(rawKey)) {
      throw new AppError({
        statusCode: 400,
        code: "IDEMPOTENCY_KEY_INVALID",
        message: "Duplicate Idempotency-Key headers are not allowed.",
      });
    }

    const parsedKey = IdempotencyKeySchema.safeParse(rawKey);
    if (!parsedKey.success) {
      throw new AppError({
        statusCode: 400,
        code: "IDEMPOTENCY_KEY_INVALID",
        message: "Invalid Idempotency-Key header format.",
      });
    }
    const idempotencyKey = parsedKey.data;

    // 4. Extract service from context
    const service = res.locals.accountDeletionService as AccountDeletionService | undefined;
    if (!service) {
      throw new Error("AccountDeletionService not found in request context");
    }

    // Extract access token safely
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      // Middleware should have caught this, but just in case
      throw new AppError({
        statusCode: 401,
        code: "AUTHENTICATION_REQUIRED",
        message: "Authentication is required.",
      });
    }
    const accessToken = authHeader.substring(7);

    // 5. Execute lifecycle service
    const result = await service.deleteCurrentAccount({
      userId: principal.userId,
      accessToken,
      idempotencyKey,
      requestId: req.context.requestId,
    });

    // 6. Clear refresh cookie on success
    clearRefreshTokenCookie(res, config);

    // 7. Return 200 with safe response
    return sendSuccess({
      response: res,
      statusCode: HTTP_STATUS.OK,
      data: mapAccountDeletionToResponse(result),
      requestId: req.context.requestId,
    });
  });
}
