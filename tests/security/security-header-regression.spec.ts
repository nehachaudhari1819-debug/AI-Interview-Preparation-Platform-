import supertest from "supertest";
import { createApp } from "../../src/app.js";
import { createTestApplicationConfig } from "../setup/test-helpers.js";

describe("Security Header Regression", () => {
  it("Helmet headers remain on errors, X-Powered-By is absent", async () => {
    const config = createTestApplicationConfig();
    const app = createApp({ config });
    const request = supertest(app);

    const res = await request.trace("/api/v1/auth/me"); // 405 error

    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("DENY");
  });
});
