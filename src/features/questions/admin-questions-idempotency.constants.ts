/**
 * P4.5 — Question Bank Idempotency Operation Constants
 *
 * Stable operation identifiers for all Question Bank admin mutation routes.
 * These identifiers are used as the `operation` field when acquiring
 * an idempotency lease via `withIdempotency(…)`.
 *
 * The `operation` field forms part of the idempotency record key alongside
 * the `userId` and the `idempotencyKey` header. Changing these identifiers
 * would invalidate all outstanding idempotency records for those operations.
 *
 * Convention: lowercase_snake_case, prefixed with the resource domain.
 */

// ---------------------------------------------------------------------------
// Question operation identifiers
// ---------------------------------------------------------------------------

export const QUESTION_IDEMPOTENCY_OPERATIONS = {
  /** POST /admin/questions — create a new question */
  CREATE_QUESTION: "admin_create_question",
  /** PATCH /admin/questions/:questionId — update an existing question */
  UPDATE_QUESTION: "admin_update_question",
  /** POST /admin/questions/:questionId/publish — publish a draft question */
  PUBLISH_QUESTION: "admin_publish_question",
  /** POST /admin/questions/:questionId/archive — archive a published question */
  ARCHIVE_QUESTION: "admin_archive_question",
  /** POST /admin/questions/:questionId/restore — restore an archived question */
  RESTORE_QUESTION: "admin_restore_question",
} as const;

export type QuestionIdempotencyOperation =
  (typeof QUESTION_IDEMPOTENCY_OPERATIONS)[keyof typeof QUESTION_IDEMPOTENCY_OPERATIONS];

// ---------------------------------------------------------------------------
// Taxonomy operation identifiers
// ---------------------------------------------------------------------------

export const TAXONOMY_IDEMPOTENCY_OPERATIONS = {
  /** POST /admin/taxonomies/:taxonomyType — create a new taxonomy entry */
  CREATE_TAXONOMY: "admin_create_taxonomy",
  /** PATCH /admin/taxonomies/:taxonomyType/:taxonomyId — update a taxonomy entry */
  UPDATE_TAXONOMY: "admin_update_taxonomy",
  /** POST /admin/taxonomies/:taxonomyType/:taxonomyId/archive — archive a taxonomy */
  ARCHIVE_TAXONOMY: "admin_archive_taxonomy",
  /** POST /admin/taxonomies/:taxonomyType/:taxonomyId/restore — restore a taxonomy */
  RESTORE_TAXONOMY: "admin_restore_taxonomy",
} as const;

export type TaxonomyIdempotencyOperation =
  (typeof TAXONOMY_IDEMPOTENCY_OPERATIONS)[keyof typeof TAXONOMY_IDEMPOTENCY_OPERATIONS];

// ---------------------------------------------------------------------------
// Route patterns for fingerprint generation
//
// These are the canonical route patterns (without dynamic segments) used in
// the request fingerprint. They must be stable — changing them would alter
// the fingerprint for existing idempotency records.
// ---------------------------------------------------------------------------

export const QUESTION_BANK_ROUTE_PATTERNS = {
  CREATE_QUESTION: "/admin/questions",
  UPDATE_QUESTION: "/admin/questions/:questionId",
  PUBLISH_QUESTION: "/admin/questions/:questionId/publish",
  ARCHIVE_QUESTION: "/admin/questions/:questionId/archive",
  RESTORE_QUESTION: "/admin/questions/:questionId/restore",
  CREATE_TAXONOMY: "/admin/taxonomies/:taxonomyType",
  UPDATE_TAXONOMY: "/admin/taxonomies/:taxonomyType/:taxonomyId",
  ARCHIVE_TAXONOMY: "/admin/taxonomies/:taxonomyType/:taxonomyId/archive",
  RESTORE_TAXONOMY: "/admin/taxonomies/:taxonomyType/:taxonomyId/restore",
} as const;

export type QuestionBankRoutePattern =
  (typeof QUESTION_BANK_ROUTE_PATTERNS)[keyof typeof QUESTION_BANK_ROUTE_PATTERNS];
