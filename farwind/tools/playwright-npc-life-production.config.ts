import { defineConfig } from "@playwright/test";
import base from "./playwright-npc-life.config";
export default defineConfig({
  ...base,
  testMatch: "npc-life-production.spec.ts",
  use: { ...base.use, baseURL: "http://127.0.0.1:4183" },
  webServer: {
    cwd: process.cwd(),
    command:
      "npx vite preview --host 127.0.0.1 --port 4183 --strictPort --outDir .npc-life-local/production",
    url: "http://127.0.0.1:4183",
    reuseExistingServer: false,
  },
  outputDir: "../.npc-life-local/production-results",
  reporter: [["list"]],
});
