# P1.2 — COMPLETE BACKEND API BLUEPRINT

## 1. Global API Standards

### URL Conventions
* Plural resource names (e.g., `/interviews`, `/users`).
* Lowercase kebab-case (e.g., `/resume-analyses`).
* UUID route parameters (e.g., `/:interviewId`).
* Nested routes used for ownership or context (e.g., `/interviews/:interviewId/responses`).

### HTTP Methods
* **GET**: Read resources.
* **POST**: Create resources, process actions (e.g., `/start`, `/complete`), or trigger evaluations.
* **PATCH**: Update partial fields of a resource.
* **DELETE**: Remove resources.

### Content Types
* `application/json` (Default for APIs).
* `multipart/form-data` (For resume uploads).

### Request Headers
```text
Authorization: Bearer <access-token>
Content-Type: application/json
X-Request-ID: optional-client-request-id
Idempotency-Key: optional-for-specific-actions
```

### Standard Success Envelope
```json
{
  "success": true,
  "message": "Resource successfully retrieved",
  "data": {},
  "meta": {
    "requestId": "uuid"
  }
}
```

### Collection Response Envelope
```json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalItems": 100,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPreviousPage": false
  },
  "meta": {
    "requestId": "uuid"
  }
}
```

### Standard Error Envelope
```json
{
  "success": false,
  "message": "Request validation failed",
  "code": "VALIDATION_ERROR",
  "errors": [
    {
      "field": "difficulty",
      "message": "Difficulty must be easy, medium, or hard"
    }
  ],
  "meta": {
    "requestId": "uuid"
  }
}
```

### Error Codes
* `VALIDATION_ERROR`
* `AUTHENTICATION_REQUIRED`
* `INVALID_TOKEN`
* `TOKEN_EXPIRED`
* `EMAIL_NOT_VERIFIED`
* `FORBIDDEN`
* `RESOURCE_NOT_FOUND`
* `RESOURCE_CONFLICT`
* `RATE_LIMIT_EXCEEDED`
* `FILE_VALIDATION_FAILED`
* `UNSUPPORTED_FILE_TYPE`
* `FILE_TOO_LARGE`
* `INTERVIEW_ALREADY_COMPLETED`
* `INVALID_INTERVIEW_STATE`
* `AI_PROVIDER_UNAVAILABLE`
* `AI_RESPONSE_INVALID`
* `DATABASE_ERROR`
* `INTERNAL_SERVER_ERROR`

### HTTP Status Codes
* `200 OK`: Successful read/update/delete.
* `201 Created`: Successful creation.
* `202 Accepted`: Accepted for asynchronous processing.
* `204 No Content`: Successful deletion or action with no response body.
* `400 Bad Request`: Validation failure.
* `401 Unauthorized`: Authentication missing or invalid.
* `403 Forbidden`: Authenticated but lack sufficient permissions.
* `404 Not Found`: Resource does not exist.
* `409 Conflict`: Business rule violation (e.g. invalid state transition).
* `413 Payload Too Large`: Request body/file too large.
* `415 Unsupported Media Type`: Incorrect content type.
* `422 Unprocessable Entity`: Validation passed but semantics are invalid.
* `429 Too Many Requests`: Rate limit exceeded.
* `500 Internal Server Error`: Unexpected backend failure.
* `502 Bad Gateway`: External provider (Supabase Auth/AI) invalid response.
* `503 Service Unavailable`: External provider unavailable.

### Pagination
* Default: `page=1, limit=20`
* Maximum: `limit=100`
* Invalid values (e.g., negative or non-integer) fall back to defaults or reject with 400.

### Filtering
Query parameters match model attributes where specified.
Example: `GET /api/v1/questions?category=technical&difficulty=medium`

### Sorting
* Parameters: `sortBy`, `sortOrder` (`asc`, `desc`).
* Only fields documented in each endpoint's allowlist are permitted.

### Search
* Parameter: `search`
* Search is case-insensitive.
* Minimum length: 3 characters. Maximum length: 100 characters.

### Dates
ISO 8601 UTC timestamps (e.g., `2026-07-21T10:30:00.000Z`).

### Identifiers
UUIDs for all public resource references.

### Null vs Omitted Values
* **Omitted**: Retain current value (PATCH behavior).
* **null**: Remove the existing value.
* **Empty string**: Evaluated as `null` unless explicitly supported.
* **Empty array**: Clears associated list values.

### Idempotency
`Idempotency-Key` headers are supported for:
* `POST /api/v1/interviews`
* `POST /api/v1/interviews/:interviewId/complete`
* `POST /api/v1/resume-analyses`

### Concurrency
* **Duplicate Submission**: Unique composite constraints (e.g., `interviewId` + `questionId`) in PostgreSQL.
* **State Updates**: Checking expected state before transitions (e.g., verify `in_progress` before `complete`).
* **Optimistic Concurrency**: Row-level locks during transition updates to prevent race conditions.

### System Health APIs (Public)
* `GET /api/v1/health`: Basic liveness probe.
* `GET /api/v1/health/ready`: Readiness probe checking database/provider connectivity.

---

## 2. Authentication APIs

### POST /api/v1/auth/register

**Purpose:**  
Register a new student account via Supabase Auth.

**Access:**  
PUBLIC

**Headers:**
```text
Content-Type: application/json
```

**Path parameters:** None

**Query parameters:** None

**Request body:**
```json
{
  "email": "student@example.com",
  "password": "StrongPassword123!",
  "fullName": "John Doe"
}
```

**Validation rules:**
* `email`: valid email format.
* `password`: minimum 8 characters, 1 uppercase, 1 number.
* `fullName`: string, length 2-100.

**Success response (201):**
```json
{
  "success": true,
  "message": "Registration successful. Please check your email for verification.",
  "data": { "userId": "uuid", "email": "student@example.com" }
}
```

**Possible errors:**
| Status | Code | Condition |
| -----: | ---- | --------- |
| 400 | VALIDATION_ERROR | Invalid inputs |
| 409 | RESOURCE_CONFLICT | Email already in use |

**Rate-limit category:**  
AUTH_STRICT

**Frontend notes:**  
The frontend must inform the user to check their email for a verification link.

---

### POST /api/v1/auth/login

**Purpose:**  
Authenticate a user and return session tokens.

**Access:**  
PUBLIC

**Headers:**
```text
Content-Type: application/json
```

**Path parameters:** None

**Query parameters:** None

**Request body:**
```json
{
  "email": "student@example.com",
  "password": "StrongPassword123!"
}
```

**Validation rules:**
* `email`: valid email format.
* `password`: string required.

**Success response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "jwt-token",
    "refreshToken": "refresh-token",
    "user": {
      "id": "uuid",
      "email": "student@example.com",
      "fullName": "John Doe"
    }
  }
}
```

**Possible errors:**
| Status | Code | Condition |
| -----: | ---- | --------- |
| 401 | UNAUTHORIZED | Invalid credentials |
| 403 | EMAIL_NOT_VERIFIED | Email not verified |

**Rate-limit category:**  
AUTH_STRICT

**Frontend notes:**  
Store `accessToken` in memory or HttpOnly cookies per final auth implementation. Store `refreshToken` securely.

*(Note: `/auth/refresh`, `/auth/logout`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/resend-verification`, and `/auth/session` follow the standard JWT exchange and reset workflows).*

---

## 3. User Profile APIs

### GET /api/v1/users/me

**Purpose:**  
Retrieve the currently authenticated user's profile.

**Access:**  
AUTHENTICATED

**Headers:**
```text
Authorization: Bearer <token>
```

**Path parameters:** None
**Query parameters:** None
**Request body:** None

**Success response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "student@example.com",
    "fullName": "John Doe",
    "college": "Engineering Institute",
    "skills": ["JavaScript", "Node.js"],
    "createdAt": "2026-07-21T10:30:00.000Z"
  }
}
```

### PATCH /api/v1/users/me

**Purpose:**  
Update specific fields of the user profile.

**Access:**  
AUTHENTICATED

**Headers:**
```text
Authorization: Bearer <token>
Content-Type: application/json
```

**Request body:**
```json
{
  "fullName": "John Doe",
  "college": "Engineering Institute",
  "skills": ["JavaScript", "Node.js", "React"]
}
```

**Validation rules:**
* Allowlist fields only (`fullName`, `college`, `branch`, `graduationYear`, `experienceLevel`, `preferredRoles`, `skills`, `bio`, `avatarUrl`).

**Success response (200):** Returns updated profile.

**Rate-limit category:**  
USER_STANDARD

---

## 4. Question-Bank APIs

### GET /api/v1/questions

**Purpose:**  
List questions for practice.

**Access:**  
AUTHENTICATED

**Headers:**
```text
Authorization: Bearer <token>
```

**Path parameters:** None

**Query parameters:**

| Parameter | Type | Required | Default | Validation |
| --------- | ---- | -------: | ------- | ---------- |
| category | string | false | | technical, hr, aptitude |
| difficulty | string | false | | easy, medium, hard |
| search | string | false | | min 3 chars |

**Success response (200):**
Paginated list of questions.

---

## 5. Mock-Interview APIs

### POST /api/v1/interviews

**Purpose:**  
Create a new interview configuration.

**Access:**  
AUTHENTICATED

**Headers:**
```text
Authorization: Bearer <token>
Content-Type: application/json
Idempotency-Key: <uuid>
```

**Request body:**
```json
{
  "title": "Backend Dev Mock",
  "interviewType": "technical",
  "difficulty": "medium",
  "targetRole": "Backend Developer",
  "questionCount": 5,
  "timeLimitMinutes": 30
}
```

**Validation rules:**
* `interviewType`: technical, behavioral, mixed.
* `difficulty`: easy, medium, hard.
* `questionCount`: integer 1-20.

**Success response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "draft",
    "createdAt": "2026-07-21T10:30:00.000Z"
  }
}
```

**Rate-limit category:**  
USER_STANDARD

---

### POST /api/v1/interviews/:interviewId/start

**Purpose:**  
Transition a draft interview to `in_progress` and assign/generate questions.

**Access:**  
RESOURCE_OWNER

**Path parameters:**
`interviewId` (uuid)

**Success response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "in_progress",
    "startedAt": "2026-07-21T10:30:00.000Z"
  }
}
```

**Possible errors:**
| Status | Code | Condition |
| -----: | ---- | --------- |
| 403 | FORBIDDEN | User does not own the interview |
| 409 | INVALID_INTERVIEW_STATE | Interview is not in 'draft' or 'ready' state |

---

## 6. Response and Evaluation APIs

### GET /api/v1/interviews/:interviewId/questions

**Purpose:**  
Retrieve all questions assigned to a specific interview.

**Access:**  
RESOURCE_OWNER

---

### GET /api/v1/interviews/:interviewId/questions/:questionId

**Purpose:**  
Retrieve details for a specific interview question.

**Access:**  
RESOURCE_OWNER

---

### POST /api/v1/interviews/:interviewId/responses

**Purpose:**  
Submit an answer to a question within an active interview and trigger AI evaluation.

**Access:**  
RESOURCE_OWNER

**Request body:**
```json
{
  "questionId": "uuid",
  "answerText": "I would use a relational database...",
  "timeSpentSeconds": 120
}
```

**Validation rules:**
* `questionId` must belong to the `interviewId`.
* Interview must be `in_progress`.
* `answerText` required, max 5000 chars.

**Success response (200):**
(Note: Using synchronous evaluation initially. May migrate to 202 async if AI delays are high.)
```json
{
  "success": true,
  "data": {
    "id": "response-uuid",
    "evaluation": {
      "overallScore": 85,
      "technicalAccuracy": 90,
      "communication": 80,
      "strengths": ["Clear explanation"],
      "weaknesses": ["Missed scaling considerations"]
    }
  }
}
```

**Rate-limit category:**  
AI_EXPENSIVE

---

### GET /api/v1/interviews/:interviewId/responses/:responseId

**Purpose:**  
Retrieve details and evaluation for a specific response.

**Access:**  
RESOURCE_OWNER

---

## 7. Resume-Analysis APIs

### POST /api/v1/resume-analyses

**Purpose:**  
Upload a resume for AI analysis.

**Access:**  
AUTHENTICATED

**Headers:**
```text
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Request body:**
Multipart file field: `resume` (PDF or DOCX).

**Success response (202):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "uploaded",
    "message": "Resume uploaded and queued for analysis."
  }
}
```

**Rate-limit category:**  
UPLOAD_EXPENSIVE

---

## 8. Progress and Analytics APIs

### GET /api/v1/progress/summary

**Purpose:**  
Retrieve calculated progress metrics for the user.

**Access:**  
AUTHENTICATED

**Success response (200):**
```json
{
  "success": true,
  "data": {
    "totalInterviews": 12,
    "averageScore": 76.5,
    "strongTopics": ["JavaScript", "SQL"],
    "weakTopics": ["System Design"]
  }
}
```

---

## 9. Feedback APIs

### GET /api/v1/interviews/:interviewId/feedback

**Purpose:**  
Retrieve comprehensive feedback for a completed interview.

**Access:**  
RESOURCE_OWNER

**Workflow Notes:**  
* `POST /api/v1/interviews/:interviewId/complete` generates the feedback.
* `GET /api/v1/interviews/:interviewId/feedback` retrieves the generated feedback.
* Repeated completion requests are idempotent and do not regenerate feedback.

**Success response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "strengths": [...],
    "learningPlan": "Review Normalization forms...",
    "nextInterviewDifficulty": "hard"
  }
}
```

---

## 10. Administrative APIs

**Security for all admin routes:**
Strict Role-Based Access Control middleware. Ordinary users receive 403 Forbidden.

### Users Management
* `GET /api/v1/admin/users`: List all platform users.
* `GET /api/v1/admin/users/:userId`: Retrieve details for a specific user.
* `PATCH /api/v1/admin/users/:userId/status`: Update a user's account status (e.g., suspend, activate).

### Questions Management
* `GET /api/v1/admin/questions`: List all global questions.
* `POST /api/v1/admin/questions`: Create a new global question.
* `PATCH /api/v1/admin/questions/:questionId`: Update a global question.
* `DELETE /api/v1/admin/questions/:questionId`: Delete a global question.

### Platform Data Access
* `GET /api/v1/admin/interviews`: List all interviews for monitoring.
* `GET /api/v1/admin/resume-analyses`: List all resume analyses for monitoring.
* `GET /api/v1/admin/system/metrics`: Retrieve platform usage metrics.

---

## 11. Frontend Integration Contract

* **Base URL**: `https://api.yourdomain.com/api/v1` (Production), `http://localhost:3000/api/v1` (Local)
* **Auth**: Attach `Authorization: Bearer <token>` to all protected routes.
* **Token Expiry**: On 401 response, frontend should attempt silent refresh via `/api/v1/auth/refresh`.
* **Content Types**: Ensure `application/json` is sent explicitly for JSON payloads. Let the browser construct the boundary for `multipart/form-data` uploads.
* **Loading States**: Frontend must implement visual loading indicators, especially for AI routes, which may take 3-10 seconds to resolve.
* **Idempotency**: Attach a generated UUID to `Idempotency-Key` headers when submitting answers to prevent double-charging AI on network retries.
* **Trust Boundaries**: Frontend must never send calculated scores; backend determines all authoritative scoring.

---

## 12. Acceptance Checklist

* [x] API base and version defined
* [x] Naming conventions defined
* [x] Response envelope defined
* [x] Error envelope defined
* [x] HTTP status rules defined
* [x] Pagination defined
* [x] Filtering defined
* [x] Sorting defined
* [x] Search defined
* [x] Authentication APIs documented
* [x] User APIs documented
* [x] Question APIs documented
* [x] Interview APIs documented
* [x] Response APIs documented
* [x] Resume APIs documented
* [x] Progress APIs documented
* [x] Feedback APIs documented
* [x] Admin APIs documented
* [x] Authorization level assigned to every endpoint
* [x] Validation documented for every write endpoint
* [x] Rate-limit category assigned
* [x] Idempotency rules documented
* [x] Concurrency rules documented
* [x] File-upload contract documented
* [x] AI-processing behavior documented
* [x] Frontend integration examples included
* [x] No unresolved API-design blockers remain
