import type { RequestContext } from "./request-context.types.js";
import type { ApplicationLogger } from "../observability/logging/index.js";

declare global {
  namespace Express {
    interface Request {
      context: RequestContext;
      log?: ApplicationLogger;
    }
  }
}

export {};
