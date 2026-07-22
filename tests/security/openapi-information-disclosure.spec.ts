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
});
