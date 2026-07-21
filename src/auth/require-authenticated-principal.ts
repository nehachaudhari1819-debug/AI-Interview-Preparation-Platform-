import type { Request } from "express";
import type {
  AuthenticatedAuthenticationContext,
  AuthenticatedPrincipal,
  RequestAuthenticationContext,
} from "./authentication.types.js";
import { AuthenticationRequiredError } from "../errors/authentication-required.error.js";

export function isAuthenticatedContext(
  context: RequestAuthenticationContext,
): context is AuthenticatedAuthenticationContext {
  return context.state === "authenticated";
}

export function requireAuthenticatedPrincipal(request: Request): Readonly<AuthenticatedPrincipal> {
  const authContext = request.context.authentication;

  if (isAuthenticatedContext(authContext)) {
    return authContext.principal;
  }

  throw new AuthenticationRequiredError();
}
