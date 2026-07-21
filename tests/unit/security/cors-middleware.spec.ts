import { createCorsMiddleware } from "../../../src/security/create-cors-middleware.js";
import { createTestApplicationConfig } from "../../setup/test-helpers.js";

describe("createCorsMiddleware", () => {
  it("returns a middleware function", () => {
    const config = createTestApplicationConfig();
    const middleware = createCorsMiddleware(config);
    expect(typeof middleware).toBe("function");
  });
});
