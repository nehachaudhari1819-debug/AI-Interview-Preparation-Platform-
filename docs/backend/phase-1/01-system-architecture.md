# AI Interview Preparation Platform

## P1.1 — Backend System Architecture

**Project:** AI Interview Preparation Platform
**Subsystem:** Backend
**Architecture version:** 1.0
**Status:** Proposed for Phase 1 approval
**Backend:** Node.js and Express.js
**Database and authentication:** Supabase
**API style:** REST
**Frontend:** React.js application developed separately

---

## 1. Purpose

This document defines the backend architecture for the AI Interview Preparation Platform.

The platform helps engineering students and placement aspirants prepare for interviews through:

* Technical and aptitude question practice
* AI-powered mock interviews
* AI answer evaluation
* Resume analysis
* Interview history
* Skill-performance tracking
* Personalized feedback and learning recommendations

This architecture establishes the boundaries, responsibilities, security model and communication flow of the backend before implementation begins.

---

## 2. Architecture Goals

The backend must be:

1. Secure for student-owned information.
2. Modular and maintainable.
3. Easy for the frontend developer to integrate.
4. Capable of supporting Gemini or OpenAI.
5. Protected against unauthorized data access.
6. Suitable for production deployment.
7. Testable at module, API, authentication and database-policy levels.
8. Extensible without requiring an immediate microservice architecture.

---

## 3. Selected Architecture

The project will use a modular monolith REST API.

```text
React Frontend
       │
       │ HTTPS REST API
       ▼
Node.js and Express.js Backend
       │
       ├── Application middleware
       ├── Authentication middleware
       ├── Authorization middleware
       ├── Feature modules
       ├── Business services
       ├── Repository layer
       ├── AI provider abstraction
       └── Storage integration
                │
                ▼
          Supabase Platform
                │
                ├── Supabase Auth
                ├── PostgreSQL
                ├── Row Level Security
                └── Private Storage
```

The application will run as one deployable backend service while keeping each business capability in a separate feature module.

---

## 4. Why a Modular Monolith

A modular monolith is selected instead of microservices because the first version does not require independent service deployment or distributed data management.

Benefits include:

* One backend deployment
* One source repository
* Simpler local development
* Easier transaction handling
* Easier end-to-end testing
* Fewer network failure points
* Clear module boundaries
* Ability to extract services later when justified

The architecture must still prevent direct coupling between unrelated modules.

For example, the resume-analysis controller must not directly modify progress records. It must call the appropriate service through an explicit application interface.

---

## 5. Major Components

### 5.1 React Frontend

The frontend is responsible for:

* Rendering the user interface
* Collecting form input
* Displaying interviews and feedback
* Maintaining permitted client-side session state
* Sending API requests
* Handling loading and error states
* Uploading resumes through multipart requests

The frontend must not:

* Hold the Supabase secret/service-role key
* Make trusted administrative requests
* Calculate authoritative interview scores
* Decide whether a user owns a database record
* expose AI provider secrets
* Bypass the Express API for protected application writes

### 5.2 Express API

Express is the application entry point.

It is responsible for:

* API routing
* Request parsing
* Security headers
* CORS enforcement
* Request identification
* Rate limiting
* Authentication
* Input validation
* Authorization
* Calling business services
* Formatting API responses
* Centralized error handling

The public API will be versioned under:

```text
/api/v1
```

System endpoints will include:

```text
GET /api/v1/health
GET /api/v1/health/ready
```

### 5.3 Controllers

Controllers translate HTTP requests into service calls.

A controller may:

* Read validated route parameters
* Read validated request bodies
* Access the authenticated user context
* Call one or more application services
* Select the correct HTTP response status

A controller must not:

* Contain SQL
* Build complex AI prompts
* Directly access environment variables
* Implement major business rules
* Return raw provider errors
* Use the service-role key

### 5.4 Services

Services contain application and business rules.

Services are responsible for:

* Starting and completing interviews
* Selecting or generating questions
* Verifying valid interview transitions
* Evaluating answers
* Calculating scores
* Coordinating resume analysis
* Updating progress
* Generating feedback
* Enforcing ownership at the application layer

Services may coordinate repositories and external integrations.

### 5.5 Repository Layer

Repositories isolate database operations from business logic.

Repositories are responsible for:

* Selecting records
* Creating records
* Updating records
* Deleting records
* Executing database functions
* Mapping database failures to internal errors

Repositories will use a user-scoped Supabase client for ordinary authenticated operations.

Trusted administrative repositories may use the admin client only when the use case has been explicitly approved.

### 5.6 Supabase Auth

Supabase Auth will manage:

* User registration identity
* Password handling
* Email verification
* Login
* Access tokens
* Refresh tokens
* Password recovery
* Session termination

Application-specific profile information will be stored in `public.users`, while authentication credentials remain in Supabase’s protected Auth schema.

Supabase sessions contain an access token represented as a JWT and a refresh token. Access tokens are intended to be short-lived, while refresh tokens are exchanged to obtain a new token pair.

### 5.7 PostgreSQL

PostgreSQL will be the authoritative system of record for:

* User profiles
* Questions
* Interviews
* Interview questions
* Responses
* Evaluations
* Resume analyses
* Progress records
* Feedback
* Audit information where required

Primary keys will use UUIDs.

Database relationships and constraints will enforce data integrity in addition to Express validation.

### 5.8 Row Level Security

RLS will be enabled for every table exposed through Supabase’s public Data API.

User-owned records will be protected using the authenticated user ID.

Example ownership condition:

```sql
(select auth.uid()) = user_id
```

Supabase recommends enabling RLS for exposed tables, and RLS policies act as automatic access conditions on database queries.

Express authorization and RLS will operate together:

```text
Express ownership check
          +
PostgreSQL RLS policy
          =
Defense in depth
```

### 5.9 AI Integration Layer

AI operations will use an internal provider interface.

```text
Interview Service
        │
        ▼
AI Provider Interface
        │
        ├── Gemini Adapter
        └── OpenAI Adapter
```

The provider interface will expose operations such as:

```text
generateInterviewQuestions()
evaluateInterviewAnswer()
analyzeResume()
generatePersonalizedFeedback()
```

Controllers and business services must not depend on provider-specific response formats.

The selected provider will be controlled through configuration:

```env
AI_PROVIDER=gemini
```

AI output must be validated before it becomes trusted application data.

### 5.10 Resume Processing Layer

Resume processing will contain:

* Upload validation
* File-signature validation
* MIME-type validation
* File-size validation
* Filename sanitization
* Private storage upload
* Text extraction
* AI analysis
* Structured result validation
* Temporary-file cleanup

Accepted initial formats:

* PDF
* DOCX

Executables, scripts, archives and unsupported document formats must be rejected.

Resume files will use private storage. Access will be provided through authenticated requests or short-lived signed URLs where required.

### 5.11 Progress and Analytics Layer

Progress information will be produced from validated interview results.

It may include:

* Total interviews
* Average score
* Category performance
* Difficulty performance
* Skill-level performance
* Score changes over time
* Strong and weak topic areas

The frontend must not submit authoritative progress values. Progress is calculated by the backend from stored responses and evaluations.

---

## 6. Proposed Module Structure

```text
src/
├── app.js
├── server.js
│
├── config/
│   ├── env.js
│   ├── cors.js
│   ├── logger.js
│   └── constants.js
│
├── common/
│   ├── errors/
│   ├── responses/
│   ├── validators/
│   └── utils/
│
├── middleware/
│   ├── authenticate.js
│   ├── authorize.js
│   ├── validate.js
│   ├── rateLimiter.js
│   ├── requestId.js
│   ├── upload.js
│   ├── notFound.js
│   └── errorHandler.js
│
├── integrations/
│   ├── supabase/
│   │   ├── publicClient.js
│   │   ├── userClient.js
│   │   └── adminClient.js
│   │
│   ├── ai/
│   │   ├── aiProvider.js
│   │   ├── geminiProvider.js
│   │   └── openaiProvider.js
│   │
│   └── storage/
│       └── resumeStorage.js
│
└── modules/
    ├── auth/
    ├── users/
    ├── questions/
    ├── interviews/
    ├── responses/
    ├── resume-analysis/
    ├── progress/
    ├── feedback/
    └── health/
```

Each business module will follow this pattern where applicable:

```text
interviews/
├── interview.routes.js
├── interview.controller.js
├── interview.service.js
├── interview.repository.js
├── interview.validation.js
├── interview.constants.js
└── interview.mapper.js
```

---

## 7. Request Lifecycle

Every request will pass through an ordered pipeline.

```text
Incoming request
       ↓
Reverse proxy/platform protection
       ↓
Request ID
       ↓
Security headers
       ↓
CORS validation
       ↓
Body and file-size limits
       ↓
Rate limiting
       ↓
Authentication
       ↓
Schema validation
       ↓
Authorization
       ↓
Controller
       ↓
Service
       ↓
Repository or external integration
       ↓
Response formatter
       ↓
Central error handler
```

Public routes may skip authentication but must still use request limits, validation and rate limiting.

Examples of public routes:

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/forgot-password
GET  /api/v1/health
```

---

## 8. Authentication Flow

### 8.1 Registration

```text
Frontend
   ↓
POST /api/v1/auth/register
   ↓
Express validation and rate limiting
   ↓
Supabase Auth sign-up
   ↓
Verification email
   ↓
Database profile synchronization
   ↓
Standard API response
```

Passwords will not be stored, logged or hashed by the Express application.

### 8.2 Login

```text
Frontend
   ↓
POST /api/v1/auth/login
   ↓
Express validation and rate limiting
   ↓
Supabase Auth sign-in
   ↓
Access and refresh session issued
   ↓
Secure session response
```

The final cookie and token-storage strategy will be specified in the Phase 1 authentication-flow document.

### 8.3 Protected API Request

```text
Authorization: Bearer <access-token>
```

The backend will:

1. Extract the bearer token.
2. Verify the authenticated Supabase user.
3. Reject invalid or expired tokens.
4. Attach a minimal user context to the request.
5. Create a user-scoped database client.
6. Continue to validation and authorization.

Example internal request context:

```json
{
  "user": {
    "id": "authenticated-user-uuid",
    "email": "student@example.com"
  }
}
```

---

## 9. Interview Flow

### 9.1 Start Interview

```text
Authenticated student
        ↓
Creates interview configuration
        ↓
Backend validates type, topic and difficulty
        ↓
Interview record is created
        ↓
Curated or AI questions are generated
        ↓
Questions are validated and stored
        ↓
Interview session is returned
```

### 9.2 Submit Response

```text
Student submits answer
        ↓
Interview ownership is verified
        ↓
Interview state is verified
        ↓
Answer is validated
        ↓
AI evaluation is requested
        ↓
Structured AI output is validated
        ↓
Response and evaluation are stored
        ↓
Progress is recalculated
        ↓
Result is returned
```

### 9.3 Complete Interview

```text
Completion request
        ↓
Ownership and interview state check
        ↓
Required questions check
        ↓
Final score calculation
        ↓
Feedback generation
        ↓
Interview marked completed
        ↓
Progress updated
```

---

## 10. AI Processing Rules

AI output must be treated as untrusted input.

The backend must:

* Request structured JSON where supported
* Validate every required field
* Enforce numeric score ranges
* Limit feedback lengths
* Reject malformed output
* Avoid exposing system prompts
* Avoid sending secrets to providers
* Use provider timeouts
* Handle provider rate limits
* Record provider request identifiers when available
* Avoid returning raw AI provider errors to users

Initial AI operations may run synchronously.

The AI service boundary must permit later migration to a background queue without changing public API contracts.

---

## 11. Trust Boundaries

### Boundary 1: Browser to Express

Everything submitted by the browser is untrusted.

Controls:

* HTTPS
* CORS allowlist
* Authentication
* Input validation
* Request-size limits
* File validation
* Rate limiting
* Output filtering

### Boundary 2: Express to Supabase

The backend must distinguish between:

* User-scoped database access
* Trusted administrative access

Normal user operations must not use the service-role key.

### Boundary 3: Express to AI Provider

AI responses are not trusted until validated.

Prompts must exclude unnecessary personal information.

### Boundary 4: Express to File Storage

Resume objects must remain private.

Stored object paths must not depend directly on unsanitized filenames.

---

## 12. Security Architecture

The backend will defend against:

* Broken authentication
* Broken object-level authorization
* Broken function-level authorization
* Mass assignment
* Unrestricted resource consumption
* Malicious file uploads
* Excessive information exposure
* Secret leakage
* Injection attempts
* Abuse of AI endpoints

OWASP identifies broken authentication, object-property authorization failures, function-level authorization failures and unrestricted resource consumption among major API risks.

Required controls include:

* Route-specific authentication
* Resource ownership checks
* Role checks for administrative endpoints
* Explicit writable-field allowlists
* RLS on user-owned database tables
* Rate limits for authentication and AI routes
* Maximum request-body sizes
* AI token and response limits
* Secure environment variables
* Redacted logs
* Generic production errors
* Private resume storage
* Separate user and admin Supabase clients

---

## 13. Error Architecture

The backend will use a centralized application-error model.

Error categories:

```text
VALIDATION_ERROR
AUTHENTICATION_REQUIRED
INVALID_TOKEN
FORBIDDEN
RESOURCE_NOT_FOUND
CONFLICT
RATE_LIMIT_EXCEEDED
FILE_VALIDATION_FAILED
AI_PROVIDER_ERROR
DATABASE_ERROR
INTERNAL_SERVER_ERROR
```

Standard error response:

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
  "requestId": "request-uuid"
}
```

Internal stack traces, database details, environment values and provider secrets must never be returned in production responses.

---

## 14. Logging and Observability

Each request will receive a request ID.

Production logs should contain:

* Timestamp
* Log level
* Request ID
* HTTP method
* Route template
* Status code
* Request duration
* Authenticated user ID when appropriate
* AI provider operation name
* External request identifier when available
* Sanitized error information

Production logs must not contain:

* Passwords
* Access tokens
* Refresh tokens
* Supabase secret keys
* AI API keys
* Complete resumes
* Complete interview answers by default
* Sensitive authentication headers

---

## 15. Initial Operational Limits

The initial limits are architecture targets and may be refined during implementation.

* JSON request body: maximum 1 MB
* Resume upload: maximum 5 MB
* Accepted resumes: PDF and DOCX
* API pagination: maximum 100 records per page
* Authentication endpoints: strict rate limits
* AI endpoints: user-based and IP-based rate limits
* AI calls: explicit timeout and retry policy
* Database queries: pagination required for collection endpoints

Rate limiting and resource limits are necessary because unrestricted API resource consumption can create availability and cost risks, especially for expensive AI operations.

---

## 16. Deployment Architecture

Initial deployment:

```text
React Frontend Hosting
        │
        │ HTTPS
        ▼
Node.js/Express Hosting
        │
        ├── Supabase Auth
        ├── Supabase PostgreSQL
        ├── Supabase Storage
        └── Gemini/OpenAI
```

Production requirements:

* HTTPS only
* Separate development and production environment values
* Restricted CORS origins
* No secret values in source control
* Production logging configuration
* Health and readiness endpoints
* Graceful server shutdown
* Database migration process
* Deployment rollback plan
* Supabase RLS verification after deployment

---

## 17. Architecture Decision Records

### ADR-001: Modular Monolith

**Decision:** Use one modular Express application.

**Reason:** The initial platform does not justify distributed services.

**Rejected alternative:** Microservices.

**Reason for rejection:** Additional deployment, communication, observability and data-consistency complexity without a current requirement.

### ADR-002: REST API

**Decision:** Use versioned REST endpoints under `/api/v1`.

**Rejected alternative:** GraphQL as the primary application API.

**Reason for rejection:** REST provides a simpler contract for the current frontend and feature scope.

### ADR-003: Supabase Auth

**Decision:** Use Supabase Auth instead of building password authentication manually.

**Reason:** Authentication credentials, email verification, recovery and session issuance remain managed by the authentication platform.

### ADR-004: Express as Business-Law Boundary

**Decision:** Keep application rules in Express services.

**Reason:** This provides one testable application layer for interview, AI, scoring, resume and progress workflows.

### ADR-005: RLS Defense in Depth

**Decision:** Retain RLS even though all Version 1 application access goes through Express.

**Reason:** Database policies provide an additional user-ownership boundary.

### ADR-006: AI Provider Abstraction

**Decision:** Hide Gemini and OpenAI behind a common provider interface.

**Reason:** Business logic must not depend directly on one AI vendor.

### ADR-007: Private Resume Storage

**Decision:** Store resumes in a private bucket.

**Reason:** Resumes may contain personal and contact information and must not be publicly accessible.

### ADR-008: Separate Supabase Clients

**Decision:** Maintain separate public/user-scoped and administrative clients.

**Reason:** Ordinary operations must not unintentionally bypass RLS.

---

## 18. Deferred Decisions

The following decisions belong to later Phase 1 tasks:

* Final API endpoint list
* Complete table schema
* Complete SQL constraints
* Detailed RLS policies
* Access-token storage strategy
* Refresh-token cookie configuration
* Password-reset redirect design
* Administrative role model
* Final AI prompt schemas
* Final deployment provider
* Final resume parser library

These are not blockers for approving the high-level architecture.

---

## 19. P1.1 Acceptance Checklist

* [ ] Modular monolith architecture selected
* [ ] REST API boundary defined
* [ ] `/api/v1` versioning selected
* [ ] Frontend responsibility defined
* [ ] Express responsibility defined
* [ ] Controller responsibility defined
* [ ] Service responsibility defined
* [ ] Repository responsibility defined
* [ ] Supabase Auth responsibility defined
* [ ] PostgreSQL responsibility defined
* [ ] RLS defense-in-depth model defined
* [ ] User-scoped Supabase client defined
* [ ] Admin Supabase client restrictions defined
* [ ] AI provider abstraction defined
* [ ] Resume-processing boundary defined
* [ ] Request lifecycle documented
* [ ] Authentication flow documented at a high level
* [ ] Interview flow documented
* [ ] Trust boundaries documented
* [ ] Security controls documented
* [ ] Error architecture documented
* [ ] Logging rules documented
* [ ] Deployment architecture documented
* [ ] Architecture decisions recorded
* [ ] Deferred decisions identified

---

## 20. Approval Statement

P1.1 can be approved when the architecture is reviewed, no unresolved architectural blocker remains, and this document is committed to the `backend` branch.

Approval of P1.1 authorizes work on P1.2, the complete backend API blueprint.
