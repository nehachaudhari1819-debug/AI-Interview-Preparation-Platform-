# Phase 2.6: Authentication Domain Foundation

## Overview

This phase establishes a secure, typed, testable authentication foundation using Supabase JWTs. It verifies Bearer tokens defensively without compromising isolation or exposing the system to implicit escalation.

## Design Philosophy

1. **Zero Implicit Trust**: Every claim in the Supabase JWT is strictly validated. The audience, issuer, role, expiration, and timestamps are checked before generating a verified principal.
2. **Defensive Claim Trust**: User metadata can be manipulated by malicious users. The system ignores application role escalation attempts in `user_metadata`, relying strictly on the backend-assigned `user_role` claim.
3. **Privilege Isolation**: Token verification uses ONLY the `createPublicSupabaseClient`. The `service_role` key is never instantiated for auth verification.
4. **Header Ambiguity**: Rejects duplicate `Authorization` headers and comma-separated tokens to prevent header smuggling.

## Implementation Details

- **Middleware**: Route-level only. No production routes have authentication applied globally.
- **Context Expansions**: The Express context now contains `authentication: { state: "anonymous" | "authenticated", principal?: AuthenticatedPrincipal }`.
- **Token Parser**: `extractBearerToken` safely extracts Bearer tokens, rejecting control characters and oversized payloads.
- **Constants**: `auth.constants.ts` defines all trusted domains, roles, and boundaries.
- **Helpers**: `requireAuthenticatedPrincipal` assists controllers in acquiring the deeply frozen principal or throwing early.

## Error Handling

The central `errorHandlerMiddleware` catches any `AuthenticationError` and injects `WWW-Authenticate: Bearer` to natively instruct consumers.

## Security Validations

Comprehensive security tests ensure token redaction, header boundary enforcement, public route safety, privilege isolation, and malicious claim drops.
