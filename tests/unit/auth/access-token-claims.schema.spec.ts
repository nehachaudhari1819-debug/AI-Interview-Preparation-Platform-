import { verifiedAccessTokenClaimsSchema } from "../../../src/auth/access-token-claims.schema.js";

describe("Verified Access Token Claims Schema", () => {
  const validClaims = {
    iss: "https://example.com/auth/v1",
    aud: "authenticated",
    exp: 1700000000,
    iat: 1600000000,
    sub: "d290f1ee-6c54-4b01-90e6-d701748f0851",
    role: "authenticated",
    aal: "aal1",
    session_id: "e440f1ee-6c54-4b01-90e6-d701748f0852",
    is_anonymous: false,
  };

  it("valid authenticated claims pass", () => {
    const result = verifiedAccessTokenClaimsSchema.safeParse(validClaims);
    expect(result.success).toBe(true);
  });

  it("string audience passes", () => {
    const result = verifiedAccessTokenClaimsSchema.safeParse(validClaims);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.aud).toBe("authenticated");
  });

  it("array audience passes", () => {
    const result = verifiedAccessTokenClaimsSchema.safeParse({
      ...validClaims,
      aud: ["authenticated", "other"],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.aud).toEqual(["authenticated", "other"]);
  });

  it("missing subject fails", () => {
    const { sub: _sub, ...claims } = validClaims;
    const result = verifiedAccessTokenClaimsSchema.safeParse(claims);
    expect(result.success).toBe(false);
  });

  it("invalid subject UUID fails", () => {
    const result = verifiedAccessTokenClaimsSchema.safeParse({
      ...validClaims,
      sub: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("invalid session UUID fails", () => {
    const result = verifiedAccessTokenClaimsSchema.safeParse({
      ...validClaims,
      session_id: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("invalid assurance level fails", () => {
    const result = verifiedAccessTokenClaimsSchema.safeParse({
      ...validClaims,
      aal: "aal3",
    });
    expect(result.success).toBe(false);
  });

  it("invalid expiration type fails", () => {
    const result = verifiedAccessTokenClaimsSchema.safeParse({
      ...validClaims,
      exp: "1700000000", // should be number
    });
    expect(result.success).toBe(false);
  });

  it("invalid issued-at type fails", () => {
    const result = verifiedAccessTokenClaimsSchema.safeParse({
      ...validClaims,
      iat: "1600000000",
    });
    expect(result.success).toBe(false);
  });

  it("invalid anonymous flag fails", () => {
    const result = verifiedAccessTokenClaimsSchema.safeParse({
      ...validClaims,
      is_anonymous: "false",
    });
    expect(result.success).toBe(false);
  });

  it("optional email passes", () => {
    const result = verifiedAccessTokenClaimsSchema.safeParse({
      ...validClaims,
      email: "test@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("optional phone passes", () => {
    const result = verifiedAccessTokenClaimsSchema.safeParse({
      ...validClaims,
      phone: "1234567890",
    });
    expect(result.success).toBe(true);
  });

  it("empty email becomes absent", () => {
    const result = verifiedAccessTokenClaimsSchema.safeParse({
      ...validClaims,
      email: "   ",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBeUndefined();
  });

  it("valid student role passes", () => {
    const result = verifiedAccessTokenClaimsSchema.safeParse({
      ...validClaims,
      user_role: "student",
    });
    expect(result.success).toBe(true);
  });

  it("valid admin role passes", () => {
    const result = verifiedAccessTokenClaimsSchema.safeParse({
      ...validClaims,
      user_role: "admin",
    });
    expect(result.success).toBe(true);
  });

  it("unknown application role fails", () => {
    const result = verifiedAccessTokenClaimsSchema.safeParse({
      ...validClaims,
      user_role: "hacker",
    });
    expect(result.success).toBe(false);
  });

  it("valid account status passes", () => {
    const result = verifiedAccessTokenClaimsSchema.safeParse({
      ...validClaims,
      account_status: "active",
    });
    expect(result.success).toBe(true);
  });

  it("unknown token-provided account status fails", () => {
    const result = verifiedAccessTokenClaimsSchema.safeParse({
      ...validClaims,
      account_status: "unknown",
    });
    expect(result.success).toBe(false);
  });

  it("additional provider claims do not break parsing", () => {
    const result = verifiedAccessTokenClaimsSchema.safeParse({
      ...validClaims,
      amr: [{ method: "password", timestamp: 12345 }],
      random_claim: "hello",
    });
    expect(result.success).toBe(true);
  });

  it("user metadata does not influence validated authorization fields", () => {
    const result = verifiedAccessTokenClaimsSchema.safeParse({
      ...validClaims,
      user_metadata: { role: "admin" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.user_role).toBeUndefined();
      expect(result.data.user_metadata).toEqual({ role: "admin" });
    }
  });
});
