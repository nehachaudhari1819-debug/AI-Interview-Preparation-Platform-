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

  it("should document exactly 16 paths and 18 operations for Question Bank", () => {
    const paths = Object.keys(openApiDocument.paths).filter(
      (p) => p.includes("/questions") || p.includes("/taxonomies"),
    );

    // We expect exactly 16 paths
    expect(paths.length).toBe(16);

    let operationsCount = 0;
    for (const path of paths) {
      const pathItem = openApiDocument.paths[path];
      if (pathItem) {
        if (pathItem.get) operationsCount++;
        if (pathItem.post) operationsCount++;
        if (pathItem.patch) operationsCount++;
        if (pathItem.delete) operationsCount++;
      }
    }

    // We expect exactly 18 operations (7 student + 11 admin)
    expect(operationsCount).toBe(18);
  });
});
