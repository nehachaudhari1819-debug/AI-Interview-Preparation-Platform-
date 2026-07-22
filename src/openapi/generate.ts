import fs from "node:fs";
import path from "node:path";
import assert from "node:assert";
import { fileURLToPath, pathToFileURL } from "node:url";
import { openApiDocument } from "./openapi-document.js";

const isMainModule = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const targetDir = path.resolve(__dirname, "../../docs/backend/openapi");
const targetFile = path.join(targetDir, "openapi.json");

function generateJson(): string {
  // Deterministic JSON stringification
  return JSON.stringify(openApiDocument, null, 2) + "\n";
}

export function writeDocument() {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const content = generateJson();
  fs.writeFileSync(targetFile, content, "utf-8");
  if (isMainModule) {
    console.log(`OpenAPI document generated at ${targetFile}`);
  }
}

export function checkDocument() {
  if (!fs.existsSync(targetFile)) {
    throw new Error("OpenAPI document does not exist. Run 'npm run openapi:generate' first.");
  }

  const existingContent = fs.readFileSync(targetFile, "utf-8");
  const newContent = generateJson();

  try {
    assert.deepStrictEqual(JSON.parse(existingContent), JSON.parse(newContent));
  } catch {
    throw new Error(
      "OpenAPI document is out of date. Run 'npm run openapi:generate' to update it.",
    );
  }
}

if (isMainModule) {
  const args = process.argv.slice(2);
  if (args.includes("--write")) {
    writeDocument();
  } else if (args.includes("--check")) {
    try {
      checkDocument();
      console.log("OpenAPI document is up to date.");
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error(err.message);
      } else {
        console.error(String(err));
      }
      process.exit(1);
    }
  } else {
    console.log("Usage: tsx generate.ts [--write | --check]");
    process.exit(1);
  }
}
