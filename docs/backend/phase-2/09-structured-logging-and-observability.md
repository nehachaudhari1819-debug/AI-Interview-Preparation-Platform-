# P2.9 — Structured Logging & Observability Foundation

## Overview

This document outlines the structured logging, lifecycle management, and observability foundation for the AI Interview Preparation Platform Backend. The design ensures high visibility in production, enforces strict data privacy, and coordinates safe application shutdown.

## 1. Structured Logging

The application uses Pino for high-performance, structured JSON logging in production and colorized output in development.

- **Primary Correlation Key**: `requestId`
- **Request Context**: `AsyncLocalStorage` safely injects `requestId` into nested call chains without prop drilling.
- **Privacy Hashing**: The `LOG_CLIENT_IP_MODE` configuration controls client IP logging. When set to `hash`, IP addresses are irreversibly hashed using `LOG_CLIENT_IP_HASH_KEY` to group requests by source without persisting actual IPs.
- **Redaction Rules**: Sensitive data fields (passwords, tokens, cookies, auth headers, and supabase keys) are automatically censored at the logger boundary.

## 2. Event Taxonomy

Logs are categorized using strict, fixed event names for reliable indexing:

- `application.starting`: Emitted during bootstrap.
- `application.ready`: Emitted when the server is accepting traffic.
- `application.startup_failed`: Emitted if the bootstrap fails.
- `http.request.completed`: Standard API request log.
- `http.request.aborted`: Emitted if the client abruptly disconnects.
- `http.request.error`: Emitted during a 500 error or operational failure.
- `process.uncaught_exception`: Global exception fallback.
- `process.unhandled_rejection`: Unhandled promise fallback.
- `application.shutdown.started`: Graceful shutdown initiated.
- `application.shutdown.completed`: Shutdown successfully completed.
- `application.shutdown.forced`: Shutdown timed out; connections forcefully closed.

## 3. Graceful Shutdown & Lifecycle Management

The Application Lifecycle defines strict state transitions:
`starting` → `ready` → `shutting_down` → `stopped` (or `failed`)

- **In-Flight Request Tracking**: A specialized middleware tracks active requests.
- **Shutdown Admission Control**: When the server enters the `shutting_down` state, new requests (excluding health probes) immediately receive a `503 Service Unavailable` response.
- **Grace Period**: The server waits up to `SHUTDOWN_GRACE_PERIOD_MS` for in-flight requests to drain naturally before forcefully closing underlying sockets.

## 4. Environment Variables

| Variable                   | Type    | Default       | Description                                                                          |
| -------------------------- | ------- | ------------- | ------------------------------------------------------------------------------------ |
| `LOG_LEVEL`                | string  | `info`        | Logging severity (`fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent`).     |
| `LOG_PRETTY`               | boolean | `true` in dev | If true, logs are colorized and formatted for humans. Must be `false` in production. |
| `LOG_HEALTH_REQUESTS`      | boolean | `false`       | If false, successful health check requests are omitted from the logs.                |
| `LOG_CLIENT_IP_MODE`       | string  | `omit`        | `omit` or `hash`.                                                                    |
| `LOG_CLIENT_IP_HASH_KEY`   | string  |               | Required when IP hashing is enabled. 32-256 characters.                              |
| `APP_VERSION`              | string  | `0.1.0`       | Application version embedded in base log metadata.                                   |
| `GIT_COMMIT_SHA`           | string  | `unknown`     | Commit SHA embedded in base log metadata.                                            |
| `SHUTDOWN_GRACE_PERIOD_MS` | number  | `15000`       | Maximum time to wait for requests to drain during shutdown.                          |
