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

    let prepareResult;
    try {
      // 1. Prepare Soft Deletion (Lock, Reserve, Delete, Audit)
      prepareResult = await this.deps.lifecycleRepo.prepareSoftDelete({
        userId: input.userId,
        idempotencyKey: input.idempotencyKey,
        requestId: input.requestId,
        requestHash,
        operation,
      });
    } catch (error: unknown) {
      if (PersistenceError.is(error)) {
        throw new AppError({
          statusCode: 503,
          code: "SERVICE_UNAVAILABLE",
          message: "Service is temporarily unavailable.",
        });
      }
      throw error;
    }

    if (prepareResult.status === "conflict") {
      throw new AppError({
        statusCode: 409,
        code: "IDEMPOTENCY_CONFLICT",
        message: "Idempotency key conflict.",
      });
    }

    if (prepareResult.status === "failed") {
      if (prepareResult.reason === "account_suspended") {
        throw new AppError({
          statusCode: 403,
          code: "ACCOUNT_DISABLED",
          message: "Account is suspended.",
        });
      }
      if (
        prepareResult.reason === "account_already_deleted" ||
        prepareResult.reason === "account_deletion_pending"
      ) {
        throw new AppError({
          statusCode: 403,
          code: "ACCOUNT_DELETED",
          message: "Account is already deleted.",
        });
      }
      if (prepareResult.reason === "user_not_found") {
        throw new AppError({
          statusCode: 404,
          code: "USER_NOT_FOUND",
          message: "User not found.",
        });
      }
      throw new AppError({
        statusCode: 500,
        code: "INTERNAL_SERVER_ERROR",
        message: "Operation previously failed.",
      });
    }

    if (prepareResult.status === "completed") {
      // Return the cached successful response
      return prepareResult.responseBody as AccountDeletionResult;
    }

    // At this point, status === "processing" and reason === "session_revocation_required"
    // 2. Revoke sessions via Supabase Auth Admin API
    // We MUST NOT swallow errors here. If this fails, the service throws, leaving the operation in processing.
    await this.deps.sessionGateway.revokeAllUserSessions({
      accessToken: input.accessToken,
      userId: input.userId, // Although gateway might not use it directly in API, it accepts it.
    });

    // 3. Finalize the Soft Deletion
    let finalizeResult;
    try {
      finalizeResult = await this.deps.lifecycleRepo.finalizeSoftDelete({
        userId: input.userId,
        idempotencyKey: input.idempotencyKey,
        operation,
        requestId: input.requestId,
      });
    } catch (error: unknown) {
      if (PersistenceError.is(error)) {
        throw new AppError({
          statusCode: 503,
          code: "SERVICE_UNAVAILABLE",
          message: "Service is temporarily unavailable.",
        });
      }
      throw error;
    }

    if (finalizeResult.status === "completed") {
      return finalizeResult.responseBody as AccountDeletionResult;
    }

    console.error("[DEBUG] fallback error finalizeResult:", finalizeResult);

    // Fallback if finalization somehow failed
    throw new AppError({
      statusCode: 500,
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to finalize account deletion. Result: ${JSON.stringify(finalizeResult)}`,
    });
  }
}
