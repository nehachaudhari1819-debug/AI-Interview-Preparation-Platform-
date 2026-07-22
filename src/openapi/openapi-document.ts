import type { OpenApiDocument } from "./openapi.types.js";
import {
  commonSchemas,
  commonResponses,
  commonHeaders,
  commonSecuritySchemes,
} from "./components/common.components.js";
import { authSchemas, authResponses } from "./components/auth.components.js";
import { healthSchemas, healthResponses } from "./components/health.components.js";
import { authPaths } from "./paths/auth.paths.js";
import { healthPaths } from "./paths/health.paths.js";

export const openApiDocument: OpenApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "AI Interview Preparation Platform API",
    description: "Backend API for the AI Interview Preparation Platform for Engineering Students",
    version: "0.1.0",
  },
  servers: [
    {
      url: "http://localhost:5000",
      description: "Local development server",
    },
    {
      url: "https://api.example.com",
      description: "Production server (example)",
    },
  ],
  paths: {
    ...healthPaths,
    ...authPaths,
  },
  components: {
    schemas: {
      ...commonSchemas,
      ...authSchemas,
      ...healthSchemas,
    },
    responses: {
      ...commonResponses,
      ...authResponses,
      ...healthResponses,
    },
    headers: {
      ...commonHeaders,
    },
    securitySchemes: {
      ...commonSecuritySchemes,
    },
  },
};
