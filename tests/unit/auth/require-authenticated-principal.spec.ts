import { requireAuthenticatedPrincipal } from "../../../src/auth/require-authenticated-principal.js";
import { AuthenticationRequiredError } from "../../../src/errors/authentication-required.error.js";
import type { Request } from "express";
import type { RequestContext } from "../../../src/types/request-context.types.js";
import type { AuthenticatedPrincipal } from "../../../src/auth/authentication.types.js";

describe("Require Authenticated Principal Helper", () => {
  it("authenticated context returns principal", () => {
    const principal: AuthenticatedPrincipal = {
      userId: "123",
      sessionId: "abc",
      issuer: "iss",
      audiences: ["aud"],
      postgresRole: "authenticated",
      assuranceLevel: "aal1",
      issuedAt: 1,
      expiresAt: 2,
      isAnonymous: false,
      applicationRole: null,
      accountStatus: "unknown",
    };

    const req = {
      context: {
        authentication: {
          state: "authenticated",
          principal,
        },
      } as RequestContext,
    } as Request;

    expect(requireAuthenticatedPrincipal(req)).toBe(principal);
  });

  it("anonymous context throws AuthenticationRequiredError", () => {
    const req = {
      context: {
        authentication: {
          state: "anonymous",
        },
      } as RequestContext,
    } as Request;

    expect(() => requireAuthenticatedPrincipal(req)).toThrow(AuthenticationRequiredError);
  });
});
