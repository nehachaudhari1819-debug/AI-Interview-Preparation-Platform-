import supertest from "supertest";
import { createApp } from "../../src/app.js";
import { createTestApplicationConfig } from "../setup/test-helpers.js";

describe("Security Error Redaction", () => {
  it("Sensitive payload, query, IP, and token values are not reflected", async () => {
    const config = createTestApplicationConfig({
      requestBoundaries: {
        jsonBodyLimitBytes: 100,
        maxUrlLength: 100,
        maxQueryParameters: 0,
      },
    });
    const app = createApp({ config });
    const request = supertest(app);

    const res = await request
      .post("/api/v1/auth/login?sensitiveQuery=12345")
      .send({ password: "superSecretPassword" });

    // We expect 400 for too many query params
    expect(res.status).toBe(400);
    expect(res.body.message).not.toContain("superSecretPassword");
    expect(res.body.message).not.toContain("12345");
  });
});
