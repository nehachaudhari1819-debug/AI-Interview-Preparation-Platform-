import { requireSupabaseConfig } from "../../../src/integrations/supabase/require-supabase-config.js";
import type { ApplicationConfig } from "../../../src/config/app-config.js";
import { ConfigurationError } from "../../../src/errors/configuration.error.js";
import { deepFreeze } from "../../../src/utils/deep-freeze.js";

describe("requireSupabaseConfig", () => {
  it("narrows correctly for configured Supabase", () => {
    const config = deepFreeze({
      supabase: {
        configured: true,
        url: "https://example.supabase.co",
        publishableKey: "pk_test",
        privilegedKey: "sk_test",
        privilegedKeyType: "secret",
      },
    } as ApplicationConfig);

    const narrowed = requireSupabaseConfig(config);
    expect(narrowed.url).toBe("https://example.supabase.co");
    expect(narrowed.publishableKey).toBe("pk_test");
    expect(narrowed.privilegedKey).toBe("sk_test");
    expect(narrowed.privilegedKeyType).toBe("secret");
  });

  it("throws safely for absent Supabase", () => {
    const config = deepFreeze({
      supabase: { configured: false },
    } as ApplicationConfig);

    try {
      requireSupabaseConfig(config);
      fail("Should have thrown");
    } catch (e: unknown) {
      const err = e as ConfigurationError;
      expect(err).toBeInstanceOf(ConfigurationError);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(err.issues[0]!.variable).toBe("SUPABASE_URL");
      expect(err.message).not.toContain("pk_test");
      expect(err.message).not.toContain("sk_test");
    }
  });
});
