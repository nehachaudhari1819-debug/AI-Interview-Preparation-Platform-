export type RevokeAllUserSessionsInput = {
  accessToken: string;
  userId: string;
};

export interface AccountSessionRevocationGateway {
  /**
   * Revokes all refresh sessions for the specified user globally across devices.
   * Resolves silently if successful or if the token is already invalid.
   * Throws an appropriate error for actual provider failures.
   */
  revokeAllUserSessions(input: RevokeAllUserSessionsInput): Promise<void>;
}
