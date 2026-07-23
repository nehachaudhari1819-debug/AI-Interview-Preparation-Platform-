import type { createClient, SupabaseClient, SupabaseClientOptions } from "@supabase/supabase-js";

import type { Database } from "../../persistence/database.types.js";

export type ProjectSupabaseClient = SupabaseClient<Database>;

export type SupabaseCreateClient = typeof createClient;

export type SupabaseClientFactoryDependencies = {
  createClient: SupabaseCreateClient;
};

export type SupabaseServerClientOptions = SupabaseClientOptions<"public">;
