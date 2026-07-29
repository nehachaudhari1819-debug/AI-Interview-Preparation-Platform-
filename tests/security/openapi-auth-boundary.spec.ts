import { openApiDocument } from "../../src/openapi/openapi-document.js";

describe("OpenAPI Security Boundaries", () => {
  const requirePath = (path: string) => {
    const pathItem = openApiDocument.paths[path];
    if (!pathItem) {
      throw new Error(`Missing OpenAPI path: ${path}`);
    }
    return pathItem;
  };

  it("should not expose protected routes as public", () => {
    const meRoute = requirePath("/api/v1/auth/me");
    expect(meRoute).toBeDefined();
    expect(meRoute.get?.security).toBeDefined();

    // Ensure BearerAuth is required for /me
    const hasBearer = meRoute.get?.security?.some((req) => req.BearerAuth !== undefined);
    expect(hasBearer).toBe(true);
  });

  it("should not falsely protect public routes", () => {
    const loginRoute = requirePath("/api/v1/auth/login");
    expect(loginRoute).toBeDefined();
    expect(loginRoute.post?.security).toBeUndefined(); // Should be fully public

    const registerRoute = requirePath("/api/v1/auth/register");
    expect(registerRoute).toBeDefined();
    expect(registerRoute.post?.security).toBeUndefined(); // Should be fully public
  });

  it("should require CookieAuth for refresh", () => {
    const refreshRoute = requirePath("/api/v1/auth/refresh");
    expect(refreshRoute).toBeDefined();
    expect(refreshRoute.post?.security).toBeDefined();

    const hasCookie = refreshRoute.post?.security?.some((req) => req.CookieAuth !== undefined);
    expect(hasCookie).toBe(true);
  });

  it("should require BearerAuth for all student question routes", () => {
    const studentRoutes = [
      { path: "/api/v1/questions", method: "get" },
      { path: "/api/v1/questions/{questionId}", method: "get" },
      { path: "/api/v1/questions/categories", method: "get" },
      { path: "/api/v1/questions/difficulties", method: "get" },
      { path: "/api/v1/questions/interview-types", method: "get" },
      { path: "/api/v1/questions/skills", method: "get" },
      { path: "/api/v1/questions/topics", method: "get" },
    ];

    for (const route of studentRoutes) {
      const pathItem = requirePath(route.path);
      const operation = (pathItem as any)[route.method];
      expect(operation.security).toBeDefined();
      const hasBearer = operation.security.some((req: any) => req.BearerAuth !== undefined);
      expect(hasBearer).toBe(true);
    }
  });

  it("should require BearerAuth and document 403 Forbidden for all admin question routes", () => {
    const adminRoutes = [
      { path: "/api/v1/admin/questions", method: "get" },
      { path: "/api/v1/admin/questions", method: "post" },
      { path: "/api/v1/admin/questions/{questionId}", method: "get" },
      { path: "/api/v1/admin/questions/{questionId}", method: "patch" },
      { path: "/api/v1/admin/questions/{questionId}/publish", method: "post" },
      { path: "/api/v1/admin/questions/{questionId}/archive", method: "post" },
      { path: "/api/v1/admin/questions/{questionId}/restore", method: "post" },
      { path: "/api/v1/admin/taxonomies/{taxonomyType}", method: "post" },
      { path: "/api/v1/admin/taxonomies/{taxonomyType}/{taxonomyId}", method: "patch" },
      { path: "/api/v1/admin/taxonomies/{taxonomyType}/{taxonomyId}/archive", method: "post" },
      { path: "/api/v1/admin/taxonomies/{taxonomyType}/{taxonomyId}/restore", method: "post" },
    ];

    for (const route of adminRoutes) {
      const pathItem = requirePath(route.path);
      const operation = (pathItem as any)[route.method];

      // Check Bearer Auth
      expect(operation.security).toBeDefined();
      const hasBearer = operation.security.some((req: any) => req.BearerAuth !== undefined);
      expect(hasBearer).toBe(true);

      // Check 403 Forbidden is documented
      expect(operation.responses["403"]).toBeDefined();
    }
  });
});
