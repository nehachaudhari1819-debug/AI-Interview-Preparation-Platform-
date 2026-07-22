import type { ApplicationConfig } from "./app-config.js";
import type {
  AiProvider,
  ClientIpLogMode,
  CookieSameSite,
  LogLevel,
  NodeEnvironment,
} from "./environment.types.js";

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
  logPretty: boolean;
  logHealthRequests: boolean;
  logClientIpMode: ClientIpLogMode;
  serviceName: string;
  appVersion: string;
  gitCommitSha: string;
  shutdownGracePeriodMs: number;
  trustProxyHops: number;
  corsAllowedOriginCount: number;
  rateLimitEnabled: boolean;
  globalRateLimitWindowMs: number;
  globalRateLimitMaxRequests: number;
  authCredentialRateLimitWindowMs: number;
  authCredentialRateLimitMaxRequests: number;
  authSessionRateLimitWindowMs: number;
  authSessionRateLimitMaxRequests: number;
  rateLimitIpv6Subnet: number;
  apiJsonBodyLimitBytes: number;
  apiMaxUrlLength: number;
  apiMaxQueryParameters: number;
  serverRequestTimeoutMs: number;
  serverHeadersTimeoutMs: number;
  serverKeepAliveTimeoutMs: number;
  serverMaxHeadersCount: number;
  hstsEnabled: boolean;
  authRefreshCookieMaxAgeSeconds: number;
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
    logLevel: config.observability.logLevel,
    logPretty: config.observability.pretty,
    logHealthRequests: config.observability.logHealthRequests,
    logClientIpMode: config.observability.clientIpMode,
    serviceName: config.observability.serviceName,
    appVersion: config.observability.appVersion,
    gitCommitSha: config.observability.gitCommitSha,
    shutdownGracePeriodMs: config.observability.shutdownGracePeriodMs,
    trustProxyHops: config.security.trustProxyHops,
    corsAllowedOriginCount: config.security.cors.allowedOrigins.length,
    rateLimitEnabled: config.rateLimits.globalApi.enabled,
    globalRateLimitWindowMs: config.rateLimits.globalApi.windowMs,
    globalRateLimitMaxRequests: config.rateLimits.globalApi.maxRequests,
    authCredentialRateLimitWindowMs: config.rateLimits.authCredentials.windowMs,
    authCredentialRateLimitMaxRequests: config.rateLimits.authCredentials.maxRequests,
    authSessionRateLimitWindowMs: config.rateLimits.authSession.windowMs,
    authSessionRateLimitMaxRequests: config.rateLimits.authSession.maxRequests,
    rateLimitIpv6Subnet: config.rateLimits.ipv6Subnet,
    apiJsonBodyLimitBytes: config.requestBoundaries.jsonBodyLimitBytes,
    apiMaxUrlLength: config.requestBoundaries.maxUrlLength,
    apiMaxQueryParameters: config.requestBoundaries.maxQueryParameters,
    serverRequestTimeoutMs: config.httpServer.requestTimeoutMs,
    serverHeadersTimeoutMs: config.httpServer.headersTimeoutMs,
    serverKeepAliveTimeoutMs: config.httpServer.keepAliveTimeoutMs,
    serverMaxHeadersCount: config.httpServer.maxHeadersCount,
    hstsEnabled: config.security.helmet.enableHsts,
    authRefreshCookieMaxAgeSeconds: config.authSession.refreshCookieMaxAgeSeconds,
  };
}
