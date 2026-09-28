import { defineConfig } from "@playwright/test";
// 单工作器、独立正式构建与端口；硬件加速条件与功能证据一并记录。
export default defineConfig({
  testDir: "../tests",
  testMatch: "first-map.spec.ts",
  workers: 1,
  retries: 0,
  timeout: 300000,
  use: {
    baseURL: "http://127.0.0.1:5199",
    headless: false,
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: {
      args: ["--enable-gpu", "--use-gl=angle", "--use-angle=metal"],
    },
  },
  webServer: {
    command:
      "npx vite preview --host 127.0.0.1 --port 5199 --strictPort --outDir .first-map-local/production",
    url: "http://127.0.0.1:5199",
    reuseExistingServer: false,
    cwd: process.cwd(),
  },
  outputDir: "../.first-map-local/browser-results",
  reporter: [["list"]],
});
