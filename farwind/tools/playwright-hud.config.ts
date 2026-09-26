import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "../tests",
  testMatch: "*.spec.ts",
  timeout: 240000,
  workers: 1,
  outputDir: "../docs/hud-redesign/test-results",
  use: {
    baseURL: process.env.FARWIND_URL ?? "http://127.0.0.1:5198",
    viewport: { width: 1280, height: 720 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: {
      args: [
        "--enable-webgl",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
      ],
    },
  },
  reporter: [["list"]],
});
