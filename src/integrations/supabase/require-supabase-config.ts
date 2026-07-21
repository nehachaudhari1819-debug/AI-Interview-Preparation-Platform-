import type { ApplicationConfig, ConfiguredSupabaseConfig } from "../../config/app-config.js";
import { ConfigurationError } from "../../errors/configuration.error.js";

export function requireSupabaseConfig(
  config: Readonly<ApplicationConfig>,
): Readonly<ConfiguredSupabaseConfig> {
  if (!config.supabase.configured) {
    throw new ConfigurationError([
      {
        variable: "SUPABASE_URL",
        message: "Supabase configuration is required for this operation.",
      },
    ]);
  }
  return config.supabase;
}
