# Phase 5.3: Interview Configuration Creation & Management APIs

**Status**: IMPLEMENTATION COMPLETE, PENDING REVIEW

## Scope

Implementation of the core database RPCs required for students to create and manage their interview configurations, and the complete REST API application layer (controllers, services, repositories, schemas, and routes). This includes mapping taxonomy relationships, establishing concurrency-safe updates, enforcing ownership boundaries, resolving validation errors, and paginating session history.

## Exclusions

- Frontend components and UI
- Idempotency layers (handled in future phase)
- Audit log implementation
- Delete operations (interviews are not deleted by users)

## Traceability

This phase satisfies Gate B requirements for Phase 5.3 as outlined in the core roadmap, and completes the REST API implementation for interview configuration and session reads.

## Architecture & Integration

- **Persistence**: Relies on Supabase RPCs `student_create_interview_config` and `student_update_interview_config`.
- **Repository**: `SupabaseInterviewsRepository` wraps RPC calls and translates Postgres errors (`P0001` - `P0004`) to `PersistenceError`.
- **Service**: `InterviewsService` enforces business rules, including the "ready-session 409 nondisclosure" rule preventing access to session questions before an interview starts.
- **API Controllers**: 8 REST endpoints mounted under `/api/v1/interviews`.
- **Schemas**: Strict Zod validation for payloads and query parameters.
- **OpenAPI**: Fully documented contracts in `interviews.paths.ts` and `interviews.components.ts`.

## REST Endpoints

1. `POST /api/v1/interviews` - Create interview
2. `PATCH /api/v1/interviews/:interviewId` - Update interview (CAS via `expectedUpdatedAt`)
3. `GET /api/v1/interviews` - List owned interviews (paginated)
4. `GET /api/v1/interviews/:interviewId` - Get interview detail
5. `GET /api/v1/interviews/:interviewId/sessions` - List interview sessions
6. `GET /api/v1/interviews/:interviewId/sessions/:sessionId` - Get session detail
7. `GET /api/v1/interviews/:interviewId/sessions/:sessionId/questions` - List session questions (409 if ready)
8. `GET /api/v1/interviews/:interviewId/sessions/:sessionId/questions/:sessionQuestionId` - Get question detail (409 if ready)

## Security Controls

- **Authentication**: All endpoints require active authenticated user tokens.
- **Execution Privileges**: Database RPCs granted explicitly and only to the `authenticated` role. `PUBLIC`, `anon`, and `service_role` revoked.
- **SECURITY DEFINER**: Both RPCs execute as definer to bypass RLS internally while strictly applying ownership via `auth.uid()`.
- **Ownership Verification**: Deeply nested routes (sessions and questions) validate the complete chain of ownership up to the interview's `user_id`.
- **Nondisclosure**: Questions are hidden and yield `409 Conflict` if the session status is `ready`.

## RPC Signatures

### Create Interview Configuration

```sql
CREATE OR REPLACE FUNCTION public.student_create_interview_config(
  p_title text,
  p_target_role text,
  p_interview_type_id uuid,
  p_difficulty_id uuid,
  p_question_count integer,
  p_time_limit_minutes integer,
  p_skill_ids uuid[],
  p_topic_ids uuid[]
) RETURNS uuid;
```

### Update Interview Configuration

```sql
CREATE OR REPLACE FUNCTION public.student_update_interview_config(
  p_interview_id uuid,
  p_expected_updated_at timestamptz,
  p_update_payload jsonb
) RETURNS uuid;
```

## Test Coverage

- **Database (pgTAP)**: 64 assertions verifying RPCs, privileges, active-account checks, search paths, and atomic rollback.
- **Unit Tests**: Full coverage of Zod schemas and service-layer nondisclosure logic.
- **Integration Tests**: Authentic database tests for `SupabaseInterviewsRepository` verifying RPC invocation, error normalizations (P0001-P0004), concurrency CAS, and nested ownership.
- **E2E Tests**: Authentic requests testing security boundaries, success flows, pagination, and ready-session 409 nondisclosure across all 8 endpoints.

## Acceptance Checklist

- [x] Create Migration 22
- [x] Create Test 22
- [x] Update P5.3 documentation for REST API
- [x] Regenerate database types
- [x] Implement schemas, repository, service, controller, router
- [x] Integrate OpenAPI paths and components
- [x] Write and verify authentic tests (Unit, Integration, E2E)
- [ ] Pass complete post-correction validation
- [ ] Receive API layer approval
- [ ] Commit and push
