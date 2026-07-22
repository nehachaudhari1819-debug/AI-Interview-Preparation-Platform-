import { createSupabaseAuthGateway } from "../../../src/features/auth/supabase-auth-gateway.js";
import {
  appConfig,
  generateTestIdentity,
  cleanupTestUser,
  testAdminClient,
} from "../../setup/real-environment.js";
import { createUserSupabaseClient } from "../../../src/integrations/supabase/create-user-supabase-client.js";
import { SupabaseUserProfileRepository } from "../../../src/persistence/users/supabase-user-profile.repository.js";

describe("Real Environment: RLS and User Persistence", () => {
  const authGateway = createSupabaseAuthGateway({ config: appConfig });
  const userA = generateTestIdentity("user-a");
  const userB = generateTestIdentity("user-b");

  let userIdA: string;
  let userIdB: string;
  let accessTokenA: string;

  let repoA: SupabaseUserProfileRepository;

  beforeAll(async () => {
    // 1. Provision User A and B
    const aRes = await testAdminClient.auth.admin.createUser({
      email: userA.email,
      password: userA.password,
      email_confirm: true,
    });
    userIdA = aRes.data.user!.id;
    const bRes = await testAdminClient.auth.admin.createUser({
      email: userB.email,
      password: userB.password,
      email_confirm: true,
    });
    userIdB = bRes.data.user!.id;

    // 2. Login User A
    const loginRes = await authGateway.loginWithPassword({
      email: userA.email,
      password: userA.password,
    });
    if (!loginRes.success) throw new Error("Failed to login test user");
    accessTokenA = loginRes.session.accessToken;

    // 3. Create User-scoped repository for User A
    const userClientA = createUserSupabaseClient({
      config: appConfig,
      accessToken: accessTokenA,
    });
    repoA = new SupabaseUserProfileRepository(userClientA);
  });

  afterAll(async () => {
    await cleanupTestUser(userIdA);
    await cleanupTestUser(userIdB);
  });

  it("allows User A to read their own profile", async () => {
    const profile = await repoA.findById(userIdA);
    expect(profile).not.toBeNull();
    expect(profile?.id).toBe(userIdA);
    expect(profile?.email).toBe(userA.email);
  });

  it("blocks User A from reading User B's profile (RLS Enforcement)", async () => {
    // Depending on RLS implementation, this either returns null (not found) or throws.
    // Our repo throws PersistenceError if data is empty.
    await expect(repoA.findById(userIdB)).rejects.toThrow();
  });

  it("blocks anonymous access entirely", async () => {
    // Create a client with no access token (or invalid)
    const anonClient = createUserSupabaseClient({
      config: appConfig,
      accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.anon", // Fake token
    });
    const anonRepo = new SupabaseUserProfileRepository(anonClient);

    await expect(anonRepo.findById(userIdA)).rejects.toThrow();
  });
});
