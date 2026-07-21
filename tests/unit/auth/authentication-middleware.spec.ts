import { jest } from "@jest/globals";
import type { Request, Response, NextFunction } from "express";
import { createAuthenticationMiddleware } from "../../../src/auth/create-authentication-middleware.js";
import { createTestApplicationConfig } from "../../setup/test-helpers.js";
import { AuthenticationRequiredError } from "../../../src/errors/authentication-required.error.js";
import { InvalidAuthorizationHeaderError } from "../../../src/errors/invalid-authorization-header.error.js";
import { InvalidAccessTokenError } from "../../../src/errors/invalid-access-token.error.js";
import { AccessTokenExpiredError } from "../../../src/errors/access-token-expired.error.js";
import { InvalidAuthenticationClaimsError } from "../../../src/errors/invalid-authentication-claims.error.js";
import { AuthenticationServiceUnavailableError } from "../../../src/errors/authentication-service-unavailable.error.js";
import type { AccessTokenVerifier } from "../../../src/auth/supabase-access-token-verifier.js";
import type { RequestContext } from "../../../src/types/request-context.types.js";

describe("Authentication Middleware", () => {
  const config = createTestApplicationConfig();
  (config as any).supabase = { configured: true, url: "https://example.com" };
  const now = () => 1700000000000;
  const currentTimeSecs = 1700000000;

  const validClaims = {
    iss: "https://example.com/auth/v1",
    aud: "authenticated",
    exp: currentTimeSecs + 3600,
    iat: currentTimeSecs - 3600,
    sub: "d290f1ee-6c54-4b01-90e6-d701748f0851",
    role: "authenticated",
    aal: "aal1",
    session_id: "e440f1ee-6c54-4b01-90e6-d701748f0852",
    is_anonymous: false,
  };

  const createMockRequest = (authHeader?: string | string[]) => {
    const rawHeaders: string[] = [];
    if (authHeader) {
      if (Array.isArray(authHeader)) {
        authHeader.forEach((h) => {
          rawHeaders.push("Authorization", h);
        });
      } else {
        rawHeaders.push("Authorization", authHeader);
      }
    }

    return {
      rawHeaders,
      context: {
        authentication: { state: "anonymous" },
      } as RequestContext,
    } as unknown as Request;
  };

  const createMockResponse = () => ({}) as Response;
  const createMockNext = () => jest.fn() as NextFunction;

  const createMockVerifier = (result: any): AccessTokenVerifier => ({
    verify: jest.fn<any>().mockResolvedValue(result),
  });

  const getMiddleware = (verifier: AccessTokenVerifier) =>
    createAuthenticationMiddleware({ config, verifier, now });

  it("missing header produces AuthenticationRequiredError", async () => {
    const req = createMockRequest();
    const next = createMockNext();
    const verifier = createMockVerifier({ success: true, claims: validClaims });

    await getMiddleware(verifier)(req, createMockResponse(), next);
    expect(next).toHaveBeenCalledWith(expect.any(AuthenticationRequiredError));
  });

  it("malformed header produces InvalidAuthorizationHeaderError", async () => {
    const req = createMockRequest("Basic foo");
    const next = createMockNext();
    const verifier = createMockVerifier({ success: true, claims: validClaims });

    await getMiddleware(verifier)(req, createMockResponse(), next);
    expect(next).toHaveBeenCalledWith(expect.any(InvalidAuthorizationHeaderError));
  });

  it("duplicate header produces InvalidAuthorizationHeaderError", async () => {
    const req = createMockRequest(["Bearer foo", "Bearer bar"]);
    const next = createMockNext();
    const verifier = createMockVerifier({ success: true, claims: validClaims });

    await getMiddleware(verifier)(req, createMockResponse(), next);
    expect(next).toHaveBeenCalledWith(expect.any(InvalidAuthorizationHeaderError));
  });

  it("invalid token produces InvalidAccessTokenError", async () => {
    const req = createMockRequest("Bearer token");
    const next = createMockNext();
    const verifier = createMockVerifier({ success: false, reason: "invalid" });

    await getMiddleware(verifier)(req, createMockResponse(), next);
    expect(next).toHaveBeenCalledWith(expect.any(InvalidAccessTokenError));
  });

  it("expired token produces AccessTokenExpiredError", async () => {
    const req = createMockRequest("Bearer token");
    const next = createMockNext();
    const verifier = createMockVerifier({ success: false, reason: "expired" });

    await getMiddleware(verifier)(req, createMockResponse(), next);
    expect(next).toHaveBeenCalledWith(expect.any(AccessTokenExpiredError));
  });

  it("service failure produces AuthenticationServiceUnavailableError", async () => {
    const req = createMockRequest("Bearer token");
    const next = createMockNext();
    const verifier = createMockVerifier({ success: false, reason: "service_unavailable" });

    await getMiddleware(verifier)(req, createMockResponse(), next);
    expect(next).toHaveBeenCalledWith(expect.any(AuthenticationServiceUnavailableError));
  });

  it("invalid verified claims produce InvalidAuthenticationClaimsError", async () => {
    const req = createMockRequest("Bearer token");
    const next = createMockNext();
    const verifier = createMockVerifier({
      success: true,
      claims: { ...validClaims, aud: "wrong" },
    });

    await getMiddleware(verifier)(req, createMockResponse(), next);
    expect(next).toHaveBeenCalledWith(expect.any(InvalidAuthenticationClaimsError));
  });

  it("valid token sets authenticated state and calls next", async () => {
    const req = createMockRequest("Bearer token");
    const next = createMockNext();
    const verifier = createMockVerifier({ success: true, claims: validClaims });

    await getMiddleware(verifier)(req, createMockResponse(), next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.context.authentication.state).toBe("authenticated");
    if (req.context.authentication.state === "authenticated") {
      expect(req.context.authentication.principal.userId).toBe(validClaims.sub);
    }
  });

  it("failure leaves context unauthenticated", async () => {
    const req = createMockRequest("Bearer token");
    const next = createMockNext();
    const verifier = createMockVerifier({ success: false, reason: "invalid" });

    await getMiddleware(verifier)(req, createMockResponse(), next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(req.context.authentication.state).toBe("anonymous");
  });

  it("token is not stored in context or principal", async () => {
    const req = createMockRequest("Bearer secret_token_123");
    const next = createMockNext();
    const verifier = createMockVerifier({ success: true, claims: validClaims });

    await getMiddleware(verifier)(req, createMockResponse(), next);

    const serialized = JSON.stringify(req.context);
    expect(serialized).not.toContain("secret_token_123");
  });

  it("configuration is not mutated", async () => {
    const req = createMockRequest("Bearer token");
    const next = createMockNext();
    const verifier = createMockVerifier({ success: true, claims: validClaims });

    const configCopy = JSON.parse(JSON.stringify(config));
    await getMiddleware(verifier)(req, createMockResponse(), next);

    expect(config).toEqual(configCopy);
  });
});
