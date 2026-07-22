import { openApiDocument } from "../../../src/openapi/openapi-document.js";

describe("OpenAPI Paths", () => {
  const requirePath = (path: string) => {
    const pathItem = openApiDocument.paths[path];
    if (!pathItem) {
      throw new Error(`Missing OpenAPI path: ${path}`);
    }
    return pathItem;
  };

  it("should have correct path prefixes", () => {
    const paths = Object.keys(openApiDocument.paths);
    for (const path of paths) {
      // Must either start with /api/v1/ or /health
      const isValidPrefix = path.startsWith("/api/v1/") || path.startsWith("/health");
      expect(isValidPrefix).toBe(true);
    }
  });

  it("should not contain any configuration endpoints", () => {
    const paths = openApiDocument.paths;
    expect(paths["/health/config"]).toBeUndefined();
  });

  it("should correctly document methods", () => {
    const login = requirePath("/api/v1/auth/login");
    expect(login).toBeDefined();
    expect(login.post).toBeDefined();
    expect(login.get).toBeUndefined(); // Login is POST only
  });
});
