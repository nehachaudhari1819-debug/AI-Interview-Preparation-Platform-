# Real Environment Testing

Phase 2 establishes a strict boundary between unit/integration tests (which use mock implementations and deterministic logic) and real-environment end-to-end (E2E) tests.

## Real Environment E2E Suite

The E2E suite (`tests/e2e/phase-2/`) tests the actual HTTP endpoints against a real Supabase database.

### Principles

1. **Local Only**: Tests must actively throw a runtime fault if `SUPABASE_URL` does not point to `127.0.0.1:54321`. This prevents any possibility of automated teardown scripts deleting production or staging databases.
2. **Deterministic Identities**: Tests generate random test accounts using `tests/setup/real-environment.ts`.
3. **Clean Teardown**: Each test is responsible for securely removing the user it provisions via the Admin API (`auth.admin.deleteUser`).

### Running Real Environment Tests

To run the complete verification suite, you must have the local Supabase container running:

```bash
npx supabase start
```

Run the Capstone validation command:

```bash
npm run validate:phase2
```

This script will:

1. Hard-reset the database from zero state (`supabase db reset`).
2. Verify all TypeScript types are in sync (`supabase gen types`).
3. Run database linting and pgTAP tests (`supabase db validate`).
4. Execute the real-environment E2E test suite.
5. Run the standard application validation (linting, OpenAPI checks, Jest tests, TypeScript build).

### Debugging

If tests fail, ensure that:

1. Docker is running.
2. Supabase is active (`npx supabase status`).
3. Your `.env` variables match the local default Supabase values (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
