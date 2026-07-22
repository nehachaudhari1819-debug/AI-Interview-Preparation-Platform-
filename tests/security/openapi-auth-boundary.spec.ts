import { openApiDocument } from "../../src/openapi/openapi-document.js";

describe("OpenAPI Security Boundaries", () => {
  it("should not expose protected routes as public", () => {
    const meRoute = openApiDocument.paths["/api/v1/auth/me"]!;
    expect(meRoute).toBeDefined();
    expect(meRoute.get?.security).toBeDefined();

    // Ensure BearerAuth is required for /me
    const hasBearer = meRoute.get?.security?.some((req) => req.BearerAuth !== undefined);
    expect(hasBearer).toBe(true);
  });

  it("should not falsely protect public routes", () => {
    const loginRoute = openApiDocument.paths["/api/v1/auth/login"]!;
    expect(loginRoute).toBeDefined();
    expect(loginRoute.post?.security).toBeUndefined(); // Should be fully public

    const registerRoute = openApiDocument.paths["/api/v1/auth/register"]!;
    expect(registerRoute).toBeDefined();
    expect(registerRoute.post?.security).toBeUndefined(); // Should be fully public
  });

  it("should require CookieAuth for refresh", () => {
    const refreshRoute = openApiDocument.paths["/api/v1/auth/refresh"]!;
    expect(refreshRoute).toBeDefined();
    expect(refreshRoute.post?.security).toBeDefined();

    const hasCookie = refreshRoute.post?.security?.some((req) => req.CookieAuth !== undefined);
    expect(hasCookie).toBe(true);
  });
});
