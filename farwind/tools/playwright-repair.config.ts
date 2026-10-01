import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "../tests",
  testMatch: "repair-flow.spec.ts",
  workers: 1,
  retries: 0,
  timeout: 90000,
  outputDir: "../evidence/browser-artifacts",
  reporter: [
    ["list"],
    ["json", { outputFile: "../evidence/browser-results.json" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:5212",
    viewport: { width: 1280, height: 720 },
    trace: "retain-on-failure",
    launchOptions: { args: ["--enable-webgl", "--use-angle=metal"] },
  },
  webServer: {
    command: "node tools/serve-combat-feel.mjs",
    url: "http://127.0.0.1:5212",
    reuseExistingServer: true,
    cwd: process.cwd(),
  },
});
