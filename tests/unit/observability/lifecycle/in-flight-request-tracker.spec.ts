import { jest } from "@jest/globals";
import { createInFlightRequestTracker } from "../../../../src/observability/lifecycle/in-flight-request-tracker.js";

describe("In-Flight Request Tracker", () => {
  it("tracks requests correctly", () => {
    const tracker = createInFlightRequestTracker();
    expect(tracker.getCount()).toBe(0);
    
    tracker.increment();
    expect(tracker.getCount()).toBe(1);
    
    tracker.decrement();
    expect(tracker.getCount()).toBe(0);
  });

  it("resolves immediately if count is 0", async () => {
    const tracker = createInFlightRequestTracker();
    await tracker.waitForZero();
  });

  it("waits for requests to drain", async () => {
    const tracker = createInFlightRequestTracker();
    tracker.increment();
    
    let resolved = false;
    const p = tracker.waitForZero().then(() => resolved = true);
    
    await new Promise(r => setTimeout(r, 10));
    expect(resolved).toBe(false);
    
    tracker.decrement();
    await p;
    expect(resolved).toBe(true);
  });
});
