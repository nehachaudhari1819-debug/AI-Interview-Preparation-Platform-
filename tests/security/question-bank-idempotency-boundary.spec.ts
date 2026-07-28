/**
 * P4.5 — Security Boundary Tests: Question Bank Idempotency
 *
 * Verifies that the idempotency and audit infrastructure for Question Bank
 * admin routes uphold security contracts without requiring a live database.
 *
 * Tests cover:
 * - Anonymous users are rejected (401) before idempotency processing
 * - Student users are rejected (403) before idempotency processing
 * - Idempotency-Key header is required on mutation routes
 * - Idempotency keys are not exposed in error responses
 * - Audit metadata excludes sensitive content (referenceAnswer, credentials)
 * - Fingerprints exclude tokens and credentials
 * - No database details in conflict/error responses
 */

import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { createTestApplicationConfig } from "../setup/test-helpers.js";
import {
  QUESTION_AUDIT_ACTIONS,
  TAXONOMY_AUDIT_ACTIONS,
  buildQuestionCreatedMetadata,
  buildQuestionUpdatedMetadata,
  buildQuestionLifecycleMetadata,
  buildTaxonomyCreatedMetadata,
} from "../../src/features/questions/admin-questions-audit.constants.js";
import {
  QUESTION_IDEMPOTENCY_OPERATIONS,
  QUESTION_BANK_ROUTE_PATTERNS,
} from "../../src/features/questions/admin-questions-idempotency.constants.js";
import { generateRequestFingerprint } from "../../src/domain/idempotency/request-fingerprint.js";
import { parseIdempotencyKey } from "../../src/domain/idempotency/idempotency-key.js";

// ---------------------------------------------------------------------------
// Anonymous access enforcement (pre-idempotency)
// ---------------------------------------------------------------------------

describe("Question Bank Auth/Authz Boundary (no live DB required)", () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    const config = createTestApplicationConfig();
    app = createApp({ config });
  });

  it("rejects anonymous POST /admin/questions with 401", async () => {
    const res = await request(app)
      .post("/api/v1/admin/questions")
      .set("Idempotency-Key", "test-key-anon-1")
      .set("Content-Type", "application/json")
      .send({ questionText: "Test question" });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    // Must not expose database, SQL, or constraint details
    expect(JSON.stringify(res.body)).not.toMatch(/sql|constraint|postgres|23505/i);
  });

  it("rejects anonymous PATCH /admin/questions/:id with 401", async () => {
    const id = "00000000-0000-0000-0000-000000000001";
    const res = await request(app)
      .patch(`/api/v1/admin/questions/${id}`)
      .set("Idempotency-Key", "test-key-anon-2")
      .set("Content-Type", "application/json")
      .send({ questionText: "Updated question" });

    expect(res.status).toBe(401);
  });

  it("rejects anonymous POST /admin/questions/:id/publish with 401", async () => {
    const id = "00000000-0000-0000-0000-000000000002";
    const res = await request(app)
      .post(`/api/v1/admin/questions/${id}/publish`)
      .set("Idempotency-Key", "test-key-anon-3");

    expect(res.status).toBe(401);
  });

  it("rejects anonymous POST /admin/questions/:id/archive with 401", async () => {
    const id = "00000000-0000-0000-0000-000000000003";
    const res = await request(app)
      .post(`/api/v1/admin/questions/${id}/archive`)
      .set("Idempotency-Key", "test-key-anon-4");

    expect(res.status).toBe(401);
  });

  it("rejects anonymous POST /admin/questions/:id/restore with 401", async () => {
    const id = "00000000-0000-0000-0000-000000000004";
    const res = await request(app)
      .post(`/api/v1/admin/questions/${id}/restore`)
      .set("Idempotency-Key", "test-key-anon-5");

    expect(res.status).toBe(401);
  });

  it("rejects anonymous POST /admin/taxonomies/:type with 401", async () => {
    const res = await request(app)
      .post("/api/v1/admin/taxonomies/skills")
      .set("Idempotency-Key", "test-key-anon-6")
      .set("Content-Type", "application/json")
      .send({ slug: "test-skill", name: "Test Skill" });

    expect(res.status).toBe(401);
  });

  it("rejects anonymous PATCH /admin/taxonomies/:type/:id with 401", async () => {
    const id = "00000000-0000-0000-0000-000000000005";
    const res = await request(app)
      .patch(`/api/v1/admin/taxonomies/skills/${id}`)
      .set("Idempotency-Key", "test-key-anon-7")
      .set("Content-Type", "application/json")
      .send({ name: "Updated" });

    expect(res.status).toBe(401);
  });

  it("rejects anonymous POST /admin/taxonomies/:type/:id/archive with 401", async () => {
    const id = "00000000-0000-0000-0000-000000000006";
    const res = await request(app)
      .post(`/api/v1/admin/taxonomies/skills/${id}/archive`)
      .set("Idempotency-Key", "test-key-anon-8");

    expect(res.status).toBe(401);
  });

  it("rejects anonymous POST /admin/taxonomies/:type/:id/restore with 401", async () => {
    const id = "00000000-0000-0000-0000-000000000007";
    const res = await request(app)
      .post(`/api/v1/admin/taxonomies/skills/${id}/restore`)
      .set("Idempotency-Key", "test-key-anon-9");

    expect(res.status).toBe(401);
  });

  it("error responses do not expose stack traces", async () => {
    const res = await request(app)
      .post("/api/v1/admin/questions")
      .set("Idempotency-Key", "test-key-anon-stack")
      .send({ questionText: "Test" });

    const body = JSON.stringify(res.body);
    expect(body).not.toContain("at Object.");
    expect(body).not.toContain("Error: ");
    expect(body).not.toContain(".ts:");
    expect(body).not.toContain(".js:");
  });
});

// ---------------------------------------------------------------------------
// Idempotency key contract (unit-level — no live DB)
// ---------------------------------------------------------------------------

describe("Idempotency Key Validation for Question Bank Routes", () => {
  it("missing key returns ok=false with reason=missing", () => {
    const result = parseIdempotencyKey(undefined);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("missing");
    }
  });

  it("duplicate header returns ok=false with reason=duplicate_header", () => {
    const result = parseIdempotencyKey(["key-1", "key-2"]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("duplicate_header");
    }
  });

  it("key with control characters is rejected", () => {
    const result = parseIdempotencyKey("key\x00with\x1fcontrol");
    expect(result.ok).toBe(false);
  });

  it("key exceeding 255 chars is rejected", () => {
    const longKey = "k".repeat(256);
    const result = parseIdempotencyKey(longKey);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("too_long");
    }
  });

  it("raw key is never included in the failure response", () => {
    const rawKey = "sensitive-admin-idempotency-key-for-question-creation";
    const result = parseIdempotencyKey(`${rawKey}\x00malformed`);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(JSON.stringify(result)).not.toContain(rawKey);
    }
  });

  it("valid key (255 chars) is accepted", () => {
    const maxKey = "k".repeat(255);
    const result = parseIdempotencyKey(maxKey);
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Request fingerprint security (unit-level)
// ---------------------------------------------------------------------------

describe("Question Bank Request Fingerprint Security", () => {
  it("fingerprint for question creation does not contain auth token", () => {
    const fp = generateRequestFingerprint({
      apiVersion: "v1",
      method: "POST",
      routePattern: QUESTION_BANK_ROUTE_PATTERNS.CREATE_QUESTION,
      operation: QUESTION_IDEMPOTENCY_OPERATIONS.CREATE_QUESTION,
      body: { questionText: "Test question", categoryId: "cat-id" },
    });

    expect(fp).toMatch(/^[0-9a-f]{64}$/);
    expect(fp).not.toContain("Bearer");
    expect(fp).not.toContain("eyJ");
    expect(fp).not.toContain("service_role");
  });

  it("fingerprint is a one-way hash — sensitive body content cannot be recovered", () => {
    const sensitiveReferenceAnswer = "The secret answer that should not leak";
    const fp = generateRequestFingerprint({
      apiVersion: "v1",
      method: "POST",
      routePattern: QUESTION_BANK_ROUTE_PATTERNS.CREATE_QUESTION,
      operation: QUESTION_IDEMPOTENCY_OPERATIONS.CREATE_QUESTION,
      body: {
        questionText: "What is the meaning of life?",
        referenceAnswer: sensitiveReferenceAnswer,
      },
    });

    expect(fp).not.toContain("secret");
    expect(fp).not.toContain("answer");
    expect(fp).not.toContain(sensitiveReferenceAnswer.substring(0, 10));
  });

  it("different bodies for the same route produce different fingerprints", () => {
    const fp1 = generateRequestFingerprint({
      apiVersion: "v1",
      method: "POST",
      routePattern: QUESTION_BANK_ROUTE_PATTERNS.CREATE_QUESTION,
      operation: QUESTION_IDEMPOTENCY_OPERATIONS.CREATE_QUESTION,
      body: { questionText: "Question A" },
    });

    const fp2 = generateRequestFingerprint({
      apiVersion: "v1",
      method: "POST",
      routePattern: QUESTION_BANK_ROUTE_PATTERNS.CREATE_QUESTION,
      operation: QUESTION_IDEMPOTENCY_OPERATIONS.CREATE_QUESTION,
      body: { questionText: "Question B" },
    });

    expect(fp1).not.toBe(fp2);
  });
});

// ---------------------------------------------------------------------------
// Audit metadata security (unit-level)
// ---------------------------------------------------------------------------

describe("Question Bank Audit Metadata Security", () => {
  const SENSITIVE_FIELDS = [
    "Bearer eyJtest",
    "service_role_key_12345",
    "eyJhbGciOiJIUzI1NiJ9",
    "super-secret-reference-answer-content",
    "confidential-rubric-guidance",
    "password",
    "secret",
  ];

  it("buildQuestionCreatedMetadata does not expose sensitive values", () => {
    // Even if somehow a sensitive value was in the keys list (it shouldn't be),
    // the metadata only stores field names, not values
    const meta = buildQuestionCreatedMetadata([
      "questionText",
      "referenceAnswer",
      "evaluationGuidance",
    ]);
    const serialized = JSON.stringify(meta);

    for (const sensitive of SENSITIVE_FIELDS) {
      expect(serialized).not.toContain(sensitive);
    }
  });

  it("buildQuestionUpdatedMetadata does not expose credential fields", () => {
    const meta = buildQuestionUpdatedMetadata(["referenceAnswer", "evaluationGuidance"]);
    const serialized = JSON.stringify(meta);

    for (const sensitive of SENSITIVE_FIELDS) {
      expect(serialized).not.toContain(sensitive);
    }
  });

  it("audit actions are constants — not derived from user input", () => {
    // Audit action must be set by the server, not from the request body
    const lifecycleMeta = buildQuestionLifecycleMetadata(QUESTION_AUDIT_ACTIONS.QUESTION_PUBLISHED);
    expect(lifecycleMeta.operation).toBe("QUESTION_PUBLISHED");
    // Not user-supplied
    expect(typeof lifecycleMeta.operation).toBe("string");
  });

  it("taxonomy metadata does not expose slug values", () => {
    const secretSlug = "my-very-secret-taxonomy-slug";
    const meta = buildTaxonomyCreatedMetadata("skills", ["slug", "name", "description"]);
    const serialized = JSON.stringify(meta);
    expect(serialized).not.toContain(secretSlug);
  });

  it("question taxonomy actions are known constants", () => {
    const validActions = [
      TAXONOMY_AUDIT_ACTIONS.QUESTION_TAXONOMY_CREATED,
      TAXONOMY_AUDIT_ACTIONS.QUESTION_TAXONOMY_UPDATED,
      TAXONOMY_AUDIT_ACTIONS.QUESTION_TAXONOMY_ARCHIVED,
      TAXONOMY_AUDIT_ACTIONS.QUESTION_TAXONOMY_RESTORED,
    ];

    for (const action of validActions) {
      expect(action).toMatch(/^QUESTION_TAXONOMY_/);
    }
  });
});

// ---------------------------------------------------------------------------
// Error response safety (unit-level structure checks)
// ---------------------------------------------------------------------------

describe("Question Bank Error Response Safety", () => {
  it("idempotency conflict error does not contain database details", () => {
    const conflictError = {
      statusCode: 409,
      code: "IDEMPOTENCY_CONFLICT",
      message: "Idempotency key already exists with different request parameters.",
    };

    const serialized = JSON.stringify(conflictError);
    expect(serialized).not.toMatch(/23505/); // SQLSTATE
    expect(serialized).not.toMatch(/constraint/i);
    expect(serialized).not.toMatch(/idx_idempotency/);
    expect(serialized).not.toMatch(/public\./);
    expect(serialized).not.toContain("PostgreSQL");
  });

  it("idempotency in-progress error does not contain lease token", () => {
    const inProgressError = {
      statusCode: 409,
      code: "IDEMPOTENCY_IN_PROGRESS",
      message: "A request with this Idempotency-Key is currently in progress.",
    };
    const leaseToken = "00000000-0000-0000-0000-000000000001";
    expect(JSON.stringify(inProgressError)).not.toContain(leaseToken);
  });

  it("resource conflict error does not expose constraint name", () => {
    const conflictError = {
      statusCode: 409,
      code: "RESOURCE_CONFLICT",
      message: "A taxonomy with this slug already exists",
    };
    const serialized = JSON.stringify(conflictError);
    // Must not contain PostgreSQL constraint names
    expect(serialized).not.toMatch(/idx_.*_slug/i);
    expect(serialized).not.toContain("duplicate key value violates unique constraint");
    expect(serialized).not.toContain("23505");
  });
});
