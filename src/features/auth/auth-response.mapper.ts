import type { AuthenticatedSessionResponse, AuthGatewaySession } from "./auth-api.types.js";

export function mapSessionToPublicResponse(
  session: AuthGatewaySession,
): AuthenticatedSessionResponse {
  return {
    status: "authenticated",
    accessToken: session.accessToken,
    tokenType: "Bearer",
    expiresIn: session.expiresIn,
    expiresAt: session.expiresAt,
    user: {
      id: session.user.id,
      email: session.user.email,
      emailConfirmedAt: session.user.emailConfirmedAt,
      isAnonymous: session.user.isAnonymous,
    },
  };
}
