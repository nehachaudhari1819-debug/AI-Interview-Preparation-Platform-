/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { jest } from "@jest/globals";
import { createPrivilegedSupabaseClient } from "../../../src/integrations/supabase/admin/create-privileged-supabase-client.js";
import type { ApplicationConfig } from "../../../src/config/app-config.js";
import { ConfigurationError } from "../../../src/errors/configuration.error.js";
import type { SupabaseClientFactoryDependencies } from "../../../src/integrations/supabase/supabase-client.types.js";

describe("Privileged Supabase Client Factory", () => {
  const secretConfig = {
    supabase: {
      configured: true,
      url: "https://example.supabase.co",
      publishableKey: "pk_test",
      privilegedKey: "sk_test_secret",
      privilegedKeyType: "secret",
    },
  } as ApplicationConfig;

  const legacyConfig = {
    supabase: {
      configured: true,
      url: "https://example.supabase.co",
      publishableKey: "pk_test",
      privilegedKey: "sr_test_legacy",
      privilegedKeyType: "legacy_service_role",
    },
  } as ApplicationConfig;

  let mockCreateClient: any;
  let dependencies: Partial<SupabaseClientFactoryDependencies>;

  beforeEach(() => {
    mockCreateClient = jest.fn().mockReturnValue({ mockClient: true }) as any;
    dependencies = { createClient: mockCreateClient };
  });

  it("uses the preferred secret key", () => {
    createPrivilegedSupabaseClient({ config: secretConfig, dependencies });
    expect(mockCreateClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "sk_test_secret",
      expect.objectContaining({
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }),
    );
    const callArgs = mockCreateClient.mock.calls[0] as [
      string,
      string,
      { global?: { headers?: { Authorization?: string } } },
    ];
    expect(callArgs[2].global?.headers?.Authorization).toBeUndefined();
    expect(callArgs).not.toContain("pk_test");
  });

  it("uses the legacy service role key when configured", () => {
    createPrivilegedSupabaseClient({ config: legacyConfig, dependencies });
    expect(mockCreateClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "sr_test_legacy",
      expect.any(Object),
    );
  });

  it("fails safely when unconfigured", () => {
    const unconfiguredConfig = { supabase: { configured: false } } as ApplicationConfig;
    expect(() =>
      createPrivilegedSupabaseClient({ config: unconfiguredConfig, dependencies }),
    ).toThrow(ConfigurationError);
    expect(mockCreateClient).not.toHaveBeenCalled();
  });
});
