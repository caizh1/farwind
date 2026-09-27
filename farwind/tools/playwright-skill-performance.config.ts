import { defineConfig } from "@playwright/test";
import base from "./playwright-skill-growth.config";
export default defineConfig({
  ...base,
  testMatch: "skill-performance.spec.ts",
});
