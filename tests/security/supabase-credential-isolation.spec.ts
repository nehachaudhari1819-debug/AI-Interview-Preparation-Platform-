/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { jest } from "@jest/globals";
import { createPublicSupabaseClient } from "../../src/integrations/supabase/create-public-supabase-client.js";
import { createUserSupabaseClient } from "../../src/integrations/supabase/create-user-supabase-client.js";
import { createPrivilegedSupabaseClient } from "../../src/integrations/supabase/admin/create-privileged-supabase-client.js";
import type { ApplicationConfig } from "../../src/config/app-config.js";

describe("Supabase Credential Isolation", () => {
  const FAKE_PUBLISHABLE = "fake-publishable-key";
  const FAKE_SECRET = "fake-secret-key";
  const FAKE_LEGACY = "fake-legacy-service-role-key";
  const FAKE_USER_TOKEN = "fake-user-access-token";

  const configSecret = {
    supabase: {
      configured: true,
      url: "https://example.supabase.co",
      publishableKey: FAKE_PUBLISHABLE,
      privilegedKey: FAKE_SECRET,
      privilegedKeyType: "secret",
    },
  } as ApplicationConfig;

  const configLegacy = {
    supabase: {
      configured: true,
      url: "https://example.supabase.co",
      publishableKey: FAKE_PUBLISHABLE,
      privilegedKey: FAKE_LEGACY,
      privilegedKeyType: "legacy_service_role",
    },
  } as ApplicationConfig;

  let mockCreateClient: any;

  beforeEach(() => {
    mockCreateClient = jest.fn() as any;
  });

  it("Public factory receives ONLY the publishable key", () => {
    createPublicSupabaseClient({
      config: configSecret,
      dependencies: { createClient: mockCreateClient },
    });
    const args = mockCreateClient.mock.calls[0];

    expect(args).toContain(FAKE_PUBLISHABLE);
    expect(args).not.toContain(FAKE_SECRET);
    expect(args).not.toContain(FAKE_LEGACY);
    expect(args).not.toContain(FAKE_USER_TOKEN);
    expect(JSON.stringify(args)).not.toContain(FAKE_SECRET);
  });

  it("User factory receives publishable key and user token, NEVER privileged key", () => {
    createUserSupabaseClient({
      config: configSecret,
      accessToken: FAKE_USER_TOKEN,
      dependencies: { createClient: mockCreateClient },
    });
    const args = mockCreateClient.mock.calls[0];

    expect(args).toContain(FAKE_PUBLISHABLE);
    expect(JSON.stringify(args)).toContain(FAKE_USER_TOKEN);
    expect(args).not.toContain(FAKE_SECRET);
    expect(JSON.stringify(args)).not.toContain(FAKE_SECRET);
  });

  it("Privileged factory receives privileged key, NEVER user token", () => {
    createPrivilegedSupabaseClient({
      config: configSecret,
      dependencies: { createClient: mockCreateClient },
    });
    const argsSecret = mockCreateClient.mock.calls[0];

    expect(argsSecret).toContain(FAKE_SECRET);
    expect(JSON.stringify(argsSecret)).not.toContain(FAKE_USER_TOKEN);
    expect(argsSecret).not.toContain(FAKE_PUBLISHABLE);

    mockCreateClient.mockClear();

    createPrivilegedSupabaseClient({
      config: configLegacy,
      dependencies: { createClient: mockCreateClient },
    });
    const argsLegacy = mockCreateClient.mock.calls[0];

    expect(argsLegacy).toContain(FAKE_LEGACY);
    expect(JSON.stringify(argsLegacy)).not.toContain(FAKE_USER_TOKEN);
    expect(argsLegacy).not.toContain(FAKE_PUBLISHABLE);
  });
});
