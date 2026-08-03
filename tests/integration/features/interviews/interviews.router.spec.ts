import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";
import { Router } from "express";
import { createApp } from "../../../../src/app.js";
import { createTestApplicationConfig } from "../../../setup/test-helpers.js";
import { createInterviewsRouter } from "../../../../src/features/interviews/interviews.router.js";
import { createAuthenticationMiddleware } from "../../../../src/auth/create-authentication-middleware.js";

describe("Interviews Router & Security Integration", () => {
  const config = createTestApplicationConfig();
  (config as any).supabase = { configured: true, url: "https://example.com" };

  let mockService: any;
  let verifier: any;
  let app: any;

  beforeEach(() => {
    mockService = {
      saveDraftAnswer: jest.fn().mockResolvedValue({
        replayed: false,
        snapshot: { id: "a1", status: "draft", version: 1 },
      }),
      updateDraftAnswer: jest.fn().mockResolvedValue({
        replayed: false,
        snapshot: { id: "a1", status: "draft", version: 2 },
      }),
      finalizeAnswer: jest.fn().mockResolvedValue({
        replayed: false,
        snapshot: { id: "a1", status: "finalized", version: 2 },
      }),
    };

    verifier = {
      verify: jest.fn().mockResolvedValue({
        success: true,
        claims: {
          sub: "user-123",
          role: "authenticated",
        },
      }),
    };

    const authMiddleware = createAuthenticationMiddleware({
      config,
      verifier,
      now: () => Date.now(),
    });

    const interviewsRouter = createInterviewsRouter(mockService, authMiddleware);

    // Provide the expected mount point for API
    const apiRouter = Router();
    apiRouter.use("/interviews", interviewsRouter);

    app = createApp({ config, apiRouter });
  });

  const urlDraft =
    "/api/v1/interviews/123e4567-e89b-12d3-a456-426614174000/sessions/123e4567-e89b-12d3-a456-426614174001/questions/123e4567-e89b-12d3-a456-426614174002/answer";
  const urlFinalize =
    "/api/v1/interviews/123e4567-e89b-12d3-a456-426614174000/sessions/123e4567-e89b-12d3-a456-426614174001/questions/123e4567-e89b-12d3-a456-426614174002/answer/finalize";

  it("should return 401 Unauthorized without token (Save Draft)", async () => {
    verifier.verify.mockResolvedValue({ success: false, reason: "invalid" });
    const res = await request(app).put(urlDraft).send({ responseType: "text", textResponse: "Hi" });
    expect(res.status).toBe(401);
  });

  it("should return 400 Bad Request on invalid schema payload (Save Draft)", async () => {
    const res = await request(app)
      .put(urlDraft)
      .set("Authorization", "Bearer valid")
      .send({ responseType: "text" }); // missing textResponse
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("BAD_REQUEST");
  });

  it("should return 200/201 on valid saveDraftAnswer", async () => {
    const res = await request(app)
      .put(urlDraft)
      .set("Authorization", "Bearer valid")
      .set("Idempotency-Key", "ik-1")
      .send({ responseType: "text", textResponse: "Valid" });
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe("a1");
  });

  it("should return 400 Bad Request on invalid schema payload (Update Draft)", async () => {
    const res = await request(app)
      .patch(urlDraft)
      .set("Authorization", "Bearer valid")
      .send({ responseType: "text", textResponse: "Valid", expectedVersion: -1 }); // negative version
    expect(res.status).toBe(400);
  });

  it("should return 200 on valid updateDraftAnswer", async () => {
    const res = await request(app)
      .patch(urlDraft)
      .set("Authorization", "Bearer valid")
      .set("Idempotency-Key", "ik-2")
      .send({ responseType: "text", textResponse: "Valid 2", expectedVersion: 1 });
    expect(res.status).toBe(200);
    expect(res.body.data.version).toBe(2);
  });

  it("should return 400 Bad Request on invalid schema payload (Finalize Answer)", async () => {
    const res = await request(app)
      .post(urlFinalize)
      .set("Authorization", "Bearer valid")
      .send({}); // missing expectedVersion
    expect(res.status).toBe(400);
  });

  it("should return 200 on valid finalizeAnswer", async () => {
    const res = await request(app)
      .post(urlFinalize)
      .set("Authorization", "Bearer valid")
      .set("Idempotency-Key", "ik-3")
      .send({ expectedVersion: 2 });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("finalized");
  });
});
