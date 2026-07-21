import { createAuthService } from "../../src/features/auth/auth.service.js";
import { AuthenticationServiceUnavailableError } from "../../src/errors/authentication-service-unavailable.error.js";
import { InvalidLoginCredentialsError } from "../../src/errors/invalid-login-credentials.error.js";

describe("AuthService", () => {
  const mockConfig = {
    authSession: { emailConfirmationRedirectUrl: "http://test" },
  } as any;

  describe("register", () => {
    it("returns successful session when gateway succeeds", async () => {
      const mockGateway = {
        registerWithPassword: jest.fn().mockResolvedValue({
          success: true,
          userCreated: true,
          session: {
            accessToken: "acc",
            refreshToken: "ref",
            expiresIn: 3600,
            expiresAt: 1234,
            user: { id: "1" },
          },
        }),
      };

      const service = createAuthService({
        config: mockConfig,
        gateway: mockGateway as any,
      });

      const result = await service.register({ email: "test@test.com", password: "pwd" });

      expect(result.refreshToken).toBe("ref");
      expect(result.result.status).toBe("authenticated");
    });
  });

  describe("login", () => {
    it("throws InvalidLoginCredentialsError on invalid credentials", async () => {
      const mockGateway = {
        loginWithPassword: jest.fn().mockResolvedValue({
          success: false,
          reason: "invalid_credentials",
        }),
      };

      const service = createAuthService({
        config: mockConfig,
        gateway: mockGateway as any,
      });

      await expect(service.login({ email: "test@test.com", password: "pwd" })).rejects.toThrow();
    });
  });
});
