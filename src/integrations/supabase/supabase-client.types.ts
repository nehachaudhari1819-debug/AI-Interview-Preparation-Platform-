import type { createClient, SupabaseClient, SupabaseClientOptions } from "@supabase/supabase-js";

export type ProjectSupabaseClient = SupabaseClient;

export type SupabaseCreateClient = typeof createClient;

export type SupabaseClientFactoryDependencies = {
  createClient: SupabaseCreateClient;
};

export type SupabaseServerClientOptions = SupabaseClientOptions<"public">;
