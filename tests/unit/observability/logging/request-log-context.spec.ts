import { jest } from "@jest/globals";
import {
  runWithRequestLogContext,
  getRequestLogContext,
} from "../../../../src/observability/logging/request-log-context.js";

describe("Request Log Context", () => {
  it("provides undefined outside of run scope", () => {
    expect(getRequestLogContext()).toBeUndefined();
  });

  it("provides the bound request context within scope", () => {
    const store = { requestId: "test-id" } as any;
    runWithRequestLogContext(store, () => {
      expect(getRequestLogContext()).toBe(store);
      expect(getRequestLogContext()?.requestId).toBe("test-id");
    });
  });

  it("isolates separate asynchronous executions", async () => {
    const p1 = new Promise<void>((resolve) => {
      runWithRequestLogContext({ requestId: "id-1" } as any, async () => {
        await new Promise((r) => setTimeout(r, 10));
        expect(getRequestLogContext()?.requestId).toBe("id-1");
        resolve();
      });
    });

    const p2 = new Promise<void>((resolve) => {
      runWithRequestLogContext({ requestId: "id-2" } as any, async () => {
        await new Promise((r) => setTimeout(r, 5));
        expect(getRequestLogContext()?.requestId).toBe("id-2");
        resolve();
      });
    });

    await Promise.all([p1, p2]);
  });
});
