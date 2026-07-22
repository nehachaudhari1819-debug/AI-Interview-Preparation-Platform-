import supertest from "supertest";
import { createApp } from "../../src/app.js";
import { createTestApplicationConfig } from "../setup/test-helpers.js";

describe("API Payload Boundary", () => {
  it("rejects oversized bodies with 413 and malformed with 400", async () => {
    const config = createTestApplicationConfig({
      requestBoundaries: {
        jsonBodyLimitBytes: 100,
        maxUrlLength: 2048,
        maxQueryParameters: 50,
      },
    });
    const app = createApp({ config });
    const request = supertest(app);

    // Oversized
    const res1 = await request.post("/api/v1/auth/login").send({ data: "a".repeat(150) });
    expect(res1.status).toBe(413);

    // Malformed
    const res2 = await request
      .post("/api/v1/auth/login")
      .set("Content-Type", "application/json")
      .send('{"a":1');
    expect(res2.status).toBe(400);

    // Compressed (we don't accept deflate/gzip natively on purpose)
    const res3 = await request
      .post("/api/v1/auth/login")
      .set("Content-Encoding", "gzip")
      .send('{"a":1}');
    expect(res3.status).toBe(415);
  });
});
