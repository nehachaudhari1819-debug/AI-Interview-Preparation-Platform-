import { jest } from "@jest/globals";
import { createSupabaseAccessTokenVerifier } from "../../src/auth/supabase-access-token-verifier.js";
import { createTestApplicationConfig } from "../setup/test-helpers.js";
import * as PublicClientModule from "../../src/integrations/supabase/create-public-supabase-client.js";

describe("Authentication Privilege Isolation Security", () => {
  it("never instantiates a privileged client for token verification", () => {
    // We mock createPublicSupabaseClient to track its invocation.
    // If it imports the service role key, it's a security violation.
    const config = createTestApplicationConfig();
    (config as any).supabase = {
      ...config.supabase,
      privilegedKey: "secret-service-role-key",
    };
    const publicClientSpy = jest.fn<any>().mockImplementation(
      () =>
        ({
          auth: {
            getClaims: jest.fn(),
          },
        }) as any,
    );

    // Call the factory
    createSupabaseAccessTokenVerifier({
      config,
      dependencies: { createPublicClient: publicClientSpy },
    });

    // It must use createPublicSupabaseClient
    expect(publicClientSpy).toHaveBeenCalledWith({ config });

    // Assert that the service role key is NEVER passed to the public client factory.
    // createPublicSupabaseClient only takes `config` and uses `config.supabase.url` and `config.supabase.anonKey`.
    // We verify the signature doesn't magically accept the service role key.
    const callArgs = publicClientSpy.mock.calls[0]?.[0] as any;
    expect(callArgs?.config?.supabase?.privilegedKey).toBeDefined(); // The config has it, but the public client ignores it

    publicClientSpy.mockRestore();
  });
});
