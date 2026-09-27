import { defineConfig } from "@playwright/test";
import base from "../playwright.config";
const port = Number(process.env.FARWIND_NPC_PORT ?? 53083);
export default defineConfig({
  ...base,
  testDir: "../tests",
  workers: 1,
  use: { ...base.use, baseURL: `http://127.0.0.1:${port}` },
  webServer: {
    cwd: process.cwd(),
    command: `npx vite --config tools/vite-npc-life.config.ts --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
  },
  outputDir: "../.npc-life-local/browser-results",
  reporter: [
    ["list"],
    [
      "html",
      { outputFolder: "../.npc-life-local/browser-report", open: "never" },
    ],
  ],
});
