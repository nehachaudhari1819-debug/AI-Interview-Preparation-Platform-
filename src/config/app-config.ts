import type { ValidatedEnvironment } from "./environment-schema.js";
import type { AiProvider, ClientIpLogMode, CookieSameSite, LogLevel, NodeEnvironment } from "./environment.types.js";
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

export type RateLimitPolicyConfig = {
  enabled: boolean;
  windowMs: number;
  maxRequests: number;
};

export type RateLimitSecurityConfig = {
  ipv6Subnet: number;
  globalApi: RateLimitPolicyConfig;
  authCredentials: RateLimitPolicyConfig;
  authSession: RateLimitPolicyConfig;
};

export type RequestBoundaryConfig = {
  jsonBodyLimitBytes: number;
  maxUrlLength: number;
  maxQueryParameters: number;
};

export type HttpServerSecurityConfig = {
  requestTimeoutMs: number;
  headersTimeoutMs: number;
  keepAliveTimeoutMs: number;
  maxHeadersCount: number;
};

export type SecurityConfig = {
  trustProxyHops: number;
  cors: {
    allowedOrigins: readonly string[];
    credentials: true;
    preflightMaxAgeSeconds: number;
  };
  helmet: {
    enableHsts: boolean;
  };
};

export type AuthSessionConfig = {
  refreshCookieMaxAgeSeconds: number;

  emailConfirmationRedirectUrl: string;
};

export type ObservabilityConfig = {
  logLevel: LogLevel;
  pretty: boolean;
  logHealthRequests: boolean;
  clientIpMode: ClientIpLogMode;
  clientIpHashKey?: string;
  serviceName: "ai-interview-preparation-platform-backend";
  appVersion: string;
  gitCommitSha: string;
  shutdownGracePeriodMs: number;
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
  observability: Readonly<ObservabilityConfig>;
  security: SecurityConfig;
  rateLimits: Readonly<RateLimitSecurityConfig>;
  requestBoundaries: Readonly<RequestBoundaryConfig>;
  httpServer: Readonly<HttpServerSecurityConfig>;
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
    observability: {
      logLevel: environment.LOG_LEVEL,
      pretty: environment.LOG_PRETTY ?? environment.NODE_ENV === "development",
      logHealthRequests: environment.LOG_HEALTH_REQUESTS,
      clientIpMode: environment.LOG_CLIENT_IP_MODE,
      ...(environment.LOG_CLIENT_IP_HASH_KEY !== undefined ? { clientIpHashKey: environment.LOG_CLIENT_IP_HASH_KEY } : {}),
      serviceName: "ai-interview-preparation-platform-backend",
      appVersion: environment.APP_VERSION,
      gitCommitSha: environment.GIT_COMMIT_SHA,
      shutdownGracePeriodMs: environment.SHUTDOWN_GRACE_PERIOD_MS,
    },
    security: {
      trustProxyHops: environment.TRUST_PROXY_HOPS,
      cors: {
        allowedOrigins: Object.freeze([new URL(environment.FRONTEND_URL).origin]),
        credentials: true as const,
        preflightMaxAgeSeconds: environment.CORS_PREFLIGHT_MAX_AGE_SECONDS,
      },
      helmet: {
        enableHsts: environment.NODE_ENV === "production",
      },
    },
    rateLimits: {
      ipv6Subnet: environment.RATE_LIMIT_IPV6_SUBNET,
      globalApi: {
        enabled: environment.RATE_LIMIT_ENABLED,
        windowMs: environment.RATE_LIMIT_WINDOW_MS,
        maxRequests: environment.RATE_LIMIT_MAX_REQUESTS,
      },
      authCredentials: {
        enabled: environment.RATE_LIMIT_ENABLED,
        windowMs: environment.AUTH_RATE_LIMIT_WINDOW_MS,
        maxRequests: environment.AUTH_RATE_LIMIT_MAX_REQUESTS,
      },
      authSession: {
        enabled: environment.RATE_LIMIT_ENABLED,
        windowMs: environment.AUTH_SESSION_RATE_LIMIT_WINDOW_MS,
        maxRequests: environment.AUTH_SESSION_RATE_LIMIT_MAX_REQUESTS,
      },
    },
    requestBoundaries: {
      jsonBodyLimitBytes: environment.API_JSON_BODY_LIMIT_BYTES,
      maxUrlLength: environment.API_MAX_URL_LENGTH,
      maxQueryParameters: environment.API_MAX_QUERY_PARAMETERS,
    },
    httpServer: {
      requestTimeoutMs: environment.SERVER_REQUEST_TIMEOUT_MS,
      headersTimeoutMs: environment.SERVER_HEADERS_TIMEOUT_MS,
      keepAliveTimeoutMs: environment.SERVER_KEEP_ALIVE_TIMEOUT_MS,
      maxHeadersCount: environment.SERVER_MAX_HEADERS_COUNT,
    },
    authSession: {
      refreshCookieMaxAgeSeconds: environment.AUTH_REFRESH_COOKIE_MAX_AGE_SECONDS,
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
