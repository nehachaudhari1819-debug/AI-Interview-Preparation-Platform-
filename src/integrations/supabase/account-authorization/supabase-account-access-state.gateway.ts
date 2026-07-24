import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../persistence/database.types.js";
import type { AccountAccessStateGateway } from "../../../auth/account-access-state.gateway.js";
import type { AccountAccessState } from "../../../auth/account-access-state.types.js";
import { accountAccessStateSchema } from "../../../auth/account-access-state.schema.js";

export class SupabaseAccountAccessStateGateway implements AccountAccessStateGateway {
  private readonly supabaseClient: SupabaseClient<Database>;

  public constructor(supabaseClient: SupabaseClient<Database>) {
    this.supabaseClient = supabaseClient;
  }

  public async getCurrentAccountAccessState(): Promise<AccountAccessState> {
    const { data, error } = await this.supabaseClient.rpc("get_current_account_access_state");

    if (error) {
      throw new Error(`Account state resolution failed: ${error.message}`);
    }

    const parseResult = accountAccessStateSchema.safeParse(data);
    
    if (!parseResult.success) {
      // Unknown or malformed state -> missing
      return "missing";
    }

    return parseResult.data;
  }
}
