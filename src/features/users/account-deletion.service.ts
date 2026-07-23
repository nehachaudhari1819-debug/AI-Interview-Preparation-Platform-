import * as crypto from "node:crypto";
import { AppError } from "../../errors/app-error.js";
import { PersistenceError } from "../../persistence/persistence-error.js";
import type { AccountLifecycleRepository } from "../../persistence/users/account-lifecycle.repository.js";
import type { AccountSessionRevocationGateway } from "../../integrations/supabase/account-lifecycle/account-session-revocation.gateway.js";
import type { AccountDeletionInput, AccountDeletionResult } from "./account-deletion.types.js";

export type AccountDeletionServiceDependencies = {
  lifecycleRepo: AccountLifecycleRepository;
  sessionGateway: AccountSessionRevocationGateway;
};

export class AccountDeletionService {
  constructor(private readonly deps: AccountDeletionServiceDependencies) {}

  public async deleteCurrentAccount(input: AccountDeletionInput): Promise<AccountDeletionResult> {
    const operation = "DELETE:/api/v1/users/me:v1";
    // For this endpoint with no body, the hash can just be empty or static, but we'll hash the operation to be safe
    const requestHash = crypto.createHash("sha256").update(operation).digest("hex");

    let rpcResult;
    try {
      // 1-3. Execute Atomic RPC (Reserve Idempotency, Soft-Delete, Audit, Complete Idempotency)
      rpcResult = await this.deps.lifecycleRepo.executeAtomicSoftDelete({
        userId: input.userId,
        idempotencyKey: input.idempotencyKey,
        requestId: input.requestId,
        requestHash,
        operation,
      });
    } catch (error: unknown) {
      if (PersistenceError.is(error)) {
        // We do not have granular 'RECORD_NOT_FOUND' out of the RPC currently if the user simply didn't exist,
        // but the RPC doesn't fail, it just updates 0 rows.
        // We will assume 503 for all DB failures as before
        throw new AppError({
          statusCode: 503,
          code: "SERVICE_UNAVAILABLE",
          message: "Service is temporarily unavailable.",
        });
      }
      throw error;
    }

    if (rpcResult.status === "conflict") {
      throw new AppError({
        statusCode: 409,
        code: "IDEMPOTENCY_CONFLICT",
        message: "Idempotency key conflict.",
      });
    }

    if (rpcResult.status === "failed") {
      throw new AppError({
        statusCode: 500,
        code: "INTERNAL_SERVER_ERROR",
        message: "Operation previously failed.",
      });
    }

    // Whether "processing", "completed", or "success", we have successfully processed it
    // or it was already completed (idempotency replay).
    // Now we must revoke sessions for safety. We do this even on replay to ensure no stale sessions exist.
    try {
      // 4. Revoke sessions via Supabase Auth Admin API
      await this.deps.sessionGateway.revokeAllUserSessions({
        accessToken: input.accessToken,
        userId: input.userId,
      });
    } catch (error) {
      // Log session revocation failure, but do not fail the soft-deletion response
      // since the DB state is already permanently mutated successfully.
      // A background job or the RLS policies will handle ongoing protections.
      console.warn(`Failed to revoke sessions for user ${input.userId}`, error);
    }

    // Return the response body which contains the success status
    return rpcResult.responseBody as AccountDeletionResult;
  }
}
