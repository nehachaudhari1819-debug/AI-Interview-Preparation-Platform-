import type { Server } from "node:http";

import { createApp } from "./app.js";
import { createSafeConfigSummary, loadApplicationConfig } from "./config/index.js";
import type { ApplicationConfig } from "./config/app-config.js";
import { createHttpServer } from "./server/create-http-server.js";
import { ConfigurationError } from "./errors/configuration.error.js";

export type StartServerOptions = {
  app: ReturnType<typeof createApp>;
  port: number;
  shutdownTimeoutMs: number;
  config: Readonly<ApplicationConfig>;
};

export function startServer(options: StartServerOptions): Server {
  const server = createHttpServer(options.app, options.config);

  server.listen(options.port, () => {
    console.log(`Server listening on port ${String(options.port)}`);
  });

  const gracefulShutdown = (signal: string) => {
    console.log(`${signal} received. Starting graceful shutdown.`);

    const forceShutdownTimer = setTimeout(() => {
      console.error("Graceful shutdown timed out.");
      process.exitCode = 1;
      process.exit();
    }, options.shutdownTimeoutMs);

    forceShutdownTimer.unref();

    server.closeAllConnections();
    server.close((error) => {
      clearTimeout(forceShutdownTimer);
      if (error) {
        console.error("Error during server closure:", error);
        process.exitCode = 1;
      } else {
        console.log("Server closed successfully.");
        process.exitCode = 0;
      }
    });
  };

  process.on("SIGTERM", () => {
    gracefulShutdown("SIGTERM");
  });
  process.on("SIGINT", () => {
    gracefulShutdown("SIGINT");
  });

  return server;
}

function bootstrap(): void {
  try {
    const config = loadApplicationConfig();
    const safeSummary = createSafeConfigSummary(config);

    const app = createApp({ config });

    console.log("Starting backend application.", safeSummary);

    startServer({
      app,
      port: config.runtime.port,
      shutdownTimeoutMs: config.runtime.shutdownTimeoutMs,
      config,
    });
  } catch (error: unknown) {
    if (error instanceof ConfigurationError) {
      console.error("Application configuration is invalid.", { issues: error.issues });
    } else {
      console.error("Backend startup failed unexpectedly.");
    }
    process.exitCode = 1;
  }
}

// Only bootstrap if not in test environment
if (process.env.NODE_ENV !== "test") {
  bootstrap();
}
