import { jest } from "@jest/globals";
import { createUserSupabaseClient } from "../../../src/integrations/supabase/create-user-supabase-client.js";
import type { ApplicationConfig } from "../../../src/config/app-config.js";
import { SupabaseIntegrationError } from "../../../src/errors/supabase-integration.error.js";
import type { SupabaseClientFactoryDependencies } from "../../../src/integrations/supabase/supabase-client.types.js";

describe("User Supabase Client Factory", () => {
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

  it("sends Authorization bearer token and trims surrounding whitespace", () => {
    const token = "  my-valid-token  ";
    const client = createUserSupabaseClient({
      config: validConfig,
      accessToken: token,
      dependencies,
    });

    expect(client).toEqual({ mockClient: true });
    expect(mockCreateClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "pk_test",
      expect.objectContaining({
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        global: {
          headers: {
            Authorization: "Bearer my-valid-token",
          },
        },
      }),
    );
    expect(mockCreateClient.mock.calls[0]).not.toContain("sk_test");
  });

  it("rejects empty token", () => {
    expect(() =>
      createUserSupabaseClient({ config: validConfig, accessToken: "   ", dependencies }),
    ).toThrow(SupabaseIntegrationError);
  });

  it("rejects internal whitespace", () => {
    expect(() =>
      createUserSupabaseClient({
        config: validConfig,
        accessToken: "token with space",
        dependencies,
      }),
    ).toThrow(SupabaseIntegrationError);
  });

  it("rejects line breaks", () => {
    expect(() =>
      createUserSupabaseClient({ config: validConfig, accessToken: "token\nbreak", dependencies }),
    ).toThrow(SupabaseIntegrationError);
  });

  it("rejects null bytes", () => {
    expect(() =>
      createUserSupabaseClient({ config: validConfig, accessToken: "token\0byte", dependencies }),
    ).toThrow(SupabaseIntegrationError);
  });

  it("rejects oversized input", () => {
    const hugeToken = "a".repeat(17000);
    expect(() =>
      createUserSupabaseClient({ config: validConfig, accessToken: hugeToken, dependencies }),
    ).toThrow(SupabaseIntegrationError);
  });

  it("does not include token in errors", () => {
    try {
      createUserSupabaseClient({
        config: validConfig,
        accessToken: "SUPER_SECRET \n MY_TOKEN",
        dependencies,
      });
      fail("Should have thrown");
    } catch (e: unknown) {
      expect((e as Error).message).not.toContain("SUPER_SECRET");
      expect((e as Error).message).not.toContain("MY_TOKEN");
    }
  });

  it("creates a separate client per invocation", () => {
    createUserSupabaseClient({ config: validConfig, accessToken: "token1", dependencies });
    createUserSupabaseClient({ config: validConfig, accessToken: "token2", dependencies });
    expect(mockCreateClient).toHaveBeenCalledTimes(2);
  });
});
