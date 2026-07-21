import type { ValidatedEnvironment } from "./environment-schema.js";
import type { AiProvider, CookieSameSite, LogLevel, NodeEnvironment } from "./environment.types.js";
import { loadEnvironment, type LoadEnvironmentOptions } from "./environment-loader.js";
import { deepFreeze } from "../utils/deep-freeze.js";
import { ConfigurationError } from "../errors/configuration.error.js";

export type ApplicationConfig = {
  runtime: {
    nodeEnv: NodeEnvironment;
    isDevelopment: boolean;
    isTest: boolean;
    isProduction: boolean;
    port: number;
    shutdownTimeoutMs: number;
  };
  frontend: {
    origin: string;
  };
  supabase: {
    configured: boolean;
    url?: string;
    publishableKey?: string;
    serviceRoleKey?: string;
  };
  ai: {
    provider: AiProvider;
    geminiApiKey?: string;
    openAiApiKey?: string;
  };
  storage: {
    resumeBucket: string;
  };
  cookies: {
    secure: boolean;
    sameSite: CookieSameSite;
  };
  logging: {
    level: LogLevel;
  };
};

export function createApplicationConfig(environment: ValidatedEnvironment): ApplicationConfig {
  const supabase =
    environment.SUPABASE_URL === undefined ||
    environment.SUPABASE_PUBLISHABLE_KEY === undefined ||
    environment.SUPABASE_SERVICE_ROLE_KEY === undefined
      ? { configured: false as const }
      : {
          configured: true as const,
          url: environment.SUPABASE_URL,
          publishableKey: environment.SUPABASE_PUBLISHABLE_KEY,
          serviceRoleKey: environment.SUPABASE_SERVICE_ROLE_KEY,
        };

  return {
    runtime: {
      nodeEnv: environment.NODE_ENV,
      isDevelopment: environment.NODE_ENV === "development",
      isTest: environment.NODE_ENV === "test",
      isProduction: environment.NODE_ENV === "production",
      port: environment.PORT,
      shutdownTimeoutMs: environment.SHUTDOWN_TIMEOUT_MS,
    },
    frontend: {
      origin: new URL(environment.FRONTEND_URL).origin,
    },
    supabase,
    ai: {
      provider: environment.AI_PROVIDER,
      ...(environment.GEMINI_API_KEY === undefined
        ? {}
        : { geminiApiKey: environment.GEMINI_API_KEY }),
      ...(environment.OPENAI_API_KEY === undefined
        ? {}
        : { openAiApiKey: environment.OPENAI_API_KEY }),
    },
    storage: {
      resumeBucket: environment.RESUME_BUCKET,
    },
    cookies: {
      secure: environment.COOKIE_SECURE,
      sameSite: environment.COOKIE_SAME_SITE,
    },
    logging: {
      level: environment.LOG_LEVEL,
    },
  };
}

export function loadApplicationConfig(
  options?: LoadEnvironmentOptions,
): Readonly<ApplicationConfig> {
  const validEnvironment = loadEnvironment(options);
  const config = createApplicationConfig(validEnvironment);
  return deepFreeze(config);
}

export function requireSupabaseConfig(config: Readonly<ApplicationConfig>) {
  if (
    !config.supabase.configured ||
    !config.supabase.url ||
    !config.supabase.publishableKey ||
    !config.supabase.serviceRoleKey
  ) {
    throw new ConfigurationError([
      { variable: "supabase", message: "Supabase configuration is required for this module." },
    ]);
  }

  return {
    url: config.supabase.url,
    publishableKey: config.supabase.publishableKey,
    serviceRoleKey: config.supabase.serviceRoleKey,
  };
}
