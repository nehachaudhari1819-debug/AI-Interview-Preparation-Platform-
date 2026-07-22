import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { ApplicationLifecycle } from "./application-lifecycle.js";
import { ServiceUnavailableError } from "../../errors/service-unavailable.error.js";

export type CreateShutdownAdmissionMiddlewareOptions = {
  lifecycle: ApplicationLifecycle;
};

export function createShutdownAdmissionMiddleware({
  lifecycle,
}: CreateShutdownAdmissionMiddlewareOptions): RequestHandler {
  return function shutdownAdmissionMiddleware(req: Request, res: Response, next: NextFunction) {
    if (req.path === "/health" || req.path === "/health/ready") {
      return next();
    }

    const { state } = lifecycle.getSnapshot();

    if (state === "shutting_down" || state === "failed" || state === "stopped") {
      return next(new ServiceUnavailableError());
    }

    next();
  };
}
