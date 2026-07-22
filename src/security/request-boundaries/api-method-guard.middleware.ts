import type { Request, Response, NextFunction } from "express";
import { MethodNotAllowedError } from "../../errors/method-not-allowed.error.js";

const ALLOWED_METHODS = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]);

export function apiMethodGuard(request: Request, response: Response, next: NextFunction): void {
  const method = request.method.toUpperCase();

  if (!ALLOWED_METHODS.has(method)) {
    response.setHeader("Allow", "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS");
    next(new MethodNotAllowedError());
    return;
  }

  next();
}
