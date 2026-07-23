# Phase 3.2: User Profile Domain and Repository Foundation

## Title and Status

**Title:** User Profile Domain, Validation Schema, and Repository Foundation  
**Status:** IMPLEMENTED

## Purpose

The purpose of this phase is to establish the canonical domain model, strict Zod validation schemas, and persistence layer abstractions for user profiles without exposing any HTTP endpoints.

## Approved Baseline

Commit SHA: `deaed8fa37a7b6ff98e9cfa4b1687fe421e5711a`

## Scope

- Canonical `UserProfile` domain types
- Canonical Zod schemas (`UserProfileSchema`, `UpdateUserProfileInputSchema`)
- Deterministic profile-update normalization
- Explicit database-to-domain mapping
- Explicit domain-to-database mapping
- A stable `UserProfileRepository` interface
- A safe Supabase repository implementation
- Persistence-error normalization
- Domain and repository unit tests
- Repository integration tests using typed Supabase mocks
- P3.2 technical documentation

## Non-goals

No HTTP endpoints were created. No migrations were created. No RLS policies were changed. No privileged account workflows were added. No audit/idempotency implementations were added. P3.3 is not started.

## Existing Implementation Reviewed

The original Phase 2 types and repository implementation were reviewed. The original types file in the persistence layer is kept as a compatibility export so authentication logic remains completely uninterrupted.

## Canonical Domain Model

Located at `src/features/users/user-profile.types.ts`.
Public field names use camelCase. `id` is a valid UUID, `email` is a valid string email, `fullName` is non-null. `preferredRoles` is always a non-null array. Timestamps are valid `Date` objects in the internal domain model. Invalid database values are rejected via schema validation. No unapproved database columns are mapped.

## Domain Enum Decisions

Enums `Role` and `AccountStatus` parse all values returned by the database. The P3.1 DELETE workflow using the `deleted` account status is fully parsable by the new domains without requiring migration.

## Update-Input Schema

Located at `src/features/users/user-profile.schemas.ts`. `UpdateUserProfileInputSchema` ensures strict validation, rejecting unknown and protected keys.

## Normalization Behavior

Deterministic normalization happens purely in `src/features/users/user-profile.normalizers.ts`.

- `normalizeOptionalString`: Trims whitespace and normalizes empty strings to `null`.
- `normalizeRequiredString`: Trims whitespace.
- `normalizePreferredRoles`: Trims, deduplicates, and preserves the first occurrence order.

## Field-validation Matrix

All rules from the P3.1 API contract have been faithfully implemented, including HTTPS-only avatars and minimum length constraints on `fullName` and `preferredRoles`.

## Database-to-Domain Mapping

Explicitly implemented in `src/persistence/users/user-profile.mapper.ts`. Ensures that only allowed properties transfer to the domain object, translating timestamps to valid `Date` objects, and ensuring database `null` in array fields translates to empty arrays `[]`.

## Domain-Update-to-Database Mapping

Explicitly implemented in `src/persistence/users/user-profile.mapper.ts`. Maps `UpdateUserProfileInput` fields cleanly back to snake_case format while retaining null-clearing updates.

## Repository Interface

Located at `src/persistence/users/user-profile.repository.ts`. Features operations:

- `findById`
- `updateOwnProfile`
- `isActive`

## Supabase Adapter Behavior

Located at `src/persistence/users/supabase-user-profile.repository.ts`.

- `findById`: Uses `SAFE_PROFILE_COLUMNS`, uses `.maybeSingle()`, and safely filters by ID.
- `updateOwnProfile`: Filters by ID, uses `SAFE_PROFILE_COLUMNS` for return selection.
- `isActive`: Preserves fail-closed behavior, selecting only `account_status` and `deleted_at`.

## Safe Column Projection

A shared constant `SAFE_PROFILE_COLUMNS` ensures that queries do not wildly select all columns (`*`), avoiding unnecessary data leaks or unexpected data shape issues on queries.

## Persistence-error Mapping

Supabase errors are safely swallowed or translated to `PersistenceError` variants (`RECORD_NOT_FOUND`, `OPERATION_FAILED`, `VALIDATION_FAILED`), preserving the rule that provider details and raw errors are kept hidden from upstream application layers.

## Compatibility and Migration of Old Exports

The existing file `src/persistence/users/user-profile.types.ts` has been refactored into a compatibility layer. It re-exports canonical types to ensure the existing authentication services (which import from that old path) remain undisturbed.

## Security Boundaries

Domain models are isolated from Express logic. Protected fields (e.g. `role`, `accountStatus`) cannot be successfully parsed by the update schemas, nor mapped into the database update objects.

## Test Coverage

Targeted unit tests created and expanded:

- `tests/unit/features/users/user-profile.schemas.spec.ts`
- `tests/unit/features/users/user-profile.normalizers.spec.ts`
- `tests/unit/persistence/user-profile.mapper.spec.ts`
- `tests/unit/persistence/user-profile.repository.spec.ts`

## Files Created

- `src/features/users/user-profile.types.ts`
- `src/features/users/user-profile.schemas.ts`
- `src/features/users/user-profile.normalizers.ts`
- `src/features/users/index.ts`
- `src/persistence/users/user-profile.mapper.ts`
- `tests/unit/features/users/user-profile.schemas.spec.ts`
- `tests/unit/features/users/user-profile.normalizers.spec.ts`
- `tests/unit/persistence/user-profile.mapper.spec.ts`
- `docs/backend/phase-3/02-user-profile-domain-repository-foundation.md`

## Files Modified

- `src/persistence/users/user-profile.repository.ts`
- `src/persistence/users/supabase-user-profile.repository.ts`
- `src/persistence/users/user-profile.types.ts` (retained for compatibility)
- `src/persistence/users/index.ts`
- `tests/unit/persistence/user-profile.repository.spec.ts`
- `docs/backend/phase-3/01-user-profile-requirements-api-contract.md`

## Deferred Work

- GET endpoint remains P3.3.
- PATCH endpoint remains P3.4.
- DELETE flow remains P3.5.
- RLS expansion remains P3.6.
- Audit and idempotency remain P3.7.
- OpenAPI handoff remains P3.9.

## Acceptance Criteria

- [x] One canonical UserProfile domain model exists.
- [x] One canonical update-input schema exists.
- [x] Profile normalization is deterministic.
- [x] Unknown and protected update fields are rejected.
- [x] Empty updates are rejected.
- [x] Optional empty strings normalize according to P3.1.
- [x] preferredRoles null normalizes to [].
- [x] preferredRoles are trimmed and deduplicated.
- [x] HTTPS-only avatar validation is enforced.
- [x] Database mapping is explicit.
- [x] No database-row spreading remains in the profile mapper.
- [x] Database update mapping is explicit and allowlisted.
- [x] Repository interface remains provider-independent.
- [x] Supabase adapter uses typed clients.
- [x] Supabase queries use explicit projections.
- [x] No wildcard profile select remains.
- [x] Provider failures map to safe persistence errors.
- [x] Existing authentication behavior remains intact.
- [x] Unit tests cover schemas, normalization, mappers, and repository behavior.
- [x] All previous tests remain green.
- [x] No test is skipped.
- [x] No HTTP endpoint is implemented.
- [x] No controller, router, or service is created.
- [x] No migration is created.
- [x] No RLS policy is changed.
- [x] No OpenAPI endpoint is added.
- [x] P3.2 documentation exists.

## P3.3 Handoff

Domain types, schemas, and persistence operations are now strictly defined and thoroughly tested. This infrastructure forms the core required to power the `GET /api/v1/users/me` API which will be implemented next.

## Approval Checkpoint

P3.2 is fully verified in code, mapping directly to P3.1 requirements.
