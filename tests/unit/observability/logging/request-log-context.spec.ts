import { jest } from "@jest/globals";
import { requestLogContext } from "../../../../src/observability/logging/request-log-context.js";

describe("Request Log Context", () => {
  it("provides undefined outside of run scope", () => {
    expect(requestLogContext.getStore()).toBeUndefined();
  });

  it("provides the bound request context within scope", () => {
    const store = { requestId: "test-id" };
    requestLogContext.run(store, () => {
      expect(requestLogContext.getStore()).toBe(store);
      expect(requestLogContext.getStore()?.requestId).toBe("test-id");
    });
  });

  it("isolates separate asynchronous executions", async () => {
    const p1 = new Promise<void>((resolve) => {
      requestLogContext.run({ requestId: "id-1" }, async () => {
        await new Promise(r => setTimeout(r, 10));
        expect(requestLogContext.getStore()?.requestId).toBe("id-1");
        resolve();
      });
    });

    const p2 = new Promise<void>((resolve) => {
      requestLogContext.run({ requestId: "id-2" }, async () => {
        await new Promise(r => setTimeout(r, 5));
        expect(requestLogContext.getStore()?.requestId).toBe("id-2");
        resolve();
      });
    });

    await Promise.all([p1, p2]);
  });
});
