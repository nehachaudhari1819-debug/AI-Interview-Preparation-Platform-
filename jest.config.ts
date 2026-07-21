import type { Config } from "jest";
import { createDefaultEsmPreset } from "ts-jest";

const preset = createDefaultEsmPreset();

const config: Config = {
  ...preset,
  testEnvironment: "node",
  clearMocks: true,
  roots: ["<rootDir>/tests"],
  testMatch: ["**/*.test.ts", "**/*.spec.ts"],
  collectCoverageFrom: ["src/**/*.ts", "!src/server.ts"],
  coverageDirectory: "coverage",
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
};

export default config;
