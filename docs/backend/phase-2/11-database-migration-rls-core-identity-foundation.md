# Phase 2.11: Database Migration, RLS & Core Identity Persistence Foundation

## Objective
Establish the core PostgreSQL database foundation and Row-Level Security (RLS) policies using Supabase. This phase implements the first production-grade persistence layer, defining the `public.users` profile, `public.idempotency_records`, `public.audit_logs`, and private security helpers without adding unapproved business APIs.

## Scope
- Version-controlled PostgreSQL/Supabase migrations
- Core public user profile model (`public.users`)
- Secure private helper functions (`private.is_active_user`)
- System-owned idempotency and audit tables
- Row-Level Security policies enforcing strict isolation
- Database type generation workflow
- User repository abstractions
- Database validation and pgTAP testing

## Non-goals
- Implementing business APIs (interviews, questions, resumes, progress).
- Admin management endpoints.
- External API integrations (OpenAI, Gemini).
- Deployment to production.

## Migration Architecture
- **01_create_private_security_helpers**: Sets up the `private` schema and safe security-definer helpers.
- **02_create_core_user_profile**: Defines the enums, the `public.users` table, and the trigger for Auth sync.
- **03_create_system_persistence_tables**: Defines idempotency records and immutable audit logs.
- **04_enable_core_rls**: Enables strict Row-Level Security and policies across all public tables.
- **05_configure_database_privileges**: Granular `GRANT`/`REVOKE` statements enforcing least privilege.

## Testing Strategy
- **pgTAP Tests**: `supabase/tests/` contains pure database tests ensuring schemas, constraints, and RLS policies are active before application code runs.
- **Repository Tests**: `tests/unit/persistence/` covers safe error normalization and type mapping.

## CI Strategy
The CI pipeline leverages `npm run db:validate`, which:
1. Provisions the database from zero via `supabase start` or `supabase test db`.
2. Validates RLS policies and structure with pgTAP.
3. Fails if generated database types drift from schema.
