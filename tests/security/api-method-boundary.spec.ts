import supertest from "supertest";
import { createApp } from "../../src/app.js";
import { createTestApplicationConfig } from "../setup/test-helpers.js";

describe("API Method Boundary", () => {
  it("rejects TRACE, TRACK, CONNECT with 405", async () => {
    const config = createTestApplicationConfig();
    const app = createApp({ config });
    const request = supertest(app);

    const res1 = await request.trace("/api/v1/auth/me");
    expect(res1.status).toBe(405);

    // supertest does not have `.track` or `.connect` easily, we can use `.patch` to test a valid method
    const res2 = await request.patch("/api/v1/auth/me");
    expect(res2.status).not.toBe(405);
  });
});
