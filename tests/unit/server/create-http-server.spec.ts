import { createHttpServer } from "../../../src/server/create-http-server.js";
import { createTestApplicationConfig } from "../../setup/test-helpers.js";
import express from "express";

describe("createHttpServer", () => {
  it("should create server with defensive timeouts", () => {
    const config = createTestApplicationConfig();
    const app = express();
    const server = createHttpServer(app, config);

    expect(server.requestTimeout).toBe(config.httpServer.requestTimeoutMs);
    expect(server.headersTimeout).toBe(config.httpServer.headersTimeoutMs);
    expect(server.keepAliveTimeout).toBe(config.httpServer.keepAliveTimeoutMs);
    expect(server.maxHeadersCount).toBe(config.httpServer.maxHeadersCount);
  });
});
