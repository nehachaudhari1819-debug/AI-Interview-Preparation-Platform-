import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("OpenAPI Generation Script", () => {
  it("should be deterministic and not modify the document on second run", () => {
    // Generate document
    const result = spawnSync("npx", ["tsx", "src/openapi/generate.ts", "--write"], {
      encoding: "utf-8",
      cwd: path.resolve(__dirname, "../../../"),
      shell: process.platform === "win32",
    });

    expect(result.status).toBe(0);

    // Verify document exists
    const openapiPath = path.resolve(__dirname, "../../../docs/backend/openapi/openapi.json");
    expect(fs.existsSync(openapiPath)).toBe(true);

    const content = fs.readFileSync(openapiPath, "utf-8");
    expect(content.trim().length).toBeGreaterThan(0);

    // Check that it passes check mode
    const checkResult = spawnSync("npx", ["tsx", "src/openapi/generate.ts", "--check"], {
      encoding: "utf-8",
      cwd: path.resolve(__dirname, "../../../"),
      shell: process.platform === "win32",
    });

    expect(checkResult.status).toBe(0);
  });
});
