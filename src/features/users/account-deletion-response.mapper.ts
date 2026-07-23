import type { AccountDeletionResult } from "./account-deletion.types.js";

export function mapAccountDeletionToResponse(result: AccountDeletionResult) {
  return {
    account: {
      status: result.account.status,
    },
  };
}
