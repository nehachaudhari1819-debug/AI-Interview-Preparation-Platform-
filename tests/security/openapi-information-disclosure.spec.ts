import { openApiDocument } from "../../src/openapi/openapi-document.js";
import type { ApplicationConfig } from "../../src/config/app-config.js";

describe("OpenAPI Information Disclosure", () => {
  it("should not contain any environment variable secrets", () => {
    const jsonString = JSON.stringify(openApiDocument);

    // We shouldn't see raw keys or local paths
    expect(jsonString).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/i);
    expect(jsonString).not.toMatch(/LOG_CLIENT_IP_HASH_KEY/i);
    expect(jsonString).not.toMatch(/C:\\/i); // No windows paths
    expect(jsonString).not.toMatch(/\/home\//i); // No unix paths
  });

  it("should use fictional examples for sensitive fields", () => {
    const jsonString = JSON.stringify(openApiDocument);

    // Check for our fictional values to ensure they are used
    expect(jsonString).toMatch(/user@example.com/i);
    expect(jsonString).toMatch(/ExamplePass123!/);
    expect(jsonString).toMatch(/example-access-token/);

    // Check that we aren't using a real-looking JWT base64 string
    // A standard JWT regex (loose check) - we want to ensure we don't accidentally embed one
    const jwtRegex = /ey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/;
    expect(jwtRegex.test(jsonString)).toBe(false);
  });

  it("should not document internal health config route", () => {
    const paths = openApiDocument.paths;
    expect(paths["/health/config"]).toBeUndefined();
  });

  it("should not expose AdminQuestionDetail properties in student question responses", () => {
    const studentRoutes = [
      { path: "/api/v1/questions", method: "get" },
      { path: "/api/v1/questions/{questionId}", method: "get" },
    ];

    for (const route of studentRoutes) {
      const pathItem = openApiDocument.paths[route.path];
      const operation = (pathItem as any)[route.method];

      const responseSchema = operation.responses["200"]?.content?.["application/json"]?.schema;
      expect(responseSchema).toBeDefined();

      // Ensure that the referenced schema for data or data.items is not AdminQuestionDetail
      const jsonStr = JSON.stringify(responseSchema);
      expect(jsonStr).not.toMatch(/AdminQuestionDetail/);
      expect(jsonStr).toMatch(/QuestionSummary/);
    }
  });

  it("should not expose AdminTaxonomyRow in student taxonomy responses", () => {
    const studentTaxonomyRoutes = [
      "/api/v1/questions/categories",
      "/api/v1/questions/difficulties",
      "/api/v1/questions/interview-types",
      "/api/v1/questions/skills",
      "/api/v1/questions/topics",
    ];
    for (const route of studentTaxonomyRoutes) {
      const pathItem = openApiDocument.paths[route];
      const operation = (pathItem as any)["get"];

      const responseSchema = operation.responses["200"]?.content?.["application/json"]?.schema;
      expect(responseSchema).toBeDefined();

      const jsonStr = JSON.stringify(responseSchema);
      expect(jsonStr).not.toMatch(/AdminTaxonomyRow/);
      expect(jsonStr).toMatch(/TaxonomyResponse/);
    }
  });
});
