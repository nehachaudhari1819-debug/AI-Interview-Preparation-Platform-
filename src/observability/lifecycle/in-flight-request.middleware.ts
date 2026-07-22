import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { InFlightRequestTracker } from "./in-flight-request-tracker.js";

export type CreateInFlightRequestMiddlewareOptions = {
  tracker: InFlightRequestTracker;
  excludePaths?: string[];
};

export function createInFlightRequestMiddleware({
  tracker,
  excludePaths = ["/health", "/health/ready"],
}: CreateInFlightRequestMiddlewareOptions): RequestHandler {
  return function inFlightRequestMiddleware(req: Request, res: Response, next: NextFunction) {
    if (excludePaths.includes(req.path)) {
      return next();
    }

    tracker.increment();
    let handled = false;

    const onDone = () => {
      if (handled) return;
      handled = true;
      tracker.decrement();
      res.removeListener("finish", onDone);
      res.removeListener("close", onDone);
    };

    res.on("finish", onDone);
    res.on("close", onDone);

    next();
  };
}
