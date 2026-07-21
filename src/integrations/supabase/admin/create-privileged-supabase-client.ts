import { createClient } from "@supabase/supabase-js";
import type { ApplicationConfig } from "../../../config/app-config.js";
import { requireSupabaseConfig } from "../require-supabase-config.js";
import { createServerAuthOptions } from "../supabase-client-options.js";
import type {
  ProjectSupabaseClient,
  SupabaseClientFactoryDependencies,
} from "../supabase-client.types.js";

export type CreatePrivilegedSupabaseClientOptions = {
  config: Readonly<ApplicationConfig>;
  dependencies?: Partial<SupabaseClientFactoryDependencies>;
};

export function createPrivilegedSupabaseClient(
  options: CreatePrivilegedSupabaseClientOptions,
): ProjectSupabaseClient {
  const config = requireSupabaseConfig(options.config);
  const clientFactory = options.dependencies?.createClient ?? createClient;

  // Uses privilegedKey (which was validated by environment parser to be either SECRET or SERVICE_ROLE)
  return clientFactory(config.url, config.privilegedKey, {
    ...createServerAuthOptions(),
  }) as ProjectSupabaseClient;
}
