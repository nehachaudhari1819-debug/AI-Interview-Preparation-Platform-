import { openApiDocument } from "../../../src/openapi/openapi-document.js";
import { commonSchemas } from "../../../src/openapi/components/common.components.js";
import { authSchemas } from "../../../src/openapi/components/auth.components.js";

describe("OpenAPI Components", () => {
  it("should have globally unique component schema names", () => {
    const schemas = openApiDocument.components?.schemas;
    expect(schemas).toBeDefined();

    const keys = Object.keys(schemas || {});
    const uniqueKeys = new Set(keys);

    expect(keys.length).toEqual(uniqueKeys.size);
  });

  it("should contain standard error response in common schemas", () => {
    expect(commonSchemas["StandardErrorResponse"]).toBeDefined();
    expect(commonSchemas["ApiMeta"]).toBeDefined();
  });

  it("should contain authentication response schemas", () => {
    expect(authSchemas["AuthenticatedSessionResponse"]).toBeDefined();
  });

  it("should verify all local references resolve", () => {
    const jsonString = JSON.stringify(openApiDocument);
    const regex = /"\$ref":\s*"#\/components\/(schemas|responses|headers)\/([^"]+)"/g;
    let match;

    while ((match = regex.exec(jsonString)) !== null) {
      const type = match[1] as string; // schemas, responses, etc.
      const name = match[2] as string; // e.g. ApiMeta

      const componentSection = (openApiDocument.components as any)[type];
      expect(componentSection).toBeDefined();
      expect(componentSection[name]).toBeDefined();
    }
  });
});
