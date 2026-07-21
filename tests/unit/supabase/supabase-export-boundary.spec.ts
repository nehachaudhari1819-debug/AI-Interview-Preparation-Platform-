describe("Supabase Export Boundary", () => {
  it("exports public and user factories from the root barrel, but not the privileged factory", async () => {
    const rootBarrel = await import("../../../src/integrations/supabase/index.js");

    expect(rootBarrel.createPublicSupabaseClient).toBeDefined();
    expect(rootBarrel.createUserSupabaseClient).toBeDefined();
    expect(rootBarrel.requireSupabaseConfig).toBeDefined();
    expect((rootBarrel as Record<string, unknown>).createPrivilegedSupabaseClient).toBeUndefined();
  });

  it("exports the privileged factory only from the admin barrel", async () => {
    const adminBarrel = await import("../../../src/integrations/supabase/admin/index.js");
    expect(adminBarrel.createPrivilegedSupabaseClient).toBeDefined();
  });
});
