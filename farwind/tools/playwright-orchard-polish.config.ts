import { defineConfig } from "@playwright/test";
import base from "../playwright.config";
// 独立服务及证据目录，避免其他任务覆盖运行截图。
export default defineConfig({
  ...base,
  testDir: "../tests",
  workers: 1,
  outputDir: "../docs/visual-polish/orchard/test-results",
  use: { ...base.use, baseURL: "http://127.0.0.1:5182" },
  webServer: undefined,
  reporter: [
    ["list"],
    [
      "json",
      {
        outputFile: new URL(
          "../docs/visual-polish/orchard/playwright-results.json",
          import.meta.url,
        ).pathname,
      },
    ],
  ],
});
