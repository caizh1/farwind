import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
export default defineConfig({
  testDir: "../tests",
  testMatch: "sword-wind-production.browser.ts",
  workers: 1,
  timeout: 60000,
  outputDir: "../.sword-wind-local/production-results",
  reporter: [
    ["list"],
    [
      "json",
      { outputFile: resolve(".sword-wind-local/production-results.json") },
    ],
  ],
  use: {
    baseURL: "http://127.0.0.1:4193",
    viewport: { width: 1280, height: 720 },
    launchOptions: {
      args: ["--enable-gpu", "--enable-webgl", "--use-angle=metal"],
    },
  },
  webServer: {
    cwd: resolve("."),
    command:
      "npx vite preview --outDir .sword-wind-local/production --host 127.0.0.1 --port 4193 --strictPort",
    url: "http://127.0.0.1:4193",
    reuseExistingServer: true,
  },
});
