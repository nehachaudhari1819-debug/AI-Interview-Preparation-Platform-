import type { Server } from "node:http";

import express from "express";
import { createApp } from "./app.js";
import { createSafeConfigSummary, loadApplicationConfig } from "./config/index.js";
import { createHttpServer } from "./server/create-http-server.js";
import { ConfigurationError } from "./errors/configuration.error.js";
import {
  bootstrapObservability,
  LOG_EVENTS,
  type ObservabilitySystem,
} from "./observability/index.js";

export type StartServerOptions = {
  server: Server;
  port: number;
  observability: ObservabilitySystem;
};

export function startServer(options: StartServerOptions): Server {
  const { server, port, observability } = options;

  server.listen(port, () => {
    observability.logger.info({
      event: LOG_EVENTS.applicationReady,
      port,
      message: `Server listening on port ${String(port)}`,
    });
    observability.lifecycle.markReady();
  });

  return server;
}

function bootstrap(): void {
  try {
    const config = loadApplicationConfig();
    const configSummary = createSafeConfigSummary(config);

    const tempApp = express();
    const server = createHttpServer(tempApp, config);

    const observability = bootstrapObservability({ config, server });
    observability.logger.info({
      event: LOG_EVENTS.applicationStarting,
      message: "Starting backend application.",
      config: configSummary,
    });

    const app = createApp({ config, observability, configSummary });

    server.removeAllListeners("request");
    server.on("request", app);

    startServer({
      server,
      port: config.runtime.port,
      observability,
    });
  } catch (error: unknown) {
    if (error instanceof ConfigurationError) {
      console.error("Application configuration is invalid.", { issues: error.issues });
    } else {
      console.error("Backend startup failed unexpectedly.", error);
    }
    process.exitCode = 1;
  }
}

// Only bootstrap if not in test environment
if (process.env.NODE_ENV !== "test") {
  bootstrap();
}
