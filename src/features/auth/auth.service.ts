import type { ApplicationConfig } from "../../config/app-config.js";
import { AuthenticationServiceUnavailableError } from "../../errors/authentication-service-unavailable.error.js";
import { InvalidLoginCredentialsError } from "../../errors/invalid-login-credentials.error.js";
import { InvalidRefreshSessionError } from "../../errors/invalid-refresh-session.error.js";
import { RefreshSessionRequiredError } from "../../errors/refresh-session-required.error.js";
import { RegistrationUnavailableError } from "../../errors/registration-unavailable.error.js";
import { WeakPasswordError } from "../../errors/weak-password.error.js";
import type { AuthenticatedSessionResponse, RegistrationResult } from "./auth-api.types.js";
import type { LoginRequest, RegisterRequest } from "./auth-request.schemas.js";
import { mapSessionToPublicResponse } from "./auth-response.mapper.js";
import { createSupabaseAuthGateway, type SupabaseAuthGateway } from "./supabase-auth-gateway.js";

export type AuthService = {
  register(input: RegisterRequest): Promise<{
    result: RegistrationResult;
    refreshToken?: string;
  }>;
  login(input: LoginRequest): Promise<{
    publicSession: AuthenticatedSessionResponse;
    refreshToken: string;
  }>;
  refresh(refreshToken: string): Promise<{
    publicSession: AuthenticatedSessionResponse;
    rotatedRefreshToken: string;
  }>;
  logout(refreshToken: string | undefined): Promise<void>;
};

export function createAuthService(options: {
  config: Readonly<ApplicationConfig>;
  gateway?: SupabaseAuthGateway;
}): AuthService {
  const gateway = options.gateway ?? createSupabaseAuthGateway({ config: options.config });

  return {
    async register(input) {
      const gatewayResult = await gateway.registerWithPassword({
        email: input.email,
        password: input.password,
        emailRedirectTo: options.config.authSession.emailConfirmationRedirectUrl,
      });

      if (!gatewayResult.success) {
        if (gatewayResult.reason === "ambiguous_registration") {
          return {
            result: {
              status: "verification_required",
              message: "Check your email to continue registration.",
            },
          };
        }
        if (gatewayResult.reason === "weak_password") {
          throw new WeakPasswordError();
        }
        if (gatewayResult.reason === "registration_unavailable") {
          throw new RegistrationUnavailableError();
        }
        throw new AuthenticationServiceUnavailableError();
      }

      if (!gatewayResult.session) {
        return {
          result: {
            status: "verification_required",
            message: "Check your email to continue registration.",
          },
        };
      }

      return {
        result: mapSessionToPublicResponse(gatewayResult.session),
        refreshToken: gatewayResult.session.refreshToken,
      };
    },

    async login(input) {
      const gatewayResult = await gateway.loginWithPassword({
        email: input.email,
        password: input.password,
      });

      if (!gatewayResult.success) {
        if (gatewayResult.reason === "invalid_credentials") {
          throw new InvalidLoginCredentialsError();
        }
        throw new AuthenticationServiceUnavailableError();
      }

      return {
        publicSession: mapSessionToPublicResponse(gatewayResult.session),
        refreshToken: gatewayResult.session.refreshToken,
      };
    },

    async refresh(refreshToken) {
      if (!refreshToken) {
        throw new RefreshSessionRequiredError();
      }

      const gatewayResult = await gateway.refreshSession(refreshToken);

      if (!gatewayResult.success) {
        if (gatewayResult.reason === "invalid_refresh_token") {
          throw new InvalidRefreshSessionError();
        }
        throw new AuthenticationServiceUnavailableError();
      }

      return {
        publicSession: mapSessionToPublicResponse(gatewayResult.session),
        rotatedRefreshToken: gatewayResult.session.refreshToken,
      };
    },

    async logout(refreshToken) {
      if (!refreshToken) {
        return;
      }
      await gateway.logoutLocalSession(refreshToken);
    },
  };
}
