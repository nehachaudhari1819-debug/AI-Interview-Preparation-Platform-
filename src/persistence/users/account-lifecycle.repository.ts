export type AccountLifecycleResult = {
  success: true;
  account: {
    status: "deleted";
  };
};

export type AtomicSoftDeleteInput = {
  userId: string;
  idempotencyKey: string;
  requestId: string;
  requestHash: string;
  operation: string;
};

export type AtomicSoftDeleteResult = {
  status: "success" | "conflict" | "completed" | "failed";
  responseStatus?: number;
  responseBody?: unknown;
  reason?: string;
};

export interface AccountLifecycleRepository {
  /**
   * Soft deletes a user account by updating the account_status to 'deleted' and setting deleted_at.
   * Throws a PersistenceError on failure or if the user profile does not exist.
   *
   * @param userId The ID of the user to soft delete.
   * @returns An AccountLifecycleResult on success.
   */
  softDeleteOwnAccount(userId: string): Promise<AccountLifecycleResult>;

  /**
   * Atomically executes the idempotency reservation, soft deletion, audit logging, and idempotency completion.
   */
  executeAtomicSoftDelete(input: AtomicSoftDeleteInput): Promise<AtomicSoftDeleteResult>;
}
