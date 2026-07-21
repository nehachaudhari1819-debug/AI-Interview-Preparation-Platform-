import { createSupabaseAuthGateway } from "../../../src/features/auth/supabase-auth-gateway.js";

describe("SupabaseAuthGateway", () => {
  it("registerWithPassword delegates to client.auth.signUp", async () => {
    const mockSignUp = jest.fn().mockResolvedValue({
      data: {
        session: {
          access_token: "access-1",
          refresh_token: "refresh-1",
          expires_in: 3600,
          expires_at: 1000000,
          user: { id: "u-1" },
        },
      },
      error: null,
    });

    const mockClient = { auth: { signUp: mockSignUp } };
    const createPublicClient = jest.fn().mockReturnValue(mockClient);

    const gateway = createSupabaseAuthGateway({
      config: {} as any,
      dependencies: { createPublicClient: createPublicClient as any },
    });

    const result = await gateway.registerWithPassword({
      email: "test@example.com",
      password: "pwd",
      emailRedirectTo: "http://test",
    });

    expect(mockSignUp).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "pwd",
      options: { emailRedirectTo: "http://test" },
    });
    expect(result).toEqual({
      success: true,
      userCreated: true,
      session: expect.objectContaining({ accessToken: "access-1" }),
    });
  });

  // More comprehensive tests would mock error cases similarly.
});
