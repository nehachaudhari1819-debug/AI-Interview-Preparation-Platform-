import { jest } from "@jest/globals";
import {
  createApplicationLifecycle,
  type ApplicationLifecycle,
} from "../../../../src/observability/lifecycle/application-lifecycle.js";

describe("Application Lifecycle", () => {
  it("initializes in starting state", () => {
    const lifecycle = createApplicationLifecycle();
    const snap = lifecycle.getSnapshot();
    expect(snap.state).toBe("starting");
    expect(snap.ready).toBe(false);
  });

  it("transitions to ready", () => {
    const lifecycle = createApplicationLifecycle();
    lifecycle.markReady();
    const snap = lifecycle.getSnapshot();
    expect(snap.state).toBe("ready");
    expect(snap.ready).toBe(true);
  });

  it("transitions to shutting_down then stopped", () => {
    const lifecycle = createApplicationLifecycle();
    lifecycle.markReady();

    lifecycle.beginShutdown("test_reason");

    expect(lifecycle.getSnapshot().state).toBe("shutting_down");
    expect(lifecycle.getSnapshot().ready).toBe(false);

    lifecycle.markStopped();
    expect(lifecycle.getSnapshot().state).toBe("stopped");
  });

  it("transitions to failed", () => {
    const lifecycle = createApplicationLifecycle();
    lifecycle.markFailed("test_failure");
    expect(lifecycle.getSnapshot().state).toBe("failed");
    expect(lifecycle.getSnapshot().ready).toBe(false);
  });
});
