import type { Server } from "node:http";

import { app } from "./app.js";
import { createSafeConfigSummary, loadApplicationConfig } from "./config/index.js";
import { ConfigurationError } from "./errors/configuration.error.js";

export type StartServerOptions = {
  app: typeof app;
  port: number;
  shutdownTimeoutMs: number;
};

export function startServer(options: StartServerOptions): Server {
  const server = options.app.listen(options.port, () => {
    console.log(`Server listening on port ${options.port}`);
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

    console.log("Starting backend application.", safeSummary);

    startServer({
      app,
      port: config.runtime.port,
      shutdownTimeoutMs: config.runtime.shutdownTimeoutMs,
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

// Only bootstrap if run directly, allowing tests to import this file without starting
if (
  (process.argv[1] && process.argv[1].endsWith("server.ts")) ||
  process.argv[1]?.endsWith("server.js")
) {
  bootstrap();
} else {
  // If not run directly, just execute it anyway as this is the entry point
  // We will assume in Jest we mock bootstrap or don't import server.ts.
  // Wait, let's just always bootstrap because tsx src/server.ts runs it directly.
  bootstrap();
}
