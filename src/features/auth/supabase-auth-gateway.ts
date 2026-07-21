import type { ApplicationConfig } from "../../config/app-config.js";
import { createPublicSupabaseClient } from "../../integrations/supabase/create-public-supabase-client.js";
import type { AuthGatewaySession } from "./auth-api.types.js";
import type { AuthResponse } from "@supabase/supabase-js";
import {
  normalizeSupabaseAuthError,
  type AuthProviderFailure,
} from "./supabase-auth-error-normalizer.js";

export type RegisterWithPasswordInput = {
  email: string;
  password: string;
  emailRedirectTo: string;
};

export type LoginWithPasswordInput = {
  email: string;
  password: string;
};

export type SupabaseAuthGateway = {
  registerWithPassword(input: RegisterWithPasswordInput): Promise<
    | {
        success: true;
        userCreated: true;
        session: AuthGatewaySession | null;
      }
    | AuthProviderFailure
  >;

  loginWithPassword(input: LoginWithPasswordInput): Promise<
    | {
        success: true;
        session: AuthGatewaySession;
      }
    | AuthProviderFailure
  >;

  refreshSession(refreshToken: string): Promise<
    | {
        success: true;
        session: AuthGatewaySession;
      }
    | AuthProviderFailure
  >;

  logoutLocalSession(refreshToken: string): Promise<void>;
};

function normalizeAuthSession(data: AuthResponse["data"]): AuthGatewaySession | null {
  if (!data.session) {
    return null;
  }

  const session = data.session;
  const user = data.user || session.user;

  if (
    !session.access_token ||
    !session.refresh_token ||
    typeof session.expires_in !== "number" ||
    typeof session.expires_at !== "number" ||
    !user.id
  ) {
    throw new Error("Malformed session returned from provider.");
  }

  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresIn: session.expires_in,
    expiresAt: session.expires_at,
    user: {
      id: user.id,
      isAnonymous: user.is_anonymous === true,
      ...(user.email ? { email: user.email } : {}),
      ...(user.email_confirmed_at ? { emailConfirmedAt: user.email_confirmed_at } : {}),
    },
  };
}

export function createSupabaseAuthGateway(options: {
  config: Readonly<ApplicationConfig>;
  dependencies?: {
    createPublicClient?: typeof createPublicSupabaseClient;
  };
}): SupabaseAuthGateway {
  const createClient = options.dependencies?.createPublicClient ?? createPublicSupabaseClient;

  function getClient() {
    return createClient({ config: options.config });
  }

  return {
    async registerWithPassword(input) {
      try {
        const client = getClient();
        const { data, error } = await client.auth.signUp({
          email: input.email,
          password: input.password,
          options: {
            emailRedirectTo: input.emailRedirectTo,
          },
        });

        if (error) {
          return normalizeSupabaseAuthError(error);
        }

        const session = normalizeAuthSession(data);
        return {
          success: true,
          userCreated: true,
          session,
        };
      } catch (error) {
        return normalizeSupabaseAuthError(error);
      }
    },

    async loginWithPassword(input) {
      try {
        const client = getClient();
        const { data, error } = await client.auth.signInWithPassword({
          email: input.email,
          password: input.password,
        });

        if (error) {
          return normalizeSupabaseAuthError(error);
        }

        const session = normalizeAuthSession(data);
        if (!session) {
          throw new Error("Login succeeded but no session was returned.");
        }

        return {
          success: true,
          session,
        };
      } catch (error) {
        return normalizeSupabaseAuthError(error);
      }
    },

    async refreshSession(refreshToken) {
      try {
        const client = getClient();
        const { data, error } = await client.auth.refreshSession({
          refresh_token: refreshToken,
        });

        if (error) {
          return normalizeSupabaseAuthError(error);
        }

        const session = normalizeAuthSession(data);
        if (!session) {
          throw new Error("Refresh succeeded but no session was returned.");
        }

        return {
          success: true,
          session,
        };
      } catch (error) {
        return normalizeSupabaseAuthError(error);
      }
    },

    async logoutLocalSession(refreshToken) {
      try {
        const client = getClient();
        const { error: refreshError } = await client.auth.refreshSession({
          refresh_token: refreshToken,
        });

        if (refreshError) {
          // Best effort logout - if refresh failed, we still swallow it.
          return;
        }

        await client.auth.signOut({ scope: "local" });
      } catch {
        // Swallowed safely
      }
    },
  };
}
