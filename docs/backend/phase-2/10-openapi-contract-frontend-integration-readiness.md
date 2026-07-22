# Phase 2.10 — OpenAPI Contract & Frontend Integration Readiness

## Objective

Establish a deterministic, statically-generated OpenAPI 3.1 contract and a frontend integration guide without adding unnecessary runtime dependencies or public `/docs` routes. This ensures that frontend developers have a clear, typed understanding of the current backend capabilities.

## Scope

- Creation of an OpenAPI 3.1 contract describing only implemented routes (`/health`, `/health/ready`, and `/api/v1/auth/*`).
- Creation of a Frontend Integration Guide detailing authentication mechanisms, error handling, and rate limits.
- Implementation of a deterministic OpenAPI generation pipeline integrated into the `npm run validate` process.
- Addition of unit, integration, and security tests to ensure contract validity and prevent information disclosure.

## Architecture

The OpenAPI contract is defined natively in TypeScript without reliance on decorators or runtime metadata extensions. This ensures zero impact on production bundle size and execution performance.

- `src/openapi/openapi.types.ts`: Lightweight TS interfaces for OpenAPI 3.1 Document structure.
- `src/openapi/components/`: Reusable request/response schemas and security schemes.
- `src/openapi/paths/`: Specific API route definitions.
- `src/openapi/openapi-document.ts`: Assembly of the root document.
- `src/openapi/generate.ts`: Build-time script to serialize the document to JSON.

## Contract-Generation Process

The OpenAPI document is updated via:

```bash
npm run openapi:generate
```

This script resolves the TypeScript definitions and outputs a deterministic `openapi.json` file in the `docs/backend/openapi/` directory.

During CI/validation, the process enforces freshness:

```bash
npm run openapi:check
```

If the source definitions drift from the checked-in JSON artifact, validation fails.

## Authentication Model

The API employs a dual-token strategy:

- **Bearer Token**: Provided via the `Authorization` header for API requests.
- **Session Cookie**: An `HttpOnly` refresh token used to silently renew the Bearer token via `/api/v1/auth/refresh`.

## Security Rules

- The contract and related tests strictly forbid exposing secrets, internal paths, or process environment details.
- Fictional data (e.g., `user@example.com`, `00000000-0000-4000-8000-000000000000`) is used for all schema examples.
- Hidden administrative endpoints or debugging routes are omitted from the OpenAPI specification by design.

## Frontend Integration Rules

See [Frontend Integration Guide](../openapi/frontend-integration-guide.md) for full details on CORS, credentials inclusion, request ID handling, and error envelope parsing.

## Testing Strategy

- **Unit**: Validate the OpenAPI 3.1 schema structure, deduplication of IDs, and deterministic generation behavior.
- **Integration**: Verify that the generated OpenAPI path inventory precisely matches the routes active on the Express app.
- **Security**: Assert that sensitive keys (e.g., Supabase keys, salt values) are never included in the generated output.

## Known Limitations

- The OpenAPI definitions are manually maintained alongside the Zod validation schemas. Future iterations may explore `@asteasolutions/zod-to-openapi` purely as a build-time step if route complexity increases.

## Future Extension Rules

When adding new endpoints (e.g., during Phase 3), developers must:

1. Implement the route in Express.
2. Define the OpenAPI types in `src/openapi/components` and `src/openapi/paths`.
3. Link the new paths to `openapi-document.ts`.
4. Run `npm run openapi:generate` to update the artifact.
