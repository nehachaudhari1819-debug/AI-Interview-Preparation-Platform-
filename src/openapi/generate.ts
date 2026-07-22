import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openApiDocument } from "./openapi-document.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const targetDir = path.resolve(__dirname, "../../docs/backend/openapi");
const targetFile = path.join(targetDir, "openapi.json");

function generateJson(): string {
  // Deterministic JSON stringification
  return JSON.stringify(openApiDocument, null, 2) + "\n";
}

function writeDocument() {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const content = generateJson();
  fs.writeFileSync(targetFile, content, "utf-8");
  console.log(`OpenAPI document generated at ${targetFile}`);
}

function checkDocument() {
  if (!fs.existsSync(targetFile)) {
    console.error("OpenAPI document does not exist. Run 'npm run openapi:generate' first.");
    process.exit(1);
  }

  const existingContent = fs.readFileSync(targetFile, "utf-8");
  const newContent = generateJson();

  if (existingContent !== newContent) {
    console.error("OpenAPI document is out of date. Run 'npm run openapi:generate' to update it.");
    process.exit(1);
  }

  console.log("OpenAPI document is up to date.");
}

const args = process.argv.slice(2);
if (args.includes("--write")) {
  writeDocument();
} else if (args.includes("--check")) {
  checkDocument();
} else {
  console.log("Usage: tsx generate.ts [--write | --check]");
  process.exit(1);
}
