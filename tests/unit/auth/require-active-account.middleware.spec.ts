import type { Request, Response, NextFunction } from "express";
import { createRequireActiveAccountMiddleware } from "../../../src/auth/require-active-account.middleware.js";
import { AccountDisabledError } from "../../../src/errors/account-disabled.error.js";
import { AccountDeletedError } from "../../../src/errors/account-deleted.error.js";
import { UserProfileNotFoundError } from "../../../src/errors/user-profile-not-found.error.js";
import { ServiceUnavailableError } from "../../../src/errors/service-unavailable.error.js";
import { SupabaseAccountAccessStateGateway } from "../../../src/integrations/supabase/account-authorization/supabase-account-access-state.gateway.js";
import * as bearerUtils from "../../../src/auth/bearer-token.js";
import * as clientUtils from "../../../src/integrations/supabase/create-user-supabase-client.js";
import type { ApplicationConfig } from "../../../src/config/app-config.js";

jest.mock(
  "../../../src/integrations/supabase/account-authorization/supabase-account-access-state.gateway.js",
);
jest.mock("../../../src/auth/bearer-token.js");
jest.mock("../../../src/integrations/supabase/create-user-supabase-client.js");

describe("createRequireActiveAccountMiddleware", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;
  let mockConfig: Readonly<ApplicationConfig>;
  let mockGatewayInstance: jest.Mocked<SupabaseAccountAccessStateGateway>;

  beforeEach(() => {
    mockConfig = {
      supabase: { url: "http://test", anonKey: "test", serviceRoleKey: "test" },
    } as unknown as ApplicationConfig;

    mockRequest = {
      headers: { authorization: "Bearer some-token" },
      context: {
        authentication: {
          state: "authenticated",
          principal: { id: "user-123", role: "student" } as any,
        },
      } as any,
    };
    mockResponse = {};
    nextFunction = jest.fn();

    jest.spyOn(bearerUtils, "readSingleAuthorizationHeader").mockReturnValue("Bearer some-token");
    jest
      .spyOn(bearerUtils, "extractBearerToken")
      .mockReturnValue({ status: "present", token: "some-token" });
    jest.spyOn(clientUtils, "createUserSupabaseClient").mockReturnValue({} as any);

    mockGatewayInstance = {
      getCurrentAccountAccessState: jest.fn(),
    } as any;

    (SupabaseAccountAccessStateGateway as jest.Mock).mockImplementation(() => mockGatewayInstance);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("calls next if state is active", async () => {
    mockGatewayInstance.getCurrentAccountAccessState.mockResolvedValue("active");
    const middleware = createRequireActiveAccountMiddleware(mockConfig);

    await middleware(mockRequest as Request, mockResponse as Response, nextFunction);
    expect(nextFunction).toHaveBeenCalledWith();
  });

  it("throws AccountDisabledError if state is disabled", async () => {
    mockGatewayInstance.getCurrentAccountAccessState.mockResolvedValue("disabled");
    const middleware = createRequireActiveAccountMiddleware(mockConfig);

    await expect(
      middleware(mockRequest as Request, mockResponse as Response, nextFunction),
    ).rejects.toThrow(AccountDisabledError);
  });

  it("throws AccountDeletedError if state is deleted", async () => {
    mockGatewayInstance.getCurrentAccountAccessState.mockResolvedValue("deleted");
    const middleware = createRequireActiveAccountMiddleware(mockConfig);

    await expect(
      middleware(mockRequest as Request, mockResponse as Response, nextFunction),
    ).rejects.toThrow(AccountDeletedError);
  });

  it("throws UserProfileNotFoundError if state is missing", async () => {
    mockGatewayInstance.getCurrentAccountAccessState.mockResolvedValue("missing");
    const middleware = createRequireActiveAccountMiddleware(mockConfig);

    await expect(
      middleware(mockRequest as Request, mockResponse as Response, nextFunction),
    ).rejects.toThrow(UserProfileNotFoundError);
  });

  it("throws ServiceUnavailableError if gateway throws an expected error", async () => {
    mockGatewayInstance.getCurrentAccountAccessState.mockRejectedValue(
      new Error("Account state resolution failed: timeout"),
    );
    const middleware = createRequireActiveAccountMiddleware(mockConfig);

    await expect(
      middleware(mockRequest as Request, mockResponse as Response, nextFunction),
    ).rejects.toThrow(ServiceUnavailableError);
  });

  it("throws generic error if authentication is missing from context", async () => {
    (mockRequest as any).context = undefined;
    const middleware = createRequireActiveAccountMiddleware(mockConfig);

    await expect(
      middleware(mockRequest as Request, mockResponse as Response, nextFunction),
    ).rejects.toThrow(
      "createRequireActiveAccountMiddleware must be run after createAuthenticationMiddleware",
    );
  });
});
