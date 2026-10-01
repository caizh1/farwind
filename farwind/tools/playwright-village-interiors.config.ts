import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "../tests",
  testMatch: "village-interiors.spec.ts",
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: process.env.FARWIND_URL ?? "http://127.0.0.1:4199/",
    viewport: { width: 1280, height: 720 },
    launchOptions: { args: ["--enable-webgl", "--use-angle=metal"] },
    screenshot: "only-on-failure",
  },
  outputDir: "../.village-interiors-local/browser-output",
  reporter: "list",
});
