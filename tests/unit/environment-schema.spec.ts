import { environmentSchema } from "../../src/config/environment-schema.js";

describe("Environment Schema", () => {
  const baseValidEnv = {
    FRONTEND_URL: "http://localhost:5173",
  };

  it("validates development environment with defaults", () => {
    const result = environmentSchema.parse({ ...baseValidEnv, NODE_ENV: "development" });
    expect(result.NODE_ENV).toBe("development");
    expect(result.PORT).toBe(5000);
    expect(result.SHUTDOWN_TIMEOUT_MS).toBe(10000);
    expect(result.COOKIE_SECURE).toBe(false);
    expect(result.COOKIE_SAME_SITE).toBe("lax");
  });

  it("validates test and production environments", () => {
    expect(environmentSchema.parse({ ...baseValidEnv, NODE_ENV: "test" }).NODE_ENV).toBe("test");

    expect(
      environmentSchema.parse({ ...baseValidEnv, NODE_ENV: "production", COOKIE_SECURE: "true" })
        .NODE_ENV,
    ).toBe("production");
  });

  it("rejects invalid Node environments", () => {
    expect(() => environmentSchema.parse({ ...baseValidEnv, NODE_ENV: "staging" })).toThrow();
  });

  it("rejects invalid ports and timeouts", () => {
    expect(() => environmentSchema.parse({ ...baseValidEnv, PORT: "0" })).toThrow();
    expect(() => environmentSchema.parse({ ...baseValidEnv, PORT: "65536" })).toThrow();
    expect(() =>
      environmentSchema.parse({ ...baseValidEnv, SHUTDOWN_TIMEOUT_MS: "500" }),
    ).toThrow();
  });

  it("rejects invalid FRONTEND_URL", () => {
    expect(() =>
      environmentSchema.parse({ ...baseValidEnv, FRONTEND_URL: "ftp://example.com" }),
    ).toThrow();
    expect(() =>
      environmentSchema.parse({ ...baseValidEnv, FRONTEND_URL: "localhost:5173" }),
    ).toThrow();
    expect(() =>
      environmentSchema.parse({ ...baseValidEnv, FRONTEND_URL: "https://user:pass@example.com" }),
    ).toThrow();
  });

  it("rejects production with insecure cookies", () => {
    expect(() =>
      environmentSchema.parse({ ...baseValidEnv, NODE_ENV: "production", COOKIE_SECURE: "false" }),
    ).toThrow();
  });

  it("rejects SameSite none with insecure cookies", () => {
    expect(() =>
      environmentSchema.parse({
        ...baseValidEnv,
        COOKIE_SAME_SITE: "none",
        COOKIE_SECURE: "false",
      }),
    ).toThrow();
  });

  it("accepts complete Supabase configuration", () => {
    const result = environmentSchema.parse({
      ...baseValidEnv,
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "pk_test",
      SUPABASE_SERVICE_ROLE_KEY: "sr_test",
    });
    expect(result.SUPABASE_URL).toBeDefined();
  });

  it("rejects partial Supabase configuration", () => {
    expect(() =>
      environmentSchema.parse({
        ...baseValidEnv,
        SUPABASE_URL: "https://example.supabase.co",
      }),
    ).toThrow();
  });

  it("normalizes empty optional secrets to undefined", () => {
    const result = environmentSchema.parse({
      ...baseValidEnv,
      GEMINI_API_KEY: "   ",
      OPENAI_API_KEY: "",
    });
    expect(result.GEMINI_API_KEY).toBeUndefined();
    expect(result.OPENAI_API_KEY).toBeUndefined();
  });

  it("rejects invalid log level and resume bucket", () => {
    expect(() => environmentSchema.parse({ ...baseValidEnv, LOG_LEVEL: "verbose" })).toThrow();
    expect(() =>
      environmentSchema.parse({ ...baseValidEnv, RESUME_BUCKET: "InvalidBucket!" }),
    ).toThrow();
  });

  it("ensures validation errors do not contain secret values", () => {
    try {
      environmentSchema.parse({
        ...baseValidEnv,
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_PUBLISHABLE_KEY: "secret_value_123",
      });
      fail("Should have thrown due to missing SERVICE_ROLE_KEY");
    } catch (error: any) {
      const errorString = JSON.stringify(error);
      expect(errorString).not.toContain("secret_value_123");
    }
  });
});
