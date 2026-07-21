import { mapSessionToPublicResponse } from "../../src/features/auth/auth-response.mapper.js";
import type { AuthGatewaySession } from "../../src/features/auth/auth-api.types.js";

describe("mapSessionToPublicResponse", () => {
  it("maps session correctly", () => {
    const session: AuthGatewaySession = {
      accessToken: "access-123",
      refreshToken: "refresh-123",
      expiresIn: 3600,
      expiresAt: 1234567890,
      user: {
        id: "user-123",
        email: "test@example.com",
        emailConfirmedAt: "2023-01-01T00:00:00.000Z",
        isAnonymous: false,
      },
    };

    const response = mapSessionToPublicResponse(session);
    expect(response).toEqual({
      status: "authenticated",
      accessToken: "access-123",
      tokenType: "Bearer",
      expiresIn: 3600,
      expiresAt: 1234567890,
      user: {
        id: "user-123",
        email: "test@example.com",
        emailConfirmedAt: "2023-01-01T00:00:00.000Z",
        isAnonymous: false,
      },
    });
  });
});
