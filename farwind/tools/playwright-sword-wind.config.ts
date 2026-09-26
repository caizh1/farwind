import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
const off = process.env.VITE_DEV_GRANT_SWORD_WIND === "0",
  port = off ? 5194 : 5193,
  run = process.env.FARWIND_WIND_RUN ?? "main";
export default defineConfig({
  testDir: "../tests",
  testMatch: "*.spec.ts",
  timeout: 120000,
  workers: 1,
  outputDir: `../.sword-wind-local/results-${port}-${run}`,
  reporter: [
    ["list"],
    [
      "json",
      { outputFile: resolve(`.sword-wind-local/results-${port}-${run}.json`) },
    ],
  ],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    headless: process.env.FARWIND_WIND_HEADED !== "1",
    viewport: { width: 1280, height: 720 },
    video: { mode: "on", size: { width: 1280, height: 720 } },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: {
      args: ["--enable-gpu", "--enable-webgl", "--use-angle=metal"],
    },
  },
  webServer: {
    cwd: resolve("."),
    command: `FARWIND_WIND_RUNTIME=.sword-wind-local/runtime-${port} FARWIND_WIND_PORT=${port} node tools/serve-sword-wind-runtime.mjs`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: true,
  },
});
