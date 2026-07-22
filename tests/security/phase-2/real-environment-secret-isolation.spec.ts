import { jest } from "@jest/globals";
import request from "supertest";
import { HTTP_STATUS } from "../../../src/constants/http.constants.js";
import type { Express } from "express";
import type { Server } from "node:http";
import { appConfig, createTestApp } from "../../setup/real-environment.js";

describe("Real Environment: Secret Isolation and Log Redaction", () => {
  let app: Express;
  let server: Server;

  // We need to capture logs to ensure they don't contain secrets.
  // The app uses pino, which writes to process.stdout. We can spy on it.
  let stdoutSpy: any;

  beforeAll(() => {
    stdoutSpy = jest.spyOn(process.stdout, "write").mockImplementation(() => true);

    // Create an app configuration that uses a fake privileged key to ensure it isn't leaked
    const safeConfig = {
      ...appConfig,
      supabase: {
        ...appConfig.supabase,
        privilegedKey: "super-secret-service-role-key-that-should-never-be-leaked",
      },
    };

    const testBoot = createTestApp(safeConfig);
    app = testBoot.app;
    server = testBoot.server;
  });

  afterAll(() => {
    stdoutSpy.mockRestore();
    server.close();
  });

  beforeEach(() => {
    stdoutSpy.mockClear();
  });

  it("redacts passwords from error responses and logs when validation fails", async () => {
    const password = "SecretPassword123!";

    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "test@example.test", password })
      .expect(HTTP_STATUS.UNAUTHORIZED); // The login fails against real DB

    const body = response.body;

    // Response should not contain password
    expect(JSON.stringify(body)).not.toContain(password);

    // Logs should not contain password
    const logCalls = stdoutSpy.mock.calls.map((call: any[]) => call[0] as string).join("");
    expect(logCalls).not.toContain(password);
  });

  it("redacts refresh tokens from error responses and logs", async () => {
    const fakeRefreshToken = "fake-refresh-token-value-should-be-redacted";

    const response = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `refresh_token=${fakeRefreshToken}`)
      .expect(HTTP_STATUS.UNAUTHORIZED);

    const body = response.body;

    // Response should not contain token
    expect(JSON.stringify(body)).not.toContain(fakeRefreshToken);

    // Logs should not contain token
    const logCalls = stdoutSpy.mock.calls.map((call: any[]) => call[0] as string).join("");
    expect(logCalls).not.toContain(fakeRefreshToken);
  });

  it("never leaks the privileged service role key", async () => {
    // Make a request that will trigger an internal failure or just a normal request
    await request(app).post("/api/v1/auth/register").send({ email: "invalid", password: "bad" });

    // The privileged key must never appear in any log output
    const logCalls = stdoutSpy.mock.calls.map((call: any[]) => call[0] as string).join("");
    expect(logCalls).not.toContain("super-secret-service-role-key");
  });
});
