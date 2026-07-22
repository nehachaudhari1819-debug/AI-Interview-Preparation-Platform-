import * as dotenv from "dotenv";

import { ConfigurationError, type ConfigurationIssue } from "../errors/configuration.error.js";
import { environmentSchema, type ValidatedEnvironment } from "./environment-schema.js";

export function parseEnvironment(source: Readonly<NodeJS.ProcessEnv>): ValidatedEnvironment {
  try {
    return environmentSchema.parse(source);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      const zodErr = error as unknown as {
        issues: Array<{ path: (string | number)[]; message: string }>;
      };
      const issues: ConfigurationIssue[] = zodErr.issues.map((err) => {
        const variable = err.path.join(".") || "unknown";
        return {
          variable,
          message: err.message,
        };
      });
      console.error("Configuration validation failed with issues:", JSON.stringify(issues, null, 2));
      throw new ConfigurationError(issues);
    }
    throw error;
  }
}

export type LoadEnvironmentOptions = {
  envFilePath?: string;
  loadEnvFile?: boolean;
  source?: NodeJS.ProcessEnv;
};

export function loadEnvironment(options: LoadEnvironmentOptions = {}): ValidatedEnvironment {
  const loadFile = options.loadEnvFile ?? true;
  const envFilePath = options.envFilePath ?? ".env";
  const source = options.source ?? process.env;

  let loadedEnv: Record<string, string | undefined> = {};

  if (loadFile) {
    const result = dotenv.config({ path: envFilePath });
    if (result.error) {
      // If the error is just that the file is not found, we ignore it if host vars are provided
      if ((result.error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw new ConfigurationError([
          { variable: "dotenv", message: "Failed to read environment file unexpectedly." },
        ]);
      }
    } else if (result.parsed) {
      loadedEnv = result.parsed;
    }
  }

  // Source overrides loaded file, which respects existing OS environment
  const mergedEnv = { ...loadedEnv, ...source };

  return parseEnvironment(mergedEnv);
}
