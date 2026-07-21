import type { Request, Response } from "express";
import type { ApplicationConfig } from "../../config/app-config.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { sendSuccess } from "../../utils/api-response.js";
import { HTTP_STATUS } from "../../constants/http.constants.js";
import { parseLoginRequest, parseRegisterRequest } from "./auth-request.schemas.js";
import type { AuthService } from "./auth.service.js";
import {
  clearRefreshTokenCookie,
  readRefreshTokenCookie,
  setRefreshTokenCookie,
} from "./auth-cookie.js";
import { requireAuthenticatedPrincipal } from "../../auth/require-authenticated-principal.js";

export function createRegisterController(
  config: Readonly<ApplicationConfig>,
  service: AuthService,
) {
  return asyncHandler(async (req: Request, res: Response) => {
    const input = parseRegisterRequest(req.body);
    const { result, refreshToken } = await service.register(input);

    if (result.status === "authenticated" && refreshToken) {
      setRefreshTokenCookie(res, config, refreshToken);
      return sendSuccess({
        response: res,
        statusCode: HTTP_STATUS.CREATED,
        data: result,
        message: "Authentication successful.",
        requestId: req.context.requestId,
      });
    }

    return sendSuccess({
      response: res,
      statusCode: HTTP_STATUS.ACCEPTED,
      data: result,
      message: "message" in result ? result.message : undefined,
      requestId: req.context.requestId,
    });
  });
}

export function createLoginController(config: Readonly<ApplicationConfig>, service: AuthService) {
  return asyncHandler(async (req: Request, res: Response) => {
    const input = parseLoginRequest(req.body);
    const { publicSession, refreshToken } = await service.login(input);

    setRefreshTokenCookie(res, config, refreshToken);

    return sendSuccess({
      response: res,
      statusCode: HTTP_STATUS.OK,
      data: publicSession,
      message: "Authentication successful.",
      requestId: req.context.requestId,
    });
  });
}

export function createRefreshController(config: Readonly<ApplicationConfig>, service: AuthService) {
  return asyncHandler(async (req: Request, res: Response) => {
    const currentRefreshToken = readRefreshTokenCookie(req, config);

    try {
      const { publicSession, rotatedRefreshToken } = await service.refresh(
        currentRefreshToken as string,
      );

      setRefreshTokenCookie(res, config, rotatedRefreshToken);

      return sendSuccess({
        response: res,
        statusCode: HTTP_STATUS.OK,
        data: publicSession,
        message: "Session refreshed successfully.",
        requestId: req.context.requestId,
      });
    } catch (error) {
      clearRefreshTokenCookie(res, config);
      throw error;
    }
  });
}

export function createLogoutController(config: Readonly<ApplicationConfig>, service: AuthService) {
  return asyncHandler(async (req: Request, res: Response) => {
    try {
      const currentRefreshToken = readRefreshTokenCookie(req, config);
      await service.logout(currentRefreshToken);
    } finally {
      clearRefreshTokenCookie(res, config);
      res.status(HTTP_STATUS.NO_CONTENT).send();
    }
  });
}

export function createMeController() {
  // eslint-disable-next-line @typescript-eslint/require-await
  return asyncHandler(async (req: Request, res: Response) => {
    const principal = requireAuthenticatedPrincipal(req);

    return sendSuccess({
      response: res,
      statusCode: HTTP_STATUS.OK,
      data: { principal },
      message: "Authenticated user retrieved.",
      requestId: req.context.requestId,
    });
  });
}
