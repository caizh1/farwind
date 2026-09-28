import { defineConfig } from "@playwright/test";
const production = process.env.XIAOBAO_PRODUCTION === "1";
const baseURL = production ? "http://127.0.0.1:5186" : "http://127.0.0.1:5173";
export default defineConfig({
  testDir: "../tests",
  testMatch: [
    "xiaobao.spec.ts",
    "xiaobao-combat.spec.ts",
    "xiaobao-benchmark.spec.ts",
    "xiaobao-flight-gates.spec.ts",
    "xiaobao-effect-save.spec.ts",
  ],
  workers: 1,
  timeout: 240000,
  outputDir: "../test-results/xiaobao",
  reporter: "list",
  use: {
    baseURL,
    viewport: { width: 1280, height: 800 },
    headless: production,
    launchOptions: {
      args: [
        "--enable-webgl",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
      ],
    },
  },
  webServer: {
    cwd: process.cwd(),
    command: production
      ? `npx vite preview --host 127.0.0.1 --port 5186 --strictPort --outDir ${process.env.XIAOBAO_BUILD_DIR ?? ".xiaobao-local/production"}`
      : "npm run dev",
    url: baseURL,
    reuseExistingServer: !production,
  },
});
