import request from "supertest";
import { createApp } from "../../src/app.js";
import { createTestApplicationConfig } from "../setup/test-helpers.js";

describe("CSRF Request Origin", () => {
  const config = createTestApplicationConfig();
  const app = createApp({ config });

  it("blocks cross-site fetch site on POST", async () => {
    const response = await request(app)
      .post("/api/v1/health")
      .set("Origin", "http://localhost:5173")
      .set("Sec-Fetch-Site", "cross-site");

    const body = response.body as { code: string };
    expect(body.code).toBe("CSRF_ORIGIN_DENIED");
  });
});
