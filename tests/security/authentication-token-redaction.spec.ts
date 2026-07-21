import { jest } from "@jest/globals";
import request from "supertest";
import { Router } from "express";
import { inspect } from "node:util";
import { createApp } from "../../src/app.js";
import { createTestApplicationConfig } from "../setup/test-helpers.js";
import { createAuthenticationMiddleware } from "../../src/auth/create-authentication-middleware.js";

describe("Authentication Token Redaction Security", () => {
  const FAKE_TOKEN = "fake-super-secret-user-access-token";
  let logs: string[] = [];
  let errors: string[] = [];

  const originalLog = console.log;
  const originalError = console.error;

  beforeAll(() => {
    console.log = (...args) =>
      logs.push(args.map((a) => (typeof a === "string" ? a : inspect(a))).join(" "));
    console.error = (...args) =>
      errors.push(args.map((a) => (typeof a === "string" ? a : inspect(a))).join(" "));
  });

  afterAll(() => {
    console.log = originalLog;
    console.error = originalError;
  });

  beforeEach(() => {
    logs = [];
    errors = [];
  });

  const setupApp = (mockVerify: jest.Mock<any>) => {
    const config = createTestApplicationConfig();
    const verifier = { verify: mockVerify };
    const apiRouter = Router();

    apiRouter.get(
      "/protected",
      createAuthenticationMiddleware({ config, verifier }),
      (req, res) => {
        res.json({ ok: true, ctx: req.context });
      },
    );

    apiRouter.get("/throw", createAuthenticationMiddleware({ config, verifier }), (req, res) => {
      throw new Error("Generic route error");
    });

    return createApp({ config, apiRouter });
  };

  it("redacts token from error messages and logs on invalid verification", async () => {
    const mockVerify = jest.fn<any>().mockResolvedValue({ success: false, reason: "invalid" });
    const app = setupApp(mockVerify);

    const response = await request(app)
      .get("/api/v1/protected")
      .set("Authorization", `Bearer ${FAKE_TOKEN}`);

    expect(response.status).toBe(401);

    const responseString = JSON.stringify(response.body);
    expect(responseString).not.toContain(FAKE_TOKEN);
    expect(response.headers["www-authenticate"]).not.toContain(FAKE_TOKEN);

    const logsString = logs.join(" ");
    const errorsString = errors.join(" ");
    expect(logsString).not.toContain(FAKE_TOKEN);
    expect(errorsString).not.toContain(FAKE_TOKEN);
  });

  it("redacts token from request context upon success", async () => {
    const validClaims = {
      iss: "https://example.com/auth/v1",
      aud: "authenticated",
      exp: 1700000000 + 3600,
      iat: 1700000000 - 3600,
      sub: "d290f1ee-6c54-4b01-90e6-d701748f0851",
      role: "authenticated",
      aal: "aal1",
      session_id: "e440f1ee-6c54-4b01-90e6-d701748f0852",
      is_anonymous: false,
    };

    // Pass config so issuer matches
    const config = createTestApplicationConfig();
    (config as any).supabase = { configured: true, url: "https://example.com" };

    const mockVerify = jest.fn<any>().mockResolvedValue({ success: true, claims: validClaims });
    const app = createApp({
      config,
      apiRouter: Router().get(
        "/protected",
        createAuthenticationMiddleware({
          config,
          verifier: { verify: mockVerify },
          now: () => 1700000000000,
        }),
        (req, res) => res.json({ ctx: req.context }),
      ),
    });

    const response = await request(app)
      .get("/api/v1/protected")
      .set("Authorization", `Bearer ${FAKE_TOKEN}`);

    expect(response.status).toBe(200);
    const responseString = JSON.stringify(response.body);
    expect(responseString).not.toContain(FAKE_TOKEN);
  });

  it("redacts token when application throws unexpected error", async () => {
    const validClaims = {
      iss: "https://example.com/auth/v1",
      aud: "authenticated",
      exp: 1700000000 + 3600,
      iat: 1700000000 - 3600,
      sub: "d290f1ee-6c54-4b01-90e6-d701748f0851",
      role: "authenticated",
      aal: "aal1",
      session_id: "e440f1ee-6c54-4b01-90e6-d701748f0852",
      is_anonymous: false,
    };

    const config = createTestApplicationConfig();
    (config as any).supabase = { configured: true, url: "https://example.com" };
    const mockVerify = jest.fn<any>().mockResolvedValue({ success: true, claims: validClaims });

    const app = createApp({
      config,
      apiRouter: Router().get(
        "/throw",
        createAuthenticationMiddleware({
          config,
          verifier: { verify: mockVerify },
          now: () => 1700000000000,
        }),
        (req, res) => {
          throw new Error("Kaboom!");
        },
      ),
    });

    const response = await request(app)
      .get("/api/v1/throw")
      .set("Authorization", `Bearer ${FAKE_TOKEN}`);

    expect(response.status).toBe(500);

    const responseString = JSON.stringify(response.body);
    expect(responseString).not.toContain(FAKE_TOKEN);

    const errorsString = errors.join(" ");
    expect(errorsString).toContain("Kaboom!");
    expect(errorsString).not.toContain(FAKE_TOKEN);
  });
});
