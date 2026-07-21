import { Router } from "express";
import request from "supertest";

import { createApp } from "../../src/app.js";
import { createTestApplicationConfig } from "../setup/test-helpers.js";
import { ERROR_CODES } from "../../src/constants/error-codes.constants.js";

type ErrorEnvelope = {
  success: false;
  code: string;
  meta: {
    requestId: string;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseErrorEnvelope(text: string): ErrorEnvelope {
  const parsed = JSON.parse(text) as unknown;

  if (
    !isRecord(parsed) ||
    parsed.success !== false ||
    typeof parsed.code !== "string" ||
    !isRecord(parsed.meta) ||
    typeof parsed.meta.requestId !== "string"
  ) {
    throw new Error("Response is not a valid API error envelope.");
  }

  return {
    success: false,
    code: parsed.code,
    meta: {
      requestId: parsed.meta.requestId,
    },
  };
}

describe("Application Integration", () => {
  it("GET /unknown returns 404 RESOURCE_NOT_FOUND", async () => {
    const config = createTestApplicationConfig();
    const app = createApp({ config });

    const response = await request(app).get("/unknown");
    const body = parseErrorEnvelope(response.text);

    expect(response.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.code).toBe(ERROR_CODES.RESOURCE_NOT_FOUND);
    expect(body.meta.requestId).toBeDefined();
    expect(response.headers["x-request-id"]).toBe(body.meta.requestId);
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });

  it("GET /api/v1/unknown returns 404 RESOURCE_NOT_FOUND", async () => {
    const config = createTestApplicationConfig();
    const app = createApp({ config });

    const response = await request(app).get("/api/v1/unknown");
    const body = parseErrorEnvelope(response.text);

    expect(response.status).toBe(404);
    expect(body.code).toBe(ERROR_CODES.RESOURCE_NOT_FOUND);
  });

  it("preserves valid X-Request-ID header", async () => {
    const config = createTestApplicationConfig();
    const app = createApp({ config });
    const validUuid = "123e4567-e89b-12d3-a456-426614174000";

    const response = await request(app).get("/unknown").set("X-Request-ID", validUuid);
    const body = parseErrorEnvelope(response.text);

    expect(response.headers["x-request-id"]).toBe(validUuid);
    expect(body.meta.requestId).toBe(validUuid);
  });

  it("handles oversized JSON with 413 PAYLOAD_TOO_LARGE", async () => {
    const testRouter = Router();
    testRouter.post("/test-json", (req, res) => {
      res.json({ ok: true });
    });

    const config = createTestApplicationConfig();
    const app = createApp({ config, apiRouter: testRouter });

    // Generate > 1MB of JSON
    const largePayload = { data: "a".repeat(2 * 1024 * 1024) };

    const response = await request(app)
      .post("/api/v1/test-json")
      .set("Origin", config.frontend.origin)
      .send(largePayload);
    const body = parseErrorEnvelope(response.text);

    expect(response.status).toBe(413);
    expect(body.code).toBe(ERROR_CODES.PAYLOAD_TOO_LARGE);
  });

  it("handles invalid JSON with 400 INVALID_JSON", async () => {
    const testRouter = Router();
    testRouter.post("/test-json", (req, res) => {
      res.json({ ok: true });
    });

    const config = createTestApplicationConfig();
    const app = createApp({ config, apiRouter: testRouter });

    const response = await request(app)
      .post("/api/v1/test-json")
      .set("Content-Type", "application/json")
      .set("Origin", config.frontend.origin)
      .send("{ invalid json }");
    const body = parseErrorEnvelope(response.text);

    expect(response.status).toBe(400);
    expect(body.code).toBe(ERROR_CODES.INVALID_JSON);
  });
});
