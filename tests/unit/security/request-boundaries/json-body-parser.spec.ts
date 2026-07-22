import { createJsonBodyParser } from "../../../../src/security/request-boundaries/create-json-body-parser.js";
import { createTestApplicationConfig } from "../../../setup/test-helpers.js";

describe("createJsonBodyParser", () => {
  it("should return a middleware function", () => {
    const config = createTestApplicationConfig();
    const parser = createJsonBodyParser(config);
    expect(typeof parser).toBe("function");
  });
});
