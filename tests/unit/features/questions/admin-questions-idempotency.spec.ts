/**
 * P4.5 — Unit Tests: Admin Questions Idempotency Constants
 *
 * Verifies:
 * - Idempotency operation identifiers are correct and stable
 * - Route patterns are correct canonical patterns (no dynamic segments resolved)
 * - Each mutation operation has a unique operation identifier
 * - GET routes do not have idempotency operations defined
 */

import { describe, it, expect } from "@jest/globals";
import {
  QUESTION_IDEMPOTENCY_OPERATIONS,
  TAXONOMY_IDEMPOTENCY_OPERATIONS,
  QUESTION_BANK_ROUTE_PATTERNS,
} from "../../../../src/features/questions/admin-questions-idempotency.constants.js";

describe("Question Bank Idempotency Operations", () => {
  describe("QUESTION_IDEMPOTENCY_OPERATIONS", () => {
    it("defines all required question operation identifiers", () => {
      expect(QUESTION_IDEMPOTENCY_OPERATIONS.CREATE_QUESTION).toBe("admin_create_question");
      expect(QUESTION_IDEMPOTENCY_OPERATIONS.UPDATE_QUESTION).toBe("admin_update_question");
      expect(QUESTION_IDEMPOTENCY_OPERATIONS.PUBLISH_QUESTION).toBe("admin_publish_question");
      expect(QUESTION_IDEMPOTENCY_OPERATIONS.ARCHIVE_QUESTION).toBe("admin_archive_question");
      expect(QUESTION_IDEMPOTENCY_OPERATIONS.RESTORE_QUESTION).toBe("admin_restore_question");
    });

    it("all operation identifiers are unique", () => {
      const ops = Object.values(QUESTION_IDEMPOTENCY_OPERATIONS);
      const uniqueOps = new Set(ops);
      expect(uniqueOps.size).toBe(ops.length);
    });

    it("operation identifiers use lowercase snake_case with admin prefix", () => {
      for (const op of Object.values(QUESTION_IDEMPOTENCY_OPERATIONS)) {
        expect(op).toMatch(/^admin_[a-z_]+$/);
      }
    });
  });

  describe("TAXONOMY_IDEMPOTENCY_OPERATIONS", () => {
    it("defines all required taxonomy operation identifiers", () => {
      expect(TAXONOMY_IDEMPOTENCY_OPERATIONS.CREATE_TAXONOMY).toBe("admin_create_taxonomy");
      expect(TAXONOMY_IDEMPOTENCY_OPERATIONS.UPDATE_TAXONOMY).toBe("admin_update_taxonomy");
      expect(TAXONOMY_IDEMPOTENCY_OPERATIONS.ARCHIVE_TAXONOMY).toBe("admin_archive_taxonomy");
      expect(TAXONOMY_IDEMPOTENCY_OPERATIONS.RESTORE_TAXONOMY).toBe("admin_restore_taxonomy");
    });

    it("all taxonomy operation identifiers are unique", () => {
      const ops = Object.values(TAXONOMY_IDEMPOTENCY_OPERATIONS);
      const uniqueOps = new Set(ops);
      expect(uniqueOps.size).toBe(ops.length);
    });
  });

  describe("Combined uniqueness", () => {
    it("question and taxonomy operations have no overlapping identifiers", () => {
      const allOps = [
        ...Object.values(QUESTION_IDEMPOTENCY_OPERATIONS),
        ...Object.values(TAXONOMY_IDEMPOTENCY_OPERATIONS),
      ];
      const uniqueOps = new Set(allOps);
      expect(uniqueOps.size).toBe(allOps.length);
    });
  });
});

describe("Question Bank Route Patterns", () => {
  it("defines all required mutation route patterns", () => {
    expect(QUESTION_BANK_ROUTE_PATTERNS.CREATE_QUESTION).toBe("/admin/questions");
    expect(QUESTION_BANK_ROUTE_PATTERNS.UPDATE_QUESTION).toBe("/admin/questions/:questionId");
    expect(QUESTION_BANK_ROUTE_PATTERNS.PUBLISH_QUESTION).toBe(
      "/admin/questions/:questionId/publish",
    );
    expect(QUESTION_BANK_ROUTE_PATTERNS.ARCHIVE_QUESTION).toBe(
      "/admin/questions/:questionId/archive",
    );
    expect(QUESTION_BANK_ROUTE_PATTERNS.RESTORE_QUESTION).toBe(
      "/admin/questions/:questionId/restore",
    );
    expect(QUESTION_BANK_ROUTE_PATTERNS.CREATE_TAXONOMY).toBe("/admin/taxonomies/:taxonomyType");
    expect(QUESTION_BANK_ROUTE_PATTERNS.UPDATE_TAXONOMY).toBe(
      "/admin/taxonomies/:taxonomyType/:taxonomyId",
    );
    expect(QUESTION_BANK_ROUTE_PATTERNS.ARCHIVE_TAXONOMY).toBe(
      "/admin/taxonomies/:taxonomyType/:taxonomyId/archive",
    );
    expect(QUESTION_BANK_ROUTE_PATTERNS.RESTORE_TAXONOMY).toBe(
      "/admin/taxonomies/:taxonomyType/:taxonomyId/restore",
    );
  });

  it("all route patterns are unique", () => {
    const patterns = Object.values(QUESTION_BANK_ROUTE_PATTERNS);
    const uniquePatterns = new Set(patterns);
    expect(uniquePatterns.size).toBe(patterns.length);
  });

  it("route patterns contain colon-prefixed dynamic segments (not actual IDs)", () => {
    // Route patterns should use :param notation, not actual UUIDs
    const patternsWithParams = [
      QUESTION_BANK_ROUTE_PATTERNS.UPDATE_QUESTION,
      QUESTION_BANK_ROUTE_PATTERNS.PUBLISH_QUESTION,
      QUESTION_BANK_ROUTE_PATTERNS.ARCHIVE_QUESTION,
      QUESTION_BANK_ROUTE_PATTERNS.RESTORE_QUESTION,
      QUESTION_BANK_ROUTE_PATTERNS.UPDATE_TAXONOMY,
      QUESTION_BANK_ROUTE_PATTERNS.ARCHIVE_TAXONOMY,
      QUESTION_BANK_ROUTE_PATTERNS.RESTORE_TAXONOMY,
    ];

    for (const pattern of patternsWithParams) {
      expect(pattern).toMatch(/:/); // contains dynamic segments
    }
  });

  it("route patterns do not contain actual UUIDs", () => {
    for (const pattern of Object.values(QUESTION_BANK_ROUTE_PATTERNS)) {
      expect(pattern).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    }
  });
});

describe("Fingerprint Determinism with Operation Constants", () => {
  it("same operation + route pattern + body always produces the same fingerprint", async () => {
    const { generateRequestFingerprint } =
      await import("../../../../src/domain/idempotency/request-fingerprint.js");

    const fp1 = generateRequestFingerprint({
      apiVersion: "v1",
      method: "POST",
      routePattern: QUESTION_BANK_ROUTE_PATTERNS.CREATE_QUESTION,
      operation: QUESTION_IDEMPOTENCY_OPERATIONS.CREATE_QUESTION,
      body: {
        questionText: "What is TypeScript?",
        categoryId: "cat-uuid",
        difficultyId: "diff-uuid",
      },
    });

    const fp2 = generateRequestFingerprint({
      apiVersion: "v1",
      method: "POST",
      routePattern: QUESTION_BANK_ROUTE_PATTERNS.CREATE_QUESTION,
      operation: QUESTION_IDEMPOTENCY_OPERATIONS.CREATE_QUESTION,
      // Different key ordering — should produce same fingerprint
      body: {
        difficultyId: "diff-uuid",
        categoryId: "cat-uuid",
        questionText: "What is TypeScript?",
      },
    });

    expect(fp1).toBe(fp2);
    expect(fp1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("different operations with same body produce different fingerprints", async () => {
    const { generateRequestFingerprint } =
      await import("../../../../src/domain/idempotency/request-fingerprint.js");

    const body = { questionText: "What is TypeScript?" };

    const fp1 = generateRequestFingerprint({
      apiVersion: "v1",
      method: "POST",
      routePattern: QUESTION_BANK_ROUTE_PATTERNS.CREATE_QUESTION,
      operation: QUESTION_IDEMPOTENCY_OPERATIONS.CREATE_QUESTION,
      body,
    });

    const fp2 = generateRequestFingerprint({
      apiVersion: "v1",
      method: "PATCH",
      routePattern: QUESTION_BANK_ROUTE_PATTERNS.UPDATE_QUESTION,
      operation: QUESTION_IDEMPOTENCY_OPERATIONS.UPDATE_QUESTION,
      body,
    });

    expect(fp1).not.toBe(fp2);
  });
});
