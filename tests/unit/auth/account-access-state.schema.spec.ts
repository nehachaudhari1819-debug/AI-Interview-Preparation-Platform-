import { accountAccessStateSchema } from "../../../src/auth/account-access-state.schema.js";

describe("accountAccessStateSchema", () => {
  it("accepts 'active'", () => {
    const result = accountAccessStateSchema.safeParse("active");
    expect(result.success).toBe(true);
  });

  it("accepts 'disabled'", () => {
    const result = accountAccessStateSchema.safeParse("disabled");
    expect(result.success).toBe(true);
  });

  it("accepts 'deleted'", () => {
    const result = accountAccessStateSchema.safeParse("deleted");
    expect(result.success).toBe(true);
  });

  it("accepts 'missing'", () => {
    const result = accountAccessStateSchema.safeParse("missing");
    expect(result.success).toBe(true);
  });

  it("rejects unknown string", () => {
    const result = accountAccessStateSchema.safeParse("unknown_state");
    expect(result.success).toBe(false);
  });

  it("rejects null", () => {
    const result = accountAccessStateSchema.safeParse(null);
    expect(result.success).toBe(false);
  });
});
