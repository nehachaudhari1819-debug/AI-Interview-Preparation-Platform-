import pino from "pino";
import type { DestinationStream, Logger, LoggerOptions } from "pino";
import type { ApplicationConfig } from "../../config/app-config.js";
import { LOG_REDACTION_PATHS } from "./logging-redaction.constants.js";

export type CreateApplicationLoggerOptions = {
  config: Readonly<ApplicationConfig>;
  destination?: DestinationStream;
};

export function createApplicationLogger({
  config,
  destination,
}: CreateApplicationLoggerOptions): Logger {
  const options: LoggerOptions = {
    level: config.observability.logLevel,
    base: {
      service: config.observability.serviceName,
      environment: config.runtime.nodeEnv,
      version: config.observability.appVersion,
      commitSha: config.observability.gitCommitSha,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: LOG_REDACTION_PATHS,
      censor: "[REDACTED]",
    },
  };

  if (destination) {
    return pino(options, destination);
  }

  if (config.runtime.nodeEnv === "development" && config.observability.pretty) {
    return pino({
      ...options,
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          singleLine: false,
          ignore: "pid,hostname",
        },
      },
    });
  }

  return pino(options);
}
