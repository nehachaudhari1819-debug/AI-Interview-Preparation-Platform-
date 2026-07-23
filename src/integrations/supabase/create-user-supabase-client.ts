import { createClient } from "@supabase/supabase-js";
import type { ApplicationConfig } from "../../config/app-config.js";
import { requireSupabaseConfig } from "./require-supabase-config.js";
import { createServerAuthOptions } from "./supabase-client-options.js";
import type {
  ProjectSupabaseClient,
  SupabaseClientFactoryDependencies,
} from "./supabase-client.types.js";
import {
  SUPABASE_ERROR_CODES,
  SupabaseIntegrationError,
} from "../../errors/supabase-integration.error.js";

export type CreateUserSupabaseClientOptions = {
  config: Readonly<ApplicationConfig>;
  accessToken: string;
  dependencies?: Partial<SupabaseClientFactoryDependencies>;
};

function normalizeAccessToken(token: string): string {
  if (typeof token !== "string") {
    throw new SupabaseIntegrationError({
      code: SUPABASE_ERROR_CODES.INVALID_ACCESS_TOKEN_INPUT,
      message: "Access token must be a string.",
    });
  }

  const trimmed = token.trim();
  if (trimmed === "") {
    throw new SupabaseIntegrationError({
      code: SUPABASE_ERROR_CODES.INVALID_ACCESS_TOKEN_INPUT,
      message: "Access token cannot be empty.",
    });
  }
  if (trimmed.includes("\n") || trimmed.includes("\r")) {
    throw new SupabaseIntegrationError({
      code: SUPABASE_ERROR_CODES.INVALID_ACCESS_TOKEN_INPUT,
      message: "Access token must not contain line breaks.",
    });
  }
  if (trimmed.includes("\0")) {
    throw new SupabaseIntegrationError({
      code: SUPABASE_ERROR_CODES.INVALID_ACCESS_TOKEN_INPUT,
      message: "Access token must not contain null bytes.",
    });
  }
  if (/\s/.test(trimmed)) {
    throw new SupabaseIntegrationError({
      code: SUPABASE_ERROR_CODES.INVALID_ACCESS_TOKEN_INPUT,
      message: "Access token must not contain internal whitespace.",
    });
  }
  if (trimmed.length > 16384) {
    // 16 KiB limit
    throw new SupabaseIntegrationError({
      code: SUPABASE_ERROR_CODES.INVALID_ACCESS_TOKEN_INPUT,
      message: "Access token exceeds maximum allowed length.",
    });
  }

  return trimmed;
}

export function createUserSupabaseClient(
  options: CreateUserSupabaseClientOptions,
): ProjectSupabaseClient {
  const config = requireSupabaseConfig(options.config);
  const normalizedToken = normalizeAccessToken(options.accessToken);
  const clientFactory = options.dependencies?.createClient ?? createClient;

  return clientFactory(config.url, config.publishableKey, {
    ...createServerAuthOptions(),
    global: {
      headers: {
        Authorization: `Bearer ${normalizedToken}`,
      },
    },
  });
}
