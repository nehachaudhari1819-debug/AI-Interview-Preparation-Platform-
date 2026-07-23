import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { sendSuccess } from "../../utils/api-response.js";
import { HTTP_STATUS } from "../../constants/http.constants.js";
import { requireAuthenticatedPrincipal } from "../../auth/require-authenticated-principal.js";
import type { UserProfileService } from "./user-profile.service.js";
import { mapUserProfileToResponse } from "./user-profile-response.mapper.js";

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
