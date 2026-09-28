import { defineConfig } from "@playwright/test";
import base from "./playwright-first-map.config";
export default defineConfig({
  ...base,
  testMatch: ["first-map.spec.ts", "wilderness-map.spec.ts"],
  outputDir: "../.first-map-local/wilderness-results",
});
