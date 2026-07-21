export const NODE_ENVIRONMENTS = ["development", "test", "production"] as const;

export type NodeEnvironment = (typeof NODE_ENVIRONMENTS)[number];

export const AI_PROVIDERS = ["gemini", "openai"] as const;

export type AiProvider = (typeof AI_PROVIDERS)[number];

export const COOKIE_SAME_SITE_VALUES = ["lax", "strict", "none"] as const;

export type CookieSameSite = (typeof COOKIE_SAME_SITE_VALUES)[number];

export const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];
