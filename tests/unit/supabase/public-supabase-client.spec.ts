import { jest } from "@jest/globals";
import { createPublicSupabaseClient } from "../../../src/integrations/supabase/create-public-supabase-client.js";
import type { ApplicationConfig } from "../../../src/config/app-config.js";
import { ConfigurationError } from "../../../src/errors/configuration.error.js";
import type { SupabaseClientFactoryDependencies } from "../../../src/integrations/supabase/supabase-client.types.js";

describe("Public Supabase Client Factory", () => {
  const validConfig = {
    supabase: {
      configured: true,
      url: "https://example.supabase.co",
      publishableKey: "pk_test",
      privilegedKey: "sk_test",
      privilegedKeyType: "secret",
    },
  } as ApplicationConfig;

  let mockCreateClient: any;
  let dependencies: Partial<SupabaseClientFactoryDependencies>;

  beforeEach(() => {
    mockCreateClient = jest.fn().mockReturnValue({ mockClient: true }) as any;
    dependencies = { createClient: mockCreateClient };
  });

  it("uses url and publishable key, applies server options, and does not use privileged key", () => {
    const client = createPublicSupabaseClient({ config: validConfig, dependencies });

    expect(client).toEqual({ mockClient: true });
    expect(mockCreateClient).toHaveBeenCalledTimes(1);
    expect(mockCreateClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "pk_test",
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
    const optionsArg = callArgs[2];
    expect(optionsArg.global?.headers?.Authorization).toBeUndefined();
    expect(callArgs).not.toContain("sk_test");
  });

  it("throws safely when Supabase is unconfigured", () => {
    const unconfiguredConfig = {
      supabase: { configured: false },
    } as ApplicationConfig;

    expect(() => createPublicSupabaseClient({ config: unconfiguredConfig, dependencies })).toThrow(
      ConfigurationError,
    );
    expect(mockCreateClient).not.toHaveBeenCalled();
  });
});
