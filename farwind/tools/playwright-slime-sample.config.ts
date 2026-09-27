import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '../tests', testMatch: 'slime-sample.spec.ts', workers: 1, timeout: 180000,
  outputDir: '../test-results/slime-sample',
  use: { baseURL: 'http://127.0.0.1:5174', viewport: { width: 1280, height: 720 }, video: { mode: 'on', size: { width: 1280, height: 720 } }, trace: 'retain-on-failure',
    launchOptions: { args: ['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'] } },
  webServer: { command: 'npx vite --config tools/vite-slime-sample.config.ts', url: 'http://127.0.0.1:5174', reuseExistingServer: true },
  reporter: [['list']],
});
