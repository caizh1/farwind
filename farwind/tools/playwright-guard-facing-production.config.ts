import { defineConfig } from "@playwright/test";
import base from "./playwright-npc-life.config";
// 固定正式构建与独立端口，保留其他居民生活验收的证据。
export default defineConfig({
  ...base,
  testMatch: ["guard-facing.spec.ts"],
  use: { ...base.use, baseURL: "http://127.0.0.1:53086" },
  webServer: {
    cwd: process.cwd(),
    command:
      "npx vite preview --host 127.0.0.1 --port 53086 --strictPort --outDir .npc-life-local/guard-facing-production",
    url: "http://127.0.0.1:53086",
    reuseExistingServer: false,
  },
  outputDir: "../.npc-life-local/guard-facing-production-results",
  reporter: [["list"]],
});
