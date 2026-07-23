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
  status: "success" | "conflict" | "completed" | "failed" | "processing";
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
   * Prepares the soft deletion by locking the row, reserving idempotency, soft-deleting, and logging an audit event.
   */
  prepareSoftDelete(input: AtomicSoftDeleteInput): Promise<AtomicSoftDeleteResult>;

  /**
   * Finalizes the soft deletion by marking idempotency as completed.
   */
  finalizeSoftDelete(
    input: Omit<AtomicSoftDeleteInput, "requestId" | "requestHash">,
  ): Promise<AtomicSoftDeleteResult>;
}
