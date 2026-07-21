import type { ValidatedEnvironment } from "./environment-schema.js";
import type { AiProvider, CookieSameSite, LogLevel, NodeEnvironment } from "./environment.types.js";
import { loadEnvironment, type LoadEnvironmentOptions } from "./environment-loader.js";
import { deepFreeze } from "../utils/deep-freeze.js";

export type UnconfiguredSupabaseConfig = {
  configured: false;
};

export type ConfiguredSupabaseConfig = {
  configured: true;
  url: string;
  publishableKey: string;
  privilegedKey: string;
  privilegedKeyType: "secret" | "legacy_service_role";
};

export type SupabaseConfig = UnconfiguredSupabaseConfig | ConfiguredSupabaseConfig;

export type SecurityConfig = {
  trustProxyHops: number;
  cors: {
    allowedOrigins: readonly string[];
    credentials: true;
    preflightMaxAgeSeconds: number;
  };
  rateLimit: {
    enabled: boolean;
    windowMs: number;
    maxRequests: number;
  };
  helmet: {
    enableHsts: boolean;
  };
};

export type AuthSessionConfig = {
  refreshCookieMaxAgeSeconds: number;

  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };

  emailConfirmationRedirectUrl: string;
};

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
  supabase: SupabaseConfig;
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
  security: SecurityConfig;
  authSession: AuthSessionConfig;
};

export function createApplicationConfig(environment: ValidatedEnvironment): ApplicationConfig {
  const isConfigured =
    environment.SUPABASE_URL !== undefined &&
    environment.SUPABASE_PUBLISHABLE_KEY !== undefined &&
    (environment.SUPABASE_SECRET_KEY !== undefined ||
      environment.SUPABASE_SERVICE_ROLE_KEY !== undefined);

  let supabase: SupabaseConfig = { configured: false as const };
  if (isConfigured) {
    const isSecret = environment.SUPABASE_SECRET_KEY !== undefined;
    supabase = {
      configured: true as const,
      url: environment.SUPABASE_URL as string,
      publishableKey: environment.SUPABASE_PUBLISHABLE_KEY as string,
      privilegedKey: isSecret
        ? (environment.SUPABASE_SECRET_KEY as string)
        : (environment.SUPABASE_SERVICE_ROLE_KEY as string),
      privilegedKeyType: isSecret ? "secret" : "legacy_service_role",
    };
  }

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
    security: {
      trustProxyHops: environment.TRUST_PROXY_HOPS,
      cors: {
        allowedOrigins: Object.freeze([new URL(environment.FRONTEND_URL).origin]),
        credentials: true as const,
        preflightMaxAgeSeconds: environment.CORS_PREFLIGHT_MAX_AGE_SECONDS,
      },
      rateLimit: {
        enabled: environment.RATE_LIMIT_ENABLED,
        windowMs: environment.RATE_LIMIT_WINDOW_MS,
        maxRequests: environment.RATE_LIMIT_MAX_REQUESTS,
      },
      helmet: {
        enableHsts: environment.NODE_ENV === "production",
      },
    },
    authSession: {
      refreshCookieMaxAgeSeconds: environment.AUTH_REFRESH_COOKIE_MAX_AGE_SECONDS,
      rateLimit: {
        windowMs: environment.AUTH_RATE_LIMIT_WINDOW_MS,
        maxRequests: environment.AUTH_RATE_LIMIT_MAX_REQUESTS,
      },
      emailConfirmationRedirectUrl: new URL("/auth/callback", environment.FRONTEND_URL).toString(),
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
