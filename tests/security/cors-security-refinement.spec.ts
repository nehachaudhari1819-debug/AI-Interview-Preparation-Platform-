import supertest from "supertest";
import { createApp } from "../../src/app.js";
import { createTestApplicationConfig } from "../setup/test-helpers.js";

describe("CORS Security Refinement", () => {
  it("sets correct CORS headers", async () => {
    const config = createTestApplicationConfig({
      security: {
        trustProxyHops: 0,
        cors: {
          allowedOrigins: ["http://localhost:5173"],
          credentials: true,
          preflightMaxAgeSeconds: 600,
        },
        helmet: { enableHsts: false },
      },
    });
    const app = createApp({ config });
    const request = supertest(app);

    const res = await request
      .options("/api/v1/auth/login")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "POST");

    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(res.headers["access-control-allow-methods"]).toBe(
      "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS",
    );
  });
});
