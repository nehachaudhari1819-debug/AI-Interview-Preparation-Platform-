import supertest from "supertest";
import { createApp } from "../../src/app.js";
import { createTestApplicationConfig } from "../setup/test-helpers.js";

describe("API Request Target Boundary", () => {
  it("rejects long URIs and too many query parameters", async () => {
    const config = createTestApplicationConfig({
      requestBoundaries: {
        jsonBodyLimitBytes: 1000,
        maxUrlLength: 100,
        maxQueryParameters: 5,
      },
    });
    const app = createApp({ config });
    const request = supertest(app);

    // Long URI
    const res1 = await request.get("/api/v1/auth/me?test=" + "a".repeat(150));
    expect(res1.status).toBe(414);

    // Too many query parameters
    const res2 = await request.get("/api/v1/auth/me?a=1&b=2&c=3&d=4&e=5&f=6");
    expect(res2.status).toBe(400);
  });
});
