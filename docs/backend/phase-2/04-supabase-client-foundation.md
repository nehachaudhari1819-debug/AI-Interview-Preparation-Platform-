# P2.4 — Supabase Client Foundation

## 1. Purpose

Supabase requires distinct client configurations depending on the access level needed. Mixing public, user-scoped, and privileged administrative access can lead to security vulnerabilities, cross-contamination between requests, or privilege escalation. This foundation guarantees strict isolation, validates access tokens securely, normalizes integration errors safely, and establishes clear export boundaries.

## 2. Scope

- `@supabase/supabase-js@2` installed.
- Support for `SUPABASE_SECRET_KEY` (preferred) and `SUPABASE_SERVICE_ROLE_KEY` (legacy compatibility).
- Three separated client factories: Public, User-scoped, and Privileged.
- Disabled browser-oriented session persistence on all backend clients.
- `SupabaseIntegrationError` and error normalizer implemented.
- Robust unit and security testing with dependency-injected mocks (no live network connections during tests).
- Export boundaries enforced (admin factory isolated).
- Secret keys and user tokens heavily guarded and redacted from errors.

## 3. Current Key Terminology

- **Publishable Key**: Safe for frontend or public-level operations. Relies on RLS for data access.
- **Secret Key**: Backend-only administrative key that bypasses RLS. Preferred privileged key format.
- **Legacy Anon Key**: Replaced by Publishable Key.
- **Legacy Service-Role Key**: Legacy backend administrative key. We maintain temporary compatibility with this.
- **Migration Preference**: New integrations use the `SUPABASE_SECRET_KEY`.

## 4. Configuration Contract

- **Absent**: All four `SUPABASE_` vars undefined. Safe summary: `{ supabaseConfigured: false }`
- **Preferred Configured**: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY` provided.
- **Legacy Configured**: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` provided.
- **Invalid**: Providing both privileged keys, providing only a privileged key without url/publishable, providing partial settings, etc.

## 5. Client Matrix

| Client          | API Key            | User Authorization | RLS Behavior | Lifecycle           | Allowed Consumers        | Forbidden Consumers    |
| --------------- | ------------------ | ------------------ | ------------ | ------------------- | ------------------------ | ---------------------- |
| **Public**      | Publishable        | None               | RLS Applies  | Request / Singleton | Public Routes, Auth Init | Admin Tasks            |
| **User-Scoped** | Publishable        | Bearer Token       | RLS Applies  | Request-scoped      | Authenticated Routes     | Background Jobs, Admin |
| **Privileged**  | Secret/ServiceRole | None               | Bypasses RLS | Request / Singleton | Webhooks, Admin tasks    | User endpoints         |

## 6. Public Client

Designed for operations that don't have user authentication context yet, or are explicitly public. It accepts the `SUPABASE_PUBLISHABLE_KEY`.

## 7. User-Scoped Client

Used for querying on behalf of a specific user.

- Uses `SUPABASE_PUBLISHABLE_KEY`.
- Attaches the specific user's `accessToken` to the global `Authorization` header.
- This allows PostgreSQL Row Level Security (RLS) to enforce data access rules for the user context.
- Highly ephemeral; not cached globally. Token is passed but **not verified** here.

## 8. Privileged Client

Designed for explicitly authorized backend-only tasks.

- Uses `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`.
- Completely bypasses RLS.
- Strictly isolated under `src/integrations/supabase/admin/` and explicitly not exported from the root barrel `src/integrations/supabase/index.ts`.
- Must never be attached to a user's request context.

## 9. Server Auth Options

All three factories disable the browser-focused session functionalities to prevent leakage across backend requests:

- `persistSession: false`
- `autoRefreshToken: false`
- `detectSessionInUrl: false`

## 10. Access-Token Input Policy

The user token is treated as an opaque string.

- Trimmed of outer whitespace.
- Empty strings, internal whitespace, line breaks, and null bytes are rejected outright.
- Enforces a 16 KiB length limit.
- **Decoding / JWT Validation** is deferred until authorization middlewares are built.

## 11. Export Boundaries

- **Root Barrel (`src/integrations/supabase/index.ts`)**: Exports Public factory, User factory, errors, and configuration helpers.
- **Admin Barrel (`src/integrations/supabase/admin/index.ts`)**: The ONLY place exporting the Privileged factory.

## 12. Error Normalization

`SupabaseIntegrationError` masks raw external errors:

- Classifies into `auth`, `database`, `storage`, or `unknown`.
- Generates safe messages (`Supabase database request failed.`).
- Keeps the raw error on the internal `cause` property.

## 13. Secret Protection

- Keys and Tokens are NEVER logged.
- `SafeConfigSummary` drops the keys entirely and only reports the `privilegedKeyType`.
- Serialization of configuration issues or normalizer errors drops credential components completely.
- Privileged clients are strictly isolated from normal user request handling.

## 14. Database Typing Strategy

Generating the TypeScript database definitions is strictly deferred. We currently type the output as `ProjectSupabaseClient = SupabaseClient` until we introduce the formal database migration schema and CLI typings.

## 15. Testing Strategy

All factories are thoroughly covered via mocks using Jest:

- `public-supabase-client.spec.ts`
- `user-supabase-client.spec.ts`
- `privileged-supabase-client.spec.ts`
- `require-supabase-config.spec.ts`
- `supabase-client-options.spec.ts`
- `supabase-error-normalizer.spec.ts`
- `supabase-export-boundary.spec.ts`
- `supabase-credential-isolation.spec.ts`
- `supabase-secret-redaction.spec.ts`

## 16. No-Network Test Policy

Tests execute instantaneously by injecting `typeof createClient` as a mock into the `dependencies` parameter of the factories. Live network connections to Supabase are forbidden during CI unit testing.

## 17. Direct Environment-Access Policy

Only the configuration schema under `src/config/` parses `process.env`. All subsequent integrations request the sanitized `ApplicationConfig`.

## 18. Current Limitations

Explicitly deferred until future phases:

- Auth token decoding / verification
- Database querying
- Storage interactions
- Admin workflows
- SQL / RLS implementations
- Generated TypeScript Definitions
- Retry logic and observability

## 19. Validation Evidence

See the checklist execution. The user confirmed passing for:

- `npm run format:check`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run validate`
- `git diff --check`

## 20. Acceptance Checklist

(The complete task implementation checklist from P2.4 is fulfilled.)

## 21. Git Evidence

Branch, Shas, and status verified by the user in the prompt instructions and completed terminal logs.
