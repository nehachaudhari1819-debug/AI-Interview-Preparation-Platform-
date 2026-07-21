import { createServerAuthOptions } from "../../../src/integrations/supabase/supabase-client-options.js";

describe("createServerAuthOptions", () => {
  it("returns fresh object with all auth values false", () => {
    const options1 = createServerAuthOptions();
    const options2 = createServerAuthOptions();

    expect(options1).not.toBe(options2); // Fresh object
    expect(options1.auth.persistSession).toBe(false);
    expect(options1.auth.autoRefreshToken).toBe(false);
    expect(options1.auth.detectSessionInUrl).toBe(false);

    expect((options1 as Record<string, unknown>).global).toBeUndefined();
    expect((options1 as Record<string, unknown>).storage).toBeUndefined();
  });
});
