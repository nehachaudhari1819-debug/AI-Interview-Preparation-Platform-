# P2.3 — Environment Configuration and Validation

## 1. Purpose

Raw environment variables are untrusted strings that can lead to subtle bugs and security vulnerabilities if used directly throughout the application. The goal of this phase is to establish a secure, typed, immutable, and fail-fast environment configuration system that validates settings at startup and prevents secret leakage.

## 2. Scope

- Installed `zod` and `dotenv`.
- Created typed models for environment variables (`NodeEnvironment`, `AiProvider`, etc.).
- Developed reusable parsers for integers, booleans, and empty strings.
- Defined a strict Zod schema enforcing all constraints.
- Integrated cross-field rules (e.g., `COOKIE_SAME_SITE`=none requires `COOKIE_SECURE`=true).
- Configured a safe startup loader that handles `.env` precedence correctly.
- Created `ApplicationConfig` object and ensured immutability via `deepFreeze`.
- Updated `server.ts` to fail-fast before calling `app.listen()` when validation fails.
- Restricted direct `process.env` access to `src/config/`.

## 3. Out-of-Scope

- Supabase clients (auth/database integrations).
- AI integration clients (OpenAI/Gemini).
- CORS/Security headers, rate limiting middlewares.

## 4. Configuration Lifecycle

1. **Load Environment**: Combine OS env vars with `.env` file via `dotenv`.
2. **Validation**: Pass merged environment to `zod` schema.
3. **Mapping**: Convert flat ValidatedEnvironment into structured `ApplicationConfig`.
4. **Immutability**: Freeze the config object.
5. **Startup**: Create a safe summary (scrubbing secrets) for logging and initiate server listening.

## 5. Source Precedence

- Explictly injected sources (e.g., during tests).
- Operating system `process.env`.
- Variables defined in `.env` (won't overwrite OS variables).
- Schema defaults.

## 6. Supported Variables

| Variable                                 | Required/Optional | Default       | Type              | Secret Classification |
| ---------------------------------------- | ----------------- | ------------- | ----------------- | --------------------- |
| NODE_ENV                                 | Optional          | `development` | `NodeEnvironment` | Public                |
| PORT                                     | Optional          | `5000`        | `number`          | Public                |
| SHUTDOWN_TIMEOUT_MS                      | Optional          | `10000`       | `number`          | Public                |
| FRONTEND_URL                             | Required          | N/A           | `string`          | Public                |
| SUPABASE_URL                             | Optional          | N/A           | `string`          | Server Config         |
| SUPABASE_PUBLISHABLE_KEY                 | Optional          | N/A           | `string`          | Server Config         |
| SUPABASE_SECRET_KEY                      | Optional          | N/A           | `string`          | Server-Only Secret    |
| SUPABASE_SERVICE_ROLE_KEY                | Optional (Legacy) | N/A           | `string`          | Server-Only Secret    |
| AI_PROVIDER                              | Optional          | `gemini`      | `AiProvider`      | Server Config         |
| GEMINI_API_KEY                           | Optional          | N/A           | `string`          | Server-Only Secret    |
| OPENAI_API_KEY                           | Optional          | N/A           | `string`          | Server-Only Secret    |
| RESUME_BUCKET                            | Optional          | `resumes`     | `string`          | Server Config         |
| COOKIE_SECURE                            | Optional          | `false`       | `boolean`         | Server Config         |
| COOKIE_SAME_SITE                         | Optional          | `lax`         | `CookieSameSite`  | Server Config         |
| LOG_LEVEL                                | Optional          | `info`        | `LogLevel`        | Server Config         |
| LOG_PRETTY                               | Optional          | `false`       | `boolean`         | Server Config         |
| LOG_HEALTH_REQUESTS                      | Optional          | `false`       | `boolean`         | Server Config         |
| LOG_CLIENT_IP_MODE                       | Optional          | `omit`        | `string`          | Server Config         |
| LOG_CLIENT_IP_HASH_KEY                   | Optional          | N/A           | `string`          | Server-Only Secret    |
| APP_VERSION                              | Optional          | `0.1.0`       | `string`          | Server Config         |
| GIT_COMMIT_SHA                           | Optional          | `unknown`     | `string`          | Server Config         |
| SHUTDOWN_GRACE_PERIOD_MS                 | Optional          | `15000`       | `number`          | Server Config         |
| TRUST_PROXY_HOPS                         | Optional          | `0`           | `number`          | Server Config         |
| RATE_LIMIT_IPV6_SUBNET                   | Optional          | `56`          | `number`          | Server Config         |
| RATE_LIMIT_GLOBAL_ENABLED                | Optional          | `true`        | `boolean`         | Server Config         |
| RATE_LIMIT_GLOBAL_WINDOW_MS              | Optional          | `900000`      | `number`          | Server Config         |
| RATE_LIMIT_GLOBAL_MAX_REQUESTS           | Optional          | `100`         | `number`          | Server Config         |
| RATE_LIMIT_AUTH_CREDENTIALS_ENABLED      | Optional          | `true`        | `boolean`         | Server Config         |
| RATE_LIMIT_AUTH_CREDENTIALS_WINDOW_MS    | Optional          | `900000`      | `number`          | Server Config         |
| RATE_LIMIT_AUTH_CREDENTIALS_MAX_REQUESTS | Optional          | `5`           | `number`          | Server Config         |
| RATE_LIMIT_AUTH_SESSION_ENABLED          | Optional          | `true`        | `boolean`         | Server Config         |
| RATE_LIMIT_AUTH_SESSION_WINDOW_MS        | Optional          | `900000`      | `number`          | Server Config         |
| RATE_LIMIT_AUTH_SESSION_MAX_REQUESTS     | Optional          | `10`          | `number`          | Server Config         |
| REQUEST_JSON_BODY_LIMIT_BYTES            | Optional          | `102400`      | `number`          | Server Config         |
| REQUEST_MAX_URL_LENGTH                   | Optional          | `2048`        | `number`          | Server Config         |
| REQUEST_MAX_QUERY_PARAMETERS             | Optional          | `50`          | `number`          | Server Config         |
| CORS_PREFLIGHT_MAX_AGE_SECONDS           | Optional          | `600`         | `number`          | Server Config         |

## 7. Secret Classification

- **Public**: Safe to expose (e.g. PORT)
- **Server Configuration**: Should remain server-side but not critical if leaked in logs (e.g. LOG_LEVEL, SUPABASE_URL).
- **Server-Only Secrets**: Highly sensitive. Must never be logged or serialized (e.g. SUPABASE_SERVICE_ROLE_KEY).

## 8. Immutability & Safe Logging

The configuration object is deeply frozen at startup. The safe summary explicitly omits all secrets and prints only safe properties and boolean flags (e.g., `supabasePrivilegedKeyType: "secret"`, `geminiConfigured: true`) for auditing.

**Supabase completeness**: Either Supabase is absent, or fully configured with exactly ONE privileged key (`SUPABASE_SECRET_KEY` [preferred] or `SUPABASE_SERVICE_ROLE_KEY` [legacy]). Partial configuration or providing both privileged keys fails validation.

## 9. Security Posture

- Secret redaction in `ConfigurationError`.
- No configuration sent to clients.
- The server fails fast and does not start in an invalid state.

## 10. Validation Evidence

- `npm run format:check`: PASS
- `npm run lint`: PASS
- `npm run typecheck`: PASS
- `npm run validate`: PASS (To be confirmed by User)
- Tests: PASS

## 11. Acceptance Checklist

- [x] Node v24.11.0, npm 11.6.1 confirmed
- [x] `zod` & `dotenv` installed
- [x] Parsers & schemas implemented
- [x] Secret redacted configuration issues
- [x] `deepFreeze` implemented
- [x] `server.ts` refactored to fail-fast
- [x] `.env.example` & `README.md` updated
- [x] No `process.env` outside `src/config`
- [x] All Unit & Integration tests passing
