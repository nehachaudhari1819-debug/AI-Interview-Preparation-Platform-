import type {
  ACCOUNT_STATUSES,
  APPLICATION_ROLES,
  AUTHENTICATOR_ASSURANCE_LEVELS,
} from "./auth.constants.js";

export type ApplicationRole = (typeof APPLICATION_ROLES)[number];

export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export type AuthenticatorAssuranceLevel = (typeof AUTHENTICATOR_ASSURANCE_LEVELS)[number];

export type AuthenticatedPrincipal = {
  userId: string;
  sessionId: string;
  issuer: string;
  audiences: readonly string[];
  postgresRole: "authenticated";
  assuranceLevel: AuthenticatorAssuranceLevel;
  issuedAt: number;
  expiresAt: number;
  isAnonymous: boolean;
  email?: string | undefined;
  phone?: string | undefined;
  applicationRole: ApplicationRole | null;
  accountStatus: AccountStatus;
};

export type AnonymousAuthenticationContext = {
  state: "anonymous";
};

export type AuthenticatedAuthenticationContext = {
  state: "authenticated";
  principal: Readonly<AuthenticatedPrincipal>;
};

export type RequestAuthenticationContext =
  AnonymousAuthenticationContext | AuthenticatedAuthenticationContext;
