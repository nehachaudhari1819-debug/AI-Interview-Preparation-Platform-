/**
 * P4.5 — Unit Tests: Admin Questions Audit Constants
 *
 * Verifies:
 * - Audit action names are correct and stable
 * - Metadata builders produce safe field-name-only records (never values)
 * - Sensitive fields are excluded from all metadata
 * - Taxonomy type is included but never the slug value
 */

import { describe, it, expect } from "@jest/globals";
import {
  QUESTION_AUDIT_ACTIONS,
  TAXONOMY_AUDIT_ACTIONS,
  QUESTION_BANK_RESOURCE_TYPES,
  buildQuestionCreatedMetadata,
  buildQuestionUpdatedMetadata,
  buildQuestionLifecycleMetadata,
  buildTaxonomyCreatedMetadata,
  buildTaxonomyUpdatedMetadata,
  buildTaxonomyLifecycleMetadata,
} from "../../../../src/features/questions/admin-questions-audit.constants.js";

describe("Question Audit Action Constants", () => {
  it("defines all required question actions", () => {
    expect(QUESTION_AUDIT_ACTIONS.QUESTION_CREATED).toBe("QUESTION_CREATED");
    expect(QUESTION_AUDIT_ACTIONS.QUESTION_UPDATED).toBe("QUESTION_UPDATED");
    expect(QUESTION_AUDIT_ACTIONS.QUESTION_PUBLISHED).toBe("QUESTION_PUBLISHED");
    expect(QUESTION_AUDIT_ACTIONS.QUESTION_ARCHIVED).toBe("QUESTION_ARCHIVED");
    expect(QUESTION_AUDIT_ACTIONS.QUESTION_RESTORED).toBe("QUESTION_RESTORED");
  });

  it("defines all required taxonomy actions", () => {
    expect(TAXONOMY_AUDIT_ACTIONS.QUESTION_TAXONOMY_CREATED).toBe("QUESTION_TAXONOMY_CREATED");
    expect(TAXONOMY_AUDIT_ACTIONS.QUESTION_TAXONOMY_UPDATED).toBe("QUESTION_TAXONOMY_UPDATED");
    expect(TAXONOMY_AUDIT_ACTIONS.QUESTION_TAXONOMY_ARCHIVED).toBe("QUESTION_TAXONOMY_ARCHIVED");
    expect(TAXONOMY_AUDIT_ACTIONS.QUESTION_TAXONOMY_RESTORED).toBe("QUESTION_TAXONOMY_RESTORED");
  });

  it("defines correct resource types", () => {
    expect(QUESTION_BANK_RESOURCE_TYPES.QUESTION).toBe("question");
    expect(QUESTION_BANK_RESOURCE_TYPES.QUESTION_TAXONOMY).toBe("question_taxonomy");
  });
});

describe("Audit Metadata Builders — Safe Field-Name Redaction", () => {
  describe("buildQuestionCreatedMetadata", () => {
    it("includes only sorted field names from the provided keys", () => {
      const meta = buildQuestionCreatedMetadata(["questionText", "categoryId", "referenceAnswer"]);

      expect(meta.operation).toBe(QUESTION_AUDIT_ACTIONS.QUESTION_CREATED);
      expect(meta.providedFields).toEqual(["categoryId", "questionText", "referenceAnswer"]);
    });

    it("never includes values — only field names", () => {
      const meta = buildQuestionCreatedMetadata(["referenceAnswer", "evaluationGuidance"]);
      const serialized = JSON.stringify(meta);

      // Must not contain any actual content value
      expect(serialized).not.toContain("42 is the answer");
      expect(serialized).not.toContain("beginner");
      // Should contain field names
      expect(serialized).toContain("referenceAnswer");
      expect(serialized).toContain("evaluationGuidance");
    });

    it("excludes bearer tokens and credentials from metadata", () => {
      const meta = buildQuestionCreatedMetadata(["questionText"]);
      const serialized = JSON.stringify(meta);

      expect(serialized).not.toContain("Bearer");
      expect(serialized).not.toContain("eyJ");
      expect(serialized).not.toContain("service_role");
    });

    it("returns fields in sorted order for canonical output", () => {
      const meta = buildQuestionCreatedMetadata(["z_field", "a_field", "m_field"]);
      const fields = meta.providedFields as string[];
      expect(fields).toEqual(["a_field", "m_field", "z_field"]);
    });

    it("does not mutate the original input array", () => {
      const original = ["z_field", "a_field"];
      buildQuestionCreatedMetadata(original);
      expect(original).toEqual(["z_field", "a_field"]); // unchanged
    });
  });

  describe("buildQuestionUpdatedMetadata", () => {
    it("includes sorted updated field names", () => {
      const meta = buildQuestionUpdatedMetadata(["difficultyId", "categoryId"]);
      expect(meta.operation).toBe(QUESTION_AUDIT_ACTIONS.QUESTION_UPDATED);
      expect(meta.updatedFields).toEqual(["categoryId", "difficultyId"]);
    });

    it("excludes referenceAnswer content (stores field name only)", () => {
      const meta = buildQuestionUpdatedMetadata(["referenceAnswer"]);
      const serialized = JSON.stringify(meta);
      expect(serialized).toContain("referenceAnswer"); // field name included
      expect(serialized).not.toContain("The correct answer is"); // no value
    });

    it("excludes evaluationGuidance content (stores field name only)", () => {
      const meta = buildQuestionUpdatedMetadata(["evaluationGuidance"]);
      const serialized = JSON.stringify(meta);
      expect(serialized).toContain("evaluationGuidance"); // field name
      expect(serialized).not.toContain("rubric"); // no content value
    });
  });

  describe("buildQuestionLifecycleMetadata", () => {
    it("includes the operation for QUESTION_PUBLISHED", () => {
      const meta = buildQuestionLifecycleMetadata(QUESTION_AUDIT_ACTIONS.QUESTION_PUBLISHED);
      expect(meta.operation).toBe("QUESTION_PUBLISHED");
    });

    it("includes the operation for QUESTION_ARCHIVED", () => {
      const meta = buildQuestionLifecycleMetadata(QUESTION_AUDIT_ACTIONS.QUESTION_ARCHIVED);
      expect(meta.operation).toBe("QUESTION_ARCHIVED");
    });

    it("includes the operation for QUESTION_RESTORED", () => {
      const meta = buildQuestionLifecycleMetadata(QUESTION_AUDIT_ACTIONS.QUESTION_RESTORED);
      expect(meta.operation).toBe("QUESTION_RESTORED");
    });

    it("does not include internal question content", () => {
      const meta = buildQuestionLifecycleMetadata(QUESTION_AUDIT_ACTIONS.QUESTION_PUBLISHED);
      const serialized = JSON.stringify(meta);
      expect(serialized).not.toContain("referenceAnswer");
      expect(serialized).not.toContain("questionText");
    });
  });

  describe("buildTaxonomyCreatedMetadata", () => {
    it("includes taxonomyType and sorted field names", () => {
      const meta = buildTaxonomyCreatedMetadata("skills", ["slug", "name", "description"]);
      expect(meta.operation).toBe(TAXONOMY_AUDIT_ACTIONS.QUESTION_TAXONOMY_CREATED);
      expect(meta.taxonomyType).toBe("skills");
      expect(meta.providedFields).toEqual(["description", "name", "slug"]);
    });

    it("stores taxonomyType label but never the slug value", () => {
      const meta = buildTaxonomyCreatedMetadata("categories", ["slug", "name"]);
      const serialized = JSON.stringify(meta);
      expect(serialized).toContain("categories"); // type label is allowed
      expect(serialized).toContain("slug"); // field name is allowed
      expect(serialized).not.toContain("my-secret-category-slug"); // slug value excluded
    });
  });

  describe("buildTaxonomyUpdatedMetadata", () => {
    it("includes taxonomyType and sorted updated field names", () => {
      const meta = buildTaxonomyUpdatedMetadata("difficulties", ["name"]);
      expect(meta.operation).toBe(TAXONOMY_AUDIT_ACTIONS.QUESTION_TAXONOMY_UPDATED);
      expect(meta.taxonomyType).toBe("difficulties");
      expect(meta.updatedFields).toEqual(["name"]);
    });
  });

  describe("buildTaxonomyLifecycleMetadata", () => {
    it("includes operation and taxonomyType for archive", () => {
      const meta = buildTaxonomyLifecycleMetadata(
        TAXONOMY_AUDIT_ACTIONS.QUESTION_TAXONOMY_ARCHIVED,
        "topics",
      );
      expect(meta.operation).toBe("QUESTION_TAXONOMY_ARCHIVED");
      expect(meta.taxonomyType).toBe("topics");
    });

    it("includes operation and taxonomyType for restore", () => {
      const meta = buildTaxonomyLifecycleMetadata(
        TAXONOMY_AUDIT_ACTIONS.QUESTION_TAXONOMY_RESTORED,
        "skills",
      );
      expect(meta.operation).toBe("QUESTION_TAXONOMY_RESTORED");
      expect(meta.taxonomyType).toBe("skills");
    });

    it("does not include any credential or token fields", () => {
      const meta = buildTaxonomyLifecycleMetadata(
        TAXONOMY_AUDIT_ACTIONS.QUESTION_TAXONOMY_ARCHIVED,
        "categories",
      );
      const serialized = JSON.stringify(meta);
      expect(serialized).not.toContain("token");
      expect(serialized).not.toContain("jwt");
      expect(serialized).not.toContain("Bearer");
      expect(serialized).not.toContain("service_role");
    });
  });
});
