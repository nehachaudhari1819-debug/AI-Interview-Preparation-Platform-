import { openApiDocument } from "../../../src/openapi/openapi-document.js";

describe("OpenAPI Document", () => {
  it("should have correct OpenAPI version", () => {
    expect(openApiDocument.openapi).toBe("3.1.0");
  });

  it("should have required info metadata", () => {
    expect(openApiDocument.info).toBeDefined();
    expect(openApiDocument.info.title).toBe("AI Interview Preparation Platform API");
    expect(openApiDocument.info.version).toBe("0.1.0");
  });

  it("should have globally unique operationIds", () => {
    const operationIds = new Set<string>();
    const paths = openApiDocument.paths;

    for (const [path, pathItem] of Object.entries(paths)) {
      for (const [method, operation] of Object.entries(pathItem)) {
        if (typeof operation === "object" && operation !== null && "operationId" in operation) {
          const opId = (operation as { operationId: string }).operationId;
          expect(operationIds.has(opId)).toBe(false); // Duplicate operationId found
          operationIds.add(opId);
        }
      }
    }
  });

  it("should not contain unimplemented endpoints in paths", () => {
    const paths = openApiDocument.paths;
    expect(paths["/api/v1/auth/register"]).toBeDefined();
    expect(paths["/api/v1/auth/login"]).toBeDefined();
    expect(paths["/api/v1/users"]).toBeUndefined(); // ensure no unapproved endpoints exist
  });
});
