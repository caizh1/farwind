import { defineConfig } from "@playwright/test";
import base from "../playwright.config";
// 本专项使用独立服务和结果目录，避免同时运行的其他任务覆盖 trace 与截图。
export default defineConfig({
  ...base,
  testDir: "../tests",
  workers: 1,
  outputDir: "../docs/visual-polish/test-results",
  use: { ...base.use, baseURL: "http://127.0.0.1:5181" },
  webServer: undefined,
  reporter: [
    ["list"],
    [
      "json",
      {
        outputFile: new URL(
          `../docs/visual-polish/${process.env.FARWIND_REPORT ?? "playwright-results.json"}`,
          import.meta.url,
        ).pathname,
      },
    ],
  ],
});
