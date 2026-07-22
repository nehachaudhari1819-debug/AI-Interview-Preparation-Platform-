import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeDocument, checkDocument } from "../../../src/openapi/generate.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("OpenAPI Generation Script", () => {
  it("should be deterministic and not modify the document on second run", () => {
    // Verify document exists
    const openapiPath = path.resolve(__dirname, "../../../docs/backend/openapi/openapi.json");
    expect(fs.existsSync(openapiPath)).toBe(true);

    const content = fs.readFileSync(openapiPath, "utf-8");
    expect(content.trim().length).toBeGreaterThan(0);

    // Check that it passes check mode
    expect(() => {
      checkDocument();
    }).not.toThrow();
  });
});
