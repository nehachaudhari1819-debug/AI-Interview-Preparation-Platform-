import type { ApplicationLifecycleSnapshot, ApplicationLifecycleState } from "./application-lifecycle.types.js";

export type ApplicationLifecycle = {
  getSnapshot(): Readonly<ApplicationLifecycleSnapshot>;
  markReady(): void;
  beginShutdown(reason: string): void;
  markStopped(): void;
  markFailed(reason: string): void;
};

export function createApplicationLifecycle(clock: () => string = () => new Date().toISOString()): ApplicationLifecycle {
  let state: ApplicationLifecycleState = "starting";
  let isReady = false;
  const startedAt = clock();
  let updatedAt = startedAt;
  let shutdownReason: string | undefined = undefined;

  function setSnapshot(newState: ApplicationLifecycleState, ready: boolean, reason?: string) {
    state = newState;
    isReady = ready;
    updatedAt = clock();
    if (reason !== undefined) {
      shutdownReason = reason;
    }
  }

  return {
    getSnapshot() {
      return Object.freeze({
        state,
        ready: isReady,
        startedAt,
        updatedAt,
        ...(shutdownReason !== undefined ? { shutdownReason } : {}),
      });
    },

    markReady() {
      if (state !== "starting") {
        throw new Error(`Invalid transition: ${state} -> ready`);
      }
      setSnapshot("ready", true);
    },

    beginShutdown(reason: string) {
      if (state !== "ready") {
        throw new Error(`Invalid transition: ${state} -> shutting_down`);
      }
      setSnapshot("shutting_down", false, reason);
    },

    markStopped() {
      if (state !== "shutting_down" && state !== "failed") {
        throw new Error(`Invalid transition: ${state} -> stopped`);
      }
      setSnapshot("stopped", false);
    },

    markFailed(reason: string) {
      if (state === "stopped" || state === "failed") {
        throw new Error(`Invalid transition: ${state} -> failed`);
      }
      setSnapshot("failed", false, reason);
    },
  };
}
