import type { ApplicationConfig } from "./app-config.js";
import type { AiProvider, CookieSameSite, LogLevel, NodeEnvironment } from "./environment.types.js";

export type SafeConfigSummary = {
  nodeEnv: NodeEnvironment;
  port: number;
  shutdownTimeoutMs: number;
  frontendOrigin: string;
  supabaseConfigured: boolean;
  supabasePrivilegedKeyType: "secret" | "legacy_service_role" | null;
  aiProvider: AiProvider;
  geminiConfigured: boolean;
  openAiConfigured: boolean;
  resumeBucket: string;
  cookieSecure: boolean;
  cookieSameSite: CookieSameSite;
  logLevel: LogLevel;
  trustProxyHops: number;
  corsAllowedOriginCount: number;
  rateLimitEnabled: boolean;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  hstsEnabled: boolean;
};

export function createSafeConfigSummary(config: Readonly<ApplicationConfig>): SafeConfigSummary {
  return {
    nodeEnv: config.runtime.nodeEnv,
    port: config.runtime.port,
    shutdownTimeoutMs: config.runtime.shutdownTimeoutMs,
    frontendOrigin: config.frontend.origin,
    supabaseConfigured: config.supabase.configured,
    supabasePrivilegedKeyType: config.supabase.configured
      ? config.supabase.privilegedKeyType
      : null,
    aiProvider: config.ai.provider,
    geminiConfigured: config.ai.geminiApiKey !== undefined,
    openAiConfigured: config.ai.openAiApiKey !== undefined,
    resumeBucket: config.storage.resumeBucket,
    cookieSecure: config.cookies.secure,
    cookieSameSite: config.cookies.sameSite,
    logLevel: config.logging.level,
    trustProxyHops: config.security.trustProxyHops,
    corsAllowedOriginCount: config.security.cors.allowedOrigins.length,
    rateLimitEnabled: config.security.rateLimit.enabled,
    rateLimitWindowMs: config.security.rateLimit.windowMs,
    rateLimitMaxRequests: config.security.rateLimit.maxRequests,
    hstsEnabled: config.security.helmet.enableHsts,
  };
}
