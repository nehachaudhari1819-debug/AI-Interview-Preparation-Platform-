import { jest } from "@jest/globals";
import { SupabaseAccountAccessStateGateway } from "../../../src/integrations/supabase/account-authorization/supabase-account-access-state.gateway.js";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("SupabaseAccountAccessStateGateway", () => {
  it("returns the exact parsed state on success", async () => {
    const mockClient = {
      rpc: jest.fn().mockResolvedValue({ data: "active", error: null }),
    } as unknown as SupabaseClient;

    const gateway = new SupabaseAccountAccessStateGateway(mockClient);
    const result = await gateway.getCurrentAccountAccessState();

    expect(mockClient.rpc).toHaveBeenCalledWith("get_current_account_access_state");
    expect(result).toBe("active");
  });

  it("returns 'missing' if the state is unknown", async () => {
    const mockClient = {
      rpc: jest.fn().mockResolvedValue({ data: "some_weird_status", error: null }),
    } as unknown as SupabaseClient;

    const gateway = new SupabaseAccountAccessStateGateway(mockClient);
    const result = await gateway.getCurrentAccountAccessState();

    expect(result).toBe("missing");
  });

  it("throws an error safely when RPC fails, without exposing raw data", async () => {
    const mockClient = {
      rpc: jest.fn().mockResolvedValue({
        data: null,
        error: { message: "connection timeout", details: "sensitive info", code: "5XX" },
      }),
    } as unknown as SupabaseClient;

    const gateway = new SupabaseAccountAccessStateGateway(mockClient);

    await expect(gateway.getCurrentAccountAccessState()).rejects.toThrow(
      "Account state resolution failed: connection timeout",
    );
  });
});
