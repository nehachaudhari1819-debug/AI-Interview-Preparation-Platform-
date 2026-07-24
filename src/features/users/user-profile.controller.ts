import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { sendSuccess } from "../../utils/api-response.js";
import { HTTP_STATUS } from "../../constants/http.constants.js";
import { requireAuthenticatedPrincipal } from "../../auth/require-authenticated-principal.js";
import type { UserProfileService } from "./user-profile.service.js";
import { mapUserProfileToResponse } from "./user-profile-response.mapper.js";
import { parseUpdateUserProfileRequest } from "./user-profile.schemas.js";

export function createGetMeController() {
  return asyncHandler(async (req: Request, res: Response) => {
    const principal = requireAuthenticatedPrincipal(req);
    const service = res.locals.userProfileService as UserProfileService | undefined;

    if (!service) {
      throw new Error("UserProfileService not found in request context");
    }

    const profile = await service.getCurrentUserProfile(principal.userId);
    const safeResponse = mapUserProfileToResponse(profile);

    return sendSuccess({
      response: res,
      statusCode: HTTP_STATUS.OK,
      data: { user: safeResponse },
      requestId: req.context.requestId,
    });
  });
}

export function createUpdateMeController() {
  return asyncHandler(async (req: Request, res: Response) => {
    const principal = requireAuthenticatedPrincipal(req);
    const service = res.locals.userProfileService as UserProfileService | undefined;

    if (!service) {
      throw new Error("UserProfileService not found in request context");
    }

    const input = parseUpdateUserProfileRequest(req.body);
    const changedFields = Object.keys(input);
    const profile = await service.updateCurrentUserProfile(principal.userId, input);
    const safeResponse = mapUserProfileToResponse(profile);

    // Inject audit metadata for the audit middleware
    res.locals.auditMetadata = { changedFields };
    res.locals.auditResourceId = principal.userId;

    return sendSuccess({
      response: res,
      statusCode: HTTP_STATUS.OK,
      data: { user: safeResponse },
      requestId: req.context.requestId,
    });
  });
}
