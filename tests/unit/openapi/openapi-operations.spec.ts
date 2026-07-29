import { openApiDocument } from "../../../src/openapi/openapi-document.js";

describe("OpenAPI Operations", () => {
  it("should have a non-empty, unique operationId for all Question Bank operations", () => {
    const paths = Object.keys(openApiDocument.paths).filter(
      (p) => p.includes("/questions") || p.includes("/taxonomies"),
    );

    const operationIds = new Set<string>();
    let operationsCount = 0;

    for (const path of paths) {
      const pathItem = openApiDocument.paths[path];
      if (!pathItem) continue;

      const methods: ("get" | "post" | "put" | "patch" | "delete")[] = [
        "get",
        "post",
        "put",
        "patch",
        "delete",
      ];

      for (const method of methods) {
        const operation = pathItem[method];
        if (operation) {
          operationsCount++;
          expect(operation.operationId).toBeDefined();
          expect(typeof operation.operationId).toBe("string");
          expect(operation.operationId?.length).toBeGreaterThan(0);

          if (operation.operationId) {
            // Assert uniqueness
            expect(operationIds.has(operation.operationId)).toBe(false);
            operationIds.add(operation.operationId);
          }
        }
      }
    }

    // Expect exactly 18 operations based on P4.6 rules
    expect(operationsCount).toBe(18);
    expect(operationIds.size).toBe(18);
  });
});
