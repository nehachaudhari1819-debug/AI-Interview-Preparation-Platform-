import type { Request, Response, NextFunction } from "express";

export function authNoStoreMiddleware(req: Request, res: Response, next: NextFunction): void {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  next();
}
