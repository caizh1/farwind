import { defineConfig } from "@playwright/test";
import base from "../playwright.config";
import { resolve } from "node:path";
// 独立端口与证据目录，避免共享工作区热更新影响验收。
const root = process.env.FARWIND_EVIDENCE_ROOT ?? "docs/village-defense/m1/evidence";
export default defineConfig({
  ...base,
  testDir: "../tests",
  workers: 1,
  webServer: undefined,
  use: { ...base.use, baseURL: "http://127.0.0.1:5185/" },
  outputDir: resolve(root, "browser-output"),
  reporter: [
    ["list"],
    [
      "json",
      { outputFile: resolve(root, "browser-results.json") },
    ],
  ],
});
