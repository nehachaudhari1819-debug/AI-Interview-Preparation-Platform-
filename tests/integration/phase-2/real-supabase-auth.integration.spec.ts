import {
  createSupabaseAuthGateway,
  type SupabaseAuthGateway,
} from "../../../src/features/auth/supabase-auth-gateway.js";
import {
  appConfig,
  generateTestIdentity,
  cleanupTestUser,
  testAdminClient,
} from "../../setup/real-environment.js";

describe("Real Environment: SupabaseAuthGateway", () => {
  let authGateway: SupabaseAuthGateway;
  const identity = generateTestIdentity("gw-auth");
  let userId: string;

  beforeAll(() => {
    authGateway = createSupabaseAuthGateway({ config: appConfig });
  });

  afterAll(async () => {
    if (userId) {
      await cleanupTestUser(userId);
    }
  });

  it("registers a user through the gateway", async () => {
    const res = await authGateway.registerWithPassword({
      email: identity.email,
      password: identity.password,
      emailRedirectTo: appConfig.authSession.emailConfirmationRedirectUrl,
    });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.userCreated).toBe(true);

      // Needs fetching
      const {
        data: { users },
      } = await testAdminClient.auth.admin.listUsers();
      userId = users.find((u) => u.email === identity.email)?.id as string;
    }
  });

  it("returns invalid_credentials failure during login", async () => {
    const res = await authGateway.loginWithPassword({
      email: identity.email,
      password: "wrong-password-123",
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.reason).toBe("invalid_credentials");
    }
  });

  it("logs in successfully and returns a session", async () => {
    // If we require email confirmation, we must confirm it first
    await testAdminClient.auth.admin.updateUserById(userId, { email_confirm: true });

    const res = await authGateway.loginWithPassword({
      email: identity.email,
      password: identity.password,
    });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.session).toBeDefined();
      expect(res.session.accessToken).toBeDefined();
      expect(res.session.refreshToken).toBeDefined();
    }
  });

  it("fails gracefully when refreshing an invalid token", async () => {
    const res = await authGateway.refreshSession("invalid-refresh-token");
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.reason).toBe("invalid_refresh_token");
    }
  });
});
