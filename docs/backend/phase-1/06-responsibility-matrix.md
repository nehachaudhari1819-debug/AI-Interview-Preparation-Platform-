# P1.6 — Express vs Supabase Responsibility Matrix

## 1. Purpose
This document defines the definitive responsibility boundaries for the AI Interview Preparation Platform. It explicitly establishes which layer owns each operation, decision, validation, security check, side effect, and failure-recovery responsibility, preventing duplicate logic and architectural drift.

## 2. Scope
The scope covers the React frontend, Express backend layers (middleware, controllers, services, repositories, transactions), Supabase components (Auth, PostgreSQL, RLS, Storage), AI integrations, background jobs, testing, and deployment operations.

## 3. Approved Architecture Context
The project uses a React.js frontend, an Express.js modular monolith backend serving REST APIs under `/api/v1`, Supabase Auth, PostgreSQL (with RLS), and Supabase private storage. Services coordinate domain logic, while AI providers act as external capabilities integrated via adapters.

## 4. Responsibility Principles
1. **Single authoritative owner:** Every important responsibility has one primary owner.
2. **Defense in depth is not duplicate ownership:** Multiple layers verify properties, but one remains authoritative (e.g. Express owns app authorization, RLS owns database enforcement).
3. **Frontend is never authoritative:** The frontend collects and displays data but must never decide identity, roles, logic, or access.
4. **Express owns business workflows:** Services orchestrate transactions, AI calls, and safe API errors.
5. **Supabase owns managed platform capabilities:** Authentication credentials, database persistence, and RLS enforcement.
6. **PostgreSQL owns data integrity:** Primary/foreign keys, uniqueness, check constraints, and atomicity.
7. **AI output is never authoritative without validation:** Express must normalize and validate all AI output.
8. **Service-role access is exceptional:** Allowed only for explicit trusted workflows with prior authorization and audit logging.

## 5. Layer Definitions
* **React frontend:** User interface, local state, safe display, API initiation. Not a security boundary.
* **Express application layer:** App entry point, global middleware, graceful shutdown.
* **Express middleware:** Request ID, CORS, rate limits, bearer token extraction, validation schemas, coarse authorization.
* **Express routes:** HTTP mapping, middleware sequencing.
* **Express controllers:** Translate validated HTTP to services, handle status codes.
* **Express services:** Business logic, workflow orchestration, AI coordination, state transitions.
* **Express repositories:** Supabase queries, persistence translation.
* **Express transaction coordinators:** Group atomic database operations without holding locks during external AI/storage calls.
* **Supabase Auth:** Credentials, hashing, identities, session tokens.
* **Supabase PostgreSQL:** Relational data system of record.
* **Supabase RLS:** Database-level row isolation and active-state enforcement.
* **Supabase Storage:** Private object persistence and signed URLs.
* **AI provider adapters:** Vendor SDK calls, retries, output extraction.
* **Background jobs:** Long-running, retryable work (aggregation, deletions).
* **Deployment infrastructure:** Hosting, env variables, metrics, process management.

## 6. Primary Responsibility Matrix
| Responsibility | Primary owner | Supporting layer | Source of truth | Security enforcement | Failure owner | Explicitly not responsible |
| -------------- | ------------- | ---------------- | --------------- | -------------------- | ------------- | -------------------------- |
| Registration | Auth Service | Supabase Auth | Supabase Auth | Express / Auth | Auth Service | Frontend |
| Login / Session | Supabase Auth | Express Auth | Supabase Auth | Express | Supabase Auth | Frontend |
| Question Management | Question Service | Admin UI | PostgreSQL | Express / RLS | Question Service | Frontend |
| Interview Lifecycle | Interview Svc | Repositories | PostgreSQL | Express / RLS | Interview Svc | Database Triggers |
| Answers & Evals | Response Svc | AI Adapters | PostgreSQL | Express / RLS | Response Svc | Frontend / AI |
| Resume Analysis | Resume Svc | Storage | Storage/DB | Express / Storage | Resume Svc | Frontend |
| Business Logic | Express Services| None | Express | Express Auth | Express | Frontend / DB |
| Data Integrity | PostgreSQL | Repositories | PostgreSQL | Constraints | PostgreSQL | Express Services |

## 7. Frontend Responsibility Matrix
**Frontend Owns:**
* Rendering pages and UI components
* Collecting user input & client-side form feedback
* Calling approved APIs with access tokens
* Maintaining access token in memory & refreshing via mutex
* Displaying loading states, upload progress, and safe backend errors
* Optimistic UI (only when safe)

## 8. Frontend Forbidden Responsibilities
**Frontend Must Never Own:**
* Authentication truth or User identity validation
* Role or account-status determination
* RLS decisions or Resource ownership
* Score calculation, Progress calculation, AI evaluation acceptance
* Database timestamps or authoritative storage paths
* Audit logging or idempotency completion
* Service-role access

## 9. Middleware Responsibility Matrix
* **Request ID:** Creates/validates IDs, prevents unsafe oversized IDs.
* **Security-headers:** Sets secure HTTP headers, removes disclosure headers.
* **CORS:** Manages trusted-origin allowlist, credentials config, rejects wildcards.
* **CSRF:** Origin validation, cookie endpoint protection.
* **Rate-limit:** Categories, abuse responses, retry metadata.
* **Authentication:** Bearer-token extraction, verification, profile lookup, active-account enforcement.
* **Validation:** Schema validation, rejecting unknown fields, consistent errors.
* **Authorization:** Coarse route-level role requirements.

## 10. Controller Responsibility Matrix
**Controllers Own:**
* Reading validated request values & `req.auth`
* Reading file metadata
* Calling one service method
* Setting HTTP status & standard envelopes

## 11. Controller Anti-pattern Summary
**Controllers Must Not:**
* Query Supabase directly or use service-role clients
* Calculate scores or complex business logic
* Implement transactions or AI orchestration
* Expose raw provider or database errors

## 12. Service Responsibility Matrix
**Services Own:**
* **Auth service:** Registration/login orchestration, logout, recovery, session contracts.
* **User service:** Safe profile updates, field allowlisting, deletion logic.
* **Question service:** Filters, admin writes, AI question validation.
* **Interview service:** State transitions, idempotency, ownership checks.
* **Response service:** Submission logic, duplicate prevention, evaluation reservation.
* **Evaluation service:** AI requests, score normalization, retries, versioning.
* **Resume service:** Validation, storage sync, parsing, analysis, cleanup.
* **Progress service:** Aggregations and read filters.
* **Feedback service:** Generation, versioning, regeneration limits.
* **Admin service:** Authorization, audit events, monitoring boundaries.

## 13. Service Anti-pattern Summary
**Services Must Not:**
* Return raw HTTP response objects
* Embed vendor-specific AI logic (use adapters)
* Trust repo results blindly
* Hold open DB transactions during external AI/storage calls
* Use generic admin database helpers

## 14. Repository Responsibility Matrix
**Repositories Own:**
* Parameterized Supabase queries
* Record mapping & persistence-specific error translation
* Enforcing user-scoped vs system-scoped client boundaries
* Transactions and RPC calls

## 15. Repository Anti-pattern Summary
**Repositories Must Not:**
* Decide business state validity
* Use generic dynamic table names
* Return raw provider errors
* Bypass RLS without explicit design
* Trust frontend user IDs for queries

## 16. Transaction Responsibility Matrix
| Workflow | Transaction owner | Database operations | External calls | Compensation owner | Idempotency owner |
| -------- | ----------------- | ------------------- | -------------- | ------------------ | ----------------- |
| Registration | Auth Service | Create user & profile | None | Auth Service | Supabase Auth |
| Start Interview | Interview Svc | Update state, snapshot | None | Interview Svc | Interview Svc |
| Submit Response | Response Svc | Insert response, reserve eval | None | Response Svc | Response Svc |
| Complete Interview| Interview Svc | Score persist, state change | None | Interview Svc | Interview Svc |
| Resume Upload | Resume Svc | Insert row | Storage Upload | Resume Svc | Resume Svc |
| Account Deletion | User/Admin Svc | Delete/Anonymize rows | Auth/Storage | Background Job | Background Job |

## 17. Supabase Auth Responsibility Matrix
**Owns:** Password hashing, credential validation, identity issuance, email verification, tokens, session rotation.
**Does Not Own:** App account status, role business authorization, interview permissions, response formatting.

## 18. PostgreSQL Responsibility Matrix
**Owns:** Primary/foreign keys, uniqueness, constraints, atomicity, row locks, types, idempotency uniqueness.
**Does Not Own:** User-facing errors, AI prompts, HTTP logic, storage compensation.

## 19. RLS Responsibility Matrix
**Owns:** Owner row filtering, cross-user isolation, active-account enforcement, admin boundaries, default-deny.
**Does Not Own:** State-machine validity, score calculations, AI validation, service-role authorization.

## 20. Supabase Storage Responsibility Matrix
**Storage Owns:** Object persistence, storage RLS, authenticated downloads, signed URL support.
**Express Owns:** MIME/size validation, path generation, database sync, cleanup orchestration.
**Frontend Owns:** Selecting file, progress UI (never authoritative paths).

## 21. AI Provider Responsibility Matrix
**Owns:** Model inference, provider request execution, native response generation.
**Does Not Own:** Database ownership, authorization, interview completion decisions, safe data exposure.

## 22. AI Adapter Responsibility Matrix
**Owns:** Vendor SDK usage, timeouts, retries, provider error normalization, structured extraction.

## 23. Background-job Responsibility Matrix
| Workflow | V1 mode | Future mode | Job owner | Retry policy owner | Status source of truth |
| -------- | ------- | ----------- | --------- | ------------------ | ---------------------- |
| Resume Parsing | Sync | Async | Background | Job system | Database (status) |
| Account Deletion| Async | Async | Background | Job system | Database |
| Aggregation | Sync/Async | Async | Background | Job system | Database |

**Background Jobs Own:** Retryable execution, dead-letter handling, idempotent processing, safe failures.
**Background Jobs Do Not Own:** User authentication, route authorization, frontend UI.

## 24. Service-Role Responsibility Matrix
| Workflow | Service role allowed | Reason | Required authorization before use | Audit required | User-scoped alternative |
| -------- | -------------------: | ------ | --------------------------------- | -------------: | ----------------------- |
| Auth deletion | Yes | Needs admin rights | Admin route + internal check | Yes | None |
| Profile repair | Yes | Fixes sync issues | Internal trusted call | Yes | None |
| Storage cleanup| Yes | Orphan file removal | Scheduled trusted job | Yes | None |
| Background AI | Yes | No active user session| Job payload validation | No | Pass token (brittle)|

## 25. Service-role Forbidden-Use Summary
* Ordinary user profile/interview reads
* Exposing service key to frontend
* Generic CRUD endpoints
* User-controlled table/filter inputs
* Silent RLS bypasses

## 26. Security Responsibility Matrix
| Security control | Primary owner | Secondary enforcement | Verification |
| ---------------- | ------------- | --------------------- | ------------ |
| Authentication | Supabase Auth | Express middleware | Token validation |
| Route AuthZ | Express mw | Express services | RLS active user |
| Row AuthZ | Supabase RLS | Express services | DB Policies |
| Input Validation | Express mw | Express services | Schema matching |
| Audit Logging | Express Svcs | PostgreSQL | Retention jobs |

## 27. Feature-by-Feature Responsibility Matrix
* **Registration:** Form (Frontend) -> Validation (Express) -> Auth User (Supabase) -> Profile (Express).
* **Login/Session:** Form (Frontend) -> Token Response (Supabase) -> Account Check (Express) -> Session (Express/Frontend).
* **Profile:** Fields (Frontend) -> Validation/Filter (Express) -> RLS Persistence (Supabase).
* **Question-bank:** Filters (Express) -> Admin Writes (Express) -> Access Enforcement (RLS).
* **Interview:** Generation (Express AI) -> State (Express) -> Isolation (RLS).
* **Response/Evaluation:** Submission (Express) -> Dedup (PostgreSQL) -> AI Eval (Express/Adapter) -> Storage (PostgreSQL).
* **Resume-analysis:** Upload (Frontend) -> Path/Validation (Express) -> Sync (Express/Storage) -> Parse (Express/AI).
* **Progress:** Aggregation (Express) -> Read Auth (RLS).
* **Feedback:** Gen/Validation (Express) -> Versioning (PostgreSQL) -> Auth (RLS).
* **Admin-operation:** Route Auth (Express) -> Audit (Express) -> RLS Bypass/Access (Supabase).
* **Account-deletion:** Trigger (Express) -> Cleanup Auth/Storage (Background) -> DB Anonymize (Express).

## 28. Failure and Compensation Matrix
| Failure | Detection owner | Recovery owner | Compensation action | User-facing result | Audit/log requirement |
| ------- | --------------- | -------------- | ------------------- | ------------------ | --------------------- |
| Upload fails post-DB | Express | Express/Job | Delete DB row | 500 Upload Error | Log trace |
| AI Eval fails | Adapter | Express Svc | Mark response 'failed' | 500 AI Error | Log failure/retry |
| Auth sync fails | Express | Job | Create missing profile | 500 Try Again | Log mismatch |

## 29. Testing Responsibility Matrix
* **Unit tests:** Module devs (Services, validators, mappers).
* **Repository tests:** Query construction, RLS clients, constraints.
* **Integration tests:** Express + Supabase, Auth flows, Transactions.
* **API tests:** Contracts, Rate limits, Error envelopes.
* **Security tests:** Cross-user isolation, Role escalation, CSRF.
* **E2E tests:** Full workflows (Registration -> Completion).
* **CI/CD:** Runs PR verifications, main branch tests, deployment checks.

## 30. Deployment and Operations Matrix
| Responsibility | Application | Supabase | Hosting platform | CI/CD | Human operator |
| -------------- | ----------- | -------- | ---------------- | ----- | -------------- |
| Env variables | Read | None | Provide | Inject | Provision |
| Migrations | Run via CI | Host | None | Orchestrate | Approve |
| Metrics/Logs | Emit | Emit | Aggregate | None | Monitor |

## 31. Environment-Variable Ownership
* **Frontend:** `FRONTEND_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (Exposed).
* **Backend:** `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY` (Server-only, validated at startup, never logged).

## 32. Error-Ownership Summary
| Error source | Raw error owner | Mapping owner | Public response owner | Logging owner |
| ------------ | --------------- | ------------- | --------------------- | ------------- |
| Supabase | Repository | Repository/Svc| Middleware | Service/Mw |
| AI Provider | Adapter | Adapter | Middleware | Adapter/Svc |
| Validation | Middleware | Middleware | Middleware | Middleware |

## 33. Source-of-Truth Matrix
| Data or decision | Source of truth |
| ---------------- | --------------- |
| User identity | Supabase Auth (`auth.users`) |
| Account status | `public.users.account_status` |
| Interview state | `public.interviews.status` |
| Idempotency | `public.idempotency_records` |

## 34. Anti-Patterns
**Frontend:** Calculating scores, sending owner IDs, storing refresh tokens in local storage, calling service role.
**Controllers:** DB queries, transactions, service-role use, returning raw errors.
**Services:** Returning HTTP objects, trusting repos blindly, open DB transactions during external calls.
**Repositories:** Business logic, bypassing RLS dynamically.
**Database:** RLS as state machine, missing uniqueness.
**Service-role:** Ordinary reads, frontend exposure.

## 35. Decision Records (ADRs)
* **ADR-RESP-001 — Express services own business rules:** Prevents logic spread.
* **ADR-RESP-002 — PostgreSQL owns relational integrity:** Ensures data safety.
* **ADR-RESP-003 — RLS owns row-level enforcement:** Defense in depth.
* **ADR-RESP-004 — Supabase Auth owns credentials and sessions:** Leverages managed security.
* **ADR-RESP-005 — Frontend is never authoritative:** Secures system boundary.
* **ADR-RESP-006 — Controllers remain thin:** Isolates HTTP from business logic.
* **ADR-RESP-007 — Repositories own persistence only:** Isolates DB vendor logic.
* **ADR-RESP-008 — External calls stay outside long database transactions:** Prevents connection starvation.
* **ADR-RESP-009 — Service-role use requires explicit workflow ownership:** Prevents privilege escalation.
* **ADR-RESP-010 — AI output requires Express validation:** Secures against AI hallucination.
* **ADR-RESP-011 — Storage and database consistency is coordinated by Express:** Handles split-brain state.
* **ADR-RESP-012 — Background jobs own retryable long-running execution:** Enhances API reliability.

## 36. Acceptance Checklist
* [x] Responsibility principles defined
* [x] Single authoritative owner rule defined
* [x] Defense-in-depth rule defined
* [x] Frontend responsibilities defined
* [x] Frontend forbidden responsibilities defined
* [x] Express application responsibilities defined
* [x] Middleware responsibilities defined
* [x] Route responsibilities defined
* [x] Controller responsibilities defined
* [x] Controller anti-patterns defined
* [x] Service responsibilities defined
* [x] Service anti-patterns defined
* [x] Repository responsibilities defined
* [x] Repository anti-patterns defined
* [x] Transaction coordinator responsibilities defined
* [x] Supabase Auth responsibilities defined
* [x] Supabase Auth non-responsibilities defined
* [x] PostgreSQL responsibilities defined
* [x] PostgreSQL non-responsibilities defined
* [x] RLS responsibilities defined
* [x] RLS non-responsibilities defined
* [x] Storage responsibilities defined
* [x] Express storage responsibilities defined
* [x] AI adapter responsibilities defined
* [x] AI service responsibilities defined
* [x] AI provider non-responsibilities defined
* [x] Background-job responsibilities defined
* [x] Service-role approved workflows defined
* [x] Service-role forbidden workflows defined
* [x] Primary responsibility matrix included
* [x] Security responsibility matrix included
* [x] Feature-by-feature matrix included
* [x] Transaction matrix included
* [x] Failure and compensation matrix included
* [x] Testing responsibility matrix included
* [x] Deployment responsibility matrix included
* [x] Environment-variable ownership documented
* [x] Error ownership documented
* [x] Source-of-truth matrix documented
* [x] Registration responsibility flow documented
* [x] Login/session responsibility flow documented
* [x] Profile responsibility flow documented
* [x] Question-bank responsibility flow documented
* [x] Interview responsibility flow documented
* [x] Response/evaluation responsibility flow documented
* [x] Resume-analysis responsibility flow documented
* [x] Progress responsibility flow documented
* [x] Feedback responsibility flow documented
* [x] Admin responsibility flow documented
* [x] Account-deletion responsibility flow documented
* [x] Storage/database compensation documented
* [x] AI/database compensation documented
* [x] Audit ownership documented
* [x] Idempotency ownership documented
* [x] Observability ownership documented
* [x] CI/CD ownership documented
* [x] Anti-patterns documented
* [x] ADRs included
* [x] No unresolved responsibility-boundary blockers remain
