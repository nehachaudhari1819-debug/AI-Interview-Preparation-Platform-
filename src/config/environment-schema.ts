import { z } from "zod";
import { emptyStringToUndefined, parseBoolean, parseInteger } from "./environment-parsers.js";
import {
  AI_PROVIDERS,
  COOKIE_SAME_SITE_VALUES,
  LOG_LEVELS,
  NODE_ENVIRONMENTS,
} from "./environment.types.js";

const urlSchema = z
  .string()
  .regex(/^https?:\/\//)
  .refine(
    (url: string) => {
      try {
        const parsed = new URL(url);
        return parsed.username === "" && parsed.password === "";
      } catch {
        return false;
      }
    },
    { message: "URL must not contain embedded credentials." },
  );

const environmentBaseSchema = z.object({
  NODE_ENV: z.enum(NODE_ENVIRONMENTS).default("development"),
  PORT: z.preprocess(parseInteger, z.number().int().min(1).max(65535).default(5000)),
  SHUTDOWN_TIMEOUT_MS: z.preprocess(
    parseInteger,
    z.number().int().min(1000).max(60000).default(10000),
  ),
  FRONTEND_URL: urlSchema.refine(
    (url: string) => url.startsWith("http:") || url.startsWith("https:"),
    {
      message: "FRONTEND_URL must use http or https protocol.",
    },
  ),

  // Supabase
  SUPABASE_URL: z.preprocess(emptyStringToUndefined, urlSchema.optional()),
  SUPABASE_PUBLISHABLE_KEY: z.preprocess(emptyStringToUndefined, z.string().min(1).optional()),
  SUPABASE_SECRET_KEY: z.preprocess(emptyStringToUndefined, z.string().min(1).optional()),
  SUPABASE_SERVICE_ROLE_KEY: z.preprocess(emptyStringToUndefined, z.string().min(1).optional()),

  // AI
  AI_PROVIDER: z.enum(AI_PROVIDERS).default("gemini"),
  GEMINI_API_KEY: z.preprocess(emptyStringToUndefined, z.string().min(1).optional()),
  OPENAI_API_KEY: z.preprocess(emptyStringToUndefined, z.string().min(1).optional()),

  // Storage
  RESUME_BUCKET: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-_]*[a-z0-9]$/, {
      message:
        "Bucket name must start and end with a letter/number and contain only lowercase letters, numbers, hyphens, and underscores.",
    })
    .max(63)
    .default("resumes"),

  // Cookies
  COOKIE_SECURE: z.preprocess(parseBoolean, z.boolean().default(false)),
  COOKIE_SAME_SITE: z.enum(COOKIE_SAME_SITE_VALUES).default("lax"),

  // Logging
  LOG_LEVEL: z.enum(LOG_LEVELS).default("info"),

  // Security
  TRUST_PROXY_HOPS: z.preprocess(parseInteger, z.number().int().min(0).max(5).default(0)),
  RATE_LIMIT_ENABLED: z.preprocess(parseBoolean, z.boolean().default(true)),
  RATE_LIMIT_WINDOW_MS: z.preprocess(
    parseInteger,
    z.number().int().min(1000).max(3600000).default(60000),
  ),
  RATE_LIMIT_MAX_REQUESTS: z.preprocess(
    parseInteger,
    z.number().int().min(1).max(10000).default(100),
  ),
  CORS_PREFLIGHT_MAX_AGE_SECONDS: z.preprocess(
    parseInteger,
    z.number().int().min(0).max(86400).default(600),
  ),
});

type EnvironmentBase = z.infer<typeof environmentBaseSchema>;

export const environmentSchema = environmentBaseSchema.superRefine(
  (val: EnvironmentBase, ctx: z.RefinementCtx) => {
    // Production secure cookies
    if (val.NODE_ENV === "production" && !val.COOKIE_SECURE) {
      ctx.addIssue({
        code: "custom",
        path: ["COOKIE_SECURE"],
        message: "COOKIE_SECURE must be true when NODE_ENV=production.",
      });
    }

    // SameSite none requires secure cookies
    if (val.COOKIE_SAME_SITE === "none" && !val.COOKIE_SECURE) {
      ctx.addIssue({
        code: "custom",
        path: ["COOKIE_SAME_SITE"],
        message: "COOKIE_SAME_SITE=none requires COOKIE_SECURE=true.",
      });
    }

    // Supabase completeness and exact key combination
    const hasUrl = val.SUPABASE_URL !== undefined;
    const hasPublishable = val.SUPABASE_PUBLISHABLE_KEY !== undefined;
    const hasSecret = val.SUPABASE_SECRET_KEY !== undefined;
    const hasServiceRole = val.SUPABASE_SERVICE_ROLE_KEY !== undefined;

    const hasAnySupabase = hasUrl || hasPublishable || hasSecret || hasServiceRole;

    if (hasAnySupabase) {
      if (!hasUrl || !hasPublishable) {
        ctx.addIssue({
          code: "custom",
          path: [!hasUrl ? "SUPABASE_URL" : "SUPABASE_PUBLISHABLE_KEY"],
          message: "Supabase configuration must be fully provided or entirely absent.",
        });
      }

      if (hasSecret && hasServiceRole) {
        ctx.addIssue({
          code: "custom",
          path: ["SUPABASE_SERVICE_ROLE_KEY"],
          message:
            "Provide exactly one privileged key: either SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY.",
        });
      } else if (!hasSecret && !hasServiceRole) {
        ctx.addIssue({
          code: "custom",
          path: ["SUPABASE_SECRET_KEY"],
          message:
            "A privileged key is required. Provide exactly one of SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY.",
        });
      }
    }
  },
);

export type ValidatedEnvironment = z.infer<typeof environmentSchema>;
