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
      { path: "/api/v1/users/me", method: "get" },
      { path: "/api/v1/users/me/preferences", method: "get" },
      { path: "/api/v1/users/me/preferences", method: "patch" },
      { path: "/api/v1/questions", method: "get" },
      { path: "/api/v1/questions/{questionId}", method: "get" },
      { path: "/api/v1/questions/categories", method: "get" },
      { path: "/api/v1/questions/difficulties", method: "get" },
      { path: "/api/v1/questions/interview-types", method: "get" },
      { path: "/api/v1/questions/skills", method: "get" },
      { path: "/api/v1/questions/topics", method: "get" },
      { path: "/api/v1/admin/questions", method: "get" },
      { path: "/api/v1/admin/questions", method: "post" },
      { path: "/api/v1/admin/questions/{questionId}", method: "get" },
      { path: "/api/v1/admin/questions/{questionId}", method: "patch" },
      { path: "/api/v1/admin/questions/{questionId}/publish", method: "post" },
      { path: "/api/v1/admin/questions/{questionId}/archive", method: "post" },
      { path: "/api/v1/admin/questions/{questionId}/restore", method: "post" },
      { path: "/api/v1/admin/taxonomies/{taxonomyType}", method: "post" },
      { path: "/api/v1/admin/taxonomies/{taxonomyType}/{taxonomyId}", method: "patch" },
      { path: "/api/v1/admin/taxonomies/{taxonomyType}/{taxonomyId}/archive", method: "post" },
      { path: "/api/v1/admin/taxonomies/{taxonomyType}/{taxonomyId}/restore", method: "post" },
      { path: "/api/v1/interviews", method: "get" },
      { path: "/api/v1/interviews", method: "post" },
      { path: "/api/v1/interviews/{interviewId}", method: "get" },
      { path: "/api/v1/interviews/{interviewId}", method: "patch" },
      { path: "/api/v1/interviews/{interviewId}/sessions", method: "get" },
      { path: "/api/v1/interviews/{interviewId}/sessions", method: "post" },
      { path: "/api/v1/interviews/{interviewId}/sessions/{sessionId}", method: "get" },
      { path: "/api/v1/interviews/{interviewId}/sessions/{sessionId}/start", method: "post" },
      { path: "/api/v1/interviews/{interviewId}/sessions/{sessionId}/pause", method: "post" },
      { path: "/api/v1/interviews/{interviewId}/sessions/{sessionId}/resume", method: "post" },
      { path: "/api/v1/interviews/{interviewId}/sessions/{sessionId}/complete", method: "post" },
      { path: "/api/v1/interviews/{interviewId}/sessions/{sessionId}/questions", method: "get" },
      {
        path: "/api/v1/interviews/{interviewId}/sessions/{sessionId}/questions/{sessionQuestionId}",
        method: "get",
      },
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
      "/api/v1/users/me",
      "/api/v1/users/me/preferences",
      "/api/v1/questions",
      "/api/v1/questions/{questionId}",
      "/api/v1/questions/categories",
      "/api/v1/questions/difficulties",
      "/api/v1/questions/interview-types",
      "/api/v1/questions/skills",
      "/api/v1/questions/topics",
      "/api/v1/admin/questions",
      "/api/v1/admin/questions/{questionId}",
      "/api/v1/admin/questions/{questionId}/publish",
      "/api/v1/admin/questions/{questionId}/archive",
      "/api/v1/admin/questions/{questionId}/restore",
      "/api/v1/admin/taxonomies/{taxonomyType}",
      "/api/v1/admin/taxonomies/{taxonomyType}/{taxonomyId}",
      "/api/v1/admin/taxonomies/{taxonomyType}/{taxonomyId}/archive",
      "/api/v1/admin/taxonomies/{taxonomyType}/{taxonomyId}/restore",
      "/api/v1/interviews",
      "/api/v1/interviews/{interviewId}",
      "/api/v1/interviews/{interviewId}/sessions",
      "/api/v1/interviews/{interviewId}/sessions/{sessionId}",
      "/api/v1/interviews/{interviewId}/sessions/{sessionId}/start",
      "/api/v1/interviews/{interviewId}/sessions/{sessionId}/pause",
      "/api/v1/interviews/{interviewId}/sessions/{sessionId}/resume",
      "/api/v1/interviews/{interviewId}/sessions/{sessionId}/complete",
      "/api/v1/interviews/{interviewId}/sessions/{sessionId}/questions",
      "/api/v1/interviews/{interviewId}/sessions/{sessionId}/questions/{sessionQuestionId}",
    ];

    for (const documented of documentedPaths) {
      expect(expectedPaths).toContain(documented);
    }
  });
});
