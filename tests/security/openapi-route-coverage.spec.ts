import { openApiDocument } from "../../src/openapi/openapi-document.js";
import { createApp } from "../../src/app.js";
import { createTestApplicationConfig } from "../setup/test-helpers.js";
import { bootstrapObservability } from "../../src/observability/index.js";
import { createSafeConfigSummary } from "../../src/config/index.js";
import { createHttpServer } from "../../src/server/create-http-server.js";
import express from "express";

describe("OpenAPI Route Coverage", () => {
  it("should document all primary API routes", () => {
    const config = createTestApplicationConfig();
    const tempApp = express();
    const server = createHttpServer(tempApp, config);
    const observability = bootstrapObservability({ config, server });

    const app = createApp({
      config,
      observability,
      configSummary: createSafeConfigSummary(config),
    });

    // We do a lightweight check for known routes that exist in the Express app.
    // Full AST reflection of Express is notoriously brittle, but we know our contract.
    const requiredRoutes = [
      { path: "/health", method: "get" },
      { path: "/health/ready", method: "get" },
      { path: "/api/v1/auth/register", method: "post" },
      { path: "/api/v1/auth/login", method: "post" },
      { path: "/api/v1/auth/refresh", method: "post" },
      { path: "/api/v1/auth/logout", method: "post" },
      { path: "/api/v1/auth/me", method: "get" },
    ];

    for (const route of requiredRoutes) {
      const pathItem = openApiDocument.paths[route.path];
      expect(pathItem).toBeDefined();

      const operation = (pathItem as any)[route.method];
      expect(operation).toBeDefined();
    }

    observability.unregisterProcessHandlers();
  });

  it("should not contain paths that do not exist in our defined required routes", () => {
    // Ensures we didn't add phantom routes to the OpenAPI spec
    const documentedPaths = Object.keys(openApiDocument.paths);
    const expectedPaths = [
      "/health",
      "/health/ready",
      "/api/v1/auth/register",
      "/api/v1/auth/login",
      "/api/v1/auth/refresh",
      "/api/v1/auth/logout",
      "/api/v1/auth/me",
    ];

    for (const documented of documentedPaths) {
      expect(expectedPaths).toContain(documented);
    }
  });
});
