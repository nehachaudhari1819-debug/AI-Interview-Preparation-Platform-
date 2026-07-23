import { createClient } from "@supabase/supabase-js";
import type { ApplicationConfig } from "../../config/app-config.js";
import { requireSupabaseConfig } from "./require-supabase-config.js";
import { createServerAuthOptions } from "./supabase-client-options.js";
import type {
  ProjectSupabaseClient,
  SupabaseClientFactoryDependencies,
} from "./supabase-client.types.js";

export type CreatePublicSupabaseClientOptions = {
  config: Readonly<ApplicationConfig>;
  dependencies?: Partial<SupabaseClientFactoryDependencies>;
};

export function createPublicSupabaseClient(
  options: CreatePublicSupabaseClientOptions,
): ProjectSupabaseClient {
  const config = requireSupabaseConfig(options.config);
  const clientFactory = options.dependencies?.createClient ?? createClient;

  return clientFactory(config.url, config.publishableKey, {
    ...createServerAuthOptions(),
  });
}
