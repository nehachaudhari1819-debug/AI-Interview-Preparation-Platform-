import type { ApplicationConfig } from "../../../config/app-config.js";
import { createPrivilegedSupabaseClient } from "../admin/create-privileged-supabase-client.js";
import { normalizeSupabaseAuthError } from "../../../features/auth/supabase-auth-error-normalizer.js";
import type {
  AccountSessionRevocationGateway,
  RevokeAllUserSessionsInput,
} from "./account-session-revocation.gateway.js";

export function createSupabaseAccountSessionRevocationGateway(
  config: Readonly<ApplicationConfig>,
): AccountSessionRevocationGateway {
  return {
    async revokeAllUserSessions(input: RevokeAllUserSessionsInput): Promise<void> {
      const client = createPrivilegedSupabaseClient({ config });

      // Use global scope to invalidate all refresh tokens for this user across devices
      // The Admin API signOut requires the user's JWT to identify the session and 'global' scope to revoke all
      const { error } = await client.auth.admin.signOut(input.accessToken, "global");

      if (error) {
        const status = (error as unknown as { status?: number }).status;
        if (status && [400, 401, 403, 404].includes(status)) {
          // Swallow these as the session is already invalid/gone
          return;
        }

        const normalized = normalizeSupabaseAuthError(error);
        throw new Error(`Session revocation failed: ${normalized.reason} (orig: ${error.message})`);
      }
    },
  };
}
