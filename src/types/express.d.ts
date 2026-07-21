import type { RequestContext } from "./request-context.types.js";

declare global {
  namespace Express {
    interface Request {
      context: RequestContext;
    }
  }
}

export {};
