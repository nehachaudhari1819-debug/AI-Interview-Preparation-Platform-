# P2.2 — TypeScript and Express Application Foundation

## 1. Purpose

This document establishes the foundational architecture for the Express application, defining constants, standardized response formats, error handling mechanisms, middleware behavior, and the core server lifecycle. It sets the baseline upon which all future feature modules (auth, interviews, feedback, etc.) will be built.

## 2. Scope

- Application constants (`PORT`, `API_PREFIX`, body limits)
- Error codes and HTTP status mappings
- Typed request contexts
- API response models (success, error, pagination)
- Centralized `AppError` and specialized variants
- Deterministic middleware registration
- Request correlation via UUIDs
- Robust express factory and testable dependencies
- Server graceful shutdown and timeouts

## 3. Out-of-scope items

- Supabase integration and database clients
- Authentication, tokens, and authorization
- Feature modules (Questions, Interviews, Resume)
- CORS, Helmet, Rate Limiting, and advanced security configurations
- External AI provider adapters

## 4. Application architecture

- **`app.ts`**: The pure application factory that constructs the Express app dynamically.
- **`server.ts`**: The entrypoint responsible for port resolution, startup logging, and signals mapping.
- **`routes`**: Versioned API router entry points.
- **`middleware`**: Core cross-cutting functions for request ID tagging, not found generation, and central error transformation.
- **`errors`**: Domain-specific typed error extensions of `Error`.
- **`types`**: TypeScript ambient types (`Express.Request`) and schema types for JSON contracts.
- **`utilities`**: Small functions for UUID generation and structured response payloads.
- **`constants`**: Centralized configurations mapped for simple reuse.

## 5. Middleware order

The execution sequence in `app.ts` is strictly deterministic:

1. Framework overrides (Disable `X-Powered-By`)
2. Request ID generation / capture (`requestIdMiddleware`)
3. Body parsers (`express.json`, `express.urlencoded`)
4. Feature Routers (future security middlewares will precede this layer)
5. Not-found catch-all (`notFoundMiddleware`)
6. Central error transformer (`errorHandlerMiddleware`)

## 6. API prefix

`API_PREFIX` is globally mapped to `/api/v1`.

## 7. Request ID contract

- **Incoming Header**: `X-Request-ID` (UUID formatted, maximum 64 chars).
- **Generation**: Created automatically using `node:crypto` `randomUUID` if missing/invalid.
- **Propagation**: Saved securely to `req.context.requestId`.
- **Response**: Emitted back in the HTTP Header `X-Request-ID` and in JSON as `meta.requestId`.

## 8. Success response contract

Success responses wrap unstructured JSON data in a uniform shell.

```json
{
  "success": true,
  "message": "Operation successful.",
  "data": { "id": 123 },
  "meta": { "requestId": "abcd-1234..." }
}
```

## 9. Error response contract

Error envelopes hide operational secrets while explaining failures simply.

```json
{
  "success": false,
  "message": "Resource not found.",
  "code": "RESOURCE_NOT_FOUND",
  "meta": { "requestId": "abcd-1234..." },
  "errors": [{ "field": "email", "message": "Invalid format" }]
}
```

## 10. Error taxonomy

- **`AppError`**: Base application exception enclosing status codes and public messaging.
- **`NotFoundError`**: Used implicitly by the `notFoundMiddleware` or explicitly by controllers.
- **`ValidationError`**: Triggers HTTP 422 containing deep field errors.
- **`InternalServerError`**: Masks critical runtime failures to the end user.
- **Parser Normalization**: Converts raw body-parser failures (`entity.too.large`, `entity.parse.failed`) into HTTP 413 and 400 safely.

## 11. Type augmentation

The Express namespace has been properly augmented globally (`Express.Request`) to include the `context` object, providing strict access to `requestId`.

## 12. Router architecture

Fake functional routes have intentionally been omitted to prevent testing debt or insecure phantom routes. The `/api/v1` router is initialized securely, waiting for future controllers to register valid paths.

## 13. Application factory

`createApp()` acts as a decoupled factory, optionally accepting an injected `Router`. This allows test specifications to mount ad-hoc routes inside the application architecture without touching production configurations.

## 14. Server lifecycle

- `PORT` parsing ensures non-privileged, integer resolution between 1-65535, defaulting to 5000.
- Safe listeners trigger exactly once.
- Deterministic signal hooks track state using `isShuttingDown` to avert repetitive callbacks.
- A forced timeout (10,000ms) prevents hanging processes if connections stubbornly refuse to close.

## 15. Security posture

- Stack traces are completely sanitized and dropped from network responses.
- Application error causes are suppressed.
- `express` parsers map errors safely to known codes rather than dumping underlying buffer exceptions.
- Hardened default limits (`1mb`) defend against memory exhaustions.

## 16. Test inventory

1. **`request-id.middleware.spec.ts`**: Ensures UUIDs are tracked or reliably generated.
2. **`app-error.spec.ts`**: Checks prototype inheritance and payload configuration.
3. **`api-response.spec.ts`**: Asserts envelope formatting, nullity handling, and pagination tracking.
4. **`not-found.middleware.spec.ts`**: Verifies dynamic route construction and 404 bubbling.
5. **`error-handler.middleware.spec.ts`**: Confirms masking rules for operational vs unknown errors and parser conversions.
6. **`application.integration.spec.ts`**: Uses `supertest` to mount the network layer completely, verifying headers, 404 boundaries, payload limit 413 triggers, and parsing malformations.

## 17. Validation results

- `npm run format:check`: PENDING
- `npm run lint`: PENDING
- `npm run typecheck`: PENDING
- `npm test`: PENDING
- `npm run build`: PENDING
- `npm run validate`: PENDING
- `git diff --check`: PENDING

## 18. Deferred work

- Environment validation, Database initialization, Supabase clients, Authentication routines, Rate limit scaling, Advanced logging tools (e.g. Pino).

## 19. Acceptance checklist

- [x] Correct `backend` branch confirmed
- [x] Starting P2.1 commit confirmed
- [x] Node.js v24.11.0 confirmed
- [x] npm 11.6.1 confirmed
- [x] Existing P2.1 scaffold preserved
- [x] Application constants created
- [x] HTTP constants created
- [x] Foundation error codes created
- [x] Central `/api/v1` router created
- [x] No fake feature routes created
- [x] Request context type created
- [x] Express request augmentation created
- [x] Request-ID generator created
- [x] Request-ID middleware created
- [x] Valid client request ID preserved
- [x] Invalid client request ID replaced
- [x] Response request-ID header added
- [x] Request ID included in API metadata
- [x] API success response types created
- [x] API error response types created
- [x] Pagination response type created
- [x] Success response helper created
- [x] Collection response helper created
- [x] `AppError` created
- [x] `NotFoundError` created
- [x] `ValidationError` created
- [x] `InternalServerError` created
- [x] Central not-found middleware created
- [x] Central error handler created
- [x] Unknown errors converted to safe `500`
- [x] Known errors preserve safe status and code
- [x] Stack traces excluded from responses
- [x] Internal causes excluded from responses
- [x] Parser errors normalized safely
- [x] Invalid JSON returns safe `400`
- [x] Oversized JSON returns safe `413`
- [x] Headers-already-sent behavior handled
- [x] Middleware order documented
- [x] `createApp()` remains testable
- [x] Test router injection supported or equivalent
- [x] `app.ts` does not start a listener
- [x] `server.ts` starts exactly one listener
- [x] Port validation preserved
- [x] SIGINT shutdown implemented
- [x] SIGTERM shutdown implemented
- [x] Duplicate shutdown prevented
- [x] Forced-shutdown timeout implemented
- [x] Unit tests added
- [x] Integration tests added
- [x] Unknown route contract tested
- [x] Request-ID behavior tested
- [x] Error envelope tested
- [x] Parser errors tested
- [x] `X-Powered-By` remains disabled
- [x] No Supabase integration added
- [x] No authentication code added
- [x] No feature modules added
- [x] No real secrets committed
- [x] P2.2 documentation created
- [ ] Formatting passes
- [ ] Lint passes
- [ ] Typecheck passes
- [ ] Tests pass
- [ ] Build passes
- [ ] Full validation passes
- [ ] `git diff --check` passes
- [ ] Only P2.2 files staged
- [ ] Commit pushed to `origin/backend`
- [ ] Final working tree clean

## 20. Git evidence

- **Branch**: `backend`
- **Commit**: PENDING
- **Full SHA**: PENDING
- **Push**: PENDING
- **Changed-file summary**: PENDING
