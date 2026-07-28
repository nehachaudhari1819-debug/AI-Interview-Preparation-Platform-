/**
 * P4.5 — Question Bank Audit Action Constants
 *
 * Defines the approved audit action identifiers for all Question Bank
 * administrative mutations. These must match what is stored in the
 * `action` column of `public.audit_logs`.
 *
 * Naming convention follows the project's SCREAMING_SNAKE_CASE pattern
 * established for PROFILE_UPDATED, ACCOUNT_DEACTIVATED in Phase 3.
 *
 * These are the ONLY approved audit actions for Question Bank admin routes.
 * Do not introduce additional action names without architectural approval.
 */

// ---------------------------------------------------------------------------
// Question audit actions
// ---------------------------------------------------------------------------

export const QUESTION_AUDIT_ACTIONS = {
  /** Admin created a new question in draft status. */
  QUESTION_CREATED: "QUESTION_CREATED",
  /** Admin updated an existing question's fields. */
  QUESTION_UPDATED: "QUESTION_UPDATED",
  /** Admin transitioned a draft question to published. */
  QUESTION_PUBLISHED: "QUESTION_PUBLISHED",
  /** Admin transitioned a published question to archived. */
  QUESTION_ARCHIVED: "QUESTION_ARCHIVED",
  /** Admin restored an archived question back to draft. */
  QUESTION_RESTORED: "QUESTION_RESTORED",
} as const;

export type QuestionAuditAction =
  (typeof QUESTION_AUDIT_ACTIONS)[keyof typeof QUESTION_AUDIT_ACTIONS];

// ---------------------------------------------------------------------------
// Taxonomy audit actions
// ---------------------------------------------------------------------------

export const TAXONOMY_AUDIT_ACTIONS = {
  /** Admin created a new taxonomy entry. */
  QUESTION_TAXONOMY_CREATED: "QUESTION_TAXONOMY_CREATED",
  /** Admin updated an existing taxonomy entry. */
  QUESTION_TAXONOMY_UPDATED: "QUESTION_TAXONOMY_UPDATED",
  /** Admin archived (deactivated) a taxonomy entry. */
  QUESTION_TAXONOMY_ARCHIVED: "QUESTION_TAXONOMY_ARCHIVED",
  /** Admin restored (reactivated) a taxonomy entry. */
  QUESTION_TAXONOMY_RESTORED: "QUESTION_TAXONOMY_RESTORED",
} as const;

export type TaxonomyAuditAction =
  (typeof TAXONOMY_AUDIT_ACTIONS)[keyof typeof TAXONOMY_AUDIT_ACTIONS];

// ---------------------------------------------------------------------------
// Resource types for audit log entries
// ---------------------------------------------------------------------------

export const QUESTION_BANK_RESOURCE_TYPES = {
  QUESTION: "question",
  QUESTION_TAXONOMY: "question_taxonomy",
} as const;

export type QuestionBankResourceType =
  (typeof QUESTION_BANK_RESOURCE_TYPES)[keyof typeof QUESTION_BANK_RESOURCE_TYPES];

// ---------------------------------------------------------------------------
// Safe audit metadata builders
//
// These functions produce audit metadata that contains ONLY field names
// (never field values), operation identifiers, and taxonomy type labels.
// They never include referenceAnswer content, evaluationGuidance content,
// raw tokens, or any credentials.
// ---------------------------------------------------------------------------

/**
 * Produces safe audit metadata for a question creation.
 * Records which fields were provided, not their values.
 */
export function buildQuestionCreatedMetadata(
  providedFieldNames: string[],
): Record<string, unknown> {
  return {
    operation: QUESTION_AUDIT_ACTIONS.QUESTION_CREATED,
    providedFields: [...providedFieldNames].sort(),
  };
}

/**
 * Produces safe audit metadata for a question update.
 * Records which fields were updated, not their values.
 */
export function buildQuestionUpdatedMetadata(updatedFieldNames: string[]): Record<string, unknown> {
  return {
    operation: QUESTION_AUDIT_ACTIONS.QUESTION_UPDATED,
    updatedFields: [...updatedFieldNames].sort(),
  };
}

/**
 * Produces safe audit metadata for a lifecycle transition.
 */
export function buildQuestionLifecycleMetadata(
  action: QuestionAuditAction,
): Record<string, unknown> {
  return {
    operation: action,
  };
}

/**
 * Produces safe audit metadata for a taxonomy creation.
 * Records taxonomyType but never the slug value or description content.
 */
export function buildTaxonomyCreatedMetadata(
  taxonomyType: string,
  providedFieldNames: string[],
): Record<string, unknown> {
  return {
    operation: TAXONOMY_AUDIT_ACTIONS.QUESTION_TAXONOMY_CREATED,
    taxonomyType,
    providedFields: [...providedFieldNames].sort(),
  };
}

/**
 * Produces safe audit metadata for a taxonomy update.
 * Records taxonomyType and which fields were updated, not their values.
 */
export function buildTaxonomyUpdatedMetadata(
  taxonomyType: string,
  updatedFieldNames: string[],
): Record<string, unknown> {
  return {
    operation: TAXONOMY_AUDIT_ACTIONS.QUESTION_TAXONOMY_UPDATED,
    taxonomyType,
    updatedFields: [...updatedFieldNames].sort(),
  };
}

/**
 * Produces safe audit metadata for a taxonomy lifecycle transition.
 */
export function buildTaxonomyLifecycleMetadata(
  action: TaxonomyAuditAction,
  taxonomyType: string,
): Record<string, unknown> {
  return {
    operation: action,
    taxonomyType,
  };
}
