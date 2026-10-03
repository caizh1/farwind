import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "../tests",
  testMatch: "shop-layout.spec.ts",
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: process.env.FARWIND_URL ?? "http://127.0.0.1:5294/",
    viewport: { width: 1440, height: 900 },
    launchOptions: { args: ["--enable-webgl", "--use-angle=metal"] },
  },
  outputDir: "../.hud-layout-local/shop/browser-output",
  reporter: "list",
});
