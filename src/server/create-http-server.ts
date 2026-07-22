import { createServer, type Server } from "node:http";
import type { Express } from "express";
import type { ApplicationConfig } from "../config/app-config.js";

export function createHttpServer(app: Express, config: Readonly<ApplicationConfig>): Server {
  const server = createServer(app);

  server.requestTimeout = config.httpServer.requestTimeoutMs;
  server.headersTimeout = config.httpServer.headersTimeoutMs;
  server.keepAliveTimeout = config.httpServer.keepAliveTimeoutMs;
  server.maxHeadersCount = config.httpServer.maxHeadersCount;

  return server;
}
