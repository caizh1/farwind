import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
export default defineConfig({
  testDir: "../tests", testMatch: process.env.FARWIND_URL ? ["*.spec.ts", "*.production.ts"] : "*.spec.ts", timeout: 240000, workers: 1,
  outputDir: "../docs/dialogue-portraits/evidence/playwright-results",
  use: {
    baseURL: process.env.FARWIND_URL ?? "http://127.0.0.1:5197",
    viewport: { width: 1280, height: 720 }, screenshot: "only-on-failure", trace: "retain-on-failure",
    launchOptions: { args: ["--enable-webgl", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
  },
  reporter: [["list"]],
  webServer: process.env.FARWIND_URL ? undefined : { command: "node tools/serve-dialogue-runtime.mjs", cwd: fileURLToPath(new URL("..", import.meta.url)), url: "http://127.0.0.1:5197", reuseExistingServer: false },
});
