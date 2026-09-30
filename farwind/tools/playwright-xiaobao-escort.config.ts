import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "../tests",
  testMatch: "xiaobao-escort.spec.ts",
  workers: 1,
  timeout: 240000,
  outputDir: "../test-results/xiaobao-escort",
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5226",
    viewport: { width: 1280, height: 800 },
    headless: true,
    video: "on",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: { args: ["--enable-webgl", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
  },
  webServer: {
    cwd: process.cwd(),
    command: "npx vite preview --host 127.0.0.1 --port 5226 --strictPort --outDir .xiaobao-local/escort-production",
    url: "http://127.0.0.1:5226",
    reuseExistingServer: true,
  },
});
