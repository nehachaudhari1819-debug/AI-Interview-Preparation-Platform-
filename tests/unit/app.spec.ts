import request from "supertest";

import { createApp } from "../../src/app.js";

describe("application foundation", () => {
  it("returns 404 for an undefined route", async () => {
    const app = createApp();

    const response = await request(app).get("/undefined-route");

    expect(response.status).toBe(404);
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });
});
