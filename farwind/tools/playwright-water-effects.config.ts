import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "../tests", timeout: 240000, workers: 1,
  outputDir: "../.water-local/test-results",
  use: { baseURL: process.env.FARWIND_URL ?? "http://127.0.0.1:5192", viewport: { width: 1280, height: 800 },
    screenshot: "only-on-failure", trace: "retain-on-failure",
    launchOptions: { args: ["--enable-webgl", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] } },
  reporter: [["list"], ["json", { outputFile: "../docs/water-effects/browser-results.json" }]],
});
