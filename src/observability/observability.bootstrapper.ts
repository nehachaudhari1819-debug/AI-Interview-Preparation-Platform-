import type { Server } from "node:http";
import type { DestinationStream } from "pino";
import type { ApplicationConfig } from "../config/app-config.js";
import { createApplicationLogger } from "./logging/index.js";
import type { ApplicationLogger } from "./logging/index.js";
import {
  createApplicationLifecycle,
  createGracefulShutdownController,
  createInFlightRequestTracker,
  registerProcessEventHandlers,
} from "./lifecycle/index.js";
import type {
  ApplicationLifecycle,
  GracefulShutdownController,
  InFlightRequestTracker,
} from "./lifecycle/index.js";

export type ObservabilityDependencies = {
  config: Readonly<ApplicationConfig>;
  server: Server;
  destination?: DestinationStream;
};

export type ObservabilitySystem = {
  logger: ApplicationLogger;
  lifecycle: ApplicationLifecycle;
  tracker: InFlightRequestTracker;
  shutdownController: GracefulShutdownController;
  unregisterProcessHandlers: () => void;
};

export function bootstrapObservability({
  config,
  server,
  destination,
}: ObservabilityDependencies): ObservabilitySystem {
  const logger = createApplicationLogger({ config, destination });
  const lifecycle = createApplicationLifecycle();
  const tracker = createInFlightRequestTracker();

  const shutdownController = createGracefulShutdownController({
    server,
    lifecycle,
    tracker,
    logger,
    gracePeriodMs: config.observability.shutdownGracePeriodMs,
  });

  const unregisterProcessHandlers = registerProcessEventHandlers({
    shutdownController,
    lifecycle,
    logger,
  });

  return {
    logger,
    lifecycle,
    tracker,
    shutdownController,
    unregisterProcessHandlers,
  };
}
