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
import { userProfileSchemas } from "./components/user-profile.components.js";
import { userProfilePaths } from "./paths/user-profile.paths.js";
import { userPreferencesSchemas } from "./components/user-preferences.components.js";
import { userPreferencesPaths } from "./paths/user-preferences.paths.js";
import {
  questionSchemas,
  questionResponses,
  questionParameters,
} from "./components/questions.components.js";
import { questionPaths } from "./paths/questions.paths.js";
import { adminQuestionPaths } from "./paths/admin-questions.paths.js";
import { interviewSchemas } from "./components/interviews.components.js";
import { interviewsPaths } from "./paths/interviews.paths.js";

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
    ...userProfilePaths,
    ...userPreferencesPaths,
    ...questionPaths,
    ...adminQuestionPaths,
    ...interviewsPaths,
  },
  components: {
    schemas: {
      ...commonSchemas,
      ...authSchemas,
      ...healthSchemas,
      ...userProfileSchemas,
      ...userPreferencesSchemas,
      ...questionSchemas,
      ...interviewSchemas,
    },
    responses: {
      ...commonResponses,
      ...authResponses,
      ...healthResponses,
      ...questionResponses,
    },
    parameters: {
      ...questionParameters,
    },
    headers: {
      ...commonHeaders,
    },
    securitySchemes: {
      ...commonSecuritySchemes,
    },
  },
};
