import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "../tests",
  testMatch: "skill-growth.spec.ts",
  timeout: 240000,
  workers: 1,
  retries: 0,
  use: {
    actionTimeout: 10000,
    navigationTimeout: 15000,
    baseURL: "http://127.0.0.1:4196",
    viewport: { width: 1280, height: 720 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: { args: ["--enable-webgl", "--use-angle=metal"] },
  },
  webServer: {
    command:
      "npx vite preview --host 127.0.0.1 --port 4196 --strictPort --outDir .skill-growth-local/production",
    url: "http://127.0.0.1:4196",
    reuseExistingServer: true,
  },
  outputDir: "../.skill-growth-local/browser-results",
  reporter: [["list"]],
});
