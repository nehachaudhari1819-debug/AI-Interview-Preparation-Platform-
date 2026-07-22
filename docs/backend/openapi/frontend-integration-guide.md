# Frontend Integration Guide

This guide explains how to connect a frontend application to the AI Interview Preparation Platform API.

## API Base URL

- Local Development: `http://localhost:5000`
- Production: TBD

The base path for business routes is `/api/v1/`. Health routes (`/health` and `/health/ready`) are at the root level.

## Authentication Overview

The backend uses a dual-token approach for secure authentication:

1. **Access Token (Bearer)**: A short-lived JWT returned in the JSON response body upon login/registration. This token must be sent in the `Authorization` header of all protected requests.
2. **Refresh Session (Cookie)**: A long-lived, `HttpOnly`, `Secure` cookie automatically set by the server. It cannot be accessed via JavaScript.

### Bearer Token Attachment

When making requests to protected routes (e.g., `GET /api/v1/auth/me`), include the access token in the headers:

```typescript
const headers = {
  Authorization: `Bearer ${accessToken}`,
  "Content-Type": "application/json",
};
```

### Credentials & Cookies

For the refresh cookie to be sent and received properly, all requests to authentication endpoints (and any cross-origin requests) must include credentials:

```typescript
// Fetch API
fetch("http://localhost:5000/api/v1/auth/refresh", {
  method: "POST",
  credentials: "include", // CRITICAL: Enables cookie transmission
});

// Axios
axios.post(
  "http://localhost:5000/api/v1/auth/refresh",
  {},
  {
    withCredentials: true,
  },
);
```

### Token Refresh Flow

When an API request fails with a `401 Unauthorized` status (indicating an expired access token):

1. Catch the `401` error.
2. Call `POST /api/v1/auth/refresh` (with credentials).
3. If the refresh request succeeds, update the stored access token and retry the original request.
4. If the refresh request fails (e.g., `401`), the session is fully expired. Redirect the user to the login screen.

### Logout Behavior

Call `POST /api/v1/auth/logout` to terminate the session. The server will clear the `auth_session` cookie automatically. The frontend should discard the access token and redirect to the login screen.

## Error Handling

### Error Envelope

All errors are returned in a standard envelope:

```json
{
  "success": false,
  "message": "Human readable error message",
  "code": "ERROR_CODE_STRING",
  "meta": {
    "requestId": "uuid"
  }
}
```

### Validation Errors (`400 Bad Request`)

If the error is due to request validation, an additional `errors` array is provided:

```json
{
  "success": false,
  "message": "Validation failed",
  "code": "VALIDATION_ERROR",
  "errors": [{ "field": "email", "message": "Invalid email format" }],
  "meta": { "requestId": "uuid" }
}
```

### Rate Limiting (`429 Too Many Requests`)

When rate limits are exceeded, the API returns a `429` status. The frontend should respect the `Retry-After` header:

```typescript
const retryAfterSeconds = response.headers.get("Retry-After");
if (response.status === 429 && retryAfterSeconds) {
  console.log(`Rate limited. Try again in ${retryAfterSeconds} seconds.`);
}
```

## Request Tracking

Every response includes an `X-Request-ID` header. If a user encounters an unexpected error (e.g., `500 Internal Server Error`), surfacing this Request ID in the UI can help support engineers trace the logs.

## Health and Readiness

- **Liveness** (`GET /health`): Used by infrastructure to verify the process is running.
- **Readiness** (`GET /health/ready`): Used by infrastructure to verify the app can serve traffic (e.g., database connected). If the backend is gracefully shutting down, this endpoint will return `503 Service Unavailable`.
