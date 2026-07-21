import type { Server } from "node:http";

import { app } from "./app.js";
import { DEFAULT_PORT } from "./constants/application.constants.js";

function resolvePort(rawPort: string | undefined): number {
  if (rawPort === undefined) {
    return DEFAULT_PORT;
  }

  const parsedPort = Number(rawPort);

  if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }

  return parsedPort;
}

const port = resolvePort(process.env.PORT);

const server = startServer();
let isShuttingDown = false;

function startServer(): Server {
  return app.listen(port, () => {
    console.log(`Backend server listening on port ${String(port)}.`);
  });
}

function shutdown(signal: NodeJS.Signals): void {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  console.log(`${signal} received. Starting graceful shutdown.`);

  const forceShutdownTimer = setTimeout(() => {
    console.error("Graceful shutdown timed out.");
    process.exitCode = 1;
    server.closeAllConnections();
  }, 10_000);

  forceShutdownTimer.unref();

  server.close((error) => {
    clearTimeout(forceShutdownTimer);

    if (error !== undefined) {
      console.error("Server shutdown failed.", error);
      process.exitCode = 1;
      return;
    }

    console.log("Backend server stopped.");
    process.exitCode = 0;
  });
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
