import express from "express";
import type { RequestHandler } from "express";
import type { ApplicationConfig } from "../../config/app-config.js";

export function createJsonBodyParser(config: Readonly<ApplicationConfig>): RequestHandler {
  return express.json({
    limit: config.requestBoundaries.jsonBodyLimitBytes,
    strict: true,
    inflate: false,
    type: ["application/json", "application/*+json"],
  });
}
