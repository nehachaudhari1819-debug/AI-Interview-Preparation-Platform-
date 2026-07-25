import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { sendSuccess } from "../../utils/api-response.js";
import { HTTP_STATUS } from "../../constants/http.constants.js";
import { requireAuthenticatedPrincipal } from "../../auth/require-authenticated-principal.js";
import type { UserPreferencesService } from "./user-preferences.service.js";
import { UpdateUserPreferencesInputSchema } from "./user-preferences.schemas.js";
import { AppError } from "../../errors/app-error.js";

export function createGetPreferencesController() {
  return asyncHandler(async (req: Request, res: Response) => {
    const principal = requireAuthenticatedPrincipal(req);
    const service = res.locals.userPreferencesService as UserPreferencesService | undefined;

    if (!service) {
      throw new Error("UserPreferencesService not found in request context");
    }

    const preferences = await service.getPreferences(principal.userId);

    // Security requirement for P3.8: Cache-Control: no-store
    res.set("Cache-Control", "no-store");

    return sendSuccess({
      response: res,
      statusCode: HTTP_STATUS.OK,
      data: preferences,
      requestId: req.context.requestId,
    });
  });
}

export function createUpdatePreferencesController() {
  return asyncHandler(async (req: Request, res: Response) => {
    const principal = requireAuthenticatedPrincipal(req);
    const service = res.locals.userPreferencesService as UserPreferencesService | undefined;

    if (!service) {
      throw new Error("UserPreferencesService not found in request context");
    }

    const parseResult = UpdateUserPreferencesInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new AppError({
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: "VALIDATION_ERROR",
        message: "Invalid preferences format",
      });
    }

    const preferences = await service.updatePreferences(principal.userId, parseResult.data);

    // Security requirement for P3.8: Cache-Control: no-store
    res.set("Cache-Control", "no-store");

    return sendSuccess({
      response: res,
      statusCode: HTTP_STATUS.OK,
      data: preferences,
      requestId: req.context.requestId,
    });
  });
}
