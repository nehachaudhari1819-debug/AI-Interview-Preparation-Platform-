import request from "supertest";
import { createApp } from "../../src/app.js";
import { createTestApplicationConfig } from "../setup/test-helpers.js";

describe("application foundation", () => {
  it("returns 404 for an undefined route", async () => {
    const config = createTestApplicationConfig();
    const app = createApp({ config });

    const response = await request(app).get("/undefined-route");

    expect(response.status).toBe(404);
  });
});
