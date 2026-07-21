import { app } from "./app.js";

const DEFAULT_PORT = 5000;
const rawPort = process.env.PORT;
const port = rawPort === undefined ? DEFAULT_PORT : Number.parseInt(rawPort, 10);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

const server = app.listen(port, () => {
  console.log(`Backend server listening on port ${String(port)}.`);
});

function shutdown(signal: NodeJS.Signals): void {
  console.log(`${signal} received. Shutting down.`);

  server.close((error) => {
    if (error) {
      console.error("Server shutdown failed.", error);
      process.exitCode = 1;
      return;
    }

    process.exitCode = 0;
  });
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
