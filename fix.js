const fs = require("fs");
const path = require("path");

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, "utf8");
  content = content.replace(/\.\.\/\.\.\/src/g, "../../../src");
  fs.writeFileSync(filePath, content);
}

const files = [
  "tests/features/auth/auth-api.integration.spec.ts",
  "tests/features/auth/auth-cookie.spec.ts",
  "tests/features/auth/auth-rate-limit.spec.ts",
  "tests/features/auth/auth-request.schemas.spec.ts",
  "tests/features/auth/auth-response.mapper.spec.ts",
  "tests/features/auth/auth.controller.spec.ts",
  "tests/features/auth/auth.service.spec.ts",
  "tests/features/auth/supabase-auth-error-normalizer.spec.ts",
  "tests/features/auth/supabase-auth-gateway.spec.ts",
];

files.forEach((f) => replaceInFile(path.join(__dirname, f)));
console.log("Fixed imports in " + files.length + " files.");

// Also fix authSession in test-helpers.ts
const helpersPath = path.join(__dirname, "tests/setup/test-helpers.ts");
let helpers = fs.readFileSync(helpersPath, "utf8");
if (!helpers.includes("authSession:")) {
  helpers = helpers.replace(
    "supabase: {",
    'authSession: {\n      cookieName: "sb-auth",\n      cookieSecret: "test-secret",\n      cookieDomain: "localhost",\n      secure: false,\n      sameSite: "lax",\n    },\n    supabase: {',
  );
  fs.writeFileSync(helpersPath, helpers);
  console.log("Fixed authSession in test-helpers.ts");
}

// Fix authSession in config-summary.spec.ts
const summaryPath = path.join(__dirname, "tests/unit/config-summary.spec.ts");
let summary = fs.readFileSync(summaryPath, "utf8");
if (!summary.includes("authSession:")) {
  summary = summary.replace(
    "supabase: {",
    'authSession: {\n        cookieName: "sb-auth",\n        cookieSecret: "test-secret",\n        cookieDomain: "localhost",\n        secure: false,\n        sameSite: "lax",\n      },\n      supabase: {',
  );
  fs.writeFileSync(summaryPath, summary);
  console.log("Fixed authSession in config-summary.spec.ts");
}

// Fix authSession in supabase-secret-redaction.spec.ts
const redactionPath = path.join(__dirname, "tests/security/supabase-secret-redaction.spec.ts");
let redaction = fs.readFileSync(redactionPath, "utf8");
if (!redaction.includes("authSession:")) {
  redaction = redaction.replace(
    "supabase: {",
    'authSession: {\n        cookieName: "sb-auth",\n        cookieSecret: "test-secret",\n        cookieDomain: "localhost",\n        secure: false,\n        sameSite: "lax",\n      },\n      supabase: {',
  );
  fs.writeFileSync(redactionPath, redaction);
  console.log("Fixed authSession in supabase-secret-redaction.spec.ts");
}
