# P2.8 — Rate Limiting & API Security Refinement

This document outlines the security controls implemented to protect the AI Interview Preparation Platform's API boundary.

## 1. Rate Limiting Policies

Three centralized rate limit policies govern the API:

- **Global API Rate Limit**: Applies to all `/api/v1` routes to prevent general API abuse. Default is 100 requests per 15 minutes.
- **Authentication Credentials**: Applies to login and register endpoints to prevent brute-force attacks. Default is 5 requests per 15 minutes.
- **Authentication Session**: Applies to refresh and logout endpoints to prevent session-based token exhaustion. Default is 10 requests per 15 minutes.

### Key Security Features

- **Fail-Closed Behavior**: If the rate limit store fails, requests are denied to preserve boundary security.
- **Proxy Trust**: Configuration requires explicit hops (`TRUST_PROXY_HOPS`). `X-Forwarded-For` spoofing is prevented by correctly counting hops from the edge.
- **Deterministic Keys**: Uses `request.ip` directly.

## 2. Request Boundaries

- **Payload Too Large**: Bounded JSON parser configured with `JSON_BODY_LIMIT_BYTES` (default 100kb). Any request exceeding this receives a 413 Payload Too Large.
- **Malformed JSON**: Parse errors in `express.json` are captured and returned as a 400 Malformed JSON error, ensuring no internal stack traces leak.
- **Compressed Bodies**: Compression is explicitly disabled (`inflate: false`). 415 Unsupported Content Encoding is returned if encoded payloads are sent.
- **URI Length**: Rejects URIs longer than `MAX_URL_LENGTH` (default 2048) with a 414 URI Too Long.
- **Query Parameters**: Limits maximum parsed parameters to `MAX_QUERY_PARAMETERS` (default 50) returning 400.
- **Method Guard**: Strict HTTP method allow-list (GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS). Rejects methods like TRACE, TRACK, CONNECT with 405 Method Not Allowed.

## 3. HTTP Server Controls

The built-in Node.js HTTP server is explicitly configured for defensive timeouts:

- `requestTimeoutMs`: Drops slow connections.
- `headersTimeoutMs`: Drops slowloris attacks.
- `keepAliveTimeoutMs`: Reaps idle connections.
- `maxHeadersCount`: Prevents header bloat attacks.

## 4. Cross-Origin & Protocol Security

- **CORS**: Strict Origin allow-list matching. Explicit Allowed headers (Authorization, Content-Type, X-Request-ID). Exposed headers (RateLimit, Retry-After, X-Request-ID).
- **Helmet**: Disables `X-Powered-By`. Configures strict Content Security Policy, strict HSTS, Frameguard, and Cross-Origin isolation policies.
