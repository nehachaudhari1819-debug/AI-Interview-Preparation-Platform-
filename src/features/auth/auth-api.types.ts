export type SafeAuthUser = {
  id: string;
  email?: string;
  emailConfirmedAt?: string;
  isAnonymous: boolean;
};

export type AuthenticatedSessionResponse = {
  status: "authenticated";
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  expiresAt: number;
  user: Readonly<SafeAuthUser>;
};

export type RegistrationPendingResponse = {
  status: "verification_required";
  message: "Check your email to continue registration.";
};

export type RegistrationResult = AuthenticatedSessionResponse | RegistrationPendingResponse;

export type AuthSessionTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  expiresAt: number;
};

export type AuthGatewayUser = {
  id: string;
  email?: string;
  emailConfirmedAt?: string;
  isAnonymous: boolean;
};

export type AuthGatewaySession = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  expiresAt: number;
  user: AuthGatewayUser;
};
