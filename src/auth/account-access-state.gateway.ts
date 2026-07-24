import type { AccountAccessState } from "./account-access-state.types.js";

export interface AccountAccessStateGateway {
  getCurrentAccountAccessState(): Promise<AccountAccessState>;
}
