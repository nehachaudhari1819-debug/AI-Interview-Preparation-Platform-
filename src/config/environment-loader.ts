import dotenv from "dotenv";
import { ZodError } from "zod";
import { ConfigurationError, type ConfigurationIssue } from "../errors/configuration.error.js";
import { environmentSchema, type ValidatedEnvironment } from "./environment-schema.js";

export function parseEnvironment(source: Readonly<NodeJS.ProcessEnv>): ValidatedEnvironment {
  try {
    return environmentSchema.parse(source);
  } catch (error) {
    if (error instanceof ZodError) {
      const issues: ConfigurationIssue[] = error.errors.map((err) => {
        const variable = err.path.join(".") || "unknown";
        return {
          variable,
          message: err.message, // Safely returns Zod's generic type message or custom refines, never the raw value
        };
      });
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
