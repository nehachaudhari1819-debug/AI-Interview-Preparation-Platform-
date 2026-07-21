import { cookieParserMiddleware } from "../../../src/security/cookie-parser.middleware.js";

describe("cookieParserMiddleware", () => {
  it("is a middleware function", () => {
    expect(typeof cookieParserMiddleware).toBe("function");
  });
});
