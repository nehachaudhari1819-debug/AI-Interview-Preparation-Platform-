import { Router } from "express";

export function createApiV1Router(): Router {
  const router = Router();

  return router;
}

export const apiV1Router = createApiV1Router();
