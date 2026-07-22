import type { ApplicationLifecycle } from "../../observability/lifecycle/application-lifecycle.js";
import type { ReadonlyDeep } from "type-fest";
import type { SafeConfigSummary } from "../../config/config-summary.js";
import type { ApplicationLogger } from "../../observability/logging/application-logger.types.js";
import { LOG_EVENTS } from "../../observability/logging/logging-events.constants.js";

export type HealthReadinessResponse =
  { status: "ready"; state: string; uptime: number } | { status: "unavailable"; state: string };

export type HealthService = {
  getLiveness(): { status: "ok" };
  getReadiness(clock?: () => number): HealthReadinessResponse;
  getConfig(): ReadonlyDeep<SafeConfigSummary>;
};

export type CreateHealthServiceOptions = {
  lifecycle: ApplicationLifecycle;
  logger: ApplicationLogger;
  configSummary: ReadonlyDeep<SafeConfigSummary>;
};

export function createHealthService({
  lifecycle,
  logger,
  configSummary,
}: CreateHealthServiceOptions): HealthService {
  return {
    getLiveness() {
      return { status: "ok" };
    },
    getReadiness(clock = Date.now) {
      const snapshot = lifecycle.getSnapshot();

      if (snapshot.state !== "ready") {
        logger.warn({
          event: LOG_EVENTS.readinessFailed,
          state: snapshot.state,
          message: "Readiness probe failed. Application is not ready.",
        });

        return {
          status: "unavailable",
          state: snapshot.state,
        };
      }

      // Implicit check: If Supabase wasn't configured properly, the app wouldn't start.
      // But we can assert it based on the validated config.
      if (!configSummary.supabaseConfigured) {
        logger.warn({
          event: LOG_EVENTS.readinessFailed,
          state: snapshot.state,
          message: "Readiness probe failed. Supabase is not configured.",
        });

        return {
          status: "unavailable",
          state: snapshot.state,
        };
      }

      return {
        status: "ready",
        state: snapshot.state,
        uptime: clock() - new Date(snapshot.startedAt).getTime(),
      };
    },
    getConfig() {
      return configSummary;
    },
  };
}
