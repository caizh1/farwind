import { defineConfig } from "@playwright/test";
import base from "../playwright.config";
const production = process.env.FARWIND_NPC_WALK_PRODUCTION === "1",
  port = production ? 53092 : 53091;
export default defineConfig({
  ...base,
  testDir: "../tests",
  testMatch: "npc-walk.spec.ts",
  workers: 1,
  use: {
    ...base.use,
    baseURL: `http://127.0.0.1:${port}`,
    headless: false,
    video: "on",
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    cwd: process.cwd(),
    command: production
      ? `npx vite preview --host 127.0.0.1 --port ${port} --strictPort --outDir .npc-life-local/locomotion/production`
      : `npx vite --config tools/vite-npc-life.config.ts --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
  },
  outputDir: `../.npc-life-local/locomotion/${production ? "production" : "development"}-results`,
  reporter: [["list"]],
});
