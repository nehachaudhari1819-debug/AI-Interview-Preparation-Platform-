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
      isAnonymous: session.user.isAnonymous,
      ...(session.user.email ? { email: session.user.email } : {}),
      ...(session.user.emailConfirmedAt ? { emailConfirmedAt: session.user.emailConfirmedAt } : {}),
    },
  };
}
